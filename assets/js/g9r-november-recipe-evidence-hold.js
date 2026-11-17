// G9R: official notice establishes categories, ingredient identities and totals only.
// This non-ACTIVE evidence register must never be imported into recipe_master or player SQLite.
export const NOVEMBER_BANQUET_RECIPE_EVIDENCE=Object.freeze([
  {category:'curry',total_ingredients:39,ingredient_names:['萌綠玉米','沉甸甸南瓜','一口堅果']},
  {category:'salad',total_ingredients:121,ingredient_names:['暖暖薑','好眠番茄','嫩亮酪梨','一口堅果']},
  {category:'dessert',total_ingredients:91,ingredient_names:['特選蛋','美味尾巴','萌綠大豆','一口堅果']},
].map(row=>Object.freeze({
  ...row,
  ingredient_names:Object.freeze([...row.ingredient_names]),
  canonical_recipe_name_zh_tw:null,
  ingredient_quantities:null,
  level1_base_energy:null,
  source_ref:'https://www.pokemonsleep.net/zh/news/343537333535313639333033313031343531/',
  verification_status:'HOLD_FORMULA_AND_NAME_EVIDENCE',
  active:false,
})));
export function assessNovemberBanquetRecipePromotion(candidate,evidence={}){
  if(!NOVEMBER_BANQUET_RECIPE_EVIDENCE.includes(candidate))return Object.freeze({status:'HOLD',reason:'UNRECOGNIZED_CANDIDATE'});
  const required=['in_game_screenshot','structured_reference_crosscheck','canonical_recipe_name_zh_tw','ingredient_quantities','level1_base_energy'];
  const missing=required.filter(key=>evidence[key]===undefined||evidence[key]===null||evidence[key]==='');
  // Evidence presence is not verification; a human-reviewed authority is mandatory.
  return Object.freeze({status:'HOLD',reason:missing.length?'MISSING_REQUIRED_EVIDENCE':'MANUAL_AUTHORITY_REVIEW_REQUIRED',missing:Object.freeze(missing)});
}
