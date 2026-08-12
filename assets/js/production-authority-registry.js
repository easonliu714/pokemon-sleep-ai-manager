export const PRODUCTION_AUTHORITY_REGISTRY_VERSION='production-authority-registry-2026-08-12-a';

const RULES=Object.freeze({
  helper_interval_seconds:Object.freeze({dimension:'helper_interval_seconds',status:'OBSERVED_INPUT',rule_version:'player-observed-helper-seconds-v1',source_refs:Object.freeze(['player_pokemon.helper_seconds']),missing_inputs:Object.freeze([])}),
  berry_output_per_help:Object.freeze({dimension:'berry_output_per_help',status:'NOT_YET_VERIFIED',rule_version:null,source_refs:Object.freeze([]),missing_inputs:Object.freeze(['verified_berry_output_per_help_rule'])}),
  berry_energy_per_berry:Object.freeze({dimension:'berry_energy_per_berry',status:'NOT_YET_VERIFIED',rule_version:null,source_refs:Object.freeze([]),missing_inputs:Object.freeze(['verified_berry_energy_rule'])}),
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
    ai_numeric_authority:false,
  });
}

export function productionAuthorityRule(dimension){return RULES[String(dimension||'')]||null;}
export function isProductionDimensionVerified(dimension){return productionAuthorityRule(dimension)?.status==='ACTIVE_VERIFIED';}
