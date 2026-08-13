import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BASE_BERRY_OUTPUT_CONTRACT_VERSION,
  BASE_BERRY_OUTPUT_CONTRACT_ID,
  BASE_BERRY_OUTPUT_AUTHORITY_STATUS,
  BASE_BERRY_OUTPUT_SCOPE,
  BERRY_SPECIALTY_BASE_OUTPUT,
  OTHER_SPECIALTY_BASE_OUTPUT,
  BERRY_FINDING_S_BONUS,
  expectedUnlockedSubskillSlotCount,
  hasUnlockedBerryFindingS,
  resolveBaseBerryOutputPerRegularBerryResultHelp,
  resolveCandidateBaseBerryOutput,
  currentBaseBerryOutputContract,
} from '../assets/js/base-berry-output-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildProductionEvidenceSnapshot,EVIDENCE_STATUS} from '../assets/js/production-evidence-registry.js';
import {projectMemberProductionEvidence,evaluateTeamObjective} from '../assets/js/team-objective-evaluator.js';
import {buildStrategyOptimizationPack} from '../assets/js/strategy-optimization-pack.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.equal(appVersion,'v0.4.22');
assert.ok(version.includes("// app_version: 'v0.4.21'"));
assert.equal(BASE_BERRY_OUTPUT_AUTHORITY_STATUS,'ACTIVE_VERIFIED');
assert.equal(BASE_BERRY_OUTPUT_SCOPE,'REGULAR_BERRY_RESULT_HELP_PRE_EVENT_PRE_EXPERT');
assert.equal(BERRY_SPECIALTY_BASE_OUTPUT,2);
assert.equal(OTHER_SPECIALTY_BASE_OUTPUT,1);
assert.equal(BERRY_FINDING_S_BONUS,1);
assert.ok(BASE_BERRY_OUTPUT_CONTRACT_ID.includes('2026-08-13'));
assert.ok(BASE_BERRY_OUTPUT_CONTRACT_VERSION.includes('2026-08-13'));

const contract=currentBaseBerryOutputContract();
assert.equal(contract.schema,'pokemon-sleep-base-berry-output-contract/1.0');
assert.equal(contract.authority_status,'ACTIVE_VERIFIED');
assert.equal(contract.formula.berry_specialty_base_output,2);
assert.equal(contract.formula.other_specialty_base_output,1);
assert.equal(contract.formula.unlocked_berry_finding_s_additive_bonus,1);
for(const excluded of ['EVENT_EXTRA_BERRY_MODIFIER','EXPERT_MODE_MAIN_FAVORITE_EXTRA_BERRY','DIRECT_MAIN_SKILL_BERRY_OUTPUT','BERRY_BURST_OR_EQUIVALENT_MAIN_SKILL_OUTPUT','INGREDIENT_RESULT_HELP'])assert.ok(contract.boundary.excluded_modifiers.includes(excluded));
assert.equal(contract.boundary.missing_is_zero,false);
assert.equal(contract.boundary.runtime_network_fetch,false);
assert.equal(contract.boundary.ai_numeric_authority,false);

assert.equal(expectedUnlockedSubskillSlotCount(1),0);
assert.equal(expectedUnlockedSubskillSlotCount(10),1);
assert.equal(expectedUnlockedSubskillSlotCount(25),2);
assert.equal(expectedUnlockedSubskillSlotCount(50),3);
assert.equal(expectedUnlockedSubskillSlotCount(70),3);
assert.equal(expectedUnlockedSubskillSlotCount(null),null);
assert.equal(hasUnlockedBerryFindingS([{subskill_name:'樹果數量S'}]),true);
assert.equal(hasUnlockedBerryFindingS([{subskill_name:'Berry Finding S'}]),true);
assert.equal(hasUnlockedBerryFindingS([{subskill_name:'幫忙速度M'}]),false);

