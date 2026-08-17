import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS,
  evaluateIngredientProbabilityRecordedDatasetResolution,
  currentIngredientProbabilityRecordedDatasetResolutionPack,
} from '../assets/js/ingredient-probability-recorded-dataset-resolution-pack.js';
import {
  INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS,
  INGREDIENT_PROBABILITY_HELP_EVENT_SEMANTICS,
} from '../assets/js/ingredient-probability-independent-candidate-intake.js';
import {currentIngredientProbabilityIndependentCandidateDiscoveryRegister} from '../assets/js/ingredient-probability-independent-candidate-discovery-register.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const pack=currentIngredientProbabilityRecordedDatasetResolutionPack();
assert.equal(pack.schema,'pokemon-sleep-ingredient-probability-recorded-dataset-resolution-pack/1.0');
assert.equal(pack.pack_version,'ingredient-probability-recorded-dataset-resolution-pack-v1');
assert.equal(pack.target_lead_count,1);
assert.equal(pack.open_resolution_count,1);
assert.equal(pack.ready_for_lineage_review_count,0);
assert.equal(pack.accepted_independent_source_count,0);
assert.equal(pack.production_probability_activation_allowed,false);
assert.equal(pack.production_active_dimensions,'4/7');
for(const key of [
  'unresolved_resolution_is_terminal_rejection','not_found_means_nonexistent','resolution_pack_can_prove_source_absence',
  'ready_for_lineage_review_implies_source_admission','accepted_independent_source_count_may_be_inferred_from_resolution_pack',
  'runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority',
])assert.equal(pack.safety[key],false,`unsafe C6 resolution pack flag ${key}`);

const current=pack.resolutions[0];
assert.equal(current.discovery_lead_id,'WIKIWIKI_HISTORICAL_RECORDED_DATA_MENTION');
assert.equal(current.resolution_status,INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.OPEN_ORIGINAL_DATASET_NOT_LOCATED);
assert.equal(current.resolution_terminal,false);
assert.equal(current.dataset_location_resolved,false);
assert.equal(current.source_absence_claimed,false);
assert.equal(current.source_absence_proven,false);
assert.equal(current.ready_for_lineage_review,false);
assert.equal(current.source_admission_granted,false);
assert.equal(current.independent_crosscheck_granted,false);
assert.equal(current.activation_authority_granted,false);
assert.equal(current.next_action,'CONTINUE_LOCATING_ORIGINAL_DATASET_WITHOUT_TREATING_NOT_FOUND_AS_NONEXISTENT');
assert.ok(current.prior_discovery_blockers.includes('HISTORICAL_DATASET_LOCATION_NOT_RESOLVED'));
assert.equal(current.blockers.includes('HISTORICAL_DATASET_LOCATION_NOT_RESOLVED'),false,'historical discovery blocker must not become immutable current blocker');
assert.ok(current.blockers.includes('ORIGINAL_DATASET_LOCATION_MISSING'));
assert.ok(current.blockers.includes('NUMERIC_EVIDENCE_CLASS_UNKNOWN'));

const locatedIncomplete=evaluateIngredientProbabilityRecordedDatasetResolution({
  discovery_lead_id:'WIKIWIKI_HISTORICAL_RECORDED_DATA_MENTION',
  resolution_attempt_id:'fixture-located-incomplete',resolution_method:'FIXTURE_EVIDENCE_REVIEW',
  source_id:'FIXTURE_LOCATED_INCOMPLETE',source_name:'Fixture Located Incomplete',
  numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.DIRECT_HELP_EVENT_OBSERVATION_DATASET,
  original_dataset_location:'fixture://located-but-incomplete.csv',
  resolution_evidence_refs:['fixture://discovery-page'],
  source_absence_claimed:false,
});
assert.equal(locatedIncomplete.resolution_status,INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_EVIDENCE_LOCATED_INTAKE_INCOMPLETE);
assert.equal(locatedIncomplete.dataset_location_resolved,true);
assert.equal(locatedIncomplete.ready_for_lineage_review,false);
assert.ok(locatedIncomplete.blockers.includes('SOURCE_OWNER_OR_RESEARCH_GROUP_MISSING'));
assert.ok(locatedIncomplete.blockers.includes('HELP_EVENT_DENOMINATOR_SEMANTICS_NOT_CONFIRMED'));

