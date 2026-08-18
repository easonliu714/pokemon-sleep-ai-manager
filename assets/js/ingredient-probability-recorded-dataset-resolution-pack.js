import {currentIngredientProbabilityIndependentCandidateDiscoveryRegister} from './ingredient-probability-independent-candidate-discovery-register.js';
import {
  INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS,
  INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS,
  evaluateIndependentIngredientProbabilityCandidateIntake,
  currentIndependentIngredientProbabilityCandidateIntakeContract,
} from './ingredient-probability-independent-candidate-intake.js';

export const INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_ID='ingredient-probability-recorded-dataset-resolution-pack-2026-08-18-b';
export const INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_VERSION='ingredient-probability-recorded-dataset-resolution-pack-v2';

export const INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS=Object.freeze({
  OPEN_ORIGINAL_DATASET_NOT_LOCATED:'OPEN_ORIGINAL_DATASET_NOT_LOCATED',
  HOLD_EVIDENCE_LOCATED_INTAKE_INCOMPLETE:'HOLD_EVIDENCE_LOCATED_INTAKE_INCOMPLETE',
  HOLD_UNKNOWN_DISCOVERY_LEAD:'HOLD_UNKNOWN_DISCOVERY_LEAD',
  HOLD_UNSUPPORTED_ABSENCE_CLAIM:'HOLD_UNSUPPORTED_ABSENCE_CLAIM',
  READY_FOR_LINEAGE_REVIEW:'READY_FOR_LINEAGE_REVIEW',
  REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS:'REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS',
  REJECTED_MODEL_FIT_EVIDENCE_CLASS:'REJECTED_MODEL_FIT_EVIDENCE_CLASS',
});

export const INGREDIENT_PROBABILITY_RECORDED_DATASET_MEASUREMENT_SCOPE=Object.freeze({
  UNKNOWN:'UNKNOWN',
  INGREDIENT_HELP_EVENT_SPLIT:'INGREDIENT_HELP_EVENT_SPLIT',
  MAIN_SKILL_TRIGGER_TIMING:'MAIN_SKILL_TRIGGER_TIMING',
  OTHER_NON_INGREDIENT_PROBABILITY:'OTHER_NON_INGREDIENT_PROBABILITY',
});

const freeze=value=>Object.freeze(value);
const text=value=>String(value??'').normalize('NFKC').trim();
const nonEmptyArray=value=>Array.isArray(value)?value.map(text).filter(Boolean):[];

function leadById(leadId){
  const register=currentIngredientProbabilityIndependentCandidateDiscoveryRegister();
  return register.discovery_leads.find(row=>row.lead_id===text(leadId))||null;
}

function isHumanReviewedNonIngredientScope(input){
  const scope=text(input.resolved_measurement_scope);
  return input.measurement_scope_human_reviewed===true&&[
    INGREDIENT_PROBABILITY_RECORDED_DATASET_MEASUREMENT_SCOPE.MAIN_SKILL_TRIGGER_TIMING,
    INGREDIENT_PROBABILITY_RECORDED_DATASET_MEASUREMENT_SCOPE.OTHER_NON_INGREDIENT_PROBABILITY,
  ].includes(scope);
}

function mappedResolutionStatus({lead,intake,input,extraBlockers}){
  if(!lead)return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_UNKNOWN_DISCOVERY_LEAD;
  if(extraBlockers.includes('SOURCE_ABSENCE_CLAIM_REQUIRES_HUMAN_REVIEW'))return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_UNSUPPORTED_ABSENCE_CLAIM;
  if(isHumanReviewedNonIngredientScope(input))return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS;
  if(intake.status===INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS)return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS;
  if(intake.status===INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS)return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS;
  if(intake.status===INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.READY_FOR_LINEAGE_REVIEW)return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.READY_FOR_LINEAGE_REVIEW;
  if(!text(input.original_dataset_location))return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.OPEN_ORIGINAL_DATASET_NOT_LOCATED;
  return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_EVIDENCE_LOCATED_INTAKE_INCOMPLETE;
}

