import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FIRST_PARTY_OBSERVATION_MODES,
  FIRST_PARTY_OBSERVATION_SOURCE,
} from '../assets/js/ingredient-probability-first-party-observation-contract.js';
import {
  FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS,
  resolveFirstPartyObservationUiCandidate,
} from '../assets/js/ingredient-probability-first-party-observation-ui-eligibility.js';
import {buildFirstPartyIngredientObservationUpdatePackage} from '../assets/js/ingredient-probability-first-party-observation-update.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const single=resolveFirstPartyObservationUiCandidate({
  level:20,
  ingredient_slots:[{unlock_level:1,ingredient_name:'HONEY',quantity:2}],
  individual_ingredient_rate_modifier_present:false,
});
assert.equal(single.visible,true);
assert.equal(single.observation_mode,FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT);
assert.equal(single.legacy_single_slot_visibility_preserved,true);

const legacyModifier=resolveFirstPartyObservationUiCandidate({
  level:20,
  ingredient_slots:[{unlock_level:1,ingredient_name:'HONEY',quantity:2}],
  individual_ingredient_rate_modifier_present:true,
});
assert.equal(legacyModifier.visible,true,'E3C-6D must not silently remove a legacy Lv1-29 row; evaluator remains the rejection authority');
assert.equal(legacyModifier.observation_mode,FIRST_PARTY_OBSERVATION_MODES.SINGLE_SLOT);

const legacyIncomplete=resolveFirstPartyObservationUiCandidate({
  level:20,
  ingredient_slots:[],
  individual_ingredient_rate_modifier_present:false,
});
assert.equal(legacyIncomplete.visible,true,'legacy single-slot visibility must remain compatible even when slot data is incomplete');
assert.ok(legacyIncomplete.blockers.includes(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED));

const level30Equal=resolveFirstPartyObservationUiCandidate({
  level:30,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'HONEY',quantity:2},
    {unlock_level:30,ingredient_name:'SNOOZY_TOMATO',quantity:2},
  ],
  individual_ingredient_rate_modifier_present:false,
});
assert.equal(level30Equal.visible,true);
assert.equal(level30Equal.observation_mode,FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY);
assert.equal(level30Equal.multi_slot_preeligible,true);
assert.equal(level30Equal.outcome_dependent_window_selection,false);

// E3C-6F successor takes ownership of preobservable unequal-quantity rows only when
// every unlocked ingredient name is distinct. E3C-6D's equal-quantity path is unchanged.
const level30UnequalDistinct=resolveFirstPartyObservationUiCandidate({
  level:30,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'HONEY',quantity:2},
    {unlock_level:30,ingredient_name:'SNOOZY_TOMATO',quantity:3},
  ],
  individual_ingredient_rate_modifier_present:false,
});
assert.equal(level30UnequalDistinct.visible,true);
assert.equal(level30UnequalDistinct.observation_mode,FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY);
assert.equal(level30UnequalDistinct.distinct_slot_preeligible,true);
assert.equal(level30UnequalDistinct.outcome_dependent_window_selection,false);

const level30UnequalSameName=resolveFirstPartyObservationUiCandidate({
  level:30,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'HONEY',quantity:2},
    {unlock_level:30,ingredient_name:'HONEY',quantity:3},
  ],
  individual_ingredient_rate_modifier_present:false,
});
assert.equal(level30UnequalSameName.visible,false);
assert.equal(level30UnequalSameName.observation_mode,null);
assert.ok(level30UnequalSameName.blockers.includes(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.MULTI_SLOT_QUANTITIES_NOT_EQUAL));
assert.ok(level30UnequalSameName.blockers.includes(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT));

const level30Modifier=resolveFirstPartyObservationUiCandidate({
  level:30,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'HONEY',quantity:2},
    {unlock_level:30,ingredient_name:'SNOOZY_TOMATO',quantity:2},
  ],
  individual_ingredient_rate_modifier_present:true,
});
assert.equal(level30Modifier.visible,false);
assert.ok(level30Modifier.blockers.includes(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.INDIVIDUAL_INGREDIENT_RATE_MODIFIER_PRESENT));

const level60Equal=resolveFirstPartyObservationUiCandidate({
  level:60,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'A',quantity:2},
    {unlock_level:30,ingredient_name:'B',quantity:2},
    {unlock_level:60,ingredient_name:'C',quantity:2},
  ],
  individual_ingredient_rate_modifier_present:false,
});
assert.equal(level60Equal.visible,true);
assert.equal(level60Equal.observation_mode,FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY);

