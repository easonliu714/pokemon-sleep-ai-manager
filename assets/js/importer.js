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
import {buildSparseObservedPatch,isObservedWriteValue} from './data-preservation-policy.js';
import {rebaseWeeklyManualOverrideForImport} from './weekly-context-manual-override.js';
import {assertPokemonVisualUpdatePackageSafe} from './pokemon-visual-update-preflight.js';
import {
  CANDY_QUANTITY_CONFIRMATION_ACTION,
  CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
} from './candy-quantity-confirmation-authority.js';
import {
  CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
  CANDY_MUTATION_TYPES,
  recordCandyInventoryEvent,
  resolveCandyFamilyStorageForSpecies,
} from './candy-family-storage-authority.js';
import {
  FIRST_PARTY_OBSERVATION_UPDATE_ENTITY,
  FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO,
  prepareFirstPartyIngredientObservationStorageData,
  validateFirstPartyIngredientObservationUpdatePackage,
  validateFirstPartyIngredientObservationUpdateOperation,
} from './ingredient-probability-first-party-observation-update.js';

const KEYS = {
  account_capacity: ['capacity_key'],
  ingredient_inventory: ['ingredient_name'],
  item_inventory: ['item_name'],
  candy_inventory: ['candy_id'],
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
  ingredient_probability_observations: ['observation_id'],
};

const ACTIONS = new Set(['insert', 'update', 'upsert', 'archive', 'discarded', 'delete']);
const MISSING_POLICIES = new Set(['conflict', 'skip', 'insert']);
const AUDIT_STATUSES = new Set([
  'observed','derived','user_confirmed_not_visible','not_observed_yet','missing','not_applicable','conflicting',
]);
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const isMeaningful = isObservedWriteValue;
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const validNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

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

function validateCandyScreenshotQuantityAuthority(operation,index) {
  if (operation.entity !== 'candy_inventory') return;
  const data=operation.data||{},evidence=operation.evidence||{};
  if (!hasOwn(data,'quantity') || !isMeaningful(data.quantity)) return;
  const isScreenshotCandidate=evidence.source_type==='screenshot'||evidence.quantity_candidate_source==='OCR_SCREENSHOT_HINT';
  if (!isScreenshotCandidate) return;
  const label=`操作 ${index}`;
  if (evidence.quantity_confirmed_by_user !== true) throw new Error(`${label}：截圖糖果 quantity 必須由使用者明確確認`);
  if (evidence.quantity_confirmation_authority !== CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION) throw new Error(`${label}：截圖糖果 quantity_confirmation_authority 不相符`);
  if (evidence.quantity_confirmation_action !== CANDY_QUANTITY_CONFIRMATION_ACTION) throw new Error(`${label}：截圖糖果 quantity_confirmation_action 不相符`);
  if (!Object.is(evidence.confirmed_quantity,data.quantity)) throw new Error(`${label}：截圖糖果 confirmed_quantity 與 data.quantity 不一致`);
  if (typeof evidence.quantity_confirmed_at !== 'string' || !evidence.quantity_confirmed_at.trim()) throw new Error(`${label}：截圖糖果缺少 quantity_confirmed_at`);
}

function validateEntityValues(operation, index) {
  const data = operation.data || {};
  const label = `操作 ${index}`;
  if (operation.entity === FIRST_PARTY_OBSERVATION_UPDATE_ENTITY) {
    const validation=validateFirstPartyIngredientObservationUpdateOperation(operation);
    if(validation.errors.length)throw new Error(`${label}：${validation.errors.join('；')}`);
  }
  if (operation.entity === 'ingredient_inventory' && hasOwn(data, 'quantity') && isMeaningful(data.quantity) && !validNonNegativeInteger(data.quantity)) {
    throw new Error(`${label}：quantity 必須為 0 以上整數`);
  }
  if (['item_inventory','candy_inventory'].includes(operation.entity)) {
    for (const field of ['quantity', 'safe_reserve']) {
      if (hasOwn(data, field) && isMeaningful(data[field]) && !validNonNegativeInteger(data[field])) throw new Error(`${label}：${field} 必須為 0 以上整數`);
    }
  }
  validateCandyScreenshotQuantityAuthority(operation,index);
  if (operation.entity === 'recipes') {
    if (hasOwn(data, 'unlocked') && isMeaningful(data.unlocked) && ![true, false, 0, 1].includes(data.unlocked)) throw new Error(`${label}：unlocked 必須為 true/false 或 0/1`);
    for (const field of ['recipe_level', 'current_energy']) {
      if (hasOwn(data, field) && isMeaningful(data[field]) && !validNonNegativeInteger(data[field])) throw new Error(`${label}：${field} 必須為 0 以上整數`);
    }
  }
}

