import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS,
  currentIngredientProbabilityIndependentCandidateDiscoveryRegister,
} from '../assets/js/ingredient-probability-independent-candidate-discovery-register.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const register=currentIngredientProbabilityIndependentCandidateDiscoveryRegister();
assert.equal(register.schema,'pokemon-sleep-ingredient-probability-independent-candidate-discovery-register/1.0');
assert.equal(register.register_version,'ingredient-probability-independent-candidate-discovery-register-v1');
assert.equal(register.discovery_scope_date,'2026-08-17');
assert.equal(register.governed_candidate_count,4);
assert.equal(register.accepted_independent_source_count,0);
assert.equal(register.discovery_lead_count,3);
assert.equal(register.unresolved_discovery_lead_count,1);
assert.equal(register.non_admissible_or_already_governed_lead_count,2);
assert.equal(register.status,'HOLD_UNRESOLVED_DISCOVERY_LEAD_PRESENT');
assert.equal(register.next_action,'RESOLVE_OPEN_RECORDED_DATA_LEAD_OR_FIND_NEW_DIRECT_OBSERVATION_SOURCE');
assert.equal(register.production_probability_activation_allowed,false);
assert.equal(register.production_active_dimensions,'4/7');

const governedById=new Map(register.governed_candidates.map(row=>[row.source_id,row]));
for(const sourceId of ['RAENONX_PRODUCTION_RATES','POKEMON_SLEEP_VERIFICATION_WIKI','SLEEPAPI_GITHUB_FORK','MATHCORD_RP_FIT_MODEL'])assert.ok(governedById.has(sourceId),`governed candidate missing ${sourceId}`);
assert.equal([...governedById.values()].filter(row=>row.may_count_as_independent_crosscheck===true).length,0);

const leadById=new Map(register.discovery_leads.map(row=>[row.lead_id,row]));
const recorded=leadById.get('WIKIWIKI_HISTORICAL_RECORDED_DATA_MENTION');
assert.ok(recorded);
assert.equal(recorded.status,INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS.UNRESOLVED_RECORDED_DATA_LEAD);
assert.equal(recorded.candidate_source_id,null);
assert.equal(recorded.may_count_as_independent_crosscheck,false);
assert.equal(recorded.admitted_numeric_rows,0);
assert.equal(recorded.direct_help_event_observation_dataset_confirmed,false);
for(const blocker of [
  'HISTORICAL_DATASET_LOCATION_NOT_RESOLVED',
  'INGREDIENT_PROBABILITY_SCOPE_NOT_CONFIRMED',
  'HELP_EVENT_DENOMINATOR_NOT_CONFIRMED',
  'SPECIES_FORM_MAPPING_NOT_CONFIRMED',
  'CURRENT_SOURCE_LINEAGE_NOT_REVIEWED',
  'PINNED_MACHINE_READABLE_SNAPSHOT_NOT_AVAILABLE',
])assert.ok(recorded.blockers.includes(blocker),`recorded-data lead blocker missing ${blocker}`);
assert.equal(recorded.next_action,'LOCATE_ORIGINAL_RECORDED_DATASET_AND_REVIEW_SCOPE_DENOMINATOR_LINEAGE');

const whistle=leadById.get('WIKIWIKI_HELPER_WHISTLE_VALIDATION');
assert.ok(whistle);
assert.equal(whistle.status,INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS.NON_RATE_MEASUREMENT_REFERENCE);
assert.equal(whistle.may_count_as_independent_crosscheck,false);
assert.equal(whistle.admitted_numeric_rows,0);
assert.equal(whistle.direct_help_event_observation_dataset_confirmed,false);
assert.ok(whistle.blockers.includes('INGREDIENT_PROBABILITY_IS_INPUT_NOT_MEASURED_OUTPUT'));
assert.ok(whistle.blockers.includes('VALIDATES_WHISTLE_EXPECTATION_ROUNDING_NOT_BASE_RATE'));
assert.equal(whistle.next_action,'DO_NOT_ADMIT_AS_INGREDIENT_PROBABILITY_REFERENCE');

const rpFit=leadById.get('WIKIWIKI_MATHCORD_SP_RP_ESTIMATE_TABLE');
assert.ok(rpFit);
assert.equal(rpFit.status,INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS.MODEL_FIT_REFERENCE_ALREADY_GOVERNED);
assert.equal(rpFit.candidate_source_id,'MATHCORD_RP_FIT_MODEL');
assert.equal(rpFit.may_count_as_independent_crosscheck,false);
assert.equal(rpFit.direct_help_event_observation_dataset_confirmed,false);
assert.ok(rpFit.blockers.includes('MODEL_FIT_REVERSE_ENGINEERED_NOT_DIRECT_HELP_EVENT_OBSERVATION'));
assert.equal(rpFit.next_action,'CONTINUE_GOVERNANCE_UNDER_MATHCORD_RP_FIT_MODEL_REVIEW_REQUIRED_CANDIDATE');

for(const key of [
  'discovery_lead_counts_as_admitted_source',
  'mention_of_recorded_data_proves_dataset_scope',
  'model_fit_counts_as_direct_observation',
  'validation_using_rate_as_input_counts_as_rate_measurement',
  'search_result_or_web_page_counts_as_machine_snapshot',
  'unresolved_lineage_counts_as_independent',
  'runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority',
])assert.equal(register.safety[key],false,`unsafe C4 discovery register flag ${key}`);

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=fs.readFileSync('assets/js/ingredient-probability-independent-candidate-discovery-register.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`E3C-7C4 discovery register owns forbidden runtime/write path ${forbidden}`);
assert.ok(source.includes('currentIngredientProbabilitySourceLineageReview'));
assert.ok(source.includes('discovery_lead_counts_as_admitted_source:false'));
assert.ok(source.includes('HISTORICAL_DATASET_LOCATION_NOT_RESOLVED'));
assert.ok(source.includes('INGREDIENT_PROBABILITY_IS_INPUT_NOT_MEASURED_OUTPUT'));
assert.ok(source.includes('MODEL_FIT_REFERENCE_ALREADY_GOVERNED'));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C7C4_INDEPENDENT_CANDIDATE_DISCOVERY_REGISTER',
  governed_candidate_count:register.governed_candidate_count,
  accepted_independent_sources:register.accepted_independent_source_count,
  discovery_leads:register.discovery_lead_count,
  unresolved_recorded_data_leads:register.unresolved_discovery_lead_count,
  helper_whistle_counts_as_rate_measurement:false,
  model_fit_counts_as_direct_observation:false,
  discovery_lead_counts_as_admitted_source:false,
  next_action:register.next_action,
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
  runtime_network_fetch:false,
  sqlite_write:false,
  ai_numeric_authority:false,
},null,2));
