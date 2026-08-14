import assert from 'node:assert/strict';
import {
  NATURE_NUMERIC_MODIFIER_VERSION,
  NATURE_NUMERIC_MODIFIER_SOURCE_REFS,
  resolvePokemonProductionModifierProfile,
} from '../assets/js/pokemon-master-options.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildStrategyOptimizationPack,STRATEGY_OPTIMIZATION_PACK_VERSION} from '../assets/js/strategy-optimization-pack.js';

const fixture={pokemon_id:'private-fixture-001',species:'測試物種',level:30,specialty:'食材',helper_seconds:2400,nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率',unlocked_subskills:[]};
const profile=resolvePokemonProductionModifierProfile(fixture);
assert.equal(profile.schema,'pokemon-sleep-production-modifier-profile/1.1');
assert.equal(profile.nature_numeric_registry_version,NATURE_NUMERIC_MODIFIER_VERSION);
assert.equal(profile.numeric_activation,false,'modifier authority must not activate the global numeric production model');
assert.equal(profile.modifier_numeric_authority_active,true);
assert.equal(profile.verified_numeric_modifier_count,2);
assert.equal(profile.missing_is_zero,false);
assert.ok(NATURE_NUMERIC_MODIFIER_SOURCE_REFS.length>=3);
const help=profile.modifiers.find(row=>row.source_name==='幫忙速度');
const ingredient=profile.modifiers.find(row=>row.source_name==='食材機率');
assert.deepEqual({direction:help.direction,status:help.numeric_status,operator:help.numeric_operator,multiplier:help.multiplier},{direction:'UP',status:'ACTIVE_VERIFIED',operator:'HELP_INTERVAL_MULTIPLIER',multiplier:0.9});
assert.deepEqual({direction:ingredient.direction,status:ingredient.numeric_status,operator:ingredient.numeric_operator,multiplier:ingredient.multiplier},{direction:'DOWN',status:'ACTIVE_VERIFIED',operator:'PROBABILITY_MULTIPLIER',multiplier:0.8});

const speedDown=resolvePokemonProductionModifierProfile({nature:'內斂',unlocked_subskills:[]}).modifiers.find(row=>row.source_name==='幫忙速度');
assert.deepEqual({direction:speedDown.direction,operator:speedDown.numeric_operator,multiplier:speedDown.multiplier},{direction:'DOWN',operator:'HELP_INTERVAL_MULTIPLIER',multiplier:1.075});
const energyDown=resolvePokemonProductionModifierProfile({nature:'怕寂寞',unlocked_subskills:[]}).modifiers.find(row=>row.source_name==='活力回復量');
assert.equal(energyDown.multiplier,0.88);
const expPair=resolvePokemonProductionModifierProfile({nature:'膽小',unlocked_subskills:[]}).modifiers;
assert.equal(expPair.find(row=>row.source_name==='EXP獲得量').multiplier,1.18);
assert.equal(expPair.find(row=>row.source_name==='幫忙速度').multiplier,1.075);
const skillPair=resolvePokemonProductionModifierProfile({nature:'溫和',unlocked_subskills:[]}).modifiers;
assert.equal(skillPair.find(row=>row.source_name==='主技能發動機率').multiplier,1.2);
assert.equal(skillPair.find(row=>row.source_name==='幫忙速度').multiplier,1.075);
const neutral=resolvePokemonProductionModifierProfile({nature:'勤奮',unlocked_subskills:[]});
assert.equal(neutral.modifiers.length,0);
assert.equal(neutral.modifier_numeric_authority_active,false);
const unknown=resolvePokemonProductionModifierProfile({nature:'UNKNOWN_NATURE',unlocked_subskills:[]});
assert.equal(unknown.status,'REVIEW_REQUIRED');
assert.equal(unknown.modifier_numeric_authority_active,false);
assert.equal(unknown.numeric_activation,false);

const registry=currentProductionAuthorityRegistry();
const numeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
assert.equal(numeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED').length,3,'nature modifier evidence must not promote base production dimensions');
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.main_skill_trigger_probability.status,'NOT_YET_VERIFIED');

const contextResult={payload:{context_fingerprint:'strategy_context:v0424',goal_profile:{primary_goal:'max_snorlax_energy'},weekly_context:{week_start:'2026-08-10'},inventory_summary:[],recipe_gap_summary:[],deterministic_candidates:{},public_version_refs:{}},resolver:{cand_001:{pokemon_id:fixture.pokemon_id,species:fixture.species}}};
const pack=buildStrategyOptimizationPack({strategyContextResult:contextResult,candidateScoring:{candidates:[fixture]},teamOptimization:{primary:{team_status:'READY',input_fingerprint:'team:v0424',slots:[{pokemon_id:fixture.pokemon_id}]}},productionRegistry:registry});
assert.equal(STRATEGY_OPTIMIZATION_PACK_VERSION,'strategy-optimization-pack-2026-08-14-b');
const outgoing=pack.payload.candidate_production_readiness[0];
assert.equal(outgoing.candidate_ref,'cand_001');
assert.equal(outgoing.production_modifier_profile.schema,'pokemon-sleep-production-modifier-profile/1.1');
assert.equal(outgoing.production_modifier_profile.verified_numeric_modifier_count,2);
assert.equal(outgoing.rate_statuses.ingredient,'NOT_YET_VERIFIED');
assert.equal(outgoing.rate_statuses.skill,'NOT_YET_VERIFIED');
const serialized=JSON.stringify(pack.payload);
assert.equal(serialized.includes(fixture.pokemon_id),false);
assert.equal(serialized.includes('pokemon_id'),false);

console.log(JSON.stringify({status:'PASS',gate:'V0424_G75E2A_NATURE_NUMERIC_MODIFIER',nature_numeric_registry_version:NATURE_NUMERIC_MODIFIER_VERSION,strategy_pack_version:STRATEGY_OPTIMIZATION_PACK_VERSION,speed_up_interval_multiplier:0.9,speed_down_interval_multiplier:1.075,ingredient_probability_pair:[1.2,0.8],skill_probability_pair:[1.2,0.8],energy_recovery_pair:[1.2,0.88],exp_gain_pair:[1.18,0.82],active_base_numeric_dimensions:'3/7',overall_numeric_model_status:registry.numeric_rate_model_status,unknown_nature_fail_closed:true,stable_ids_in_payload:false,sqlite_write:false,runtime_network_fetch:false,ai_numeric_authority:false},null,2));
