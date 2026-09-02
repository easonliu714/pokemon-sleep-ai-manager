import assert from 'node:assert/strict';
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
const candidate=snapshot.rows.find(row=>row?.candy_id&&row?.candy_name);
assert.ok(candidate,'Candy Public Master fixture candidate missing');

const providerRaw={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:snapshot.scenario,
  authority:snapshot.authority,
  data_version:snapshot.data_version,
  catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:'2026-09-02T05:58:09.214Z',
  visible_target_count:2,
  observations:[{
    observation_id:'obs_001',
    status:'MATCHED',
    observed_text:candidate.candy_name,
    observed_data:{quantity:187},
    canonical_key:{candy_id:candidate.candy_id,candy_name:candidate.candy_name},
    canonical_name:candidate.candy_name,
    source_image_ref:'candy-image-001',
    confidence:1,
  }],
};
const rawFrozen=JSON.stringify(providerRaw);

const initialState=getCandyVisibleTargetCountState(providerRaw);
assert.equal(initialState.provider_visible_target_count,2);
assert.equal(initialState.observations_length,1);
assert.equal(initialState.delta,1);
assert.equal(initialState.gate_status,'HOLD');
assert.equal(initialState.gate_cleared,false);

const initiallyCompiled=compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(providerRaw,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(initiallyCompiled.ok,false,'provider count mismatch must fail closed before explicit confirmation');
assert.match(initiallyCompiled.errors.join('\n'),/visible_target_count=2.*observations\.length=1/u,'count mismatch error missing');
assert.equal(providerRaw.visible_target_count,2,'provider count must never be silently normalized');
assert.equal(JSON.stringify(providerRaw),rawFrozen,'provider Raw mutated during validation/compile');

const quantityConfirmed=confirmCandyScreenshotQuantity(providerRaw,'candies','obs_001',{confirmedAt:'2026-09-02T06:01:00.000Z'});
assert.equal(quantityConfirmed.visible_target_count,2,'quantity confirmation must not rewrite provider count');
assert.equal(JSON.stringify(providerRaw),rawFrozen,'quantity confirmation mutated provider Raw');

const wrongCount=applyCandyVisibleTargetCountResolution(quantityConfirmed,'candies',2,{confirmedAt:'2026-09-02T06:02:00.000Z'});
assert.equal(wrongCount.visible_target_count,2,'wrong count resolution must retain provider value');
assert.equal(wrongCount.visible_target_count_resolution.confirmed_visible_target_count,2);
assert.equal(getCandyVisibleTargetCountState(wrongCount).gate_status,'HOLD','confirmation that does not equal observations.length must remain HOLD');
assert.equal(compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(wrongCount,'candies',{allowedImageRefs:['candy-image-001']}).ok,false,'wrong count confirmation must not clear mismatch gate');

const resolved=applyCandyVisibleTargetCountResolution(quantityConfirmed,'candies',1,{confirmedAt:'2026-09-02T06:03:00.000Z'});
assert.equal(resolved.visible_target_count,2,'Working JSON must preserve provider visible_target_count for evidence');
assert.equal(resolved.visible_target_count_resolution.action,CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_ACTION);
assert.equal(resolved.visible_target_count_resolution.authority,CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION);
assert.equal(resolved.visible_target_count_resolution.provider_visible_target_count,2);
assert.equal(resolved.visible_target_count_resolution.confirmed_visible_target_count,1);
assert.equal(resolved.visible_target_count_resolution.observations_length_at_confirmation,1);
assert.equal(JSON.stringify(providerRaw),rawFrozen,'explicit count resolution mutated provider Raw');

const resolvedState=getCandyVisibleTargetCountState(resolved);
assert.equal(resolvedState.gate_status,'USER_CONFIRMED_MATCH');
assert.equal(resolvedState.gate_cleared,true);
assert.equal(resolvedState.user_confirmed_matches_observations,true);

const compiled=compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(resolved,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(compiled.ok,true,compiled.errors.join('\n'));
assert.equal(compiled.update_package.operations.length,1,'count confirmation must not alter quantity write cardinality');
assert.equal(compiled.summary.provider_visible_target_count,2);
assert.equal(compiled.summary.observations_length,1);
assert.equal(compiled.summary.user_confirmed_visible_target_count,1);
assert.equal(compiled.summary.visible_target_count_gate_status,'USER_CONFIRMED_MATCH');
assert.equal(compiled.update_package.operations[0].data.quantity,187);

const stale=structuredClone(resolved);
stale.observations=[];
const staleState=getCandyVisibleTargetCountState(stale);
assert.equal(staleState.resolution_structurally_valid,false,'observation cardinality mutation must invalidate prior count evidence');
assert.equal(staleState.gate_status,'HOLD');
assert.equal(compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(stale,'candies',{allowedImageRefs:['candy-image-001']}).ok,false,'stale count resolution must not clear a new mismatch');

console.log(`PASS v0.4.27.55.1 visible target count confirmation: provider=2 observations=1 default=HOLD wrong-confirm=HOLD user-confirm=PASS raw=IMMUTABLE stale=HOLD authority=${CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION}`);
