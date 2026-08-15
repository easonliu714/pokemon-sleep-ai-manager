import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO,
  FIRST_PARTY_OBSERVATION_UPDATE_ENTITY,
  FIRST_PARTY_OBSERVATION_UPDATE_SOURCE,
  FIRST_PARTY_OBSERVATION_CAPTURE_INPUT_METHOD,
  buildFirstPartyIngredientObservationUpdatePackage,
  validateFirstPartyIngredientObservationUpdateOperation,
  validateFirstPartyIngredientObservationUpdatePackage,
  prepareFirstPartyIngredientObservationStorageData,
  buildDeidentifiedFirstPartyIngredientAggregate,
} from '../assets/js/ingredient-probability-first-party-observation-update.js';
import {
  FIRST_PARTY_OBSERVATION_MODE,
  FIRST_PARTY_OBSERVATION_SOURCE,
} from '../assets/js/ingredient-probability-first-party-observation-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const base={
  observation_id:'fixture-bulbasaur-e3c6b-001',observation_source:FIRST_PARTY_OBSERVATION_SOURCE,observation_mode:FIRST_PARTY_OBSERVATION_MODE,
  source_key:'BULBASAUR',canonical_species_form_id:'neroli:bulbasaur',species_form_identity_confirmed:true,player_private_identity_included:false,
  observation_evidence_refs:['Screenshot_fixture_001.png','manual-window-fixture-001'],level:20,
  ingredient_slots:[{unlock_level:1,ingredient_name:'甜甜蜜',quantity:2}],
  individual_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',environment_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
  inventory_empty_at_window_start:true,collection_before_inventory_overflow_confirmed:true,sneaky_snacking_or_overflow_observed:false,
  helper_whistle_used:false,external_extra_help_effect_used:false,non_help_item_contamination:false,collection_counts_complete:true,
  external_rate_value_used_to_reconstruct_events:false,berry_items_collected:20,ingredient_items_collected:20,berry_items_per_help:1,
  berry_items_per_help_authority:'DETERMINISTIC_PLATFORM_VERIFIED',inventory_items_before_collection:40,inventory_capacity:50,
};
const payload=buildFirstPartyIngredientObservationUpdatePackage(base,{generatedAt:'2026-08-15T10:00:00.000Z',updateId:'TEST-E3C6B-ACCEPTED'});
assert.equal(payload.scenario,FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO);
assert.equal(payload.source,FIRST_PARTY_OBSERVATION_UPDATE_SOURCE);
assert.equal(payload.production_boundary.production_active_dimensions,'4/7');
assert.equal(payload.production_boundary.ingredient_probability_per_help,'OBSERVED_PARTIAL_ONLY');
assert.equal(payload.production_boundary.runtime_numeric_activation,false);
assert.equal(payload.production_boundary.sample_sufficiency_for_activation,'NOT_DEFINED');
assert.equal(payload.operations.length,1);
const op=payload.operations[0];
assert.equal(op.entity,FIRST_PARTY_OBSERVATION_UPDATE_ENTITY);
assert.equal(op.action,'upsert');
assert.equal(op.key.observation_id,base.observation_id);
assert.equal(op.data.capture_input_method,FIRST_PARTY_OBSERVATION_CAPTURE_INPUT_METHOD);
assert.equal(op.data.status,'ACCEPTED_RAW_OBSERVATION');
assert.equal(op.data.berry_help_event_count,20);
assert.equal(op.data.ingredient_help_event_count,10);
assert.equal(op.data.total_help_event_count,30);
assert.equal(op.data.ingredient_event_fraction,1/3);
assert.equal(op.data.activation_authority_granted,false);
assert.equal(op.data.independent_source_admission_granted,false);
assert.equal(op.review_required,false);
assert.equal(validateFirstPartyIngredientObservationUpdatePackage(payload).errors.length,0);

const storage=prepareFirstPartyIngredientObservationStorageData(op,payload,'2026-08-15T18:00:00+08:00');
assert.equal(storage.observation_evidence_refs,JSON.stringify(base.observation_evidence_refs));
assert.equal(storage.ingredient_slots,JSON.stringify(base.ingredient_slots));
assert.equal(storage.species_form_identity_confirmed,1);
assert.equal(storage.player_private_identity_included,0);
assert.equal(storage.eligible_for_statistical_aggregation,1);
assert.equal(storage.updated_at,'2026-08-15T18:00:00+08:00');
assert.equal(storage.source_update_id,payload.update_id);

const rejected=buildFirstPartyIngredientObservationUpdatePackage({...base,observation_id:'fixture-rejected',helper_whistle_used:true},{generatedAt:'2026-08-15T10:01:00.000Z',updateId:'TEST-E3C6B-REJECTED'});
assert.equal(rejected.operations[0].data.status,'REVIEW_REQUIRED');
assert.equal(rejected.operations[0].data.eligible_for_statistical_aggregation,false);
const rejectedValidation=validateFirstPartyIngredientObservationUpdatePackage(rejected);
assert.equal(rejectedValidation.errors.length,0,'Rejected observation must remain storable for review');
assert.equal(rejectedValidation.warnings.length,1,'Rejected observation must clearly warn that it is excluded from aggregation');

