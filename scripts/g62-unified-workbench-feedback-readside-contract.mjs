import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-current-authority.js';
import {buildRecipeUnifiedWorkbenchProjection,readRecipeFeedbackForProjection} from '../assets/js/recipe-unified-player-workbench.js';
import {publicCatalogProjectionViewForLocalEntity,shouldInvalidatePublicCatalogFingerprint} from '../assets/js/public-catalog-startup-authority.js';

// G6.2 source-bound, read-side only: all catalog and feedback rows are synthetic.
// No player SQLite/IDB, network, public master mutation, cooking, or App version change.
const grouped=new Map();
for(const row of PUBLIC_RECIPE_MASTER){
  const key=String(row.category);
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(row);
}
const group=[...grouped.values()].find(rows=>rows.length>=8);
assert.ok(group,'need eight same-category canonical recipes for synthetic regression');
const catalogRows=group.slice(0,8).map((row,index)=>({
  ...row,unlocked:index<4?1:0,player_record_exists:index<4?1:0,
}));
const week={dish_category:catalogRows[0].category,week_start:'2026-11-02',authority_source:'SYNTHETIC'};
const project=recipeFeedback=>buildRecipeUnifiedWorkbenchProjection({catalogRows,inventory:[],week,recipeFeedback});
const baseline=project([]);
// G6.2 independent live-render read-side gap: a missing/failed feedback
// authority must not be treated as an empty list of player pauses.
const verifiedRead=readRecipeFeedbackForProjection({readFeedback:()=>[]});
assert.equal(verifiedRead.verified,true);
assert.equal(verifiedRead.status,'VERIFIED_READ');
const failedRead=readRecipeFeedbackForProjection({readFeedback:()=>{throw Error('synthetic missing feedback table');}});
assert.equal(failedRead.verified,false);
assert.equal(failedRead.status,'HOLD_FEEDBACK_READ_FAILED');
assert.deepEqual(failedRead.rows,[]);
const invalidRead=readRecipeFeedbackForProjection({readFeedback:()=>null});
assert.equal(invalidRead.verified,false,'malformed read result must fail closed');
let readonlyCalls=0;
const readonlyRead=readRecipeFeedbackForProjection({readonly:true,readFeedback:()=>{readonlyCalls++;return [];}});
assert.equal(readonlyCalls,0,'readonly projection must not query player feedback');
assert.equal(readonlyRead.verified,false);
const held=buildRecipeUnifiedWorkbenchProjection({catalogRows,inventory:[],week,
  recipeFeedback:failedRead.rows,feedbackAuthorityVerified:failedRead.verified});
assert.equal(held.feedback_authority_status,'HOLD_FEEDBACK_READ_FAILED');
assert.equal(held.partition_complete,true,'feedback failure must not erase public catalog');
assert.equal(held.total_count,catalogRows.length);
assert.equal(held.unlocked.filter(row=>row.weekly_recommended).length,0);
assert.equal(held.locked.filter(row=>row.weekly_recommended).length,0);
assert.equal(baseline.feedback_authority_status,'VERIFIED_READ');
assert.equal(baseline.partition_complete,true);
assert.equal(baseline.unlocked.filter(row=>row.weekly_recommended).length,3);
assert.equal(baseline.locked.filter(row=>row.weekly_recommended).length,3);
const pausedUnlocked=baseline.unlocked.find(row=>row.weekly_recommended);
const pausedLocked=baseline.locked.find(row=>row.weekly_recommended);
assert.ok(pausedUnlocked&&pausedLocked);
const feedback=[
  {recipe_id:pausedUnlocked.recipe_id,recommendation_paused:1,attempt_count:1,reference_maybe_wrong:1},
  {recipe_id:pausedLocked.recipe_id,recommendation_paused:true,attempt_count:1,reference_maybe_wrong:1},
];
const paused=project(feedback);
for(const id of [pausedUnlocked.recipe_id,pausedLocked.recipe_id]){
  const row=[...paused.unlocked,...paused.locked].find(item=>item.recipe_id===id);
  assert.ok(row,'paused recipe remains visible in canonical partition');
  assert.equal(row.recommendation_paused,true);
  assert.equal(row.weekly_recommended,false,'paused recipe cannot display recommendation');
}
assert.equal(paused.unlocked.filter(row=>row.weekly_recommended).length,3,'unlocked recommendations backfill non-paused alternatives');
assert.equal(paused.locked.filter(row=>row.weekly_recommended).length,3,'locked recommendations backfill non-paused alternatives');
assert.equal(paused.total_count,baseline.total_count,'feedback must not remove canonical recipes');
assert.equal(paused.partition_complete,true);
assert.deepEqual(paused.unlocked.map(row=>row.recipe_id),baseline.unlocked.map(row=>row.recipe_id));
assert.deepEqual(paused.locked.map(row=>row.recipe_id),baseline.locked.map(row=>row.recipe_id));
// Unpausing alone must not silently clear the independent suspect-source warning.
const unpausedButSuspect=project(feedback.map(row=>({...row,recommendation_paused:0})));
assert.equal(unpausedButSuspect.unlocked.find(row=>row.recipe_id===pausedUnlocked.recipe_id).weekly_recommended,false);
assert.equal(unpausedButSuspect.locked.find(row=>row.recipe_id===pausedLocked.recipe_id).weekly_recommended,false);
// A synthetic source-review clearance restores normal shortage-based eligibility.
const reviewCleared=project(feedback.map(row=>({...row,recommendation_paused:0,reference_maybe_wrong:0})));
assert.equal(reviewCleared.unlocked.find(row=>row.recipe_id===pausedUnlocked.recipe_id).weekly_recommended,true,'cleared unlocked recipe regains normal rank');
assert.equal(reviewCleared.locked.find(row=>row.recipe_id===pausedLocked.recipe_id).weekly_recommended,true,'cleared locked recipe regains normal rank');
// Independent G6.2 read-side boundary: suspect reference and pause are separate flags.
// Malformed persisted flags must not silently re-admit a suspect reference
// into the unified weekly badge, even when the original row was recommended.
const corruptFeedback=project([{
  recipe_id:pausedUnlocked.recipe_id,recommendation_paused:2,
  reference_maybe_wrong:'UNKNOWN',attempt_count:1,
}]);
const corruptUnified=corruptFeedback.unlocked.find(row=>row.recipe_id===pausedUnlocked.recipe_id);
assert.equal(corruptUnified.recommendation_paused,true);
assert.equal(corruptUnified.reference_maybe_wrong,true);
assert.equal(corruptUnified.weekly_recommended,false);
const suspectFeedback=[
  {recipe_id:pausedUnlocked.recipe_id,recommendation_paused:0,reference_maybe_wrong:1,attempt_count:1},
  {recipe_id:pausedLocked.recipe_id,recommendation_paused:0,reference_maybe_wrong:1,attempt_count:1},
];
const suspect=project(suspectFeedback);
for(const id of [pausedUnlocked.recipe_id,pausedLocked.recipe_id]){
  const row=[...suspect.unlocked,...suspect.locked].find(item=>item.recipe_id===id);
  assert.equal(row.recommendation_paused,false,'suspect reference must not silently pause player choice');
  assert.equal(row.reference_maybe_wrong,true);
  assert.equal(row.weekly_recommended,false,'three unflagged alternatives must outrank a suspect reference');
}
assert.equal(suspect.unlocked.filter(row=>row.weekly_recommended).length,3);
assert.equal(suspect.locked.filter(row=>row.weekly_recommended).length,3);
const allUnlockedSuspect=project(baseline.unlocked.map(row=>({
  recipe_id:row.recipe_id,recommendation_paused:0,reference_maybe_wrong:1,attempt_count:1,
})));
assert.equal(allUnlockedSuspect.unlocked.filter(row=>row.weekly_recommended).length,3,
  'explicitly unpaused suspect references remain fallback-eligible');
