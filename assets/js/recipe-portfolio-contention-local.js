import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {buildLocalRecipeStrategyProjection} from './recipe-strategy-local.js';
import {buildLocalPokemonCandidateScoring} from './pokemon-candidate-local.js';
import {optimizeTeam} from './team-optimizer.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {projectRecipePortfolioContention,RECIPE_PORTFOLIO_CONTENTION_VERSION} from './recipe-portfolio-contention.js';
import {projectTeamSupplyReadiness,TEAM_SUPPLY_RATE_STATUS} from './team-supply-readiness.js';

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

function teamSupplyProjection(recipeStrategy,goalProfile){
  try{
    const scoring=buildLocalPokemonCandidateScoring();
    if(scoring?.projection_status!=='READY')return Object.freeze({
      schema:'pokemon-sleep-team-supply-readiness/1.0',projection_status:scoring?.projection_status||'PLAYER_DATA_UNAVAILABLE',input_fingerprint:null,
      team_id:null,team_status:'UNAVAILABLE',team_member_count:0,production_rate_status:TEAM_SUPPLY_RATE_STATUS,ingredient_per_hour_authority:false,replenishment_eta_authority:false,
      summary:Object.freeze({shortage_recipe_count:0,team_capability_covered_recipe_count:0,partial_team_coverage_recipe_count:0,no_team_source_recipe_count:0,shortage_ingredient_count:0,covered_shortage_ingredient_count:0,uncovered_shortage_ingredient_count:0}),
      covered_shortage_ingredients:Object.freeze([]),uncovered_shortage_ingredients:Object.freeze([]),capabilities:Object.freeze([]),recipes:Object.freeze([]),
      inventory_virtualization:false,inventory_ready_promotion:false,player_data_write:false,inventory_mutation:false,pokemon_write:false,public_master_write:false,gemini_used:false,
    });
    const optimized=optimizeTeam({scoringProjection:scoring,goalProfile,maxAlternatives:0});
    return projectTeamSupplyReadiness({
      recipeStrategy,
      teamOptimization:optimized,
      candidateFeatures:{input_fingerprint:scoring.feature_fingerprint||null,candidates:scoring.candidates||[]},
    });
  }catch(error){
    return Object.freeze({
      schema:'pokemon-sleep-team-supply-readiness/1.0',projection_status:'TEAM_PROJECTION_FAILED',input_fingerprint:null,team_id:null,team_status:'UNAVAILABLE',team_member_count:0,
      production_rate_status:TEAM_SUPPLY_RATE_STATUS,ingredient_per_hour_authority:false,replenishment_eta_authority:false,error_message:String(error?.message||error),
      summary:Object.freeze({shortage_recipe_count:0,team_capability_covered_recipe_count:0,partial_team_coverage_recipe_count:0,no_team_source_recipe_count:0,shortage_ingredient_count:0,covered_shortage_ingredient_count:0,uncovered_shortage_ingredient_count:0}),
      covered_shortage_ingredients:Object.freeze([]),uncovered_shortage_ingredients:Object.freeze([]),capabilities:Object.freeze([]),recipes:Object.freeze([]),
      inventory_virtualization:false,inventory_ready_promotion:false,player_data_write:false,inventory_mutation:false,pokemon_write:false,public_master_write:false,gemini_used:false,
    });
  }
}

export function buildLocalRecipePortfolioContention({objective='unlock_recipes',maxMeals=3,maxAlternatives=3,beamWidth=64}={}){
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze({
    schema:'pokemon-sleep-recipe-portfolio-contention/1.1',planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,
    projection_status:'PLAYER_DATA_UNAVAILABLE',input_fingerprint:null,objective,context:Object.freeze({max_meals:maxMeals,max_alternatives:maxAlternatives}),
    summary:Object.freeze({individually_ready_count:0,simulation_candidate_count:0,alternative_count:0}),contention:null,alternatives:Object.freeze([]),team_supply:null,
    missing_inputs:Object.freeze(['player_database']),player_data_write:false,inventory_mutation:false,public_master_write:false,gemini_used:false,
  });
  const week=currentWeeklyContext(),goalProfile=getActiveStrategyGoalProfile(),hard=goalProfile?.hard_constraints||{};
  const baseStrategy=buildLocalRecipeStrategyProjection({ingredientSafeReserve:hard.ingredient_safe_reserve||{},requireVerifiedMaster:Boolean(hard.require_verified_master),sortMode:'unlock_recipes'});
  if(baseStrategy.projection_status!=='READY')return Object.freeze({
    schema:'pokemon-sleep-recipe-portfolio-contention/1.1',planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,
    projection_status:baseStrategy.projection_status||'PLAYER_DATA_UNAVAILABLE',input_fingerprint:null,objective,context:Object.freeze({max_meals:maxMeals,max_alternatives:maxAlternatives}),
    summary:Object.freeze({individually_ready_count:0,simulation_candidate_count:0,alternative_count:0}),contention:null,alternatives:Object.freeze([]),team_supply:null,
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
  const teamSupply=teamSupplyProjection(strategy,goalProfile);
  return Object.freeze({
    ...result,
    recipe_strategy_fingerprint:strategy.input_fingerprint||null,
    goal_profile_id:goalProfile?.goal_profile_id||null,
    team_supply:teamSupply,
    weekly_context:Object.freeze({
      context_id:week.context_id||null,week_start:week.week_start||null,dish_category:week.dish_category||null,pot_size:week.pot_size??null,
      authority_source:week.authority_source||'MISSING',authority_update_id:week.authority_update_id||null,
      recipe_final_energy_multiplier:energyContext.recipe_final_energy_multiplier,
      energy_multiplier_source:energyContext.multiplier_source,
      event_effect_strategy_fingerprint:energyContext.event_effect_strategy_fingerprint,
    }),
  });
}
