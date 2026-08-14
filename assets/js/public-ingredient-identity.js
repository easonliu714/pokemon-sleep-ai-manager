export const PUBLIC_INGREDIENT_IDENTITY_VERSION='public-ingredient-identity-2026-08-15-a';
export const PUBLIC_INGREDIENT_CANONICAL_SOURCE_REFS=Object.freeze([
  'pokemon-sleep-official-amber-canyon-avocado-2025-10-23',
  'pokemon-sleep-official-valentines-2025-special-apple-2025-01-31',
]);

export const PUBLIC_INGREDIENT_CANONICAL_NAMES=Object.freeze([
  '沉甸甸南瓜','醒腦咖啡豆','萌綠玉米','萌綠大豆','放鬆可可','好眠番茄','暖暖薑','純粹油',
  '甜甜蜜','哞哞鮮奶','豆製肉','火辣香草','特選蘋果','窩心洋芋','特選蛋','粗枝大蔥',
  '品鮮蘑菇','美味尾巴','嫩亮酪梨',
]);

// Legacy aliases are recognition/migration evidence only. They are never current canonical output
// and must never silently rewrite a player observation.
export const PUBLIC_INGREDIENT_LEGACY_ALIASES=Object.freeze({
  '特選酪梨':'嫩亮酪梨',
});

const clean=value=>String(value??'').normalize('NFKC').trim();
const canonicalSet=new Set(PUBLIC_INGREDIENT_CANONICAL_NAMES);

export function inspectIngredientIdentity(value){
  const observed=clean(value);
  if(!observed)return Object.freeze({
    status:'REVIEW_REQUIRED',observed_value:observed,canonical_name:null,canonical_suggestion:null,
    reason:'INGREDIENT_OBSERVATION_MISSING',silent_rewrite_allowed:false,
  });
  if(canonicalSet.has(observed))return Object.freeze({
    status:'MATCH',observed_value:observed,canonical_name:observed,canonical_suggestion:null,
    reason:'EXACT_CURRENT_CANONICAL',silent_rewrite_allowed:false,
  });
  const suggestion=PUBLIC_INGREDIENT_LEGACY_ALIASES[observed]||null;
  if(suggestion)return Object.freeze({
    status:'REVIEW_REQUIRED',observed_value:observed,canonical_name:null,canonical_suggestion:suggestion,
    reason:'LEGACY_ALIAS_REQUIRES_SOURCE_REVIEW',silent_rewrite_allowed:false,
  });
  return Object.freeze({
    status:'REVIEW_REQUIRED',observed_value:observed,canonical_name:null,canonical_suggestion:null,
    reason:'UNKNOWN_INGREDIENT_IDENTITY',silent_rewrite_allowed:false,
  });
}

export function isCurrentCanonicalIngredient(value){return canonicalSet.has(clean(value));}