const directFixture={
  discovery_lead_id:'WIKIWIKI_HISTORICAL_RECORDED_DATA_MENTION',
  resolution_attempt_id:'fixture-direct-complete',resolution_method:'FIXTURE_PINNED_DATASET_REVIEW',
  resolution_evidence_refs:['fixture://landing-page','fixture://methodology'],
  source_id:'FIXTURE_DIRECT_HELP_EVENTS',source_name:'Fixture Direct Help Events',
  numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.DIRECT_HELP_EVENT_OBSERVATION_DATASET,
  original_dataset_location:'fixture://direct-help-events.csv',source_owner_or_research_group:'fixture-independent-research-group',
  data_generation_methodology:'Records each compatible help event as ingredient-result or berry-result without hidden-rate reconstruction.',
  snapshot_hash_algorithm:'sha256',snapshot_hash:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  snapshot_scope_date:'2026-08-17',source_revision:'fixture-r1',
  lineage_evidence_refs:['fixture://provenance','fixture://collection-protocol'],
  species_form_mapping_strategy:'EXPLICIT_SOURCE_KEY_TO_CANONICAL_FORM_TABLE',mapped_row_count:100,roster_row_count:242,
  published_numeric_precision_preserved:true,partial_coverage_reported_explicitly:true,player_private_data_in_source:false,
  statistical_semantics:INGREDIENT_PROBABILITY_HELP_EVENT_SEMANTICS,
  ingredient_event_count_field:'ingredient_help_event_count',total_help_event_count_field:'total_help_event_count',
  source_absence_claimed:false,
};
const ready=evaluateIngredientProbabilityRecordedDatasetResolution(directFixture);
assert.equal(ready.resolution_status,INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.READY_FOR_LINEAGE_REVIEW);
assert.equal(ready.ready_for_lineage_review,true);
assert.deepEqual(ready.blockers,[]);
assert.equal(ready.source_admission_granted,false,'C6 resolution must not bypass C4A admission');
assert.equal(ready.independent_crosscheck_granted,false);
assert.equal(ready.activation_authority_granted,false);
assert.equal(ready.next_action,'RUN_HUMAN_SOURCE_LINEAGE_REVIEW_AND_EXISTING_C4A_ADMISSION_GATE');
assert.ok(ready.prior_discovery_blockers.includes('HISTORICAL_DATASET_LOCATION_NOT_RESOLVED'));

const absenceClaim=evaluateIngredientProbabilityRecordedDatasetResolution({
  ...directFixture,resolution_attempt_id:'fixture-absence-claim',source_absence_claimed:true,
  authoritative_absence_evidence_refs:['fixture://claimed-authoritative-absence'],
});
assert.equal(absenceClaim.resolution_status,INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_UNSUPPORTED_ABSENCE_CLAIM);
assert.equal(absenceClaim.source_absence_claimed,true);
assert.equal(absenceClaim.source_absence_proven,false,'C6 must never auto-prove source nonexistence');
assert.ok(absenceClaim.blockers.includes('SOURCE_ABSENCE_CLAIM_REQUIRES_HUMAN_REVIEW'));
assert.equal(absenceClaim.ready_for_lineage_review,false);
assert.equal(absenceClaim.activation_authority_granted,false);

const modelFit=evaluateIngredientProbabilityRecordedDatasetResolution({
  discovery_lead_id:'WIKIWIKI_MATHCORD_SP_RP_ESTIMATE_TABLE',resolution_attempt_id:'fixture-model-fit',resolution_method:'FIXTURE_EVIDENCE_REVIEW',
  resolution_evidence_refs:['fixture://rp-fit'],source_id:'MATHCORD_RP_FIT_MODEL',source_name:'Mathcord RP-fit',
  numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.MODEL_FIT_OR_REVERSE_ENGINEERED,
});
assert.equal(modelFit.resolution_status,INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS);
assert.equal(modelFit.resolution_terminal,true);
assert.equal(modelFit.ready_for_lineage_review,false);
assert.equal(modelFit.source_admission_granted,false);

const unknown=evaluateIngredientProbabilityRecordedDatasetResolution({...directFixture,discovery_lead_id:'UNKNOWN_LEAD',resolution_attempt_id:'fixture-unknown'});
assert.equal(unknown.resolution_status,INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_UNKNOWN_DISCOVERY_LEAD);
assert.ok(unknown.blockers.includes('DISCOVERY_LEAD_NOT_REGISTERED'));
assert.equal(unknown.ready_for_lineage_review,false);
assert.equal(unknown.source_admission_granted,false);

const discovery=currentIngredientProbabilityIndependentCandidateDiscoveryRegister();
assert.equal(discovery.accepted_independent_source_count,0);
const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=fs.readFileSync('assets/js/ingredient-probability-recorded-dataset-resolution-pack.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`E3C-7C6 resolution pack owns forbidden runtime/write path ${forbidden}`);
assert.ok(source.includes('not_found_means_nonexistent:false'));
assert.ok(source.includes('resolution_pack_can_prove_source_absence:false'));
assert.ok(source.includes('prior_discovery_blockers_are_immutable_current_blockers:false'));
assert.ok(source.includes('RUN_HUMAN_SOURCE_LINEAGE_REVIEW_AND_EXISTING_C4A_ADMISSION_GATE'));

console.log(JSON.stringify({
  status:'PASS',gate:'V0428_G75E3C7C6_RECORDED_DATASET_RESOLUTION_PACK',
  current_resolution_status:current.resolution_status,current_resolution_terminal:current.resolution_terminal,
  located_incomplete_status:locatedIncomplete.resolution_status,direct_fixture_status:ready.resolution_status,
  absence_claim_status:absenceClaim.resolution_status,absence_auto_proven:false,
  model_fit_status:modelFit.resolution_status,unknown_lead_status:unknown.resolution_status,
  ready_for_lineage_review_implies_source_admission:false,accepted_independent_sources:discovery.accepted_independent_source_count,
  production_numeric_activation:'4/7',ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  runtime_network_fetch:false,sqlite_write:false,ai_numeric_authority:false,
},null,2));
