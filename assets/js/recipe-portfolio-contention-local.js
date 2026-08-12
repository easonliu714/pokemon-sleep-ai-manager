import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {buildLocalRecipeStrategyProjection} from './recipe-strategy-local.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {projectRecipePortfolioContention,RECIPE_PORTFOLIO_CONTENTION_VERSION} from './recipe-portfolio-contention.js';

function enrichRecipePlayerEnergy(strategy){
  let playerStates=[];
  try{playerStates=rows('SELECT recipe_id,recipe_level,current_energy FROM recipe_catalog_state ORDER BY recipe_id');}catch{}
  const byId=new Map(playerStates.map(row=>[String(row.recipe_id),row]));
  return {
    ...strategy,
    candidates:(strategy?.candidates||[]).map(candidate=>{
      const state=byId.get(String(candidate.recipe_id));
      return {
        ...candidate,
        recipe_level:state?.recipe_level??null,
        current_energy:state?.current_energy??null,
      };
    }),
  };
}

export function buildLocalRecipePortfolioContention({objective='unlock_recipes',maxMeals=3,maxAlternatives=3,beamWidth=64}={}){
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze({
    schema:'pokemon-sleep-recipe-portfolio-contention/1.1',planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,
    projection_status:'PLAYER_DATA_UNAVAILABLE',input_fingerprint:null,objective,context:Object.freeze({max_meals:maxMeals,max_alternatives:maxAlternatives}),
    summary:Object.freeze({individually_ready_count:0,simulation_candidate_count:0,alternative_count:0}),contention:null,alternatives:Object.freeze([]),
    missing_inputs:Object.freeze(['player_database']),player_data_write:false,inventory_mutation:false,public_master_write:false,gemini_used:false,
  });
  const week=currentWeeklyContext(),goalProfile=getActiveStrategyGoalProfile(),hard=goalProfile?.hard_constraints||{};
  const baseStrategy=buildLocalRecipeStrategyProjection({ingredientSafeReserve:hard.ingredient_safe_reserve||{},requireVerifiedMaster:Boolean(hard.require_verified_master),sortMode:'unlock_recipes'});
  if(baseStrategy.projection_status!=='READY')return Object.freeze({
    schema:'pokemon-sleep-recipe-portfolio-contention/1.1',planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,
    projection_status:baseStrategy.projection_status||'PLAYER_DATA_UNAVAILABLE',input_fingerprint:null,objective,context:Object.freeze({max_meals:maxMeals,max_alternatives:maxAlternatives}),
    summary:Object.freeze({individually_ready_count:0,simulation_candidate_count:0,alternative_count:0}),contention:null,alternatives:Object.freeze([]),
    missing_inputs:Object.freeze([...(baseStrategy.missing_inputs||[])]),player_data_write:false,inventory_mutation:false,public_master_write:false,gemini_used:false,
  });
  const strategy=enrichRecipePlayerEnergy(baseStrategy);
  const inventory=rows('SELECT ingredient_name,quantity FROM ingredient_inventory ORDER BY ingredient_name');
  const energyContext=Object.freeze({
    recipe_final_energy_multiplier:Number.isFinite(Number(week.recipe_final_energy_multiplier))&&Number(week.recipe_final_energy_multiplier)>0?Number(week.recipe_final_energy_multiplier):1,
    multiplier_source:week.recipe_final_energy_multiplier!=null?'WEEKLY_EVENT_ACTIVE_VERIFIED':'DEFAULT_IDENTITY',
    event_effect_registry_version:week.event_effect_registry_version||null,
    event_effect_strategy_fingerprint:week.event_effect_strategy_fingerprint||null,
  });
  const result=projectRecipePortfolioContention({recipeStrategy:strategy,inventory,ingredientSafeReserve:hard.ingredient_safe_reserve||{},energyContext,objective,maxMeals,maxAlternatives,beamWidth});
  return Object.freeze({
    ...result,
    recipe_strategy_fingerprint:strategy.input_fingerprint||null,
    goal_profile_id:goalProfile?.goal_profile_id||null,
    weekly_context:Object.freeze({
      context_id:week.context_id||null,week_start:week.week_start||null,dish_category:week.dish_category||null,pot_size:week.pot_size??null,
      authority_source:week.authority_source||'MISSING',authority_update_id:week.authority_update_id||null,
      recipe_final_energy_multiplier:energyContext.recipe_final_energy_multiplier,
      energy_multiplier_source:energyContext.multiplier_source,
      event_effect_strategy_fingerprint:energyContext.event_effect_strategy_fingerprint,
    }),
  });
}
