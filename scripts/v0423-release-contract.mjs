import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {
  PRODUCTION_MODIFIER_STRUCTURAL_VERSION,
  PRODUCTION_MODIFIER_STRUCTURAL_STATUS,
  resolvePokemonProductionModifierProfile,
} from '../assets/js/pokemon-master-options.js';
import {
  STRATEGY_OPTIMIZATION_PACK_VERSION,
  buildStrategyOptimizationPack,
} from '../assets/js/strategy-optimization-pack.js';

const read=path=>fs.readFileSync(path,'utf8');
const authoritySource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;
vm.runInNewContext(authoritySource,sandbox,{filename:'assets/js/version-authority.js'});
const authority=sandbox.PokemonSleepVersionAuthority;
const successor=authority.app_version==='v0.4.24';
assert.ok(['v0.4.23','v0.4.24'].includes(authority.app_version));
if(successor){
  assert.equal(authority.app_build,'20260814-v0424-g75e2a-nature-numeric-modifier');
  assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.24-v0424-g75e2a-nature-numeric-modifier');
  assert.ok(authoritySource.includes("// app_version: 'v0.4.23'"),'v0.4.23 predecessor lineage missing');
}else{
  assert.equal(authority.app_build,'20260814-v0423-g75e1-production-modifier-structural');
  assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.23-v0423-g75e1-production-modifier-structural');
  assert.ok(authoritySource.includes("// app_version: 'v0.4.22.1'"),'v0.4.22.1 predecessor lineage missing');
}
assert.equal(authority.schema,'pokemon-sleep-version-authority/1.0');

const registry=currentProductionAuthorityRegistry();
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier']);
assert.equal(registry.active_verified_dimensions.length,3);
for(const key of ['ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'])assert.equal(registry.rules[key].status,'NOT_YET_VERIFIED');

