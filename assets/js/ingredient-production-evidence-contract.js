export const INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID='ingredient-production-evidence-boundary-2026-08-14-a';
export const INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION='ingredient-production-evidence-contract-v1';

export const INGREDIENT_PRODUCTION_DIMENSIONS=Object.freeze({
  INGREDIENT_PROBABILITY_PER_HELP:'ingredient_probability_per_help',
  INGREDIENT_SLOT_DISTRIBUTION:'ingredient_slot_distribution',
  INGREDIENT_COMBINATION_ASSIGNMENT_PROBABILITY:'ingredient_combination_assignment_probability',
});

export const INGREDIENT_EVIDENCE_STATUS=Object.freeze({
  NOT_YET_VERIFIED:'NOT_YET_VERIFIED',
  REFERENCE_EVIDENCE_IDENTIFIED:'REFERENCE_EVIDENCE_IDENTIFIED',
  OUT_OF_SCOPE_IDENTITY_GENERATION:'OUT_OF_SCOPE_IDENTITY_GENERATION',
});

const freeze=value=>Object.freeze(value);
const refs=value=>freeze(value.map(row=>freeze({...row})));

export const INGREDIENT_PRODUCTION_EVIDENCE_SOURCES=freeze({
  official_ingredient_chance_existence:freeze({
    source_id:'pokemon-sleep-official-v3.5.0-ingredient-finding-chance-adjustment',
    source_tier:'OFFICIAL_MECHANIC_EXISTENCE_ONLY',
    source_name:'Pokémon Sleep official Update Contents version 3.5.0',
    source_ref:'https://www.pokemonsleep.net/en/news/343031373938353238393032333635313837/',
    observed_at:'2026-08-14',
    supports:freeze(['ingredient_probability_per_help:MECHANIC_EXISTS_AND_CAN_BE_BALANCE_ADJUSTED']),
    does_not_support:freeze(['EXACT_SPECIES_BASE_RATE','INGREDIENT_SLOT_WEIGHT']),
  }),
  raenonx_production_rates:freeze({
    source_id:'raenonx-production-rates-current-reference-2026-08-14',
    source_tier:'COMMUNITY_FIRST_HAND_REFERENCE_NUMERIC',
    source_name:'RaenonX Pokémon Sleep Wiki - Production Rates',
    source_ref:'https://hackmd.io/@raenonx-pokemon-sleep/B1Rhup7l-x',
    observed_at:'2026-08-14',
    supports:freeze(['SPECIES_DEPENDENT_INGREDIENT_RATE_REFERENCE','INGREDIENT_RATE_NOT_VISIBLE_IN_GAME']),
    does_not_support:freeze(['LOCAL_VERSIONED_SPECIES_RATE_MASTER_PRESENT','RUNTIME_NETWORK_AUTHORITY']),
  }),
  verification_wiki_unlocked_slot_selection:freeze({
    source_id:'pokemon-sleep-verification-wiki-ingredient-slot-selection-2026-08-14',
    source_tier:'COMMUNITY_MECHANICS_REFERENCE',
    source_name:'ポケモンスリープ攻略・検証 Wiki - 食材',
    source_ref:'https://wikiwiki.jp/poke_sleep/%E9%A3%9F%E6%9D%90',
    observed_at:'2026-08-14',
    supports:freeze(['REFERENCE_EQUAL_SELECTION_AMONG_CURRENTLY_UNLOCKED_INGREDIENT_SLOTS']),
    does_not_support:freeze(['LOCAL_GOVERNED_SLOT_DISTRIBUTION_CONTRACT_PRESENT','OFFICIAL_NUMERIC_PUBLICATION']),
  }),
  raenonx_ingredient_combination:freeze({
    source_id:'raenonx-ingredient-combination-assignment-2026-08-14',
    source_tier:'COMMUNITY_FIRST_HAND_IDENTITY_GENERATION_RESEARCH',
    source_name:'RaenonX Pokémon Sleep Wiki - Ingredient Combination',
    source_ref:'https://hackmd.io/@raenonx-pokemon-sleep/rJj6yeIlWe',
    observed_at:'2026-08-14',
    supports:freeze(['CATCH_TIME_INGREDIENT_COMBINATION_ASSIGNMENT_PROBABILITY']),
    does_not_support:freeze(['PER_HELP_INGREDIENT_SLOT_DISTRIBUTION','SPECIES_INGREDIENT_RESULT_RATE']),
  }),
});

