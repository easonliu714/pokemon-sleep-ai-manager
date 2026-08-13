import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProductionEvidenceSnapshot,EVIDENCE_STATUS} from '../assets/js/production-evidence-registry.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.18','v0.4.19','v0.4.20'].includes(appVersion),`unexpected G7.5 release/successor version ${appVersion}`);
if(appVersion!=='v0.4.18')assert.ok(version.includes("// app_version: 'v0.4.18'"),`${appVersion} must retain v0.4.18 lineage bridge`);
const berryStrengthSuccessor=['v0.4.19','v0.4.20'].includes(appVersion);
const favoriteMultiplierSuccessor=appVersion==='v0.4.20';

const candidateFeatures={candidates:[
  {pokemon_id:'private-a',type:'火',level:30,helper_seconds:2100,main_skill:'能量填充S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'火辣香草',quantity:2}]},
  {pokemon_id:'private-b',type:'水',level:40,helper_seconds:2200,main_skill:'食材獲取S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'哞哞鮮奶',quantity:2}]},
  {pokemon_id:'private-c',type:'妖精',level:50,helper_seconds:2300,main_skill:'活力全體療癒S',favorite_berry_match:false,unlocked_ingredients:[{ingredient_name:'甜甜蜜',quantity:2}]},
]};
const weeklyContext={favorite_berry_1:'蘋野果',favorite_berry_2:'橙橙果',favorite_berry_3:'桃桃果'};
const registry=currentProductionAuthorityRegistry();
const first=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext,productionRegistry:registry});
const second=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext,productionRegistry:registry});
assert.equal(first.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(first.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(first.summary.helper_seconds_observed_count,3);
assert.equal(first.summary.type_to_berry_mapped_count,3);
assert.equal(first.weekly_favorite_berry_count,3);
const expectedActive=favoriteMultiplierSuccessor?2:berryStrengthSuccessor?1:0;
assert.equal(first.summary.active_numeric_dimension_count,expectedActive);
assert.equal(first.summary.blocked_numeric_dimension_count,7-expectedActive);
if(berryStrengthSuccessor)assert.equal(first.summary.berry_strength_resolved_candidate_count,3);
if(favoriteMultiplierSuccessor)assert.equal(first.summary.favorite_berry_multiplier_resolved_candidate_count,3);
assert.equal(first.evidence_fingerprint,second.evidence_fingerprint,'same evidence inputs must be deterministic');

const byDimension=new Map(first.rules.map(row=>[row.dimension,row]));
assert.equal(byDimension.get('helper_interval_seconds').evidence_status,EVIDENCE_STATUS.OBSERVED_INPUT_READY);
assert.equal(byDimension.get('berry_identity_by_type').evidence_status,EVIDENCE_STATUS.LOCAL_PUBLIC_MASTER);
const berryStrengthRow=byDimension.get('berry_energy_per_berry');
if(berryStrengthSuccessor){
  assert.equal(berryStrengthRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_MASTER);
  assert.equal(berryStrengthRow.authority_status,'ACTIVE_VERIFIED');
  assert.equal(berryStrengthRow.runtime_numeric_activation,true);
  assert.equal(berryStrengthRow.coverage.observed_count,3);
  assert.equal(berryStrengthRow.coverage.total_count,3);
  assert.equal(berryStrengthRow.blocking_reasons.length,0);
}else{
  assert.equal(berryStrengthRow.evidence_status,EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED);
  assert.ok(berryStrengthRow.blocking_reasons.includes('LOCAL_BERRY_STRENGTH_BY_LEVEL_MASTER_MISSING'));
}
const favoriteRow=byDimension.get('favorite_berry_multiplier');
if(favoriteMultiplierSuccessor){
  assert.equal(favoriteRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT);
  assert.equal(favoriteRow.authority_status,'ACTIVE_VERIFIED');
  assert.equal(favoriteRow.runtime_numeric_activation,true);
  assert.equal(favoriteRow.coverage.observed_count,3);
  assert.equal(favoriteRow.blocking_reasons.length,0);
}else{
  assert.equal(favoriteRow.evidence_status,EVIDENCE_STATUS.REFERENCE_EVIDENCE_IDENTIFIED);
  assert.ok(favoriteRow.blocking_reasons.includes('LOCAL_FAVORITE_BERRY_MULTIPLIER_CONTRACT_MISSING'));
}
assert.equal(byDimension.get('ingredient_probability_per_help').evidence_status,EVIDENCE_STATUS.BLOCKED_MISSING_NUMERIC_MASTER);
assert.ok(byDimension.get('ingredient_probability_per_help').blocking_reasons.includes('SPECIES_BASE_INGREDIENT_RATE_LOCAL_MASTER_MISSING'));
assert.equal(byDimension.get('main_skill_trigger_probability').evidence_status,EVIDENCE_STATUS.BLOCKED_DYNAMIC_RULE);
for(const blocker of ['SPECIES_BASE_SKILL_TRIGGER_RATE_LOCAL_MASTER_MISSING','DAILY_TRIGGER_COUNT_DYNAMIC_RULE','WEEKLY_EVENT_TRIGGER_MULTIPLIER_MUST_BE_APPLIED'])assert.ok(byDimension.get('main_skill_trigger_probability').blocking_reasons.includes(blocker));
assert.equal(byDimension.get('main_skill_effect_value').evidence_status,EVIDENCE_STATUS.REFERENCE_EFFECT_TEXT_ONLY);
assert.equal(first.safety.missing_is_zero,false);
assert.equal(first.safety.player_data_write,false);
assert.equal(first.safety.sqlite_write,false);
assert.equal(first.safety.runtime_network_fetch,false);
assert.equal(first.safety.ai_numeric_authority,false);
assert.equal(first.privacy_manifest.stable_pokemon_ids_in_payload,false);
assert.equal(JSON.stringify(first).includes('private-a'),false,'stable/private pokemon ids must not enter evidence snapshot');

const incomplete=buildProductionEvidenceSnapshot({candidateFeatures:{candidates:[{type:'火',level:null,helper_seconds:null,main_skill:'UNKNOWN',unlocked_ingredients:[]}]},weeklyContext:{},productionRegistry:registry});
assert.equal(incomplete.rules.find(row=>row.dimension==='helper_interval_seconds').coverage.observed_count,0);
assert.ok(incomplete.rules.find(row=>row.dimension==='helper_interval_seconds').blocking_reasons.includes('INCOMPLETE_PLAYER_HELPER_SECONDS'));
if(berryStrengthSuccessor){
  const incompleteBerry=incomplete.rules.find(row=>row.dimension==='berry_energy_per_berry');
  assert.equal(incompleteBerry.coverage.observed_count,0);
  assert.ok(incompleteBerry.blocking_reasons.includes('INCOMPLETE_BERRY_STRENGTH_INPUT_COVERAGE'));
}
if(favoriteMultiplierSuccessor){
  const incompleteFavorite=incomplete.rules.find(row=>row.dimension==='favorite_berry_multiplier');
  assert.equal(incompleteFavorite.coverage.observed_count,0);
  assert.ok(incompleteFavorite.blocking_reasons.includes('INCOMPLETE_FAVORITE_BERRY_MULTIPLIER_INPUT_COVERAGE'));
}
assert.equal(incomplete.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');

const ui=read('assets/js/production-evidence-ui.js');
for(const token of ['G7.5 Production Model Evidence Gate','重新檢查 Evidence','複製 Evidence JSON','缺值不等於 0'])assert.ok(ui.includes(token),`G7.5 UI token missing ${token}`);
assert.ok(berryStrengthSuccessor?ui.includes('局部 ACTIVE_VERIFIED ≠ 完整 Production Model 已啟用'):ui.includes('Evidence identified ≠ ACTIVE_VERIFIED'));
const local=read('assets/js/strategy-context-local.js');
assert.ok(local.includes('buildLocalProductionEvidenceSnapshot'));
const warroom=read('assets/js/war-room-strategy-context-ui.js');
assert.ok(warroom.includes('renderProductionEvidencePanel(root)'));
const sw=read('service-worker.js');
for(const asset of ['./assets/js/production-evidence-registry.js','./assets/js/production-evidence-ui.js'])assert.ok(sw.includes(`'${asset}'`),`first-offline precache missing ${asset}`);
for(const file of ['assets/js/production-evidence-registry.js','assets/js/production-evidence-ui.js']){
  const source=read(file);for(const forbidden of ['INSERT INTO','UPDATE pokemon','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden mutation/network path`);
}

console.log(JSON.stringify({status:'PASS',gate:'V0418_G75_PRODUCTION_EVIDENCE_ACTIVATION_SUCCESSOR_AWARE',app_version:appVersion,numeric_rate_model_status:first.numeric_rate_model_status,activation_decision:first.activation_decision,active_numeric_dimension_count:first.summary.active_numeric_dimension_count,helper_observed:true,type_to_berry_local_master:true,berry_strength_active_verified:berryStrengthSuccessor,favorite_multiplier_active_verified:favoriteMultiplierSuccessor,ingredient_rate_fail_closed:true,skill_trigger_dynamic_blocked:true,missing_is_zero:false,player_write:false,runtime_network_fetch:false,ai_numeric_authority:false,mobile_evidence_ui:true},null,2));
