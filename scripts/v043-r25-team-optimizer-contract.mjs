import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {optimizeTeam,TEAM_OPTIMIZER_VERSION,TEAM_SIZE,compareTeamCandidates} from '../assets/js/team-optimizer.js';
import {buildLocalTeamOptimization} from '../assets/js/team-optimizer-local.js';

const __filename=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(__filename),'..');

const candidate=(id,species,specialty,{level=20,hard='PASS',ingredient=0,berry=false,readiness=null,complete=1,overlap=[]}={})=>({
  pokemon_id:id,pokemon_instance_id:`instance_${id}`,species,level,specialty,hard_constraint_status:hard,
  weekly_ingredient_demand_covered:ingredient,weekly_ingredient_overlap:overlap,favorite_berry_match:berry,
  current_readiness_score:readiness,profile_completeness:{ratio:complete},rank_eligible:hard!=='FAIL',
});

const baseCandidates=[
  candidate('p1','仙子伊布','技能',{level:36,ingredient:2,readiness:80,complete:1}),
  candidate('p2','七夕青鳥','樹果',{level:32,ingredient:5,berry:true,readiness:60,complete:1,overlap:['特選蛋','萌綠大豆']}),
  candidate('p3','土王','食材',{level:31,ingredient:9,readiness:50,complete:1,overlap:['豆製肉','窩心洋芋']}),
  candidate('p4','小果然','技能',{level:12,ingredient:1,readiness:100,complete:1}),
  candidate('p5','小拳石','食材',{level:7,ingredient:4,readiness:40,complete:.9,overlap:['萌綠大豆']}),
  candidate('p6','六尾','樹果',{level:11,ingredient:3,berry:true,readiness:null,complete:1,overlap:['萌綠大豆']}),
  candidate('p7','六尾','樹果',{level:7,ingredient:2,berry:true,readiness:70,complete:1}),
  candidate('p8','巴大蝶','樹果',{level:30,ingredient:0,berry:false,readiness:90,complete:1}),
  candidate('p9','火爆獸','樹果',{level:34,ingredient:6,berry:true,readiness:55,complete:1,overlap:['火辣香草']}),
  candidate('p10','排除測試','食材',{level:50,ingredient:99,berry:true,readiness:100,complete:1,hard:'FAIL'}),
];

const scoringProjection={
  feature_fingerprint:'pokemon_features:fixture001',
  candidates:baseCandidates,
};
const goalProfile={
  goal_profile_id:'goal_fixture',
  primary_goal:'unlock_recipes',
  hard_constraints:{
    must_include_pokemon:['p1'],
    exclude_pokemon:['p10'],
    must_include_role:['食材','樹果','技能'],
    max_same_species:1,
    sleep_evolution_member_at_night:['p6'],
  },
};

assert.equal(TEAM_OPTIMIZER_VERSION,'team-optimizer-2026-08-09-a');
assert.equal(TEAM_SIZE,5);
assert.ok(compareTeamCandidates(baseCandidates[2],baseCandidates[0])<0,'ingredient demand coverage must outrank readiness after hard constraints');

const first=optimizeTeam({scoringProjection,goalProfile,maxAlternatives:2});
const second=optimizeTeam({scoringProjection,goalProfile,maxAlternatives:2});
assert.deepEqual(first,second,'same input must produce identical optimizer result');
assert.equal(first.primary.team_status,'READY');
assert.equal(first.primary.slots.length,5);
assert.equal(first.primary.slots[0].is_leader,true);
assert.equal(first.primary.slots[0].leader_semantics,'PRESENTATION_SLOT_ONLY_NO_VERIFIED_BONUS');
assert.ok(first.primary.slots.slice(1).every(row=>row.is_leader===false));
const ids=first.primary.slots.map(row=>row.pokemon_id);
assert.equal(new Set(ids).size,5,'team must not duplicate pokemon_id');
assert.equal(ids.includes('p1'),true,'mandatory Pokémon missing');
assert.equal(ids.includes('p6'),true,'night/evolution mandatory Pokémon missing');
assert.equal(ids.includes('p10'),false,'FAIL/excluded candidate entered team');
const roles=new Set(first.primary.slots.map(row=>row.specialty));
for(const required of ['食材','樹果','技能'])assert.equal(roles.has(required),true,`required role missing: ${required}`);
assert.ok(first.primary.satisfied_constraints.includes('mandatory_member:p1'));
assert.ok(first.primary.satisfied_constraints.includes('night_evolution_member:p6'));
assert.equal(first.primary.estimated_energy,null);
assert.equal(first.estimated_energy,null);
assert.equal(first.primary.player_data_write,false);
assert.equal(first.primary.gemini_used,false);
assert.ok(first.primary.warnings.includes('PRECISE_ENERGY_MODEL_NOT_ACTIVE'));
assert.ok(first.primary.warnings.includes('LEADER_IS_PRESENTATION_SLOT_ONLY_NO_VERIFIED_BONUS'));
assert.ok(first.primary.slots.every(row=>Array.isArray(row.reasons)&&row.reasons.length>0));
assert.ok(first.primary.recipe_coverage.covered_ingredient_names.length>0);
assert.equal(first.primary.recipe_coverage.numeric_energy_estimate,null);
assert.ok(first.alternatives.length>=1&&first.alternatives.length<=2,'optimizer should provide deterministic alternatives when pool permits');
for(const alternative of first.alternatives){
  assert.equal(alternative.team_status,'READY');
  assert.equal(alternative.slots.length,5);
  assert.equal(new Set(alternative.slots.map(row=>row.pokemon_id)).size,5);
  assert.equal(alternative.slots.some(row=>row.pokemon_id==='p10'),false);
}

