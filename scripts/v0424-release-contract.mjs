import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {NATURE_NUMERIC_MODIFIER_VERSION,NATURE_NUMERIC_MODIFIER_SOURCE_REFS,resolvePokemonProductionModifierProfile} from '../assets/js/pokemon-master-options.js';
import {STRATEGY_OPTIMIZATION_PACK_VERSION} from '../assets/js/strategy-optimization-pack.js';

const read=path=>fs.readFileSync(path,'utf8');
const authoritySource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(authoritySource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
assert.equal(authority.app_version,'v0.4.24');
assert.equal(authority.app_build,'20260814-v0424-g75e2a-nature-numeric-modifier');
assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.24-v0424-g75e2a-nature-numeric-modifier');
assert.ok(authoritySource.includes("// app_version: 'v0.4.23'"));
assert.ok(authoritySource.includes("// app_build: '20260814-v0423-g75e1-production-modifier-structural'"));
assert.equal(STRATEGY_OPTIMIZATION_PACK_VERSION,'strategy-optimization-pack-2026-08-14-b');

const registry=currentProductionAuthorityRegistry();
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier']);
for(const dimension of ['ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'])assert.equal(registry.rules[dimension].status,'NOT_YET_VERIFIED');

const profile=resolvePokemonProductionModifierProfile({nature:'固執',unlocked_subskills:[{unlock_level:10,subskill_name:'幫手獎勵'}]});
assert.equal(profile.schema,'pokemon-sleep-production-modifier-profile/1.1');
assert.equal(profile.nature_numeric_registry_version,NATURE_NUMERIC_MODIFIER_VERSION);
assert.equal(profile.modifier_numeric_authority_active,true);
assert.equal(profile.numeric_activation,false);
assert.equal(profile.verified_numeric_modifier_count,2);
assert.equal(profile.modifiers.find(row=>row.source_name==='幫忙速度').multiplier,0.9);
assert.equal(profile.modifiers.find(row=>row.source_name==='食材機率').multiplier,0.8);
assert.equal(profile.modifiers.find(row=>row.source_name==='幫手獎勵').numeric_status,'NOT_YET_VERIFIED');
assert.ok(NATURE_NUMERIC_MODIFIER_SOURCE_REFS.includes('pokemon-sleep-official-v2.6.0-nature-speed-down-balance-adjustment-2025-03-26'));

const master=read('assets/js/pokemon-master-options.js');
const pack=read('assets/js/strategy-optimization-pack.js');
for(const [file,source] of [['pokemon-master-options.js',master],['strategy-optimization-pack.js',pack]])for(const forbidden of ['INSERT INTO','UPDATE pokemon','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`${file} forbidden write/network path: ${forbidden}`);
const sw=read('service-worker.js');
assert.ok(sw.includes("'./assets/js/pokemon-master-options.js'"));
assert.ok(sw.includes("'./assets/js/strategy-optimization-pack.js'"));

console.log(JSON.stringify({status:'PASS',gate:'V0424_G75E2A_RELEASE',app_version:authority.app_version,app_build:authority.app_build,cache_name:authority.cache_name,predecessor:'v0.4.23',nature_numeric_registry_version:NATURE_NUMERIC_MODIFIER_VERSION,strategy_pack_version:STRATEGY_OPTIMIZATION_PACK_VERSION,active_base_numeric_dimensions:'3/7',overall_numeric_model_status:registry.numeric_rate_model_status,modifier_numeric_authority_active:true,global_numeric_activation:false,sqlite_write:false,player_data_write:false,runtime_network_fetch:false,ai_numeric_authority:false},null,2));
