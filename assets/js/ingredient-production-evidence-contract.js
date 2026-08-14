import {
  SPECIES_INGREDIENT_RATE_REFERENCE_VERSION,
  SPECIES_INGREDIENT_RATE_REFERENCE_STATUS,
} from './public-species-ingredient-rate-reference.js';
import {INGREDIENT_PROBABILITY_REFERENCE_CONTRACT_VERSION} from './ingredient-probability-reference-contract.js';

export const INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID='ingredient-production-evidence-boundary-2026-08-14-b';
export const INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION='ingredient-production-evidence-contract-v1.1';

export const INGREDIENT_PRODUCTION_DIMENSIONS=Object.freeze({
  INGREDIENT_PROBABILITY_PER_HELP:'ingredient_probability_per_help',
  INGREDIENT_SLOT_DISTRIBUTION:'ingredient_slot_distribution',
  INGREDIENT_COMBINATION_ASSIGNMENT_PROBABILITY:'ingredient_combination_assignment_probability',
});

const freeze=value=>Object.freeze(value);
const source=(source_id,source_tier,source_name,source_ref,supports,does_not_support)=>freeze({
  source_id,source_tier,source_name,source_ref,
  observed_at:'2026-08-14',
  supports:freeze([...supports]),
  does_not_support:freeze([...does_not_support]),
});

export const INGREDIENT_PRODUCTION_EVIDENCE_SOURCES=freeze({
  official_mechanic_existence:source(
    'pokemon-sleep-official-v3.5.0-ingredient-finding-chance-adjustment',
    'OFFICIAL_MECHANIC_EXISTENCE_ONLY',
    'Pokémon Sleep official Update Contents version 3.5.0',
    'https://www.pokemonsleep.net/en/news/343031373938353238393032333635313837/',
    ['INGREDIENT_FINDING_CHANCE_IS_A_REAL_BALANCE_ADJUSTABLE_HELPING_PARAMETER'],
    ['EXACT_SPECIES_BASE_RATE','PRODUCTION_TIME_INGREDIENT_SLOT_WEIGHT'],
  ),
  local_species_rate_reference:source(
    SPECIES_INGREDIENT_RATE_REFERENCE_VERSION,
    'LOCAL_REFERENCE_ONLY_COMMUNITY_DERIVED',
    'Local pinned species/form ingredient-rate reference snapshot',
    `internal:${SPECIES_INGREDIENT_RATE_REFERENCE_VERSION}`,
    ['VERSIONED_LOCAL_REFERENCE_ROWS','FORM_SAFE_REFERENCE_IDENTITY','REFERENCE_PROJECTION_INPUT'],
    ['COMPLETE_ACTIVATION_MASTER','ACTIVE_VERIFIED_PRODUCTION_AUTHORITY'],
  ),
  local_probability_composition_reference:source(
    INGREDIENT_PROBABILITY_REFERENCE_CONTRACT_VERSION,
    'LOCAL_REFERENCE_ONLY_COMPOSITION_CONTRACT',
    'Local ingredient probability reference composition contract',
    `internal:${INGREDIENT_PROBABILITY_REFERENCE_CONTRACT_VERSION}`,
    ['REFERENCE_ONLY_NATURE_AND_SUBSKILL_COMPOSITION'],
    ['ACTIVE_VERIFIED_PRODUCTION_AUTHORITY'],
  ),
  unlocked_slot_selection_reference:source(
    'pokemon-sleep-verification-wiki-ingredient-slot-selection-2026-08-14',
    'COMMUNITY_MECHANICS_REFERENCE',
    'ポケモンスリープ攻略・検証 Wiki - 食材',
    'https://wikiwiki.jp/poke_sleep/%E9%A3%9F%E6%9D%90',
    ['REFERENCE_EQUAL_SELECTION_AMONG_CURRENTLY_UNLOCKED_INGREDIENT_SLOTS'],
    ['LOCAL_GOVERNED_SLOT_DISTRIBUTION_CONTRACT','OFFICIAL_NUMERIC_PUBLICATION'],
  ),
  catch_assignment_reference:source(
    'raenonx-ingredient-combination-assignment-2026-08-14',
    'COMMUNITY_FIRST_HAND_IDENTITY_GENERATION_RESEARCH',
    'RaenonX Pokémon Sleep Wiki - Ingredient Combination',
    'https://hackmd.io/@raenonx-pokemon-sleep/rJj6yeIlWe',
    ['CATCH_TIME_INGREDIENT_COMBINATION_ASSIGNMENT_PROBABILITY'],
    ['PER_HELP_INGREDIENT_SLOT_DISTRIBUTION','SPECIES_INGREDIENT_RESULT_RATE'],
  ),
});

