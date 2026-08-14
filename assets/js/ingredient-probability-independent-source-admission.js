import {INDEPENDENT_CROSSCHECK_SOURCE_STATUS} from './ingredient-probability-independent-crosscheck-contract.js';

export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_ADMISSION_ID='ingredient-probability-independent-source-admission-2026-08-14-b';
export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_ADMISSION_VERSION='ingredient-probability-independent-source-admission-v1.1';

export const INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS=Object.freeze({
  NOT_REVIEWED:'NOT_REVIEWED',
  REVIEW_REQUIRED:'REVIEW_REQUIRED',
  HUMAN_REVIEWED_ACCEPTED:'HUMAN_REVIEWED_ACCEPTED',
  HUMAN_REVIEWED_REJECTED:'HUMAN_REVIEWED_REJECTED',
});

export const INDEPENDENT_SOURCE_ADMISSION_STATUS=Object.freeze({
  ADMISSION_READY_FOR_CROSSCHECK:'ADMISSION_READY_FOR_CROSSCHECK',
  REVIEW_REQUIRED:'REVIEW_REQUIRED',
  REJECTED_PRIMARY_LINEAGE:'REJECTED_PRIMARY_LINEAGE',
  REJECTED_AI_OR_UNTRACEABLE:'REJECTED_AI_OR_UNTRACEABLE',
});

const text=value=>String(value??'').normalize('NFKC').trim();
const freeze=value=>Object.freeze(value);
const nonEmptyArray=value=>Array.isArray(value)&&value.map(text).filter(Boolean).length>0;

export const INDEPENDENT_SOURCE_ADMISSION_REQUIREMENTS=Object.freeze([
  'HUMAN_REVIEWED_LINEAGE_INDEPENDENCE',
  'LINEAGE_EVIDENCE_REFS_NONEMPTY',
  'NO_OVERLAP_WITH_PRIMARY_NUMERIC_LINEAGE_IN_ANY_DIRECTION',
  'PINNED_SNAPSHOT_HASH',
  'SNAPSHOT_SCOPE_DATE_OR_RELEASE_ID',
  'SOURCE_VERSION_OR_REVISION',
  'FORM_SAFE_ROSTER_MAPPING_AUDIT',
  'MAPPED_ROW_COUNT_EXPLICIT',
  'PUBLISHED_NUMERIC_PRECISION_PRESERVED',
  'PARSER_OR_EXTRACTION_VERSION_PINNED',
  'PARTIAL_COVERAGE_REPORTED_AS_PARTIAL',
  'NO_PRIMARY_NEROLI_DERIVATION_OR_MIRROR',
  'NO_AI_GENERATED_NUMERIC_SOURCE',
]);

export function evaluateIndependentIngredientProbabilitySourceAdmission(source={}){
  const sourceId=text(source.source_id);
  if(!sourceId)return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'SOURCE_ID_MISSING',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(source.overlaps_primary_numeric_lineage===true||source.derived_from_neroli_primary===true||source.mirror_of_neroli_primary===true)return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE,reason:source.overlaps_primary_numeric_lineage===true?'OVERLAPPING_PRIMARY_NUMERIC_LINEAGE_CANNOT_BE_INDEPENDENT':'PRIMARY_LINEAGE_OR_MIRROR_CANNOT_BE_INDEPENDENT',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.DERIVED_OR_MIRROR_OF_PRIMARY,may_count_as_independent_crosscheck:false});
  if(source.ai_generated_numeric_source===true||source.untraceable_summary===true)return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_AI_OR_UNTRACEABLE,reason:'AI_OR_UNTRACEABLE_NUMERIC_SOURCE_REJECTED',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.AI_OR_UNTRACEABLE_SUMMARY,may_count_as_independent_crosscheck:false});
  if(source.lineage_review_status!==INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_ACCEPTED)return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'HUMAN_REVIEWED_LINEAGE_INDEPENDENCE_MISSING',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(!nonEmptyArray(source.lineage_evidence_refs))return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'LINEAGE_EVIDENCE_REFS_MISSING',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(!text(source.snapshot_hash)||!text(source.snapshot_hash_algorithm))return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'PINNED_SNAPSHOT_HASH_MISSING',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(!text(source.snapshot_scope_date)&&!text(source.snapshot_release_id))return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'SNAPSHOT_SCOPE_MISSING',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(!text(source.source_version)&&!text(source.source_revision))return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'SOURCE_VERSION_OR_REVISION_MISSING',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(!text(source.parser_version))return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'PARSER_VERSION_MISSING',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  const mapped=Number(source.mapped_row_count),roster=Number(source.roster_row_count);
  if(!Number.isInteger(mapped)||mapped<0||!Number.isInteger(roster)||roster<=0||mapped>roster)return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'MAPPED_OR_ROSTER_ROW_COUNT_INVALID',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(source.form_safe_mapping_audit_passed!==true)return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'FORM_SAFE_MAPPING_AUDIT_NOT_PASSED',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(source.published_numeric_precision_preserved!==true)return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'PUBLISHED_NUMERIC_PRECISION_NOT_PRESERVED',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  if(source.partial_coverage_reported_explicitly!==true)return freeze({status:INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED,reason:'PARTIAL_COVERAGE_REPORTING_CONTRACT_MISSING',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,may_count_as_independent_crosscheck:false});
  return freeze({
    status:INDEPENDENT_SOURCE_ADMISSION_STATUS.ADMISSION_READY_FOR_CROSSCHECK,
    reason:null,
    independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_ACCEPTED,
    may_count_as_independent_crosscheck:true,
    source_id:sourceId,
    mapped_row_count:mapped,
    roster_row_count:roster,
    coverage_ratio:mapped/roster,
    complete_coverage:mapped===roster,
    activation_authority_granted:false,
  });
}

export function currentIndependentIngredientProbabilitySourceAdmissionContract(){
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-independent-source-admission/1.1',
    contract_id:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_ADMISSION_ID,
    contract_version:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_ADMISSION_VERSION,
    requirements:INDEPENDENT_SOURCE_ADMISSION_REQUIREMENTS,
    automatic_source_acceptance:false,
    human_lineage_review_required:true,
    activation_authority_granted:false,
    safety:freeze({
      self_asserted_independence_sufficient:false,
      same_primary_lineage_counts_as_independent:false,
      upstream_primary_supplier_counts_as_independent:false,
      downstream_transcription_counts_as_independent:false,
      partial_coverage_implies_complete:false,
      exact_match_implies_activation:false,
      ai_generated_numeric_source_allowed:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
