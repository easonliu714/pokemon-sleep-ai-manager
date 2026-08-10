export const PUBLIC_RECIPE_DISCOVERY_VERSION='public-recipe-discovery-2026-08-10-b';

// Discovery rows are public game-evidence placeholders only. They are intentionally
// excluded from the ACTIVE canonical recipe master until the in-game zh-TW name
// and canonical formula are observed and verified. The locked-recipe screen proves
// only an unordered quantity signature; it does NOT prove which quantity belongs
// to which candidate ingredient.
export const PUBLIC_RECIPE_DISCOVERY=Object.freeze([
  Object.freeze({
    discovery_id:'discovery_curry_20260810_a',
    category:'咖哩／濃湯',
    lifecycle:'DISCOVERY_CANDIDATE_REFERENCE_INGREDIENT_SET_QUANTITY_ASSIGNMENT_UNKNOWN_NAME_PENDING',
    canonical_recipe_id:null,
    canonical_name_zh_tw:null,
    canonical_formula:null,
    observed_ingredient_count:4,
    observed_quantity_signature:Object.freeze([20,20,15,8]),
    observed_total_ingredients:63,
    reference_ingredient_set:Object.freeze(['暖暖薑','火辣香草','萌綠大豆','純粹油']),
    reference_ingredient_set_status:'REFERENCE_ONLY_NOT_CANONICAL_FORMULA',
    quantity_assignment_status:'UNKNOWN_UNORDERED_SIGNATURE',
    max_observed_quantity:20,
    planning_policy:'EACH_REFERENCE_INGREDIENT_AT_SIGNATURE_MAX',
    activated_in_game_on:'2026-08-10',
    source_ref:'github-issue:#172',
    active_canonical:false,
  }),
  Object.freeze({
    discovery_id:'discovery_curry_20260810_b',
    category:'咖哩／濃湯',
    lifecycle:'DISCOVERY_CANDIDATE_REFERENCE_INGREDIENT_SET_QUANTITY_ASSIGNMENT_UNKNOWN_NAME_PENDING',
    canonical_recipe_id:null,
    canonical_name_zh_tw:null,
    canonical_formula:null,
    observed_ingredient_count:4,
    observed_quantity_signature:Object.freeze([39,31,22,20]),
    observed_total_ingredients:112,
    reference_ingredient_set:Object.freeze(['暖暖薑','品鮮蘑菇','火辣香草','豆製肉']),
    reference_ingredient_set_status:'REFERENCE_ONLY_NOT_CANONICAL_FORMULA',
    quantity_assignment_status:'UNKNOWN_UNORDERED_SIGNATURE',
    max_observed_quantity:39,
    planning_policy:'EACH_REFERENCE_INGREDIENT_AT_SIGNATURE_MAX',
    activated_in_game_on:'2026-08-10',
    source_ref:'github-issue:#172',
    active_canonical:false,
  }),
]);

export function activeCanonicalDiscoveryRows(){
  return PUBLIC_RECIPE_DISCOVERY.filter(row=>row.active_canonical===true);
}
