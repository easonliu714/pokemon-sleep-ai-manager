export const PUBLIC_RECIPE_DISCOVERY_VERSION='public-recipe-discovery-2026-08-12-c-promoted';

// Historical Discovery rows are retained for audit. v0.4.13.2 promotes both
// Aug-10 candidates to the ACTIVE canonical recipe master after current in-game
// zh-TW names and exact ingredient formulas became visible. Stockpile planning
// filters active_canonical=true, so these rows no longer appear as Candidate A/B.
export const PUBLIC_RECIPE_DISCOVERY=Object.freeze([
  Object.freeze({
    discovery_id:'discovery_curry_20260810_a',
    category:'咖哩／濃湯',
    lifecycle:'PROMOTED_TO_CANONICAL_ACTIVE',
    canonical_recipe_id:'curry_greengrass_bun',
    canonical_name_zh_tw:'萌綠咖哩麵包',
    canonical_formula:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:20}),
      Object.freeze({ingredient_name:'火辣香草',quantity:20}),
      Object.freeze({ingredient_name:'萌綠大豆',quantity:8}),
      Object.freeze({ingredient_name:'純粹油',quantity:15}),
    ]),
    observed_ingredient_count:4,
    observed_quantity_signature:Object.freeze([20,20,15,8]),
    observed_total_ingredients:63,
    reference_ingredient_set:Object.freeze(['暖暖薑','火辣香草','萌綠大豆','純粹油']),
    reference_ingredient_set_status:'CANONICAL_FORMULA_CONFIRMED',
    quantity_assignment_status:'EXACT_CURRENT_GAME_FORMULA_CONFIRMED',
    max_observed_quantity:20,
    planning_policy:'CANONICAL_RECIPE_MASTER',
    activated_in_game_on:'2026-08-10',
    promoted_on:'2026-08-12',
    source_ref:'github-issue:#172',
    active_canonical:true,
  }),
  Object.freeze({
    discovery_id:'discovery_curry_20260810_b',
    category:'咖哩／濃湯',
    lifecycle:'PROMOTED_TO_CANONICAL_ACTIVE',
    canonical_recipe_id:'curry_bounce_udon',
    canonical_name_zh_tw:'彈跳咖哩烏龍麵',
    canonical_formula:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:39}),
      Object.freeze({ingredient_name:'品鮮蘑菇',quantity:31}),
      Object.freeze({ingredient_name:'火辣香草',quantity:22}),
      Object.freeze({ingredient_name:'豆製肉',quantity:20}),
    ]),
    observed_ingredient_count:4,
    observed_quantity_signature:Object.freeze([39,31,22,20]),
    observed_total_ingredients:112,
    reference_ingredient_set:Object.freeze(['暖暖薑','品鮮蘑菇','火辣香草','豆製肉']),
    reference_ingredient_set_status:'CANONICAL_FORMULA_CONFIRMED',
    quantity_assignment_status:'EXACT_CURRENT_GAME_FORMULA_CONFIRMED',
    max_observed_quantity:39,
    planning_policy:'CANONICAL_RECIPE_MASTER',
    activated_in_game_on:'2026-08-10',
    promoted_on:'2026-08-12',
    source_ref:'github-issue:#172',
    active_canonical:true,
  }),
]);

export function activeCanonicalDiscoveryRows(){
  return PUBLIC_RECIPE_DISCOVERY.filter(row=>row.active_canonical===true);
}