export const INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY=freeze({
  ingredient_probability_per_help:freeze({
    dimension:INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_PROBABILITY_PER_HELP,
    semantic:'Conditional on a normal item-producing help, probability that the result is ingredients rather than berries before individual ingredient-probability modifiers.',
    lifecycle:'PRODUCTION_TIME',
    authority_status:INGREDIENT_EVIDENCE_STATUS.NOT_YET_VERIFIED,
    runtime_numeric_activation:false,
    source_refs:refs([
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.official_ingredient_chance_existence,
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.raenonx_production_rates,
    ]),
    blockers:freeze([
      'LOCAL_VERSIONED_SPECIES_BASE_INGREDIENT_RATE_MASTER_MISSING',
      'FULL_CURRENT_SPECIES_PROVENANCE_COVERAGE_MISSING',
      'DETERMINISTIC_FIXTURE_ANCHORS_MISSING',
    ]),
    activation_requirements:freeze([
      'versioned_local_species_rate_master',
      'explicit_source_and_observed_at_per_row',
      'current_species_coverage_gate',
      'deterministic_modifier_order_contract',
      'fail_closed_unknown_species_fixture',
      'no_runtime_network_fetch',
    ]),
  }),
  ingredient_slot_distribution:freeze({
    dimension:INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_SLOT_DISTRIBUTION,
    semantic:'Conditional on an ingredient-result help, distribution used to choose among ingredient slots already unlocked for that individual at its current level.',
    lifecycle:'PRODUCTION_TIME',
    authority_status:INGREDIENT_EVIDENCE_STATUS.NOT_YET_VERIFIED,
    runtime_numeric_activation:false,
    source_refs:refs([
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.verification_wiki_unlocked_slot_selection,
    ]),
    reference_candidate_rule:'EQUAL_SELECTION_AMONG_CURRENTLY_UNLOCKED_INGREDIENT_SLOTS',
    reference_candidate_weights:freeze({level_1:'1',level_30:'1/2_each_unlocked_slot',level_60:'1/3_each_unlocked_slot'}),
    blockers:freeze([
      'LOCAL_GOVERNED_PRODUCTION_SLOT_SELECTION_CONTRACT_MISSING',
      'INDEPENDENT_CROSSCHECK_OR_LOCAL_OBSERVATION_FIXTURE_MISSING',
      'EDGE_CASE_CONTRACT_FOR_DUPLICATE_INGREDIENT_NAMES_MISSING',
    ]),
    activation_requirements:freeze([
      'governed_local_slot_selection_contract',
      'independent_current_mechanics_crosscheck',
      'level_1_30_60_deterministic_fixtures',
      'duplicate_ingredient_name_slot_identity_fixture',
      'locked_slot_exclusion_fixture',
      'no_runtime_network_fetch',
    ]),
  }),
  ingredient_combination_assignment_probability:freeze({
    dimension:INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_COMBINATION_ASSIGNMENT_PROBABILITY,
    semantic:'Probability distribution used when an individual is generated/befriended to assign its Lv.30/Lv.60 ingredient identities (AAA/AAB/AAC/ABA/ABB/ABC and legacy two-option variants).',
    lifecycle:'IDENTITY_GENERATION_TIME',
    authority_status:INGREDIENT_EVIDENCE_STATUS.OUT_OF_SCOPE_IDENTITY_GENERATION,
    runtime_numeric_activation:false,
    source_refs:refs([
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.raenonx_ingredient_combination,
    ]),
    production_model_eligible:false,
    forbidden_substitutions:freeze([
      'ingredient_slot_distribution',
      'ingredient_probability_per_help',
    ]),
  }),
});

export function ingredientProductionEvidenceBoundary(){
  return freeze({
    schema:'pokemon-sleep-ingredient-production-evidence-boundary/1.0',
    contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
    contract_version:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION,
    dimensions:INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY,
    numeric_activation_count:0,
    production_dimensions_ready:freeze([]),
    production_dimensions_hold:freeze([
      INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_PROBABILITY_PER_HELP,
      INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_SLOT_DISTRIBUTION,
    ]),
    safety:freeze({
      missing_is_zero:false,
      ai_numeric_authority:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      catch_assignment_may_substitute_production_distribution:false,
    }),
  });
}

export function ingredientProductionDimensionEvidence(dimension){
  return INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY[String(dimension||'')]||null;
}

export function isIngredientProductionDimensionActive(dimension){
  const row=ingredientProductionDimensionEvidence(dimension);
  return Boolean(row&&row.lifecycle==='PRODUCTION_TIME'&&row.authority_status==='ACTIVE_VERIFIED'&&row.runtime_numeric_activation===true);
}
