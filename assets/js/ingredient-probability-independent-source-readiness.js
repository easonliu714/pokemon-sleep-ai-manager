import {INDEPENDENT_CROSSCHECK_SOURCE_STATUS} from './ingredient-probability-independent-crosscheck-contract.js';
import {INDEPENDENT_SOURCE_ADMISSION_STATUS} from './ingredient-probability-independent-source-admission.js';
import {currentIngredientProbabilitySourceLineageReview} from './ingredient-probability-independent-source-lineage-review.js';

export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_READINESS_ID='ingredient-probability-independent-source-readiness-2026-08-17-b';
export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_READINESS_VERSION='ingredient-probability-independent-source-readiness-v2';

const freeze=value=>Object.freeze(value);

function sourceClassForLineage(row={}){
  if(row.lineage_class==='UPSTREAM_OR_SHARED_PRIMARY_NUMERIC_LINEAGE')return 'COMMUNITY_RESEARCH_OVERLAPPING_PRIMARY_LINEAGE';
  if(row.lineage_class==='DOWNSTREAM_TRANSCRIPTION_OF_OVERLAPPING_LINEAGE')return 'COMMUNITY_TRANSCRIPTION_OVERLAPPING_PRIMARY_LINEAGE';
  if(row.lineage_class==='FORK_OR_MIRROR_OF_PRIMARY_NUMERIC_LINEAGE')return 'PRIMARY_REPOSITORY_FORK_OR_MIRROR';
  if(row.lineage_class==='INDEPENDENT_LINEAGE_ACCEPTED')return 'INDEPENDENT_NUMERIC_SOURCE';
  return 'COMMUNITY_SOURCE_REQUIRES_LINEAGE_REVIEW';
}

function machineSnapshotStatus(row={}){
  if(row.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE||row.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_AI_OR_UNTRACEABLE)return 'NOT_APPLICABLE_REJECTED_LINEAGE';
  if(row.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.ADMISSION_READY_FOR_CROSSCHECK)return 'PINNED_AND_ADMISSION_READY';
  return 'NOT_PINNED_OR_NOT_ADMISSION_READY';
}

function blockersForReview(row={}){
  if(row.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.ADMISSION_READY_FOR_CROSSCHECK)return freeze([]);
  const values=[row.admission_reason||'SOURCE_ADMISSION_NOT_READY'];
  if(row.lineage_review_status==='NOT_REVIEWED'||row.lineage_review_status==='REVIEW_REQUIRED')values.push('HUMAN_REVIEWED_LINEAGE_INDEPENDENCE_NOT_COMPLETE');
  return freeze([...new Set(values)]);
}

const LINEAGE_REVIEW_SNAPSHOT=currentIngredientProbabilitySourceLineageReview();

export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_CANDIDATES=Object.freeze(
  LINEAGE_REVIEW_SNAPSHOT.reviews.map(row=>freeze({
    source_id:row.source_id,
    source_name:row.source_name,
    source_class:sourceClassForLineage(row),
    lineage_review_status:row.lineage_review_status,
    lineage_class:row.lineage_class,
    independence_status:row.admission_independence_status,
    admission_status:row.admission_status,
    admission_reason:row.admission_reason,
    machine_snapshot_status:machineSnapshotStatus(row),
    current_numeric_coverage_count:Number.isInteger(Number(row.mapped_row_count))?Number(row.mapped_row_count):null,
    may_count_as_independent_crosscheck:row.admission_may_count_as_independent_crosscheck===true,
    evidence_refs:Array.isArray(row.evidence_refs)?freeze([...row.evidence_refs]):freeze([]),
    blockers:blockersForReview(row),
  })),
);