const level60Missing=resolveFirstPartyObservationUiCandidate({
  level:60,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'A',quantity:2},
    {unlock_level:30,ingredient_name:'B',quantity:2},
  ],
  individual_ingredient_rate_modifier_present:false,
});
assert.equal(level60Missing.visible,false);
assert.ok(level60Missing.blockers.includes(FIRST_PARTY_OBSERVATION_UI_CANDIDATE_BLOCKERS.INGREDIENT_SLOT_STRUCTURE_NOT_VERIFIED));

const multiInput={
  observation_id:'fixture-e3c6d-multi-package-001',
  observation_source:FIRST_PARTY_OBSERVATION_SOURCE,
  observation_mode:FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY,
  source_key:'BULBASAUR',canonical_species_form_id:'neroli:bulbasaur',species_form_identity_confirmed:true,player_private_identity_included:false,
  observation_evidence_refs:['Screenshot_fixture_e3c6d.png'],level:30,
  ingredient_slots:[{unlock_level:1,ingredient_name:'甜甜蜜',quantity:2},{unlock_level:30,ingredient_name:'安心番茄',quantity:2}],
  individual_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',environment_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
  inventory_empty_at_window_start:true,collection_before_inventory_overflow_confirmed:true,sneaky_snacking_or_overflow_observed:false,
  helper_whistle_used:false,external_extra_help_effect_used:false,non_help_item_contamination:false,collection_counts_complete:true,
  external_rate_value_used_to_reconstruct_events:false,berry_items_collected:20,ingredient_items_collected:6,berry_items_per_help:1,
  berry_items_per_help_authority:'DETERMINISTIC_PLATFORM_VERIFIED',inventory_items_before_collection:26,inventory_capacity:50,
};
const payload=buildFirstPartyIngredientObservationUpdatePackage(multiInput,{generatedAt:'2026-08-18T02:30:00.000Z',updateId:'TEST-E3C6D-MULTI'});
const operation=payload.operations[0];
assert.equal(operation.data.status,'ACCEPTED_RAW_OBSERVATION');
assert.equal(operation.data.observation_mode,FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY);
assert.equal(operation.data.ingredient_help_event_count,3);
assert.equal(operation.data.safety.multi_slot_equal_quantity_mode,true);
assert.equal(operation.data.safety.multi_slot_eligibility_preobservable,true);
assert.equal(operation.data.safety.outcome_dependent_window_selection,false);
assert.equal(Object.prototype.hasOwnProperty.call(operation.data,'pokemon_id'),false);
assert.equal(payload.production_boundary.production_active_dimensions,'4/7');
assert.equal(payload.production_boundary.runtime_numeric_activation,false);
assert.equal(payload.production_boundary.sample_sufficiency_for_activation,'NOT_DEFINED');

const ui=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-ui.js','utf8');
const eligibilitySource=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-ui-eligibility.js','utf8');
for(const token of [
  "FROM pokemon WHERE status='active' AND level>=1",
  'unlock_level<=?',
  'resolveFirstPartyObservationUiCandidate',
  'FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_EQUAL_QUANTITY',
  'FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY',
  'observation_mode:context.observationMode',
  'pokemon_id 不會進 Update Package',
  '不使用 OCR/AI',
  '下載去識別聚合 JSON',
])assert.ok(ui.includes(token),`E3C-6D/6F UI missing governed token: ${token}`);
assert.equal(ui.includes('level BETWEEN 1 AND 29'),false,'successor UI must no longer hard-code the old Lv1-29 SQL ceiling');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(eligibilitySource.includes(forbidden),false,`E3C-6D/6F eligibility resolver contains forbidden authority/write path: ${forbidden}`);
assert.ok(eligibilitySource.includes('outcome_dependent_window_selection:false'),'UI eligibility must preserve the E3C-6C anti-selection-bias invariant');

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C6D_MULTI_SLOT_FIRST_PARTY_OBSERVATION_MOBILE_UI_SUCCESSOR_AWARE',
  legacy_single_slot_visibility_preserved:true,
  level30_equal_quantity_visible:true,
  level30_unequal_distinct_handed_to_e3c6f:true,
  level30_unequal_same_name_hidden:true,
  level30_individual_rate_modifier_hidden:true,
  level60_equal_quantity_visible:true,
  incomplete_multislot_hidden:true,
  outcome_dependent_window_selection:false,
  multi_slot_update_package_valid:true,
  private_pokemon_id_exported:false,
  sqlite_schema_migration_required:false,
  sample_sufficiency_for_activation:'NOT_DEFINED',
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
},null,2));