const tampered=structuredClone(payload.operations[0]);
tampered.data.ingredient_help_event_count=999;
assert.ok(validateFirstPartyIngredientObservationUpdateOperation(tampered).errors.some(message=>message.includes('ingredient_help_event_count')),'derived event count tampering must fail closed');
const privateTampered=structuredClone(payload.operations[0]);
privateTampered.data.pokemon_id='pkm-private-001';
assert.ok(validateFirstPartyIngredientObservationUpdateOperation(privateTampered).errors.some(message=>message.includes('私人 identity')),'private player identity must not enter Update Package');
const clearTampered=structuredClone(payload.operations[0]);
clearTampered.clear_fields=['ingredient_items_collected'];
assert.ok(validateFirstPartyIngredientObservationUpdateOperation(clearTampered).errors.some(message=>message.includes('禁止 clear_fields')),'raw observation must not support destructive clear semantics');
const boundaryTampered=structuredClone(payload);
boundaryTampered.production_boundary.runtime_numeric_activation=true;
assert.ok(validateFirstPartyIngredientObservationUpdatePackage(boundaryTampered).errors.some(message=>message.includes('runtime_numeric_activation')),'Update Package must never self-authorize Production activation');

const aggregate=buildDeidentifiedFirstPartyIngredientAggregate([
  {...storage,status:'ACCEPTED_RAW_OBSERVATION',eligible_for_statistical_aggregation:1},
  {...storage,observation_id:'accepted-2',ingredient_help_event_count:5,berry_help_event_count:10,total_help_event_count:15,status:'ACCEPTED_RAW_OBSERVATION',eligible_for_statistical_aggregation:1},
  {...storage,observation_id:'rejected-1',ingredient_help_event_count:999,berry_help_event_count:0,total_help_event_count:999,status:'REVIEW_REQUIRED',eligible_for_statistical_aggregation:0},
]);
assert.equal(aggregate.groups.length,1);
assert.equal(aggregate.groups[0].source_key,'BULBASAUR');
assert.equal(aggregate.groups[0].observation_count,2);
assert.equal(aggregate.groups[0].ingredient_help_event_count,15);
assert.equal(aggregate.groups[0].berry_help_event_count,30);
assert.equal(aggregate.groups[0].total_help_event_count,45);
assert.equal(aggregate.groups[0].observed_fraction,1/3);
assert.equal(aggregate.privacy.raw_observation_included,false);
assert.equal(aggregate.privacy.evidence_refs_included,false);
assert.equal(aggregate.privacy.player_identity_included,false);
assert.equal(aggregate.sample_sufficiency_for_activation,'NOT_DEFINED');
assert.equal(aggregate.activation_authority_granted,false);
for(const forbidden of ['pokemon_id','nickname','observation_evidence_refs','ingredient_slots','level'])assert.equal(JSON.stringify(aggregate).includes(`"${forbidden}"`),false,`de-identified aggregate leaked ${forbidden}`);

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);

const importer=fs.readFileSync('assets/js/importer.js','utf8');
const schema=fs.readFileSync('assets/js/schema.js','utf8');
const migrations=fs.readFileSync('assets/js/migrations.js','utf8');
const workflow=fs.readFileSync('assets/js/ai-workflow.js','utf8');
const ui=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-ui.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const version=fs.readFileSync('assets/js/version-authority.js','utf8');
for(const token of ['ingredient_probability_observations','prepareFirstPartyIngredientObservationStorageData'])assert.ok(importer.includes(token),`Importer missing E3C-6B guard: ${token}`);
assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS ingredient_probability_observations'),'fresh schema missing observation table');
assert.ok(migrations.includes('applyIngredientProbabilityObservationMigration'),'migration path missing observation table');
for(const token of [FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO,FIRST_PARTY_OBSERVATION_UPDATE_ENTITY,'validateFirstPartyIngredientObservationUpdateOperation'])assert.ok(workflow.includes(token),`AI workflow missing manual observation scenario guard: ${token}`);
for(const token of ['手動輸入','不使用 OCR','pokemon_id 不會進 Update Package','下載去識別聚合 JSON'])assert.ok(ui.includes(token),`mobile capture UI missing safety copy: ${token}`);
for(const path of ['ingredient-probability-first-party-observation-contract.js','ingredient-probability-first-party-observation-update.js','ingredient-probability-first-party-observation-ui.js'])assert.ok(bootstrap.includes(path),`online startup probe missing E3C-6B module: ${path}`);
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'service worker must network-first/cache JavaScript modules after a successful online startup');
assert.ok(sw.includes('caches.open(CACHE).then(cache=>cache.put(event.request,copy))'),'service worker must retain fetched JavaScript in the active cache for later offline use');
assert.ok(version.includes("app_build: '20260815-v0427-e3c6b-first-party-observation-capture'"),'E3C-6B build authority missing');
assert.ok(version.includes("cache_name: 'pokemon-sleep-ai-v0.4.27-e3c6b-first-party-observation-capture'"),'E3C-6B cache rotation missing');

console.log(JSON.stringify({
  status:'PASS',gate:'V0428_G75E3C6B_FIRST_PARTY_OBSERVATION_UPDATE',
  accepted_update_package:true,rejected_observation_retained_not_aggregated:true,derived_fields_revalidated:true,
  private_identity_forbidden:true,deidentified_aggregate_only:true,manual_typed_counts_only:true,ocr_event_counts:false,
  destructive_clear_forbidden:true,self_activation_forbidden:true,offline_after_successful_online_start:true,
  sample_sufficiency_for_activation:'NOT_DEFINED',ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  production_numeric_activation:'4/7',activation_authority_granted:false,
},null,2));