export const INGREDIENT_PROBABILITY_DISALLOWED_INDEPENDENT_SOURCES=Object.freeze([
  freeze({source_class:'NEROLI_PRIMARY_OR_MIRROR',reason:'SAME_PRIMARY_LINEAGE_CANNOT_CROSSCHECK_ITSELF'}),
  freeze({source_class:'NEROLI_GITHUB_FORK_OR_LEGACY_SLEEPAPI_COPY',reason:'REPOSITORY_FORK_DOES_NOT_CREATE_SOURCE_INDEPENDENCE'}),
  freeze({source_class:'REFORMATTED_NEROLI_DATA',reason:'FORMAT_TRANSFORMATION_DOES_NOT_CREATE_SOURCE_INDEPENDENCE'}),
  freeze({source_class:'AI_SUMMARY_OR_GENERATED_TABLE',reason:'UNTRACEABLE_AI_OUTPUT_CANNOT_BE_NUMERIC_EVIDENCE'}),
  freeze({source_class:'SPECIALTY_INFERENCE',reason:'SPECIES_BASE_RATE_MAY_NOT_BE_INFERRED_FROM_SPECIALTY'}),
]);

export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_REQUIREMENTS=Object.freeze([
  'SOURCE_LINEAGE_INDEPENDENT_OF_NEROLI_PRIMARY',
  'HUMAN_REVIEWED_LINEAGE_INDEPENDENCE',
  'VERSIONED_OR_HASHED_SOURCE_SNAPSHOT',
  'SOURCE_DATE_OR_RELEASE_SCOPE',
  'PUBLISHED_NUMERIC_PRECISION_PRESERVED',
  'FORM_SAFE_MAPPING_TO_PUBLIC_242_KEY_ROSTER',
  'MACHINE_AUDITABLE_VALUE_AND_PROVENANCE_PER_CROSSCHECKED_ROW',
  'PARTIAL_COVERAGE_REPORTED_AS_PARTIAL',
  'NUMERIC_CONFLICTS_REMAIN_REVIEW_REQUIRED',
  'NO_INVENTED_NUMERIC_TOLERANCE',
  'NO_RUNTIME_NETWORK_FETCH',
  'NO_PLAYER_OR_SQLITE_WRITE',
  'NO_AI_NUMERIC_AUTHORITY',
]);

export function currentIngredientProbabilityIndependentSourceReadiness(){
  const candidates=INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_CANDIDATES;
  const accepted=candidates.filter(row=>row.independence_status===INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_ACCEPTED&&row.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.ADMISSION_READY_FOR_CROSSCHECK&&row.may_count_as_independent_crosscheck===true);
  const rejected=candidates.filter(row=>row.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE||row.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_AI_OR_UNTRACEABLE);
  const reviewRequired=candidates.filter(row=>row.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED);
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-independent-source-readiness/1.0',
    readiness_id:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_READINESS_ID,
    readiness_version:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_READINESS_VERSION,
    lineage_review_id:LINEAGE_REVIEW_SNAPSHOT.review_id,
    lineage_review_version:LINEAGE_REVIEW_SNAPSHOT.review_version,
    lineage_review_reconciled:true,
    status:accepted.length?'PARTIAL_OR_READY_SOURCE_AVAILABLE':'HOLD_NO_ACCEPTED_INDEPENDENT_NUMERIC_SOURCE',
    next_action:accepted.length?'RUN_PINNED_INDEPENDENT_CROSSCHECK':'FIND_GENUINELY_INDEPENDENT_NUMERIC_SOURCE_CANDIDATE',
    reviewed_candidate_count:candidates.length-reviewRequired.length,
    rejected_source_count:rejected.length,
    review_required_source_count:reviewRequired.length,
    accepted_source_count:accepted.length,
    candidates,
    disallowed_sources:INGREDIENT_PROBABILITY_DISALLOWED_INDEPENDENT_SOURCES,
    requirements:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_REQUIREMENTS,
    production_probability_activation_allowed:false,
    production_active_dimensions:'4/7',
    safety:freeze({
      stale_pre_lineage_review_candidate_status_allowed:false,
      same_primary_lineage_counts_as_independent:false,
      primary_repository_fork_counts_as_independent:false,
      repository_or_domain_difference_proves_independence:false,
      partial_coverage_implies_complete:false,
      missing_crosscheck_may_be_ai_filled:false,
      tolerance_may_be_invented:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