const sameSpeciesCount=first.primary.slots.filter(row=>row.species==='六尾').length;
assert.equal(sameSpeciesCount,1,'max_same_species=1 must be enforced');

const blockedAmbiguous=optimizeTeam({
  scoringProjection,
  goalProfile:{...goalProfile,hard_constraints:{...goalProfile.hard_constraints,must_include_pokemon:['六尾'],sleep_evolution_member_at_night:[]}},
});
assert.equal(blockedAmbiguous.primary.team_status,'BLOCKED');
assert.ok(blockedAmbiguous.primary.missing_constraints.some(value=>value.startsWith('mandatory_member_ambiguous:六尾:')));

const blockedFail=optimizeTeam({
  scoringProjection,
  goalProfile:{...goalProfile,hard_constraints:{...goalProfile.hard_constraints,must_include_pokemon:['p10'],sleep_evolution_member_at_night:[]}},
});
assert.equal(blockedFail.primary.team_status,'BLOCKED');
assert.ok(blockedFail.primary.missing_constraints.some(value=>value.includes('p10')));

const incomplete=optimizeTeam({
  scoringProjection:{feature_fingerprint:'small',candidates:baseCandidates.slice(0,4)},
  goalProfile:{goal_profile_id:'small',hard_constraints:{must_include_pokemon:[],exclude_pokemon:[],must_include_role:[],max_same_species:5,sleep_evolution_member_at_night:[]}},
});
assert.equal(incomplete.primary.team_status,'INCOMPLETE');
assert.equal(incomplete.primary.slots.length,4);
assert.ok(incomplete.primary.missing_constraints.includes('team_size:4/5'));

const missingRole=optimizeTeam({
  scoringProjection:{feature_fingerprint:'role',candidates:baseCandidates.filter(row=>row.specialty!=='食材')},
  goalProfile:{goal_profile_id:'role',hard_constraints:{must_include_pokemon:[],exclude_pokemon:[],must_include_role:['食材'],max_same_species:5,sleep_evolution_member_at_night:[]}},
});
assert.equal(missingRole.primary.team_status,'INCOMPLETE');
assert.ok(missingRole.primary.missing_constraints.includes('required_role_missing:食材'));

// Local adapter must be import-safe and database-free before DB readiness.
const local=buildLocalTeamOptimization();
assert.equal(local.projection_status,'PLAYER_DATA_UNAVAILABLE');
assert.deepEqual([...local.missing_inputs],['player_database']);
assert.equal(local.player_data_write,false);
assert.equal(local.gemini_used,false);

const optimizerSource=fs.readFileSync(path.join(root,'assets/js/team-optimizer.js'),'utf8');
for(const forbidden of ['ai-project-pool-runtime','Gemini','fetch(','run(','persist(','snapshot(']){
  assert.equal(optimizerSource.includes(forbidden),false,`optimizer must remain pure/no provider or DB write: ${forbidden}`);
}
assert.equal(optimizerSource.includes('PRESENTATION_SLOT_ONLY_NO_VERIFIED_BONUS'),true);
assert.equal(optimizerSource.includes('PRECISE_ENERGY_MODEL_NOT_ACTIVE'),true);

process.stdout.write(`${JSON.stringify({
  status:'PASS',gate:'R2.5_DETERMINISTIC_FIVE_MEMBER_TEAM_OPTIMIZER',optimizer_version:TEAM_OPTIMIZER_VERSION,
  ready_team_slots:first.primary.slots.length,leader_presentation_only:true,mandatory_preserved:true,night_target_preserved:true,
  required_roles_satisfied:true,max_same_species_enforced:true,fail_candidate_excluded:true,alternatives:first.alternatives.length,
  deterministic_replay:true,ambiguous_mandatory_blocked:true,hard_fail_mandatory_blocked:true,incomplete_pool_detected:true,
  precise_energy_estimate:null,gemini_used:false,player_data_write:false,
},null,2)}\n`);
