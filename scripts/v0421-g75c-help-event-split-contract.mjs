import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  HELP_EVENT_SPLIT_CONTRACT_VERSION,
  HELP_EVENT_SPLIT_CONTRACT_ID,
  HELP_EVENT_SPLIT_AUTHORITY_STATUS,
  BASE_BERRY_OUTPUT_NUMERIC_STATUS,
  HELP_EVENT_KIND,
  HELP_EVENT_SPLIT_BOUNDARY,
  helpEventSplitDefinition,
  isBaseBerryOutputScopedHelp,
  currentHelpEventSplitContract,
} from '../assets/js/help-event-split-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildProductionEvidenceSnapshot,EVIDENCE_STATUS} from '../assets/js/production-evidence-registry.js';
import {projectMemberProductionEvidence,evaluateTeamObjective} from '../assets/js/team-objective-evaluator.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.equal(appVersion,'v0.4.21');
assert.ok(version.includes("// app_version: 'v0.4.20'"));
assert.equal(HELP_EVENT_SPLIT_AUTHORITY_STATUS,'ACTIVE_VERIFIED_STRUCTURAL');
assert.equal(BASE_BERRY_OUTPUT_NUMERIC_STATUS,'NOT_YET_VERIFIED');
assert.ok(HELP_EVENT_SPLIT_CONTRACT_ID.includes('2026-08-13'));
assert.ok(HELP_EVENT_SPLIT_CONTRACT_VERSION.includes('2026-08-13'));

const contract=currentHelpEventSplitContract();
assert.equal(contract.schema,'pokemon-sleep-help-event-split-contract/1.0');
assert.equal(contract.authority_status,'ACTIVE_VERIFIED_STRUCTURAL');
assert.equal(contract.base_numeric_berry_output_status,'NOT_YET_VERIFIED');
assert.equal(contract.definitions.length,6);

const regularBerry=helpEventSplitDefinition(HELP_EVENT_KIND.REGULAR_HELP_BERRY_RESULT);
assert.equal(regularBerry.base_berry_output_relation,'DIRECT_SCOPE');
assert.equal(regularBerry.base_numeric_quantity_status,'NOT_YET_VERIFIED');
assert.equal(isBaseBerryOutputScopedHelp(HELP_EVENT_KIND.REGULAR_HELP_BERRY_RESULT),true);
const ingredient=helpEventSplitDefinition(HELP_EVENT_KIND.REGULAR_HELP_INGREDIENT_RESULT);
assert.equal(ingredient.base_berry_output_relation,'OUT_OF_SCOPE_NON_BERRY_RESULT');
assert.equal(isBaseBerryOutputScopedHelp(HELP_EVENT_KIND.REGULAR_HELP_INGREDIENT_RESULT),false);
const directSkill=helpEventSplitDefinition(HELP_EVENT_KIND.DIRECT_MAIN_SKILL_BERRY_OUTPUT);
assert.equal(directSkill.base_berry_output_relation,'OUT_OF_SCOPE_DIRECT_SKILL_EFFECT');
assert.equal(directSkill.direct_main_skill_berry_output,true);
const generatedHelp=helpEventSplitDefinition(HELP_EVENT_KIND.MAIN_SKILL_GENERATED_HELP);
assert.equal(generatedHelp.base_berry_output_relation,'APPLIES_ONLY_IF_GENERATED_HELP_RESOLVES_TO_BERRY_RESULT');
assert.equal(generatedHelp.direct_main_skill_berry_output,false);
const eventExtra=helpEventSplitDefinition(HELP_EVENT_KIND.EVENT_EXTRA_BERRY_MODIFIER);
assert.equal(eventExtra.base_berry_output_relation,'OUT_OF_SCOPE_EVENT_MODIFIER');
assert.equal(eventExtra.modifier_only,true);
const expertFrequency=helpEventSplitDefinition(HELP_EVENT_KIND.EXPERT_HELP_FREQUENCY_MODIFIER);
assert.equal(expertFrequency.base_berry_output_relation,'OUT_OF_SCOPE_FREQUENCY_MODIFIER');
assert.equal(expertFrequency.modifier_only,true);
assert.equal(helpEventSplitDefinition('UNKNOWN'),null);
assert.equal(HELP_EVENT_SPLIT_BOUNDARY.missing_is_zero,false);
assert.equal(HELP_EVENT_SPLIT_BOUNDARY.runtime_network_fetch,false);
assert.equal(HELP_EVENT_SPLIT_BOUNDARY.ai_numeric_authority,false);

const registry=currentProductionAuthorityRegistry();
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.help_event_split.status,'ACTIVE_VERIFIED_STRUCTURAL');
assert.equal(registry.rules.help_event_split.scope,'STRUCTURAL_ONLY');
assert.equal(registry.rules.berry_output_per_help.status,'NOT_YET_VERIFIED');
assert.deepEqual(registry.rules.berry_output_per_help.missing_inputs,['verified_base_berry_output_per_berry_result_help_rule']);
assert.deepEqual(registry.active_verified_dimensions,['berry_energy_per_berry','favorite_berry_multiplier']);
assert.deepEqual(registry.active_verified_structural_dimensions,['help_event_split']);