const berryBase=resolveBaseBerryOutputPerRegularBerryResultHelp({specialty:'樹果',unlockedSubskills:[],subskillEvidenceComplete:true});
assert.deepEqual(berryBase,{status:'ACTIVE_VERIFIED',base_output:2,berry_finding_s_bonus:0,total_output:2,scope:BASE_BERRY_OUTPUT_SCOPE});
const berryBfs=resolveBaseBerryOutputPerRegularBerryResultHelp({specialty:'樹果',unlockedSubskills:[{subskill_name:'樹果數量S'}],subskillEvidenceComplete:true});
assert.equal(berryBfs.total_output,3);
assert.equal(berryBfs.berry_finding_s_bonus,1);
const skillBase=resolveBaseBerryOutputPerRegularBerryResultHelp({specialty:'技能',unlockedSubskills:[],subskillEvidenceComplete:true});
assert.equal(skillBase.base_output,1);assert.equal(skillBase.total_output,1);
const ingredientBfs=resolveBaseBerryOutputPerRegularBerryResultHelp({specialty:'食材',unlockedSubskills:[{subskill_name:'Berry Finding S'}],subskillEvidenceComplete:true});
assert.equal(ingredientBfs.base_output,1);assert.equal(ingredientBfs.total_output,2);
assert.equal(resolveBaseBerryOutputPerRegularBerryResultHelp({specialty:'未知',subskillEvidenceComplete:true}).status,'SPECIALTY_NOT_VERIFIED');
assert.equal(resolveBaseBerryOutputPerRegularBerryResultHelp({specialty:'樹果',subskillEvidenceComplete:false}).status,'SUBSKILL_EVIDENCE_INCOMPLETE');

const candidate=(n,{specialty='技能',level=30,bfs=false,type='火',favorite=true}={})=>({
  pokemon_id:`private-${n}`,species:`species-${n}`,specialty,level,type,helper_seconds:2200+n,favorite_berry_match:favorite,
  unlocked_subskill_slot_count:2,
  unlocked_subskills:bfs?[{unlock_level:10,subskill_name:'樹果數量S'},{unlock_level:25,subskill_name:'幫忙速度S'}]:[{unlock_level:10,subskill_name:'幫忙速度S'},{unlock_level:25,subskill_name:'持有上限提升S'}],
  unlocked_ingredients:[{unlock_level:1,ingredient_name:'火辣香草',quantity:2}],main_skill:'能量填充S',
});
const candidateFeatures={candidates:Array.from({length:75},(_,i)=>candidate(i+1,{specialty:i%3===0?'樹果':i%3===1?'食材':'技能',bfs:i%5===0,type:['火','水','電','草','龍'][i%5],favorite:i%2===0}))};
for(const row of candidateFeatures.candidates){const resolved=resolveCandidateBaseBerryOutput(row);assert.equal(resolved.status,'ACTIVE_VERIFIED');assert.ok([1,2,3].includes(resolved.total_output));}
const weeklyContext={favorite_berry_1:'蘋野果',favorite_berry_2:'橙橙果',favorite_berry_3:'番荔果'};
const registry=currentProductionAuthorityRegistry();
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.berry_output_per_help.status,'ACTIVE_VERIFIED');
assert.equal(registry.rules.berry_output_per_help.scope,BASE_BERRY_OUTPUT_SCOPE);
assert.deepEqual(registry.rules.berry_output_per_help.missing_inputs,[]);
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier']);
assert.deepEqual(registry.active_verified_structural_dimensions,['help_event_split']);

