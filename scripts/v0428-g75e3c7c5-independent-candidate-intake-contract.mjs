import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS,
  INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS,
  INGREDIENT_PROBABILITY_HELP_EVENT_SEMANTICS,
  INGREDIENT_PROBABILITY_PUBLISHED_RATE_SEMANTICS,
  evaluateIndependentIngredientProbabilityCandidateIntake,
  currentIndependentIngredientProbabilityCandidateIntakeContract,
} from '../assets/js/ingredient-probability-independent-candidate-intake.js';
import {currentIngredientProbabilityIndependentCandidateDiscoveryRegister} from '../assets/js/ingredient-probability-independent-candidate-discovery-register.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const contract=currentIndependentIngredientProbabilityCandidateIntakeContract();
assert.equal(contract.schema,'pokemon-sleep-ingredient-probability-independent-candidate-intake/1.0');
assert.equal(contract.contract_version,'ingredient-probability-independent-candidate-intake-v1');
assert.equal(contract.ready_for_lineage_review_implies_source_admission,false);
assert.equal(contract.ready_for_lineage_review_implies_independent_crosscheck,false);
assert.equal(contract.source_admission_granted,false);
assert.equal(contract.activation_authority_granted,false);
assert.equal(contract.production_active_dimensions,'4/7');
for(const key of [
  'discovery_lead_auto_promoted','model_fit_allowed_as_activation_grade_reference','rate_used_as_input_counts_as_measurement',
  'self_asserted_independence_sufficient','missing_dataset_location_allowed','missing_denominator_semantics_allowed',
  'search_result_or_web_page_counts_as_snapshot','runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority',
])assert.equal(contract.safety[key],false,`unsafe C5 intake contract flag ${key}`);

const discovery=currentIngredientProbabilityIndependentCandidateDiscoveryRegister();
const leadById=new Map(discovery.discovery_leads.map(row=>[row.lead_id,row]));
assert.equal(discovery.accepted_independent_source_count,0);

const unresolvedLead=leadById.get('WIKIWIKI_HISTORICAL_RECORDED_DATA_MENTION');
const unresolved=evaluateIndependentIngredientProbabilityCandidateIntake({
  discovery_lead_id:unresolvedLead.lead_id,
  source_id:'HISTORICAL_RECORDED_DATA_UNRESOLVED',
  source_name:unresolvedLead.lead_name,
  numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.UNKNOWN,
});
assert.equal(unresolved.status,INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.HOLD_INTAKE_INCOMPLETE);
assert.equal(unresolved.ready_for_lineage_review,false);
for(const blocker of [
  'ORIGINAL_DATASET_LOCATION_MISSING','SOURCE_OWNER_OR_RESEARCH_GROUP_MISSING','DATA_GENERATION_METHODOLOGY_MISSING',
  'PINNED_SNAPSHOT_HASH_MISSING','SNAPSHOT_SCOPE_MISSING','SOURCE_VERSION_OR_REVISION_MISSING','LINEAGE_EVIDENCE_REFS_MISSING',
  'SPECIES_FORM_MAPPING_STRATEGY_MISSING','MAPPED_OR_ROSTER_ROW_COUNT_INVALID','PUBLISHED_NUMERIC_PRECISION_NOT_CONFIRMED',
  'PARTIAL_COVERAGE_REPORTING_NOT_CONFIRMED','NUMERIC_EVIDENCE_CLASS_UNKNOWN',
])assert.ok(unresolved.blockers.includes(blocker),`unresolved recorded-data intake blocker missing ${blocker}`);
assert.equal(unresolved.source_admission_granted,false);
assert.equal(unresolved.independent_crosscheck_granted,false);
assert.equal(unresolved.activation_authority_granted,false);

const modelFit=evaluateIndependentIngredientProbabilityCandidateIntake({
  discovery_lead_id:'WIKIWIKI_MATHCORD_SP_RP_ESTIMATE_TABLE',source_id:'MATHCORD_RP_FIT_MODEL',source_name:'Mathcord / RP-fit',
  numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.MODEL_FIT_OR_REVERSE_ENGINEERED,
});
assert.equal(modelFit.status,INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS);
assert.equal(modelFit.reason,'MODEL_FIT_OR_REVERSE_ENGINEERED_NOT_ACTIVATION_GRADE_REFERENCE');
assert.equal(modelFit.ready_for_lineage_review,false);
assert.equal(modelFit.source_admission_granted,false);
assert.equal(modelFit.activation_authority_granted,false);

const rateInput=evaluateIndependentIngredientProbabilityCandidateIntake({
  discovery_lead_id:'WIKIWIKI_HELPER_WHISTLE_VALIDATION',source_id:'HELPER_WHISTLE_EXPECTATION_INPUT',source_name:'Helper Whistle validation',
  numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.RATE_USED_AS_INPUT_ONLY,
});
assert.equal(rateInput.status,INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS);
assert.equal(rateInput.reason,'RATE_USED_AS_INPUT_IS_NOT_RATE_MEASUREMENT');
assert.equal(rateInput.ready_for_lineage_review,false);
assert.equal(rateInput.independent_crosscheck_granted,false);

