import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_ID,
  INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,
  INGREDIENT_SLOT_DISTRIBUTION_AUTHORITY_STATUS,
  INGREDIENT_SLOT_DISTRIBUTION_EVIDENCE,
  expectedUnlockedIngredientSlotCount,
  ingredientSlotWeightsForLevel,
  resolveIngredientSlotDistribution,
  expectedIngredientQuantityPerIngredientResult,
} from '../assets/js/ingredient-slot-distribution-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {ingredientProductionEvidenceBoundary} from '../assets/js/ingredient-production-evidence-contract.js';
import {buildProductionEvidenceSnapshot} from '../assets/js/production-evidence-registry.js';
import {currentSpeciesIngredientRateReference} from '../assets/js/public-species-ingredient-rate-reference.js';
import {projectMemberProductionEvidence} from '../assets/js/team-objective-evaluator.js';

const read=path=>fs.readFileSync(path,'utf8');
const close=(a,b,eps=1e-12)=>assert.ok(Math.abs(Number(a)-Number(b))<=eps,`expected ${a} ≈ ${b}`);

assert.equal(INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_ID,'ingredient-slot-distribution-2026-08-14-a');
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,'ingredient-slot-distribution-v1');
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_AUTHORITY_STATUS,'ACTIVE_VERIFIED');
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_EVIDENCE.official_exact_probability_publication,false);
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_EVIDENCE.catch_assignment_probability_out_of_scope,true);
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_EVIDENCE.ingredient_quantity_is_selection_weight,false);
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_EVIDENCE.duplicate_ingredient_names_are_distinct_slots_before_name_aggregation,true);
assert.equal(INGREDIENT_SLOT_DISTRIBUTION_EVIDENCE.sources.length,2);
assert.ok(INGREDIENT_SLOT_DISTRIBUTION_EVIDENCE.sources.some(row=>row.source_commit==='fc36317b195125c63bf56d3777fa3ed1a9548831'));

for(const [level,count] of [[1,1],[29,1],[30,2],[59,2],[60,3],[100,3]])assert.equal(expectedUnlockedIngredientSlotCount(level),count);
for(const invalid of [0,-1,1.5,null,''])assert.equal(expectedUnlockedIngredientSlotCount(invalid),null);
assert.deepEqual(ingredientSlotWeightsForLevel(1).map(row=>row.weight),[1]);
assert.deepEqual(ingredientSlotWeightsForLevel(30).map(row=>row.weight),[0.5,0.5]);
const level60Weights=ingredientSlotWeightsForLevel(60);assert.equal(level60Weights.length,3);for(const row of level60Weights)close(row.weight,1/3);close(level60Weights.reduce((sum,row)=>sum+row.weight,0),1);

const slots=[
  {unlock_level:1,ingredient_name:'A',quantity:2},
  {unlock_level:30,ingredient_name:'A',quantity:5},
  {unlock_level:60,ingredient_name:'B',quantity:7},
];
const lv29=resolveIngredientSlotDistribution({level:29,slots});assert.equal(lv29.status,'ACTIVE_VERIFIED');assert.equal(lv29.slot_count,1);assert.equal(lv29.slots[0].weight,1);
const lv30=resolveIngredientSlotDistribution({level:30,slots});assert.equal(lv30.status,'ACTIVE_VERIFIED');assert.deepEqual(lv30.slots.map(row=>row.weight),[0.5,0.5]);
const lv60=resolveIngredientSlotDistribution({level:60,slots});assert.equal(lv60.status,'ACTIVE_VERIFIED');assert.equal(lv60.catch_assignment_probability_used,false);for(const row of lv60.slots)close(row.weight,1/3);

const expected=expectedIngredientQuantityPerIngredientResult({level:60,slots});assert.equal(expected.status,'ACTIVE_VERIFIED');close(expected.by_ingredient_name.A,7/3);close(expected.by_ingredient_name.B,7/3);assert.equal(Object.keys(expected.by_ingredient_name).length,2,'duplicate ingredient names must aggregate after equal slot weighting');
assert.equal(resolveIngredientSlotDistribution({level:30,slots:[slots[0]]}).status,'MISSING_UNLOCKED_SLOT_IDENTITY');
assert.equal(resolveIngredientSlotDistribution({level:60,slots:[slots[0],slots[2],slots[1]]}).status,'INVALID_OR_AMBIGUOUS_SLOT_STRUCTURE');
assert.equal(resolveIngredientSlotDistribution({level:60,slots:[slots[0],slots[1],{unlock_level:60,ingredient_name:'',quantity:7}]}).status,'INVALID_OR_AMBIGUOUS_SLOT_STRUCTURE');
assert.equal(expectedIngredientQuantityPerIngredientResult({level:60,slots:[slots[0],slots[1],{unlock_level:60,ingredient_name:'B',quantity:null}]}).status,'MISSING_SLOT_QUANTITY');

