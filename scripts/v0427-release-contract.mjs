import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_ID,
  INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,
  INGREDIENT_SLOT_DISTRIBUTION_AUTHORITY_STATUS,
  ingredientSlotWeightsForLevel,
  resolveIngredientSlotDistribution,
  expectedIngredientQuantityPerIngredientResult,
} from '../assets/js/ingredient-slot-distribution-contract.js';
import {
  INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
  ingredientProductionEvidenceBoundary,
} from '../assets/js/ingredient-production-evidence-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildProductionEvidenceSnapshot} from '../assets/js/production-evidence-registry.js';
import {currentSpeciesIngredientRateReference} from '../assets/js/public-species-ingredient-rate-reference.js';
import {projectMemberProductionEvidence} from '../assets/js/team-objective-evaluator.js';
import {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION} from '../assets/js/public-recipe-current-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authoritySource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(authoritySource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
assert.equal(authority.app_version,'v0.4.27');
assert.equal(authority.app_build,'20260814-v0427-g75e3b-ingredient-slot-distribution');
assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.27-v0427-g75e3b-ingredient-slot-distribution');
assert.equal(authority.schema,'pokemon-sleep-version-authority/1.0');
assert.ok(authoritySource.includes("// app_version: 'v0.4.26'"),'v0.4.26 predecessor lineage missing');
assert.ok(authoritySource.includes("// app_build: '20260814-v0426-g75e3a-ingredient-rate-reference-boundary'"),'v0.4.26 predecessor build lineage missing');

assert.equal(INGREDIENT_SLOT_DISTRIBUTION_AUTHORITY_STATUS,'ACTIVE_VERIFIED');
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_ID,'ingredient-slot-distribution-2026-08-14-a');
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,'ingredient-slot-distribution-v1');
assert.deepEqual(ingredientSlotWeightsForLevel(1).map(row=>row.weight),[1]);
assert.deepEqual(ingredientSlotWeightsForLevel(30).map(row=>row.weight),[0.5,0.5]);
const lv60Weights=ingredientSlotWeightsForLevel(60).map(row=>row.weight);
assert.equal(lv60Weights.length,3);
assert.ok(lv60Weights.every(value=>Math.abs(value-1/3)<1e-12));
assert.equal(resolveIngredientSlotDistribution({level:0,slots:[]}).status,'INVALID_LEVEL');
assert.equal(resolveIngredientSlotDistribution({level:30,slots:[{unlock_level:1,ingredient_name:'甜甜蜜',quantity:2}]}).status,'MISSING_UNLOCKED_SLOT_IDENTITY');
assert.equal(resolveIngredientSlotDistribution({level:30,slots:[{unlock_level:1,ingredient_name:'甜甜蜜',quantity:2},{unlock_level:60,ingredient_name:'安心蘋果',quantity:5}]}).status,'INVALID_OR_AMBIGUOUS_SLOT_STRUCTURE');
const duplicate=expectedIngredientQuantityPerIngredientResult({level:60,slots:[
  {unlock_level:1,ingredient_name:'甜甜蜜',quantity:2},
  {unlock_level:30,ingredient_name:'甜甜蜜',quantity:5},
  {unlock_level:60,ingredient_name:'窩心洋芋',quantity:7},
]});
assert.equal(duplicate.status,'ACTIVE_VERIFIED');
assert.ok(Math.abs(duplicate.by_ingredient_name['甜甜蜜']-7/3)<1e-12,'duplicate names must aggregate after equal per-slot weighting');
assert.ok(Math.abs(duplicate.by_ingredient_name['窩心洋芋']-7/3)<1e-12);

const boundary=ingredientProductionEvidenceBoundary();
assert.equal(boundary.schema,'pokemon-sleep-ingredient-production-evidence-boundary/1.2');
assert.equal(boundary.contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
assert.equal(boundary.numeric_activation_count,1);
assert.deepEqual(boundary.production_dimensions_ready,['ingredient_slot_distribution']);
assert.deepEqual(boundary.production_dimensions_hold,['ingredient_probability_per_help']);
assert.equal(boundary.safety.missing_is_zero,false);
assert.equal(boundary.safety.reference_values_activate_production,false);
assert.equal(boundary.safety.catch_assignment_may_substitute_production_distribution,false);
assert.equal(boundary.safety.runtime_network_fetch,false);
assert.equal(boundary.safety.ai_numeric_authority,false);

const reference=currentSpeciesIngredientRateReference();
assert.equal(reference.status,'REFERENCE_ONLY_COMMUNITY_DERIVED');
assert.equal(reference.complete_catalog,false);
assert.equal(reference.eligible_for_numeric_activation,false);
assert.equal(reference.policy.reference_values_may_activate_production_dimension,false);

const registry=currentProductionAuthorityRegistry();
const numeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
const active=numeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED');
assert.deepEqual(active,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(active.length,4);
assert.equal(registry.rules.ingredient_slot_distribution.rule_version,INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION);
assert.equal(registry.rules.ingredient_slot_distribution.runtime_numeric_activation,true);
assert.deepEqual(registry.rules.ingredient_slot_distribution.missing_inputs,[]);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.rule_version,null);
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.rules.main_skill_trigger_probability.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.main_skill_effect_value.status,'NOT_YET_VERIFIED');
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.ai_numeric_authority,false);

