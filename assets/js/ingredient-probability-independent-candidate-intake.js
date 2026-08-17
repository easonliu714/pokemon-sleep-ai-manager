export const INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_ID='ingredient-probability-independent-candidate-intake-2026-08-17-a';
export const INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_VERSION='ingredient-probability-independent-candidate-intake-v1';
export const INGREDIENT_PROBABILITY_HELP_EVENT_SEMANTICS='BERNOULLI_HELP_EVENT_SPLIT_OBSERVATION';
export const INGREDIENT_PROBABILITY_PUBLISHED_RATE_SEMANTICS='PUBLISHED_BASE_INGREDIENT_PROBABILITY_PER_HELP';

export const INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS=Object.freeze({
  DIRECT_HELP_EVENT_OBSERVATION_DATASET:'DIRECT_HELP_EVENT_OBSERVATION_DATASET',
  OFFICIAL_EXACT_NUMERIC_PUBLICATION:'OFFICIAL_EXACT_NUMERIC_PUBLICATION',
  MODEL_FIT_OR_REVERSE_ENGINEERED:'MODEL_FIT_OR_REVERSE_ENGINEERED',
  RATE_USED_AS_INPUT_ONLY:'RATE_USED_AS_INPUT_ONLY',
  UNKNOWN:'UNKNOWN',
});

export const INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS=Object.freeze({
  READY_FOR_LINEAGE_REVIEW:'READY_FOR_LINEAGE_REVIEW',
  HOLD_INTAKE_INCOMPLETE:'HOLD_INTAKE_INCOMPLETE',
  REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS:'REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS',
  REJECTED_MODEL_FIT_EVIDENCE_CLASS:'REJECTED_MODEL_FIT_EVIDENCE_CLASS',
});

const freeze=value=>Object.freeze(value);
const text=value=>String(value??'').normalize('NFKC').trim();
const positiveInteger=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const nonNegativeInteger=value=>{const n=Number(value);return Number.isInteger(n)&&n>=0?n:null;};
const nonEmptyArray=value=>Array.isArray(value)?value.map(text).filter(Boolean):[];

function evidenceClassFor(value){const token=text(value);return Object.values(INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS).includes(token)?token:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.UNKNOWN;}