export const INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY=freeze({
  ingredient_probability_per_help:freeze({
    dimension:INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_PROBABILITY_PER_HELP,
    lifecycle:'PRODUCTION_TIME',
    semantic:'For a normal item-producing help, probability that the result is ingredients rather than berries before/with governed individual modifiers.',
    authority_status:'NOT_YET_VERIFIED',
    runtime_numeric_activation:false,
    current_reference_status:SPECIES_INGREDIENT_RATE_REFERENCE_STATUS,
    source_refs:freeze([
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.official_mechanic_existence,
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.local_species_rate_reference,
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.local_probability_composition_reference,
    ]),
    blockers:freeze([
      'SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED',
      'COMPLETE_CURRENT_SPECIES_FORM_ACTIVATION_COVERAGE_MISSING',
      'ACCEPTED_NUMERIC_EVIDENCE_POLICY_MISSING',
    ]),
    activation_requirements:freeze([
      'accepted_versioned_activation_master',
      'complete_current_species_form_coverage',
      'explicit_provenance_per_row',
      'accepted_modifier_order_contract',
      'fail_closed_unknown_or_ambiguous_form_fixture',
      'no_runtime_network_fetch',
    ]),
  }),
  ingredient_slot_distribution:freeze({
    dimension:INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_SLOT_DISTRIBUTION,
    lifecycle:'PRODUCTION_TIME',
    semantic:'Conditional on an ingredient-result help, distribution used to choose among ingredient slots already unlocked for that individual at its current level.',
    authority_status:'NOT_YET_VERIFIED',
    runtime_numeric_activation:false,
    source_refs:freeze([
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.unlocked_slot_selection_reference,
    ]),
    reference_candidate_rule:'EQUAL_SELECTION_AMONG_CURRENTLY_UNLOCKED_INGREDIENT_SLOTS',
    reference_candidate_weights:freeze({
      level_1:'1',
      level_30:'1/2_each_unlocked_slot',
      level_60:'1/3_each_unlocked_slot',
    }),
    blockers:freeze([
      'PLAYER_SLOT_IDENTITY_OBSERVED_BUT_PRODUCTION_WEIGHT_MISSING',
      'LOCAL_GOVERNED_PRODUCTION_SLOT_SELECTION_CONTRACT_MISSING',
      'INDEPENDENT_CURRENT_MECHANICS_CROSSCHECK_MISSING',
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
    lifecycle:'IDENTITY_GENERATION_TIME',
    semantic:'Probability used when an individual is generated/befriended to assign its Lv.30/Lv.60 ingredient identities (AAA/AAB/AAC/ABA/ABB/ABC and related variants).',
    authority_status:'OUT_OF_SCOPE_IDENTITY_GENERATION',
    runtime_numeric_activation:false,
    production_model_eligible:false,
    source_refs:freeze([
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.catch_assignment_reference,
    ]),
    forbidden_substitutions:freeze([
      'ingredient_probability_per_help',
      'ingredient_slot_distribution',
    ]),
  }),
});

export function ingredientProductionEvidenceBoundary(){
  return freeze({
    schema:'pokemon-sleep-ingredient-production-evidence-boundary/1.1',
    contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
    contract_version:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION,
    dimensions:INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY,
    numeric_activation_count:0,
    production_dimensions_hold:freeze([
      INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_PROBABILITY_PER_HELP,
      INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_SLOT_DISTRIBUTION,
    ]),
    safety:freeze({
      missing_is_zero:false,
      player_data_write:false,
      sqlite_write:false,
      runtime_network_fetch:false,
      ai_numeric_authority:false,
      reference_values_activate_production:false,
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
