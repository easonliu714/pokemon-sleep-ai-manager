import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
} from '../assets/js/public-master-recognition.js';
import {
  buildPublicMasterCatalogSnapshot,
  confirmCandyScreenshotQuantity,
} from '../assets/js/candy-quantity-confirmation-authority.js';
import {
  CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_ACTION,
  CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION,
  applyCandyVisibleTargetCountResolution,
  compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage,
  getCandyVisibleTargetCountState,
} from '../assets/js/candy-visible-target-count-authority.js';

const snapshot=buildPublicMasterCatalogSnapshot('candies');
const candidates=snapshot.rows.filter(row=>row?.candy_id&&row?.candy_name).slice(0,20);
assert.equal(candidates.length,20,'Candy Public Master must provide at least 20 exact fixture identities');

const providerRaw={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:snapshot.scenario,
  authority:snapshot.authority,
  data_version:snapshot.data_version,
  catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:'2026-09-02T05:58:09.214Z',
  visible_target_count:24,
  observations:candidates.map((candidate,index)=>({
    observation_id:`obs_${String(index+1).padStart(3,'0')}`,
    status:'MATCHED',
    observed_text:candidate.candy_name,
    observed_data:{quantity:187-index},
    canonical_key:{candy_id:candidate.candy_id,candy_name:candidate.candy_name},
    canonical_name:candidate.candy_name,
    source_image_ref:'candy-image-001',
    confidence:1,
  })),
};
const rawFrozen=JSON.stringify(providerRaw);

const initialState=getCandyVisibleTargetCountState(providerRaw);
assert.equal(initialState.provider_visible_target_count,24);
assert.equal(initialState.observations_length,20);
assert.equal(initialState.delta,4);
assert.equal(initialState.gate_status,'HOLD');
assert.equal(initialState.gate_cleared,false);

