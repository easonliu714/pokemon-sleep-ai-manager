import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Execute exact production pure contract in an isolated VM; no player DB, storage or network.
const path='assets/js/war-room-named-team-draft-contract.js';
const source=fs.readFileSync(path,'utf8');
assert.doesNotMatch(source,/\b(?:import\s+|fetch\s*\(|indexedDB\b|localStorage\b|sessionStorage\b|\brun\s*\(|\bpersist\s*\(|\bsnapshot\s*\()/);
const context={Date,console};context.globalThis=context;
vm.runInNewContext(source.replace(/^export /gm,''),context,{filename:path,timeout:3000});
const check=context.classifyNamedTeamDraftEligibility;
const slots=Array.from({length:5},(_,i)=>({slot_index:i,is_leader:i===0,pokemon_id:'private-id-'+i,pokemon_instance_id:'private-instance-'+i,hard_constraint_status:'PASS'}));
const team={team_status:'READY',team_id:'team_draft:123',input_fingerprint:'team_optimizer:abc',optimizer_version:'fixture-optimizer',slots,missing_constraints:[],satisfied_constraints:['mandatory_member:private-id-0']};
const projection={projection_status:'READY',goal_profile_id:'goal_fixture',input_fingerprint:'team_optimizer_result:def',primary:team,alternatives:[],mandatory_member_count:1,mandatory_satisfied_count:1};
const args={name:'本週能量最大化',projection,team,goalDraftState:'clean',capturedAt:'2026-10-25T00:00:00.000Z'};
const positive=check(args);
assert.equal(positive.eligible,true);
assert.equal(positive.status,'READY_FOR_EXPLICIT_LOCAL_SAVE');
assert.equal(positive.payload.team_name,args.name);
assert.equal(positive.payload.members.length,5);
assert.equal(positive.payload.members[0].pokemon_id,'private-id-0');
assert.equal(positive.payload.game_applied,false);
assert.equal(positive.payload.player_data_write,false);
assert.equal(positive.payload.persistence_status,'NOT_WRITTEN');
assert.equal(positive.payload.requires_explicit_local_save,true);
assert.equal(positive.payload.requires_re_evaluation_before_future_apply,true);
assert.equal(positive.payload.re_evaluation_status,'CURRENT_AT_CAPTURE_ONLY');
assert.equal(check({...args,name:'  ＡＢＣ  '}).payload.team_name,'ABC');
const negatives=[
  [{name:''},'INVALID_TEAM_NAME'],
  [{name:'X'.repeat(41)},'INVALID_TEAM_NAME'],
  [{name:'bad\nname'},'INVALID_TEAM_NAME'],
  [{goalDraftState:'dirty'},'GOAL_PROFILE_UNSAVED_OR_INVALID'],
  [{goalDraftState:'invalid'},'GOAL_PROFILE_UNSAVED_OR_INVALID'],
  [{goalDraftState:'saving'},'GOAL_PROFILE_UNSAVED_OR_INVALID'],
  [{projection:{...projection,projection_status:'PLAYER_DATA_UNAVAILABLE'}},'PROJECTION_NOT_READY'],
  [{projection:{...projection,goal_profile_id:''}},'GOAL_OR_PROJECTION_FINGERPRINT_MISSING'],
  [{projection:{...projection,input_fingerprint:''}},'GOAL_OR_PROJECTION_FINGERPRINT_MISSING'],
  [{team:{...team,team_status:'BLOCKED'}},'TEAM_NOT_READY'],
  [{team:{...team}},'TEAM_NOT_FROM_CURRENT_PROJECTION'],
  [{team:{...team,missing_constraints:['required_role_missing']}},'TEAM_NOT_FROM_CURRENT_PROJECTION'],
  [{projection:{...projection,mandatory_satisfied_count:0}},'MANDATORY_MEMBER_UNVERIFIED'],
  [{team:{...team,slots:slots.slice(0,4)},projection:{...projection,primary:{...team,slots:slots.slice(0,4)}}},'TEAM_NOT_FROM_CURRENT_PROJECTION'],
  [{capturedAt:'not-a-date'},'INVALID_CAPTURE_TIMESTAMP'],
];
for(const [overrides,reason] of negatives){
  const result=check({...args,...overrides});
  assert.equal(result.eligible,false,reason);
  assert.equal(result.reason,reason);
  assert.equal(result.player_data_write,false);
  assert.equal(result.game_applied,false);
}
function checkTeamPatch(patch,reason){
  const changed={...team,...patch};
  const result=check({...args,team:changed,projection:{...projection,primary:changed}});
  assert.equal(result.reason,reason);
}
checkTeamPatch({missing_constraints:['required_role_missing']},'HARD_CONSTRAINT_UNSATISFIED');
checkTeamPatch({slots:slots.slice(0,4)},'TEAM_SIZE_NOT_FIVE');
checkTeamPatch({slots:slots.map((s,i)=>i===4?{...s,pokemon_id:'private-id-0'}:s)},'MEMBER_ID_MISSING_OR_DUPLICATE');
checkTeamPatch({slots:slots.map((s,i)=>i===2?{...s,slot_index:3}:s)},'SLOT_ORDER_OR_LEADER_MISMATCH');
checkTeamPatch({slots:slots.map((s,i)=>i===2?{...s,hard_constraint_status:'REVIEW'}:s)},'MEMBER_HARD_CONSTRAINT_NOT_PASS');
checkTeamPatch({input_fingerprint:''},'TEAM_PROVENANCE_MISSING');
assert.equal(team.slots.length,5);
assert.equal(projection.mandatory_satisfied_count,1);
console.log('PASS G265_NAMED_DRAFT_SOURCE_BOUND_ELIGIBILITY_AND_NO_WRITE POSITIVE=2 NEGATIVE='+String(negatives.length+6));
console.log('HOLD G265_LOCAL_SQLITE_SAVE_AND_OWNER_ANDROID_UAT_NOT_IMPLEMENTED');
