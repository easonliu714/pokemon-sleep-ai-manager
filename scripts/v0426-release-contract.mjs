import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {currentSpeciesIngredientRateReference} from '../assets/js/public-species-ingredient-rate-reference.js';
import {
  INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
  ingredientProductionEvidenceBoundary,
} from '../assets/js/ingredient-production-evidence-contract.js';

const versionSource=fs.readFileSync(new URL('../assets/js/version-authority.js',import.meta.url),'utf8');
const sandbox={};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(versionSource,sandbox);
const version=sandbox.PokemonSleepVersionAuthority;
assert.equal(version.app_version,'v0.4.26');
assert.equal(version.app_build,'20260814-v0426-g75e3a-ingredient-rate-reference-boundary');
assert.equal(version.cache_name,'pokemon-sleep-ai-v0.4.26-v0426-g75e3a-ingredient-rate-reference-boundary');
assert.equal(version.schema,'pokemon-sleep-version-authority/1.0');

const sw=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
for(const asset of [
  './assets/js/public-species-ingredient-rate-reference.js',
  './assets/js/ingredient-probability-reference-contract.js',
  './assets/js/ingredient-production-evidence-contract.js',
])assert.ok(sw.includes(`'${asset}'`),`service worker must precache ${asset}`);
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));

const reference=currentSpeciesIngredientRateReference();
assert.equal(reference.status,'REFERENCE_ONLY_COMMUNITY_DERIVED');
assert.equal(reference.complete_catalog,false);
assert.equal(reference.eligible_for_numeric_activation,false);

const boundary=ingredientProductionEvidenceBoundary();
assert.equal(boundary.contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
assert.equal(boundary.numeric_activation_count,0);
assert.deepEqual(boundary.production_dimensions_hold,['ingredient_probability_per_help','ingredient_slot_distribution']);
assert.equal(boundary.safety.reference_values_activate_production,false);
assert.equal(boundary.safety.catch_assignment_may_substitute_production_distribution,false);
assert.equal(boundary.safety.runtime_network_fetch,false);
assert.equal(boundary.safety.ai_numeric_authority,false);

const registry=currentProductionAuthorityRegistry();
const numeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
assert.equal(numeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED').length,3);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.rule_version,null);
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.rules.ingredient_probability_per_help.evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
assert.equal(registry.rules.ingredient_slot_distribution.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_slot_distribution.rule_version,null);
assert.equal(registry.rules.ingredient_slot_distribution.runtime_numeric_activation,false);
assert.equal(registry.rules.ingredient_slot_distribution.evidence_contract_id,INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0426_RELEASE_CONTRACT_SEMANTIC_BOUNDARY_CLOSURE',
  app_version:version.app_version,
  app_build:version.app_build,
  cache_name:version.cache_name,
  reference_status:reference.status,
  reference_complete_catalog:reference.complete_catalog,
  reference_activates_numeric_model:false,
  ingredient_semantic_contract_id:INGREDIENT_PRODUCTION_EVIDENCE_CONTRACT_ID,
  ingredient_semantic_numeric_activation:boundary.numeric_activation_count,
  catch_assignment_production_substitution:false,
  active_base_numeric_dimensions:'3/7',
  ingredient_probability_authority:registry.rules.ingredient_probability_per_help.status,
  ingredient_slot_distribution_authority:registry.rules.ingredient_slot_distribution.status,
  overall_numeric_model_status:registry.numeric_rate_model_status,
  service_worker_precache:true,
},null,2));