assert.ok(allUnlockedSuspect.unlocked.filter(row=>row.weekly_recommended)
  .every(row=>row.reference_maybe_wrong===true),'fallback must retain source-warning provenance');
for(const entity of ['recipe_feedback_state','recipe_attempt_feedback']){
  assert.equal(publicCatalogProjectionViewForLocalEntity(entity),'recipes',entity+' must invalidate recipe render cache');
  assert.equal(shouldInvalidatePublicCatalogFingerprint({entity}),false,'player feedback must not invalidate Public Master');
}
assert.equal(publicCatalogProjectionViewForLocalEntity('unrelated_player_entity'),null);
const ui=readFileSync(new URL('../assets/js/recipe-unified-player-workbench.js',import.meta.url),'utf8');
assert.match(ui,/readRecipeFeedbackForProjection\(\{readonly\}\)/,'real unified renderer must use guarded feedback read');
assert.match(ui,/recipeFeedback:feedback\.rows,feedbackAuthorityVerified:feedback\.verified/,'real projection must bind feedback read status');
assert.match(ui,/recipeFeedbackAuthority=feedback\.status/,'UI must expose feedback HOLD provenance');
assert.match(ui,/row\.recommendation_paused===true\?'已暫停'/,'paused UI status must be explicit');
assert.match(ui,/推薦（來源待查證）/,'suspect fallback recommendation must display source-review warning');
assert.match(ui,/row\.reference_maybe_wrong===true\?'來源待查證'/,'suspect nonrecommended recipe must display review warning');
const catalog=readFileSync(new URL('../assets/js/public-catalog-workbench.js',import.meta.url),'utf8');
assert.match(catalog,/markLocalProjectionDirty\(detail\.entity\)/,'actual event bridge must use dirty mapping');
assert.match(catalog,/window\.addEventListener\('pokemon-sleep:data-changed',handleDataChanged\)/,'real data-changed listener must refresh projection');
console.log('PASS G62_UNIFIED_WORKBENCH_FEEDBACK_READSIDE_PAUSE_RESUME_TWO_PARTITIONS');
console.log('PASS G62_PLAYER_FEEDBACK_INVALIDATES_RECIPE_VIEW_NOT_PUBLIC_FINGERPRINT');
console.log('PASS G62_SUSPECT_REFERENCE_SOFT_DEPRIORITIZATION_WITH_EXPLICIT_FALLBACK_WARNING');
console.log('NOTE G62_SYNTHETIC_READ_ONLY_NO_OWNER_ANDROID_UAT_NO_PLAYER_WRITE');

console.log('PASS G62_UNIFIED_FEEDBACK_READ_FAILURE_WITHHOLDS_BADGES_PUBLIC_CATALOG_PRESERVED');
