import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PRODUCTION_MODIFIER_STRUCTURAL_STATUS,resolvePokemonProductionModifierProfile} from '../assets/js/pokemon-master-options.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const source=fs.readFileSync('assets/js/version-authority.js','utf8');
const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(source,sandbox);
const appVersion=sandbox.PokemonSleepVersionAuthority?.app_version||null;
const successorNatureNumeric=['v0.4.24','v0.4.25','v0.4.26'].includes(appVersion);

const candidate={nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率',unlocked_subskills:[{unlock_level:10,subskill_name:'樹果數量S'},{unlock_level:25,subskill_name:'幫手獎勵'},{unlock_level:50,subskill_name:'食材機率提升M'}]};
const profile=resolvePokemonProductionModifierProfile(candidate);
const successorSubskillNumeric=profile.schema==='pokemon-sleep-production-modifier-profile/1.2';
const by=name=>profile.modifiers.find(row=>row.source_name===name);
assert.equal(profile.status,PRODUCTION_MODIFIER_STRUCTURAL_STATUS);
assert.equal(profile.numeric_activation,false);
assert.equal(profile.missing_is_zero,false);
assert.deepEqual([by('幫忙速度').direction,by('幫忙速度').dimension,by('幫忙速度').numeric_status],['UP','helper_interval_seconds',successorNatureNumeric?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED']);
assert.deepEqual([by('食材機率').direction,by('食材機率').dimension,by('食材機率').numeric_status],['DOWN','ingredient_probability_per_help',successorNatureNumeric?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED']);
if(successorNatureNumeric){
  assert.ok(['pokemon-sleep-production-modifier-profile/1.1','pokemon-sleep-production-modifier-profile/1.2'].includes(profile.schema));
  assert.ok(profile.verified_numeric_modifier_count>=2);
  assert.equal(by('幫忙速度').multiplier,0.9);
  assert.equal(by('食材機率').multiplier,0.8);
}else assert.equal(profile.schema,'pokemon-sleep-production-modifier-profile/1.0');
assert.equal(by('樹果數量S').numeric_status,'ACTIVE_VERIFIED_DELEGATED');
assert.deepEqual([by('幫手獎勵').scope,by('幫手獎勵').dimension,by('幫手獎勵').numeric_status],['TEAM','helper_interval_seconds',successorSubskillNumeric?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED']);
assert.equal(by('食材機率提升M').numeric_status,successorSubskillNumeric?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED');
if(successorSubskillNumeric){
  assert.equal(by('幫手獎勵').reduction,0.05);
  assert.equal(by('食材機率提升M').multiplier,1.36);
  assert.equal(profile.subskill_numeric_registry_version,'pokemon-subskill-numeric-modifiers-2026-08-14-a');
}
const unknown=resolvePokemonProductionModifierProfile({...candidate,unlocked_subskills:[{unlock_level:10,subskill_name:'UNKNOWN_SUBSKILL_FIXTURE'}]});
assert.equal(unknown.status,'REVIEW_REQUIRED');
assert.ok(unknown.conflicts.includes('UNKNOWN_SUBSKILL:UNKNOWN_SUBSKILL_FIXTURE'));
const registry=currentProductionAuthorityRegistry();
const numeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
assert.equal(numeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED').length,3);
console.log(JSON.stringify({status:'PASS',gate:'V0423_PRODUCTION_MODIFIER_STRUCTURAL',app_version:appVersion,successor_nature_numeric:successorNatureNumeric,successor_subskill_numeric:successorSubskillNumeric,modifier_status:profile.status,numeric_activation:false,numeric_dimensions_active:'3/7',unknown_modifier_fail_closed:true},null,2));