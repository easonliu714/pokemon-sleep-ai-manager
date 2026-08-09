import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
} from './public-recipe-master.js';

export const PUBLIC_RECIPE_PROVENANCE_VERSION='public-recipe-provenance-2026-08-09-a';
export const REVIEWED_RECIPE_MASTER_VERSION='public-recipe-master-2026-08-09-a';

const ACTIVE_FORMULA_REFERENCE=Object.freeze({
  source_type:'reference_structured_current',
  source_name:'Serebii Pokémon Sleep Dishes',
  source_ref:'https://www.serebii.net/pokemonsleep/dishes.shtml',
  observed_at:'2026-08-09',
});

const ACTIVE_NAME_REFERENCE=Object.freeze({
  source_type:'sanitized_user_reference',
  source_name:'sanitized zh-TW recipe list retained from pre-v0.4.2 catalog evidence',
  source_ref:'internal:sanitized-recipe-catalog-evidence:v0383',
  observed_at:'2026-08-05',
});

/**
 * Evidence is intentionally separate from recipe facts.
 *
 * - The 76 active zh-TW names come from sanitized historical user/game catalog
 *   evidence and are NOT labelled as official zh-TW verification.
 * - Ingredient formulas were cross-checked against the current structured
 *   Serebii Pokémon Sleep Dishes reference on 2026-08-09.
 * - `PUBLIC_RECIPE_MASTER_VERSION` is pinned by the audit gate below; future
 *   master revisions must perform a new provenance review instead of silently
 *   inheriting this evidence.
 */
export const PUBLIC_RECIPE_PROVENANCE=Object.freeze(PUBLIC_RECIPE_MASTER.map(recipe=>Object.freeze({
  recipe_id:recipe.recipe_id,
  recipe_name_zh_tw:recipe.recipe_name,
  category:recipe.category,
  lifecycle:'ACTIVE',
  name_evidence:'SANITIZED_USER_REFERENCE',
  name_source_type:ACTIVE_NAME_REFERENCE.source_type,
  name_source_name:ACTIVE_NAME_REFERENCE.source_name,
  name_source_ref:ACTIVE_NAME_REFERENCE.source_ref,
  name_observed_at:ACTIVE_NAME_REFERENCE.observed_at,
  formula_evidence:'REFERENCE_VERIFIED',
  formula_source_type:ACTIVE_FORMULA_REFERENCE.source_type,
  formula_source_name:ACTIVE_FORMULA_REFERENCE.source_name,
  formula_source_ref:ACTIVE_FORMULA_REFERENCE.source_ref,
  formula_verified_at:ACTIVE_FORMULA_REFERENCE.observed_at,
  reference_match_basis:'category_order+ingredient_signature+historical_zh_tw_identity',
  overall_status:'ACTIVE_MIXED_EVIDENCE',
  provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  reviewed_recipe_master_version:REVIEWED_RECIPE_MASTER_VERSION,
})));

/**
 * Reference-discovered rows are deliberately excluded from PUBLIC_RECIPE_MASTER.
 * They cannot appear in SQLite recipe_master, Ingredient Gap, or strategy
 * candidates until a later activation gate supplies a verified zh-TW name and
 * confirms the actual game effective date.
 */
export const PUBLIC_RECIPE_UPCOMING_EVIDENCE=Object.freeze([
  Object.freeze({
    evidence_id:'upcoming_recipe_greengrass_curry_bun_20260809',
    external_name:'Greengrass Curry Bun',
    canonical_name_zh_tw:null,
    category:'咖哩／濃湯',
    ingredients:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:20}),
      Object.freeze({ingredient_name:'火辣香草',quantity:20}),
      Object.freeze({ingredient_name:'萌綠大豆',quantity:8}),
      Object.freeze({ingredient_name:'純粹油',quantity:15}),
    ]),
    lifecycle:'UPCOMING_REFERENCE_DISCOVERED',
    formula_evidence:'REFERENCE_VERIFIED_PRE_RELEASE',
    formula_source_ref:'https://www.serebii.net/pokemonsleep/dishes.shtml',
    discovered_at:'2026-08-09',
    effective_from:null,
    activation_check_not_before:'2026-08-10',
    related_official_context_ref:'https://www.pokemonsleep.net/zh/news/343231343532353138373131363233363832/',
    activation_status:'BLOCKED_PENDING_ZH_TW_NAME_AND_LIVE_EFFECTIVE_VERIFICATION',
    tracking_issue:'#172',
    provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  }),
  Object.freeze({
    evidence_id:'upcoming_recipe_bounce_curry_udon_20260809',
    external_name:'Bounce Curry Udon',
    canonical_name_zh_tw:null,
    category:'咖哩／濃湯',
    ingredients:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:39}),
      Object.freeze({ingredient_name:'品鮮蘑菇',quantity:31}),
      Object.freeze({ingredient_name:'火辣香草',quantity:22}),
      Object.freeze({ingredient_name:'豆製肉',quantity:20}),
    ]),
    lifecycle:'UPCOMING_REFERENCE_DISCOVERED',
    formula_evidence:'REFERENCE_VERIFIED_PRE_RELEASE',
    formula_source_ref:'https://www.serebii.net/pokemonsleep/dishes.shtml',
    discovered_at:'2026-08-09',
    effective_from:null,
    activation_check_not_before:'2026-08-10',
    related_official_context_ref:'https://www.pokemonsleep.net/zh/news/343231343532353138373131363233363832/',
    activation_status:'BLOCKED_PENDING_ZH_TW_NAME_AND_LIVE_EFFECTIVE_VERIFICATION',
    tracking_issue:'#172',
    provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  }),
]);

export function recipeProvenanceCoverage(){
  const lifecycle={};
  const nameEvidence={};
  const formulaEvidence={};
  for(const row of PUBLIC_RECIPE_PROVENANCE){
    lifecycle[row.lifecycle]=(lifecycle[row.lifecycle]||0)+1;
    nameEvidence[row.name_evidence]=(nameEvidence[row.name_evidence]||0)+1;
    formulaEvidence[row.formula_evidence]=(formulaEvidence[row.formula_evidence]||0)+1;
  }
  for(const row of PUBLIC_RECIPE_UPCOMING_EVIDENCE){
    lifecycle[row.lifecycle]=(lifecycle[row.lifecycle]||0)+1;
    formulaEvidence[row.formula_evidence]=(formulaEvidence[row.formula_evidence]||0)+1;
  }
  return Object.freeze({
    provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
    reviewed_recipe_master_version:REVIEWED_RECIPE_MASTER_VERSION,
    runtime_recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
    active_recipe_count:PUBLIC_RECIPE_PROVENANCE.length,
    upcoming_evidence_count:PUBLIC_RECIPE_UPCOMING_EVIDENCE.length,
    lifecycle:Object.freeze(lifecycle),
    name_evidence:Object.freeze(nameEvidence),
    formula_evidence:Object.freeze(formulaEvidence),
  });
}
