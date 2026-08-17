import {currentIngredientProbabilitySourceLineageReview} from './ingredient-probability-independent-source-lineage-review.js';

export const INGREDIENT_PROBABILITY_CANDIDATE_DISCOVERY_REGISTER_ID='ingredient-probability-independent-candidate-discovery-register-2026-08-17-a';
export const INGREDIENT_PROBABILITY_CANDIDATE_DISCOVERY_REGISTER_VERSION='ingredient-probability-independent-candidate-discovery-register-v1';

export const INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS=Object.freeze({
  UNRESOLVED_RECORDED_DATA_LEAD:'UNRESOLVED_RECORDED_DATA_LEAD',
  NON_RATE_MEASUREMENT_REFERENCE:'NON_RATE_MEASUREMENT_REFERENCE',
  MODEL_FIT_REFERENCE_ALREADY_GOVERNED:'MODEL_FIT_REFERENCE_ALREADY_GOVERNED',
});

const freeze=value=>Object.freeze(value);

export const INGREDIENT_PROBABILITY_DISCOVERY_LEADS=Object.freeze([
  freeze({
    lead_id:'WIKIWIKI_HISTORICAL_RECORDED_DATA_MENTION',
    lead_name:'Pokémon Sleep verification Wiki historical recorded-data mention',
    status:INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS.UNRESOLVED_RECORDED_DATA_LEAD,
    discovered_at:'2026-08-17',
    candidate_source_id:null,
    may_count_as_independent_crosscheck:false,
    admitted_numeric_rows:0,
    direct_help_event_observation_dataset_confirmed:false,
    evidence_refs:freeze([
      'WIKIWIKI_COMMENT:2023-10-18:AZU:SELF_PUBLISHED_RECORDED_DATA_MENTIONED_FOR_TRIGGER_PROBABILITY_VERIFICATION',
      'WIKIWIKI_VERIFICATION_INDEX:2026-07-24:INGREDIENT_HELP_PROBABILITY_STATUS=UNDER_CONSIDERATION:NO_PARTICIPATION_METHOD_LISTED',
    ]),
    blockers:freeze([
      'HISTORICAL_DATASET_LOCATION_NOT_RESOLVED',
      'INGREDIENT_PROBABILITY_SCOPE_NOT_CONFIRMED',
      'HELP_EVENT_DENOMINATOR_NOT_CONFIRMED',
      'SPECIES_FORM_MAPPING_NOT_CONFIRMED',
      'CURRENT_SOURCE_LINEAGE_NOT_REVIEWED',
      'PINNED_MACHINE_READABLE_SNAPSHOT_NOT_AVAILABLE',
    ]),
    next_action:'LOCATE_ORIGINAL_RECORDED_DATASET_AND_REVIEW_SCOPE_DENOMINATOR_LINEAGE',
  }),
  freeze({
    lead_id:'WIKIWIKI_HELPER_WHISTLE_VALIDATION',
    lead_name:'Pokémon Sleep verification Wiki Helper Whistle validation',
    status:INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS.NON_RATE_MEASUREMENT_REFERENCE,
    discovered_at:'2026-08-17',
    candidate_source_id:null,
    may_count_as_independent_crosscheck:false,
    admitted_numeric_rows:0,
    direct_help_event_observation_dataset_confirmed:false,
    evidence_refs:freeze([
      'WIKIWIKI_HELPER_WHISTLE_VALIDATION:2026-01-02:INGREDIENT_RATE_USED_AS_EXPECTATION_INPUT_TO_VALIDATE_WHISTLE_ROUNDING',
      'HATENA_HELPER_WHISTLE_VALIDATION:2025-12-23:INGREDIENT_RATE_OBTAINED_FROM_INDIVIDUAL_VALUE_CHECKERS',
    ]),
    blockers:freeze([
      'INGREDIENT_PROBABILITY_IS_INPUT_NOT_MEASURED_OUTPUT',
      'VALIDATES_WHISTLE_EXPECTATION_ROUNDING_NOT_BASE_RATE',
      'CHECKER_NUMERIC_LINEAGE_NOT_ESTABLISHED_AS_INDEPENDENT',
    ]),
    next_action:'DO_NOT_ADMIT_AS_INGREDIENT_PROBABILITY_REFERENCE',
  }),
  freeze({
    lead_id:'WIKIWIKI_MATHCORD_SP_RP_ESTIMATE_TABLE',
    lead_name:'Mathcord SP/RP reverse-engineered ingredient probability estimate table',
    status:INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS.MODEL_FIT_REFERENCE_ALREADY_GOVERNED,
    discovered_at:'2026-08-17',
    candidate_source_id:'MATHCORD_RP_FIT_MODEL',
    may_count_as_independent_crosscheck:false,
    admitted_numeric_rows:0,
    direct_help_event_observation_dataset_confirmed:false,
    evidence_refs:freeze([
      'WIKIWIKI_INGREDIENT_PROBABILITY_VERIFICATION:SP_FORMULA_REVERSE_ENGINEERED_ESTIMATE_WITH_ASSUMPTIONS:MAY_DEVIATE_FROM_ACTUAL_VALUES',
      'RP_FIT_README:jeancroy/RP-fit:ANALYZES_RP_COLLECTION_PROJECT_DATA',
    ]),
    blockers:freeze([
      'MODEL_FIT_REVERSE_ENGINEERED_NOT_DIRECT_HELP_EVENT_OBSERVATION',
      'CURRENT_NUMERIC_LINEAGE_INDEPENDENCE_NOT_ESTABLISHED',
    ]),
    next_action:'CONTINUE_GOVERNANCE_UNDER_MATHCORD_RP_FIT_MODEL_REVIEW_REQUIRED_CANDIDATE',
  }),
]);

