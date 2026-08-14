import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FIRST_PARTY_OBSERVATION_STATUS,
  FIRST_PARTY_OBSERVATION_BLOCKERS,
  FIRST_PARTY_OBSERVATION_MODE,
  FIRST_PARTY_OBSERVATION_SOURCE,
  evaluateFirstPartyIngredientHelpObservation,
  aggregateFirstPartyIngredientHelpObservations,
  wilsonBinomialInterval,
} from '../assets/js/ingredient-probability-first-party-observation-contract.js';
import {currentIngredientProbabilitySourceLineageReview} from '../assets/js/ingredient-probability-independent-source-lineage-review.js';
import {currentPublicSpeciesFormRoster} from '../assets/js/public-pokemon-species-form-roster.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const base={
  observation_id:'fixture-bulbasaur-001',
  observation_source:FIRST_PARTY_OBSERVATION_SOURCE,
  observation_mode:FIRST_PARTY_OBSERVATION_MODE,
  source_key:'BULBASAUR',
  canonical_species_form_id:'neroli:bulbasaur',
  species_form_identity_confirmed:true,
  player_private_identity_included:false,
  observation_evidence_refs:['capture://fixture/bulbasaur/001'],
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
const accepted=evaluateFirstPartyIngredientHelpObservation(base);
assert.equal(accepted.status,FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION);
assert.deepEqual(accepted.blockers,[]);
assert.equal(accepted.berry_help_event_count,20);
assert.equal(accepted.ingredient_help_event_count,10);
assert.equal(accepted.total_help_event_count,30);
assert.equal(accepted.ingredient_event_fraction,1/3);
assert.equal(accepted.eligible_for_statistical_aggregation,true);
assert.equal(accepted.activation_authority_granted,false);
assert.equal(accepted.independent_source_admission_granted,false);

const second={...base,observation_id:'fixture-bulbasaur-002',berry_items_collected:10,ingredient_items_collected:10,inventory_items_before_collection:20,inventory_capacity:40};
const aggregate=aggregateFirstPartyIngredientHelpObservations([base,second]);
assert.equal(aggregate.accepted_observation_count,2);
assert.equal(aggregate.rejected_observation_count,0);
assert.equal(aggregate.groups.length,1);
const group=aggregate.groups[0];
assert.equal(group.source_key,'BULBASAUR');
assert.equal(group.observation_count,2);
assert.equal(group.berry_help_event_count,30);
assert.equal(group.ingredient_help_event_count,15);
assert.equal(group.total_help_event_count,45);
assert.equal(group.wilson_95.estimate,1/3);
assert.ok(group.wilson_95.lower<1/3&&group.wilson_95.upper>1/3);
assert.equal(aggregate.sample_sufficiency_for_activation,'NOT_DEFINED');
assert.equal(aggregate.activation_authority_granted,false);
assert.equal(aggregate.independent_source_admission_granted,false);
assert.equal(aggregate.external_rate_comparison_performed,false);

const directWilson=wilsonBinomialInterval(10,30);
assert.equal(directWilson.estimate,1/3);
assert.ok(directWilson.lower>0&&directWilson.upper<1);
assert.equal(wilsonBinomialInterval(31,30),null);
assert.equal(wilsonBinomialInterval(0,0),null);

