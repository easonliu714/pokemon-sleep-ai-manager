import { dryRun } from './importer.js';
import { debugTrace } from './debug-trace-manager.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let loadedPayload = null;
let loadedFileName = '';
let handshakeInFlight = false;
let lastDryRunEnabled = null;

function ensurePanel() {
  const updates = $('updates');
  if (!updates || $('generalUpdateFieldAudit')) return;
  const panel = document.createElement('section');
  panel.id = 'generalUpdateFieldAudit';
  panel.className = 'panel update-review-panel';
  panel.innerHTML = `
    <div class="update-review-head">
      <div><h3>匯入內容確認</h3><p class="notice">先查看 JSON 實際內容，再確認「目前未顯示」的槽位；全部確認後才會解除 Dry Run。</p></div>
      <span id="profileAuditProgress" class="badge pending">待確認</span>
    </div>
    <div id="profileAuditConfirmation"></div>
    <details class="field-audit-details"><summary>Dry Run 欄位決策明細</summary>
      <div id="fieldAuditSummary">載入 JSON 並執行 Dry Run 後顯示欄位決策。</div>
      <div class="table-wrap"><table id="fieldAuditTable"></table></div>
    </details>`;
  const issues = $('workflowIssues');
  if (issues) issues.insertAdjacentElement('afterend', panel);
  else $('importSummary')?.insertAdjacentElement('afterend', panel);
}

function confirmationLabel(item) {
  const scope = item.slot_type === 'ingredient' ? '食材槽' : item.slot_type === 'subskill' ? '副技能槽' : (item.field || '欄位');
  const levels = Array.isArray(item.unlock_levels) ? item.unlock_levels.join('／') : (item.unlock_level ?? '—');
  return `${scope} ${levels} 目前未顯示`;
}

function compactValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function operationMatchesPokemon(operation, pokemonId, pokemonLabel) {
  const haystack = JSON.stringify({ key: operation?.key, data: operation?.data });
  return Boolean((pokemonId && haystack.includes(pokemonId)) || (pokemonLabel && haystack.includes(pokemonLabel)));
}

function previewRowsForPokemon(pokemonId, pokemonLabel) {
  const operations = Array.isArray(loadedPayload?.operations) ? loadedPayload.operations : [];
  const matched = operations.filter((operation) => operationMatchesPokemon(operation, pokemonId, pokemonLabel));
  const rows = [];
  matched.forEach((operation) => {
    const source = { ...(operation.key || {}), ...(operation.data || {}) };
    Object.entries(source).forEach(([field, value]) => {
      if (['evidence','clear_fields','updated_at','created_at'].includes(field)) return;
      rows.push({ field, value: compactValue(value) });
    });
  });
  return rows.slice(0, 14);
}

function renderPokemonPreview(pokemonId, pokemonLabel) {
  const rows = previewRowsForPokemon(pokemonId, pokemonLabel);
  if (!rows.length) {
    return '<p class="profile-preview-empty">此確認項目在 operations 中沒有可直接對應的個體欄位；請以匯入 JSON 與原始遊戲畫面為準。</p>';
  }
  return `<div class="profile-preview"><div class="profile-preview-title">目前 JSON 預覽</div><div class="profile-preview-table" role="table">${rows.map((row)=>`<div class="profile-preview-row" role="row"><span class="profile-preview-key" role="cell">${esc(row.field)}</span><span class="profile-preview-value" role="cell">${esc(row.value)}</span></div>`).join('')}</div></div>`;
}

function workflowErrorCount() {
  return document.querySelectorAll('#workflowIssues .status-conflict').length;
}

function traceDryRunEligibility(reason) {
  const enabled = Boolean($('dryRunBtn') && !$('dryRunBtn').disabled);
  if (enabled === lastDryRunEnabled && reason !== 'canonical_handshake') return;
  lastDryRunEnabled = enabled;
  debugTrace.record('update_center','dry_run_eligibility_changed',{
    status:'completed',
    details:{enabled,reason,workflow_error_count:workflowErrorCount()},
  });
}

