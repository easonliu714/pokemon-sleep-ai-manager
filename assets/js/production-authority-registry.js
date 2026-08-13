import {PUBLIC_BERRY_STRENGTH_VERSION,BERRY_STRENGTH_FORMULA_VERSION} from './public-berry-strength-master.js';
import {FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION} from './favorite-berry-multiplier-contract.js';
import {HELP_EVENT_SPLIT_CONTRACT_ID,HELP_EVENT_SPLIT_CONTRACT_VERSION,HELP_EVENT_SPLIT_AUTHORITY_STATUS} from './help-event-split-contract.js';
import {BASE_BERRY_OUTPUT_CONTRACT_ID,BASE_BERRY_OUTPUT_CONTRACT_VERSION,BASE_BERRY_OUTPUT_AUTHORITY_STATUS,BASE_BERRY_OUTPUT_SCOPE} from './base-berry-output-contract.js';

export const PRODUCTION_AUTHORITY_REGISTRY_VERSION='production-authority-registry-2026-08-13-d';

const RULES=Object.freeze({
  helper_interval_seconds:Object.freeze({dimension:'helper_interval_seconds',status:'OBSERVED_INPUT',rule_version:'player-observed-helper-seconds-v1',source_refs:Object.freeze(['player_pokemon.helper_seconds']),missing_inputs:Object.freeze([])}),
  help_event_split:Object.freeze({dimension:'help_event_split',status:HELP_EVENT_SPLIT_AUTHORITY_STATUS,rule_version:HELP_EVENT_SPLIT_CONTRACT_VERSION,source_refs:Object.freeze([HELP_EVENT_SPLIT_CONTRACT_ID]),missing_inputs:Object.freeze([]),scope:'STRUCTURAL_ONLY'}),
  berry_output_per_help:Object.freeze({dimension:'berry_output_per_help',status:BASE_BERRY_OUTPUT_AUTHORITY_STATUS,rule_version:BASE_BERRY_OUTPUT_CONTRACT_VERSION,source_refs:Object.freeze([BASE_BERRY_OUTPUT_CONTRACT_ID,HELP_EVENT_SPLIT_CONTRACT_ID]),missing_inputs:Object.freeze([]),scope:BASE_BERRY_OUTPUT_SCOPE,excluded_modifiers:Object.freeze(['EVENT_EXTRA_BERRY_MODIFIER','EXPERT_MODE_MAIN_FAVORITE_EXTRA_BERRY','DIRECT_MAIN_SKILL_BERRY_OUTPUT','BERRY_BURST_OR_EQUIVALENT_MAIN_SKILL_OUTPUT','INGREDIENT_RESULT_HELP'])}),
  berry_energy_per_berry:Object.freeze({dimension:'berry_energy_per_berry',status:'ACTIVE_VERIFIED',rule_version:BERRY_STRENGTH_FORMULA_VERSION,source_refs:Object.freeze([PUBLIC_BERRY_STRENGTH_VERSION,'pokemon-sleep-berry-base-energy-formula-verified-2026-08-13']),missing_inputs:Object.freeze([])}),
  favorite_berry_multiplier:Object.freeze({dimension:'favorite_berry_multiplier',status:'ACTIVE_VERIFIED',rule_version:FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION,source_refs:Object.freeze([FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,'raenonx-snorlax-favorite-base-x2-2026-08-13','pokemon-sleep-expert-favorite-boundary-2026-08-13']),missing_inputs:Object.freeze([]),scope:'BASE_BERRY_STRENGTH_ONLY',excluded_modifiers:Object.freeze(['EXPERT_MODE_MAIN_FAVORITE_HELPING_FREQUENCY_BONUS','EXPERT_MODE_NON_FAVORITE_HELPING_FREQUENCY_PENALTY','EXPERT_MODE_ADDITIONAL_FAVORITE_STRENGTH_EFFECT','EVENT_BERRY_STRENGTH_MULTIPLIER','EVENT_BERRY_OUTPUT_PER_HELP_BONUS','AREA_OR_EXPERT_BONUS'])}),
  ingredient_probability_per_help:Object.freeze({dimension:'ingredient_probability_per_help',status:'NOT_YET_VERIFIED',rule_version:null,source_refs:Object.freeze([]),missing_inputs:Object.freeze(['verified_ingredient_probability_rule'])}),
  ingredient_slot_distribution:Object.freeze({dimension:'ingredient_slot_distribution',status:'NOT_YET_VERIFIED',rule_version:null,source_refs:Object.freeze([]),missing_inputs:Object.freeze(['verified_ingredient_slot_distribution_rule'])}),
  main_skill_trigger_probability:Object.freeze({dimension:'main_skill_trigger_probability',status:'NOT_YET_VERIFIED',rule_version:null,source_refs:Object.freeze([]),missing_inputs:Object.freeze(['verified_main_skill_trigger_rule'])}),
  main_skill_effect_value:Object.freeze({dimension:'main_skill_effect_value',status:'NOT_YET_VERIFIED',rule_version:null,source_refs:Object.freeze([]),missing_inputs:Object.freeze(['verified_main_skill_effect_value_rule'])}),
});

export function currentProductionAuthorityRegistry(){
  return Object.freeze({
    schema:'pokemon-sleep-production-authority-registry/1.0',
    registry_version:PRODUCTION_AUTHORITY_REGISTRY_VERSION,
    rules:RULES,
    numeric_rate_model_status:'NOT_YET_VERIFIED',
    active_verified_dimensions:Object.freeze(Object.values(RULES).filter(row=>row.status==='ACTIVE_VERIFIED').map(row=>row.dimension)),
    active_verified_structural_dimensions:Object.freeze(Object.values(RULES).filter(row=>row.status==='ACTIVE_VERIFIED_STRUCTURAL').map(row=>row.dimension)),
    ai_numeric_authority:false,
  });
}

export function productionAuthorityRule(dimension){return RULES[String(dimension||'')]||null;}
export function isProductionDimensionVerified(dimension){return productionAuthorityRule(dimension)?.status==='ACTIVE_VERIFIED';}