const invalidCases=[
  [{...base,observation_id:'bad-level30',level:30,ingredient_slots:[{unlock_level:1,ingredient_name:'HONEY',quantity:2},{unlock_level:30,ingredient_name:'SNOOZY_TOMATO',quantity:5}]},FIRST_PARTY_OBSERVATION_BLOCKERS.MULTIPLE_INGREDIENT_SLOTS_UNLOCKED_NOT_SUPPORTED],
  [{...base,observation_id:'bad-slot-qty',ingredient_slots:[{unlock_level:1,ingredient_name:'HONEY',quantity:null}]},FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_SLOT_QUANTITY_MISSING],
  [{...base,observation_id:'bad-individual-mod',individual_ingredient_rate_modifier_state:'INGREDIENT_FINDER_ACTIVE'},FIRST_PARTY_OBSERVATION_BLOCKERS.INDIVIDUAL_INGREDIENT_RATE_MODIFIER_NOT_ISOLATED],
  [{...base,observation_id:'bad-event-mod',environment_ingredient_rate_modifier_state:'UNKNOWN'},FIRST_PARTY_OBSERVATION_BLOCKERS.ENVIRONMENT_INGREDIENT_RATE_MODIFIER_NOT_ISOLATED],
  [{...base,observation_id:'bad-overflow',inventory_items_before_collection:50,inventory_capacity:50},FIRST_PARTY_OBSERVATION_BLOCKERS.INVENTORY_CAPACITY_NOT_PROVABLY_SAFE],
  [{...base,observation_id:'bad-sneaky',sneaky_snacking_or_overflow_observed:true},FIRST_PARTY_OBSERVATION_BLOCKERS.SNEAKY_SNACKING_OR_OVERFLOW_OBSERVED],
  [{...base,observation_id:'bad-whistle',helper_whistle_used:true},FIRST_PARTY_OBSERVATION_BLOCKERS.HELPER_WHISTLE_USED],
  [{...base,observation_id:'bad-extra-help',external_extra_help_effect_used:true},FIRST_PARTY_OBSERVATION_BLOCKERS.EXTERNAL_EXTRA_HELP_EFFECT_USED],
  [{...base,observation_id:'bad-contamination',non_help_item_contamination:true},FIRST_PARTY_OBSERVATION_BLOCKERS.NON_HELP_ITEM_CONTAMINATION],
  [{...base,observation_id:'bad-rate-reconstruction',external_rate_value_used_to_reconstruct_events:true},FIRST_PARTY_OBSERVATION_BLOCKERS.RATE_VALUE_USED_TO_RECONSTRUCT_EVENTS],
  [{...base,observation_id:'bad-ingredient-divisibility',ingredient_items_collected:19,inventory_items_before_collection:39},FIRST_PARTY_OBSERVATION_BLOCKERS.INGREDIENT_EVENT_COUNT_NOT_INTEGER],
  [{...base,observation_id:'bad-berry-divisibility',berry_items_per_help:2,berry_items_collected:19,ingredient_items_collected:20,inventory_items_before_collection:39},FIRST_PARTY_OBSERVATION_BLOCKERS.BERRY_EVENT_COUNT_NOT_INTEGER],
  [{...base,observation_id:'bad-private',player_private_identity_included:true},FIRST_PARTY_OBSERVATION_BLOCKERS.PRIVATE_PLAYER_IDENTITY_INCLUDED],
  [{...base,observation_id:'bad-evidence',observation_evidence_refs:[]},FIRST_PARTY_OBSERVATION_BLOCKERS.EVIDENCE_REFS_MISSING],
];
for(const [fixture,expectedBlocker] of invalidCases){
  const result=evaluateFirstPartyIngredientHelpObservation(fixture);
  assert.equal(result.status,FIRST_PARTY_OBSERVATION_STATUS.REVIEW_REQUIRED,fixture.observation_id);
  assert.ok(result.blockers.includes(expectedBlocker),`${fixture.observation_id} missing blocker ${expectedBlocker}`);
  assert.equal(result.eligible_for_statistical_aggregation,false);
  assert.equal(result.ingredient_event_fraction,null);
  assert.equal(result.activation_authority_granted,false);
}

const mixed=aggregateFirstPartyIngredientHelpObservations([base,{...base,observation_id:'rejected-mixed',helper_whistle_used:true}]);
assert.equal(mixed.accepted_observation_count,1);
assert.equal(mixed.rejected_observation_count,1);
assert.equal(mixed.groups[0].total_help_event_count,30,'invalid batch must not contribute to estimate');

const lineage=currentIngredientProbabilitySourceLineageReview();
assert.equal(lineage.accepted_independent_source_count,0);
assert.equal(lineage.status,'HOLD_NEED_NEW_INDEPENDENT_SOURCE_CANDIDATE');
const roster=currentPublicSpeciesFormRoster();
assert.equal(roster.row_count,242);
const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=read('assets/js/ingredient-probability-first-party-observation-contract.js');
for(const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ingredient_inventory', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`first-party observation contract owns forbidden path: ${forbidden}`);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C6_FIRST_PARTY_INGREDIENT_HELP_OBSERVATION',
  valid_fixture:{berry_help_events:accepted.berry_help_event_count,ingredient_help_events:accepted.ingredient_help_event_count,total_help_events:accepted.total_help_event_count,ingredient_fraction:accepted.ingredient_event_fraction},
  aggregate_fixture:{observations:group.observation_count,total_help_events:group.total_help_event_count,ingredient_help_events:group.ingredient_help_event_count,estimate:group.wilson_95.estimate,wilson_95:[group.wilson_95.lower,group.wilson_95.upper]},
  invalid_case_count:invalidCases.length,
  invalid_batches_contribute_to_estimate:false,
  sample_sufficiency_for_activation:'NOT_DEFINED',
  independent_source_admission_granted:false,
  accepted_external_independent_sources:lineage.accepted_independent_source_count,
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
  runtime_network_fetch:false,
  ai_numeric_authority:false,
},null,2));
