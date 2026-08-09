import {rows,isRescueReadonly} from './database.js';
import {PUBLIC_RECIPE_MASTER_VERSION} from './public-recipe-master.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
} from './public-recipe-provenance.js';
import {projectRecipeStrategy} from './recipe-strategy-projection.js';

function latestWeeklyContext(){
  return rows('SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1')[0]||{};
}

export function buildLocalRecipeStrategyProjection({
  potSize=undefined,
  dishCategory=undefined,
  ingredientSafeReserve={},
  requireVerifiedMaster=false,
  sortMode='unlock_recipes',
  nearShortageMax=10,
  nearMissingKindsMax=2,
}={}){
  if(isRescueReadonly()){
    return {
      schema:'pokemon-sleep-recipe-strategy-projection/1.0',
      projection_status:'PLAYER_DATA_UNAVAILABLE',
      engine_version:null,
      master_version:PUBLIC_RECIPE_MASTER_VERSION,
      provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
      input_fingerprint:null,
      context:{dish_category:dishCategory??null,pot_size:potSize??null},
      summary:{candidate_count:0,status_counts:{},hard_constraint_counts:{REVIEW:1},excluded_counts:{}},
      excluded:{},
      candidates:[],
      missing_inputs:['player_database'],
      player_data_write:false,
    };
  }

  const week=latestWeeklyContext();
  const effectivePot=potSize===undefined?week.pot_size:potSize;
  const effectiveDish=dishCategory===undefined?week.dish_category:dishCategory;
  const activeIds=new Set(PUBLIC_RECIPE_PROVENANCE.filter(row=>row.lifecycle==='ACTIVE').map(row=>row.recipe_id));
  const recipes=rows('SELECT recipe_id,category,recipe_name,base_energy,total_ingredients,data_version FROM recipe_master ORDER BY recipe_id')
    .filter(row=>activeIds.has(row.recipe_id));
  const recipeIngredients=rows('SELECT recipe_id,ingredient_name,quantity FROM recipe_master_ingredients ORDER BY recipe_id,ingredient_name')
    .filter(row=>activeIds.has(row.recipe_id));
  const recipeStates=rows("SELECT recipe_id,unlocked,player_record_exists,player_recipe_id FROM recipe_catalog_state WHERE data_version<>'PLAYER_ONLY' ORDER BY recipe_id")
    .filter(row=>activeIds.has(row.recipe_id));
  const inventory=rows('SELECT ingredient_name,quantity FROM ingredient_inventory ORDER BY ingredient_name');

  return {
    ...projectRecipeStrategy({
      recipes,
      recipeIngredients,
      recipeStates,
      inventory,
      provenance:PUBLIC_RECIPE_PROVENANCE,
      ingredientSafeReserve,
      potSize:effectivePot,
      dishCategory:effectiveDish,
      requireVerifiedMaster,
      sortMode,
      nearShortageMax,
      nearMissingKindsMax,
      masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
      provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
    }),
    projection_status:'READY',
    weekly_context_id:week.context_id||null,
    weekly_context_updated_at:week.updated_at||null,
  };
}
