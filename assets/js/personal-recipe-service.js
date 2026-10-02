export const PERSONAL_RECIPE_SERVICE_VERSION='g51-personal-recipe-service-retired-2026-10-01-a';
export const PERSONAL_RECIPE_MUTATION_RETIRED=true;

// Legacy rows remain readable for backup/audit compatibility only.
// They are not projected into the canonical Public Recipe Master catalog.
export function listPersonalRecipes(rowsAdapter){
  const readRows=typeof rowsAdapter==='function'?rowsAdapter:rowsAdapter?.rows;
  if(typeof readRows!=='function')throw new Error('rows adapter is required');
  return readRows("SELECT * FROM recipes WHERE source='player_manual' ORDER BY updated_at DESC, recipe_name");
}

export function createPersonalRecipeService({rows}={}){
  if(typeof rows!=='function')throw new Error('rows adapter is required');
  const loadRecipe=recipeId=>rows('SELECT * FROM recipes WHERE recipe_id=?',[recipeId])[0]||null;
  const loadIngredients=recipeId=>rows('SELECT recipe_id,ingredient_name,quantity FROM recipe_ingredients WHERE recipe_id=? ORDER BY ingredient_name',[recipeId]);
  const load=recipeId=>{
    const recipe=loadRecipe(recipeId);
    return recipe?{...recipe,ingredients:loadIngredients(recipeId)}:null;
  };
  const retired=()=>{throw new Error('personal recipe mutation retired; update canonical player recipe state instead');};
  return Object.freeze({load,create:retired,update:retired,delete:retired});
}