function validate(payload) {
  for (const key of ['schema_version', 'update_id', 'generated_at', 'operations']) {
    if (!(key in payload)) throw new Error(`缺少欄位：${key}`);
  }
  if (!Array.isArray(payload.operations)) throw new Error('operations 必須是陣列');
  if (payload.operations.length > 5000) throw new Error('單包最多 5000 operations');
  validateProfileAudit(payload);
  const hasFirstPartyObservation=payload.operations.some(operation=>operation?.entity===FIRST_PARTY_OBSERVATION_UPDATE_ENTITY);
  if(hasFirstPartyObservation||payload.scenario===FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO){
    const validation=validateFirstPartyIngredientObservationUpdatePackage(payload);
    if(validation.errors.length)throw new Error(`E3C-6B first-party observation 更新包驗證失敗：${validation.errors.join('；')}`);
  }

  payload.operations.forEach((operation, index) => {
    if (!KEYS[operation.entity]) throw new Error(`操作 ${index}：不支援 entity`);
    if (!ACTIONS.has(operation.action)) throw new Error(`操作 ${index}：不支援 action`);
    if (operation.entity === 'candy_inventory' && operation.action !== 'upsert') throw new Error(`操作 ${index}：糖果庫存只允許 upsert`);
    if (operation.missing_policy && !MISSING_POLICIES.has(operation.missing_policy)) throw new Error(`操作 ${index}：不支援 missing_policy`);
    if (operation.review_required === true && !acceptedReview(operation)) throw new Error(`操作 ${index} 尚需人工確認`);
    if (operation.entity === 'recipes') {
      if (!isMeaningful(operation.key?.recipe_id) && !isMeaningful(operation.key?.recipe_name)) throw new Error(`操作 ${index}：recipes key 至少需要 recipe_id 或 recipe_name`);
    } else if (operation.entity === 'candy_inventory') {
      if (!isMeaningful(operation.key?.candy_id) && !isMeaningful(operation.key?.candy_name)) throw new Error(`操作 ${index}：candy_inventory key 至少需要 candy_id 或 candy_name`);
    } else {
      for (const key of KEYS[operation.entity]) if (!(key in (operation.key || {}))) throw new Error(`操作 ${index}：key 缺少 ${key}`);
    }
    validateEntityValues(operation, index);
  });
}

function existing(entity, key) {
  const keys = KEYS[entity];
  return rows(
    `SELECT * FROM ${quote(entity)} WHERE ${keys.map((name) => `${quote(name)}=?`).join(' AND ')}`,
    keys.map((name) => key[name]),
  )[0] || null;
}

function canonicalCandyStorageKey(key) {
  if (!isMeaningful(key?.candy_id)) return key;
  const master=rows('SELECT candy_id,candy_name,candy_type,target_species_name FROM candy_master WHERE candy_id=?',[key.candy_id])[0]||null;
  if(!master||master.candy_type!=='species')return {candy_id:key.candy_id};
  const storage=resolveCandyFamilyStorageForSpecies(master.target_species_name);
  if(storage.status!=='MATCH')throw new Error(`糖果 ${master.candy_name||master.candy_id} 尚無可寫入的家族 canonical storage：${storage.reason}`);
  const canonical=rows("SELECT candy_id FROM candy_master WHERE candy_type='species' AND target_species_name=?",[storage.canonical_species_name])[0]||null;
  if(!canonical?.candy_id)throw new Error(`糖果家族 ${storage.family_id} 缺少 canonical candy_master row`);
  return {candy_id:canonical.candy_id};
}

