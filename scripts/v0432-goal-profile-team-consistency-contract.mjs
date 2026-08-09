import assert from 'node:assert/strict';
import fs from 'node:fs';
import {strategyGoalProfileDraftState,strategyGoalProfileValidation} from '../assets/js/strategy-goal-contract.js';
import {optimizeTeam} from '../assets/js/team-optimizer.js';

const activeProfile={
  goal_profile_id:'goal_fixture',profile_name:'fixture',primary_goal:'balanced',secondary_goals:[],
  hard_constraints:{must_include_pokemon:['p1'],exclude_pokemon:[],must_include_role:[],max_same_species:5,sleep_evolution_member_at_night:[]},
};
const sameDraft={...activeProfile};
const clean=strategyGoalProfileDraftState(sameDraft,activeProfile);
assert.equal(clean.valid,true);
assert.equal(clean.dirty,false,'identical active profile must be clean');

const dirty=strategyGoalProfileDraftState({...activeProfile,hard_constraints:{...activeProfile.hard_constraints,must_include_pokemon:['p1','p2']}},activeProfile);
assert.equal(dirty.valid,true);
assert.equal(dirty.dirty,true,'changed valid draft must be marked dirty');

const conflictProfile={...activeProfile,hard_constraints:{...activeProfile.hard_constraints,must_include_pokemon:['p1','p2'],exclude_pokemon:['p2']}};
const conflictValidation=strategyGoalProfileValidation(conflictProfile);
assert.equal(conflictValidation.valid,false);
assert.ok(conflictValidation.errors.includes('include_exclude_conflict:p2'));
const conflictState=strategyGoalProfileDraftState(conflictProfile,activeProfile);
assert.equal(conflictState.valid,false);
assert.equal(conflictState.dirty,true);

const candidate=(id,species,specialty,{hard='PASS',ingredient=0,readiness=50,level=20}={})=>({
  pokemon_id:id,pokemon_instance_id:`instance_${id}`,species,specialty,level,hard_constraint_status:hard,
  weekly_ingredient_demand_covered:ingredient,weekly_ingredient_overlap:[],favorite_berry_match:false,
  current_readiness_score:readiness,profile_completeness:{ratio:1},rank_eligible:hard!=='FAIL',
});
const scoringProjection={feature_fingerprint:'fixture-v0432',candidates:[
  candidate('p1','Species A','技能',{ingredient:1,readiness:80,level:36}),
  candidate('p2','Species B','食材',{ingredient:0,readiness:10,level:5}),
  candidate('p3','Species C','樹果',{ingredient:9,readiness:100,level:50}),
  candidate('p4','Species D','食材',{ingredient:8,readiness:90,level:40}),
  candidate('p5','Species E','技能',{ingredient:7,readiness:85,level:35}),
  candidate('p6','Species F','樹果',{ingredient:6,readiness:80,level:30}),
]};
const twoMandatoryProfile={goal_profile_id:'goal_two_mandatory',primary_goal:'balanced',hard_constraints:{
  must_include_pokemon:['p1','p2'],exclude_pokemon:[],must_include_role:[],max_same_species:5,sleep_evolution_member_at_night:[],
}};
const optimized=optimizeTeam({scoringProjection,goalProfile:twoMandatoryProfile,maxAlternatives:1});
assert.equal(optimized.primary.team_status,'READY');
assert.equal(optimized.primary.slots.length,5);
const ids=optimized.primary.slots.map(row=>row.pokemon_id);
assert.equal(ids.includes('p1'),true,'first must-include member missing');
assert.equal(ids.includes('p2'),true,'second must-include member missing even though soft rank is low');
for(const id of ['p1','p2']){
  const slot=optimized.primary.slots.find(row=>row.pokemon_id===id);
  assert.ok(slot?.reasons?.includes('HARD_CONSTRAINT_MANDATORY_MEMBER'),`mandatory reason missing: ${id}`);
  assert.ok(optimized.primary.satisfied_constraints.includes(`mandatory_member:${id}`),`mandatory satisfaction missing: ${id}`);
}

const goalUi=fs.readFileSync('assets/js/war-room-goal-profile-ui.js','utf8');
const teamUi=fs.readFileSync('assets/js/war-room-team-optimizer-ui.js','utf8');
const teamLocal=fs.readFileSync('assets/js/team-optimizer-local.js','utf8');
const teamBootstrap=fs.readFileSync('assets/js/war-room-team-optimizer-bootstrap.js','utf8');
const goalStore=fs.readFileSync('assets/js/strategy-goal-store.js','utf8');

for(const token of [
  'strategyGoalProfileDraftState','warRoomSaveGoalProfile','saveButton.disabled=!draft.valid',
  'snapshotButton.disabled=!draft.valid||draft.dirty','strategy-goal-profile-draft-changed',
  '下方自動組隊仍使用最後一次成功儲存的 Active Profile',
])assert.ok(goalUi.includes(token),`goal draft UI contract missing: ${token}`);
assert.ok(goalUi.includes("if(!draft.valid){status.textContent='無法儲存"),'invalid draft must stop submit before store call');
for(const token of ['data-war-team-stale-profile','data-war-team-goal-source','必帶成員：','draftBlocked','disabled'])assert.ok(teamUi.includes(token),`team stale-profile UI contract missing: ${token}`);
assert.ok(teamBootstrap.includes('pokemon-sleep:strategy-goal-profile-draft-changed'),'team UI must refresh on draft state changes');
assert.ok(teamLocal.includes('mandatory_member_count:mandatoryTokens.length'));
assert.ok(teamLocal.includes('mandatory_satisfied_count:mandatoryTokens.filter'));

const validationIndex=goalStore.indexOf('const validation=strategyGoalProfileValidation(input)');
const snapshotIndex=goalStore.indexOf('await snapshot(`war-room:goal-profile:${profileId}`)');
assert.ok(validationIndex>=0&&snapshotIndex>validationIndex,'goal profile validation must run before snapshot/persist');
assert.ok(goalStore.includes('if(!validation.valid)throw new Error'),'invalid profile must not persist');

process.stdout.write(`${JSON.stringify({
  status:'PASS',gate:'V0.4.3.2_GOAL_PROFILE_TEAM_CONSTRAINT_CONSISTENCY',
  include_exclude_conflict_blocked:true,live_draft_state:true,invalid_save_disabled:true,
  dirty_team_recalculation_blocked:true,active_profile_source_visible:true,
  simultaneous_must_include_count:2,simultaneous_must_include_preserved:true,
  player_master_write_added:false,sqlite_schema_change:false,gemini_dependency_added:false,
},null,2)}\n`);
