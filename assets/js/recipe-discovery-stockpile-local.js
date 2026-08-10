import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {getActiveStrategyGoalProfile} from './strategy-goal-store.js';
import {buildLocalPokemonCandidateScoring} from './pokemon-candidate-local.js';
import {projectRecipeDiscoveryStockpile,RECIPE_DISCOVERY_STOCKPILE_VERSION} from './recipe-discovery-stockpile.js';

export function buildLocalRecipeDiscoveryStockpile({maxAlternatives=2}={}){
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze({
    schema:'pokemon-sleep-recipe-discovery-stockpile/1.0',planner_version:RECIPE_DISCOVERY_STOCKPILE_VERSION,
    projection_status:'PLAYER_DATA_UNAVAILABLE',input_fingerprint:null,discovery_candidates:Object.freeze([]),stockpile:Object.freeze([]),team:null,
    missing_inputs:Object.freeze(['player_database']),production_rate_model:'NOT_YET_VERIFIED',estimated_ingredient_per_hour:null,estimated_weekly_energy:null,
    player_data_write:false,gemini_used:false,canonical_recipe_state_write:false,
  });
  const weeklyContext=rows('SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1')[0]||{};
  const inventory=rows('SELECT ingredient_name,quantity FROM ingredient_inventory ORDER BY ingredient_name');
  const goalProfile=getActiveStrategyGoalProfile();
  const scoringProjection=buildLocalPokemonCandidateScoring();
  if(scoringProjection.projection_status!=='READY')return Object.freeze({
    schema:'pokemon-sleep-recipe-discovery-stockpile/1.0',planner_version:RECIPE_DISCOVERY_STOCKPILE_VERSION,
    projection_status:scoringProjection.projection_status||'PLAYER_DATA_UNAVAILABLE',input_fingerprint:null,discovery_candidates:Object.freeze([]),stockpile:Object.freeze([]),team:null,
    missing_inputs:Object.freeze([...(scoringProjection.missing_inputs||[])]),production_rate_model:'NOT_YET_VERIFIED',estimated_ingredient_per_hour:null,estimated_weekly_energy:null,
    player_data_write:false,gemini_used:false,canonical_recipe_state_write:false,
  });
  return projectRecipeDiscoveryStockpile({inventory,scoringProjection,goalProfile,weeklyContext,maxAlternatives});
}
