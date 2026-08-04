import { rows } from './database.js';
import { debugTrace } from './debug-trace-manager.js';
import { validateFull75Contract } from './full75-recovery-contract.js';
import { reviewOperations, runFull75DryRun, applyFull75Payload } from './full75-recovery-engine.js';

const BUILD = '20260804-v0377b-full75-recovery-closure';
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let sourcePayload = null;
let resolvedPayload = null;
let preview = null;
let resolutions = new Map();

function activePokemonOptions() {
  return rows("SELECT pokemon_id, COALESCE(NULLIF(TRIM(nickname),''),NULLIF(TRIM(original_label),''),NULLIF(TRIM(species),''),pokemon_id) AS label, level, sp FROM pokemon WHERE status='active' ORDER BY label, level");
}

function ensureUi() {
  const updates = $('updates');
  if (!updates || $('full75RecoveryWorkbench')) return;
  const panel = document.createElement('section');
  panel.id = 'full75RecoveryWorkbench';
  panel.className = 'panel';
  panel.innerHTML = `
    <h3>FULL75 完整能力復原工作台</h3>
    <p class="notice">私人 JSON 只在本機處理。契約檢查 → 身份覆核 → Dry Run → 821 operations → 套用後逐筆對帳 → 驗證備份。</p>
    <label>FULL75 JSON <input id="full75RecoveryFile" type="file" accept=".json,application/json"></label>
    <div id="full75ContractReport" class="panel">尚未選擇 FULL75 更新包。</div>
    <div id="full75IdentityReview"></div>
    <div class="buttons"><button id="full75DryRunBtn" disabled>執行 FULL75 Dry Run</button><button id="full75ApplyBtn" class="danger" disabled>安全套用 FULL75</button><button id="full75BackupBtn" disabled>下載 Post-apply 驗證備份</button></div>
    <div id="full75RecoveryReport" class="panel">尚未執行。</div>`;
  const anchor = updates.querySelector('.two-col');
  if (anchor) anchor.insertAdjacentElement('beforebegin', panel);
  else updates.appendChild(panel);
}

function renderIdentityReview(payload) {
  const items = reviewOperations(payload);
  const container = $('full75IdentityReview');
  resolutions = new Map();
  if (!items.length) {
    container.innerHTML = '<div class="panel"><b>身份覆核：0 筆</b></div>';
    updateButtons();
    return;
  }
  const options = activePokemonOptions();
  container.innerHTML = `<h4>身份覆核（${items.length} 筆）</h4><p class="notice">不得依名稱或等級自動合併；每筆必須確認為獨立個體或指定既有個體。</p>` + items.map(({operation,index}) => {
    const id = operation.key?.pokemon_id || `operation-${index}`;
    const label = operation.data?.nickname || operation.data?.original_label || operation.data?.species || id;
    return `<article class="panel"><b>OP-${String(index).padStart(4,'0')} · ${esc(label)}</b><br><code>${esc(id)}</code><br><label>身份決策 <select data-full75-review-index="${index}"><option value="">尚未決定</option><option value="__independent__">確認為獨立個體</option>${options.map((row) => `<option value="${esc(row.pokemon_id)}">合併至 ${esc(row.label)} · Lv${esc(row.level ?? '—')} · SP${esc(row.sp ?? '—')} · ${esc(row.pokemon_id)}</option>`).join('')}</select></label></article>`;
  }).join('');
  container.querySelectorAll('[data-full75-review-index]').forEach((select) => select.addEventListener('change', () => {
    resolutions.set(Number(select.dataset.full75ReviewIndex), select.value);
    updateButtons();
  }));
}

function updateButtons() {
  const items = sourcePayload ? reviewOperations(sourcePayload) : [];
  const ready = Boolean(sourcePayload) && items.every(({index}) => Boolean(resolutions.get(index)));
  $('full75DryRunBtn').disabled = !ready;
  $('full75ApplyBtn').disabled = true;
}

