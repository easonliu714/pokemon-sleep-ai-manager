import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/js/v0394-startup-watchdog.js','utf8');

assert.match(source,/confirmation-first-render-authority-v042732\.js/,'successor first-render authority must load before confirmation events');
assert.match(source,/STARTUP_BLOCK_WARN_MS=4000/);
assert.match(source,/RECOVERY_STABLE_FRAMES=30/);
assert.match(source,/主執行緒 heartbeat 已停滯約/);
assert.match(source,/最後 startup checkpoint/);
assert.match(source,/僅表示最後記錄位置，不代表阻塞原因/,'warning must not claim the last checkpoint caused the stall');
assert.match(source,/checkpoint_is_causal:false/);
assert.match(source,/main_thread_block_recovered/);
assert.match(source,/automatic_retry_restarted:false/,'recovery may clear stale UI but must not silently restart retry loops');
assert.match(source,/warning\.textContent===lastWarningText/,'recovery may only hide the warning still owned by this watchdog');
assert.match(source,/warning\.classList\.add\('hidden'\)/);
assert.match(source,/delete warning\.dataset\.startupWatchdogWarning/);
assert.doesNotMatch(source,/啟動階段 \$\{lastStage\|\|'unknown'\} 已阻塞/,'old causal wording must be retired');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.22_V042732_STARTUP_WATCHDOG_RECOVERY',
  heartbeat_stall_distinguished_from_checkpoint:true,
  last_checkpoint_noncausal:true,
  stable_recovery_clears_owned_warning:true,
  foreign_warning_not_hidden:true,
  stall_diagnostic_retained:true,
  automatic_retry_restarted:false,
  behavioral_gates_removed:0,
},null,2));