const initiallyCompiled=compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(providerRaw,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(initiallyCompiled.ok,false,'provider 24 / observations 20 mismatch must fail closed before explicit confirmation');
assert.match(initiallyCompiled.errors.join('\n'),/visible_target_count=24.*observations\.length=20/u,'exact 24/20 count mismatch error missing');
assert.equal(providerRaw.visible_target_count,24,'provider count must never be silently normalized');
assert.equal(JSON.stringify(providerRaw),rawFrozen,'provider Raw mutated during validation/compile');

let quantityConfirmed=providerRaw;
for(const observation of providerRaw.observations){
  quantityConfirmed=confirmCandyScreenshotQuantity(quantityConfirmed,'candies',observation.observation_id,{confirmedAt:`2026-09-02T06:01:${String(Number(observation.observation_id.slice(-3))).padStart(2,'0')}.000Z`});
}
assert.equal(quantityConfirmed.visible_target_count,24,'quantity confirmations must not rewrite provider count');
assert.equal(JSON.stringify(providerRaw),rawFrozen,'quantity confirmation mutated provider Raw');

const wrongCount=applyCandyVisibleTargetCountResolution(quantityConfirmed,'candies',24,{confirmedAt:'2026-09-02T06:02:00.000Z'});
assert.equal(wrongCount.visible_target_count,24,'wrong count resolution must retain provider value');
assert.equal(wrongCount.visible_target_count_resolution.confirmed_visible_target_count,24);
assert.equal(getCandyVisibleTargetCountState(wrongCount).gate_status,'HOLD','confirmation that does not equal observations.length must remain HOLD');
assert.equal(compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(wrongCount,'candies',{allowedImageRefs:['candy-image-001']}).ok,false,'wrong count confirmation must not clear mismatch gate');

const resolved=applyCandyVisibleTargetCountResolution(quantityConfirmed,'candies',20,{confirmedAt:'2026-09-02T06:03:00.000Z'});
assert.equal(resolved.visible_target_count,24,'Working JSON must preserve provider visible_target_count for evidence');
assert.equal(resolved.visible_target_count_resolution.action,CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_ACTION);
assert.equal(resolved.visible_target_count_resolution.authority,CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION);
assert.equal(resolved.visible_target_count_resolution.provider_visible_target_count,24);
assert.equal(resolved.visible_target_count_resolution.confirmed_visible_target_count,20);
assert.equal(resolved.visible_target_count_resolution.observations_length_at_confirmation,20);
assert.equal(JSON.stringify(providerRaw),rawFrozen,'explicit count resolution mutated provider Raw');

const resolvedState=getCandyVisibleTargetCountState(resolved);
assert.equal(resolvedState.gate_status,'USER_CONFIRMED_MATCH');
assert.equal(resolvedState.gate_cleared,true);
assert.equal(resolvedState.user_confirmed_matches_observations,true);

const compiled=compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(resolved,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(compiled.ok,true,compiled.errors.join('\n'));
assert.equal(compiled.update_package.operations.length,20,'count confirmation must preserve all 20 confirmed quantity writes');
assert.equal(compiled.summary.provider_visible_target_count,24);
assert.equal(compiled.summary.observations_length,20);
assert.equal(compiled.summary.user_confirmed_visible_target_count,20);
assert.equal(compiled.summary.visible_target_count_gate_status,'USER_CONFIRMED_MATCH');
assert.equal(compiled.update_package.operations[0].data.quantity,187);
assert.equal(compiled.update_package.operations[19].data.quantity,168);

const stale=structuredClone(resolved);
stale.observations.pop();
const staleState=getCandyVisibleTargetCountState(stale);
assert.equal(staleState.observations_length,19);
assert.equal(staleState.resolution_structurally_valid,false,'observation cardinality mutation must invalidate prior count evidence');
assert.equal(staleState.gate_status,'HOLD');
assert.equal(compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(stale,'candies',{allowedImageRefs:['candy-image-001']}).ok,false,'stale count resolution must not clear a new mismatch');

const ui=readFileSync(new URL('../assets/js/candy-quantity-screenshot-ui.js',import.meta.url),'utf8');
for(const token of ['candyB5VisibleTargetCountReview','candyB5VisibleTargetCountInput','candyB5ConfirmVisibleTargetCount','applyCandyVisibleTargetCountResolution'])assert.ok(ui.includes(token),`count review UI missing ${token}`);
const version=readFileSync(new URL('../assets/js/version-authority.js',import.meta.url),'utf8');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
if(appVersion==='v0.4.27.55.1'){
  assert.ok(ui.includes('v0.4.27.55.1'),'exact .55.1 UI must show the .55.1 release label');
  assert.equal(appBuild,'20260902-v0427551-visible-target-count-confirmation');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.1-v0427551-visible-target-count-confirmation');
}else if(appVersion==='v0.4.27.55.2'){
  assert.ok(ui.includes('v0.4.27.55.2'),'successor UI must show the current .55.2 release label');
  assert.equal(appBuild,'20260902-v0427552-local-gap-field-precedence');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.2-v0427552-local-gap-field-precedence');
  assert.ok(version.includes("// app_version: 'v0.4.27.55'"),'successor must retain .55 predecessor authority marker');
}else if(appVersion==='v0.4.27.55.3'){
  assert.ok(ui.includes('v0.4.27.55.3'),'performance successor UI must retain its owning .55.3 performance label');
  assert.equal(appBuild,'20260902-v0427553-mobile-snapshot-candy-ui-performance');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3-v0427553-mobile-snapshot-candy-ui-performance');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.2'"),'performance successor must retain .55.2 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55'"),'performance successor must retain .55 predecessor authority marker');
}else if(appVersion==='v0.4.27.55.3.1'){
  assert.ok(ui.includes("section.dataset.performanceAuthority='v0.4.27.55.3-mobile-incremental-confirmation'"),'startup-only successor must retain the exact .55.3 Candy performance authority instead of fabricating a .55.3.1 Candy UI release label');
  assert.equal(appBuild,'20260902-v04275531-startup-idb-sw-reliability');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.1-v04275531-startup-idb-sw-reliability');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.3'"),'startup hotfix must retain .55.3 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.2'"),'startup hotfix must retain .55.2 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55'"),'startup hotfix must retain .55 predecessor authority marker');
}else if(appVersion==='v0.4.27.55.3.3.1'){
  assert.ok(ui.includes("section.dataset.performanceAuthority='v0.4.27.55.3-mobile-incremental-confirmation'"),'page-prewarm successor must preserve the exact .55.3 Candy performance authority');
  assert.equal(appBuild,'20260905-v042755331-page-prewarm-collapsible-hydration');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.1-v042755331-page-prewarm-collapsible-hydration');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.3.3'"),'page-prewarm successor must retain .55.3.3 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.3'"),'page-prewarm successor must retain .55.3 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.2'"),'page-prewarm successor must retain .55.2 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55'"),'page-prewarm successor must retain .55 predecessor authority marker');
}else if(appVersion==='v0.4.27.55.3.3'){
  assert.ok(ui.includes("section.dataset.performanceAuthority='v0.4.27.55.3-mobile-incremental-confirmation'"),'page-hydration successor must preserve the exact .55.3 Candy performance authority');
  assert.equal(appBuild,'20260904-v04275533-page-hydration-authority');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3-v04275533-page-hydration-authority');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.3'"),'page-hydration successor must retain .55.3 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.2'"),'page-hydration successor must retain .55.2 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55'"),'page-hydration successor must retain .55 predecessor authority marker');
}else if(appVersion==='v0.4.27.55.3.2'){
  assert.ok(ui.includes("section.dataset.performanceAuthority='v0.4.27.55.3-mobile-incremental-confirmation'"),'page-aware successor must preserve the exact .55.3 Candy performance authority');
  assert.equal(appBuild,'20260903-v04275532-page-aware-static-shell');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.2-v04275532-page-aware-static-shell');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.3'"),'page-aware successor must retain .55.3 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55.2'"),'page-aware successor must retain .55.2 predecessor authority marker');
  assert.ok(version.includes("// app_version: 'v0.4.27.55'"),'page-aware successor must retain .55 predecessor authority marker');
}else{
  assert.fail(`visible-target-count successor release not governed: ${appVersion}`);
}

console.log(`PASS v0.4.27.55.1 visible target count confirmation: current=${appVersion} provider=24 observations=20 default=HOLD wrong-confirm=HOLD user-confirm=PASS operations=20 raw=IMMUTABLE stale=HOLD authority=${CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION}`);
