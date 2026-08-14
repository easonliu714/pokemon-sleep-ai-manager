import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProductionEvidenceSnapshot,EVIDENCE_STATUS} from '../assets/js/production-evidence-registry.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.18','v0.4.19','v0.4.20','v0.4.21','v0.4.22','v0.4.22.1','v0.4.23','v0.4.24'].includes(appVersion),`unexpected G7.5 release/successor version ${appVersion}`);
if(appVersion!=='v0.4.18')assert.ok(version.includes("// app_version: 'v0.4.18'"),`${appVersion} must retain v0.4.18 lineage bridge`);
if(['v0.4.22.1','v0.4.23','v0.4.24'].includes(appVersion))assert.ok(version.includes("// app_version: 'v0.4.22'"),`${appVersion} must retain v0.4.22 lineage bridge`);
const berryStrengthSuccessor=['v0.4.19','v0.4.20','v0.4.21','v0.4.22','v0.4.22.1','v0.4.23','v0.4.24'].includes(appVersion);
const favoriteMultiplierSuccessor=['v0.4.20','v0.4.21','v0.4.22','v0.4.22.1','v0.4.23','v0.4.24'].includes(appVersion);
const helpSplitSuccessor=['v0.4.21','v0.4.22','v0.4.22.1','v0.4.23','v0.4.24'].includes(appVersion);
const baseOutputSuccessor=['v0.4.22','v0.4.22.1','v0.4.23','v0.4.24'].includes(appVersion);

