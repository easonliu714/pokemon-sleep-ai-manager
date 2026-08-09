export const RECIPE_NAME_RECONCILIATION_SCHEMA='pokemon-sleep-game-recipe-name-reconciliation/1.0';

export function normalizeRecipeCategory(value){
  const text=String(value||'').trim();
  if(text==='點心／飲料'||text==='甜點／飲料')return '甜點／飲料';
  return text;
}
export function normalizeRecipeName(value){return String(value||'').normalize('NFKC').trim();}
export function ingredientSignature(ingredients){
  return Object.entries(ingredients||{})
    .map(([name,quantity])=>[normalizeRecipeName(name),Number(quantity)])
    .filter(([name,quantity])=>name&&Number.isFinite(quantity)&&quantity>0)
    .sort((a,b)=>a[0].localeCompare(b[0],'zh-Hant'))
    .map(([name,quantity])=>`${name}×${quantity}`)
    .join('|');
}

export function extractPrivateRecipeEvidence(privatePayload){
  if(privatePayload?.privacy?.github_commit_allowed!==false)throw new Error('預期私人料理證據 privacy.github_commit_allowed=false');
  if(privatePayload?.source!=='player_game_screenshots_from_private_zip')throw new Error(`不支援的料理證據來源：${privatePayload?.source||'未提供'}`);
  const recipes=new Map();
  for(const operation of privatePayload.operations||[]){
    if(operation?.action!=='upsert'||operation.entity!=='recipes')continue;
    const privateId=String(operation.key?.recipe_id||'');
    if(!privateId)continue;
    recipes.set(privateId,{category:normalizeRecipeCategory(operation.data?.category),recipe_name:normalizeRecipeName(operation.data?.recipe_name),ingredients:{}});
  }
  for(const operation of privatePayload.operations||[]){
    if(operation?.action!=='upsert'||operation.entity!=='recipe_ingredients')continue;
    const privateId=String(operation.key?.recipe_id||''),ingredient=normalizeRecipeName(operation.key?.ingredient_name),quantity=Number(operation.data?.quantity),recipe=recipes.get(privateId);
    if(recipe&&ingredient&&Number.isFinite(quantity))recipe.ingredients[ingredient]=quantity;
  }
  return [...recipes.values()];
}

export function reconcileGameRecipeEvidence(privatePayload,publicMaster,publicRecipeMasterVersion){
  const privateRecipes=extractPrivateRecipeEvidence(privatePayload);
  const masterIndex=new Map();
  for(const recipe of publicMaster||[]){
    const category=normalizeRecipeCategory(recipe.category);
    const ingredients=Object.fromEntries((recipe.ingredients||[]).map(row=>[normalizeRecipeName(row.ingredient_name),Number(row.quantity)]));
    const key=`${category}::${ingredientSignature(ingredients)}`;
    if(!masterIndex.has(key))masterIndex.set(key,[]);
    masterIndex.get(key).push({recipe_id:recipe.recipe_id,category,recipe_name:normalizeRecipeName(recipe.recipe_name),ingredients,verification_status:recipe.verification_status||null});
  }
  const rows=privateRecipes.map(recipe=>{
    const signature=ingredientSignature(recipe.ingredients),matches=masterIndex.get(`${recipe.category}::${signature}`)||[];
    let classification='NO_PUBLIC_MATCH',canonical=null;
    if(matches.length===1){canonical=matches[0];classification=canonical.recipe_name===recipe.recipe_name?'EXACT_CANONICAL_NAME':'NAME_CORRECTION_REQUIRED';}
    else if(matches.length>1)classification='AMBIGUOUS_SIGNATURE';
    return {
      category:recipe.category,
      game_recipe_name:recipe.recipe_name,
      ingredient_signature:signature,
      classification,
      canonical_recipe_id:canonical?.recipe_id||null,
      current_public_name:canonical?.recipe_name||null,
      proposed_canonical_name:canonical&&classification==='NAME_CORRECTION_REQUIRED'?recipe.recipe_name:null,
      proposed_legacy_alias:canonical&&classification==='NAME_CORRECTION_REQUIRED'?canonical.recipe_name:null,
      public_verification_status:canonical?.verification_status||null,
      candidate_recipe_ids:matches.length>1?matches.map(row=>row.recipe_id):[],
    };
  }).sort((a,b)=>a.category.localeCompare(b.category,'zh-Hant')||a.game_recipe_name.localeCompare(b.game_recipe_name,'zh-Hant'));
  const counts=rows.reduce((acc,row)=>{acc[row.classification]=(acc[row.classification]||0)+1;return acc;},{});
  return {
    schema:RECIPE_NAME_RECONCILIATION_SCHEMA,
    public_recipe_master_version:publicRecipeMasterVersion,
    source_policy:'PRIVATE_INPUT_SANITIZED_OUTPUT_ONLY',
    private_fields_exported:false,
    player_recipe_count:rows.length,
    counts,
    rows,
  };
}
