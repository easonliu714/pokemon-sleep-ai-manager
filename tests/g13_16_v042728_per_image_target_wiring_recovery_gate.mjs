import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const recovery=fs.readFileSync('assets/js/per-image-target-wiring-recovery-v042728.js','utf8');
const predecessor=fs.readFileSync('assets/js/review-group-isolation-v042717.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const version=fs.readFileSync('assets/js/version-authority.js','utf8');

// The v0.4.27.28 fix must remain an additive successor. Do not rewrite the
// already-deployed v0.4.27.18 group/target core while closing this Android race.
assert.ok(predecessor.includes(`'"':'&quot;'`),'predecessor HTML escaping must remain byte-correct');
assert.equal(predecessor.includes('PER_IMAGE_TARGET_WIRING_RECOVERY_VERSION'),false,'v0.4.27.18 core must remain untouched by the v0.4.27.28 recovery');

for(const token of [
  "PER_IMAGE_TARGET_WIRING_RECOVERY_VERSION='v0.4.27.28-late-card-wiring-recovery-2026-08-23-b'",
  'PER_IMAGE_TARGET_WIRING_RECOVERY_MAX_ATTEMPTS=300',
  'PER_IMAGE_TARGET_WIRING_RECOVERY_INTERVAL_MS=100',
  'export function evaluatePerImageTargetWiring',
  "scope.addEventListener('pokemon-sleep:identity-import-files-selected'",
  'new scope.MutationObserver',
  "observer.observe(current,{childList:true,subtree:true})",
  'assignmentCore.sync?.()',
  'v042728_per_image_target_wiring_sync',
  'v042728JumpFirstProblem',
  '跳到第一張未指定圖片',
])assert.ok(recovery.includes(token),`missing v0.4.27.28 recovery contract: ${token}`);

const predecessorPos=index.indexOf('./assets/js/review-group-isolation-v042717.js');
const recoveryPos=index.indexOf('./assets/js/per-image-target-wiring-recovery-v042728.js');
assert.ok(predecessorPos>=0&&recoveryPos>predecessorPos,'recovery module must load after the v0.4.27.18 target-assignment core');
assert.ok(sw.includes("'./assets/js/per-image-target-wiring-recovery-v042728.js'"),'recovery module must be precached for the established offline-after-load contract');
assert.match(version,/app_version:\s*'v0\.4\.27\.28'/);
assert.match(version,/app_build:\s*'20260823-v042728-per-image-target-wiring-recovery'/);
assert.match(version,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.28-v042728-per-image-target-wiring-recovery'/);

const executable=recovery
  .replace(/^export /gm,'')
  + '\nglobalThis.__gate={evaluatePerImageTargetWiring};';
const context={console,globalThis:null};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(executable,context);
const {evaluatePerImageTargetWiring}=context.__gate;

const ids=Array.from({length:14},(_,index)=>`img-${index+1}`);
const first13=ids.slice(0,13);

const physicalFailure=evaluatePerImageTargetWiring({selected_ids:ids,control_ids:first13,ready_ids:first13,needs_ai:true,consent:true});
assert.equal(physicalFailure.selected_count,14);
assert.equal(physicalFailure.control_count,13);
assert.equal(physicalFailure.ready_count,13);
assert.deepEqual([...physicalFailure.unwired_ids],['img-14']);
assert.deepEqual([...physicalFailure.unassigned_ids],[]);
assert.equal(physicalFailure.all_wired,false);
assert.equal(physicalFailure.run_allowed,false,'13/14 mounted controls must remain fail-closed while recovery is running');

const visibleButUnassigned=evaluatePerImageTargetWiring({selected_ids:ids,control_ids:ids,ready_ids:first13,needs_ai:true,consent:true});
assert.equal(visibleButUnassigned.control_count,14);
assert.deepEqual([...visibleButUnassigned.unassigned_ids],['img-14']);
assert.equal(visibleButUnassigned.run_allowed,false,'14 controls / 13 assignments must identify an actionable final card');

const consentMissing=evaluatePerImageTargetWiring({selected_ids:ids,control_ids:ids,ready_ids:ids,needs_ai:true,consent:false});
assert.equal(consentMissing.all_assigned,true);
assert.equal(consentMissing.run_allowed,false,'AI consent remains independent from target wiring recovery');

const recovered=evaluatePerImageTargetWiring({selected_ids:ids,control_ids:ids,ready_ids:ids,needs_ai:true,consent:true});
assert.equal(recovered.control_count,14);
assert.equal(recovered.ready_count,14);
assert.equal(recovered.all_wired,true);
assert.equal(recovered.all_assigned,true);
assert.equal(recovered.run_allowed,true,'14/14 controls + assignments + AI consent must be runnable');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.16_V042728_PER_IMAGE_TARGET_WIRING_RECOVERY',
  architecture:'additive_successor_module',
  predecessor_core_untouched:true,
  reproduced_physical_failure:'14 selected / 13 mounted target controls',
  mutation_observer_recovery:true,
  bounded_parity_recovery_ms:30000,
  actionable_missing_filename_jump:true,
  offline_precache:true,
  physical_failure:physicalFailure,
  recovered,
},null,2));
