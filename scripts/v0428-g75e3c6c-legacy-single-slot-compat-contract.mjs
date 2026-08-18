import assert from 'node:assert/strict';
import {
  INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID,
  INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION,
  FIRST_PARTY_OBSERVATION_MODE,
  FIRST_PARTY_OBSERVATION_SOURCE,
  evaluateFirstPartyIngredientHelpObservation,
} from '../assets/js/ingredient-probability-first-party-observation-contract.js';
import {
  buildFirstPartyIngredientObservationUpdatePackage,
  validateFirstPartyIngredientObservationUpdatePackage,
} from '../assets/js/ingredient-probability-first-party-observation-update.js';

const legacyRaw={
  observation_id:'fixture-legacy-e3c6b-single-slot',
  observation_source:FIRST_PARTY_OBSERVATION_SOURCE,
  observation_mode:FIRST_PARTY_OBSERVATION_MODE,
  source_key:'BULBASAUR',
  canonical_species_form_id:'neroli:bulbasaur',
  species_form_identity_confirmed:true,
  player_private_identity_included:false,
  observation_evidence_refs:['legacy-single-slot-fixture'],
  level:20,
  ingredient_slots:[{unlock_level:1,ingredient_name:'HONEY',quantity:2}],
  individual_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
  environment_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
  inventory_empty_at_window_start:true,
  collection_before_inventory_overflow_confirmed:true,
  sneaky_snacking_or_overflow_observed:false,
  helper_whistle_used:false,
  external_extra_help_effect_used:false,
  non_help_item_contamination:false,
  collection_counts_complete:true,
  external_rate_value_used_to_reconstruct_events:false,
  berry_items_collected:20,
  ingredient_items_collected:20,
  berry_items_per_help:1,
  berry_items_per_help_authority:'DETERMINISTIC_PLATFORM_VERIFIED',
  inventory_items_before_collection:40,
  inventory_capacity:50,
};

const evaluation=evaluateFirstPartyIngredientHelpObservation(legacyRaw);
assert.equal(INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID,'ingredient-probability-first-party-observation-2026-08-14-a');
assert.equal(INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION,'ingredient-probability-first-party-observation-v1');
assert.equal(evaluation.contract_id,INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_ID);
assert.equal(evaluation.contract_version,INGREDIENT_PROBABILITY_FIRST_PARTY_OBSERVATION_VERSION);
assert.equal(evaluation.status,'ACCEPTED_RAW_OBSERVATION');
assert.deepEqual(evaluation.safety,{
  only_single_unlocked_ingredient_slot:true,
  rate_value_used_to_reconstruct_events:false,
  invalid_batch_contributes_to_estimate:false,
  sample_sufficiency_threshold_invented:false,
  runtime_network_fetch:false,
  player_data_write:false,
  sqlite_write:false,
  ai_numeric_authority:false,
});
assert.equal(Object.hasOwn(evaluation.safety,'multi_slot_extension_id'),false,'legacy single-slot safety must not gain extension fields');

const payload=buildFirstPartyIngredientObservationUpdatePackage(legacyRaw,{
  generatedAt:'2026-08-15T10:00:00.000Z',
  updateId:'TEST-E3C6C-LEGACY-SINGLE-SLOT-COMPAT',
});
const validation=validateFirstPartyIngredientObservationUpdatePackage(payload);
assert.deepEqual(validation.errors,[]);
assert.equal(payload.operations[0].data.contract_id,'ingredient-probability-first-party-observation-2026-08-14-a');
assert.equal(payload.operations[0].data.contract_version,'ingredient-probability-first-party-observation-v1');
assert.deepEqual(payload.operations[0].data.safety,evaluation.safety);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C6C_LEGACY_SINGLE_SLOT_PACKAGE_COMPAT',
  legacy_contract_id_preserved:true,
  legacy_contract_version_preserved:true,
  legacy_safety_shape_preserved:true,
  pending_single_slot_update_package_compatibility:true,
  multi_slot_extension_fields_leak_into_single_slot:false,
  production_numeric_activation:'4/7',
},null,2));