const snapshot=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext,productionRegistry:registry});
assert.equal(snapshot.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(snapshot.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(snapshot.summary.numeric_dimension_count,7);
assert.equal(snapshot.summary.active_numeric_dimension_count,3);
assert.equal(snapshot.summary.blocked_numeric_dimension_count,4);
assert.equal(snapshot.summary.base_berry_output_resolved_candidate_count,75);
assert.equal(snapshot.summary.berry_finding_s_candidate_count,15);
const outputRow=snapshot.rules.find(row=>row.dimension==='berry_output_per_help');
assert.equal(outputRow.authority_status,'ACTIVE_VERIFIED');
assert.equal(outputRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT);
assert.equal(outputRow.runtime_numeric_activation,true);
assert.equal(outputRow.coverage.observed_count,75);
assert.equal(outputRow.coverage.total_count,75);
assert.deepEqual(outputRow.blocking_reasons,[]);
assert.equal(JSON.stringify(snapshot).includes('private-1'),false,'private candidate ids must not enter Evidence snapshot');

const member=projectMemberProductionEvidence(candidateFeatures.candidates[0],{productionRegistry:registry});
assert.ok([1,2,3].includes(member.berry_output_per_regular_berry_result_help));
assert.equal(member.berry_output_per_help_status,'ACTIVE_VERIFIED');
assert.notEqual(member.favorite_adjusted_berry_energy_per_regular_berry_result_help,null);
assert.equal(member.berry_result_help_energy_status,'ACTIVE_VERIFIED_PARTIAL_COMPONENT');
assert.equal(member.berry_rate_status,'NOT_YET_VERIFIED','Berry/hour must remain blocked until Berry-vs-ingredient outcome probability is verified');
assert.equal(member.berry_energy_per_hour,null);

const team={team_id:'berry-output-partial',slots:candidateFeatures.candidates.slice(0,5).map(row=>({pokemon_id:row.pokemon_id}))};
const objective=evaluateTeamObjective({team,candidateFeatures,goalProfile:{primary_goal:'max_snorlax_energy'},productionRegistry:registry});
assert.equal(objective.objective_status,'NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(objective.objective_score,null);
assert.equal(objective.components.berry_energy_per_hour,null);

const contextPayload={context_fingerprint:'fixture-context',goal_profile:{primary_goal:'max_snorlax_energy'},weekly_context:weeklyContext,inventory_summary:[],recipe_gap_summary:[],deterministic_candidates:{},public_version_refs:{}};
const optimization=buildStrategyOptimizationPack({
  strategyContextResult:{payload:contextPayload,resolver:{cand_001:{pokemon_id:candidateFeatures.candidates[0].pokemon_id}}},
  candidateScoring:{candidates:[candidateFeatures.candidates[0]]},teamOptimization:{primary:{team_status:'READY',slots:[{pokemon_id:candidateFeatures.candidates[0].pokemon_id}]}},productionRegistry:registry,
});
assert.equal(optimization.status,'READY');
assert.equal(optimization.payload.candidate_production_readiness[0].rate_statuses.berry,'NOT_YET_VERIFIED','AI pack must not claim berry/hour from output quantity alone');

for(const file of ['assets/js/base-berry-output-contract.js','assets/js/production-authority-registry.js','assets/js/production-evidence-registry.js','assets/js/team-objective-evaluator.js']){
  const source=read(file);for(const forbidden of ['INSERT INTO','UPDATE pokemon','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden mutation/network path: ${forbidden}`);
}
const ui=read('assets/js/production-evidence-ui.js');
for(const token of ['G7.5 產能模型','進階 Evidence / JSON','evidence-rule-grid'])assert.ok(ui.includes(token));
const sw=read('service-worker.js');
assert.ok(sw.includes("'./assets/js/base-berry-output-contract.js'"),'first-offline precache missing base berry output contract');

console.log(JSON.stringify({
  status:'PASS',gate:'V0422_G75D_BASE_BERRY_OUTPUT_NUMERIC_AUTHORITY',app_version:appVersion,
  berry_specialty_base_output:2,other_specialty_base_output:1,berry_finding_s_bonus:1,
  base_berry_output_coverage:`${snapshot.summary.base_berry_output_resolved_candidate_count}/${snapshot.candidate_count}`,
  active_numeric_dimension_count:snapshot.summary.active_numeric_dimension_count,
  blocked_numeric_dimension_count:snapshot.summary.blocked_numeric_dimension_count,
  berry_energy_per_hour:null,overall_numeric_model_status:registry.numeric_rate_model_status,
  event_expert_skill_modifiers_isolated:true,ingredient_outcome_probability_still_required:true,
  player_write:false,sqlite_write:false,runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));
