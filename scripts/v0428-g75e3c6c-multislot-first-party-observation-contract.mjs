import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FIRST_PARTY_OBSERVATION_STATUS,
  FIRST_PARTY_OBSERVATION_BLOCKERS,
  FIRST_PARTY_OBSERVATION_MODE,
  FIRST_PARTY_OBSERVATION_MODES,
  FIRST_PARTY_OBSERVATION_SOURCE,
  evaluateFirstPartyIngredientHelpObservation,
} from '../assets/js/ingredient-probability-first-party-observation-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const base={
  observation_id:'fixture-bulbasaur-e3c6c-001',
  observation_source:FIRST_PARTY_OBSERVATION_SOURCE,
  observation_mode:FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY,
  source_key:'BULBASAUR',
  canonical_species_form_id:'neroli:bulbasaur',
  species_form_identity_confirmed:true,
  player_private_identity_included:false,
  observation_evidence_refs:['capture://fixture/bulbasaur/e3c6c/001'],
  level:30,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'HONEY',quantity:2},
    {unlock_level:30,ingredient_name:'SNOOZY_TOMATO',quantity:2},
  ],
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
  ingredient_items_collected:6,
  berry_items_per_help:1,
  berry_items_per_help_authority:'DETERMINISTIC_PLATFORM_VERIFIED',
  inventory_items_before_collection:26,
  inventory_capacity:50,
};

const accepted=evaluateFirstPartyIngredientHelpObservation(base);
assert.equal(accepted.status,FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION);
assert.deepEqual(accepted.blockers,[]);
assert.equal(accepted.berry_help_event_count,20);
assert.equal(accepted.ingredient_help_event_count,3);
assert.equal(accepted.total_help_event_count,23);
assert.equal(accepted.ingredient_event_fraction,3/23);
assert.equal(accepted.eligible_for_statistical_aggregation,true);
assert.equal(accepted.safety.only_single_unlocked_ingredient_slot,false);
assert.equal(accepted.safety.multi_slot_equal_quantity_mode,true);
assert.equal(accepted.safety.multi_slot_eligibility_preobservable,true);
assert.equal(accepted.safety.outcome_dependent_window_selection,false);
assert.equal(accepted.safety.slot_selection_probability_used,false);
assert.equal(accepted.safety.rate_value_used_to_reconstruct_events,false);
assert.equal(accepted.activation_authority_granted,false);

// Critical bias guard: [2,3] + observed total 4 happens to have a unique
// post-hoc decomposition, but it is still rejected because eligibility must be
// known before observing the outcome. Otherwise accepted windows would be
// selected by their ingredient result and could bias the Bernoulli estimate.
const postHocUniqueButBiased=evaluateFirstPartyIngredientHelpObservation({...base,
  observation_id:'fixture-posthoc-unique-but-biased',
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'HONEY',quantity:2},
    {unlock_level:30,ingredient_name:'SNOOZY_TOMATO',quantity:3},
  ],
  ingredient_items_collected:4,
  inventory_items_before_collection:24,
});
assert.equal(postHocUniqueButBiased.status,FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED);
assert.ok(postHocUniqueButBiased.blockers.includes(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTI_SLOT_QUANTITIES_NOT_EQUAL));
assert.equal(postHocUniqueButBiased.eligible_for_statistical_aggregation,false);
assert.equal(postHocUniqueButBiased.ingredient_help_event_count,null);

const nonInteger=evaluateFirstPartyIngredientHelpObservation({...base,observation_id:'fixture-noninteger',ingredient_items_collected:5,inventory_items_before_collection:25});
assert.equal(nonInteger.status,FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED);
assert.ok(nonInteger.blockers.includes(FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_EVENT_COUNT_NOT_INTEGER));
assert.equal(nonInteger.eligible_for_statistical_aggregation,false);

const wrongLevel=evaluateFirstPartyIngredientHelpObservation({...base,observation_id:'fixture-multi-mode-level20',level:20,ingredient_slots:[{unlock_level:1,ingredient_name:'HONEY',quantity:2}],ingredient_items_collected:6,inventory_items_before_collection:26});
assert.equal(wrongLevel.status,FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED);
assert.ok(wrongLevel.blockers.includes(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTI_SLOT_MODE_REQUIRES_MULTIPLE_UNLOCKED_SLOTS));

const predecessorLevel30=evaluateFirstPartyIngredientHelpObservation({...base,observation_id:'fixture-predecessor-level30',observation_mode:FIRST_PARTY_OBSERVATION_MODE});
assert.equal(predecessorLevel30.status,FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED);
assert.ok(predecessorLevel30.blockers.includes(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTIPLE_INGREDIENT_SLOTS_UNLOCKED_NOT_SUPPORTED));

const level60=evaluateFirstPartyIngredientHelpObservation({...base,
  observation_id:'fixture-level60-equal-quantity',level:60,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'A',quantity:2},
    {unlock_level:30,ingredient_name:'B',quantity:2},
    {unlock_level:60,ingredient_name:'C',quantity:2},
  ],
});
assert.equal(level60.status,FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION);
assert.equal(level60.ingredient_help_event_count,3);
assert.equal(level60.safety.multi_slot_eligibility_preobservable,true);

const level60Unequal=evaluateFirstPartyIngredientHelpObservation({...base,
  observation_id:'fixture-level60-unequal',level:60,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'A',quantity:2},
    {unlock_level:30,ingredient_name:'B',quantity:2},
    {unlock_level:60,ingredient_name:'C',quantity:3},
  ],
});
assert.equal(level60Unequal.status,FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED);
assert.ok(level60Unequal.blockers.includes(FIRST_PARTY_OBSERVATION_BLOCKERS.MULTI_SLOT_QUANTITIES_NOT_EQUAL));

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-contract.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ingredient_inventory', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`E3C-6C contract owns forbidden path: ${forbidden}`);
assert.ok(source.includes('outcome_dependent_window_selection:false'),'E3C-6C must explicitly prohibit outcome-dependent sample selection');
assert.ok(source.includes('slot_selection_probability_used:false'),'E3C-6C must not use ingredient-slot selection probability to reconstruct event count');
assert.ok(source.includes('rate_value_used_to_reconstruct_events:false'),'E3C-6C must not use hidden Ingredient Probability to reconstruct events');

const ui=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-ui.js','utf8');
assert.ok(ui.includes('level BETWEEN 1 AND 29'),'E3C-6C methodology PR must not silently widen the existing mobile capture UI');
assert.equal(ui.includes(FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY),false,'multi-slot mode must not be exposed before the UI successor gate');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C6C_MULTI_SLOT_EQUAL_QUANTITY_OBSERVATION',
  method:'PREOBSERVABLE_EQUAL_UNLOCKED_SLOT_QUANTITY_AGGREGATE_EVENT_RECONSTRUCTION',
  level30_equal_quantity_fixture:{slot_quantities:[2,2],ingredient_items:6,ingredient_help_events:accepted.ingredient_help_event_count},
  unequal_quantity_posthoc_unique_rejected:true,
  outcome_dependent_window_selection:false,
  level60_equal_quantity_supported:true,
  predecessor_single_slot_mode_preserved:true,
  slot_selection_probability_used:false,
  hidden_rate_used:false,
  mobile_capture_ui_enabled:false,
  schema_migration_required:false,
  sample_sufficiency_for_activation:'NOT_DEFINED',
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
},null,2));
