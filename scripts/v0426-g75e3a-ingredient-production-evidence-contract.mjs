import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
  INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION,
  INGREDIENT_PRODUCTION_DIMENSIONS,
  INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY,
  ingredientProductionEvidenceBoundary,
  isIngredientProductionDimensionActive,
} from '../assets/js/ingredient-production-evidence-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildProductionEvidenceSnapshot} from '../assets/js/production-evidence-registry.js';
import {projectMemberProductionEvidence} from '../assets/js/team-objective-evaluator.js';

const read=path=>fs.readFileSync(path,'utf8');
const registry=currentProductionAuthorityRegistry();
const boundary=ingredientProductionEvidenceBoundary();

assert.equal(INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,'ingredient-production-evidence-boundary-2026-08-14-a');
assert.equal(INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION,'ingredient-production-evidence-contract-v1');
assert.equal(boundary.schema,'pokemon-sleep-ingredient-production-evidence-boundary/1.0');
assert.equal(boundary.numeric_activation_count,0);
assert.deepEqual(boundary.production_dimensions_ready,[]);
assert.deepEqual(boundary.production_dimensions_hold,[
  'ingredient_probability_per_help',
  'ingredient_slot_distribution',
]);
assert.equal(boundary.safety.missing_is_zero,false);
assert.equal(boundary.safety.ai_numeric_authority,false);
assert.equal(boundary.safety.runtime_network_fetch,false);
assert.equal(boundary.safety.catch_assignment_may_substitute_production_distribution,false);

const probability=INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY.ingredient_probability_per_help;
const slotDistribution=INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY.ingredient_slot_distribution;
const assignment=INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY.ingredient_combination_assignment_probability;
assert.equal(probability.lifecycle,'PRODUCTION_TIME');
assert.equal(slotDistribution.lifecycle,'PRODUCTION_TIME');
assert.equal(assignment.lifecycle,'IDENTITY_GENERATION_TIME');
assert.notEqual(probability.semantic,slotDistribution.semantic);
assert.notEqual(slotDistribution.semantic,assignment.semantic);
assert.equal(probability.authority_status,'NOT_YET_VERIFIED');
assert.equal(slotDistribution.authority_status,'NOT_YET_VERIFIED');
assert.equal(probability.runtime_numeric_activation,false);
assert.equal(slotDistribution.runtime_numeric_activation,false);
assert.equal(assignment.runtime_numeric_activation,false);
assert.equal(assignment.production_model_eligible,false);
assert.ok(assignment.forbidden_substitutions.includes('ingredient_slot_distribution'));
assert.ok(assignment.forbidden_substitutions.includes('ingredient_probability_per_help'));
assert.equal(isIngredientProductionDimensionActive('ingredient_probability_per_help'),false);
assert.equal(isIngredientProductionDimensionActive('ingredient_slot_distribution'),false);
assert.equal(isIngredientProductionDimensionActive('ingredient_combination_assignment_probability'),false);

const sourceById=id=>Object.values((await import('../assets/js/ingredient-production-evidence-contract.js')).INGREDIENT_PRODUCTION_EVIDENCE_SOURCES).find(row=>row.source_id===id);
const official=await sourceById('pokemon-sleep-official-v3.5.0-ingredient-finding-chance-adjustment');
const rates=await sourceById('raenonx-production-rates-current-reference-2026-08-14');
const slotReference=await sourceById('pokemon-sleep-verification-wiki-ingredient-slot-selection-2026-08-14');
const catchAssignment=await sourceById('raenonx-ingredient-combination-assignment-2026-08-14');
assert.equal(official.source_tier,'OFFICIAL_MECHANIC_EXISTENCE_ONLY');
assert.ok(official.does_not_support.includes('EXACT_SPECIES_BASE_RATE'));
assert.equal(rates.source_tier,'COMMUNITY_FIRST_HAND_REFERENCE_NUMERIC');
assert.ok(rates.does_not_support.includes('LOCAL_VERSIONED_SPECIES_RATE_MASTER_PRESENT'));
assert.equal(slotReference.source_tier,'COMMUNITY_MECHANICS_REFERENCE');
assert.ok(slotReference.does_not_support.includes('LOCAL_GOVERNED_SLOT_DISTRIBUTION_CONTRACT_PRESENT'));
assert.equal(catchAssignment.source_tier,'COMMUNITY_FIRST_HAND_IDENTITY_GENERATION_RESEARCH');
assert.ok(catchAssignment.does_not_support.includes('PER_HELP_INGREDIENT_SLOT_DISTRIBUTION'));
assert.equal(slotDistribution.reference_candidate_rule,'EQUAL_SELECTION_AMONG_CURRENTLY_UNLOCKED_INGREDIENT_SLOTS');
assert.deepEqual(slotDistribution.reference_candidate_weights,{level_1:'1',level_30:'1/2_each_unlocked_slot',level_60:'1/3_each_unlocked_slot'});

