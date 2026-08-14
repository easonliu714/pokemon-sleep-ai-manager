import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
} from './public-recipe-current-authority.js';

export const PUBLIC_RECIPE_PROVENANCE_VERSION='public-recipe-provenance-2026-08-13-a';
export const REVIEWED_RECIPE_MASTER_VERSION=PUBLIC_RECIPE_MASTER_VERSION;

const ACTIVE_FORMULA_REFERENCE=Object.freeze({
  source_type:'reference_structured_current',
  source_name:'Serebii Pokémon Sleep Dishes',
  source_ref:'https://www.serebii.net/pokemonsleep/dishes.shtml',
  observed_at:'2026-08-13',
});

const HISTORICAL_NAME_REFERENCE=Object.freeze({
  source_type:'sanitized_user_reference',
  source_name:'sanitized zh-TW recipe list retained from pre-v0.4.2 catalog evidence',
  source_ref:'internal:sanitized-recipe-catalog-evidence:v0383',
  observed_at:'2026-08-05',
});

const SCREENSHOT_NAME_REFERENCE_20260809=Object.freeze({
  source_type:'game_screenshot_verified',
  source_name:'sanitized in-game zh-TW recipe screenshot evidence',
  source_ref:'internal:public-recipe-zh-tw-screenshot-evidence-2026-08-09',
  observed_at:'2026-08-09',
});

const SCREENSHOT_NAME_REFERENCE_20260811=Object.freeze({
  source_type:'game_screenshot_verified',
  source_name:'current in-game zh-TW recipe screenshot evidence',
  source_ref:'internal:v04114-android-live-current-recipe-name-evidence',
  observed_at:'2026-08-11',
});

const SCREENSHOT_FORMULA_REFERENCE=Object.freeze({
  source_type:'game_screenshot_verified_formula',
  source_name:'current in-game zh-TW recipe screenshot ingredient evidence',
  source_ref:'internal:v04114-android-live-current-recipe-formula-evidence',
  observed_at:'2026-08-11',
});

const PARENT_CHILD_FORMULA_REFERENCE_20260813=Object.freeze({
  source_type:'game_screenshot_reference_crosscheck',
  source_name:'current in-game zh-TW 親子愛咖哩 detail screenshot + current structured recipe references',
  source_ref:'internal:v04221-parent-child-current-game-formula-evidence+reference-crosscheck',
  observed_at:'2026-08-13',
});

const AUG12_ACTIVATION_REFERENCE=Object.freeze({
  source_type:'game_screenshot_reference_crosscheck',
  source_name:'current in-game zh-TW activation screenshot + current structured reference',
  source_ref:'internal:v04132-recipe-activation-evidence+#172',
  observed_at:'2026-08-12',
});

export const PUBLIC_RECIPE_PROVENANCE=Object.freeze(PUBLIC_RECIPE_MASTER.map(recipe=>{
  const activatedAug12=Boolean(recipe.activation_contract_version);
  const screenshotVerifiedName=recipe.source_type==='game_screenshot_verified';
  const currentScreenshotName=screenshotVerifiedName&&recipe.source_ref==='internal:v04114-android-live-current-recipe-name-evidence';
  const screenshotVerifiedFormula=Boolean(recipe.formula_contract_version);
  const correctedParentChildFormula=recipe.recipe_id==='curry_parent_child';
  const nameSource=activatedAug12?AUG12_ACTIVATION_REFERENCE:currentScreenshotName?SCREENSHOT_NAME_REFERENCE_20260811:screenshotVerifiedName?SCREENSHOT_NAME_REFERENCE_20260809:HISTORICAL_NAME_REFERENCE;
  const formulaSource=activatedAug12?AUG12_ACTIVATION_REFERENCE:correctedParentChildFormula?PARENT_CHILD_FORMULA_REFERENCE_20260813:screenshotVerifiedFormula?SCREENSHOT_FORMULA_REFERENCE:ACTIVE_FORMULA_REFERENCE;
  const formulaEvidence=activatedAug12?'GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK':correctedParentChildFormula?'GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK':screenshotVerifiedFormula?'GAME_SCREENSHOT_VERIFIED':'REFERENCE_VERIFIED';
  return Object.freeze({
    recipe_id:recipe.recipe_id,
    recipe_name_zh_tw:recipe.recipe_name,
    category:recipe.category,
    lifecycle:'ACTIVE',
    name_evidence:activatedAug12?'GAME_SCREENSHOT_VERIFIED':screenshotVerifiedName?'GAME_SCREENSHOT_VERIFIED':'SANITIZED_USER_REFERENCE',
    name_source_type:nameSource.source_type,
    name_source_name:nameSource.source_name,
    name_source_ref:nameSource.source_ref,
    name_observed_at:nameSource.observed_at,
    formula_evidence:formulaEvidence,
    formula_source_type:formulaSource.source_type,
    formula_source_name:formulaSource.source_name,
    formula_source_ref:formulaSource.source_ref,
    formula_verified_at:formulaSource.observed_at,
    formula_audit_version:PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
    reference_match_basis:activatedAug12?'in_game_zh_tw_name+exact_ingredient_formula+reference_crosscheck':correctedParentChildFormula?'current_in_game_detail+exact_ingredient_formula+two_reference_crosscheck':screenshotVerifiedName?'category+ingredient_signature+in_game_zh_tw_name':'category_order+ingredient_signature+historical_zh_tw_identity',
    overall_status:activatedAug12?'ACTIVE_CURRENT_GAME_NAME_FORMULA_VERIFIED':correctedParentChildFormula?'ACTIVE_CURRENT_GAME_FORMULA_CORRECTED_REFERENCE_CROSSCHECKED':screenshotVerifiedFormula?'ACTIVE_SCREENSHOT_FORMULA_VERIFIED':screenshotVerifiedName?'ACTIVE_SCREENSHOT_NAME_REFERENCE_FORMULA':'ACTIVE_MIXED_EVIDENCE',
    provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
    reviewed_recipe_master_version:REVIEWED_RECIPE_MASTER_VERSION,
  });
}));