const candidate={
  pokemon_id:'private-player-pokemon-001',species:'測試物種',level:30,specialty:'樹果',helper_seconds:2200,favorite_berry_match:true,
  nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率',main_skill:'能量填充S',main_skill_level:3,
  unlocked_ingredients:[{unlock_level:1,ingredient_name:'特選蘋果',quantity:2}],
  unlocked_subskills:[{unlock_level:10,subskill_name:'樹果數量S'},{unlock_level:25,subskill_name:'幫手獎勵'}],
};
const profile=resolvePokemonProductionModifierProfile(candidate);
assert.equal(profile.schema,successor?'pokemon-sleep-production-modifier-profile/1.1':'pokemon-sleep-production-modifier-profile/1.0');
assert.equal(profile.registry_version,PRODUCTION_MODIFIER_STRUCTURAL_VERSION);
assert.equal(profile.status,PRODUCTION_MODIFIER_STRUCTURAL_STATUS);
assert.equal(profile.numeric_activation,false);
assert.equal(profile.missing_is_zero,false);
assert.equal(profile.conflicts.length,0);
const natureHelp=profile.modifiers.find(row=>row.source_type==='NATURE'&&row.source_name==='幫忙速度');
const natureIngredient=profile.modifiers.find(row=>row.source_type==='NATURE'&&row.source_name==='食材機率');
const berryFinding=profile.modifiers.find(row=>row.source_type==='SUBSKILL'&&row.source_name==='樹果數量S');
const helpingBonus=profile.modifiers.find(row=>row.source_type==='SUBSKILL'&&row.source_name==='幫手獎勵');
assert.deepEqual({direction:natureHelp.direction,dimension:natureHelp.dimension,numeric_status:natureHelp.numeric_status},{direction:'UP',dimension:'helper_interval_seconds',numeric_status:successor?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED'});
assert.deepEqual({direction:natureIngredient.direction,dimension:natureIngredient.dimension,numeric_status:natureIngredient.numeric_status},{direction:'DOWN',dimension:'ingredient_probability_per_help',numeric_status:successor?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED'});
if(successor){assert.equal(natureHelp.multiplier,0.9);assert.equal(natureIngredient.multiplier,0.8);assert.equal(profile.verified_numeric_modifier_count,2);}
assert.equal(berryFinding.dimension,'berry_output_per_help');
assert.equal(berryFinding.numeric_status,'ACTIVE_VERIFIED_DELEGATED');
assert.equal(helpingBonus.dimension,'helper_interval_seconds');
assert.equal(helpingBonus.scope,'TEAM');
assert.equal(helpingBonus.numeric_status,'NOT_YET_VERIFIED');
const unknown=resolvePokemonProductionModifierProfile({...candidate,nature:'未知性格'});
assert.equal(unknown.status,'REVIEW_REQUIRED');
assert.equal(unknown.numeric_activation,false);
assert.ok(unknown.conflicts.includes('UNKNOWN_NATURE'));

const contextResult={
  payload:{context_fingerprint:'strategy_context:v0423',goal_profile:{primary_goal:'max_snorlax_energy'},weekly_context:{week_start:'2026-08-10'},inventory_summary:[],recipe_gap_summary:[],deterministic_candidates:{},public_version_refs:{}},
  resolver:{cand_001:{pokemon_id:candidate.pokemon_id,species:candidate.species}},
};
const pack=buildStrategyOptimizationPack({strategyContextResult:contextResult,candidateScoring:{candidates:[candidate]},teamOptimization:{primary:{team_status:'READY',input_fingerprint:'team:v0423',slots:[{pokemon_id:candidate.pokemon_id}]}},productionRegistry:registry});
assert.equal(pack.status,'READY');
assert.equal(pack.payload.schema,'pokemon-sleep-strategy-optimization-pack/2.0');
assert.equal(pack.payload.package_version,STRATEGY_OPTIMIZATION_PACK_VERSION);
assert.equal(STRATEGY_OPTIMIZATION_PACK_VERSION,successor?'strategy-optimization-pack-2026-08-14-b':'strategy-optimization-pack-2026-08-14-a');
assert.equal(pack.payload.candidate_production_readiness.length,1);
const outgoing=pack.payload.candidate_production_readiness[0];
assert.equal(outgoing.candidate_ref,'cand_001');
assert.equal(outgoing.production_modifier_profile.numeric_activation,false);
assert.equal(outgoing.production_modifier_profile.status,PRODUCTION_MODIFIER_STRUCTURAL_STATUS);
assert.equal(outgoing.rate_statuses.berry,'NOT_YET_VERIFIED');
const serialized=JSON.stringify(pack.payload);
assert.equal(serialized.includes(candidate.pokemon_id),false,'stable Pokémon ID leaked into AI pack');
assert.equal(serialized.includes('pokemon_id'),false,'pokemon_id key leaked into AI pack');
for(const key of ['stable_pokemon_ids_in_payload','nicknames_in_payload','notes_in_payload','source_images_in_payload','raw_ocr_in_payload','api_key_in_payload','raw_sqlite_in_payload'])assert.equal(pack.privacy_manifest[key],false,`privacy boundary failed: ${key}`);

const autofill=read('assets/js/recipe-level-energy-autofill.js');
assert.ok(autofill.includes('function hydrateBlankEnergyFromLevel(level)'),'recipe render hydration helper missing');
assert.ok(autofill.includes("if(!energy||energy.value!=='')return null"),'observed energy overwrite guard missing');
assert.ok(autofill.includes("syncEnergyFromLevel(level,{dispatch:false,renderHydration:true})"),'render hydration must remain dispatch-free');
assert.equal(/from ['"]\.\/database\.js['"]/.test(autofill),false,'recipe hydration must not import database write path');
const sw=read('service-worker.js');
for(const asset of ['./assets/js/pokemon-master-options.js','./assets/js/strategy-optimization-pack.js','./assets/js/recipe-level-energy-autofill.js'])assert.ok(sw.includes(`'${asset}'`),`first-offline precache missing ${asset}`);
for(const file of ['assets/js/pokemon-master-options.js','assets/js/strategy-optimization-pack.js']){
  const source=read(file);
  for(const forbidden of ['INSERT INTO','UPDATE pokemon','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden write/network path: ${forbidden}`);
}

console.log(JSON.stringify({status:'PASS',gate:'V0423_G75E1_STRUCTURAL_PRODUCTION_MODIFIER_RELEASE',app_version:authority.app_version,successor_mode:successor,modifier_registry_version:PRODUCTION_MODIFIER_STRUCTURAL_VERSION,optimization_pack_version:STRATEGY_OPTIMIZATION_PACK_VERSION,active_numeric_dimension_count:registry.active_verified_dimensions.length,overall_numeric_model_status:registry.numeric_rate_model_status,nature_structural_routing:true,berry_finding_s_delegated:true,helping_bonus_team_scope:true,unknown_modifier_fail_closed:true,modifier_numeric_activation:false,candidate_ref_payload:true,stable_ids_in_payload:false,recipe_render_hydration_write_free:true,recipe_observed_energy_preserved:true,player_write:false,sqlite_write:false,runtime_network_fetch:false,ai_numeric_authority:false},null,2));
