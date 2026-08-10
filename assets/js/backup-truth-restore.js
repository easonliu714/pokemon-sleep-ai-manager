import { exportBytes, replaceDatabase, snapshot, rows, scalar } from './database.js';

const APP_VERSION = 'v0.3.77';
const APP_BUILD = '20260804-v0377a-backup-truth-restore-verification';
const MANIFEST_SCHEMA = 'pokemon-sleep-backup-manifest/2.0';
const CORE_TABLES = [
  'settings','account_capacity','pokemon','pokemon_subskills','pokemon_ingredients',
  'pokemon_identity_evidence','pokemon_history','discarded_pokemon','ingredient_inventory',
  'item_inventory','candy_inventory','recipes','recipe_ingredients','weekly_plan','weekly_context',
  'weekly_strategy','collection_targets','import_batches','import_changes',
  'image_analysis_revision'
];

const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
let staged = null;

function safeCount(table, where = '') {
  try { return Number(scalar(`SELECT COUNT(*) FROM "${table}" ${where}`) || 0); }
  catch { return null; }
}

function currentCounts() {
  return Object.fromEntries(CORE_TABLES.map((table) => [table, safeCount(table)]));
}

function qualitySummary() {
  return {
    pokemon_active: safeCount('pokemon', "WHERE status='active'"),
    pokemon_with_sp: safeCount('pokemon', "WHERE status='active' AND sp IS NOT NULL"),
    pokemon_with_nature: safeCount('pokemon', "WHERE status='active' AND COALESCE(TRIM(nature),'')<>''"),
    pokemon_with_main_skill: safeCount('pokemon', "WHERE status='active' AND COALESCE(TRIM(main_skill),'')<>''"),
    pokemon_with_three_ingredients: safeCount('pokemon', "WHERE status='active' AND pokemon_id IN (SELECT pokemon_id FROM pokemon_ingredients GROUP BY pokemon_id HAVING COUNT(*)>=3)"),
    pokemon_with_five_subskills: safeCount('pokemon', "WHERE status='active' AND pokemon_id IN (SELECT pokemon_id FROM pokemon_subskills GROUP BY pokemon_id HAVING COUNT(*)>=5)"),
    orphan_subskills: safeCount('pokemon_subskills', 's LEFT JOIN pokemon p ON p.pokemon_id=s.pokemon_id WHERE p.pokemon_id IS NULL'),
    orphan_ingredients: safeCount('pokemon_ingredients', 'i LEFT JOIN pokemon p ON p.pokemon_id=i.pokemon_id WHERE p.pokemon_id IS NULL')
  };
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function inspectBytes(bytes) {
  if (typeof initSqlJs !== 'function') throw new Error('sql.js 尚未就緒');
  const SQL = await initSqlJs({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${f}` });
  const db = new SQL.Database(bytes);
  const query = (sql) => {
    const stmt = db.prepare(sql); const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free(); return out;
  };
  const integrityRows = query('PRAGMA integrity_check');
  const foreignRows = query('PRAGMA foreign_key_check');
  const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
  const counts = {};
  for (const table of tables) counts[table] = Number(Object.values(query(`SELECT COUNT(*) AS count FROM \"${table}\"`)[0] || {count:0})[0] || 0);
  const active = tables.includes('pokemon') ? Number(query("SELECT COUNT(*) count FROM pokemon WHERE status='active'")[0]?.count || 0) : 0;
  const lastImport = tables.includes('import_batches') ? query('SELECT update_id, imported_at FROM import_batches ORDER BY imported_at DESC LIMIT 1')[0] || null : null;
  db.close();
  return {
    integrity_ok: integrityRows.length === 1 && String(integrityRows[0].integrity_check).toLowerCase() === 'ok',
    integrity_rows: integrityRows,
    foreign_key_errors: foreignRows,
    table_counts: counts,
    pokemon_active: active,
    last_import: lastImport,
    database_sha256: await sha256(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
    database_size: bytes.byteLength
  };
}

async function buildManifest(bytes) {
  const inspection = await inspectBytes(bytes);
  const migrations = (() => { try { return rows('SELECT * FROM schema_migrations ORDER BY version'); } catch { return []; } })();
  const lastImport = (() => { try { return rows('SELECT update_id, imported_at FROM import_batches ORDER BY imported_at DESC LIMIT 1')[0] || null; } catch { return null; } })();
  return {
    schema: MANIFEST_SCHEMA,
    app_version: APP_VERSION,
    app_build: APP_BUILD,
    created_at: new Date().toISOString(),
    database_sha256: inspection.database_sha256,
    database_size: inspection.database_size,
    schema_migrations: migrations,
    last_import: lastImport,
    table_counts: currentCounts(),
    quality_summary: qualitySummary(),
    verification: {
      integrity_ok: inspection.integrity_ok,
      foreign_key_error_count: inspection.foreign_key_errors.length
    }
  };
}

function exportJson() {
  const data = {};
  for (const table of CORE_TABLES) {
    try { data[table] = rows(`SELECT * FROM "${table}"`); }
    catch { data[table] = []; }
  }
  return { schema_version: '2.0', exported_at: new Date().toISOString(), app_version: APP_VERSION, app_build: APP_BUILD, data };
}

function ensureUi() {
  const backup = $('backup');
  if (!backup || $('backupTruthPanel')) return;
  const panel = document.createElement('section');
  panel.id = 'backupTruthPanel'; panel.className = 'panel';
  panel.innerHTML = `
    <h3>備份真值與還原驗證</h3>
    <p class="notice">備份會同時產生 SQLite、完整 JSON 與 Manifest。還原前先在隔離 SQLite 中執行完整性與逐表對帳。</p>
    <div class="buttons"><button id="verifiedBackupBtn">下載驗證備份組</button><button id="backupSelfCheckBtn">檢查目前資料庫</button></div>
    <label>可選 Manifest <input id="restoreManifestFile" type="file" accept=".json,application/json"></label>
    <div id="backupTruthReport" class="panel">尚未執行檢查。</div>`;
  backup.insertBefore(panel, backup.querySelector('h3'));
}

function renderReport(title, report, comparison = null) {
  const el = $('backupTruthReport'); if (!el) return;
  const counts = Object.entries(report.table_counts || {}).map(([k,v]) => `${k}=${v}`).join('、');
  const diffs = comparison ? Object.entries(comparison).filter(([,v]) => v !== 0).map(([k,v]) => `${k}:${v>0?'+':''}${v}`).join('、') : '';
  el.innerHTML = `<b>${title}</b><br>integrity_check：${report.integrity_ok ? 'PASS' : 'FAIL'}<br>foreign_key_errors：${report.foreign_key_errors?.length || 0}<br>SHA-256：<code>${report.database_sha256}</code><br>size：${report.database_size} bytes<br>active Pokémon：${report.pokemon_active}<br>tables：${counts}${diffs ? `<br>與目前差異：${diffs}` : ''}`;
}

async function stageRestore(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const report = await inspectBytes(bytes);
  if (!report.integrity_ok) throw new Error('候選 SQLite integrity_check 未通過');
  if (report.foreign_key_errors.length) throw new Error(`候選 SQLite foreign_key_check 有 ${report.foreign_key_errors.length} 筆錯誤`);
  let manifest = null;
  const mf = $('restoreManifestFile')?.files?.[0];
  if (mf) manifest = JSON.parse(await mf.text());
  if (manifest?.database_sha256 && manifest.database_sha256 !== report.database_sha256) throw new Error('Manifest SHA-256 與候選 SQLite 不一致');
  if (manifest?.table_counts) {
    for (const [table, count] of Object.entries(manifest.table_counts)) {
      if (count != null && report.table_counts[table] != null && Number(count) !== Number(report.table_counts[table])) throw new Error(`Manifest 對帳失敗：${table}`);
    }
  }
  const current = currentCounts();
  const comparison = Object.fromEntries(Object.keys({...current,...report.table_counts}).map((k) => [k, Number(report.table_counts[k]||0)-Number(current[k]||0)]));
  staged = { bytes, report, manifest, comparison };
  renderReport('還原 Preflight PASS', report, comparison);
  return staged;
}

async function commitRestore() {
  if (!staged) throw new Error('請先選擇 SQLite 並完成 Preflight');
  const before = exportBytes();
  await snapshot('before-verified-restore');
  try {
    await replaceDatabase(staged.bytes);
    const after = await inspectBytes(exportBytes());
    if (!after.integrity_ok || after.foreign_key_errors.length) throw new Error('正式替換後驗證未通過');
    if (after.database_sha256 !== staged.report.database_sha256) throw new Error('正式替換後 SHA-256 不一致');
    for (const [table, count] of Object.entries(staged.report.table_counts)) {
      if (after.table_counts[table] !== count) throw new Error(`正式替換後逐表對帳失敗：${table}`);
    }
    renderReport('還原完成且對帳 PASS', after);
    window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed', { detail: { entity: 'database', operation: 'verified_restore' } }));
  } catch (error) {
    await replaceDatabase(before);
    throw new Error(`還原失敗，已 rollback：${error.message}`);
  }
}

async function install() {
  ensureUi();
  $('verifiedBackupBtn').onclick = async () => {
    const bytes = exportBytes();
    const manifest = await buildManifest(bytes);
    if (!manifest.verification.integrity_ok || manifest.verification.foreign_key_error_count) return alert('目前資料庫完整性檢查未通過，禁止建立可信備份');
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    download(bytes, `pokemon_sleep_${stamp}.sqlite3`, 'application/vnd.sqlite3');
    download(JSON.stringify(exportJson(), null, 2), `pokemon_sleep_${stamp}.json`, 'application/json');
    download(JSON.stringify(manifest, null, 2), `pokemon_sleep_${stamp}.manifest.json`, 'application/json');
    renderReport('目前資料庫備份驗證 PASS', await inspectBytes(bytes));
  };
  $('backupSelfCheckBtn').onclick = async () => renderReport('目前資料庫自我檢查', await inspectBytes(exportBytes()));
  const fileInput = $('restoreDbFile');
  if (fileInput) fileInput.addEventListener('change', async () => {
    staged = null;
    const file = fileInput.files?.[0]; if (!file) return;
    try { await stageRestore(file); } catch (error) { renderReport('還原 Preflight FAIL', {integrity_ok:false, database_sha256:'—', database_size:file.size, table_counts:{}, foreign_key_errors:[]}); alert(error.message); }
  });
  const restore = $('restoreDbBtn');
  if (restore) restore.onclick = async () => {
    try {
      if (!staged) {
        const file = fileInput?.files?.[0]; if (!file) throw new Error('請選擇 SQLite');
        await stageRestore(file);
      }
      if (!confirm(`候選資料庫 active Pokémon=${staged.report.pokemon_active}。確認以隔離驗證結果替換目前資料庫？`)) return;
      await commitRestore();
      alert('還原完成，完整性、SHA-256 與逐表對帳均 PASS');
      location.reload();
    } catch (error) { alert(error.message); }
  };
}

window.addEventListener('DOMContentLoaded', () => setTimeout(install, 500), { once: true });
window.PokemonSleepBackupTruth = { inspectBytes, buildManifest, stageRestore };
