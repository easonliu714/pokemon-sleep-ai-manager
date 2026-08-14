export const PUBLIC_SPECIES_FORM_ROSTER_READINESS_ID='public-species-form-roster-readiness-2026-08-14-a';
export const PUBLIC_SPECIES_FORM_ROSTER_READINESS_VERSION='public-species-form-roster-readiness-v1';
export const PUBLIC_SPECIES_FORM_ROSTER_AUTHORITY_STATUS='NOT_YET_AVAILABLE';

export const PUBLIC_SPECIES_FORM_ROSTER_NON_AUTHORITIES=Object.freeze([
  Object.freeze({
    source_id:'player-pokemon-table',
    source_ref:'schema.pokemon',
    reason:'PLAYER_OWNED_INSTANCE_DATA_NOT_PUBLIC_SPECIES_FORM_CATALOG',
    may_define_activation_coverage_denominator:false,
  }),
  Object.freeze({
    source_id:'public-empty-profile-core-pokemon',
    source_ref:'seed-data.CORE_POKEMON',
    reason:'PUBLIC_DEPLOYMENT_INTENTIONALLY_SEEDS_ZERO_PLAYER_POKEMON',
    may_define_activation_coverage_denominator:false,
  }),
  Object.freeze({
    source_id:'public-evolution-master',
    source_ref:'public-pokemon-knowledge-master.PUBLIC_EVOLUTION_MASTER',
    reason:'VERIFIED_EVOLUTION_ROUTES_ARE_INTENTIONALLY_PARTIAL_NOT_COMPLETE_SPECIES_FORM_ROSTER',
    may_define_activation_coverage_denominator:false,
  }),
]);

export const PUBLIC_SPECIES_FORM_ROSTER_ACTIVATION_REQUIREMENTS=Object.freeze([
  'VERSIONED_STATIC_PUBLIC_SPECIES_FORM_MASTER',
  'CURRENT_GAME_ROSTER_SCOPE_DATE_OR_RELEASE_ID',
  'FORM_SAFE_CANONICAL_ID_PER_ROW',
  'TYPE_OR_FORM_DISAMBIGUATION_FOR_SHARED_SPECIES_NAMES',
  'ACTIVE_IN_POKEMON_SLEEP_EVIDENCE_PER_ROW_OR_GOVERNED_SOURCE_SET',
  'DETERMINISTIC_ROW_COUNT_AND_UNIQUE_CANONICAL_ID_GATE',
  'NO_PLAYER_ROSTER_DERIVATION',
  'NO_RUNTIME_NETWORK_FETCH',
  'NO_AI_INFERRED_MISSING_SPECIES_OR_FORMS',
]);

export function currentPublicSpeciesFormRosterReadiness(){
  return Object.freeze({
    schema:'pokemon-sleep-public-species-form-roster-readiness/1.0',
    readiness_id:PUBLIC_SPECIES_FORM_ROSTER_READINESS_ID,
    readiness_version:PUBLIC_SPECIES_FORM_ROSTER_READINESS_VERSION,
    authority_status:PUBLIC_SPECIES_FORM_ROSTER_AUTHORITY_STATUS,
    expected_current_species_form_count:null,
    activation_coverage_denominator_ready:false,
    current_public_roster_master:null,
    blocker:'VERSIONED_COMPLETE_PUBLIC_SPECIES_FORM_MASTER_MISSING',
    non_authorities:PUBLIC_SPECIES_FORM_ROSTER_NON_AUTHORITIES,
    activation_requirements:PUBLIC_SPECIES_FORM_ROSTER_ACTIVATION_REQUIREMENTS,
    safety:Object.freeze({
      player_roster_may_define_public_catalog:false,
      empty_seed_may_define_zero_catalog:false,
      partial_evolution_routes_may_define_complete_catalog:false,
      missing_species_or_forms_may_be_ai_inferred:false,
      runtime_network_fetch:false,
      player_data_write:false,
      sqlite_write:false,
      ai_numeric_authority:false,
    }),
  });
}