const registry=currentProductionAuthorityRegistry();
const numeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
const active=numeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED');
assert.deepEqual([...active].sort(),['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution'].sort());
assert.equal(registry.rules.ingredient_slot_distribution.status,'ACTIVE_VERIFIED');
assert.equal(registry.rules.ingredient_slot_distribution.rule_version,INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION);
assert.equal(registry.rules.ingredient_slot_distribution.runtime_numeric_activation,true);
assert.equal(registry.rules.ingredient_slot_distribution.scope,'CONDITIONAL_ON_INGREDIENT_RESULT_HELP');
assert.deepEqual(registry.rules.ingredient_slot_distribution.missing_inputs,[]);
assert.ok(registry.rules.ingredient_slot_distribution.excluded_inputs.includes('ingredient_probability_per_help'));
assert.ok(registry.rules.ingredient_slot_distribution.excluded_inputs.includes('ingredient_combination_assignment_probability'));
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const boundary=ingredientProductionEvidenceBoundary();
assert.equal(boundary.numeric_activation_count,1);assert.deepEqual(boundary.production_dimensions_ready,['ingredient_slot_distribution']);assert.deepEqual(boundary.production_dimensions_hold,['ingredient_probability_per_help']);assert.equal(boundary.safety.catch_assignment_may_substitute_production_distribution,false);
const reference=currentSpeciesIngredientRateReference();assert.equal(reference.status,'REFERENCE_ONLY_COMMUNITY_DERIVED');assert.equal(reference.eligible_for_numeric_activation,false);

const candidate={pokemon_id:'fixture-slot-01',species:'妙蛙種子',type:'草',level:60,specialty:'食材',helper_seconds:4400,favorite_berry_match:false,main_skill:'食材獲取S',main_skill_level:1,nature:'勤奮',unlocked_subskills:[],unlocked_ingredients:slots,verified_production:{ingredient_per_hour_by_name:{A:999,B:999}}};
const member=projectMemberProductionEvidence(candidate,{productionRegistry:registry});
assert.equal(member.ingredient_rate_status,'NOT_YET_VERIFIED','slot distribution alone must not activate ingredient/hour');
assert.equal(member.ingredient_per_hour_by_name,null);

const snapshot=buildProductionEvidenceSnapshot({candidateFeatures:{candidates:[candidate]},weeklyContext:{favorite_berry_1:'蘋野果',favorite_berry_2:'金枕果',favorite_berry_3:'莓莓果'},productionRegistry:registry});
assert.equal(snapshot.schema,'pokemon-sleep-production-evidence-snapshot/1.5');assert.equal(snapshot.summary.numeric_dimension_count,7);assert.equal(snapshot.summary.active_numeric_dimension_count,4);assert.equal(snapshot.summary.blocked_numeric_dimension_count,3);assert.equal(snapshot.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');assert.equal(snapshot.summary.ingredient_slot_distribution_resolved_candidate_count,1);assert.equal(snapshot.safety.ingredient_slot_distribution_implies_ingredient_hour,false);
const slotRow=snapshot.rules.find(row=>row.dimension==='ingredient_slot_distribution');assert.equal(slotRow.authority_status,'ACTIVE_VERIFIED');assert.equal(slotRow.evidence_status,'ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT');assert.equal(slotRow.runtime_numeric_activation,true);assert.equal(slotRow.coverage.observed_count,1);assert.deepEqual(slotRow.blocking_reasons,[]);assert.equal(slotRow.forbidden_evidence_substitution,'ingredient_combination_assignment_probability');
const probabilityRow=snapshot.rules.find(row=>row.dimension==='ingredient_probability_per_help');assert.equal(probabilityRow.runtime_numeric_activation,false);assert.deepEqual(probabilityRow.blocking_reasons,['SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED']);

const featureSource=read('assets/js/pokemon-candidate-feature-projection.js');assert.equal(/ingredient_(?:per_hour|hourly|probability_per_help|slot_distribution)\s*:/.test(featureSource),false);const scoringSource=read('assets/js/pokemon-scoring-engine.js');assert.equal(scoringSource.includes('ingredient_per_hour_by_name'),false);const evaluatorSource=read('assets/js/team-objective-evaluator.js');assert.ok(evaluatorSource.includes("verified(productionRegistry,'ingredient_probability_per_help')&&verified(productionRegistry,'ingredient_slot_distribution')"));

console.log(JSON.stringify({status:'PASS',gate:'V0427_G75E3B_INGREDIENT_SLOT_DISTRIBUTION',contract_id:INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_ID,contract_version:INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,verified_weights:{lv1:[1],lv30:[0.5,0.5],lv60:[1/3,1/3,1/3]},duplicate_name_aggregation:true,catch_assignment_used:false,active_numeric_dimensions:active,production_numeric_activation:'4/7',ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,ingredient_hour_still_blocked:true,overall_numeric_model_status:registry.numeric_rate_model_status,missing_is_zero:false,runtime_network_fetch:false,ai_numeric_authority:false},null,2));