const candidate={
  pokemon_id:'private-release-fixture',species:'妙蛙種子',type:'草',level:60,specialty:'食材',helper_seconds:4400,
  favorite_berry_match:false,main_skill:'食材獲取S',main_skill_level:1,nature:'勤奮',unlocked_subskills:[],
  unlocked_ingredients:[
    {unlock_level:1,ingredient_name:'甜甜蜜',quantity:2},
    {unlock_level:30,ingredient_name:'甜甜蜜',quantity:5},
    {unlock_level:60,ingredient_name:'窩心洋芋',quantity:7},
  ],
};
const member=projectMemberProductionEvidence(candidate,{productionRegistry:registry});
assert.equal(member.ingredient_rate_status,'NOT_YET_VERIFIED');
assert.equal(member.ingredient_per_hour_by_name,null,'4/7 must not manufacture ingredient/hour while probability is HOLD');

const snapshot=buildProductionEvidenceSnapshot({
  candidateFeatures:{candidates:[candidate]},
  weeklyContext:{favorite_berry_1:'蘋野果',favorite_berry_2:'金枕果',favorite_berry_3:'莓莓果'},
  productionRegistry:registry,
});
assert.equal(snapshot.schema,'pokemon-sleep-production-evidence-snapshot/1.5');
assert.equal(snapshot.summary.numeric_dimension_count,7);
assert.equal(snapshot.summary.active_numeric_dimension_count,4);
assert.equal(snapshot.summary.blocked_numeric_dimension_count,3);
assert.equal(snapshot.summary.ingredient_slot_distribution_resolved_candidate_count,1);
assert.equal(snapshot.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
const slotRow=snapshot.rules.find(row=>row.dimension==='ingredient_slot_distribution');
assert.equal(slotRow.authority_status,'ACTIVE_VERIFIED');
assert.equal(slotRow.runtime_numeric_activation,true);
assert.deepEqual(slotRow.blocking_reasons,[]);
const probabilityRow=snapshot.rules.find(row=>row.dimension==='ingredient_probability_per_help');
assert.equal(probabilityRow.runtime_numeric_activation,false);
assert.equal(probabilityRow.coverage.observed_count,0);
assert.deepEqual(probabilityRow.blocking_reasons,['SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED']);
const referenceRow=snapshot.rules.find(row=>row.dimension==='species_base_ingredient_rate_reference');
assert.equal(referenceRow.authority_status,'REFERENCE_ONLY_COMMUNITY_DERIVED');
assert.equal(referenceRow.runtime_numeric_activation,false);
assert.ok(referenceRow.blocking_reasons.includes('REFERENCE_ONLY_NOT_ACTIVATION_AUTHORITY'));
for(const key of ['missing_is_zero','player_data_write','sqlite_write','runtime_network_fetch','ai_numeric_authority','reference_values_activate_production','catch_assignment_may_substitute_production_distribution','ingredient_slot_distribution_implies_ingredient_hour'])assert.equal(snapshot.safety[key],false,`unsafe release snapshot flag ${key}`);
assert.equal(snapshot.privacy_manifest.stable_pokemon_ids_in_payload,false);
assert.equal(JSON.stringify(snapshot).includes(candidate.pokemon_id),false,'private Pokémon id leaked into evidence snapshot');

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-14-c');
assert.equal(PUBLIC_RECIPE_MASTER.length,78);
assert.equal(PUBLIC_RECIPE_MASTER.filter(row=>row.source_type==='migration_baseline').length,0);

const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
for(const asset of [
  './assets/js/ingredient-slot-distribution-contract.js',
  './assets/js/ingredient-production-evidence-contract.js',
  './assets/js/production-authority-registry.js',
  './assets/js/production-evidence-registry.js',
])assert.ok(sw.includes(`'${asset}'`),`v0.4.27 first-offline precache missing ${asset}`);
for(const file of ['assets/js/ingredient-slot-distribution-contract.js','assets/js/ingredient-production-evidence-contract.js','assets/js/production-authority-registry.js','assets/js/production-evidence-registry.js']){
  const source=read(file);
  for(const forbidden of ['INSERT INTO','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden mutation path: ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',gate:'V0427_RELEASE_CONTRACT',app_version:authority.app_version,app_build:authority.app_build,cache_name:authority.cache_name,
  ingredient_slot_contract:INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,verified_slot_weights:{lv1:[1],lv30:[0.5,0.5],lv60:['1/3','1/3','1/3']},
  active_numeric_dimensions:active,production_numeric_activation:'4/7',blocked_numeric_dimensions:3,
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,ingredient_hour_still_blocked:true,
  species_rate_reference_status:reference.status,overall_numeric_model_status:registry.numeric_rate_model_status,
  recipe_current_authority_count:PUBLIC_RECIPE_MASTER.length,first_offline_precache:true,missing_is_zero:false,runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));