const candidateFeatures={candidates:[
  {pokemon_id:'private-fire',type:'火',level:30,helper_seconds:2100,main_skill:'能量填充S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'火辣香草',quantity:2}]},
  {pokemon_id:'private-water',type:'水',level:60,helper_seconds:2200,main_skill:'食材獲取S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'哞哞鮮奶',quantity:2}]},
  {pokemon_id:'private-electric',type:'電',level:70,helper_seconds:2300,main_skill:'活力全體療癒S',favorite_berry_match:false,unlocked_ingredients:[{ingredient_name:'甜甜蜜',quantity:2}]},
]};
const weeklyContext={favorite_berry_1:'蘋野果',favorite_berry_2:'橙橙果',favorite_berry_3:'番荔果'};
const snapshot=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext,productionRegistry:registry});
assert.equal(snapshot.schema,'pokemon-sleep-production-evidence-snapshot/1.2');
assert.equal(snapshot.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(snapshot.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(snapshot.summary.rule_count,11);
assert.equal(snapshot.summary.numeric_dimension_count,7);
assert.equal(snapshot.summary.active_numeric_dimension_count,2);
assert.equal(snapshot.summary.blocked_numeric_dimension_count,5);
assert.equal(snapshot.summary.structural_verified_dimension_count,1);
const splitRow=snapshot.rules.find(row=>row.dimension==='help_event_split');
assert.equal(splitRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_STRUCTURAL_CONTRACT);
assert.equal(splitRow.authority_status,'ACTIVE_VERIFIED_STRUCTURAL');
assert.equal(splitRow.coverage.observed_count,1);
assert.equal(splitRow.coverage.total_count,1);
assert.deepEqual(splitRow.blocking_reasons,[]);
const berryOutputRow=snapshot.rules.find(row=>row.dimension==='berry_output_per_help');
assert.equal(berryOutputRow.authority_status,'NOT_YET_VERIFIED');
assert.equal(berryOutputRow.runtime_numeric_activation,false);
assert.deepEqual(berryOutputRow.blocking_reasons,['BASE_BERRY_OUTPUT_PER_BERRY_RESULT_HELP_NUMERIC_CONTRACT_MISSING']);
assert.equal(berryOutputRow.blocking_reasons.includes('HELP_EVENT_SPLIT_NOT_YET_GOVERNED'),false);
assert.equal(JSON.stringify(snapshot).includes('private-fire'),false,'private candidate id must not enter evidence snapshot');

const member=projectMemberProductionEvidence({pokemon_id:'p-fire',type:'火',level:30,helper_seconds:2100,favorite_berry_match:true,unlocked_ingredients:[]},{productionRegistry:registry});
assert.equal(member.berry_energy_per_berry,56);
assert.equal(member.favorite_berry_multiplier,2);
assert.equal(member.favorite_adjusted_berry_energy_per_berry,112);
assert.equal(member.berry_rate_status,'NOT_YET_VERIFIED');
assert.equal(member.berry_energy_per_hour,null);
const team={team_id:'split-governed-rate-blocked',slots:[{pokemon_id:'p1'},{pokemon_id:'p2'},{pokemon_id:'p3'},{pokemon_id:'p4'},{pokemon_id:'p5'}]};
const teamFeatures={candidates:[1,2,3,4,5].map((n,index)=>({pokemon_id:`p${n}`,type:['火','水','電','草','龍'][index],level:30,helper_seconds:2200+index*50,favorite_berry_match:index<2,unlocked_ingredients:[]}))};
const objective=evaluateTeamObjective({team,candidateFeatures:teamFeatures,goalProfile:{primary_goal:'max_snorlax_energy'},productionRegistry:registry});
assert.equal(objective.objective_status,'NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(objective.objective_score,null);
assert.equal(objective.components.berry_energy_per_hour,null);

const ui=read('assets/js/production-evidence-ui.js');
for(const token of ['G7.5 產能模型','evidence-metric-grid','已啟用數值','待補數值','事件分流','進階 Evidence / JSON','完整 Snapshot JSON'])assert.ok(ui.includes(token),`compact decision UI token missing ${token}`);
assert.equal(ui.includes('安全邊界：</b>局部 ACTIVE_VERIFIED'),false,'long safety paragraph must not remain in default result UI');
assert.ok(ui.indexOf('進階 Evidence / JSON')<ui.indexOf('Evidence · <code>'),'verbose Evidence/Authority should live behind advanced details');

for(const file of ['assets/js/help-event-split-contract.js','assets/js/production-authority-registry.js','assets/js/production-evidence-registry.js']){
  const source=read(file);for(const forbidden of ['INSERT INTO','UPDATE pokemon','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden mutation/network path: ${forbidden}`);
}
const sw=read('service-worker.js');
assert.ok(sw.includes("'./assets/js/help-event-split-contract.js'"),'first-offline precache missing help event split contract');

console.log(JSON.stringify({
  status:'PASS',gate:'V0421_G75C_HELP_EVENT_SPLIT_GOVERNANCE',app_version:appVersion,
  help_event_split_status:registry.rules.help_event_split.status,
  berry_output_numeric_status:registry.rules.berry_output_per_help.status,
  remaining_berry_output_blocker:berryOutputRow.blocking_reasons[0],
  active_numeric_dimension_count:snapshot.summary.active_numeric_dimension_count,
  blocked_numeric_dimension_count:snapshot.summary.blocked_numeric_dimension_count,
  structural_verified_dimension_count:snapshot.summary.structural_verified_dimension_count,
  berry_energy_per_hour:null,overall_numeric_model_status:registry.numeric_rate_model_status,
  compact_decision_ui:true,verbose_evidence_collapsed:true,
  player_write:false,sqlite_write:false,runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));
