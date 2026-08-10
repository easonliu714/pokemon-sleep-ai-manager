export const PUBLIC_RECIPE_DISCOVERY_VERSION='public-recipe-discovery-2026-08-10-a';

// Discovery rows are public game-evidence placeholders only. They are intentionally
// excluded from the ACTIVE canonical recipe master until the in-game zh-TW name
// and canonical formula are observed and verified.
export const PUBLIC_RECIPE_DISCOVERY=Object.freeze([
  Object.freeze({
    discovery_id:'discovery_curry_20260810_a',
    category:'咖哩／濃湯',
    lifecycle:'DISCOVERY_CANDIDATE_FORMULA_REFERENCE_VERIFIED_NAME_PENDING',
    canonical_recipe_id:null,
    canonical_name_zh_tw:null,
    canonical_formula:null,
    observed_ingredient_count:4,
    observed_quantity_signature:Object.freeze([20,20,15,8]),
    observed_total_ingredients:63,
    planning_formula:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:20}),
      Object.freeze({ingredient_name:'火辣香草',quantity:20}),
      Object.freeze({ingredient_name:'萌綠大豆',quantity:8}),
      Object.freeze({ingredient_name:'純粹油',quantity:15}),
    ]),
    planning_formula_status:'REFERENCE_FORMULA_MATCHES_GAME_QUANTITY_SIGNATURE',
    activated_in_game_on:'2026-08-10',
    source_ref:'github-issue:#172',
    active_canonical:false,
  }),
  Object.freeze({
    discovery_id:'discovery_curry_20260810_b',
    category:'咖哩／濃湯',
    lifecycle:'DISCOVERY_CANDIDATE_FORMULA_REFERENCE_VERIFIED_NAME_PENDING',
    canonical_recipe_id:null,
    canonical_name_zh_tw:null,
    canonical_formula:null,
    observed_ingredient_count:4,
    observed_quantity_signature:Object.freeze([39,31,22,20]),
    observed_total_ingredients:112,
    planning_formula:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:39}),
      Object.freeze({ingredient_name:'品鮮蘑菇',quantity:31}),
      Object.freeze({ingredient_name:'火辣香草',quantity:22}),
      Object.freeze({ingredient_name:'豆製肉',quantity:20}),
    ]),
    planning_formula_status:'REFERENCE_FORMULA_MATCHES_GAME_QUANTITY_SIGNATURE',
    activated_in_game_on:'2026-08-10',
    source_ref:'github-issue:#172',
    active_canonical:false,
  }),
]);

export function activeCanonicalDiscoveryRows(){
  return PUBLIC_RECIPE_DISCOVERY.filter(row=>row.active_canonical===true);
}
