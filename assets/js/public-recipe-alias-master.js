import {
  PUBLIC_RECIPE_ALIASES as CANONICAL_COMPATIBILITY_ALIASES,
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
} from './public-recipe-current-authority.js';

export const PUBLIC_RECIPE_ALIAS_VERSION='public-recipe-alias-2026-08-14-c';

const canonicalById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[String(row.recipe_id),row]));

// Only reviewed safe legacy recipe-name aliases are exposed to automatic recognition.
// Current in-game zh-TW names belong in PUBLIC_RECIPE_MASTER itself, not in a parallel AI-only alias list.
export const PUBLIC_RECIPE_ALIASES=Object.freeze(CANONICAL_COMPATIBILITY_ALIASES
  .filter(row=>row?.alias_type==='legacy_recipe_name'&&row?.is_auto_replace_safe===true)
  .map(row=>{
    const recipe=canonicalById.get(String(row.recipe_id));
    if(!recipe)return null;
    return Object.freeze({
      alias_name:String(row.alias_value||''),
      recipe_id:String(recipe.recipe_id),
      recipe_name:String(recipe.recipe_name),
      verification_status:'REVIEWED_LEGACY_RECIPE_NAME_COMPATIBILITY',
      verified_at:recipe.verified_at||null,
      source_ref:row.source_ref||'internal:public-recipe-current-authority',
      data_version:PUBLIC_RECIPE_MASTER_VERSION,
    });
  })
  .filter(Boolean));

export function normalizeRecipeIdentityText(value){
  return String(value??'').normalize('NFKC').replace(/\s+/g,'').trim();
}

export function recipeAliasesForCanonical(recipeId,recipeName,aliases=PUBLIC_RECIPE_ALIASES){
  const id=String(recipeId??'').trim(),requestedName=normalizeRecipeIdentityText(recipeName),current=canonicalById.get(id),currentName=normalizeRecipeIdentityText(current?.recipe_name);
  const values=aliases.filter(row=>String(row.recipe_id??'').trim()===id).map(row=>row.alias_name);
  // Successor bridge: a restored/older recognition snapshot can still carry the previous
  // canonical display name. The current audited in-game name is then exposed as an approved
  // identity alias for that snapshot only; current runtime catalog/master remains authoritative.
  if(currentName&&requestedName&&currentName!==requestedName)values.push(current.recipe_name);
  return [...new Set(values.filter(Boolean))];
}

export function isApprovedRecipeAlias(observedText,recipeId,recipeName,aliases=PUBLIC_RECIPE_ALIASES){
  const observed=normalizeRecipeIdentityText(observedText);
  if(!observed)return false;
  return recipeAliasesForCanonical(recipeId,recipeName,aliases).some(alias=>normalizeRecipeIdentityText(alias)===observed);
}

export function isRecipeAutomaticIdentityMatch(observedText,recipeRow,{userResolution=null,aliases=PUBLIC_RECIPE_ALIASES}={}){
  if(userResolution?.action==='USER_CONFIRMED_MATCH')return true;
  const canonical=normalizeRecipeIdentityText(recipeRow?.recipe_name);
  const observed=normalizeRecipeIdentityText(observedText);
  if(observed&&canonical&&observed===canonical)return true;
  return isApprovedRecipeAlias(observedText,recipeRow?.recipe_id,recipeRow?.recipe_name,aliases);
}