const numericDimensions=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
const activeNumeric=numericDimensions.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED');
assert.deepEqual(activeNumeric.sort(),['berry_energy_per_berry','berry_output_per_help','favorite_berry_multiplier'].sort());
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.ai_numeric_authority,false);
for(const name of ['ingredient_probability_per_help','ingredient_slot_distribution']){
  const row=registry.rules[name];
  assert.equal(row.status,'NOT_YET_VERIFIED');
  assert.equal(row.runtime_numeric_activation,false);
  assert.equal(row.rule_version,null);
  assert.equal(row.evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
  assert.equal(row.evidence_contract_version,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION);
  assert.ok(row.missing_inputs.length>=3,`${name} activation blockers must remain explicit`);
}

const candidate={
  pokemon_id:'fixture-ingredient-01',species:'FixtureMon',level:60,specialty:'食材',type:'草',helper_seconds:2400,
  favorite_berry:'莓果',favorite_berry_match:false,main_skill:'Fixture Skill',main_skill_level:1,
  unlocked_ingredients:[
    {unlock_level:1,ingredient_name:'A',quantity:2},
    {unlock_level:30,ingredient_name:'B',quantity:3},
    {unlock_level:60,ingredient_name:'C',quantity:4},
  ],
  unlocked_subskills:[],
  verified_production:{ingredient_per_hour_by_name:{A:999,B:999,C:999}},
};
const member=projectMemberProductionEvidence(candidate,{productionRegistry:registry});
assert.equal(member.ingredient_rate_status,'NOT_YET_VERIFIED');
assert.equal(member.ingredient_per_hour_by_name,null,'observed slots or supplied values may not bypass production authority');

const probabilityOnly={...registry,rules:{...registry.rules,ingredient_probability_per_help:{...registry.rules.ingredient_probability_per_help,status:'ACTIVE_VERIFIED'}}};
const probabilityOnlyMember=projectMemberProductionEvidence(candidate,{productionRegistry:probabilityOnly});
assert.equal(probabilityOnlyMember.ingredient_rate_status,'NOT_YET_VERIFIED');
assert.equal(probabilityOnlyMember.ingredient_per_hour_by_name,null);
const slotOnly={...registry,rules:{...registry.rules,ingredient_slot_distribution:{...registry.rules.ingredient_slot_distribution,status:'ACTIVE_VERIFIED'}}};
const slotOnlyMember=projectMemberProductionEvidence(candidate,{productionRegistry:slotOnly});
assert.equal(slotOnlyMember.ingredient_rate_status,'NOT_YET_VERIFIED');
assert.equal(slotOnlyMember.ingredient_per_hour_by_name,null);

const snapshot=buildProductionEvidenceSnapshot({candidateFeatures:{candidates:[candidate]},weeklyContext:{},productionRegistry:registry});
assert.equal(snapshot.schema,'pokemon-sleep-production-evidence-snapshot/1.4');
assert.equal(snapshot.ingredient_production_evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
assert.equal(snapshot.summary.active_numeric_dimension_count,3);
assert.equal(snapshot.summary.blocked_numeric_dimension_count,4);
assert.equal(snapshot.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(snapshot.safety.missing_is_zero,false);
assert.equal(snapshot.safety.catch_assignment_may_substitute_production_distribution,false);
const snapshotProbability=snapshot.rules.find(row=>row.dimension==='ingredient_probability_per_help');
const snapshotSlots=snapshot.rules.find(row=>row.dimension==='ingredient_slot_distribution');
assert.equal(snapshotProbability.runtime_numeric_activation,false);
assert.equal(snapshotSlots.runtime_numeric_activation,false);
assert.equal(snapshotSlots.forbidden_evidence_substitution,'ingredient_combination_assignment_probability');
assert.ok(snapshotProbability.blocking_reasons.includes('LOCAL_VERSIONED_SPECIES_BASE_INGREDIENT_RATE_MASTER_MISSING'));
assert.ok(snapshotSlots.blocking_reasons.includes('LOCAL_GOVERNED_PRODUCTION_SLOT_SELECTION_CONTRACT_MISSING'));
assert.ok(snapshotSlots.source_refs.includes(INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID));

const featureSource=read('assets/js/pokemon-candidate-feature-projection.js');
assert.equal(/ingredient_(?:per_hour|hourly|probability_per_help|slot_distribution)\s*:/.test(featureSource),false,'fact-only feature projection may not manufacture ingredient production rates');
assert.ok(featureSource.includes('unlocked_ingredients:ingredients'));
assert.ok(featureSource.includes('weekly_ingredient_demand_coverage'));
const scoringSource=read('assets/js/pokemon-scoring-engine.js');
assert.equal(scoringSource.includes('ingredient_per_hour_by_name'),false,'scoring engine may not consume fake ingredient/hour');
const evaluatorSource=read('assets/js/team-objective-evaluator.js');
assert.ok(evaluatorSource.includes("ingredient_per_hour_by_name:null"));
assert.ok(evaluatorSource.includes("verified(productionRegistry,'ingredient_probability_per_help')&&verified(productionRegistry,'ingredient_slot_distribution')"));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0426_G75E3A_INGREDIENT_PRODUCTION_EVIDENCE_BOUNDARY',
  contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
  contract_version:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION,
  semantic_dimensions:Object.values(INGREDIENT_PRODUCTION_DIMENSIONS),
  active_numeric_dimensions:activeNumeric,
  production_numeric_activation:'3/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  ingredient_slot_distribution_status:registry.rules.ingredient_slot_distribution.status,
  catch_assignment_production_substitution:false,
  observed_slots_generate_hourly_rate:false,
  single_dimension_activation_generates_hourly_rate:false,
  missing_is_zero:false,
  runtime_network_fetch:false,
  ai_numeric_authority:false,
},null,2));
