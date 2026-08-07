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
      <div>
        <h3>更新內容確認</h3>
        <p class="notice">先檢視 JSON 的待確認差異，再決定是否採納。完成必要確認後才會解除 Dry Run 阻擋。</p>
      </div>
      <span id="profileAuditProgress" class="badge pending">尚未載入</span>
    </div>
    <div id="profileAuditConfirmation"></div>
    <details class="field-audit-details">
      <summary>Dry Run 欄位決策明細</summary>
      <div id="fieldAuditSummary">載入 JSON 並執行 Dry Run 後顯示欄位決策。</div>
      <div class="table-wrap"><table id="fieldAuditTable"></table></div>
    </details>`;
  const issues = $('workflowIssues');
  if (issues) issues.insertAdjacentElement('afterend', panel);
  else $('importSummary')?.insertAdjacentElement('beforebegin', panel);
}

function confirmationMeta(item) {
  const scope = item.slot_type === 'ingredient' ? '食材槽' : item.slot_type === 'subskill' ? '副技能槽' : (item.field || '欄位');
  const levels = Array.isArray(item.unlock_levels) ? item.unlock_levels.join('／') : (item.unlock_level ?? '—');
  return {
    pokemon: item.pokemon_label || item.pokemon_id || '未知寶可夢',
    scope,
    levels,
    observed: item.status === 'user_confirmed_not_visible' ? '目前未顯示' : (item.status || '待判定'),
    confirmed: item.confirmed_by_user === true,
  };
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
  const confirmationCount = Array.isArray(loadedPayload.profile_audit_confirmations)
    ? loadedPayload.profile_audit_confirmations.length
    : 0;
  const confirmedCount = Array.isArray(loadedPayload.profile_audit_confirmations)
    ? loadedPayload.profile_audit_confirmations.filter((item)=>item.confirmed_by_user===true).length
    : 0;
  debugTrace.record('update_center','canonical_payload_rebuilt',{
    status:'completed',
    details:{reason,confirmation_count:confirmationCount,confirmed_count:confirmedCount},
  });
  try {
    const file = new File(
      [JSON.stringify(loadedPayload, null, 2)],
      loadedFileName || `pokemon_sleep_confirmed_${Date.now()}.json`,
      { type: 'application/json' },
    );

    const mainHandler = input.onchange;
    if (typeof mainHandler !== 'function') {
      throw new Error('update_center_main_file_handler_unavailable');
    }
    await mainHandler.call(input, { target: { files: [file] }, currentTarget: input, type: 'change' });

    debugTrace.record('update_center','main_state_payload_reloaded',{
      status:'completed',
      details:{reason,confirmation_count:confirmationCount,confirmed_count:confirmedCount},
    });
    debugTrace.record('update_center','workflow_validation_completed',{
      status:'completed',
      details:{reason,error_count:workflowErrorCount(),dry_run_enabled:Boolean($('dryRunBtn') && !$('dryRunBtn').disabled)},
    });
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
  const progress = $('profileAuditProgress');
  if (!target) return;
  const items = Array.isArray(loadedPayload?.profile_audit_confirmations)
    ? loadedPayload.profile_audit_confirmations
    : [];
  if (!items.length) {
    target.innerHTML = '<p class="notice">此更新包沒有需要人工確認的「未顯示槽位」。</p>';
    if (progress) {
      progress.textContent = '無待確認項目';
      progress.className = 'badge ok';
    }
    return;
  }

  const confirmedCount = items.filter((item) => item.status === 'user_confirmed_not_visible' && item.confirmed_by_user === true).length;
  if (progress) {
    progress.textContent = `已確認 ${confirmedCount}/${items.length}`;
    progress.className = confirmedCount === items.length ? 'badge ok' : 'badge pending';
  }

  target.innerHTML = `
    <div class="profile-audit-intro">
      <h4>待確認差異預覽</h4>
      <p class="notice">下表是 JSON 目前的判定，不代表系統已自動接受。請逐列核對遊戲畫面；確認後才會把「目前未顯示」寫回正式 payload。</p>
    </div>
    <div class="profile-audit-table-wrap">
      <table class="profile-audit-table" aria-label="待確認差異預覽">
        <thead><tr><th>確認</th><th>寶可夢</th><th>欄位</th><th>等級</th><th>JSON 判定</th><th>狀態</th></tr></thead>
        <tbody>${items.map((item,index)=>{
          const meta = confirmationMeta(item);
          return `<tr class="profile-audit-row ${meta.confirmed ? 'is-confirmed' : 'is-pending'}">
            <td data-label="確認"><input type="checkbox" aria-label="確認 ${esc(meta.pokemon)} ${esc(meta.scope)}" data-profile-confirmation="${index}" ${meta.confirmed?'checked':''}></td>
            <td data-label="寶可夢"><strong>${esc(meta.pokemon)}</strong></td>
            <td data-label="欄位">${esc(meta.scope)}</td>
            <td data-label="等級">${esc(meta.levels)}</td>
            <td data-label="JSON 判定"><span class="profile-observation">${esc(meta.observed)}</span></td>
            <td data-label="狀態"><span class="profile-confirmation-state ${meta.confirmed ? 'confirmed' : 'pending'}">${meta.confirmed ? '已採納' : '待確認'}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    <div class="profile-audit-actions">
      <button id="acceptProfileAuditBtn" ${confirmedCount===items.length?'disabled':''}>全部採納目前辨識結果</button>
      <span class="notice">採納後仍需執行 Dry Run 才會產生正式差異與套用預覽。</span>
    </div>`;

  target.querySelectorAll('[data-profile-confirmation]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const index = Number(checkbox.dataset.profileConfirmation);
      const confirmedAt = new Date().toISOString();
      const next = [...items];
      next[index] = {
        ...next[index],
        status: 'user_confirmed_not_visible',
        confirmed_by_user: checkbox.checked,
        confirmed_at: checkbox.checked ? confirmedAt : null,
        confirmation_scope: checkbox.checked ? 'current_observation' : null,
      };
      loadedPayload = { ...loadedPayload, profile_audit_confirmations: next };
      debugTrace.record('update_center','profile_confirmation_checkbox_changed',{status:'completed',details:{index,confirmed:checkbox.checked}});
      await synchronizeCanonicalPayload('single_confirmation');
      renderConfirmations();
    });
  });

  $('acceptProfileAuditBtn')?.addEventListener('click', async () => {
    const confirmedAt = new Date().toISOString();
    loadedPayload = {
      ...loadedPayload,
      profile_audit_confirmations: items.map((item) => ({
        ...item,
        status: 'user_confirmed_not_visible',
        confirmed_by_user: true,
        confirmed_at: confirmedAt,
        confirmation_scope: 'current_observation',
      })),
    };
    debugTrace.record('update_center','profile_audit_confirmed',{status:'completed',details:{confirmation_count:items.length,empty_slots_preserved:true}});
    await synchronizeCanonicalPayload('accept_all_confirmations');
    renderConfirmations();
  });
}

