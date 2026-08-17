import {
  INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS,
  evaluateIndependentIngredientProbabilitySourceAdmission,
} from './ingredient-probability-independent-source-admission.js';

export const INGREDIENT_PROBABILITY_SOURCE_LINEAGE_REVIEW_ID='ingredient-probability-source-lineage-review-2026-08-17-b';
export const INGREDIENT_PROBABILITY_SOURCE_LINEAGE_REVIEW_VERSION='ingredient-probability-source-lineage-review-v2';

export const SOURCE_LINEAGE_CLASS=Object.freeze({
  UPSTREAM_OR_SHARED_PRIMARY_NUMERIC_LINEAGE:'UPSTREAM_OR_SHARED_PRIMARY_NUMERIC_LINEAGE',
  DOWNSTREAM_TRANSCRIPTION_OF_OVERLAPPING_LINEAGE:'DOWNSTREAM_TRANSCRIPTION_OF_OVERLAPPING_LINEAGE',
  FORK_OR_MIRROR_OF_PRIMARY_NUMERIC_LINEAGE:'FORK_OR_MIRROR_OF_PRIMARY_NUMERIC_LINEAGE',
  INDEPENDENT_LINEAGE_NOT_YET_PROVEN:'INDEPENDENT_LINEAGE_NOT_YET_PROVEN',
  INDEPENDENT_LINEAGE_ACCEPTED:'INDEPENDENT_LINEAGE_ACCEPTED',
});

const freeze=value=>Object.freeze(value);

export const INGREDIENT_PROBABILITY_SOURCE_LINEAGE_REVIEWS=Object.freeze([
  freeze({
    source_id:'RAENONX_PRODUCTION_RATES',
    source_name:'RaenonX Pokémon Sleep Production Rates',
    lineage_review_status:INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_REJECTED,
    lineage_class:SOURCE_LINEAGE_CLASS.UPSTREAM_OR_SHARED_PRIMARY_NUMERIC_LINEAGE,
    overlaps_primary_numeric_lineage:true,
    may_count_as_independent_crosscheck:false,
    reviewed_at:'2026-08-14',
    evidence_refs:freeze([
      'NEROLI_PINNED_CREDITS:fc36317b195125c63bf56d3777fa3ed1a9548831:frontend/src/pages/credits/credits-page.vue',
      'NEROLI_COMMIT:63b0a17e2e92fc9e5d4be03c695e5896be8a0f25:SHELGON_INGREDIENT_PERCENTAGE_20.6_PER_RAENONX',
      'NEROLI_COMMIT:6f366273d0ecf231f0adaa0a3861025c24000b81:PUMPKABOO_GOURGEIST_STATS_FROM_RAENONX_POKEDEX',
      'NEROLI_COMMIT:2bc560a50f78f7c5c6d115f1d529ead1505cb588:HAWLUCHA_STATS_DATA_SOURCE_RAENONX',
    ]),
    rationale:'NEROLI_PRIMARY_NUMERIC_DATA_HAS_DOCUMENTED_RAENONX_INPUT_SO_RAENONX_CANNOT_CROSSCHECK_THAT_LINEAGE_AS_AN_INDEPENDENT_SOURCE',
  }),
  freeze({
    source_id:'POKEMON_SLEEP_VERIFICATION_WIKI',
    source_name:'ポケモンスリープ攻略・検証 Wiki',
    lineage_review_status:INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_REJECTED,
    lineage_class:SOURCE_LINEAGE_CLASS.DOWNSTREAM_TRANSCRIPTION_OF_OVERLAPPING_LINEAGE,
    overlaps_primary_numeric_lineage:true,
    may_count_as_independent_crosscheck:false,
    reviewed_at:'2026-08-14',
    evidence_refs:freeze([
      'WIKIWIKI_EDIT_PAGE_LAST_MODIFIED_2026-07-14:EDITOR_INSTRUCTION_TRANSCRIBE_VALUES_FROM_RAENONX_POKEMON_STATS_PRODUCTION_COMPARISON',
      'WIKIWIKI_ESTIMATE_PAGE_LAST_MODIFIED_2026-07-28:REFERENCE_RAENONX_POKEMON_STATS_PRODUCTION_COMPARISON',
    ]),
    rationale:'WIKI_NUMERIC_TABLE_IS_DOCUMENTED_AS_A_RAENONX_TRANSCRIPTION_AND_RAENONX_ALREADY_OVERLAPS_THE_NEROLI_PRIMARY_LINEAGE',
  }),
  freeze({
    source_id:'SLEEPAPI_GITHUB_FORK',
    source_name:'SleepAPI GitHub forks / legacy SleepAPI repository copies',
    lineage_review_status:INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_REJECTED,
    lineage_class:SOURCE_LINEAGE_CLASS.FORK_OR_MIRROR_OF_PRIMARY_NUMERIC_LINEAGE,
    mirror_of_neroli_primary:true,
    may_count_as_independent_crosscheck:false,
    reviewed_at:'2026-08-17',
    evidence_refs:freeze([
      'GITHUB_REPOSITORY_METADATA:extraBottle/SleepAPI:FORK=true:PARENT=nerolis-lab/nerolis-lab:SOURCE=nerolis-lab/nerolis-lab',
      'GITHUB_REPOSITORY_METADATA:extraBottle/SleepAPI:HOMEPAGE=https://sleepapi.net',
      'NEROLI_CURRENT_REPOSITORY_TOPICS:api,sleepapi,pokemonsleep',
    ]),
    rationale:'A_GITHUB_FORK_OR_LEGACY_REPOSITORY_COPY_OF_NEROLI_CANNOT_CREATE_AN_INDEPENDENT_NUMERIC_LINEAGE_FROM_THE_PRIMARY_REFERENCE_MODEL',
  }),
]);

