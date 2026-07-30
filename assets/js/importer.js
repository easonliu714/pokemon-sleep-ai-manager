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
  discarded_pokemon: ['discard_id'],
  weekly_plan: ['plan_id'],
  settings: ['key'],
  recipes: ['recipe_id'],
  recipe_ingredients: ['recipe_id', 'ingredient_name'],
};

const ACTIONS = new Set(['insert', 'update', 'upsert', 'archive', 'discarded', 'delete']);
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const isMeaningful = (value) => value !== null && value !== undefined && value !== '';

function validate(payload) {
  for (const key of ['schema_version', 'update_id', 'generated_at', 'operations']) {
    if (!(key in payload)) throw new Error(`缺少欄位：${key}`);
  }
  if (!Array.isArray(payload.operations)) throw new Error('operations 必須是陣列');
  if (payload.operations.length > 5000) throw new Error('單包最多 5000 operations');

  payload.operations.forEach((operation, index) => {
    if (!KEYS[operation.entity]) throw new Error(`操作 ${index}：不支援 entity`);
    if (!ACTIONS.has(operation.action)) throw new Error(`操作 ${index}：不支援 action`);
    if (operation.review_required === true) throw new Error(`操作 ${index} 尚需人工確認`);
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

function resolvePokemonIdentity(operation) {
  const data = operation.data || {};
  const required = ['species', 'level', 'specialty', 'type', 'rating'];
  if (!required.every((key) => isMeaningful(data[key]))) return { match: null, ambiguous: false };

  const candidates = rows(
    `SELECT * FROM pokemon
     WHERE status='active'
       AND species=?
       AND level=?
       AND specialty=?
       AND type=?
       AND rating=?`,
    [data.species, data.level, data.specialty, data.type, data.rating],
  );

  if (candidates.length === 1) return { match: candidates[0], ambiguous: false };
  if (candidates.length > 1) return { match: null, ambiguous: true };
  return { match: null, ambiguous: false };
}

export function dryRun(payload) {
  validate(payload);
  if (scalar('SELECT COUNT(*) FROM import_batches WHERE update_id=?', [payload.update_id])) {
    throw new Error(`update_id 已套用：${payload.update_id}`);
  }

  const aliases = new Map();
  const changes = [];

  payload.operations.forEach((operation, index) => {
    const incomingKey = { ...(operation.key || {}) };
    if (incomingKey.pokemon_id && aliases.has(incomingKey.pokemon_id)) {
      incomingKey.pokemon_id = aliases.get(incomingKey.pokemon_id);
    }

    let key = incomingKey;
    let before = existing(operation.entity, key);
    let effectiveAction = operation.action;
    let message = '';
    let conflict = false;

    if (operation.entity === 'pokemon' && !before && ['insert', 'upsert'].includes(operation.action)) {
      const resolution = resolvePokemonIdentity(operation);
      if (resolution.ambiguous) {
        conflict = true;
        message = '個體指紋符合多筆現有資料，必須人工指定 pokemon_id';
      } else if (resolution.match) {
        const incomingId = operation.key.pokemon_id;
        const resolvedId = resolution.match.pokemon_id;
        aliases.set(incomingId, resolvedId);
        key = { pokemon_id: resolvedId };
        before = resolution.match;
        effectiveAction = 'update';
        message = `唯一個體指紋吻合，合併至既有 ID：${resolvedId}`;
      }
    }

    if (operation.action === 'upsert' && !conflict) {
      effectiveAction = before ? 'update' : 'insert';
    }
    if (operation.action === 'insert' && before && !message) {
      conflict = true;
      message = '目標已存在';
    }
    if (['update', 'archive', 'delete'].includes(operation.action) && !before) {
      conflict = true;
      message = '目標不存在';
    }

    const data = sparseData(operation);
    let after;
    if (['insert', 'update'].includes(effectiveAction)) {
      after = { ...(before || {}), ...key, ...data };
    } else if (operation.action === 'archive') {
      after = { ...(before || {}), status: 'archived' };
    } else {
      after = { ...key, ...data };
    }

    changes.push({
      index,
      entity: operation.entity,
      requested_action: operation.action,
      effective_action: effectiveAction,
      original_key: operation.key,
      key,
      before,
      after,
      data,
      status: conflict ? 'conflict' : 'ready',
      message,
    });
  });

  return {
    update_id: payload.update_id,
    operation_count: changes.length,
    ready_count: changes.filter((item) => item.status === 'ready').length,
    conflict_count: changes.filter((item) => item.status === 'conflict').length,
    changes,
  };
}

function write(entity, key, data, mode) {
  const record = { ...key, ...data };
  const columns = Object.keys(record);
  const keys = KEYS[entity];

  if (mode === 'insert') {
    run(
      `INSERT INTO ${quote(entity)}(${columns.map(quote).join(',')}) VALUES(${columns.map(() => '?').join(',')})`,
      columns.map((column) => record[column]),
    );
    return;
  }

  const updates = columns.filter((column) => !keys.includes(column));
  if (!updates.length) return;
  run(
    `UPDATE ${quote(entity)} SET ${updates.map((column) => `${quote(column)}=?`).join(',')} WHERE ${keys.map((column) => `${quote(column)}=?`).join(' AND ')}`,
    [...updates.map((column) => record[column]), ...keys.map((column) => key[column])],
  );
}

export async function applyPayload(payload) {
  const preview = dryRun(payload);
  if (preview.conflict_count) throw new Error('更新包仍有衝突');

  await snapshot(`before:${payload.update_id}`);
  begin();
  try {
    payload.operations.forEach((operation, index) => {
      const change = preview.changes[index];
      if (change.effective_action === 'insert') {
        write(operation.entity, change.key, change.data, 'insert');
      } else if (change.effective_action === 'update') {
        write(operation.entity, change.key, change.data, 'update');
      } else if (operation.action === 'archive') {
        write(operation.entity, change.key, { status: 'archived' }, 'update');
      } else if (operation.action === 'delete') {
        const keys = KEYS[operation.entity];
        run(
          `DELETE FROM ${quote(operation.entity)} WHERE ${keys.map((key) => `${quote(key)}=?`).join(' AND ')}`,
          keys.map((key) => change.key[key]),
        );
      }

      run(
        'INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',
        [
          payload.update_id,
          index,
          operation.entity,
          operation.action,
          JSON.stringify(change.key),
          change.before ? JSON.stringify(change.before) : null,
          change.after ? JSON.stringify(change.after) : null,
          'applied',
          change.message || '',
        ],
      );
    });

    run(
      'INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',
      [
        payload.update_id,
        String(payload.schema_version),
        payload.generated_at,
        localIso(),
        payload.source || '',
        payload.operations.length,
        JSON.stringify({ status: 'applied' }),
      ],
    );
    commit();
    await persist();
    return { operation_count: payload.operations.length };
  } catch (error) {
    rollback();
    throw error;
  }
}
