import { dryRun } from './importer.js';
import { debugTrace } from './debug-trace-manager.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let loadedPayload = null;
let loadedFileName = '';
let replacingPayload = false;

function ensurePanel() {
  const updates = $('updates');
  if (!updates || $('generalUpdateFieldAudit')) return;
  const panel = document.createElement('section');
  panel.id = 'generalUpdateFieldAudit';
  panel.className = 'panel';
  panel.innerHTML = `
    <h3>一般 JSON 欄位稽核</h3>
    <p class="notice">空值、空字串與缺少欄位預設不覆蓋既有非空值；數字 <code>0</code> 與布林 <code>false</code> 是有效更新值。只有 JSON 的 <code>clear_fields</code> 明確指定時才會清空。</p>
    <div id="profileAuditConfirmation"></div>
    <div id="fieldAuditSummary">載入 JSON 並執行 Dry Run 後顯示欄位決策。</div>
    <div class="table-wrap"><table id="fieldAuditTable"></table></div>`;
  $('importSummary')?.insertAdjacentElement('afterend', panel);
}

function confirmationLabel(item) {
  const scope = item.slot_type === 'ingredient' ? '食材槽' : item.slot_type === 'subskill' ? '副技能槽' : (item.field || '欄位');
  const levels = Array.isArray(item.unlock_levels) ? item.unlock_levels.join('／') : (item.unlock_level ?? '—');
  return `${item.pokemon_label || item.pokemon_id}：${scope} ${levels} 目前未顯示`;
}

function replaceCanonicalFilePayload() {
  if (!loadedPayload || replacingPayload) return;
  const input = $('jsonFile');
  if (!input) return;
  replacingPayload = true;
  try {
    const file = new File(
      [JSON.stringify(loadedPayload, null, 2)],
      loadedFileName || `pokemon_sleep_confirmed_${Date.now()}.json`,
      { type: 'application/json' },
    );
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    queueMicrotask(() => { replacingPayload = false; });
  }
}

function renderConfirmations() {
  const target = $('profileAuditConfirmation');
  if (!target) return;
  const items = Array.isArray(loadedPayload?.profile_audit_confirmations)
    ? loadedPayload.profile_audit_confirmations
    : [];
  if (!items.length) {
    target.innerHTML = '<p>此更新包沒有「未顯示槽位」確認項目。</p>';
    return;
  }
  const confirmedCount = items.filter((item) => item.status === 'user_confirmed_not_visible' && item.confirmed_by_user === true).length;
  target.innerHTML = `
    <h4>用戶稽核確認（${confirmedCount}/${items.length}）</h4>
    <p class="notice">這些槽位不是自動判定為 OCR 錯誤。勾選即代表核對遊戲畫面並採納目前辨識結果；每次勾選會立即同步到一般更新中心的正式 payload，全部完成後 Dry Run 會自動解除阻擋。</p>
    ${items.map((item,index)=>`<label class="panel"><input type="checkbox" data-profile-confirmation="${index}" ${item.confirmed_by_user===true?'checked':''}> ${esc(confirmationLabel(item))}</label>`).join('')}
    <div class="buttons"><button id="acceptProfileAuditBtn">全部採納目前辨識結果</button></div>`;
  target.querySelectorAll('[data-profile-confirmation]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
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
      replaceCanonicalFilePayload();
      debugTrace.record('update_center','profile_audit_confirmation_changed',{status:'completed',details:{index,confirmed:checkbox.checked,canonical_payload_synced:true}});
    });
  });
  $('acceptProfileAuditBtn')?.addEventListener('click', () => {
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
    replaceCanonicalFilePayload();
    debugTrace.record('update_center','profile_audit_confirmed',{status:'completed',details:{confirmation_count:items.length,empty_slots_preserved:true,canonical_payload_synced:true}});
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
    if (!file) return;
    try {
      loadedPayload = JSON.parse(await file.text());
      loadedFileName = file.name;
      renderConfirmations();
      $('fieldAuditSummary').textContent = 'JSON 已載入；請完成必要確認並執行 Dry Run。';
      $('fieldAuditTable').innerHTML = '';
    } catch {
      loadedPayload = null;
    }
  });
  $('dryRunBtn')?.addEventListener('click', () => {
    setTimeout(() => {
      if (!loadedPayload) return;
      try {
        renderAudit(dryRun(loadedPayload));
      } catch (error) {
        $('fieldAuditSummary').textContent = `欄位稽核尚未完成：${error.message}`;
      }
    }, 0);
  });
}

window.addEventListener('DOMContentLoaded', bind, { once: true });