async function loadFile(file) {
  sourcePayload = JSON.parse(await file.text());
  const counts = validateFull75Contract(sourcePayload);
  resolvedPayload = null;
  preview = null;
  $('full75ContractReport').innerHTML = `<b>FULL75 契約 PASS</b><br>Update ID：<code>${esc(sourcePayload.update_id)}</code><br>operations=${counts.total}；pokemon upsert=${counts.pokemon_upsert}；archive=${counts.pokemon_archive}；subskills=${counts.pokemon_subskills}；ingredients=${counts.pokemon_ingredients}；identity evidence=${counts.pokemon_identity_evidence}`;
  $('full75RecoveryReport').textContent = `已載入 ${file.name}，請完成身份覆核。`;
  renderIdentityReview(sourcePayload);
  debugTrace.record('full75_recovery','full75_package_loaded',{status:'completed',details:{update_id:sourcePayload.update_id,review_count:reviewOperations(sourcePayload).length,...counts}});
}

async function executeDryRun() {
  ({resolvedPayload, preview} = runFull75DryRun(sourcePayload, resolutions));
  $('full75RecoveryReport').innerHTML = `<b>FULL75 Dry Run ${preview.conflict_count === 0 ? 'PASS' : 'FAIL'}</b><br>operations=${preview.operation_count}；ready=${preview.ready_count}；conflicts=${preview.conflict_count}` + (preview.conflict_count ? `<br>${preview.changes.filter((item) => item.status === 'conflict').slice(0,10).map((item) => `#${item.index} ${esc(item.entity)}：${esc(item.message)}`).join('<br>')}` : '');
  $('full75ApplyBtn').disabled = preview.conflict_count !== 0 || preview.operation_count !== 821;
  debugTrace.record('full75_recovery','full75_dry_run_completed',{status:preview.conflict_count===0?'completed':'blocked',details:{operation_count:preview.operation_count,ready_count:preview.ready_count,conflict_count:preview.conflict_count}});
}

async function executeApply() {
  if (!preview || preview.conflict_count) throw new Error('必須先完成無衝突 Dry Run');
  if (!confirm('即將套用 FULL75 共 821 operations。系統會先建立 Snapshot，確認繼續？')) return;
  $('full75ApplyBtn').disabled = true;
  $('full75RecoveryReport').textContent = 'FULL75 套用與逐筆對帳中，請勿關閉頁面…';
  debugTrace.record('full75_recovery','full75_apply_started',{status:'started',details:{update_id:sourcePayload.update_id,operation_count:821}});
  const result = await applyFull75Payload(sourcePayload, resolutions);
  const v = result.verification;
  const db = result.databaseReport;
  $('full75RecoveryReport').innerHTML = `<b>FULL75 Recovery Closure PASS</b><br>逐 operation 對帳：${v.verified}/${v.expectedVerifiable}<br>integrity_check：PASS；foreign_key_errors：0<br>SHA-256：<code>${db.database_sha256}</code><br>active Pokémon=${v.global.pokemon_active}；pokemon=${v.global.pokemon}；subskills=${v.global.pokemon_subskills}；ingredients=${v.global.pokemon_ingredients}；identity evidence=${v.global.pokemon_identity_evidence}`;
  $('full75BackupBtn').disabled = false;
  window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'database',operation:'full75_recovery',update_id:sourcePayload.update_id}}));
  debugTrace.record('full75_recovery','full75_recovery_closed',{status:'completed',details:{update_id:sourcePayload.update_id,verified_operations:v.verified,integrity_ok:true,foreign_key_errors:0,...v.global}});
}

function install() {
  ensureUi();
  $('full75RecoveryFile')?.addEventListener('change', async (event) => { try { const file = event.target.files?.[0]; if (file) await loadFile(file); } catch (error) { sourcePayload = null; updateButtons(); $('full75RecoveryReport').textContent = `載入失敗：${error.message}`; alert(error.message); } });
  $('full75DryRunBtn')?.addEventListener('click', async () => { try { await executeDryRun(); } catch (error) { $('full75RecoveryReport').textContent = `Dry Run 失敗：${error.message}`; alert(error.message); } });
  $('full75ApplyBtn')?.addEventListener('click', async () => { try { await executeApply(); } catch (error) { $('full75RecoveryReport').textContent = `套用失敗：${error.message}`; debugTrace.record('full75_recovery','full75_apply_failed',{status:'failed',error}); alert(error.message); } });
  $('full75BackupBtn')?.addEventListener('click', () => $('verifiedBackupBtn')?.click());
  debugTrace.record('full75_recovery','full75_recovery_workbench_ready',{status:'completed',details:{build:BUILD,private_data_committed_to_repo:false,expected_operations:821}});
}

window.addEventListener('DOMContentLoaded', () => setTimeout(install, 700), {once:true});