export function evaluateIngredientProbabilityRecordedDatasetResolution(input={}){
  const lead=leadById(input.discovery_lead_id);
  const resolutionEvidenceRefs=nonEmptyArray(input.resolution_evidence_refs);
  const absenceEvidenceRefs=nonEmptyArray(input.authoritative_absence_evidence_refs);
  const resolvedMeasurementScope=text(input.resolved_measurement_scope)||INGREDIENT_PROBABILITY_RECORDED_DATASET_MEASUREMENT_SCOPE.UNKNOWN;
  const extraBlockers=[];
  if(!lead)extraBlockers.push('DISCOVERY_LEAD_NOT_REGISTERED');
  if(!text(input.resolution_attempt_id))extraBlockers.push('RESOLUTION_ATTEMPT_ID_MISSING');
  if(!text(input.resolution_method))extraBlockers.push('RESOLUTION_METHOD_MISSING');
  if(!resolutionEvidenceRefs.length)extraBlockers.push('RESOLUTION_EVIDENCE_REFS_MISSING');
  if(input.source_absence_claimed===true)extraBlockers.push('SOURCE_ABSENCE_CLAIM_REQUIRES_HUMAN_REVIEW');
  if(text(input.original_dataset_location)&&resolvedMeasurementScope===INGREDIENT_PROBABILITY_RECORDED_DATASET_MEASUREMENT_SCOPE.UNKNOWN)extraBlockers.push('MEASUREMENT_SCOPE_NOT_RESOLVED');
  if(resolvedMeasurementScope!==INGREDIENT_PROBABILITY_RECORDED_DATASET_MEASUREMENT_SCOPE.UNKNOWN&&input.measurement_scope_human_reviewed!==true)extraBlockers.push('MEASUREMENT_SCOPE_HUMAN_REVIEW_REQUIRED');

  const intake=evaluateIndependentIngredientProbabilityCandidateIntake({
    discovery_lead_id:text(input.discovery_lead_id),
    source_id:text(input.source_id),
    source_name:text(input.source_name)||lead?.lead_name||'',
    numeric_evidence_class:input.numeric_evidence_class||INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.UNKNOWN,
    original_dataset_location:input.original_dataset_location,
    source_owner_or_research_group:input.source_owner_or_research_group,
    data_generation_methodology:input.data_generation_methodology,
    snapshot_hash_algorithm:input.snapshot_hash_algorithm,
    snapshot_hash:input.snapshot_hash,
    snapshot_scope_date:input.snapshot_scope_date,
    snapshot_release_id:input.snapshot_release_id,
    source_version:input.source_version,
    source_revision:input.source_revision,
    lineage_evidence_refs:input.lineage_evidence_refs,
    species_form_mapping_strategy:input.species_form_mapping_strategy,
    mapped_row_count:input.mapped_row_count,
    roster_row_count:input.roster_row_count,
    published_numeric_precision_preserved:input.published_numeric_precision_preserved,
    partial_coverage_reported_explicitly:input.partial_coverage_reported_explicitly,
    player_private_data_in_source:input.player_private_data_in_source,
    statistical_semantics:input.statistical_semantics,
    ingredient_event_count_field:input.ingredient_event_count_field,
    total_help_event_count_field:input.total_help_event_count_field,
    probability_value_field:input.probability_value_field,
  });

  const blockers=[...new Set([...(intake.blockers||[]),...extraBlockers])];
  const status=mappedResolutionStatus({lead,intake,input,extraBlockers});
  const ready=status===INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.READY_FOR_LINEAGE_REVIEW;
  const terminal=[
    INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS,
    INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS,
  ].includes(status);
  const scopeReject=isHumanReviewedNonIngredientScope(input);

  return freeze({
    schema:'pokemon-sleep-ingredient-probability-recorded-dataset-resolution-result/1.1',
    pack_id:INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_ID,
    pack_version:INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_VERSION,
    discovery_lead_id:text(input.discovery_lead_id)||null,
    discovery_lead_status:lead?.status||null,
    prior_discovery_blockers:freeze([...(lead?.blockers||[])]),
    resolution_attempt_id:text(input.resolution_attempt_id)||null,
    resolution_method:text(input.resolution_method)||null,
    resolution_status:status,
    resolution_terminal:terminal,
    original_dataset_location:text(input.original_dataset_location)||null,
    dataset_location_resolved:Boolean(text(input.original_dataset_location)),
    resolved_measurement_scope:resolvedMeasurementScope,
    measurement_scope_human_reviewed:input.measurement_scope_human_reviewed===true,
    ingredient_help_event_measurement_confirmed:resolvedMeasurementScope===INGREDIENT_PROBABILITY_RECORDED_DATASET_MEASUREMENT_SCOPE.INGREDIENT_HELP_EVENT_SPLIT,
    non_ingredient_probability_measurement_scope_confirmed:scopeReject,
    scope_resolution_reason:scopeReject?'LOCATED_DATASET_RECORDS_MAIN_SKILL_ACTIVATION_TIMESTAMPS_AND_COUNTS_NOT_INGREDIENT_VS_BERRY_HELP_EVENTS':null,
    source_absence_claimed:input.source_absence_claimed===true,
    source_absence_proven:false,
    resolution_evidence_refs:freeze(resolutionEvidenceRefs),
    authoritative_absence_evidence_refs:freeze(absenceEvidenceRefs),
    intake_result:intake,
    blockers:freeze(blockers),
    ready_for_lineage_review:ready,
    source_admission_granted:false,
    independent_crosscheck_granted:false,
    activation_authority_granted:false,
    production_active_dimensions:'4/7',
    next_action:ready
      ?'RUN_HUMAN_SOURCE_LINEAGE_REVIEW_AND_EXISTING_C4A_ADMISSION_GATE'
      :terminal
        ?'FIND_NEW_DIRECT_OBSERVATION_SOURCE;DO_NOT_ADMIT_THIS_EVIDENCE_CLASS_AS_INGREDIENT_PROBABILITY_REFERENCE'
        :status===INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.OPEN_ORIGINAL_DATASET_NOT_LOCATED
          ?'CONTINUE_LOCATING_ORIGINAL_DATASET_WITHOUT_TREATING_NOT_FOUND_AS_NONEXISTENT'
          :status===INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_UNSUPPORTED_ABSENCE_CLAIM
            ?'HUMAN_REVIEW_ANY_SOURCE_ABSENCE_CLAIM;DO_NOT_INFER_NONEXISTENCE_FROM_FAILED_SEARCH'
            :'RESOLVE_RECORDED_DATASET_EVIDENCE_PACK_BLOCKERS',
    safety:freeze({
      prior_discovery_blockers_are_immutable_current_blockers:false,
      not_found_means_nonexistent:false,
      resolution_pack_can_prove_source_absence:false,
      measurement_scope_resolution_implies_source_admission:false,
      resolution_pack_grants_source_admission:false,
      resolution_pack_grants_independent_crosscheck:false,
      resolution_pack_grants_activation:false,
      search_result_or_web_page_counts_as_snapshot:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}

export function currentIngredientProbabilityRecordedDatasetResolutionPack(){
  const register=currentIngredientProbabilityIndependentCandidateDiscoveryRegister();
  const intakeContract=currentIndependentIngredientProbabilityCandidateIntakeContract();
  const target=register.discovery_leads.find(row=>row.lead_id==='WIKIWIKI_HISTORICAL_RECORDED_DATA_MENTION');
  const current=evaluateIngredientProbabilityRecordedDatasetResolution({
    discovery_lead_id:target?.lead_id,
    resolution_attempt_id:'E3C7C6_WIKIWIKI_HISTORICAL_RECORDED_DATA_2026_08_18_B',
    resolution_method:'HUMAN_REVIEWED_HISTORICAL_WIKI_DATASET_SCOPE_RESOLUTION',
    source_id:'WIKIWIKI_HISTORICAL_MAIN_SKILL_ACTIVATION_RECORDS',
    source_name:target?.lead_name,
    numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.UNKNOWN,
    original_dataset_location:'https://wikiwiki.jp/poke_sleep/%E6%A4%9C%E8%A8%BC/%E3%83%A1%E3%82%A4%E3%83%B3%E3%82%B9%E3%82%AD%E3%83%AB%E3%81%AE%E3%82%AF%E3%83%BC%E3%83%AB%E3%82%BF%E3%82%A4%E3%83%A0',
    resolved_measurement_scope:INGREDIENT_PROBABILITY_RECORDED_DATASET_MEASUREMENT_SCOPE.MAIN_SKILL_TRIGGER_TIMING,
    measurement_scope_human_reviewed:true,
    data_generation_methodology:'Historical fixed-team records list main-skill activation timestamps and activation counts for cooldown/trigger verification; they do not record ingredient-result versus berry-result help events.',
    resolution_evidence_refs:[
      'https://wikiwiki.jp/poke_sleep/%E6%A4%9C%E8%A8%BC/%E3%83%A1%E3%82%A4%E3%83%B3%E3%82%B9%E3%82%AD%E3%83%AB%E3%81%AE%E3%82%AF%E3%83%BC%E3%83%AB%E3%82%BF%E3%82%A4%E3%83%A0',
      'https://wikiwiki.jp/poke_sleep/%E3%82%B3%E3%83%A1%E3%83%B3%E3%83%88/%E6%A4%9C%E8%A8%BC/%E3%83%A1%E3%82%A4%E3%83%B3%E3%82%B9%E3%82%AD%E3%83%AB%E3%81%AE%E3%82%AF%E3%83%BC%E3%83%AB%E3%82%BF%E3%82%A4%E3%83%A0',
      'https://wikiwiki.jp/poke_sleep/%E3%82%B3%E3%83%A1%E3%83%B3%E3%83%88/%E6%A4%9C%E8%A8%BC/%E9%A3%9F%E6%9D%90%E3%81%8A%E3%81%A6%E3%81%A4%E3%81%A0%E3%81%84%E7%A2%BA%E7%8E%87%E3%80%81%E3%82%B9%E3%82%AD%E3%83%AB%E7%99%BA%E7%94%9F%E7%A2%BA%E7%8E%87',
    ],
    source_absence_claimed:false,
  });
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-recorded-dataset-resolution-pack/1.1',
    pack_id:INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_ID,
    pack_version:INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_VERSION,
    resolution_scope_date:'2026-08-18',
    discovery_register_id:register.register_id,
    discovery_register_version:register.register_version,
    candidate_intake_contract_id:intakeContract.contract_id,
    candidate_intake_contract_version:intakeContract.contract_version,
    target_lead_count:target?1:0,
    open_resolution_count:current.resolution_terminal?0:1,
    ready_for_lineage_review_count:current.ready_for_lineage_review?1:0,
    terminal_non_measurement_resolution_count:current.resolution_status===INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS?1:0,
    accepted_independent_source_count:register.accepted_independent_source_count,
    resolutions:freeze([current]),
    required_evidence_fields:freeze([
      'original_dataset_location','source_owner_or_research_group','data_generation_methodology',
      'snapshot_hash_algorithm','snapshot_hash','snapshot_scope_date_or_release_id','source_version_or_revision',
      'lineage_evidence_refs','species_form_mapping_strategy','mapped_row_count','roster_row_count',
      'published_numeric_precision_preserved','partial_coverage_reported_explicitly','statistical_semantics',
    ]),
    production_probability_activation_allowed:false,
    production_active_dimensions:'4/7',
    next_action:'FIND_NEW_DIRECT_OBSERVATION_SOURCE_OR_COLLECT_GOVERNED_FIRST_PARTY_OBSERVATIONS',
    safety:freeze({
      unresolved_resolution_is_terminal_rejection:false,
      not_found_means_nonexistent:false,
      resolution_pack_can_prove_source_absence:false,
      measurement_scope_resolution_implies_source_admission:false,
      ready_for_lineage_review_implies_source_admission:false,
      accepted_independent_source_count_may_be_inferred_from_resolution_pack:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
