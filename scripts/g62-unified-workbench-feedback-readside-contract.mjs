import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-current-authority.js';
import {buildRecipeUnifiedWorkbenchProjection,readRecipeFeedbackForProjection,readRecipeInventoryForProjection} from '../assets/js/recipe-unified-player-workbench.js';
import {publicCatalogProjectionViewForLocalEntity,shouldInvalidatePublicCatalogFingerprint} from '../assets/js/public-catalog-startup-authority.js';

// Node has no browser sessionStorage by default. The normal verified-read
// fixture must explicitly provide an accessible, empty marker authority;
// missing/denied storage is separately covered by the negative VM contract.
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{
  getItem:()=>null,setItem(){},removeItem(){},
}});
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
// Separate from the already-fixed legacy weekly badges: unified workbench
// recommendations previously read in-memory SQL after a failed IDB persist,
// with no durable-authority guard or uncertainty-event render invalidation.
let uncertainSqlReads=0;
for(const state of ['UNVERIFIED','IN_FLIGHT','UNKNOWN']){
  const uncertain=readRecipeFeedbackForProjection({
    readPersistenceStatus:()=>({status:state}),
    readFeedback:()=>{uncertainSqlReads++;return [];},
  });
  assert.equal(uncertain.verified,false,`${state} must not authorize unified badges`);
  assert.equal(uncertain.status,'HOLD_FEEDBACK_PERSISTENCE_UNCERTAIN');
  assert.deepEqual(uncertain.rows,[]);
  const heldProjection=buildRecipeUnifiedWorkbenchProjection({
    catalogRows,inventory:[],week,recipeFeedback:uncertain.rows,
    feedbackAuthorityVerified:uncertain.verified,feedbackAuthorityStatus:uncertain.status,
  });
  assert.equal(heldProjection.feedback_authority_status,'HOLD_FEEDBACK_PERSISTENCE_UNCERTAIN');
  assert.equal(heldProjection.partition_complete,true,'durability HOLD preserves public catalog');
  assert.equal(heldProjection.unlocked.filter(row=>row.weekly_recommended).length,0);
  assert.equal(heldProjection.locked.filter(row=>row.weekly_recommended).length,0);
}
assert.equal(uncertainSqlReads,0,'unverified durability must not read player feedback SQLite');
for(const state of ['CLEAR','PERSISTED','NOT_PERSISTED']){
  const verified=readRecipeFeedbackForProjection({
    readPersistenceStatus:()=>({status:state}),readFeedback:()=>[],
  });
  assert.equal(verified.verified,true,`${state} permits read-side recomputation`);
  assert.equal(verified.status,'VERIFIED_READ');
}
assert.equal(readRecipeFeedbackForProjection({
  readPersistenceStatus:()=>null,readFeedback:()=>{throw Error('should not read');},
}).status,'HOLD_FEEDBACK_PERSISTENCE_UNCERTAIN','missing persistence authority must fail closed');
console.log('PASS G62_UNIFIED_FEEDBACK_DURABILITY_UNCERTAIN_READSIDE_NO_SQL_BADGES');
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

