import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
  INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION,
  INGREDIENT_PRODUCTION_DIMENSIONS,
  INGREDIENT_PRODUCTION_EVIDENCE_SOURCES,
  INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY,
  ingredientProductionEvidenceBoundary,
  isIngredientProductionDimensionActive,
} from '../assets/js/ingredient-production-evidence-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildProductionEvidenceSnapshot} from '../assets/js/production-evidence-registry.js';
import {currentSpeciesIngredientRateReference} from '../assets/js/public-species-ingredient-rate-reference.js';
import {projectMemberProductionEvidence} from '../assets/js/team-objective-evaluator.js';

const read=path=>fs.readFileSync(path,'utf8');
const registry=currentProductionAuthorityRegistry();
const boundary=ingredientProductionEvidenceBoundary();
const reference=currentSpeciesIngredientRateReference();

assert.equal(boundary.schema,'pokemon-sleep-ingredient-production-evidence-boundary/1.1');
assert.equal(boundary.contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
assert.equal(boundary.contract_version,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION);
assert.equal(boundary.numeric_activation_count,0);
assert.deepEqual(boundary.production_dimensions_hold,['ingredient_probability_per_help','ingredient_slot_distribution']);
for(const key of ['missing_is_zero','player_data_write','sqlite_write','runtime_network_fetch','ai_numeric_authority','reference_values_activate_production','catch_assignment_may_substitute_production_distribution'])assert.equal(boundary.safety[key],false,`unsafe boundary flag: ${key}`);

const probability=INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY.ingredient_probability_per_help;
const slotDistribution=INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY.ingredient_slot_distribution;
const catchAssignment=INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY.ingredient_combination_assignment_probability;
assert.equal(probability.lifecycle,'PRODUCTION_TIME');
assert.equal(slotDistribution.lifecycle,'PRODUCTION_TIME');
assert.equal(catchAssignment.lifecycle,'IDENTITY_GENERATION_TIME');
assert.notEqual(probability.semantic,slotDistribution.semantic);
assert.notEqual(slotDistribution.semantic,catchAssignment.semantic);
assert.equal(probability.authority_status,'NOT_YET_VERIFIED');
assert.equal(slotDistribution.authority_status,'NOT_YET_VERIFIED');
assert.equal(probability.runtime_numeric_activation,false);
assert.equal(slotDistribution.runtime_numeric_activation,false);
assert.equal(catchAssignment.production_model_eligible,false);
assert.ok(catchAssignment.forbidden_substitutions.includes('ingredient_probability_per_help'));
assert.ok(catchAssignment.forbidden_substitutions.includes('ingredient_slot_distribution'));
assert.equal(isIngredientProductionDimensionActive('ingredient_probability_per_help'),false);
assert.equal(isIngredientProductionDimensionActive('ingredient_slot_distribution'),false);
assert.equal(isIngredientProductionDimensionActive('ingredient_combination_assignment_probability'),false);

assert.equal(slotDistribution.reference_candidate_rule,'EQUAL_SELECTION_AMONG_CURRENTLY_UNLOCKED_INGREDIENT_SLOTS');
assert.deepEqual(slotDistribution.reference_candidate_weights,{level_1:'1',level_30:'1/2_each_unlocked_slot',level_60:'1/3_each_unlocked_slot'});
assert.ok(slotDistribution.blockers.includes('PLAYER_SLOT_IDENTITY_OBSERVED_BUT_PRODUCTION_WEIGHT_MISSING'));
assert.ok(slotDistribution.blockers.includes('LOCAL_GOVERNED_PRODUCTION_SLOT_SELECTION_CONTRACT_MISSING'));
assert.ok(probability.blockers.includes('SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED'));
assert.ok(probability.blockers.includes('COMPLETE_CURRENT_SPECIES_FORM_ACTIVATION_COVERAGE_MISSING'));
assert.ok(probability.blockers.includes('ACCEPTED_NUMERIC_EVIDENCE_POLICY_MISSING'));

const sourceById=id=>Object.values(INGREDIENT_PRODUCTION_EVIDENCE_SOURCES).find(row=>row.source_id===id);
const official=sourceById('pokemon-sleep-official-v3.5.0-ingredient-finding-chance-adjustment');
const slotReference=sourceById('pokemon-sleep-verification-wiki-ingredient-slot-selection-2026-08-14');
const assignmentReference=sourceById('raenonx-ingredient-combination-assignment-2026-08-14');
assert.equal(official.source_tier,'OFFICIAL_MECHANIC_EXISTENCE_ONLY');
assert.ok(official.does_not_support.includes('EXACT_SPECIES_BASE_RATE'));
assert.equal(slotReference.source_tier,'COMMUNITY_MECHANICS_REFERENCE');
assert.ok(slotReference.does_not_support.includes('LOCAL_GOVERNED_SLOT_DISTRIBUTION_CONTRACT'));
assert.equal(assignmentReference.source_tier,'COMMUNITY_FIRST_HAND_IDENTITY_GENERATION_RESEARCH');
assert.ok(assignmentReference.does_not_support.includes('PER_HELP_INGREDIENT_SLOT_DISTRIBUTION'));

assert.equal(reference.status,'REFERENCE_ONLY_COMMUNITY_DERIVED');
assert.equal(reference.complete_catalog,false);
assert.equal(reference.eligible_for_numeric_activation,false);
assert.equal(reference.policy.reference_values_may_activate_production_dimension,false);

const numeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
const active=numeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED');
assert.deepEqual([...active].sort(),['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier'].sort());
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.ai_numeric_authority,false);
assert.equal(registry.ingredient_production_evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
for(const name of ['ingredient_probability_per_help','ingredient_slot_distribution']){
  const row=registry.rules[name];
  assert.equal(row.status,'NOT_YET_VERIFIED');
  assert.equal(row.rule_version,null);
  assert.equal(row.runtime_numeric_activation,false);
  assert.equal(row.semantic_lifecycle,'PRODUCTION_TIME');
  assert.equal(row.evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
  assert.equal(row.evidence_contract_version,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION);
  assert.ok(row.source_refs.length>0,`${name} evidence sources missing`);
  assert.ok(row.missing_inputs.length>=3,`${name} activation blockers must be explicit`);
}

const candidate={
  pokemon_id:'fixture-ingredient-01',species:'妙蛙種子',type:'草',level:60,specialty:'食材',helper_seconds:4400,
  favorite_berry_match:false,main_skill:'食材獲取S',main_skill_level:1,nature:'勤奮',unlocked_subskills:[],
  unlocked_ingredients:[
    {unlock_level:1,ingredient_name:'甜甜蜜',quantity:2},
    {unlock_level:30,ingredient_name:'安心蘋果',quantity:5},
    {unlock_level:60,ingredient_name:'窩心洋芋',quantity:7},
  ],
  verified_production:{ingredient_per_hour_by_name:{甜甜蜜:999,安心蘋果:999,窩心洋芋:999}},
};
const member=projectMemberProductionEvidence(candidate,{productionRegistry:registry});
assert.equal(member.ingredient_rate_status,'NOT_YET_VERIFIED');
assert.equal(member.ingredient_per_hour_by_name,null,'observed slots/reference rates may not bypass authority');

const probabilityOnly={...registry,rules:{...registry.rules,ingredient_probability_per_help:{...registry.rules.ingredient_probability_per_help,status:'ACTIVE_VERIFIED'}}};
const probabilityOnlyMember=projectMemberProductionEvidence(candidate,{productionRegistry:probabilityOnly});
assert.equal(probabilityOnlyMember.ingredient_rate_status,'NOT_YET_VERIFIED');
assert.equal(probabilityOnlyMember.ingredient_per_hour_by_name,null);
const slotOnly={...registry,rules:{...registry.rules,ingredient_slot_distribution:{...registry.rules.ingredient_slot_distribution,status:'ACTIVE_VERIFIED'}}};
const slotOnlyMember=projectMemberProductionEvidence(candidate,{productionRegistry:slotOnly});
assert.equal(slotOnlyMember.ingredient_rate_status,'NOT_YET_VERIFIED');
assert.equal(slotOnlyMember.ingredient_per_hour_by_name,null);

const snapshot=buildProductionEvidenceSnapshot({
  candidateFeatures:{candidates:[candidate]},
  weeklyContext:{favorite_berry_1:'蘋野果',favorite_berry_2:'金枕果',favorite_berry_3:'莓莓果'},
  productionRegistry:registry,
});
assert.equal(snapshot.schema,'pokemon-sleep-production-evidence-snapshot/1.4');
assert.equal(snapshot.ingredient_production_evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
assert.equal(snapshot.ingredient_production_evidence_contract_version,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION);
assert.equal(snapshot.summary.rule_count,12);
assert.equal(snapshot.summary.numeric_dimension_count,7);
assert.equal(snapshot.summary.active_numeric_dimension_count,3);
assert.equal(snapshot.summary.blocked_numeric_dimension_count,4);
assert.equal(snapshot.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(snapshot.safety.reference_values_activate_production,false);
assert.equal(snapshot.safety.catch_assignment_may_substitute_production_distribution,false);

const speciesReferenceRow=snapshot.rules.find(row=>row.dimension==='species_base_ingredient_rate_reference');
assert.ok(speciesReferenceRow,'#279 species reference evidence row must remain present');
assert.equal(speciesReferenceRow.runtime_numeric_activation,false);
assert.ok(speciesReferenceRow.blocking_reasons.includes('REFERENCE_ONLY_NOT_ACTIVATION_AUTHORITY'));
const probabilityRow=snapshot.rules.find(row=>row.dimension==='ingredient_probability_per_help');
assert.equal(probabilityRow.runtime_numeric_activation,false);
assert.equal(probabilityRow.coverage.observed_count,0);
assert.deepEqual(probabilityRow.blocking_reasons,['SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED']);
assert.equal(probabilityRow.evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
const slotRow=snapshot.rules.find(row=>row.dimension==='ingredient_slot_distribution');
assert.equal(slotRow.runtime_numeric_activation,false);
assert.deepEqual(slotRow.blocking_reasons,['PLAYER_SLOT_IDENTITY_OBSERVED_BUT_PRODUCTION_WEIGHT_MISSING']);
assert.equal(slotRow.forbidden_evidence_substitution,'ingredient_combination_assignment_probability');
assert.equal(slotRow.evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);

const featureSource=read('assets/js/pokemon-candidate-feature-projection.js');
assert.equal(/ingredient_(?:per_hour|hourly|probability_per_help|slot_distribution)\s*:/.test(featureSource),false,'fact-only candidate feature projection may not manufacture ingredient production rates');
assert.ok(featureSource.includes('unlocked_ingredients:ingredients'));
const scoringSource=read('assets/js/pokemon-scoring-engine.js');
assert.equal(scoringSource.includes('ingredient_per_hour_by_name'),false,'scoring engine may not consume fake ingredient/hour');
const evaluatorSource=read('assets/js/team-objective-evaluator.js');
assert.ok(evaluatorSource.includes("ingredient_per_hour_by_name:null"));
assert.ok(evaluatorSource.includes("verified(productionRegistry,'ingredient_probability_per_help')&&verified(productionRegistry,'ingredient_slot_distribution')"));
const sw=read('service-worker.js');
assert.ok(sw.includes("'./assets/js/public-species-ingredient-rate-reference.js'"));
assert.ok(sw.includes("'./assets/js/ingredient-probability-reference-contract.js'"));
assert.ok(sw.includes("'./assets/js/ingredient-production-evidence-contract.js'"),'first-offline semantic contract precache missing');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0426_G75E3A_INGREDIENT_SEMANTIC_BOUNDARY_CLOSURE',
  contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
  contract_version:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION,
  semantic_dimensions:Object.values(INGREDIENT_PRODUCTION_DIMENSIONS),
  species_reference_status:reference.status,
  species_reference_complete_catalog:reference.complete_catalog,
  active_numeric_dimensions:active,
  production_numeric_activation:'3/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  ingredient_slot_distribution_status:registry.rules.ingredient_slot_distribution.status,
  catch_assignment_production_substitution:false,
  observed_slots_or_reference_generate_hourly_rate:false,
  single_dimension_activation_generates_hourly_rate:false,
  first_offline_semantic_contract:true,
  missing_is_zero:false,
  runtime_network_fetch:false,
  ai_numeric_authority:false,
},null,2));
