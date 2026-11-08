import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPokemonRosterRatingView} from '../assets/js/pokemon-roster-rating-preview.js';
import {reviewPokemonRatingApplyIntent} from '../assets/js/pokemon-rating-apply-preflight.js';

// Synthetic-only. No player database, IndexedDB, Web Lock, snapshot or Writer.
const names=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
const levels=[10,25,50,70,80];
const slots=id=>names.map((subskill_name,i)=>({pokemon_id:id,unlock_level:levels[i],subskill_name}));
const first={pokemon_id:'fixture-A',pokemon_instance_id:'unique-A',species:'same species',
  nickname:'first',level:20,specialty:'樹果',nature:'固執',
  nature_bonus:'幫忙速度',nature_penalty:'食材機率',rating:'D-'};
const second={...first,pokemon_id:'fixture-B',pokemon_instance_id:'unique-B',nickname:'second',rating:'C'};
const source={pokemon:[first,second],ingredients:[],subskills:[...slots('fixture-A'),...slots('fixture-B')]};
const sourceBefore=JSON.stringify(source);
const view=()=>buildPokemonRosterRatingView(source);
const preview=view();
const selectedPokemonIds=['fixture-A','fixture-B'];
const confirmation={explicit_user_action:true,intent:'APPLY_SELECTED_RATINGS',
  rule_version:preview.plan.rule_version,acknowledged_diff_count:2,
  selectedPokemonIds:[...selectedPokemonIds]};
const evaluate=(overrides={})=>reviewPokemonRatingApplyIntent({
  preview,freshView:view(),selectedPokemonIds,confirmation,...overrides,
});
const ready=evaluate();
assert.equal(ready.status,'HOLD_DURABLE_SNAPSHOT_AND_WRITER_ADMISSION');
assert.equal(ready.reviewed_diffs.length,2);
assert.deepEqual(ready.reviewed_diffs.map(x=>x.pokemon_instance_id),['unique-A','unique-B']);
assert.equal(ready.reviewed_diffs[0].previous_rating,'D-');
assert.equal(ready.reviewed_diffs[1].previous_rating,'C');
assert.equal(ready.reviewed_diffs[0].proposed_rating,'S+');
assert.equal(ready.player_data_write,false);
assert.equal(ready.overwrite_allowed,false);
assert.equal(Object.isFrozen(ready),true);
assert.equal(Object.isFrozen(ready.reviewed_diffs),true);
const expectHold=(input,reason)=>{
  const result=evaluate(input);
  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.reason_codes,[reason]);
  assert.deepEqual(result.reviewed_diffs,[]);
  assert.equal(result.overwrite_allowed,false);
};
expectHold({confirmation:null},'EXPLICIT_CONSENT_MISSING_OR_MISMATCH');
expectHold({confirmation:{...confirmation,explicit_user_action:false}},'EXPLICIT_CONSENT_MISSING_OR_MISMATCH');
expectHold({confirmation:{...confirmation,acknowledged_diff_count:1}},'EXPLICIT_CONSENT_MISSING_OR_MISMATCH');
expectHold({confirmation:{...confirmation,selectedPokemonIds:['fixture-B','fixture-A']}},'EXPLICIT_CONSENT_MISSING_OR_MISMATCH');
expectHold({selectedPokemonIds:[]},'SELECTION_MISSING_OR_DUPLICATE');
expectHold({selectedPokemonIds:['fixture-A','fixture-A']},'SELECTION_MISSING_OR_DUPLICATE');
expectHold({preview:{...preview,player_data_write:true}},'PREVIEW_SOURCE_UNVERIFIED');
expectHold({freshView:{...preview,plan:{...preview.plan,rule_version:'future-rule'}}},'RULE_VERSION_STALE');
expectHold({freshView:{...preview,rows:[...preview.rows,preview.rows[0]]}},'ROSTER_IDENTITY_SET_STALE_OR_DUPLICATE');
expectHold({freshView:{...preview,rows:preview.rows.slice(0,1)}},'ROSTER_IDENTITY_SET_STALE_OR_DUPLICATE');
const changed=(id,patch)=>({...preview,rows:preview.rows.map(row=>row.pokemon_id===id?{...row,...patch}:row)});
expectHold({freshView:changed('fixture-A',{previous_rating:'A'})},'SELECTED_RECORD_STALE');
expectHold({freshView:changed('fixture-A',{proposed_rating:'S'})},'SELECTED_RECORD_STALE');
expectHold({freshView:changed('fixture-A',{level:21})},'SELECTED_RECORD_STALE');
expectHold({freshView:changed('fixture-A',{pokemon_instance_id:'wrong-instance'})},'SELECTED_RECORD_STALE');
expectHold({freshView:changed('fixture-A',{current_evidence:[]})},'SELECTED_RECORD_STALE');
expectHold({freshView:changed('fixture-A',{status:'REVIEW_REQUIRED'})},'SELECTED_RECORD_NOT_ELIGIBLE');
expectHold({freshView:changed('fixture-A',{missing_inputs:['verified_nature']})},'SELECTED_RECORD_NOT_ELIGIBLE');
expectHold({freshView:changed('fixture-A',{pokemon_instance_id:null})},'SELECTED_RECORD_NOT_ELIGIBLE');
// RATE.4 negative-first: equal getter values are not authenticated facts.
// JSON.stringify silently executes accessors and can equate noncanonical
// selected evidence with a previously confirmed read-only preview.
const accessorView=changed('fixture-A',{});
const accessorRow=accessorView.rows.find(row=>row.pokemon_id==='fixture-A');
const originalLevel=accessorRow.level;
Object.defineProperty(accessorRow,'level',{enumerable:true,configurable:true,get:()=>originalLevel});
expectHold({freshView:accessorView},'SELECTED_RECORD_NOT_ELIGIBLE');
const nestedAccessorView=changed('fixture-A',{});
const nestedRow=nestedAccessorView.rows.find(row=>row.pokemon_id==='fixture-A');
const nestedEvidence=nestedRow.current_evidence[0];
if(nestedEvidence){
  const evidenceName=nestedEvidence.name;
  Object.defineProperty(nestedEvidence,'name',{enumerable:true,configurable:true,get:()=>evidenceName});
  expectHold({freshView:nestedAccessorView},'SELECTED_RECORD_NOT_ELIGIBLE');
}
const held=view();
held.rows[0].status='REVIEW_REQUIRED';
expectHold({preview:held},'SELECTED_RECORD_NOT_ELIGIBLE');
assert.equal(JSON.stringify(source),sourceBefore,'preflight changed original roster');
assert.equal(first.rating,'D-');
assert.equal(second.rating,'C');
const code=fs.readFileSync('assets/js/pokemon-rating-apply-preflight.js','utf8');
assert.doesNotMatch(code,/\b(?:run|persist|snapshot|begin|commit|rollback|indexedDB|localStorage|fetch)\s*\(/,
  'preflight must not execute any player-data write or snapshot');
assert.doesNotMatch(fs.readFileSync('assets/js/app.js','utf8'),/pokemon-rating-apply-preflight/,
  'unadmitted preflight must not be wired into production');
console.log(JSON.stringify({gate:'G14_RATE4_PREAPPLY_CONSENT_STALE_FAIL_CLOSED_SOURCE_TEST',
  status:'PASS',synthetic_only:true,selected_records:2,production_apply:'HOLD',
  original_ratings_preserved:true,writer_admission:false}));
