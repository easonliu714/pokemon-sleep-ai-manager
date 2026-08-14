import {INDEPENDENT_CROSSCHECK_SOURCE_STATUS} from './ingredient-probability-independent-crosscheck-contract.js';

export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_READINESS_ID='ingredient-probability-independent-source-readiness-2026-08-14-a';
export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_READINESS_VERSION='ingredient-probability-independent-source-readiness-v1';

export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_CANDIDATES=Object.freeze([
  Object.freeze({
    source_id:'RAENONX_PRODUCTION_RATES',
    source_name:'RaenonX Pokémon Sleep Production Rates',
    source_class:'COMMUNITY_RESEARCH_CANDIDATE',
    independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,
    machine_snapshot_status:'NOT_PINNED',
    current_numeric_coverage_count:null,
    may_count_as_independent_crosscheck:false,
    blockers:Object.freeze(['SOURCE_LINEAGE_INDEPENDENCE_NOT_DOCUMENTED','VERSIONED_MACHINE_READABLE_SNAPSHOT_NOT_PINNED','242_KEY_MAPPING_NOT_AUDITED']),
  }),
  Object.freeze({
    source_id:'POKEMON_SLEEP_VERIFICATION_WIKI',
    source_name:'ポケモンスリープ攻略・検証 Wiki',
    source_class:'COMMUNITY_VERIFICATION_CANDIDATE',
    independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,
    machine_snapshot_status:'NOT_PINNED',
    current_numeric_coverage_count:null,
    may_count_as_independent_crosscheck:false,
    blockers:Object.freeze(['PER_SPECIES_NUMERIC_RATE_COVERAGE_NOT_ESTABLISHED','VERSIONED_MACHINE_READABLE_SNAPSHOT_NOT_PINNED','242_KEY_MAPPING_NOT_AUDITED']),
  }),
]);

export const INGREDIENT_PROBABILITY_DISALLOWED_INDEPENDENT_SOURCES=Object.freeze([
  Object.freeze({source_class:'NEROLI_PRIMARY_OR_MIRROR',reason:'SAME_PRIMARY_LINEAGE_CANNOT_CROSSCHECK_ITSELF'}),
  Object.freeze({source_class:'REFORMATTED_NEROLI_DATA',reason:'FORMAT_TRANSFORMATION_DOES_NOT_CREATE_SOURCE_INDEPENDENCE'}),
  Object.freeze({source_class:'AI_SUMMARY_OR_GENERATED_TABLE',reason:'UNTRACEABLE_AI_OUTPUT_CANNOT_BE_NUMERIC_EVIDENCE'}),
  Object.freeze({source_class:'SPECIALTY_INFERENCE',reason:'SPECIES_BASE_RATE_MAY_NOT_BE_INFERRED_FROM_SPECIALTY'}),
]);

export const INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_REQUIREMENTS=Object.freeze([
  'SOURCE_LINEAGE_INDEPENDENT_OF_NEROLI_PRIMARY',
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
  const accepted=INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_CANDIDATES.filter(row=>row.independence_status===INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_ACCEPTED&&row.machine_snapshot_status==='PINNED'&&row.may_count_as_independent_crosscheck===true);
  return Object.freeze({
    schema:'pokemon-sleep-ingredient-probability-independent-source-readiness/1.0',
    readiness_id:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_READINESS_ID,
    readiness_version:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_READINESS_VERSION,
    status:accepted.length?'PARTIAL_OR_READY_SOURCE_AVAILABLE':'HOLD_NO_ACCEPTED_INDEPENDENT_NUMERIC_SOURCE',
    accepted_source_count:accepted.length,
    candidates:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_CANDIDATES,
    disallowed_sources:INGREDIENT_PROBABILITY_DISALLOWED_INDEPENDENT_SOURCES,
    requirements:INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_REQUIREMENTS,
    production_probability_activation_allowed:false,
    safety:Object.freeze({
      same_primary_lineage_counts_as_independent:false,
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
