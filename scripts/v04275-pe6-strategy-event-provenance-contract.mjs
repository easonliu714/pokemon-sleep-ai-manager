import assert from 'node:assert/strict';
import {
  buildStrategyContextPackage,
  STRATEGY_CONTEXT_PACKAGE_VERSION,
} from '../assets/js/strategy-context-package.js';
import {
  buildStrategyOptimizationPack,
  STRATEGY_OPTIMIZATION_PACK_VERSION,
} from '../assets/js/strategy-optimization-pack.js';
import {
  buildExternalOptimizationPrompt,
  STRATEGY_OPTIMIZATION_EVENT_AUTHORITY_POLICY_VERSION,
} from '../assets/js/strategy-optimization-ai-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const legacyMultiplier=9.9;
const weeklyContext={
  context_id:'weekly_context_2026-08-17_import',
  week_start:'2026-08-17',
  camp:'黃金舊發電廠',
  dish_category:'甜點/飲料',
  favorite_berry_1:'萄葡果',
  favorite_berry_2:'墨莓果',
  favorite_berry_3:'靛莓果',
  pot_size:60,
  event_name:'Pokémon Horizons 特別合作活動',
  event_effects:null,
  strategy_event_effects:{},
  review_event_effects:[],
  event_effect_review_required:false,
  public_event_master_version:'public-event-master-tw-2026-08-17-a',
  public_event_authority_version:'public-event-authority-2026-08-17-a',
  public_event_authority_status:'PARTIAL_VERIFIED',
  public_event_active_count:1,
  public_event_effect_conflicts:[],
  event_authority_source:'PUBLIC_EVENT_MASTER',
  legacy_player_event_observation:{
    event_name:'LEGACY PLAYER EVENT',
    event_effects:JSON.stringify({recipe_final_energy_multiplier:legacyMultiplier}),
    event_effects_parsed:{recipe_final_energy_multiplier:legacyMultiplier},
    deterministic_authority:false,
  },
};
const candidate={
  pokemon_id:'private-pokemon-id',
  pokemon_instance_id:'private-pokemon-id',
  species:'仙子伊布',
  level:36,
  specialty:'技能',
  helper_seconds:2418,
  main_skill:'活力全體療癒S',
  main_skill_level:6,
  favorite_berry_match:false,
  hard_constraint_status:'PASS',
  current_readiness_score:50,
  unlocked_ingredients:[{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1}],
};
const candidateScoring={
  candidates:[candidate],
  ranked_candidates:[candidate],
  feature_fingerprint:'pokemon_features:fixture',
  scoring_engine_version:'pokemon-scoring-engine-fixture',
  scoring_rule_registry_version:'pokemon-scoring-rules-fixture',
};
const context=buildStrategyContextPackage({
  weeklyContext,
  candidateScoring,
  recipeStrategy:{candidates:[],input_fingerprint:'recipe_strategy:fixture'},
  masterVersions:{public_recipe_master_version:'recipe-master-fixture'},
  currentTeamPokemonIds:['private-pokemon-id'],
  includeEventText:false,
});
assert.equal(STRATEGY_CONTEXT_PACKAGE_VERSION,'strategy-context-2026-08-17-b-public-event-provenance');
assert.equal(context.payload.weekly_context.event_name,'Pokémon Horizons 特別合作活動');
assert.equal(context.payload.weekly_context.event_effects,null);
assert.equal(context.payload.public_event_authority.source,'PUBLIC_EVENT_MASTER');
assert.equal(context.payload.public_event_authority.master_version,'public-event-master-tw-2026-08-17-a');
assert.equal(context.payload.public_event_authority.authority_version,'public-event-authority-2026-08-17-a');
assert.equal(context.payload.public_event_authority.authority_status,'PARTIAL_VERIFIED');
assert.deepEqual(context.payload.public_event_authority.deterministic_effects,{});
assert.equal(context.payload.public_event_authority.deterministic_effect_count,0);
assert.equal(context.payload.public_event_authority.event_name_is_numeric_authority,false);
assert.equal(context.payload.public_event_authority.legacy_player_event_deterministic_authority,false);
assert.equal(context.payload.public_version_refs.public_event_master_version,'public-event-master-tw-2026-08-17-a');
assert.equal(context.payload.public_version_refs.public_event_authority_version,'public-event-authority-2026-08-17-a');
assert.equal(JSON.stringify(context.payload).includes(String(legacyMultiplier)),false,'legacy player event multiplier must not enter Strategy Context');
assert.equal(JSON.stringify(context.payload).includes('LEGACY PLAYER EVENT'),false,'legacy player event identity must not enter Strategy Context');

const productionRegistry=currentProductionAuthorityRegistry();
const optimization=buildStrategyOptimizationPack({
  strategyContextResult:context,
  candidateScoring,
  teamOptimization:{primary:{team_status:'READY',slots:[{pokemon_id:'private-pokemon-id'}],input_fingerprint:'team:fixture'}},
  productionRegistry,
});
assert.equal(STRATEGY_OPTIMIZATION_PACK_VERSION,'strategy-optimization-pack-2026-08-17-d-public-event-provenance');
assert.equal(optimization.status,'READY');
assert.deepEqual(optimization.payload.public_event_authority,context.payload.public_event_authority);
assert.equal(optimization.payload.public_version_refs.public_event_master_version,'public-event-master-tw-2026-08-17-a');
assert.equal(optimization.payload.weekly_context.event_effects,null);
assert.equal(JSON.stringify(optimization.payload).includes(String(legacyMultiplier)),false,'legacy multiplier must not enter Optimization Pack');
assert.equal(productionRegistry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(productionRegistry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(productionRegistry.active_verified_dimensions.length,4);

const prompt=buildExternalOptimizationPrompt(optimization.payload);
assert.equal(STRATEGY_OPTIMIZATION_EVENT_AUTHORITY_POLICY_VERSION,'strategy-optimization-event-authority-2026-08-17-a');
for(const token of [
  'weekly_context.event_name 只代表活動 identity，不是數值 Authority',
  '只有 public_event_authority.deterministic_effects 可作為 deterministic event effects',
  'PARTIAL_VERIFIED',
  '不得依活動名稱、模型記憶、外部知識或 legacy 玩家活動資料自行補入任何倍率',
  'Public Event Master provenance',
])assert.ok(prompt.includes(token),`PE6 external prompt missing authority token: ${token}`);
assert.ok(prompt.includes('"public_event_authority"'));
assert.ok(prompt.includes('"authority_status": "PARTIAL_VERIFIED"'));
assert.ok(prompt.includes('"deterministic_effects": {}'));
assert.equal(prompt.includes(String(legacyMultiplier)),false,'legacy multiplier must not leak into external prompt');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.27.5_PE6_STRATEGY_PUBLIC_EVENT_PROVENANCE',
  context_package_version:STRATEGY_CONTEXT_PACKAGE_VERSION,
  optimization_pack_version:STRATEGY_OPTIMIZATION_PACK_VERSION,
  event_authority_policy_version:STRATEGY_OPTIMIZATION_EVENT_AUTHORITY_POLICY_VERSION,
  public_event_master_version:optimization.payload.public_event_authority.master_version,
  public_event_authority_status:optimization.payload.public_event_authority.authority_status,
  deterministic_event_effect_count:optimization.payload.public_event_authority.deterministic_effect_count,
  legacy_player_event_multiplier_exported:false,
  event_name_numeric_authority:false,
  production_numeric_authority:'4/7_HOLD_INGREDIENT_PROBABILITY',
},null,2));