const directFixture={
  discovery_lead_id:'fixture-direct-help-events',source_id:'FIXTURE_DIRECT_HELP_EVENTS',source_name:'Fixture Direct Help Events',
  numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.DIRECT_HELP_EVENT_OBSERVATION_DATASET,
  original_dataset_location:'fixture://direct-help-events.csv',source_owner_or_research_group:'fixture-independent-research-group',
  data_generation_methodology:'Directly records each compatible help event as ingredient or berry outcome.',
  snapshot_hash_algorithm:'sha256',snapshot_hash:'0123456789abcdef',snapshot_scope_date:'2026-08-17',source_revision:'fixture-r1',
  lineage_evidence_refs:['fixture://methodology','fixture://provenance'],species_form_mapping_strategy:'EXPLICIT_SOURCE_KEY_TO_CANONICAL_FORM_TABLE',
  mapped_row_count:100,roster_row_count:242,published_numeric_precision_preserved:true,partial_coverage_reported_explicitly:true,
  player_private_data_in_source:false,statistical_semantics:INGREDIENT_PROBABILITY_HELP_EVENT_SEMANTICS,
  ingredient_event_count_field:'ingredient_help_event_count',total_help_event_count_field:'total_help_event_count',
};
const direct=evaluateIndependentIngredientProbabilityCandidateIntake(directFixture);
assert.equal(direct.status,INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.READY_FOR_LINEAGE_REVIEW);
assert.equal(direct.ready_for_lineage_review,true);
assert.deepEqual(direct.blockers,[]);
assert.equal(direct.coverage_ratio,100/242);
assert.equal(direct.source_admission_granted,false,'C5 readiness must not bypass C4A source admission');
assert.equal(direct.independent_crosscheck_granted,false);
assert.equal(direct.activation_authority_granted,false);
assert.equal(direct.next_action,'RUN_HUMAN_SOURCE_LINEAGE_REVIEW_AND_EXISTING_C4A_ADMISSION_GATE');

const wrongDenominator=evaluateIndependentIngredientProbabilityCandidateIntake({...directFixture,statistical_semantics:'PER_COLLECTION_WINDOW'});
assert.equal(wrongDenominator.status,INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.HOLD_INTAKE_INCOMPLETE);
assert.ok(wrongDenominator.blockers.includes('HELP_EVENT_DENOMINATOR_SEMANTICS_NOT_CONFIRMED'));
assert.equal(wrongDenominator.ready_for_lineage_review,false);

const privateSource=evaluateIndependentIngredientProbabilityCandidateIntake({...directFixture,player_private_data_in_source:true});
assert.equal(privateSource.status,INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.HOLD_INTAKE_INCOMPLETE);
assert.ok(privateSource.blockers.includes('PLAYER_PRIVATE_DATA_SOURCE_NOT_ALLOWED'));

const official=evaluateIndependentIngredientProbabilityCandidateIntake({
  ...directFixture,source_id:'FIXTURE_OFFICIAL_EXACT',source_name:'Fixture Official Exact Publication',
  numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.OFFICIAL_EXACT_NUMERIC_PUBLICATION,
  statistical_semantics:INGREDIENT_PROBABILITY_PUBLISHED_RATE_SEMANTICS,probability_value_field:'base_ingredient_probability',
  ingredient_event_count_field:null,total_help_event_count_field:null,
});
assert.equal(official.status,INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.READY_FOR_LINEAGE_REVIEW);
assert.equal(official.ready_for_lineage_review,true);
assert.equal(official.source_admission_granted,false);
assert.equal(official.activation_authority_granted,false);

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=fs.readFileSync('assets/js/ingredient-probability-independent-candidate-intake.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`E3C-7C5 intake owns forbidden runtime/write path ${forbidden}`);
assert.ok(source.includes('ready_for_lineage_review_implies_source_admission:false'));
assert.ok(source.includes('MODEL_FIT_OR_REVERSE_ENGINEERED_NOT_ACTIVATION_GRADE_REFERENCE'));
assert.ok(source.includes('RATE_USED_AS_INPUT_IS_NOT_RATE_MEASUREMENT'));
assert.ok(source.includes('RUN_HUMAN_SOURCE_LINEAGE_REVIEW_AND_EXISTING_C4A_ADMISSION_GATE'));

console.log(JSON.stringify({
  status:'PASS',gate:'V0428_G75E3C7C5_INDEPENDENT_CANDIDATE_INTAKE',
  unresolved_recorded_data_lead_status:unresolved.status,
  model_fit_status:modelFit.status,rate_used_as_input_status:rateInput.status,
  direct_observation_fixture_status:direct.status,official_exact_fixture_status:official.status,
  ready_for_lineage_review_implies_source_admission:false,ready_for_lineage_review_implies_activation:false,
  accepted_independent_sources:discovery.accepted_independent_source_count,
  production_numeric_activation:'4/7',ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  runtime_network_fetch:false,sqlite_write:false,ai_numeric_authority:false,
},null,2));