function resolveOperationKey(operation) {
  let key = { ...(operation.key || {}) };
  if (operation.entity === 'recipes' && !isMeaningful(key.recipe_id) && isMeaningful(key.recipe_name)) {
    const master = rows('SELECT recipe_id FROM recipe_master WHERE recipe_name=?', [key.recipe_name])[0];
    const player = rows('SELECT recipe_id FROM recipes WHERE recipe_name=?', [key.recipe_name])[0];
    if (master?.recipe_id || player?.recipe_id) return { recipe_id: master?.recipe_id || player.recipe_id };
  }
  if (operation.entity === 'candy_inventory' && !isMeaningful(key.candy_id) && isMeaningful(key.candy_name)) {
    const master = rows('SELECT candy_id FROM candy_master WHERE candy_name=?', [key.candy_name])[0];
    if (master?.candy_id) key={candy_id:master.candy_id};
  }
  if(operation.entity==='candy_inventory'&&isMeaningful(key.candy_id))return canonicalCandyStorageKey(key);
  return key;
}

function candyStorageForKey(key){
  if(!isMeaningful(key?.candy_id))return null;
  const master=rows('SELECT candy_id,candy_type,target_species_name FROM candy_master WHERE candy_id=?',[key.candy_id])[0]||null;
  if(!master||master.candy_type!=='species')return null;
  const storage=resolveCandyFamilyStorageForSpecies(master.target_species_name);
  return storage.status==='MATCH'?{...storage,canonical_candy_id:key.candy_id}:null;
}

function candyAbsoluteEventAt(operation,payload){
  const evidence=operation?.evidence||{};
  return String(evidence.quantity_confirmed_at||evidence.observed_at||payload?.generated_at||localIso()).trim();
}

function sparseData(operation) {
  const result = buildSparseObservedPatch(operation.data || {}, operation.clear_fields || []);
  if (operation.entity === 'recipes' && hasOwn(result, 'unlocked')) result.unlocked = result.unlocked === true || result.unlocked === 1 ? 1 : 0;
  return result;
}

function managedData(operation, key, before, inputData, payload) {
  if(operation.entity===FIRST_PARTY_OBSERVATION_UPDATE_ENTITY){
    return prepareFirstPartyIngredientObservationStorageData(operation,payload,localIso());
  }
  const data = { ...inputData };
  const hasPlayerChange = Object.keys(inputData).some((field) => !['updated_at', 'source_update_id'].includes(field));
  if (operation.entity === 'account_capacity' && hasPlayerChange) {
    if (!hasOwn(data, 'updated_at')) data.updated_at = localIso();
  }
  if (['ingredient_inventory', 'item_inventory','candy_inventory'].includes(operation.entity) && hasPlayerChange) {
    if (!hasOwn(data, 'updated_at')) data.updated_at = operation.entity==='candy_inventory'&&hasOwn(inputData,'quantity')?candyAbsoluteEventAt(operation,payload):localIso();
    if (!hasOwn(data, 'source_update_id')) data.source_update_id = payload.update_id;
  }
  if (operation.entity === 'recipes') {
    const master = rows('SELECT recipe_id,category,recipe_name,total_ingredients FROM recipe_master WHERE recipe_id=?', [key.recipe_id])[0] || null;
    if (!before && master) {
      if (!hasOwn(data, 'category')) data.category = master.category;
      if (!hasOwn(data, 'recipe_name')) data.recipe_name = master.recipe_name;
      if (!hasOwn(data, 'total_ingredients')) data.total_ingredients = Number(master.total_ingredients || 0);
      if (!hasOwn(data, 'source')) data.source = 'general_update_center';
    }
    if (hasPlayerChange && !hasOwn(data, 'updated_at')) data.updated_at = localIso();
  }
  return data;
}

