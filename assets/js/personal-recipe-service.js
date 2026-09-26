import {normalizePersonalRecipeDraft,buildPersonalRecipeMutationPlan,PLAYER_RECIPE_SOURCE} from './personal-recipe-authority.js';

export const PERSONAL_RECIPE_SERVICE_VERSION='g51-personal-recipe-service-2026-09-26-c';

const json=value=>JSON.stringify(value??null);
const nowIso=clock=>clock().toISOString();

// Compatibility boundary for browser/runtime consumers that import the G5.1 list projection directly.
// The query remains player-private only; public recipe_master rows are never returned from this helper.
export function listPersonalRecipes(rowsAdapter){
  const readRows=typeof rowsAdapter==='function'?rowsAdapter:rowsAdapter?.rows;
  if(typeof readRows!=='function')throw new Error('rows adapter is required');
  return readRows("SELECT * FROM recipes WHERE source='player_manual' ORDER BY updated_at DESC, recipe_name");
}

export function createPersonalRecipeService({rows,run,snapshot,begin,commit,rollback,persist,clock=()=>new Date(),random=()=>Math.random()}={}){
  for(const [name,fn] of Object.entries({rows,run,snapshot,begin,commit,rollback,persist})){
    if(typeof fn!=='function')throw new Error(`${name} adapter is required`);
  }

  const publicRecipes=()=>rows('SELECT recipe_id,recipe_name FROM recipe_master');
  const loadRecipe=recipeId=>rows('SELECT * FROM recipes WHERE recipe_id=?',[recipeId])[0]||null;
  const loadIngredients=recipeId=>rows('SELECT recipe_id,ingredient_name,quantity FROM recipe_ingredients WHERE recipe_id=? ORDER BY ingredient_name',[recipeId]);
  const loadFull=recipeId=>{
    const recipe=loadRecipe(recipeId);
    return recipe?{...recipe,ingredients:loadIngredients(recipeId)}:null;
  };

  async function mutate(action,input){
    const normalizedAction=String(action||'').trim().toLowerCase();
    const recipeId=String(input?.recipe_id||'').trim();
    if(!recipeId)throw new Error('recipe_id is required');
    const before=loadFull(recipeId);
    if(normalizedAction==='create'&&before)throw new Error('personal recipe already exists');
    if(['update','delete'].includes(normalizedAction)&&!before)throw new Error('personal recipe does not exist');
    const draft=normalizedAction==='delete'?null:normalizePersonalRecipeDraft(input);
    const publicRows=publicRecipes();
    const plan=buildPersonalRecipeMutationPlan({
      action:normalizedAction,
      draft,
      before,
      publicRecipeIds:publicRows.map(row=>row.recipe_id),
      publicRecipeNames:publicRows.map(row=>row.recipe_name),
    });
    if(normalizedAction!=='create'&&String(before?.source||'')!==PLAYER_RECIPE_SOURCE)throw new Error('only player-owned personal recipes can be changed by G5.1 CRUD');

    await snapshot(`g51:personal-recipe:${normalizedAction}:${recipeId}`);
    begin();
    try{
      if(normalizedAction==='delete'){
        run('DELETE FROM recipe_ingredients WHERE recipe_id=?',[recipeId]);
        run('DELETE FROM recipes WHERE recipe_id=?',[recipeId]);
      }else{
        const timestamp=nowIso(clock);
        run(`INSERT INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes)
          VALUES(?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(recipe_id) DO UPDATE SET category=excluded.category,recipe_name=excluded.recipe_name,unlocked=excluded.unlocked,total_ingredients=excluded.total_ingredients,source=excluded.source,recipe_level=excluded.recipe_level,current_energy=excluded.current_energy,updated_at=excluded.updated_at,notes=excluded.notes`,
          [draft.recipe_id,draft.category,draft.recipe_name,draft.unlocked,draft.total_ingredients,PLAYER_RECIPE_SOURCE,draft.recipe_level,draft.current_energy,timestamp,draft.notes]);
        run('DELETE FROM recipe_ingredients WHERE recipe_id=?',[recipeId]);
        for(const ingredient of draft.ingredients){
          run('INSERT INTO recipe_ingredients(recipe_id,ingredient_name,quantity) VALUES(?,?,?)',[recipeId,ingredient.ingredient_name,ingredient.quantity]);
        }
      }

      const after=normalizedAction==='delete'?null:loadFull(recipeId);
      const updateId=`G51-PERSONAL-RECIPE-${Date.now()}-${Math.floor(random()*0x10000).toString(16).padStart(4,'0')}`;
      const timestamp=nowIso(clock);
      run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',
        [updateId,'g51-personal-recipe-1.0',timestamp,timestamp,'g51_personal_recipe_editor',1,json({status:'applied',service_version:PERSONAL_RECIPE_SERVICE_VERSION})]);
      run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',
        [updateId,0,'recipes',`personal_${normalizedAction}`,json({recipe_id:recipeId}),json(before),json(after),'applied','G5.1 Personal Recipe System explicit player mutation']);
      commit();
      await persist();
      return Object.freeze({plan,update_id:updateId,before,after});
    }catch(error){
      rollback();
      throw error;
    }
  }

  return Object.freeze({
    load:loadFull,
    create:input=>mutate('create',input),
    update:input=>mutate('update',input),
    delete:recipeId=>mutate('delete',{recipe_id:recipeId}),
  });
}