async function synchronizeCanonicalPayload(reason = 'confirmation_change') {
  if (!loadedPayload || handshakeInFlight) return false;
  const input = $('jsonFile');
  if (!input) return false;
  handshakeInFlight = true;
  const confirmationCount = Array.isArray(loadedPayload.profile_audit_confirmations) ? loadedPayload.profile_audit_confirmations.length : 0;
  const confirmedCount = Array.isArray(loadedPayload.profile_audit_confirmations) ? loadedPayload.profile_audit_confirmations.filter((item)=>item.confirmed_by_user===true).length : 0;
  debugTrace.record('update_center','canonical_payload_rebuilt',{status:'completed',details:{reason,confirmation_count:confirmationCount,confirmed_count:confirmedCount}});
  try {
    const file = new File([JSON.stringify(loadedPayload, null, 2)], loadedFileName || `pokemon_sleep_confirmed_${Date.now()}.json`, { type: 'application/json' });
    const mainHandler = input.onchange;
    if (typeof mainHandler !== 'function') throw new Error('update_center_main_file_handler_unavailable');
    await mainHandler.call(input, { target: { files: [file] }, currentTarget: input, type: 'change' });
    debugTrace.record('update_center','main_state_payload_reloaded',{status:'completed',details:{reason,confirmation_count:confirmationCount,confirmed_count:confirmedCount}});
    debugTrace.record('update_center','workflow_validation_completed',{status:'completed',details:{reason,error_count:workflowErrorCount(),dry_run_enabled:Boolean($('dryRunBtn') && !$('dryRunBtn').disabled)}});
    traceDryRunEligibility('canonical_handshake');
    return true;
  } catch (error) {
    debugTrace.record('update_center','canonical_payload_handshake_failed',{status:'failed',details:{reason},error});
    throw error;
  } finally {
    handshakeInFlight = false;
  }
}

