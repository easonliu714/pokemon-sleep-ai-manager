import {
  rows,
  run,
  scalar,
  begin,
  commit,
  rollback,
  persist,
  snapshot,
} from './database.js';
import { localIso } from './time-utils.js';

const KEYS = {
  account_capacity: ['capacity_key'],
  ingredient_inventory: ['ingredient_name'],
  item_inventory: ['item_name'],
  pokemon: ['pokemon_id'],
  pokemon_subskills: ['pokemon_id', 'unlock_level'],
  pokemon_ingredients: ['pokemon_id', 'unlock_level'],
  pokemon_evolution_history: ['evolution_id'],
  pokemon_identity_evidence: ['evidence_id'],
  discarded_pokemon: ['discard_id'],
  weekly_plan: ['plan_id'],
  weekly_context: ['context_id'],
  weekly_strategy: ['strategy_id'],
  settings: ['key'],
  recipes: ['recipe_id'],
  recipe_ingredients: ['recipe_id', 'ingredient_name'],
};

const ACTIONS = new Set(['insert', 'update', 'upsert', 'archive', 'discarded', 'delete']);
const MISSING_POLICIES = new Set(['conflict', 'skip', 'insert']);
const AUDIT_STATUSES = new Set([
  'observed',
  'derived',
  'user_confirmed_not_visible',
  'not_observed_yet',
  'missing',
  'not_applicable',
  'conflicting',
]);
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const isMeaningful = (value) => value !== null && value !== undefined && value !== '';

function acceptedReview(operation) {
  return operation.user_audit?.accepted_current_observation === true
    || operation.review_resolution === 'accepted_current_observation';
}

function validateProfileAudit(payload) {
  const confirmations = payload.profile_audit_confirmations;
  if (confirmations == null) return;
  if (!Array.isArray(confirmations)) throw new Error('profile_audit_confirmations 必須是陣列');
  confirmations.forEach((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`profile_audit_confirmations ${index} 格式錯誤`);
    if (!isMeaningful(item.pokemon_id)) throw new Error(`profile_audit_confirmations ${index} 缺少 pokemon_id`);
    if (!AUDIT_STATUSES.has(item.status)) throw new Error(`profile_audit_confirmations ${index} 不支援 status`);
    if (item.status === 'user_confirmed_not_visible' && item.confirmed_by_user !== true) {
      throw new Error(`profile_audit_confirmations ${index} 必須由使用者明確確認`);
    }
  });
}

function validate(payload) {
  for (const key of ['schema_version', 'update_id', 'generated_at', 'operations']) {
    if (!(key in payload)) throw new Error(`缺少欄位：${key}`);
  }
  if (!Array.isArray(payload.operations)) throw new Error('operations 必須是陣列');
  if (payload.operations.length > 5000) throw new Error('單包最多 5000 operations');
  validateProfileAudit(payload);

  payload.operations.forEach((operation, index) => {
    if (!KEYS[operation.entity]) throw new Error(`操作 ${index}：不支援 entity`);
    if (!ACTIONS.has(operation.action)) throw new Error(`操作 ${index}：不支援 action`);
    if (operation.missing_policy && !MISSING_POLICIES.has(operation.missing_policy)) {
      throw new Error(`操作 ${index}：不支援 missing_policy`);
    }
    if (operation.review_required === true && !acceptedReview(operation)) {
      throw new Error(`操作 ${index} 尚需人工確認`);
    }
    for (const key of KEYS[operation.entity]) {
      if (!(key in (operation.key || {}))) throw new Error(`操作 ${index}：key 缺少 ${key}`);
    }
  });
}

function existing(entity, key) {
  const keys = KEYS[entity];
  return rows(
    `SELECT * FROM ${quote(entity)} WHERE ${keys.map((name) => `${quote(name)}=?`).join(' AND ')}`,
    keys.map((name) => key[name]),
  )[0] || null;
}

function sparseData(operation) {
  const source = operation.data || {};
  const clearFields = new Set(operation.clear_fields || []);
  const result = {};
  for (const [key, value] of Object.entries(source)) {
    if (isMeaningful(value) || value === 0 || value === false) result[key] = value;
    else if (clearFields.has(key)) result[key] = null;
  }
  return result;
}

