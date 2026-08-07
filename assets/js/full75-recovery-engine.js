import { dryRun } from './importer.js';
import { rows, scalar } from './database.js';
import { validateFull75Contract } from './full75-recovery-contract.js';

const RETIRED_MESSAGE = 'FULL75 專用套用流程已退役；請改用一般更新中心的結構檢查、待覆核確認、Dry Run 與套用更新。';
const KEY_FIELDS = Object.freeze({
  pokemon: ['pokemon_id'],
  pokemon_subskills: ['pokemon_id', 'unlock_level'],
  pokemon_ingredients: ['pokemon_id', 'unlock_level'],
  pokemon_identity_evidence: ['evidence_id'],
});

function reviewOperations(payload) {
  return payload.operations.map((operation, index) => ({ operation, index }))
    .filter(({ operation }) => operation.review_required === true);
}

function resolveFull75Payload(payload, resolutions) {
  validateFull75Contract(payload);
  const resolved = structuredClone(payload);
  for (const { operation, index } of reviewOperations(resolved)) {
    const selection = resolutions.get(index);
    if (!selection) throw new Error(`操作 ${index} 尚未完成身份覆核`);
    operation.review_required = false;
    operation.user_audit = {
      ...(operation.user_audit || {}),
      accepted_current_observation: true,
      accepted_via: 'legacy_full75_compatibility',
    };
    if (selection === '__independent__') {
      operation.review_resolution = 'confirmed_independent';
      delete operation.identity_match;
    } else {
      operation.review_resolution = 'merge_existing';
      operation.identity_match = {
        ...(operation.identity_match || {}),
        target_pokemon_id: selection,
      };
    }
  }
  return resolved;
}

function runFull75DryRun(payload, resolutions) {
  const resolvedPayload = resolveFull75Payload(payload, resolutions);
  const preview = dryRun(resolvedPayload);
  return { resolvedPayload, preview, retired: true, next_action: 'general_update_center' };
}

function keyWhere(entity, key) {
  const fields = KEY_FIELDS[entity];
  if (!fields) return null;
  return {
    sql: fields.map((field) => `"${field}"=?`).join(' AND '),
    params: fields.map((field) => key?.[field]),
  };
}

function verifyAppliedPackage(payload) {
  const failures = [];
  let verified = 0;
  let expectedVerifiable = 0;
  payload.operations.forEach((operation, index) => {
    const where = keyWhere(operation.entity, operation.key);
    if (!where) return;
    expectedVerifiable += 1;
    const row = rows(`SELECT * FROM "${operation.entity}" WHERE ${where.sql}`, where.params)[0] || null;
    if (!row) failures.push(`#${index} ${operation.entity} 找不到目標`);
    else if (operation.action === 'archive' && row.status !== 'archived') failures.push(`#${index} pokemon 未封存`);
    else verified += 1;
  });
  const imported = Number(scalar('SELECT COUNT(*) FROM import_batches WHERE update_id=?', [payload.update_id]) || 0);
  if (imported !== 1) failures.push('import_batches 未建立唯一更新紀錄');
  return { pass: failures.length === 0, verified, expectedVerifiable, failures };
}

async function applyFull75Payload() {
  throw new Error(RETIRED_MESSAGE);
}

export {
  RETIRED_MESSAGE,
  reviewOperations,
  resolveFull75Payload,
  runFull75DryRun,
  verifyAppliedPackage,
  applyFull75Payload,
};
