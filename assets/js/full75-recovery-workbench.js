import './general-update-field-audit-ui.js';
import './profile-completeness.js';
import { debugTrace } from './debug-trace-manager.js';

const BUILD = '20260807-v0397-profile-completeness-derived-readiness';
const $ = (id) => document.getElementById(id);

function forwardToGeneralUpdateCenter(file) {
  const input = $('jsonFile');
  if (!input) throw new Error('一般更新中心尚未就緒');
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('nav button[data-view="updates"]')?.click();
}

function installRetirementNotice() {
  const updates = $('updates');
  if (!updates || $('full75RecoveryWorkbench')) return;
  const panel = document.createElement('section');
  panel.id = 'full75RecoveryWorkbench';
  panel.className = 'panel';
  panel.dataset.status = 'retired';
  panel.innerHTML = `
    <h3>舊版 FULL75 復原工具（已退役）</h3>
    <p class="notice">所有 Pokémon 批次更新現在統一使用上方「JSON 結構檢查 → 待覆核確認 → Dry Run → 套用更新」流程。一般更新中心會執行欄位級稽核，空值預設不覆蓋既有非空值，並使用 Snapshot、Transaction 與 Rollback。</p>
    <label>舊 FULL75 JSON 相容轉送
      <input id="full75RecoveryFile" type="file" accept=".json,application/json">
    </label>
    <div class="buttons"><button id="full75ForwardBtn" disabled>送至一般更新中心</button></div>
    <div id="full75RecoveryReport" class="panel">此區不再提供獨立 Dry Run 或 Apply。</div>`;
  const anchor = updates.querySelector('.two-col');
  if (anchor) anchor.insertAdjacentElement('beforebegin', panel);
  else updates.appendChild(panel);

  const fileInput = $('full75RecoveryFile');
  const forwardButton = $('full75ForwardBtn');
  fileInput?.addEventListener('change', () => {
    forwardButton.disabled = !fileInput.files?.[0];
    $('full75RecoveryReport').textContent = fileInput.files?.[0]
      ? `已選擇 ${fileInput.files[0].name}；按下轉送後，請在一般更新中心完成結構檢查與 Dry Run。`
      : '此區不再提供獨立 Dry Run 或 Apply。';
  });
  forwardButton?.addEventListener('click', () => {
    try {
      const file = fileInput.files?.[0];
      if (!file) throw new Error('請先選擇 JSON');
      forwardToGeneralUpdateCenter(file);
      $('full75RecoveryReport').textContent = '已轉送一般更新中心。專用 FULL75 Apply 路徑未執行。';
      debugTrace.record('full75_recovery','full75_legacy_package_forwarded',{status:'completed',details:{file_name:file.name,retired_apply_path:true}});
    } catch (error) {
      $('full75RecoveryReport').textContent = `轉送失敗：${error.message}`;
    }
  });

  debugTrace.record('full75_recovery','full75_recovery_workbench_retired',{
    status:'completed',
    details:{build:BUILD,dedicated_apply_enabled:false,general_update_center_required:true,blank_values_preserve_existing:true,profile_completeness_enabled:true},
  });
}

window.addEventListener('DOMContentLoaded', () => setTimeout(installRetirementNotice, 700), { once: true });