const subskillEvidence=level=>{
  const count=level>=50?3:level>=25?2:level>=10?1:0;
  return {unlocked_subskill_slot_count:count,unlocked_subskills:[
    {unlock_level:10,subskill_name:'幫忙速度S'},
    {unlock_level:25,subskill_name:'持有上限提升S'},
    {unlock_level:50,subskill_name:'技能機率提升S'},
  ].slice(0,count)};
};
const candidate=(pokemon_id,type,level,main_skill,favorite_berry_match,ingredient,specialty)=>({pokemon_id,type,level,helper_seconds:2200,main_skill,favorite_berry_match,specialty,unlocked_ingredients:[{ingredient_name:ingredient,quantity:2}],...subskillEvidence(level)});
const candidateFeatures={candidates:[candidate('private-a','火',30,'能量填充S',true,'火辣香草','樹果'),candidate('private-b','水',40,'食材獲取S',true,'哞哞鮮奶','食材'),candidate('private-c','妖精',50,'活力全體療癒S',false,'甜甜蜜','技能')]};
const weeklyContext={favorite_berry_1:'蘋野果',favorite_berry_2:'橙橙果',favorite_berry_3:'桃桃果'};
const registry=currentProductionAuthorityRegistry();
const first=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext,productionRegistry:registry});
const second=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext,productionRegistry:registry});
assert.equal(first.numeric_rate_model_status,'NOT_YET_VERIFIED');assert.equal(first.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');assert.equal(first.summary.helper_seconds_observed_count,3);assert.equal(first.summary.type_to_berry_mapped_count,3);assert.equal(first.weekly_favorite_berry_count,3);
const expectedActive=baseOutputSuccessor?3:favoriteMultiplierSuccessor?2:berryStrengthSuccessor?1:0;
assert.equal(first.summary.active_numeric_dimension_count,expectedActive);assert.equal(first.summary.blocked_numeric_dimension_count,7-expectedActive);
if(berryStrengthSuccessor)assert.equal(first.summary.berry_strength_resolved_candidate_count,3);
if(favoriteMultiplierSuccessor)assert.equal(first.summary.favorite_berry_multiplier_resolved_candidate_count,3);
if(helpSplitSuccessor)assert.equal(first.summary.structural_verified_dimension_count,1);
if(baseOutputSuccessor)assert.equal(first.summary.base_berry_output_resolved_candidate_count,3);
assert.equal(first.evidence_fingerprint,second.evidence_fingerprint,'same evidence inputs must be deterministic');

const byDimension=new Map(first.rules.map(row=>[row.dimension,row]));
assert.equal(byDimension.get('helper_interval_seconds').evidence_status,EVIDENCE_STATUS.OBSERVED_INPUT_READY);assert.equal(byDimension.get('berry_identity_by_type').evidence_status,EVIDENCE_STATUS.LOCAL_PUBLIC_MASTER);
const berryStrengthRow=byDimension.get('berry_energy_per_berry');
if(berryStrengthSuccessor){assert.equal(berryStrengthRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_MASTER);assert.equal(berryStrengthRow.authority_status,'ACTIVE_VERIFIED');assert.equal(berryStrengthRow.runtime_numeric_activation,true);assert.equal(berryStrengthRow.coverage.observed_count,3);assert.equal(berryStrengthRow.coverage.total_count,3);assert.equal(berryStrengthRow.blocking_reasons.length,0);}else{assert.equal(berryStrengthRow.evidence_status,EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED);assert.ok(berryStrengthRow.blocking_reasons.includes('LOCAL_BERRY_STRENGTH_BY_LEVEL_MASTER_MISSING'));}
const favoriteRow=byDimension.get('favorite_berry_multiplier');
if(favoriteMultiplierSuccessor){assert.equal(favoriteRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT);assert.equal(favoriteRow.authority_status,'ACTIVE_VERIFIED');assert.equal(favoriteRow.runtime_numeric_activation,true);assert.equal(favoriteRow.coverage.observed_count,3);assert.equal(favoriteRow.blocking_reasons.length,0);}else{assert.equal(favoriteRow.evidence_status,EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED);assert.ok(favoriteRow.blocking_reasons.includes('LOCAL_FAVORITE_BERRY_MULTIPLIER_CONTRACT_MISSING'));}
if(helpSplitSuccessor){const splitRow=byDimension.get('help_event_split');assert.equal(splitRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_STRUCTURAL_CONTRACT);assert.equal(splitRow.authority_status,'ACTIVE_VERIFIED_STRUCTURAL');assert.equal(splitRow.runtime_numeric_activation,false);assert.deepEqual(splitRow.blocking_reasons,[]);}
const outputRow=byDimension.get('berry_output_per_help');
if(baseOutputSuccessor){assert.equal(outputRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT);assert.equal(outputRow.authority_status,'ACTIVE_VERIFIED');assert.equal(outputRow.runtime_numeric_activation,true);assert.equal(outputRow.coverage.observed_count,3);assert.deepEqual(outputRow.blocking_reasons,[]);}else if(helpSplitSuccessor){assert.deepEqual(outputRow.blocking_reasons,['BASE_BERRY_OUTPUT_PER_BERRY_RESULT_HELP_NUMERIC_CONTRACT_MISSING']);}
const ingredientRateRow=byDimension.get('ingredient_probability_per_help');
assert.equal(ingredientRateRow.runtime_numeric_activation,false);
assert.equal(ingredientRateRow.coverage.observed_count,0);
assert.ok([EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER,EVIDENCE_STATUS.REFERENCE_COMMUNITY_NUMERIC_EVIDENCE].includes(ingredientRateRow.evidence_status));
assert.ok(ingredientRateRow.blocking_reasons.includes('SPECIES_BASE_INGREDIENT_RATE_LOCAL_MASTER_MISSING')||ingredientRateRow.blocking_reasons.includes('SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED'),'ingredient rate must remain fail-closed whether no reference exists or a reference-only boundary exists');
if(ingredientRateRow.blocking_reasons.includes('SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED')){
  const referenceRow=byDimension.get('species_base_ingredient_rate_reference');
  assert.ok(referenceRow,'reference-only successor must expose a separate species rate Evidence row');
  assert.equal(referenceRow.authority_status,'REFERENCE_ONLY_COMMUNITY_DERIVED');
  assert.equal(referenceRow.runtime_numeric_activation,false);
  assert.ok(referenceRow.blocking_reasons.includes('REFERENCE_ONLY_NOT_ACTIVATION_AUTHORITY'));
}
assert.equal(byDimension.get('main_skill_trigger_probability').evidence_status,EVIDENCE_STATUS.BLOCKED_DYNAMIC_RULE);for(const blocker of ['SPECIES_BASE_SKILL_TRIGGER_RATE_LOCAL_MASTER_MISSING','DAILY_TRIGGER_COUNT_DYNAMIC_RULE','WEEKLY_EVENT_TRIGGER_MULTIPLIER_MUST_BE_APPLIED'])assert.ok(byDimension.get('main_skill_trigger_probability').blocking_reasons.includes(blocker));assert.equal(byDimension.get('main_skill_effect_value').evidence_status,EVIDENCE_STATUS.REFERENCE_EFFECT_TEXT_ONLY);
for(const key of ['missing_is_zero','player_data_write','sqlite_write','runtime_network_fetch','ai_numeric_authority'])assert.equal(first.safety[key],false);assert.equal(first.privacy_manifest.stable_pokemon_ids_in_payload,false);assert.equal(JSON.stringify(first).includes('private-a'),false,'stable/private pokemon ids must not enter evidence snapshot');

const incomplete=buildProductionEvidenceSnapshot({candidateFeatures:{candidates:[{type:'火',level:null,helper_seconds:null,main_skill:'UNKNOWN',unlocked_ingredients:[],specialty:null,unlocked_subskill_slot_count:0,unlocked_subskills:[]}]},weeklyContext:{},productionRegistry:registry});
assert.equal(incomplete.rules.find(row=>row.dimension==='helper_interval_seconds').coverage.observed_count,0);assert.ok(incomplete.rules.find(row=>row.dimension==='helper_interval_seconds').blocking_reasons.includes('INCOMPLETE_PLAYER_HELPER_SECONDS'));
if(berryStrengthSuccessor){const incompleteBerry=incomplete.rules.find(row=>row.dimension==='berry_energy_per_berry');assert.equal(incompleteBerry.coverage.observed_count,0);assert.ok(incompleteBerry.blocking_reasons.includes('INCOMPLETE_BERRY_STRENGTH_INPUT_COVERAGE'));}
if(favoriteMultiplierSuccessor){const incompleteFavorite=incomplete.rules.find(row=>row.dimension==='favorite_berry_multiplier');assert.equal(incompleteFavorite.coverage.observed_count,0);assert.ok(incompleteFavorite.blocking_reasons.includes('INCOMPLETE_FAVORITE_BERRY_MULTIPLIER_INPUT_COVERAGE'));}
if(baseOutputSuccessor){const incompleteOutput=incomplete.rules.find(row=>row.dimension==='berry_output_per_help');assert.equal(incompleteOutput.coverage.observed_count,0);assert.ok(incompleteOutput.blocking_reasons.includes('INCOMPLETE_BASE_BERRY_OUTPUT_INPUT_COVERAGE'));}
assert.equal(incomplete.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');

const ui=read('assets/js/production-evidence-ui.js');
if(['v0.4.21','v0.4.22','v0.4.22.1','v0.4.23','v0.4.24'].includes(appVersion))for(const token of ['G7.5 產能模型','重新計算','複製 Evidence JSON','進階 Evidence / JSON','事件分流'])assert.ok(ui.includes(token),`compact G7.5 UI token missing ${token}`);else{for(const token of ['G7.5 Production Model Evidence Gate','重新檢查 Evidence','複製 Evidence JSON','缺值不等於 0'])assert.ok(ui.includes(token),`G7.5 UI token missing ${token}`);assert.ok(berryStrengthSuccessor?ui.includes('局部 ACTIVE_VERIFIED ≠ 完整 Production Model 已啟用'):ui.includes('Evidence identified ≠ ACTIVE_VERIFIED'));}
const local=read('assets/js/strategy-context-local.js');assert.ok(local.includes('buildLocalProductionEvidenceSnapshot'));const warroom=read('assets/js/war-room-strategy-context-ui.js');assert.ok(warroom.includes('renderProductionEvidencePanel(root)'));const sw=read('service-worker.js');for(const asset of ['./assets/js/production-evidence-registry.js','./assets/js/production-evidence-ui.js'])assert.ok(sw.includes(`'${asset}'`),`first-offline precache missing ${asset}`);for(const file of ['assets/js/production-evidence-registry.js','assets/js/production-evidence-ui.js']){const source=read(file);for(const forbidden of ['INSERT INTO','UPDATE pokemon','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden mutation/network path`);}

console.log(JSON.stringify({status:'PASS',gate:'V0418_G75_PRODUCTION_EVIDENCE_ACTIVATION_SUCCESSOR_AWARE',app_version:appVersion,numeric_rate_model_status:first.numeric_rate_model_status,activation_decision:first.activation_decision,active_numeric_dimension_count:first.summary.active_numeric_dimension_count,helper_observed:true,type_to_berry_local_master:true,berry_strength_active_verified:berryStrengthSuccessor,favorite_multiplier_active_verified:favoriteMultiplierSuccessor,help_event_split_structural_verified:helpSplitSuccessor,base_berry_output_active_verified:baseOutputSuccessor,ingredient_rate_fail_closed:true,ingredient_reference_boundary_supported:true,skill_trigger_dynamic_blocked:true,missing_is_zero:false,player_write:false,runtime_network_fetch:false,ai_numeric_authority:false,mobile_evidence_ui:true},null,2));