export function currentIngredientProbabilityIndependentCandidateDiscoveryRegister(){
  const lineage=currentIngredientProbabilitySourceLineageReview();
  const governedCandidates=(lineage.reviews||[]).map(row=>freeze({
    source_id:row.source_id,
    lineage_review_status:row.lineage_review_status,
    lineage_class:row.lineage_class,
    admission_status:row.admission_status,
    may_count_as_independent_crosscheck:row.admission_may_count_as_independent_crosscheck===true,
  }));
  const unresolved=INGREDIENT_PROBABILITY_DISCOVERY_LEADS.filter(row=>row.status===INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS.UNRESOLVED_RECORDED_DATA_LEAD);
  const nonAdmissible=INGREDIENT_PROBABILITY_DISCOVERY_LEADS.filter(row=>row.status!==INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS.UNRESOLVED_RECORDED_DATA_LEAD);
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-independent-candidate-discovery-register/1.0',
    register_id:INGREDIENT_PROBABILITY_CANDIDATE_DISCOVERY_REGISTER_ID,
    register_version:INGREDIENT_PROBABILITY_CANDIDATE_DISCOVERY_REGISTER_VERSION,
    discovery_scope_date:'2026-08-17',
    lineage_review_id:lineage.review_id,
    lineage_review_version:lineage.review_version,
    governed_candidate_count:governedCandidates.length,
    accepted_independent_source_count:lineage.accepted_independent_source_count,
    discovery_lead_count:INGREDIENT_PROBABILITY_DISCOVERY_LEADS.length,
    unresolved_discovery_lead_count:unresolved.length,
    non_admissible_or_already_governed_lead_count:nonAdmissible.length,
    governed_candidates:freeze(governedCandidates),
    discovery_leads:INGREDIENT_PROBABILITY_DISCOVERY_LEADS,
    status:lineage.accepted_independent_source_count>0?'INDEPENDENT_SOURCE_AVAILABLE':unresolved.length?'HOLD_UNRESOLVED_DISCOVERY_LEAD_PRESENT':'HOLD_NO_ACCEPTED_INDEPENDENT_SOURCE_AND_NO_OPEN_LEAD',
    next_action:lineage.accepted_independent_source_count>0?'RUN_PINNED_INDEPENDENT_CROSSCHECK':unresolved.length?'RESOLVE_OPEN_RECORDED_DATA_LEAD_OR_FIND_NEW_DIRECT_OBSERVATION_SOURCE':'FIND_NEW_DIRECT_OBSERVATION_SOURCE',
    production_probability_activation_allowed:false,
    production_active_dimensions:'4/7',
    safety:freeze({
      discovery_lead_counts_as_admitted_source:false,
      mention_of_recorded_data_proves_dataset_scope:false,
      model_fit_counts_as_direct_observation:false,
      validation_using_rate_as_input_counts_as_rate_measurement:false,
      search_result_or_web_page_counts_as_machine_snapshot:false,
      unresolved_lineage_counts_as_independent:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
