import { dryRun, applyPayload } from './importer.js';
import { rows, scalar, exportBytes } from './database.js';
import { validateFull75Contract } from './full75-recovery-contract.js';

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
  return { resolvedPayload, preview };
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
  if (imported !== 1) failures.push('import_batches 未建立唯一 FULL75 紀錄');
  return {
    pass: failures.length === 0,
    verified,
    expectedVerifiable,
    failures,
    global: {
      pokemon_active: Number(scalar("SELECT COUNT(*) FROM pokemon WHERE status='active'") || 0),
      pokemon: Number(scalar('SELECT COUNT(*) FROM pokemon') || 0),
      pokemon_subskills: Number(scalar('SELECT COUNT(*) FROM pokemon_subskills') || 0),
      pokemon_ingredients: Number(scalar('SELECT COUNT(*) FROM pokemon_ingredients') || 0),
      pokemon_identity_evidence: Number(scalar('SELECT COUNT(*) FROM pokemon_identity_evidence') || 0),
    },
  };
}

async function applyFull75Payload(payload, resolutions) {
  const { resolvedPayload, preview } = runFull75DryRun(payload, resolutions);
  if (preview.conflict_count) throw new Error(`FULL75 仍有 ${preview.conflict_count} 筆衝突`);
  await applyPayload(resolvedPayload);
  const verification = verifyAppliedPackage(resolvedPayload);
  if (!verification.pass) throw new Error(`FULL75 套用後對帳失敗：${verification.failures.slice(0, 5).join('；')}`);
  const inspector = globalThis.PokemonSleepBackupTruth?.inspectBytes;
  if (typeof inspector !== 'function') throw new Error('備份真值檢查器尚未就緒');
  const databaseReport = await inspector(exportBytes());
  if (!databaseReport.integrity_ok || databaseReport.foreign_key_errors.length) {
    throw new Error('Post-apply SQLite 完整性檢查失敗');
  }
  return { resolvedPayload, preview, verification, databaseReport };
}

export {
  reviewOperations,
  resolveFull75Payload,
  runFull75DryRun,
  verifyAppliedPackage,
  applyFull75Payload,
};
