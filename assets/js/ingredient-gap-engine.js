export function classifyGap({unlocked=false, totalShortage=0, missingKinds=0}){
  if(unlocked) return 'unlocked';
  if(totalShortage===0) return 'ready';
  if(totalShortage<=10 && missingKinds<=2) return 'near';
  return 'far';
}

export function analyzeIngredientGaps({recipes=[], recipeIngredients=[], inventory=[]}){
  const inventoryMap=new Map(inventory.map(item=>[
    item.ingredient_name,
    Number(item.quantity||0),
  ]));
  const byRecipe=new Map();
  for(const item of recipeIngredients){
    if(!byRecipe.has(item.recipe_id)) byRecipe.set(item.recipe_id,[]);
    byRecipe.get(item.recipe_id).push(item);
  }

  return recipes.map(recipe=>{
    const requirements=(byRecipe.get(recipe.recipe_id)||[]).map(item=>{
      const required=Number(item.quantity||0);
      const owned=Number(inventoryMap.get(item.ingredient_name)||0);
      return {
        ingredient_name:item.ingredient_name,
        required,
        owned,
        shortage:Math.max(0,required-owned),
      };
    });
    const totalShortage=requirements.reduce((sum,item)=>sum+item.shortage,0);
    const missingKinds=requirements.filter(item=>item.shortage>0).length;
    const unlocked=Number(recipe.unlocked||0)===1;
    return {
      ...recipe,
      requirements,
      total_shortage:totalShortage,
      missing_kinds:missingKinds,
      status:classifyGap({unlocked,totalShortage,missingKinds}),
      can_attempt:!unlocked&&totalShortage===0,
    };
  });
}

export function sortGapResults(results, mode='shortage'){
  const data=[...results];
  if(mode==='energy') return data.sort((a,b)=>Number(b.base_energy||0)-Number(a.base_energy||0));
  if(mode==='missing_kinds') return data.sort((a,b)=>a.missing_kinds-b.missing_kinds||a.total_shortage-b.total_shortage);
  return data.sort((a,b)=>a.total_shortage-b.total_shortage||a.missing_kinds-b.missing_kinds);
}
