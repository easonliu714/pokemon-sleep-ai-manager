export const PUBLIC_RECIPE_ALIAS_VERSION='public-recipe-alias-2026-08-11-a';

// Public-only current-game naming aliases verified from the 2026-08-11 Android LIVE screenshots
// by exact visible recipe name plus matching visible ingredient composition. Player level/energy
// values are intentionally not retained here.
export const PUBLIC_RECIPE_ALIASES=Object.freeze([
  Object.freeze({
    alias_name:'絕對睡眠奶油咖哩',
    recipe_id:'curry_dream_eater',
    recipe_name:'夢食奶油咖哩',
    verification_status:'CURRENT_GAME_SCREENSHOT_RECIPE_AND_INGREDIENTS_MATCH',
    verified_at:'2026-08-11',
    source_ref:'internal:v04112-android-live-recipe-name-evidence',
  }),
  Object.freeze({
    alias_name:'迷昏拳辣味咖哩',
    recipe_id:'curry_dizzy_punch',
    recipe_name:'暈眩拳辣味咖哩',
    verification_status:'CURRENT_GAME_SCREENSHOT_RECIPE_AND_INGREDIENTS_MATCH',
    verified_at:'2026-08-11',
    source_ref:'internal:v04112-android-live-recipe-name-evidence',
  }),
  Object.freeze({
    alias_name:'柔軟玉米濃湯',
    recipe_id:'curry_soft_corn',
    recipe_name:'玉米濃湯',
    verification_status:'CURRENT_GAME_SCREENSHOT_RECIPE_AND_INGREDIENTS_MATCH',
    verified_at:'2026-08-11',
    source_ref:'internal:v04112-android-live-recipe-name-evidence',
  }),
]);

export function normalizeRecipeIdentityText(value){
  return String(value??'').normalize('NFKC').replace(/\s+/g,'').trim();
}

export function recipeAliasesForCanonical(recipeId,recipeName,aliases=PUBLIC_RECIPE_ALIASES){
  const id=String(recipeId??'').trim(),name=normalizeRecipeIdentityText(recipeName);
  return aliases
    .filter(row=>String(row.recipe_id??'').trim()===id&&normalizeRecipeIdentityText(row.recipe_name)===name)
    .map(row=>row.alias_name);
}

export function isApprovedRecipeAlias(observedText,recipeId,recipeName,aliases=PUBLIC_RECIPE_ALIASES){
  const observed=normalizeRecipeIdentityText(observedText);
  if(!observed)return false;
  return aliases.some(row=>
    String(row.recipe_id??'').trim()===String(recipeId??'').trim()&&
    normalizeRecipeIdentityText(row.recipe_name)===normalizeRecipeIdentityText(recipeName)&&
    normalizeRecipeIdentityText(row.alias_name)===observed
  );
}

export function isRecipeAutomaticIdentityMatch(observedText,recipeRow,{userResolution=null,aliases=PUBLIC_RECIPE_ALIASES}={}){
  if(userResolution?.action==='USER_CONFIRMED_MATCH')return true;
  const canonical=normalizeRecipeIdentityText(recipeRow?.recipe_name);
  const observed=normalizeRecipeIdentityText(observedText);
  if(observed&&canonical&&observed===canonical)return true;
  return isApprovedRecipeAlias(observedText,recipeRow?.recipe_id,recipeRow?.recipe_name,aliases);
}