export function evaluateIndependentIngredientProbabilityCandidateIntake(input={}){
  const sourceId=text(input.source_id),sourceName=text(input.source_name),leadId=text(input.discovery_lead_id);
  const evidenceClass=evidenceClassFor(input.numeric_evidence_class);
  const blockers=[];
  if(!leadId)blockers.push('DISCOVERY_LEAD_ID_MISSING');
  if(!sourceId)blockers.push('SOURCE_ID_MISSING');
  if(!sourceName)blockers.push('SOURCE_NAME_MISSING');
  if(!text(input.original_dataset_location))blockers.push('ORIGINAL_DATASET_LOCATION_MISSING');
  if(!text(input.source_owner_or_research_group))blockers.push('SOURCE_OWNER_OR_RESEARCH_GROUP_MISSING');
  if(!text(input.data_generation_methodology))blockers.push('DATA_GENERATION_METHODOLOGY_MISSING');
  if(!text(input.snapshot_hash_algorithm)||!text(input.snapshot_hash))blockers.push('PINNED_SNAPSHOT_HASH_MISSING');
  if(!text(input.snapshot_scope_date)&&!text(input.snapshot_release_id))blockers.push('SNAPSHOT_SCOPE_MISSING');
  if(!text(input.source_version)&&!text(input.source_revision))blockers.push('SOURCE_VERSION_OR_REVISION_MISSING');
  if(!nonEmptyArray(input.lineage_evidence_refs).length)blockers.push('LINEAGE_EVIDENCE_REFS_MISSING');
  if(!text(input.species_form_mapping_strategy))blockers.push('SPECIES_FORM_MAPPING_STRATEGY_MISSING');
  const mapped=nonNegativeInteger(input.mapped_row_count),roster=positiveInteger(input.roster_row_count);
  if(mapped===null||roster===null||mapped>roster)blockers.push('MAPPED_OR_ROSTER_ROW_COUNT_INVALID');
  if(input.published_numeric_precision_preserved!==true)blockers.push('PUBLISHED_NUMERIC_PRECISION_NOT_CONFIRMED');
  if(input.partial_coverage_reported_explicitly!==true)blockers.push('PARTIAL_COVERAGE_REPORTING_NOT_CONFIRMED');
  if(input.player_private_data_in_source===true)blockers.push('PLAYER_PRIVATE_DATA_SOURCE_NOT_ALLOWED');

  if(evidenceClass===INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.MODEL_FIT_OR_REVERSE_ENGINEERED)return freeze({
    status:INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS,
    reason:'MODEL_FIT_OR_REVERSE_ENGINEERED_NOT_ACTIVATION_GRADE_REFERENCE',
    numeric_evidence_class:evidenceClass,blockers:freeze([...new Set(blockers)]),ready_for_lineage_review:false,
    source_admission_granted:false,independent_crosscheck_granted:false,activation_authority_granted:false,
  });
  if(evidenceClass===INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.RATE_USED_AS_INPUT_ONLY)return freeze({
    status:INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS,
    reason:'RATE_USED_AS_INPUT_IS_NOT_RATE_MEASUREMENT',numeric_evidence_class:evidenceClass,blockers:freeze([...new Set(blockers)]),ready_for_lineage_review:false,
    source_admission_granted:false,independent_crosscheck_granted:false,activation_authority_granted:false,
  });
  if(evidenceClass===INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.UNKNOWN)blockers.push('NUMERIC_EVIDENCE_CLASS_UNKNOWN');

  const semantics=text(input.statistical_semantics);
  if(evidenceClass===INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.DIRECT_HELP_EVENT_OBSERVATION_DATASET){
    if(semantics!==INGREDIENT_PROBABILITY_HELP_EVENT_SEMANTICS)blockers.push('HELP_EVENT_DENOMINATOR_SEMANTICS_NOT_CONFIRMED');
    if(!text(input.ingredient_event_count_field))blockers.push('INGREDIENT_EVENT_COUNT_FIELD_MISSING');
    if(!text(input.total_help_event_count_field))blockers.push('TOTAL_HELP_EVENT_COUNT_FIELD_MISSING');
  }
  if(evidenceClass===INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.OFFICIAL_EXACT_NUMERIC_PUBLICATION){
    if(semantics!==INGREDIENT_PROBABILITY_PUBLISHED_RATE_SEMANTICS)blockers.push('PUBLISHED_RATE_PER_HELP_SEMANTICS_NOT_CONFIRMED');
    if(!text(input.probability_value_field))blockers.push('PROBABILITY_VALUE_FIELD_MISSING');
  }
  const uniqueBlockers=[...new Set(blockers)];
  const ready=uniqueBlockers.length===0;
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-independent-candidate-intake-result/1.0',
    contract_id:INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_ID,
    contract_version:INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_VERSION,
    discovery_lead_id:leadId||null,source_id:sourceId||null,source_name:sourceName||null,numeric_evidence_class:evidenceClass,
    status:ready?INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.READY_FOR_LINEAGE_REVIEW:INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.HOLD_INTAKE_INCOMPLETE,
    reason:ready?null:'CANDIDATE_INTAKE_REQUIREMENTS_INCOMPLETE',blockers:freeze(uniqueBlockers),ready_for_lineage_review:ready,
    mapped_row_count:mapped,roster_row_count:roster,coverage_ratio:mapped!==null&&roster?mapped/roster:null,
    source_admission_granted:false,independent_crosscheck_granted:false,activation_authority_granted:false,
    next_action:ready?'RUN_HUMAN_SOURCE_LINEAGE_REVIEW_AND_EXISTING_C4A_ADMISSION_GATE':'RESOLVE_INTAKE_BLOCKERS',
  });
}

export function currentIndependentIngredientProbabilityCandidateIntakeContract(){
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-independent-candidate-intake/1.0',
    contract_id:INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_ID,
    contract_version:INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_VERSION,
    supported_evidence_classes:freeze(Object.values(INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS)),
    direct_help_event_semantics:INGREDIENT_PROBABILITY_HELP_EVENT_SEMANTICS,
    official_published_rate_semantics:INGREDIENT_PROBABILITY_PUBLISHED_RATE_SEMANTICS,
    ready_for_lineage_review_implies_source_admission:false,
    ready_for_lineage_review_implies_independent_crosscheck:false,
    source_admission_granted:false,
    activation_authority_granted:false,
    production_active_dimensions:'4/7',
    safety:freeze({
      discovery_lead_auto_promoted:false,
      model_fit_allowed_as_activation_grade_reference:false,
      rate_used_as_input_counts_as_measurement:false,
      self_asserted_independence_sufficient:false,
      missing_dataset_location_allowed:false,
      missing_denominator_semantics_allowed:false,
      search_result_or_web_page_counts_as_snapshot:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