function renderConfirmations() {
  const target = $('profileAuditConfirmation');
  if (!target) return;
  const items = Array.isArray(loadedPayload?.profile_audit_confirmations) ? loadedPayload.profile_audit_confirmations : [];
  const progress = $('profileAuditProgress');
  if (!items.length) {
    if (progress) { progress.textContent = '無待確認'; progress.className = 'badge ok'; }
    target.innerHTML = '<p>此更新包沒有「未顯示槽位」確認項目。</p>';
    return;
  }
  const confirmedCount = items.filter((item) => item.status === 'user_confirmed_not_visible' && item.confirmed_by_user === true).length;
  if (progress) {
    progress.textContent = `${confirmedCount}/${items.length}`;
    progress.className = confirmedCount === items.length ? 'badge ok' : 'badge pending';
  }
  const groups = new Map();
  items.forEach((item,index) => {
    const key = item.pokemon_id || item.pokemon_label || `item-${index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({item,index});
  });
  target.innerHTML = `
    <p class="notice update-review-instruction">每張卡片先顯示目前 JSON 內容，再列出需要人工確認的未顯示槽位。勾選代表你已對照遊戲畫面並採納目前辨識結果。</p>
    <div class="profile-confirmation-groups">
      ${[...groups.entries()].map(([key, entries]) => {
        const first = entries[0].item;
        const label = first.pokemon_label || first.pokemon_id || key;
        const groupConfirmed = entries.filter(({item})=>item.confirmed_by_user===true).length;
        return `<article class="profile-confirmation-card" data-profile-group="${esc(key)}">
          <div class="profile-confirmation-card-head"><div><strong>${esc(label)}</strong><small>${groupConfirmed}/${entries.length} 已確認</small></div></div>
          ${renderPokemonPreview(first.pokemon_id, first.pokemon_label)}
          <div class="profile-confirmation-checks">${entries.map(({item,index})=>`<label class="profile-confirmation-check"><input type="checkbox" data-profile-confirmation="${index}" ${item.confirmed_by_user===true?'checked':''}><span><b>${esc(confirmationLabel(item))}</b><small>${item.confirmed_by_user===true?'已採納目前辨識結果':'待人工核對'}</small></span></label>`).join('')}</div>
        </article>`;
      }).join('')}
    </div>
    <div class="buttons update-review-actions"><button id="acceptProfileAuditBtn">全部採納目前辨識結果</button></div>`;
  target.querySelectorAll('[data-profile-confirmation]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const index = Number(checkbox.dataset.profileConfirmation);
      const confirmedAt = new Date().toISOString();
      const next = [...items];
      next[index] = {...next[index],status:'user_confirmed_not_visible',confirmed_by_user:checkbox.checked,confirmed_at:checkbox.checked ? confirmedAt : null,confirmation_scope:checkbox.checked ? 'current_observation' : null};
      loadedPayload = { ...loadedPayload, profile_audit_confirmations: next };
      debugTrace.record('update_center','profile_confirmation_checkbox_changed',{status:'completed',details:{index,confirmed:checkbox.checked}});
      await synchronizeCanonicalPayload('single_confirmation');
      renderConfirmations();
    });
  });
  $('acceptProfileAuditBtn')?.addEventListener('click', async () => {
    const confirmedAt = new Date().toISOString();
    loadedPayload = {...loadedPayload,profile_audit_confirmations:items.map((item) => ({...item,status:'user_confirmed_not_visible',confirmed_by_user:true,confirmed_at:confirmedAt,confirmation_scope:'current_observation'}))};
    debugTrace.record('update_center','profile_audit_confirmed',{status:'completed',details:{confirmation_count:items.length,empty_slots_preserved:true}});
    await synchronizeCanonicalPayload('accept_all_confirmations');
    renderConfirmations();
  });
}

function decisionText(decision) {
  return ({preserve_existing_empty_incoming:'保留既有值',ignore_empty_incoming:'忽略空值',explicit_clear:'明確清空',same_value:'值相同',update_non_empty:'更新有效值',insert_non_empty:'新增有效值',unchanged:'不變'})[decision] || decision;
}

function renderAudit(preview) {
  const summary = $('fieldAuditSummary');
  const table = $('fieldAuditTable');
  if (!summary || !table) return;
  const audit = preview.audit_summary || {};
  summary.innerHTML = `情境：<b>${esc(preview.scenario || 'general')}</b>；欄位：<b>${audit.field_count || 0}</b>；保留既有值：<b>${audit.preserved_existing_count || 0}</b>；明確清空：<b>${audit.explicit_clear_count || 0}</b>；有效更新：<b>${audit.non_empty_update_count || 0}</b>；用戶確認：<b>${audit.profile_confirmation_count || 0}</b>`;
  const records = preview.changes.flatMap((change) => (change.field_audit || []).map((field) => ({operation: change.index + 1,entity: change.entity,key: JSON.stringify(change.key),...field})));
  table.innerHTML = records.length ? `<thead><tr><th>#</th><th>實體</th><th>Key</th><th>欄位</th><th>既有值</th><th>輸入值</th><th>決策</th><th>套用後</th></tr></thead><tbody>${records.map((row)=>`<tr><td>${row.operation}</td><td>${esc(row.entity)}</td><td><code>${esc(row.key)}</code></td><td>${esc(row.field)}</td><td>${esc(row.existing)}</td><td>${esc(row.incoming)}</td><td>${esc(decisionText(row.decision))}</td><td>${esc(row.effective)}</td></tr>`).join('')}</tbody>` : '<tbody><tr><td>沒有可稽核欄位。</td></tr></tbody>';
}

function bind() {
  ensurePanel();
  $('jsonFile')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file || handshakeInFlight) return;
    try {
      loadedPayload = JSON.parse(await file.text());
      loadedFileName = file.name;
      debugTrace.record('update_center','json_file_loaded',{status:'completed',details:{confirmation_count:Array.isArray(loadedPayload?.profile_audit_confirmations)?loadedPayload.profile_audit_confirmations.length:0}});
      renderConfirmations();
      $('fieldAuditSummary').textContent = 'JSON 已載入；請完成必要確認並執行 Dry Run。';
      $('fieldAuditTable').innerHTML = '';
      queueMicrotask(()=>traceDryRunEligibility('json_file_loaded'));
    } catch {
      loadedPayload = null;
    }
  });
  $('dryRunBtn')?.addEventListener('click', () => {
    const blocked = Boolean($('dryRunBtn')?.disabled);
    debugTrace.record('update_center',blocked?'dry_run_blocked':'dry_run_started',{status:blocked?'blocked':'started',details:{workflow_error_count:workflowErrorCount()}});
    setTimeout(() => {
      if (!loadedPayload || blocked) return;
      try {
        const preview = dryRun(loadedPayload);
        renderAudit(preview);
        debugTrace.record('update_center','dry_run_completed',{status:'completed',details:{operation_count:preview.operation_count,ready_count:preview.ready_count,conflict_count:preview.conflict_count}});
      } catch (error) {
        $('fieldAuditSummary').textContent = `欄位稽核尚未完成：${error.message}`;
        debugTrace.record('update_center','dry_run_blocked',{status:'blocked',details:{reason:error.message,workflow_error_count:workflowErrorCount()}});
      }
    }, 0);
  }, true);
}

window.addEventListener('DOMContentLoaded', bind, { once: true });