// G6.2 independent unified player-state risk: Number(true) and Number('01')
// previously promoted malformed unlock flags to actionable unlocked badges.
// No player DB or writer is used; the public catalog remains fully visible.
for(const invalid of [null,undefined,true,false,'01','1.0','true',2,-1,'']){
  const invalidCatalog=catalogRows.map((row,index)=>index===0?{...row,unlocked:invalid}:row);
  const withheld=buildRecipeUnifiedWorkbenchProjection({
    catalogRows:invalidCatalog,inventory:[],week,recipeFeedback:[],
  });
  assert.equal(withheld.player_unlock_authority_status,'HOLD_PLAYER_UNLOCK_UNVERIFIED',
    'invalid persisted unlock flag must hold the entire actionable projection');
  assert.equal(withheld.partition_complete,true,'unknown unlock state must not delete catalog rows');
  assert.equal(withheld.total_count,catalogRows.length);
  assert.equal(withheld.unlocked.filter(row=>row.weekly_recommended).length,0);
  assert.equal(withheld.locked.filter(row=>row.weekly_recommended).length,0);
  const unsafeRow=[...withheld.unlocked,...withheld.locked].find(row=>row.recipe_id===catalogRows[0].recipe_id);
  assert.equal(unsafeRow.status,'unverified','unknown unlock flag must remain visibly unverified');
  assert.equal(unsafeRow.can_attempt,false,'unknown player state cannot be treated as safe-to-attempt');
}
for(const valid of [0,1,'0','1']){
  const validCatalog=catalogRows.map((row,index)=>index===0?{...row,unlocked:valid}:row);
  const restored=buildRecipeUnifiedWorkbenchProjection({catalogRows:validCatalog,inventory:[],week,recipeFeedback:[]});
  assert.equal(restored.player_unlock_authority_status,'VERIFIED_READ',
    'canonical SQLite 0/1 and text 0/1 must remain compatible');
  assert.equal(restored.unlocked.filter(row=>row.weekly_recommended).length,3);
  assert.equal(restored.locked.filter(row=>row.weekly_recommended).length,3);
}
console.log('PASS G62_UNIFIED_PLAYER_UNLOCK_STRICT_01_FAIL_CLOSED_BOTH_BADGE_PARTITIONS');
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
assert.match(ui,/feedbackAuthorityStatus:feedback\.status/,'real unified projection must expose precise durability HOLD');
assert.match(ui,/readPersistenceStatus=getRecipeAttemptPersistenceStatus/,'unified feedback reader must bind actual writer durability authority');
assert.match(ui,/recipeFeedbackAuthority=feedback\.status/,'UI must expose feedback HOLD provenance');
assert.match(ui,/row\.recommendation_paused===true\?'已暫停'/,'paused UI status must be explicit');
assert.match(ui,/推薦（來源待查證）/,'suspect fallback recommendation must display source-review warning');
assert.match(ui,/row\.reference_maybe_wrong===true\?'來源待查證'/,'suspect nonrecommended recipe must display review warning');
const catalog=readFileSync(new URL('../assets/js/public-catalog-workbench.js',import.meta.url),'utf8');
assert.match(catalog,/markLocalProjectionDirty\(detail\.entity\)/,'actual event bridge must use dirty mapping');
assert.match(catalog,/window\.addEventListener\('pokemon-sleep:data-changed',handleDataChanged\)/,'real data-changed listener must refresh projection');
assert.match(catalog,/window\.addEventListener\('pokemon-sleep:recipe-attempt-persistence-uncertain'/,
  'real catalog renderer must invalidate unified view on ambiguous durability without data-changed');
assert.match(catalog,/requestRender\(dirtyView,'feedback-persistence-uncertain'\)/,
  'active unified recipe view must re-render after durability HOLD event');
console.log('PASS G62_UNIFIED_WORKBENCH_FEEDBACK_READSIDE_PAUSE_RESUME_TWO_PARTITIONS');
console.log('PASS G62_PLAYER_FEEDBACK_INVALIDATES_RECIPE_VIEW_NOT_PUBLIC_FINGERPRINT');
console.log('PASS G62_SUSPECT_REFERENCE_SOFT_DEPRIORITIZATION_WITH_EXPLICIT_FALLBACK_WARNING');
console.log('NOTE G62_SYNTHETIC_READ_ONLY_NO_OWNER_ANDROID_UAT_NO_PLAYER_WRITE');

// Independent G6.2 inventory-read authority: a failed SQLite stock query
// must not masquerade as verified zero inventory or advertise top-three meals.
const verifiedInventory=readRecipeInventoryForProjection({readInventory:()=>[
  {ingredient_name:'特選蘋果',quantity:12},
]});
assert.equal(verifiedInventory.verified,true);
assert.equal(verifiedInventory.status,'VERIFIED_READ');
assert.equal(verifiedInventory.rows.length,1);
const missingInventory=readRecipeInventoryForProjection({
  readInventory:()=>{throw Error('synthetic ingredient_inventory query failure');},
});
assert.equal(missingInventory.verified,false);
assert.equal(missingInventory.status,'HOLD_INVENTORY_READ_FAILED');
assert.deepEqual(missingInventory.rows,[]);
// Regression: Number(null), Number(''), Number(false), Number([]) all equal 0;
// none is an authoritative SQLite stock quantity. Numeric-string compatibility stays.
assert.equal(readRecipeInventoryForProjection({readInventory:()=>[
  {ingredient_name:'特選蘋果',quantity:'12'},
  {ingredient_name:'特選蘋果',quantity:0},
]}).verified,true,'canonical integer text and numeric zero remain valid');
for(const malformed of [null,[{ingredient_name:'',quantity:1}],
  [{ingredient_name:'特選蘋果',quantity:'not-a-number'}],
  [{ingredient_name:'特選蘋果',quantity:-1}],
  [{ingredient_name:'特選蘋果',quantity:1.5}],
  ...[null,undefined,'','  ',false,true,[],{},'0x10','1e2','01',Infinity,NaN]
    .map(quantity=>[{ingredient_name:'特選蘋果',quantity}])]) {
  assert.equal(readRecipeInventoryForProjection({readInventory:()=>malformed}).verified,false,
    'invalid stock rows must never certify recommendations');
}
let inventoryReadCalls=0;
const readonlyInventory=readRecipeInventoryForProjection({
  readonly:true,readInventory:()=>{inventoryReadCalls++;return [];},
});
assert.equal(inventoryReadCalls,0);
assert.equal(readonlyInventory.verified,false);
const inventoryHeld=buildRecipeUnifiedWorkbenchProjection({
  catalogRows,inventory:missingInventory.rows,week,recipeFeedback:verifiedRead.rows,
  feedbackAuthorityVerified:true,inventoryAuthorityVerified:missingInventory.verified,
});
assert.equal(inventoryHeld.inventory_authority_status,'HOLD_INVENTORY_READ_FAILED');
assert.equal(inventoryHeld.feedback_authority_status,'VERIFIED_READ');
assert.equal(inventoryHeld.partition_complete,true);
assert.equal(inventoryHeld.total_count,baseline.total_count);
assert.equal(inventoryHeld.unlocked.filter(row=>row.weekly_recommended).length,0);
assert.equal(inventoryHeld.locked.filter(row=>row.weekly_recommended).length,0);
const inventoryRestored=buildRecipeUnifiedWorkbenchProjection({
  catalogRows,inventory:verifiedInventory.rows,week,recipeFeedback:verifiedRead.rows,
  inventoryAuthorityVerified:verifiedInventory.verified,
});
assert.equal(inventoryRestored.inventory_authority_status,'VERIFIED_READ');
assert.equal(inventoryRestored.unlocked.filter(row=>row.weekly_recommended).length,3);
assert.equal(inventoryRestored.locked.filter(row=>row.weekly_recommended).length,3);
assert.match(ui,/readRecipeInventoryForProjection\(\{readonly\}\)/,
  'real renderer must use guarded stock query');
assert.match(ui,/inventory:inventory\.rows/,
  'actual projection must use stock authority result');
assert.match(ui,/recipeInventoryAuthority=inventory\.status/,
  'UI must expose inventory HOLD provenance');
assert.match(ui,/recipePlayerUnlockAuthority=projection\.player_unlock_authority_status/,
  'UI must expose the strict player-unlock HOLD provenance');
assert.match(ui,/!validPlayerUnlock\(row\.unlocked\)\?'玩家狀態待核對'/,
  'invalid unlock state must be visible rather than a false recommendation');
assert.match(ui,/readonly=readonly\|\|!validPlayerUnlock\(row\.unlocked\)/,
  'unknown player state must not be silently overwritten through default checkbox');
assert.match(ui,/inventoryVerified\?'庫存未驗證'|inventoryVerified\?shortageText/,
  'unverified stock must not display fabricated shortage numbers');
console.log('PASS G62_UNIFIED_INVENTORY_READ_FAILURE_WITHHOLDS_BADGES_AND_SHORTAGES');
console.log('NOTE G62_INVENTORY_FIXTURE_READONLY_NO_PLAYER_SQLITE_NO_OWNER_UAT');

console.log('PASS G62_UNIFIED_FEEDBACK_READ_FAILURE_WITHHOLDS_BADGES_PUBLIC_CATALOG_PRESERVED');