function fieldAudit(operation, before, data) {
  const clearFields = new Set(operation.clear_fields || []);
  const source = operation.data || {};
  const fields = new Set([...Object.keys(source), ...clearFields]);
  return [...fields].map((field) => {
    const incoming = hasOwn(source, field) ? source[field] : undefined;
    const previous = before?.[field];
    let decision = 'unchanged';
    let effective = previous;
    if (clearFields.has(field) && !isMeaningful(incoming)) {
      decision = 'explicit_clear';
      effective = null;
    } else if (!isMeaningful(incoming)) {
      decision = isMeaningful(previous) ? 'preserve_existing_empty_incoming' : 'ignore_empty_incoming';
    } else if (before && (Object.is(previous, incoming) || (typeof previous === 'number' && typeof incoming === 'boolean' && previous === Number(incoming)))) {
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

function publicMasterExists(entity, key) {
  if (entity === 'ingredient_inventory') return Number(scalar('SELECT COUNT(*) FROM ingredient_master WHERE ingredient_name=?', [key.ingredient_name]) || 0) > 0;
  if (entity === 'item_inventory') return Number(scalar('SELECT COUNT(*) FROM item_master WHERE item_name=?', [key.item_name]) || 0) > 0;
  if (entity === 'candy_inventory') return isMeaningful(key.candy_id) && Number(scalar('SELECT COUNT(*) FROM candy_master WHERE candy_id=?', [key.candy_id]) || 0) > 0;
  if (entity === 'recipes') return Number(scalar('SELECT COUNT(*) FROM recipe_master WHERE recipe_id=?', [key.recipe_id]) || 0) > 0;
  return true;
}

export function dryRun(payload) {
  validate(payload);
  const visualPreflight=assertPokemonVisualUpdatePackageSafe(payload);
  if (scalar('SELECT COUNT(*) FROM import_batches WHERE update_id=?', [payload.update_id])) throw new Error(`update_id 已套用：${payload.update_id}`);
  const aliases = new Map();
  const changes = [];
  payload.operations.forEach((operation, index) => {
    const incomingKey = resolveOperationKey(operation);
    if (incomingKey.pokemon_id && aliases.has(incomingKey.pokemon_id)) incomingKey.pokemon_id = aliases.get(incomingKey.pokemon_id);
    let key = incomingKey;
    let before = isMeaningful(key[KEYS[operation.entity][0]]) ? existing(operation.entity, key) : null;
    let effectiveAction = operation.action;
    let message = '';
    let conflict = false;
    const missingPolicy = operation.missing_policy || 'conflict';
    if (operation.entity === 'recipes' && !isMeaningful(key.recipe_id)) { conflict = true; message = `找不到公版料理：${operation.key?.recipe_name || 'unknown'}`; }
    if (operation.entity === 'candy_inventory' && !isMeaningful(key.candy_id)) { conflict = true; message = `找不到公版糖果：${operation.key?.candy_name || 'unknown'}；若為「寶可夢的糖果」，請先確認寶可夢公版名稱`; }
    if (!conflict && !before && ['ingredient_inventory','item_inventory','candy_inventory','recipes'].includes(operation.entity) && !publicMasterExists(operation.entity, key)) {
      conflict = true;
      message = `${operation.entity} 對應公版主檔不存在，請先核對名稱／stable id`;
    }
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
    const sparse = sparseData(operation);
    const data = managedData(operation, key, before, sparse, payload);
    const audit = fieldAudit(operation, before, data);
    const candyStorage=operation.entity==='candy_inventory'?candyStorageForKey(key):null;
    const candyEventAt=candyStorage&&hasOwn(sparse,'quantity')?candyAbsoluteEventAt(operation,payload):null;
    if(!conflict&&candyStorage&&candyEventAt){
      const latest=rows('SELECT event_id,event_at FROM candy_inventory_events WHERE family_id=? ORDER BY event_at DESC,event_id DESC LIMIT 1',[candyStorage.family_id])[0]||null;
      if(latest?.event_at&&String(latest.event_at)>String(candyEventAt)){
        conflict=true;
        message=`糖果家族 ${candyStorage.family_id} 已有較新的觀測事件 ${latest.event_at}；拒絕套用較舊 absolute snapshot ${candyEventAt}`;
      }
    }
    let after;
    if (['insert', 'update'].includes(effectiveAction)) after = { ...(before || {}), ...key, ...data };
    else if (operation.action === 'archive' && effectiveAction !== 'skip') after = { ...(before || {}), status: 'archived' };
    else after = before ? { ...before } : { ...key, ...data };
    const preservedCount = audit.filter((item) => item.decision === 'preserve_existing_empty_incoming').length;
    if (preservedCount && !message) message = `保留 ${preservedCount} 個既有非空欄位（incoming 為空）`;
    changes.push({index,entity:operation.entity,requested_action:operation.action,effective_action:effectiveAction,original_key:operation.key,key,before,after,data,field_audit:audit,user_audit:operation.user_audit||null,candy_storage:candyStorage,candy_event_at:candyEventAt,status:conflict?'conflict':'ready',message});
  });
  const allFieldAudit = changes.flatMap((change) => change.field_audit || []);
  return {
    update_id:payload.update_id,
    scenario:payload.scenario||'general',
    operation_count:changes.length,
    ready_count:changes.filter(item=>item.status==='ready').length,
    conflict_count:changes.filter(item=>item.status==='conflict').length,
    visual_preflight:visualPreflight,
    audit_summary:{
      field_count:allFieldAudit.length,
      preserved_existing_count:allFieldAudit.filter(item=>item.decision==='preserve_existing_empty_incoming').length,
      explicit_clear_count:allFieldAudit.filter(item=>item.decision==='explicit_clear').length,
      non_empty_update_count:allFieldAudit.filter(item=>['update_non_empty','insert_non_empty'].includes(item.decision)).length,
      profile_confirmation_count:Array.isArray(payload.profile_audit_confirmations)?payload.profile_audit_confirmations.length:0,
      visual_evidence_declared:visualPreflight.declared===true,
      visual_evidence_status:visualPreflight.status,
      candy_family_storage_authority:CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
      candy_absolute_snapshot_count:changes.filter(item=>item.candy_storage&&item.candy_event_at&&item.status==='ready').length,
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
    let weeklyManualOverrideRebase=null;
    if(payload.scenario==='weekly_context_update'){
      const weeklyIndex=payload.operations.findIndex(operation=>operation?.entity==='weekly_context');
      if(weeklyIndex>=0){
        const operation=payload.operations[weeklyIndex];
        const change=preview.changes[weeklyIndex];
        weeklyManualOverrideRebase=rebaseWeeklyManualOverrideForImport({
          weekStart:operation.data?.week_start??change?.after?.week_start??change?.before?.week_start??null,
          newImportRevision:payload.update_id,
          incomingData:operation.data||{},
          clearFields:operation.clear_fields||[],
          previousCamp:change?.before?.camp??null,
        });
      }
    }
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
      if(change.candy_storage&&change.candy_event_at&&hasOwn(operation.data||{},'quantity')&&isMeaningful(operation.data?.quantity)&&change.effective_action!=='skip'){
        recordCandyInventoryEvent(run,{
          event_id:`import:${payload.update_id}:${index}`,
          family_id:change.candy_storage.family_id,
          canonical_candy_id:change.key.candy_id,
          source_candy_id:operation.key?.candy_id||change.key.candy_id,
          mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,
          quantity_value:Number(change.after.quantity),
          event_at:change.candy_event_at,
          source_update_id:payload.update_id,
          authority:operation.evidence?.quantity_confirmation_authority||'USER_IMPORT_ABSOLUTE_STATE_WRITE',
          evidence:{operation_evidence:operation.evidence||{},original_key:operation.key||{},generated_at:payload.generated_at,source:payload.source||null},
          created_at:localIso(),
        });
      }
      run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[payload.update_id,index,operation.entity,operation.action,JSON.stringify(change.key),change.before?JSON.stringify(change.before):null,change.after?JSON.stringify(change.after):null,change.effective_action==='skip'?'skipped':'applied',change.message||'']);
    });
    const resultJson = {
      status:'applied',
      scenario:payload.scenario||'general',
      audit_summary:preview.audit_summary,
      pokemon_visual_preflight:preview.visual_preflight,
      profile_audit_confirmations:payload.profile_audit_confirmations||[],
      null_overwrite_policy:'preserve_existing_unless_clear_fields',
      explicit_zero_and_false_are_values:true,
      candy_family_storage_authority:CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
      candy_quantity_mutation_semantics:'ABSOLUTE_SNAPSHOT',
      ...(weeklyManualOverrideRebase?{weekly_manual_override_rebase:weeklyManualOverrideRebase}:{}),
    };
    run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[payload.update_id,String(payload.schema_version),payload.generated_at,localIso(),payload.source||'',payload.operations.length,JSON.stringify(resultJson)]);
    commit();
    await persist();
    return {operation_count:payload.operations.length,scenario:payload.scenario||'general',audit_summary:preview.audit_summary,visual_preflight:preview.visual_preflight,weekly_manual_override_rebase:weeklyManualOverrideRebase};
  } catch(error){rollback();throw error;}
}
