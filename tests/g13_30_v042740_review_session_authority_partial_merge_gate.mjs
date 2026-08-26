import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const explicitPath='assets/js/explicit-manual-draft-save-v042737.js';
const corePath='assets/js/data-consistency-multicapture.js';
for(const path of [explicitPath,corePath]){
  const syntax=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
  assert.equal(syntax.status,0,`${path} syntax must pass`);
}

const mod=await import(`${pathToFileURL(explicitPath).href}?t=${Date.now()}`);
const versionAuthority=fs.readFileSync('assets/js/version-authority.js','utf8');
const explicitSource=fs.readFileSync(explicitPath,'utf8');
const coreSource=fs.readFileSync(corePath,'utf8');

assert.match(versionAuthority,/app_version:\s*'v0\.4\.27\.40'/);
assert.match(versionAuthority,/app_build:\s*'20260826-v042740-review-session-authority-partial-merge'/);
assert.match(versionAuthority,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.40-v042740-review-session-authority-partial-merge'/);
assert.match(versionAuthority,/\/\/ app_version: 'v0\.4\.27\.39'/,'v0.4.27.39 must remain as immutable predecessor parser evidence');
assert.equal(mod.REVIEW_SESSION_AUTHORITY_VERSION,'v0.4.27.40-review-session-authority-partial-merge-2026-08-26-a');

// Physical failure replay: while G1 is visibly under human review, G2/G3 background
// revisions must queue instead of stealing the active review group.
assert.match(coreSource,/reason:'platform_target_background_revision'/);
assert.match(coreSource,/publishNavigation\('platform_target_background_revision_queued'\)/);
assert.match(coreSource,/platform_target_auto_focus:false/);
assert.match(coreSource,/background_target_queue:true/);
assert.doesNotMatch(coreSource,/selectGroup\(target\.id,\{reason:'platform_target_new_run_focus'\}\)/,'background target must not auto-focus during review');

// Even if a predecessor/runtime race already moved active_group_id, explicit save may
// rebind to the visible group only when the exact revision/source authority is unchanged.
const groups=[
  {id:'G1',status:'pending',draft:{species:'GROUP_A',nickname:''},latest_revision:{analysis_id:'A1',revision_no:3,source_image_ref:'a.png'}},
  {id:'G2',status:'active',draft:{species:'GROUP_B'},latest_revision:{analysis_id:'B1',revision_no:2,source_image_ref:'b.png'}},
];
let active='G2';
const consistency={
  getState:()=>({active_group_id:active,groups:structuredClone(groups)}),
  selectGroup:(id)=>{const previous=groups.find(row=>row.id===active);if(previous&&previous.id!==id)previous.status='pending';const next=groups.find(row=>row.id===id);if(!next)return null;next.status='active';active=id;return next;},
};
const exact={group_id:'G1',analysis_id:'A1',revision_no:3,source_image_ref:'a.png'};
let rebound=mod.rebindVisibleAuthorityForSave(consistency,exact);
assert.equal(rebound.ok,true);
assert.equal(rebound.status,'AUTHORITY_MATCH');
assert.equal(active,'G1');

groups[0].latest_revision.revision_no=4;
active='G2';
rebound=mod.rebindVisibleAuthorityForSave(consistency,exact);
assert.equal(rebound.ok,false);
assert.equal(rebound.status,'STALE_REVISION','true revision drift must still fail closed');
assert.equal(active,'G2','stale revision must not silently rebind active review group');

// Sparse cross-image observations are merged by unlock level. Absence on one screenshot
// is not a conflict and must not blank the entire collection.
let merged=mod.mergeRowsByUnlockLevel([
  [
    {unlock_level:1,ingredient_name:'ING_A',quantity:1},
    {unlock_level:30,ingredient_name:'ING_B',quantity:2},
    {unlock_level:60,ingredient_name:'ING_C',quantity:3},
  ],
  [
    {unlock_level:1,ingredient_name:'ING_A',quantity:1},
    {unlock_level:30,ingredient_name:'ING_B',quantity:2},
  ],
],'ingredients');
assert.deepEqual(merged.rows.map(row=>row.unlock_level),[1,30,60]);
assert.equal(merged.conflicts.length,0);

// A true conflict at one level only removes that level; unrelated levels remain available.
merged=mod.mergeRowsByUnlockLevel([
  [
    {unlock_level:1,ingredient_name:'ING_A',quantity:1},
    {unlock_level:30,ingredient_name:'ING_B',quantity:2},
    {unlock_level:60,ingredient_name:'ING_C',quantity:3},
  ],
  [
    {unlock_level:1,ingredient_name:'ING_A',quantity:1},
    {unlock_level:30,ingredient_name:'ING_B',quantity:2},
    {unlock_level:60,ingredient_name:'ING_D',quantity:3},
  ],
],'ingredients');
assert.deepEqual(merged.rows.map(row=>row.unlock_level),[1,30]);
assert.deepEqual(merged.conflicts.map(row=>row.field),['ingredients@60']);

const subskills=mod.mergeRowsByUnlockLevel([
  [
    {unlock_level:10,subskill_name:'SUB_A',is_unlocked:1},
    {unlock_level:50,subskill_name:'SUB_B',is_unlocked:0},
    {unlock_level:70,subskill_name:'SUB_C',is_unlocked:0},
  ],
  [{unlock_level:10,subskill_name:'SUB_A',is_unlocked:1}],
],'subskills');
assert.deepEqual(subskills.rows.map(row=>row.unlock_level),[10,50,70]);
assert.equal(subskills.conflicts.length,0);

const subConflict=mod.mergeRowsByUnlockLevel([
  [{unlock_level:25,subskill_name:'SUB_X',is_unlocked:1}],
  [{unlock_level:25,subskill_name:'SUB_Y',is_unlocked:1}],
],'subskills');
assert.equal(subConflict.rows.length,0);
assert.deepEqual(subConflict.conflicts.map(row=>row.field),['subskills@25']);

// Core must use level-aware collection merge while preserving scalar fail-closed behavior.
assert.match(coreSource,/function mergeCollectionRows\(out,key,nextRows\)/);
assert.match(coreSource,/mergeCollectionRows\(out,'subskills',next\.subskills\)/);
assert.match(coreSource,/mergeCollectionRows\(out,'ingredients',next\.ingredients\)/);
assert.match(coreSource,/else if\(String\(out\[key\]\)!==String\(next\[key\]\)\)\{addConflict\(out,key,out\[key\],next\[key\]\);out\[key\]=null;\}/,'scalar conflicts must remain fail closed');
assert.match(explicitSource,/v042740_explicit_save_rebind_visible_authority/);
assert.match(explicitSource,/v042740_partial_collection_conflicts_retained/);
assert.match(explicitSource,/scope\.PokemonSleepReviewSessionAuthorityV042740=api/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.30_V042740_REVIEW_SESSION_AUTHORITY_PARTIAL_MERGE',
  physical_failures_replayed:[
    'explicit save blocked by GROUP_MISMATCH after background target focus steal',
    'sparse ingredient/subskill evidence blanked as whole-array conflict',
  ],
  background_target_auto_focus:false,
  background_target_queue:true,
  exact_visible_authority_rebind:true,
  stale_revision_fail_closed:true,
  ingredient_merge_by_unlock_level:true,
  subskill_merge_by_unlock_level:true,
  scalar_conflict_fail_closed_preserved:true,
  private_player_fixture_embedded:false,
},null,2));
