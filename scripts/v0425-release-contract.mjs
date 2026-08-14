import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {SUBSKILL_NUMERIC_MODIFIER_VERSION,resolvePokemonProductionModifierProfile} from '../assets/js/pokemon-master-options.js';
import {STRATEGY_OPTIMIZATION_PACK_VERSION} from '../assets/js/strategy-optimization-pack.js';
import {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION,PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT} from '../assets/js/public-recipe-current-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authoritySource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(authoritySource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
assert.ok(['v0.4.25','v0.4.26'].includes(authority.app_version));
if(authority.app_version==='v0.4.26'){
  assert.equal(authority.app_build,'20260814-v0426-g75e3a-ingredient-rate-reference-boundary');
  assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.26-v0426-g75e3a-ingredient-rate-reference-boundary');
  assert.ok(authoritySource.includes("// app_version: 'v0.4.25'"));
  assert.ok(authoritySource.includes("// app_build: '20260814-v0425-g75e2b-recipe-name-subskill'"));
}else{
  assert.equal(authority.app_build,'20260814-v0425-g75e2b-recipe-name-subskill');
  assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.25-v0425-g75e2b-recipe-name-subskill');
  assert.ok(authoritySource.includes("// app_version: 'v0.4.24'"));
  assert.ok(authoritySource.includes("// app_build: '20260814-v0424-g75e2a-nature-numeric-modifier'"));
}
assert.equal(STRATEGY_OPTIMIZATION_PACK_VERSION,'strategy-optimization-pack-2026-08-14-c');

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-14-c');
assert.equal(PUBLIC_RECIPE_MASTER.length,78);
assert.equal(PUBLIC_RECIPE_NAME_AUTHORITY_AUDIT.migration_baseline_current_authority_count,0);
assert.equal(PUBLIC_RECIPE_MASTER.find(row=>row.recipe_id==='curry_spicy_leek')?.recipe_name,'辣味蔥勁十足咖哩');

const registry=currentProductionAuthorityRegistry();
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier']);
for(const dimension of ['ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'])assert.equal(registry.rules[dimension].status,'NOT_YET_VERIFIED');

const profile=resolvePokemonProductionModifierProfile({nature:'固執',unlocked_subskills:[{unlock_level:10,subskill_name:'幫手獎勵'},{unlock_level:25,subskill_name:'食材機率提升M'}]});
assert.equal(profile.schema,'pokemon-sleep-production-modifier-profile/1.2');
assert.equal(profile.subskill_numeric_registry_version,SUBSKILL_NUMERIC_MODIFIER_VERSION);
assert.equal(profile.numeric_activation,false);
assert.equal(profile.modifiers.find(row=>row.source_name==='幫手獎勵').numeric_status,'ACTIVE_VERIFIED');
assert.equal(profile.modifiers.find(row=>row.source_name==='幫手獎勵').reduction,0.05);
assert.equal(profile.modifiers.find(row=>row.source_name==='食材機率提升M').multiplier,1.36);

const displayEvidence=read('assets/js/recipe-display-name-evidence.js');
for(const forbidden of ['UPDATE recipe_master','INSERT INTO recipe_master(','DELETE FROM recipe_master'])assert.equal(displayEvidence.includes(forbidden),false,`local display evidence must not write public recipe master: ${forbidden}`);
assert.ok(displayEvidence.includes('recipe_display_name_evidence'));
assert.ok(displayEvidence.includes('canonical_resolution_log'));
assert.ok(displayEvidence.includes('USER_CONFIRMED_MATCH'));

const sw=read('service-worker.js');
for(const asset of ['./assets/js/public-recipe-name-audit-v0425.js','./assets/js/public-recipe-current-authority.js','./assets/js/recipe-display-name-evidence.js','./assets/js/pokemon-master-options.js','./assets/js/strategy-optimization-pack.js'])assert.ok(sw.includes(`'${asset}'`),`service worker missing ${asset}`);

console.log(JSON.stringify({status:'PASS',gate:'V0425_RELEASE',app_version:authority.app_version,app_build:authority.app_build,cache_name:authority.cache_name,predecessor:'v0.4.24',recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,migration_baseline_current_authority_count:0,subskill_numeric_registry_version:SUBSKILL_NUMERIC_MODIFIER_VERSION,strategy_pack_version:STRATEGY_OPTIMIZATION_PACK_VERSION,active_base_numeric_dimensions:'3/7',overall_numeric_model_status:registry.numeric_rate_model_status,user_confirmed_name_public_master_write:false,nature_auto_rewrite:false,runtime_network_fetch:false,ai_numeric_authority:false},null,2));