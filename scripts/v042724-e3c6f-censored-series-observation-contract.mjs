import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_SPECIES_FORM_ROSTER_ROWS} from '../assets/js/public-pokemon-species-form-roster.js';
import {
  FIRST_PARTY_OBSERVATION_MODES,
  FIRST_PARTY_OBSERVATION_SOURCE,
  FIRST_PARTY_OBSERVATION_STATUS,
  BERRY_COUNT_COMPLETENESS,
  FIRST_PARTY_OBSERVATION_PARTIAL_REASONS,
  evaluateFirstPartyIngredientHelpObservation,
  aggregateFirstPartyIngredientHelpObservations,
} from '../assets/js/ingredient-probability-first-party-observation-contract.js';
import {resolveFirstPartyObservationUiCandidate} from '../assets/js/ingredient-probability-first-party-observation-ui-eligibility.js';
import {buildFirstPartyIngredientObservationUpdatePackage} from '../assets/js/ingredient-probability-first-party-observation-update.js';

const roster=PUBLIC_SPECIES_FORM_ROSTER_ROWS[0];
assert.ok(roster?.source_key&&roster?.canonical_species_form_id,'fixture roster row required');
const base={
  observation_id:'FPO-V042724-BASE',observation_series_id:'FPS-V042724',window_sequence:1,
  observation_source:FIRST_PARTY_OBSERVATION_SOURCE,
  observation_mode:FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY,
  source_key:roster.source_key,canonical_species_form_id:roster.canonical_species_form_id,
  species_form_identity_confirmed:true,player_private_identity_included:false,
  observation_evidence_refs:['manual-window-v042724-01'],level:30,
  ingredient_slots:[
    {unlock_level:1,ingredient_name:'特選蘋果',quantity:1,observed_item_count:2},
    {unlock_level:30,ingredient_name:'暖暖薑',quantity:2,observed_item_count:6},
  ],
  individual_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
  environment_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
  inventory_empty_at_window_start:true,collection_before_inventory_overflow_confirmed:true,
  sneaky_snacking_or_overflow_observed:false,helper_whistle_used:false,
  external_extra_help_effect_used:false,non_help_item_contamination:false,
  collection_counts_complete:true,external_rate_value_used_to_reconstruct_events:false,
  berry_items_collected:24,ingredient_items_collected:8,berry_items_per_help:2,
  berry_items_per_help_authority:'DETERMINISTIC_PLATFORM_VERIFIED',
  inventory_items_before_collection:32,inventory_capacity:40,
  berry_count_completeness_status:BERRY_COUNT_COMPLETENESS.COMPLETE_CONFIRMED,
};

const complete=evaluateFirstPartyIngredientHelpObservation(base);
assert.equal(complete.status,FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION);
assert.equal(complete.ingredient_help_event_count,5);
assert.equal(complete.berry_help_event_count,12);
assert.equal(complete.total_help_event_count,17);
assert.equal(complete.ingredient_event_fraction,5/17);
assert.equal(complete.safety.multi_slot_distinct_quantity_mode,true);
assert.equal(complete.safety.outcome_dependent_window_selection,false);

const censored=evaluateFirstPartyIngredientHelpObservation({
  ...base,observation_id:'FPO-V042724-CENSORED',window_sequence:2,
  berry_items_collected:25,inventory_items_before_collection:33,
  berry_count_completeness_status:BERRY_COUNT_COMPLETENESS.POSSIBLY_CENSORED_BY_SNORLAX,
});
assert.equal(censored.status,FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_PARTIAL_OBSERVATION);
assert.equal(censored.ingredient_help_event_count,5);
assert.equal(censored.berry_help_event_count,null);
assert.equal(censored.total_help_event_count,null);
assert.equal(censored.ingredient_event_fraction,null);
assert.equal(censored.eligible_for_statistical_aggregation,false);
assert.deepEqual(censored.partial_reasons,[FIRST_PARTY_OBSERVATION_PARTIAL_REASONS.BERRY_COUNT_POSSIBLY_CENSORED_BY_SNORLAX]);
assert.equal(censored.safety.repeated_windows_do_not_rescue_censored_denominator,true);

const sameName=evaluateFirstPartyIngredientHelpObservation({
  ...base,observation_id:'FPO-V042724-SAME-NAME',ingredient_slots:[
    {unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1,observed_item_count:2},
    {unlock_level:30,ingredient_name:'哞哞鮮奶',quantity:2,observed_item_count:2},
  ],ingredient_items_collected:4,berry_items_collected:24,inventory_items_before_collection:28,
});
assert.equal(sameName.status,FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED);
assert.ok(sameName.blockers.includes('MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT'));

