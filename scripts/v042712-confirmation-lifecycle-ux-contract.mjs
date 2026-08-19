import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const text=path=>readFile(new URL(path,root),'utf8');
const parseVersion=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const versionAtLeast=(version,floor)=>{const left=parseVersion(version),right=parseVersion(floor),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};

const [workbench,multicapture,detail,controller,statusUi,version,serviceWorker,schema,evolution]=await Promise.all([
  text('assets/js/analysis-confirmation-workbench.js'),
  text('assets/js/data-consistency-multicapture.js'),
  text('assets/js/pokemon-detail.js'),
  text('assets/js/ai-review-executor-controller.js'),
  text('assets/js/ai-review-executor-status-ui.js'),
  text('assets/js/version-authority.js'),
  text('service-worker.js'),
  text('assets/js/schema.js'),
  text('assets/js/analysis-confirmation-evolution-authority.js'),
]);

// Release identity and storage compatibility: v0.4.27.12 or any governed successor may replay this contract.
const currentVersion=version.match(/app_version:\s*'([^']+)'/u)?.[1]||'';
assert.equal(versionAtLeast(currentVersion,'v0.4.27.12'),true,`v0.4.27.12 lifecycle contract requires v0.4.27.12 or successor, got ${currentVersion}`);
assert.ok(currentVersion==='v0.4.27.12'||version.includes("// app_version: 'v0.4.27.12'"),'v0.4.27.12 lineage marker missing');
assert.match(schema,/registered_at TEXT/u,'pokemon.registered_at must remain available');
assert.match(schema,/obtained_at TEXT/u,'legacy pokemon.obtained_at must remain available');

// Direct Observation v2 registered_date becomes registered_at; legacy obtained_at stays a separate compatibility field.
assert.match(workbench,/registered_at:text\(identity\.registered_date\)/u,'direct registered_date must project to registered_at');
assert.match(workbench,/obtained_at:text\(raw\.obtained_at\)/u,'legacy obtained_at compatibility projection missing');
assert.match(workbench,/field\('登錄日期','registered_at',d\.registered_at,'date'\)/u,'confirmation date UI must render direct registered_at only');
assert.doesNotMatch(workbench,/field\('登錄日期','registered_at',d\.registered_at\|\|d\.obtained_at/u,'confirmation must not silently coerce legacy obtained_at into registered_at');
assert.match(workbench,/['"]evolution_other_requirement['"],['"]registered_at['"],['"]obtained_at['"]/u,'confirmation sparse patch must preserve both date semantics');

// Create-only display label fallback; existing custom labels are not part of the analysis sparse-update columns.
const originalLabelFallback=
  /if\(!before&&!meaningful\(merged\.original_label\)\)merged\.original_label=merged\.species/u.test(workbench)||
  /if\(!before\)merged\.original_label=meaningful\(draft\.original_label\)\?draft\.original_label:merged\.species/u.test(workbench);
assert.equal(originalLabelFallback,true,'new Pokémon original_label fallback missing');
const columnsMatch=workbench.match(/const columns=\[([^\]]+)\]/u);
assert.ok(columnsMatch,'confirmation update columns missing');
assert.doesNotMatch(columnsMatch[1],/original_label/u,'existing analysis update must not overwrite player original_label');

// All terminal confirmation paths close the active capture group.
for(const terminal of ['held','discarded','applied'])assert.match(workbench,new RegExp(`dispatchConfirmationTerminal\\('${terminal}'`,'u'),`missing terminal lifecycle: ${terminal}`);
assert.match(multicapture,/pokemon-sleep:analysis-confirmation-terminal/u,'multicapture must reset after terminal confirmation actions');
assert.match(multicapture,/shouldStartNewGroupForRevision/u,'capture identity isolation helper missing');
if(currentVersion==='v0.4.27.12')assert.match(multicapture,/source_identity_changed/u,'v0.4.27.12 different observed species must start a new capture group');
else{
  for(const token of ['findGroupForRevision','confirmation_group_queued','pokemon-sleep:analysis-confirmation-group-selected','confirmation_group_advanced','confirmation_group_closed'])assert.ok(multicapture.includes(token),`successor capture navigation contract missing ${token}`);
  assert.ok(workbench.includes('pokemon-sleep:analysis-confirmation-group-selected'),'successor confirmation workbench must follow selected capture group');
}