function decisionText(decision) {
  return ({
    preserve_existing_empty_incoming:'保留既有值',
    ignore_empty_incoming:'忽略空值',
    explicit_clear:'明確清空',
    same_value:'值相同',
    update_non_empty:'更新有效值',
    insert_non_empty:'新增有效值',
    unchanged:'不變',
  })[decision] || decision;
}

function renderAudit(preview) {
  const summary = $('fieldAuditSummary');
  const table = $('fieldAuditTable');
  if (!summary || !table) return;
  const audit = preview.audit_summary || {};
  summary.innerHTML = `情境：<b>${esc(preview.scenario || 'general')}</b>；欄位：<b>${audit.field_count || 0}</b>；保留既有值：<b>${audit.preserved_existing_count || 0}</b>；明確清空：<b>${audit.explicit_clear_count || 0}</b>；有效更新：<b>${audit.non_empty_update_count || 0}</b>；用戶確認：<b>${audit.profile_confirmation_count || 0}</b>`;
  const records = preview.changes.flatMap((change) => (change.field_audit || []).map((field) => ({
    operation: change.index + 1,
    entity: change.entity,
    key: JSON.stringify(change.key),
    ...field,
  })));
  table.innerHTML = records.length ? `
    <thead><tr><th>#</th><th>實體</th><th>Key</th><th>欄位</th><th>既有值</th><th>輸入值</th><th>決策</th><th>套用後</th></tr></thead>
    <tbody>${records.map((row)=>`<tr><td>${row.operation}</td><td>${esc(row.entity)}</td><td><code>${esc(row.key)}</code></td><td>${esc(row.field)}</td><td>${esc(row.existing)}</td><td>${esc(row.incoming)}</td><td>${esc(decisionText(row.decision))}</td><td>${esc(row.effective)}</td></tr>`).join('')}</tbody>` : '<tbody><tr><td>沒有可稽核欄位。</td></tr></tbody>';
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
      if ($('profileAuditProgress')) {
        $('profileAuditProgress').textContent = '載入失敗';
        $('profileAuditProgress').className = 'badge error';
      }
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