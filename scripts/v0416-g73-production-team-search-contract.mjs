import assert from 'node:assert/strict';
import fs from 'node:fs';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {evaluateTeamObjective} from '../assets/js/team-objective-evaluator.js';
import {searchTeamsBounded} from '../assets/js/bounded-team-search.js';
import {buildStrategyOptimizationPack} from '../assets/js/strategy-optimization-pack.js';
import {buildExternalOptimizationPrompt,normalizeOptimizationAiResponse} from '../assets/js/strategy-optimization-ai-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.15','v0.4.16','v0.4.17','v0.4.17.1','v0.4.18','v0.4.19','v0.4.20'].includes(appVersion),`unexpected G7.3 staging/release/successor version ${appVersion}`);
if(['v0.4.17','v0.4.17.1','v0.4.18','v0.4.19','v0.4.20'].includes(appVersion))assert.ok(version.includes("// app_version: 'v0.4.16'"),`${appVersion} must retain v0.4.16 lineage bridge`);

const registry=currentProductionAuthorityRegistry();
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.helper_interval_seconds.status,'OBSERVED_INPUT');
assert.equal(registry.rules.berry_energy_per_berry.status,['v0.4.19','v0.4.20'].includes(appVersion)?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED');
if(appVersion==='v0.4.20')assert.equal(registry.rules.favorite_berry_multiplier.status,'ACTIVE_VERIFIED');
for(const key of ['berry_output_per_help','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'])assert.equal(registry.rules[key].status,'NOT_YET_VERIFIED');

const features={input_fingerprint:'features:g73',candidates:Array.from({length:5},(_,index)=>({
  pokemon_id:`p${index+1}`,species:`S${index+1}`,level:30,specialty:index===0?'樹果':'食材',helper_seconds:2500+index*100,favorite_berry_match:index===0,
  main_skill:'能量填充S',main_skill_level:3,unlocked_ingredients:[{unlock_level:1,ingredient_name:`I${index+1}`,quantity:2}],
}))};
const team={team_id:'team:g73',slots:features.candidates.map((row,index)=>({slot_index:index,pokemon_id:row.pokemon_id}))};
const objective=evaluateTeamObjective({team,candidateFeatures:features,goalProfile:{primary_goal:'max_snorlax_energy'},productionRegistry:registry});
assert.equal(objective.objective_status,'NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(objective.objective_score,null);
assert.equal(objective.total_goal_value,null);
assert.equal(objective.verified_partial_goal_value,null);
assert.ok(objective.missing_inputs.includes('berry_energy_per_hour:NOT_YET_VERIFIED'));
assert.ok(objective.members.every(row=>row.berry_energy_per_hour===null&&row.ingredient_per_hour_by_name===null&&row.skill_energy_per_hour===null));

const candidates=[
  {pokemon_id:'A',species:'SA',specialty:'樹果',hard_constraint_status:'PASS',test_score:10},
  {pokemon_id:'B',species:'SB',specialty:'食材',hard_constraint_status:'PASS',test_score:10},
  {pokemon_id:'C',species:'SC',specialty:'技能',hard_constraint_status:'PASS',test_score:10},
  {pokemon_id:'D',species:'SD',specialty:'食材',hard_constraint_status:'PASS',test_score:10},
  {pokemon_id:'E',species:'SE',specialty:'樹果',hard_constraint_status:'PASS',test_score:1},
  {pokemon_id:'F',species:'SF',specialty:'樹果',hard_constraint_status:'PASS',test_score:20},
  {pokemon_id:'X',species:'SX',specialty:'樹果',hard_constraint_status:'PASS',test_score:100},
];
const constraints={must_include_pokemon:['A'],exclude_pokemon:['X'],preserve_current_team_slots:[1],max_same_species:1};
const evaluator=(rows,ids)=>({objective_score:rows.reduce((sum,row)=>sum+row.test_score,0),objective_status:'ACTIVE_VERIFIED',input_fingerprint:`synthetic:${ids.join('-')}`});
const searchInput={candidateRows:candidates,seedTeamIds:['A','B','C','D','E'],hardConstraints:constraints,budget:{candidate_pool_limit:7,beam_width:6,max_team_evaluations:64,top_k:3,max_replacement_depth:2},evaluateTeam:evaluator};
const search=searchTeamsBounded(searchInput),searchAgain=searchTeamsBounded(searchInput);
assert.equal(search.search_status,'READY');
assert.ok(search.top_teams.length>0);
assert.ok(search.top_teams[0].team_ids.includes('A'));
assert.ok(search.top_teams[0].team_ids.includes('F'),'bounded replacement search should discover stronger legal replacement');
assert.ok(!search.top_teams[0].team_ids.includes('X'),'excluded member must never enter result');
assert.equal(search.top_teams[0].team_ids[0],'A','preserved slot 1 must remain unchanged');
assert.equal(search.global_optimum_claimed,false);
assert.equal(searchAgain.input_fingerprint,search.input_fingerprint,'same search inputs and budget must produce same fingerprint');
const tiny=searchTeamsBounded({...searchInput,budget:{candidate_pool_limit:7,beam_width:2,max_team_evaluations:2,top_k:1,max_replacement_depth:3}});
assert.equal(tiny.stop_reason,'BEST_FOUND_UNDER_BUDGET');
assert.equal(tiny.global_optimum_claimed,false);

const resolver={cand_001:{pokemon_id:'p1',species:'S1'},cand_002:{pokemon_id:'p2',species:'S2'},cand_003:{pokemon_id:'p3',species:'S3'},cand_004:{pokemon_id:'p4',species:'S4'},cand_005:{pokemon_id:'p5',species:'S5'}};
const contextResult={
  payload:{context_fingerprint:'strategy_context:g73',goal_profile:{primary_goal:'max_snorlax_energy',hard_constraints:{must_include:{candidate_refs:['cand_001'],species:[]},exclude:{candidate_refs:[],species:[]}}},weekly_context:{week_start:'2026-08-10',dish_category:'咖哩／濃湯'},inventory_summary:[{ingredient_name:'I1',quantity:20,safe_reserve:5,usable:15}],recipe_gap_summary:[{recipe_id:'r1',recipe_name:'料理1',total_strategy_shortage:5}],deterministic_candidates:{feature_fingerprint:'features:g73'},public_version_refs:{}},resolver,
};
const teamOptimization={primary:{team_status:'READY',team_id:'team:g73',input_fingerprint:'team:g73fp',slots:features.candidates.map(row=>({pokemon_id:row.pokemon_id}))}};
const pack=buildStrategyOptimizationPack({strategyContextResult:contextResult,candidateScoring:features,teamOptimization,productionRegistry:registry,searchBudget:{max_team_evaluations:48,beam_width:6,top_k:3}});
assert.equal(pack.status,'READY');
assert.equal(pack.payload.schema,'pokemon-sleep-strategy-optimization-pack/2.0');
assert.deepEqual(pack.payload.seed_team.candidate_refs,['cand_001','cand_002','cand_003','cand_004','cand_005']);
assert.equal(pack.payload.production_authority.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(pack.payload.search_policy.global_optimum_claimed,false);
assert.equal(pack.payload.search_policy.ai_proposal_requires_deterministic_re_evaluation,true);
const serialized=JSON.stringify(pack.payload);
for(const privateId of ['"p1"','"p2"','"p3"','"p4"','"p5"'])assert.equal(serialized.includes(privateId),false,`stable pokemon id leaked into optimization payload: ${privateId}`);
assert.equal(pack.privacy_manifest.raw_sqlite_in_payload,false);
assert.equal(pack.privacy_manifest.api_key_in_payload,false);
const prompt=buildExternalOptimizationPrompt(pack.payload);
assert.ok(prompt.includes('candidate_ref'));
assert.ok(prompt.includes('NOT_YET_VERIFIED'));
assert.ok(prompt.includes('deterministic evaluator'));

const normalized=normalizeOptimizationAiResponse({strategy_summary:'測試',team_proposals:[{candidate_refs:['cand_001','cand_002','cand_003','cand_004','cand_005'],target_recipe_ids:['r1'],rationale:'候選',expected_tradeoff:'測試'},{candidate_refs:['cand_001','cand_002','cand_003','cand_004','cand_999'],target_recipe_ids:['r999'],rationale:'無效',expected_tradeoff:'無效'}],warnings:[],missing_inputs:['production rates']},{validCandidateRefs:Object.keys(resolver),validRecipeIds:['r1']});
assert.equal(normalized.team_proposals.length,1);
assert.equal(normalized.team_proposals[0].deterministic_re_evaluation_required,true);
assert.equal(normalized.team_proposals[0].apply_allowed,false);
assert.equal(normalized.numeric_authority,false);
assert.ok(normalized.rejected_refs.candidate_refs.includes('cand_999'));

for(const file of ['assets/js/production-authority-registry.js','assets/js/team-objective-evaluator.js','assets/js/bounded-team-search.js']){
  const source=read(file);for(const forbidden of ['INSERT INTO','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden mutation/network path`);
}
const ui=read('assets/js/war-room-strategy-context-ui.js');
assert.ok(ui.includes('G7.3 隊伍最佳化 Strategy Pack')||ui.includes('G7.4 隊伍最佳化 Strategy Pack'),'G7.3 successor UI heading missing');
for(const token of ['建立最佳化分析包','複製外部 AI 提示詞','deterministic re-evaluate'])assert.ok(ui.includes(token),`G7.3 UI token missing ${token}`);
const local=read('assets/js/strategy-context-local.js');
for(const token of ['buildLocalOptimizationStrategyPreview','production_rate_model:NOT_YET_VERIFIED','HOLD_NUMERIC_MODEL_NOT_ACTIVE'])assert.ok(local.includes(token),`G7.3 local token missing ${token}`);
const sw=read('service-worker.js');
for(const asset of ['./assets/js/production-authority-registry.js','./assets/js/team-objective-evaluator.js','./assets/js/bounded-team-search.js','./assets/js/strategy-optimization-pack.js','./assets/js/strategy-optimization-ai-contract.js','./assets/js/v0416-g73-ui.js'])assert.ok(sw.includes(`'${asset}'`),`first-offline precache missing ${asset}`);

console.log(JSON.stringify({status:'PASS',gate:'V0416_G73_PRODUCTION_TEAM_SEARCH_CONTRACT_SUCCESSOR_AWARE',app_version:appVersion,production_rate_model_status:registry.numeric_rate_model_status,numeric_objective_blocked_without_verified_rates:true,bounded_search_deterministic:true,hard_constraints_preserved:true,budget_stop_returns_best_found:true,global_optimum_claimed:false,optimization_pack_v2:true,stable_ids_in_payload:false,external_ai_prompt:true,ai_numeric_authority:false,deterministic_re_evaluation_required:true},null,2));
