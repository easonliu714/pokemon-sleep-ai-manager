import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectRecipePortfolioContention,RECIPE_PORTFOLIO_OBJECTIVES} from '../assets/js/recipe-portfolio-contention.js';

const version=fs.readFileSync('assets/js/version-authority.js','utf8');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.equal(appVersion,'v0.4.14');
assert.ok(RECIPE_PORTFOLIO_OBJECTIVES.includes('maximize_verified_energy'));

const candidate=(recipe_id,recipe_name,{base_energy,current_energy=null,recipe_level=null,ingredient})=>({
  recipe_id,recipe_name,base_energy,current_energy,recipe_level,unlocked:current_energy!==null,
  hard_constraint_status:'PASS',candidate_status:current_energy!==null?'COOK_NOW_UNLOCKED':'UNLOCK_CANDIDATE_READY',
  requirements:[{ingredient_name:ingredient,required:1}],
});
const candidates=[
  candidate('player_high','玩家高能量',{base_energy:100,current_energy:600,recipe_level:30,ingredient:'A'}),
  candidate('base_fallback','公版基礎 fallback',{base_energy:500,ingredient:'B'}),
  candidate('player_low','玩家低能量',{base_energy:400,current_energy:200,recipe_level:10,ingredient:'C'}),
];
const inventory=[{ingredient_name:'A',quantity:10},{ingredient_name:'B',quantity:10},{ingredient_name:'C',quantity:10}];
const recipeStrategy={input_fingerprint:'fixture-strategy',candidates};
const energyContext={
  recipe_final_energy_multiplier:1.5,
  multiplier_source:'WEEKLY_EVENT_ACTIVE_VERIFIED',
  event_effect_registry_version:'weekly-event-effect-registry-2026-08-10-a',
  event_effect_strategy_fingerprint:'weekly_event_strategy:fixture',
};

const result=projectRecipePortfolioContention({recipeStrategy,inventory,energyContext,objective:'maximize_verified_energy',maxMeals:1,maxAlternatives:3});
assert.equal(result.schema,'pokemon-sleep-recipe-portfolio-contention/1.1');
assert.equal(result.objective,'maximize_verified_energy');
assert.equal(result.alternatives[0].steps[0].recipe_id,'player_high','player current energy must outrank lower verified projections');
assert.equal(result.alternatives[0].steps[0].energy_source,'PLAYER_CURRENT_ENERGY');
assert.equal(result.alternatives[0].steps[0].pre_event_energy,600);
assert.equal(result.alternatives[0].steps[0].verified_event_multiplier,1.5);
assert.equal(result.alternatives[0].steps[0].projected_verified_energy,900);
assert.equal(result.alternatives[0].projected_verified_energy_sum,900);
assert.equal(result.summary.player_current_energy_candidate_count,2);
assert.equal(result.summary.base_energy_fallback_candidate_count,1);

const fallbackStrategy={...recipeStrategy,candidates:candidates.map(row=>row.recipe_id==='player_high'?{...row,current_energy:100}:row)};
const fallbackResult=projectRecipePortfolioContention({recipeStrategy:fallbackStrategy,inventory,energyContext,objective:'maximize_verified_energy',maxMeals:1,maxAlternatives:3});
assert.equal(fallbackResult.alternatives[0].steps[0].recipe_id,'base_fallback');
assert.equal(fallbackResult.alternatives[0].steps[0].energy_source,'PUBLIC_BASE_ENERGY');
assert.equal(fallbackResult.alternatives[0].steps[0].energy_fallback,true);
assert.equal(fallbackResult.alternatives[0].steps[0].projected_verified_energy,750);
assert.notEqual(fallbackResult.input_fingerprint,result.input_fingerprint,'player current energy changes must alter planner fingerprint');

const featureOnlyNoise=projectRecipePortfolioContention({
  recipeStrategy,inventory,
  energyContext:{...energyContext,extra_tasty_multiplier:99,sunday_extra_tasty_multiplier:999},
  objective:'maximize_verified_energy',maxMeals:1,maxAlternatives:3,
});
assert.equal(featureOnlyNoise.input_fingerprint,result.input_fingerprint,'FEATURE_ONLY multipliers must not enter deterministic energy fingerprint');
assert.equal(featureOnlyNoise.alternatives[0].projected_verified_energy_sum,result.alternatives[0].projected_verified_energy_sum);

const reserveBlocked=projectRecipePortfolioContention({
  recipeStrategy:{input_fingerprint:'reserve-fixture',candidates:[{
    recipe_id:'reserve_blocked',recipe_name:'保留量阻擋',base_energy:9999,current_energy:9999,recipe_level:60,unlocked:true,
    hard_constraint_status:'PASS',candidate_status:'COOK_NOW_UNLOCKED',requirements:[{ingredient_name:'A',required:10}],
  }]},
  inventory:[{ingredient_name:'A',quantity:10}],ingredientSafeReserve:{A:1},energyContext,
  objective:'maximize_verified_energy',maxMeals:1,
});
assert.equal(reserveBlocked.alternatives.length,0,'Safe Reserve must remain a hard execution gate even for highest energy objective');

assert.equal(result.player_data_write,false);
assert.equal(result.inventory_mutation,false);
assert.equal(result.public_master_write,false);
assert.equal(result.gemini_used,false);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0414_G7_VERIFIED_ENERGY_OBJECTIVE',
  app_version:appVersion,
  objective:'maximize_verified_energy',
  player_current_energy_priority:true,
  public_base_energy_fallback:true,
  active_verified_multiplier:1.5,
  feature_only_multiplier_ignored:true,
  safe_reserve_preserved:true,
  deterministic_fingerprint:true,
  no_write:true,
  gemini_numeric_authority:false,
},null,2));