// Historical activation evidence is retained for audit, but these rows are no longer pending.
export const PUBLIC_RECIPE_UPCOMING_EVIDENCE=Object.freeze([
  Object.freeze({
    evidence_id:'upcoming_recipe_greengrass_curry_bun_20260809',
    external_name:'Greengrass Curry Bun',
    canonical_recipe_id:'curry_greengrass_bun',
    canonical_name_zh_tw:'萌綠咖哩麵包',
    category:'咖哩／濃湯',
    ingredients:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:20}),
      Object.freeze({ingredient_name:'火辣香草',quantity:20}),
      Object.freeze({ingredient_name:'萌綠大豆',quantity:8}),
      Object.freeze({ingredient_name:'純粹油',quantity:15}),
    ]),
    lifecycle:'PROMOTED_TO_CANONICAL',
    formula_evidence:'GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK',
    formula_source_ref:'https://www.serebii.net/pokemonsleep/dishes.shtml',
    discovered_at:'2026-08-09',
    effective_from:'2026-08-10',
    activation_check_not_before:'2026-08-10',
    related_official_context_ref:'https://www.pokemonsleep.net/zh/news/343231343532353138373131363233363832/',
    activation_status:'PROMOTED_ACTIVE_2026_08_12',
    tracking_issue:'#172',
    provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  }),
  Object.freeze({
    evidence_id:'upcoming_recipe_bounce_curry_udon_20260809',
    external_name:'Bounce Curry Udon',
    canonical_recipe_id:'curry_bounce_udon',
    canonical_name_zh_tw:'彈跳咖哩烏龍麵',
    category:'咖哩／濃湯',
    ingredients:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:39}),
      Object.freeze({ingredient_name:'品鮮蘑菇',quantity:31}),
      Object.freeze({ingredient_name:'火辣香草',quantity:22}),
      Object.freeze({ingredient_name:'豆製肉',quantity:20}),
    ]),
    lifecycle:'PROMOTED_TO_CANONICAL',
    formula_evidence:'GAME_SCREENSHOT_VERIFIED_REFERENCE_CROSSCHECK',
    formula_source_ref:'https://www.serebii.net/pokemonsleep/dishes.shtml',
    discovered_at:'2026-08-09',
    effective_from:'2026-08-10',
    activation_check_not_before:'2026-08-10',
    related_official_context_ref:'https://www.pokemonsleep.net/zh/news/343231343532353138373131363233363832/',
    activation_status:'PROMOTED_ACTIVE_2026_08_12',
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
    formula_audit_version:PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
    active_recipe_count:PUBLIC_RECIPE_PROVENANCE.length,
    upcoming_evidence_count:PUBLIC_RECIPE_UPCOMING_EVIDENCE.filter(row=>row.lifecycle==='UPCOMING_REFERENCE_DISCOVERED').length,
    promoted_historical_evidence_count:PUBLIC_RECIPE_UPCOMING_EVIDENCE.filter(row=>row.lifecycle==='PROMOTED_TO_CANONICAL').length,
    lifecycle:Object.freeze(lifecycle),
    name_evidence:Object.freeze(nameEvidence),
    formula_evidence:Object.freeze(formulaEvidence),
  });
}