function fieldAudit(operation, before, data) {
  const clearFields = new Set(operation.clear_fields || []);
  const source = operation.data || {};
  const fields = new Set([...Object.keys(source), ...clearFields]);
  return [...fields].map((field) => {
    const incoming = Object.prototype.hasOwnProperty.call(source, field) ? source[field] : undefined;
    const previous = before?.[field];
    let decision = 'unchanged';
    let effective = previous;
    if (clearFields.has(field) && !isMeaningful(incoming)) {
      decision = 'explicit_clear';
      effective = null;
    } else if (!isMeaningful(incoming) && incoming !== 0 && incoming !== false) {
      decision = isMeaningful(previous) || previous === 0 || previous === false
        ? 'preserve_existing_empty_incoming'
        : 'ignore_empty_incoming';
    } else if (before && Object.is(previous, incoming)) {
      decision = 'same_value';
      effective = previous;
    } else {
      decision = before ? 'update_non_empty' : 'insert_non_empty';
      effective = data[field];
    }
    return { field, existing: previous, incoming, effective, decision };
  });
}

function uniqueCandidate(sql, params) {
  const candidates = rows(sql, params);
  if (candidates.length === 1) return { match: candidates[0], ambiguous: false };
  if (candidates.length > 1) return { match: null, ambiguous: true };
  return { match: null, ambiguous: false };
}

function resolvePokemonIdentity(operation) {
  const data = operation.data || {};
  const explicitTarget = operation.identity_match?.target_pokemon_id;
  if (explicitTarget) {
    const match = rows('SELECT * FROM pokemon WHERE pokemon_id=?', [explicitTarget])[0] || null;
    return match ? { match, ambiguous: false, reason: '更新包明確指定既有 pokemon_id' }
      : { match: null, ambiguous: false, invalidTarget: true, reason: 'identity_match 指定的 pokemon_id 不存在' };
  }
  if (isMeaningful(data.pokemon_instance_id)) {
    const result = uniqueCandidate('SELECT * FROM pokemon WHERE pokemon_instance_id=? AND status<>\'archived\'',[data.pokemon_instance_id]);
    if (result.match || result.ambiguous) return { ...result, reason: 'pokemon_instance_id' };
  }
  if (isMeaningful(data.game_pokemon_id)) {
    const result = uniqueCandidate('SELECT * FROM pokemon WHERE game_pokemon_id=? AND status<>\'archived\'',[data.game_pokemon_id]);
    if (result.match || result.ambiguous) return { ...result, reason: 'game_pokemon_id' };
  }
  if (isMeaningful(data.identity_fingerprint) && isMeaningful(data.registered_at)) {
    const result = uniqueCandidate(`SELECT * FROM pokemon WHERE identity_fingerprint=? AND registered_at=? AND status<>'archived'`,[data.identity_fingerprint,data.registered_at]);
    if (result.match || result.ambiguous) return { ...result, reason: 'registered_at + identity_fingerprint' };
  }
  return { match: null, ambiguous: false, reason: '' };
}

