import {
  INGREDIENT_PROBABILITY_DISCOVERY_LEAD_STATUS,
  currentIngredientProbabilityIndependentCandidateDiscoveryRegister,
} from './ingredient-probability-independent-candidate-discovery-register.js';
import {
  INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS,
  INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS,
  evaluateIndependentIngredientProbabilityCandidateIntake,
  currentIndependentIngredientProbabilityCandidateIntakeContract,
} from './ingredient-probability-independent-candidate-intake.js';

export const INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_ID='ingredient-probability-recorded-dataset-resolution-pack-2026-08-17-a';
export const INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_VERSION='ingredient-probability-recorded-dataset-resolution-pack-v1';

export const INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS=Object.freeze({
  OPEN_ORIGINAL_DATASET_NOT_LOCATED:'OPEN_ORIGINAL_DATASET_NOT_LOCATED',
  HOLD_EVIDENCE_LOCATED_INTAKE_INCOMPLETE:'HOLD_EVIDENCE_LOCATED_INTAKE_INCOMPLETE',
  HOLD_UNKNOWN_DISCOVERY_LEAD:'HOLD_UNKNOWN_DISCOVERY_LEAD',
  HOLD_UNSUPPORTED_ABSENCE_CLAIM:'HOLD_UNSUPPORTED_ABSENCE_CLAIM',
  READY_FOR_LINEAGE_REVIEW:'READY_FOR_LINEAGE_REVIEW',
  REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS:'REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS',
  REJECTED_MODEL_FIT_EVIDENCE_CLASS:'REJECTED_MODEL_FIT_EVIDENCE_CLASS',
});

const freeze=value=>Object.freeze(value);
const text=value=>String(value??'').normalize('NFKC').trim();
const nonEmptyArray=value=>Array.isArray(value)?value.map(text).filter(Boolean):[];

function leadById(leadId){
  const register=currentIngredientProbabilityIndependentCandidateDiscoveryRegister();
  return register.discovery_leads.find(row=>row.lead_id===text(leadId))||null;
}

function mappedResolutionStatus({lead,intake,input,extraBlockers}){
  if(!lead)return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_UNKNOWN_DISCOVERY_LEAD;
  if(extraBlockers.includes('SOURCE_ABSENCE_CLAIM_UNSUPPORTED'))return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_UNSUPPORTED_ABSENCE_CLAIM;
  if(intake.status===INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS)return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS;
  if(intake.status===INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS)return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS;
  if(intake.status===INGREDIENT_PROBABILITY_CANDIDATE_INTAKE_STATUS.READY_FOR_LINEAGE_REVIEW)return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.READY_FOR_LINEAGE_REVIEW;
  if(!text(input.original_dataset_location))return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.OPEN_ORIGINAL_DATASET_NOT_LOCATED;
  return INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.HOLD_EVIDENCE_LOCATED_INTAKE_INCOMPLETE;
}

export function evaluateIngredientProbabilityRecordedDatasetResolution(input={}){
  const lead=leadById(input.discovery_lead_id);
  const resolutionEvidenceRefs=nonEmptyArray(input.resolution_evidence_refs);
  const authoritativeAbsenceEvidenceRefs=nonEmptyArray(input.authoritative_absence_evidence_refs);
  const extraBlockers=[];
  if(!text(input.resolution_attempt_id))extraBlockers.push('RESOLUTION_ATTEMPT_ID_MISSING');
  if(!text(input.resolution_method))extraBlockers.push('RESOLUTION_METHOD_MISSING');
  if(!resolutionEvidenceRefs.length)extraBlockers.push('RESOLUTION_EVIDENCE_REFS_MISSING');
  if(input.source_absence_claimed===true&&!authoritativeAbsenceEvidenceRefs.length)extraBlockers.push('SOURCE_ABSENCE_CLAIM_UNSUPPORTED');

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

  const blockers=[...new Set([...(lead?.blockers||[]),...(intake.blockers||[]),...extraBlockers])];
  const status=mappedResolutionStatus({lead,intake,input,extraBlockers});
  const ready=status===INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.READY_FOR_LINEAGE_REVIEW;
  const terminal=[
    INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_NON_MEASUREMENT_EVIDENCE_CLASS,
    INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.REJECTED_MODEL_FIT_EVIDENCE_CLASS,
  ].includes(status);

  return freeze({
    schema:'pokemon-sleep-ingredient-probability-recorded-dataset-resolution-result/1.0',
    pack_id:INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_ID,
    pack_version:INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_VERSION,
    discovery_lead_id:text(input.discovery_lead_id)||null,
    discovery_lead_status:lead?.status||null,
    resolution_attempt_id:text(input.resolution_attempt_id)||null,
    resolution_method:text(input.resolution_method)||null,
    resolution_status:status,
    resolution_terminal:terminal,
    original_dataset_location:text(input.original_dataset_location)||null,
    dataset_location_resolved:Boolean(text(input.original_dataset_location)),
    source_absence_claimed:input.source_absence_claimed===true,
    source_absence_proven:input.source_absence_claimed===true&&authoritativeAbsenceEvidenceRefs.length>0,
    resolution_evidence_refs:freeze(resolutionEvidenceRefs),
    authoritative_absence_evidence_refs:freeze(authoritativeAbsenceEvidenceRefs),
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
        ?'DO_NOT_ADMIT_THIS_EVIDENCE_CLASS_AS_INGREDIENT_PROBABILITY_REFERENCE'
        :status===INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_STATUS.OPEN_ORIGINAL_DATASET_NOT_LOCATED
          ?'CONTINUE_LOCATING_ORIGINAL_DATASET_WITHOUT_TREATING_NOT_FOUND_AS_NONEXISTENT'
          :'RESOLVE_RECORDED_DATASET_EVIDENCE_PACK_BLOCKERS',
    safety:freeze({
      not_found_means_nonexistent:false,
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
    resolution_attempt_id:'E3C7C6_WIKIWIKI_HISTORICAL_RECORDED_DATA_2026_08_17_A',
    resolution_method:'GOVERNED_EVIDENCE_REFERENCE_REVIEW',
    source_id:'HISTORICAL_RECORDED_DATA_UNRESOLVED',
    source_name:target?.lead_name,
    numeric_evidence_class:INGREDIENT_PROBABILITY_CANDIDATE_EVIDENCE_CLASS.UNKNOWN,
    resolution_evidence_refs:target?.evidence_refs||[],
    source_absence_claimed:false,
  });
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-recorded-dataset-resolution-pack/1.0',
    pack_id:INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_ID,
    pack_version:INGREDIENT_PROBABILITY_RECORDED_DATASET_RESOLUTION_PACK_VERSION,
    resolution_scope_date:'2026-08-17',
    discovery_register_id:register.register_id,
    discovery_register_version:register.register_version,
    candidate_intake_contract_id:intakeContract.contract_id,
    candidate_intake_contract_version:intakeContract.contract_version,
    target_lead_count:target?1:0,
    open_resolution_count:current.resolution_terminal?0:1,
    ready_for_lineage_review_count:current.ready_for_lineage_review?1:0,
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
    safety:freeze({
      unresolved_resolution_is_terminal_rejection:false,
      not_found_means_nonexistent:false,
      ready_for_lineage_review_implies_source_admission:false,
      accepted_independent_source_count_may_be_inferred_from_resolution_pack:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