export function currentIngredientProbabilitySourceLineageReview(){
  const reviews=INGREDIENT_PROBABILITY_SOURCE_LINEAGE_REVIEWS.map(row=>{
    const admission=evaluateIndependentIngredientProbabilitySourceAdmission({
      source_id:row.source_id,
      lineage_review_status:row.lineage_review_status,
      lineage_evidence_refs:row.evidence_refs,
      overlaps_primary_numeric_lineage:row.overlaps_primary_numeric_lineage,
      derived_from_neroli_primary:row.derived_from_neroli_primary,
      mirror_of_neroli_primary:row.mirror_of_neroli_primary,
    });
    return freeze({
      ...row,
      admission_status:admission.status,
      admission_reason:admission.reason,
      admission_independence_status:admission.independence_status,
      admission_may_count_as_independent_crosscheck:admission.may_count_as_independent_crosscheck===true,
    });
  });
  const accepted=reviews.filter(row=>row.admission_may_count_as_independent_crosscheck===true);
  const rejected=reviews.filter(row=>row.lineage_review_status===INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_REJECTED);
  return freeze({
    schema:'pokemon-sleep-ingredient-probability-source-lineage-review/1.0',
    review_id:INGREDIENT_PROBABILITY_SOURCE_LINEAGE_REVIEW_ID,
    review_version:INGREDIENT_PROBABILITY_SOURCE_LINEAGE_REVIEW_VERSION,
    reviewed_candidate_count:reviews.length,
    rejected_candidate_count:rejected.length,
    accepted_independent_source_count:accepted.length,
    reviews:freeze(reviews),
    status:accepted.length?'INDEPENDENT_SOURCE_AVAILABLE':'HOLD_NEED_NEW_INDEPENDENT_SOURCE_CANDIDATE',
    production_probability_activation_allowed:false,
    safety:freeze({
      upstream_primary_supplier_counts_as_independent:false,
      downstream_transcription_counts_as_independent:false,
      overlapping_numeric_lineage_counts_as_independent:false,
      primary_repository_fork_counts_as_independent:false,
      repository_or_domain_difference_proves_independence:false,
      rejection_requires_full_242_snapshot:false,
      row_self_asserted_independence_allowed:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