export function dryRun(payload) {
  validate(payload);
  if (scalar('SELECT COUNT(*) FROM import_batches WHERE update_id=?', [payload.update_id])) throw new Error(`update_id 已套用：${payload.update_id}`);
  const aliases = new Map();
  const changes = [];
  payload.operations.forEach((operation, index) => {
    const incomingKey = { ...(operation.key || {}) };
    if (incomingKey.pokemon_id && aliases.has(incomingKey.pokemon_id)) incomingKey.pokemon_id = aliases.get(incomingKey.pokemon_id);
    let key = incomingKey;
    let before = existing(operation.entity, key);
    let effectiveAction = operation.action;
    let message = '';
    let conflict = false;
    const missingPolicy = operation.missing_policy || 'conflict';
    if (operation.entity === 'pokemon' && !before && ['insert', 'upsert'].includes(operation.action)) {
      const resolution = resolvePokemonIdentity(operation);
      if (resolution.invalidTarget) { conflict = true; message = resolution.reason; }
      else if (resolution.ambiguous) { conflict = true; message = `${resolution.reason} 符合多筆現有資料，必須人工指定 identity_match.target_pokemon_id`; }
      else if (resolution.match) {
        const incomingId = operation.key.pokemon_id;
        const resolvedId = resolution.match.pokemon_id;
        aliases.set(incomingId, resolvedId);
        key = { pokemon_id: resolvedId };
        before = resolution.match;
        effectiveAction = 'update';
        message = `${resolution.reason} 唯一吻合，合併至既有 ID：${resolvedId}`;
      }
    }
    if (operation.action === 'upsert' && !conflict) effectiveAction = before ? 'update' : 'insert';
    if (operation.action === 'insert' && before && !message) { conflict = true; message = '目標已存在'; }
    if (['update', 'archive', 'delete'].includes(operation.action) && !before) {
      if (missingPolicy === 'skip') { effectiveAction = 'skip'; message = '目標不存在，依 missing_policy=skip 略過'; }
      else if (missingPolicy === 'insert' && operation.action === 'update') { effectiveAction = 'insert'; message = '目標不存在，依 missing_policy=insert 改為新增'; }
      else { conflict = true; message = '目標不存在'; }
    }
    const data = sparseData(operation);
    const audit = fieldAudit(operation, before, data);
    let after;
    if (['insert', 'update'].includes(effectiveAction)) after = { ...(before || {}), ...key, ...data };
    else if (operation.action === 'archive' && effectiveAction !== 'skip') after = { ...(before || {}), status: 'archived' };
    else after = before ? { ...before } : { ...key, ...data };
    const preservedCount = audit.filter((item) => item.decision === 'preserve_existing_empty_incoming').length;
    if (preservedCount && !message) message = `保留 ${preservedCount} 個既有非空欄位（incoming 為空）`;
    changes.push({index,entity:operation.entity,requested_action:operation.action,effective_action:effectiveAction,original_key:operation.key,key,before,after,data,field_audit:audit,user_audit:operation.user_audit||null,status:conflict?'conflict':'ready',message});
  });
  const allFieldAudit = changes.flatMap((change) => change.field_audit || []);
  return {
    update_id:payload.update_id,
    operation_count:changes.length,
    ready_count:changes.filter(item=>item.status==='ready').length,
    conflict_count:changes.filter(item=>item.status==='conflict').length,
    audit_summary:{
      field_count:allFieldAudit.length,
      preserved_existing_count:allFieldAudit.filter(item=>item.decision==='preserve_existing_empty_incoming').length,
      explicit_clear_count:allFieldAudit.filter(item=>item.decision==='explicit_clear').length,
      non_empty_update_count:allFieldAudit.filter(item=>item.decision==='update_non_empty').length,
      profile_confirmation_count:Array.isArray(payload.profile_audit_confirmations)?payload.profile_audit_confirmations.length:0,
    },
    changes,
  };
}

function write(entity, key, data, mode) {
  const record = { ...key, ...data };
  const columns = Object.keys(record);
  const keys = KEYS[entity];
  if (mode === 'insert') {
    run(`INSERT INTO ${quote(entity)}(${columns.map(quote).join(',')}) VALUES(${columns.map(() => '?').join(',')})`,columns.map(column=>record[column]));
    return;
  }
  const updates = columns.filter(column=>!keys.includes(column));
  if (!updates.length) return;
  run(`UPDATE ${quote(entity)} SET ${updates.map(column=>`${quote(column)}=?`).join(',')} WHERE ${keys.map(column=>`${quote(column)}=?`).join(' AND ')}`,[...updates.map(column=>record[column]),...keys.map(column=>key[column])]);
}

export async function applyPayload(payload) {
  const preview = dryRun(payload);
  if (preview.conflict_count) throw new Error('更新包仍有衝突');
  await snapshot(`before:${payload.update_id}`);
  begin();
  try {
    payload.operations.forEach((operation,index)=>{
      const change=preview.changes[index];
      if(change.effective_action==='insert')write(operation.entity,change.key,change.data,'insert');
      else if(change.effective_action==='update')write(operation.entity,change.key,change.data,'update');
      else if(change.effective_action==='skip'){}
      else if(operation.action==='archive')write(operation.entity,change.key,{status:'archived'},'update');
      else if(operation.action==='delete'){
        const keys=KEYS[operation.entity];
        run(`DELETE FROM ${quote(operation.entity)} WHERE ${keys.map(key=>`${quote(key)}=?`).join(' AND ')}`,keys.map(key=>change.key[key]));
      }
      run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[payload.update_id,index,operation.entity,operation.action,JSON.stringify(change.key),change.before?JSON.stringify(change.before):null,change.after?JSON.stringify(change.after):null,change.effective_action==='skip'?'skipped':'applied',change.message||'']);
    });
    const resultJson = {
      status:'applied',
      audit_summary:preview.audit_summary,
      profile_audit_confirmations:payload.profile_audit_confirmations||[],
      null_overwrite_policy:'preserve_existing_unless_clear_fields',
    };
    run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[payload.update_id,String(payload.schema_version),payload.generated_at,localIso(),payload.source||'',payload.operations.length,JSON.stringify(resultJson)]);
    commit();
    await persist();
    return {operation_count:payload.operations.length,audit_summary:preview.audit_summary};
  } catch(error){rollback();throw error;}
}