// Applying a confirmed analysis must refresh the roster through the existing App refresh callback, without a full PWA reload.
assert.match(detail,/pokemon-sleep:analysis-confirmed-applied/u,'detail module must subscribe to confirmed apply');
assert.match(detail,/onSaved\?\.\(\)/u,'confirmed apply must invoke the existing refresh callback');
assert.doesNotMatch(detail,/location\.reload|window\.location\.reload/u,'confirmation refresh must not reload the PWA');

// Registered-date display remains backward compatible for pre-v0.4.27.12 rows only at the persisted detail boundary.
assert.match(detail,/p\.registered_at\|\|p\.obtained_at/u,'detail registered date must fall back to legacy obtained_at');

// VERIFIED_NOT_REQUIRED is presentation-only. It must be rendered explicitly but never become a writable player value.
assert.match(evolution,/const DISPLAY_NOT_REQUIRED='不需要（公版已驗證）'/u,'verified-not-required display label missing');
assert.match(detail,/state==='VERIFIED_NOT_REQUIRED'\)return DISPLAY_NOT_REQUIRED/u,'detail verified-not-required rendering missing');
assert.match(detail,/以下僅為顯示 Projection，不寫回玩家欄位/u,'public evolution projection must state display-only semantics');
assert.doesNotMatch(workbench,/merged\.(?:evolution_sleep_hours_required|evolution_item_required|evolution_other_requirement)\s*=\s*DISPLAY_NOT_REQUIRED/u,'display label must never be persisted into player evolution fields');

// Model status UI is a strict allow-list projection. No key/project identity data crosses into the normal feature UI.
assert.match(controller,/MODEL_STATUS_EVENTS=new Set\(\['ai_model_candidate_started','ai_model_candidate_failed','ai_model_timeout_project_state_released','ai_model_failover','ai_model_fallback_promoted'\]\)/u,'model status event allow-list mismatch');
const sanitizer=controller.slice(controller.indexOf('export function sanitizeModelStatusTrace'),controller.indexOf('export function createAiReviewExecutorController'));
for(const forbidden of ['key','fingerprint','project_alias','used_alias','compatible_project_count'])assert.doesNotMatch(sanitizer,new RegExp(`\\b${forbidden}\\b`,'u'),`normal model status payload leaked ${forbidden}`);
assert.match(controller,/pokemon-sleep:ai-review-model-status/u,'sanitized model status event missing');
assert.match(statusUi,/ai_model_failover/u,'visible model failover handling missing');
assert.match(statusUi,/等待 \$\{elapsed\} 秒/u,'visible model elapsed seconds missing');
assert.match(statusUi,/已切換 →/u,'visible model transition message missing');
assert.match(statusUi,/if\(d\.event==='ai_model_candidate_started'\)modelState\.model=/u,'fallback candidate start must preserve the prior failover transition while it runs');
assert.doesNotMatch(statusUi,/project\.key|fingerprint/u,'normal model status UI must not access key/fingerprint');
if(versionAtLeast(currentVersion,'v0.4.27.13')){
  for(const token of ['pokemon-sleep:unified-analysis-stage','pokemon-sleep:ai-capability-model-event',"skipped:'略過'"])assert.ok(statusUi.includes(token),`v0.4.27.13 progress successor missing ${token}`);
}

// Offline closure: all changed runtime modules remain precached; version-authority cache change handles release activation.
for(const asset of [
  './assets/js/analysis-confirmation-workbench.js',
  './assets/js/data-consistency-multicapture.js',
  './assets/js/pokemon-detail.js',
  './assets/js/ai-review-executor-controller.js',
  './assets/js/ai-review-executor-status-ui.js',
  './assets/js/version-authority.js',
])assert.ok(serviceWorker.includes(`'${asset}'`),`service worker precache missing ${asset}`);

console.log(JSON.stringify({status:'PASS',gate:'V042712_CONFIRMATION_LIFECYCLE_UX_SUCCESSOR_AWARE',predecessor_version:'v0.4.27.12',current_version:currentVersion,registered_date_split:true,existing_player_label_protected:true,terminal_capture_lifecycle:true,navigable_capture_successor:versionAtLeast(currentVersion,'v0.4.27.13'),roster_refresh_without_reload:true,verified_not_required_display_only:true,model_failover_visible:true,offline_module_closure:true},null,2));