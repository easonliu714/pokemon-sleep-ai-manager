import {
  SPECIES_INGREDIENT_RATE_REFERENCE_VERSION,
  SPECIES_INGREDIENT_RATE_REFERENCE_STATUS,
} from './public-species-ingredient-rate-reference.js';
import {INGREDIENT_PROBABILITY_REFERENCE_CONTRACT_VERSION} from './ingredient-probability-reference-contract.js';
import {
  INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_ID,
  INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,
  INGREDIENT_SLOT_DISTRIBUTION_AUTHORITY_STATUS,
} from './ingredient-slot-distribution-contract.js';

export const INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID='ingredient-production-evidence-boundary-2026-08-14-c';
export const INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION='ingredient-production-evidence-contract-v1.2';

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
  verified_slot_distribution_contract:source(
    INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_ID,
    'LOCAL_ACTIVE_VERIFIED_NUMERIC_CONTRACT',
    'Ingredient Slot Distribution verified contract',
    `internal:${INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION}`,
    ['PRODUCTION_TIME_EQUAL_SELECTION_AMONG_UNLOCKED_SLOTS','LEVEL_1_30_60_DETERMINISTIC_WEIGHTS'],
    ['CATCH_TIME_INGREDIENT_COMBINATION_ASSIGNMENT'],
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
  }),
  ingredient_slot_distribution:freeze({
    dimension:INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_SLOT_DISTRIBUTION,
    lifecycle:'PRODUCTION_TIME',
    semantic:'Conditional on an ingredient-result help, equal selection among ingredient slots already unlocked for that individual at its current level.',
    authority_status:INGREDIENT_SLOT_DISTRIBUTION_AUTHORITY_STATUS,
    rule_version:INGREDIENT_SLOT_DISTRIBUTION_CONTRACT_VERSION,
    runtime_numeric_activation:true,
    source_refs:freeze([
      INGREDIENT_PRODUCTION_EVIDENCE_SOURCES.verified_slot_distribution_contract,
    ]),
    verified_rule:'EQUAL_SELECTION_AMONG_CURRENTLY_UNLOCKED_INGREDIENT_SLOTS',
    verified_weights:freeze({
      level_1:'1',
      level_30:'1/2_each_unlocked_slot',
      level_60:'1/3_each_unlocked_slot',
    }),
    blockers:freeze([]),
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
    schema:'pokemon-sleep-ingredient-production-evidence-boundary/1.2',
    contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
    contract_version:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_VERSION,
    dimensions:INGREDIENT_PRODUCTION_SEMANTIC_BOUNDARY,
    numeric_activation_count:1,
    production_dimensions_ready:freeze([INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_SLOT_DISTRIBUTION]),
    production_dimensions_hold:freeze([INGREDIENT_PRODUCTION_DIMENSIONS.INGREDIENT_PROBABILITY_PER_HELP]),
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
