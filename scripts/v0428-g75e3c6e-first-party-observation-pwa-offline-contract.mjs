import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const gate='V0428_G75E3C6E_FIRST_PARTY_OBSERVATION_PWA_OFFLINE_CLOSURE';
const sw=fs.readFileSync('service-worker.js','utf8');
const assetMatches=[...sw.matchAll(/['"](\.\/assets\/js\/[^'"]+\.js)['"]/g)].map(match=>match[1]);
const precached=new Set(assetMatches);

const observationRoots=Object.freeze([
  'ingredient-probability-first-party-observation-contract.js',
  'ingredient-probability-first-party-observation-update.js',
  'ingredient-probability-first-party-observation-ui-eligibility.js',
  'ingredient-probability-first-party-observation-ui.js',
]);
const requiredDirectAssets=new Set(observationRoots.map(file=>`./assets/js/${file}`));

const importPattern=/\b(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?['"](\.\/[^'"]+\.js)['"]/g;
for(const file of observationRoots){
  const source=fs.readFileSync(path.join('assets/js',file),'utf8');
  for(const match of source.matchAll(importPattern)){
    const normalized=path.posix.normalize(path.posix.join('./assets/js',match[1].slice(2)));
    requiredDirectAssets.add(normalized.startsWith('.')?normalized:`./${normalized}`);
  }
}

const missing=[...requiredDirectAssets].filter(asset=>!precached.has(asset)).sort();
assert.deepEqual(missing,[],`first-party observation static import closure missing from service-worker ASSETS: ${missing.join(', ')}`);

for(const required of [
  './assets/js/public-pokemon-species-form-roster.js',
  './assets/js/ingredient-probability-first-party-observation-contract.js',
  './assets/js/ingredient-probability-first-party-observation-update.js',
  './assets/js/ingredient-probability-first-party-observation-ui-eligibility.js',
  './assets/js/ingredient-probability-first-party-observation-ui.js',
])assert.ok(precached.has(required),`required E3C-6E precache asset missing: ${required}`);

assert.ok(sw.includes('cache.addAll(ASSETS)'),'service worker install must atomically precache ASSETS');
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'same-origin JavaScript must retain network-first update semantics while online');
assert.ok(sw.includes("fetch(event.request,{cache:'no-store'})"),'network-first JavaScript fetch must bypass stale HTTP cache');
assert.ok(sw.includes("caches.match(event.request)"),'network failure must retain cache fallback');

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,[
  'berry_output_per_help',
  'berry_energy_per_berry',
  'favorite_berry_multiplier',
  'ingredient_slot_distribution',
]);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

console.log(JSON.stringify({
  status:'PASS',
  gate,
  observation_root_count:observationRoots.length,
  required_precache_asset_count:requiredDirectAssets.size,
  missing_precache_assets:missing,
  install_uses_cache_add_all:true,
  online_js_network_first_preserved:true,
  offline_js_cache_fallback_preserved:true,
  sqlite_schema_migration_required:false,
  player_data_write:false,
  runtime_network_numeric_authority:false,
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
},null,2));