const distinctEligibility=resolveFirstPartyObservationUiCandidate({level:30,ingredient_slots:[
  {unlock_level:1,ingredient_name:'特選蘋果',quantity:1},{unlock_level:30,ingredient_name:'暖暖薑',quantity:2},
],individual_ingredient_rate_modifier_present:false});
assert.equal(distinctEligibility.visible,true);
assert.equal(distinctEligibility.observation_mode,FIRST_PARTY_OBSERVATION_MODES.MULTI_SLOT_DISTINCT_QUANTITY);

const sameNameEligibility=resolveFirstPartyObservationUiCandidate({level:30,ingredient_slots:[
  {unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1},{unlock_level:30,ingredient_name:'哞哞鮮奶',quantity:2},
],individual_ingredient_rate_modifier_present:false});
assert.equal(sameNameEligibility.visible,false);
assert.ok(sameNameEligibility.blockers.includes('MULTI_SLOT_INGREDIENT_NAMES_NOT_DISTINCT'));

const modifierEligibility=resolveFirstPartyObservationUiCandidate({level:30,ingredient_slots:[
  {unlock_level:1,ingredient_name:'特選蘋果',quantity:1},{unlock_level:30,ingredient_name:'暖暖薑',quantity:2},
],individual_ingredient_rate_modifier_present:true});
assert.equal(modifierEligibility.visible,false);
assert.ok(modifierEligibility.blockers.includes('INDIVIDUAL_INGREDIENT_RATE_MODIFIER_PRESENT'));

const aggregate=aggregateFirstPartyIngredientHelpObservations([
  base,
  {...base,observation_id:'FPO-V042724-SECOND',window_sequence:2,berry_items_collected:20,ingredient_items_collected:6,inventory_items_before_collection:26,ingredient_slots:[
    {unlock_level:1,ingredient_name:'特選蘋果',quantity:1,observed_item_count:2},
    {unlock_level:30,ingredient_name:'暖暖薑',quantity:2,observed_item_count:4},
  ]},
  {...base,observation_id:'FPO-V042724-PARTIAL',window_sequence:3,berry_count_completeness_status:BERRY_COUNT_COMPLETENESS.POSSIBLY_CENSORED_BY_SNORLAX},
]);
assert.equal(aggregate.accepted_observation_count,2);
assert.equal(aggregate.partial_observation_count,1);
assert.equal(aggregate.groups.length,1);
assert.equal(aggregate.groups[0].ingredient_help_event_count,9);
assert.equal(aggregate.groups[0].berry_help_event_count,22);
assert.equal(aggregate.groups[0].total_help_event_count,31);
assert.equal(aggregate.activation_authority_granted,false);
assert.equal(aggregate.sample_sufficiency_for_activation,'NOT_DEFINED');

const payload=buildFirstPartyIngredientObservationUpdatePackage({...base,observation_id:'FPO-V042724-PACKAGE'},{generatedAt:'2026-08-21T04:00:00.000Z',capturedAt:'2026-08-21T04:00:00.000Z'});
assert.equal(payload.production_boundary.production_active_dimensions,'4/7');
assert.equal(payload.production_boundary.runtime_numeric_activation,false);
assert.equal(payload.production_boundary.sample_sufficiency_for_activation,'NOT_DEFINED');
assert.equal(payload.operations[0].data.observation_series_id,'FPS-V042724');
assert.equal(payload.operations[0].data.window_sequence,1);

const ui=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-ui.js','utf8');
const schema=fs.readFileSync('assets/js/schema.js','utf8');
assert.match(ui,/E3C-6F/);
assert.match(ui,/POSSIBLY_CENSORED_BY_SNORLAX/);
assert.match(ui,/多次觀測/);
assert.match(ui,/ingredient_slot_count_/);
assert.match(ui,/多槽不同食材／不等量/);
assert.doesNotMatch(schema,/berry_count_completeness_status|observation_series_id|window_sequence/);

console.log(JSON.stringify({
  status:'PASS',gate:'V042724_E3C6F_CENSORED_SERIES_DISTINCT_SLOT',
  distinct_unequal_quantity:true,censored_berry_denominator_fail_closed:true,
  repeated_windows_supported:true,partial_windows_excluded_from_probability:true,
  same_name_unequal_quantity_fail_closed:true,production_active_dimensions:'4/7',
  sample_sufficiency_for_activation:'NOT_DEFINED',schema_migration_added:false,
},null,2));
