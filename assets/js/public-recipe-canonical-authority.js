import {
  PUBLIC_RECIPE_MASTER as BASE_PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_ALIASES as BASE_PUBLIC_RECIPE_ALIASES,
  PUBLIC_RECIPE_MASTER_VERSION as BASE_PUBLIC_RECIPE_MASTER_VERSION,
} from './public-recipe-master.js';

export const PUBLIC_RECIPE_CANONICAL_NAME_VERSION='public-recipe-zh-tw-names-2026-08-12-a';
export const PUBLIC_RECIPE_MASTER_VERSION='public-recipe-master-2026-08-13-b';
export const PUBLIC_RECIPE_BASE_MASTER_VERSION=BASE_PUBLIC_RECIPE_MASTER_VERSION;
export const PUBLIC_RECIPE_FORMULA_AUDIT_VERSION='public-recipe-formula-audit-2026-08-13-a';
export const PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION='public-recipe-level1-energy-2026-08-13-a';

const HISTORICAL_NAME_SOURCE=Object.freeze({
  source_type:'game_screenshot_verified',
  source_name:'sanitized in-game zh-TW recipe screenshot evidence',
  source_ref:'internal:public-recipe-zh-tw-screenshot-evidence-2026-08-09',
  verified_at:'2026-08-09',
  verification_status:'GAME_SCREENSHOT_VERIFIED_NAME_FORMULA_MATCH',
});

const CURRENT_NAME_SOURCE=Object.freeze({
  source_type:'game_screenshot_verified',
  source_name:'current in-game zh-TW recipe screenshot evidence',
  source_ref:'internal:v04114-android-live-current-recipe-name-evidence',
  verified_at:'2026-08-11',
  verification_status:'GAME_SCREENSHOT_VERIFIED_NAME_FORMULA_MATCH',
});

const FORMULA_SOURCE=Object.freeze({
  source_type:'game_screenshot_verified_formula',
  source_name:'current in-game zh-TW recipe screenshot ingredient evidence',
  source_ref:'internal:v04114-android-live-current-recipe-formula-evidence',
  verified_at:'2026-08-11',
  verification_status:'GAME_SCREENSHOT_VERIFIED_FORMULA',
});

const AUG12_ACTIVATION_SOURCE=Object.freeze({
  source_type:'game_screenshot_reference_crosscheck',
  source_name:'current in-game zh-TW recipe activation screenshot + current structured reference cross-check',
  source_ref:'internal:v04132-recipe-activation-evidence+#172',
  verified_at:'2026-08-12',
  verification_status:'GAME_SCREENSHOT_VERIFIED_NAME_FORMULA_REFERENCE_CROSSCHECK',
});

const LEVEL1_ENERGY_SOURCE=Object.freeze({
  level1_energy_source_type:'game_screenshot_reference_crosscheck',
  level1_energy_source_name:'current in-game zh-TW recipe list screenshots + current structured recipe reference cross-check',
  level1_energy_source_ref:'internal:v04221-full-78-level1-energy-evidence',
  level1_energy_verified_at:'2026-08-13',
  level1_energy_verification_status:'GAME_SCREENSHOT_VERIFIED_LEVEL1_ENERGY_REFERENCE_CROSSCHECK',
});

export const PUBLIC_RECIPE_FORMULA_MUTATION_POLICY=Object.freeze({
  policy_version:'public-recipe-formula-mutation-policy-2026-08-13-a',
  ai_may_mutate_formula:false,
  historical_formula_default:'BASE_MASTER_IMMUTABLE',
  runtime_override_default:'FORBIDDEN_UNLESS_MANUAL_EVIDENCE_REVIEWED',
  required_promotion_evidence:Object.freeze(['IN_GAME_SCREENSHOT','CURRENT_STRUCTURED_REFERENCE_CROSSCHECK']),
  manual_review_required:true,
});

export const PUBLIC_RECIPE_FORMULA_AUDIT=Object.freeze({
  audit_version:PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  audited_recipe_count:78,
  audited_at:'2026-08-13',
  status:'FULL_CATALOG_REFERENCE_CROSSCHECKED',
  source_refs:Object.freeze([
    'Serebii Pokémon Sleep current Dishes catalog, checked 2026-08-13',
    'Bulbapedia Cooking (Sleep) current recipe tables/version history, checked 2026-08-13',
    'sanitized user-provided current recipe reference screenshots, 2026-08-13',
  ]),
  known_rejected_observation:Object.freeze({
    recipe_id:'curry_parent_child',
    rejected_ingredient_name:'好眠番茄',
    rejected_quantity:11,
    canonical_ingredient_name:'特選蘋果',
    canonical_quantity:11,
  }),
});

export const PUBLIC_RECIPE_LEVEL1_ENERGY_AUDIT=Object.freeze({
  energy_version:PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION,
  audited_recipe_count:78,
  audited_at:'2026-08-13',
  status:'FULL_CATALOG_LEVEL1_ENERGY_VERIFIED',
  semantic_contract:'base_energy === level1_energy === in-game recipe value at Lv.1',
  source_refs:Object.freeze([
    'current user-provided in-game zh-TW recipe list screenshots, 2026-08-13',
    'Serebii Pokémon Sleep current Dishes catalog, checked 2026-08-13',
  ]),
});

export const PUBLIC_RECIPE_LEVEL1_ENERGY_AUTHORITY=Object.freeze([
  ['curry_apple',748],
  ['recipe_curry_002',7483],
  ['curry_solar_tomato',2078],
  ['curry_dream_eater',9010],
  ['curry_spicy_leek',5900],
  ['curry_mushroom',4162],
  ['curry_parent_child',4523],
  ['recipe_curry_008',1910],
  ['recipe_curry_009',3181],
  ['recipe_curry_010',814],
  ['recipe_curry_011',856],
  ['recipe_curry_012',839],
  ['curry_ninja',9445],
  ['recipe_curry_014',1942],
  ['recipe_curry_015',2150],
  ['recipe_curry_016',3372],
  ['curry_soft_corn',4670],
  ['recipe_curry_018',13690],
  ['curry_dizzy_punch',5702],
  ['recipe_curry_020',19061],
  ['recipe_curry_021',20655],
  ['recipe_curry_022',15621],
  ['recipe_curry_023',24802],
  ['curry_greengrass_bun',10945],
  ['curry_bounce_udon',25539],
  ['recipe_salad_001',8169],
  ['recipe_salad_002',5859],
  ['recipe_salad_003',1898],
  ['salad_glutton_potato',5040],
  ['salad_tofu',3113],
  ['recipe_salad_006',3046],
  ['recipe_salad_007',978],
  ['recipe_salad_008',1045],
  ['recipe_salad_009',2942],
  ['recipe_salad_010',3665],
  ['salad_overheat',5225],
  ['salad_apple',855],
  ['recipe_salad_013',2845],
  ['salad_apple_cheese',2655],
  ['salad_ninja',11659],
  ['recipe_salad_016',2114],
  ['recipe_salad_017',11393],
  ['recipe_salad_018',7675],
  ['recipe_salad_019',2785],
  ['recipe_salad_020',8755],
  ['recipe_salad_021',20218],
  ['recipe_salad_022',11881],
  ['recipe_salad_023',19293],
  ['recipe_salad_024',7125],
  ['recipe_salad_025',25162],
  ['recipe_salad_026',25356],
  ['recipe_dessert_001',1907],
  ['recipe_dessert_002',4921],
  ['dessert_apple_juice',855],
  ['recipe_dessert_004',1079],
  ['recipe_dessert_005',1913],
  ['recipe_dessert_006',7594],
  ['recipe_dessert_007',4734],
  ['recipe_dessert_008',1748],
  ['recipe_dessert_009',5065],
  ['recipe_dessert_010',3378],
  ['dessert_warm_milk',814],
  ['recipe_dessert_012',1924],
  ['recipe_dessert_013',3263],
  ['recipe_dessert_014',1924],
  ['recipe_dessert_015',3015],
  ['recipe_dessert_016',5547],
  ['recipe_dessert_017',6048],
  ['recipe_dessert_018',10925],
  ['recipe_dessert_019',3314],
  ['recipe_dessert_020',13834],
  ['dessert_early_coffee_jelly',6793],
  ['dessert_spiced_cola',17494],
  ['recipe_dessert_023',7125],
  ['dessert_clodsire_eclair',20885],
  ['dessert_ghost_donut',24354],
  ['recipe_dessert_026',8165],
  ['dessert_honey_chocolate',25484],
].map(([recipe_id,level1_energy])=>Object.freeze({recipe_id,level1_energy,energy_version:PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION})));

export const PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES=Object.freeze([
  ['curry_soft_corn','柔軟玉米濃湯','玉米濃湯'],
  ['recipe_curry_015','入口即化蛋捲咖哩','滑嫩蛋咖哩'],
  ['recipe_curry_014','日照炸肉排咖哩','乾旱炸肉排咖哩'],
  ['recipe_curry_012','寶寶甜蜜咖哩','甜甜蜜咖哩'],
  ['recipe_curry_011','豆製肉排咖哩','豆肉排咖哩'],
  ['recipe_curry_010','單純白醬濃湯','簡易白醬濃湯'],
  ['recipe_curry_008','吃飽飽起司肉排咖哩','起司漢堡咖哩'],
  ['curry_dream_eater','絕對睡眠奶油咖哩','夢食奶油咖哩'],
  ['curry_solar_tomato','太陽之力番茄咖哩','日照番茄咖哩'],
  ['curry_dizzy_punch','迷昏拳辣味咖哩','暈眩拳辣味咖哩'],
  ['recipe_salad_022','落英繽紛含羞草蛋沙拉','花瓣舞層層沙拉'],
  ['recipe_salad_020','十字切碎丁沙拉','十字劈沙拉'],
  ['recipe_salad_018','冥想香甜沙拉','冥想水果沙拉'],
  ['recipe_salad_016','熱風豆腐沙拉','熱浪豆腐沙拉'],
  ['salad_apple_cheese','迷人蘋果起司沙拉','璀璨蘋果起司沙拉'],
  ['salad_overheat','過熱沙拉','過熱薑沙拉'],
  ['recipe_salad_010','心情不定肉沙拉淋巧克力醬','唱反調巧克力肉沙拉'],
  ['recipe_salad_009','哞哞起司番茄沙拉','哞哞卡布里沙拉'],
  ['recipe_salad_007','豆製火腿沙拉','豆火腿沙拉'],
  ['recipe_salad_006','蠻力豪邁沙拉','怪力極限沙拉'],
  ['salad_tofu','濕潤豆腐沙拉','水幕豆腐沙拉'],
  ['salad_glutton_potato','貪吃鬼洋芋沙拉','貪吃洋芋沙拉'],
  ['recipe_salad_003','撥雪凱撒沙拉','雪隱凱薩沙拉'],
  ['recipe_dessert_023','破格玉米香提拉米蘇','破格玉米提拉米蘇'],
  ['recipe_dessert_017','大爆炸爆米花','爆炸爆米花'],
  ['recipe_dessert_014','我行我素蔬菜汁','堅毅蔬菜汁'],
  ['recipe_dessert_013','活力蛋白飲','活力蛋白冰沙'],
  ['recipe_dessert_012','輕裝豆香蛋糕','青雲豆香蛋糕'],
  ['dessert_warm_milk','哞哞熱鮮奶','溫熱哞哞鮮奶'],
  ['recipe_dessert_008','祈願蘋果派','幸運吟唱蘋果派'],
  ['recipe_dessert_007','惡魔之吻水果牛奶','甜蜜之吻冰沙'],
  ['recipe_dessert_005','火花薑茶','火焰薑茶'],
  ['recipe_dessert_004','手製勁爽汽水','手工汽水'],
  ['recipe_dessert_001','熟成甜薯燒','綿綿地瓜'],
].map(([recipe_id,canonical_name_zh_tw,legacy_public_name])=>Object.freeze({
  recipe_id,canonical_name_zh_tw,legacy_public_name,
  evidence_class:'GAME_SCREENSHOT_DERIVED_ZH_TW',
  match_basis:'CATEGORY_INGREDIENT_SIGNATURE',
  name_contract_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
})));

// Historical formulas are immutable by default. The prior curry_parent_child tomato override
// came from a misread screenshot and is intentionally removed by v0.4.22.1.
export const PUBLIC_RECIPE_FORMULA_OVERRIDES=Object.freeze([]);

export const PUBLIC_RECIPE_ACTIVATION_ADDITIONS=Object.freeze([
  Object.freeze({
    recipe_id:'curry_greengrass_bun',category:'咖哩／濃湯',recipe_name:'萌綠咖哩麵包',base_energy:10945,total_ingredients:63,
    ingredients:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:20}),
      Object.freeze({ingredient_name:'火辣香草',quantity:20}),
      Object.freeze({ingredient_name:'萌綠大豆',quantity:8}),
      Object.freeze({ingredient_name:'純粹油',quantity:15}),
    ]),
    ...AUG12_ACTIVATION_SOURCE,
    introduced_on:'2026-08-10',
    activation_contract_version:'public-recipe-activation-2026-08-12-a',
  }),
  Object.freeze({
    recipe_id:'curry_bounce_udon',category:'咖哩／濃湯',recipe_name:'彈跳咖哩烏龍麵',base_energy:25539,total_ingredients:112,
    ingredients:Object.freeze([
      Object.freeze({ingredient_name:'暖暖薑',quantity:39}),
      Object.freeze({ingredient_name:'品鮮蘑菇',quantity:31}),
      Object.freeze({ingredient_name:'火辣香草',quantity:22}),
      Object.freeze({ingredient_name:'豆製肉',quantity:20}),
    ]),
    ...AUG12_ACTIVATION_SOURCE,
    introduced_on:'2026-08-10',
    activation_contract_version:'public-recipe-activation-2026-08-12-a',
  }),
]);

export const PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS=Object.freeze([
  Object.freeze({
    recipe_id:'curry_dizzy_punch',
    observed_name:'迷昏拳辣味咖哩',
    current_public_name:'暈眩拳辣味咖哩',
    status:'FORMULA_CONFLICT_REVIEW',
    auto_apply:false,
    observed_formula:Object.freeze([['萌綠大豆',11],['火辣香草',11],['甜甜蜜',11]]),
    current_formula:Object.freeze([['醒腦咖啡豆',11],['火辣香草',11],['甜甜蜜',11]]),
    resolved_by:'CURRENT_GAME_SCREENSHOT_2026_08_11',
    resolution:'CURRENT_PUBLIC_FORMULA_CONFIRMED_OLD_OCR_EVIDENCE_REJECTED',
  }),
  Object.freeze({
    recipe_id:'curry_parent_child',
    observed_name:'親子愛咖哩',
    current_public_name:'親子愛咖哩',
    status:'FORMULA_CONFLICT_REVIEW',
    auto_apply:false,
    observed_formula:Object.freeze([['好眠番茄',11],['特選蛋',8],['甜甜蜜',12],['窩心洋芋',4]]),
    current_formula:Object.freeze([['特選蘋果',11],['特選蛋',8],['甜甜蜜',12],['窩心洋芋',4]]),
    resolved_by:'CURRENT_GAME_SCREENSHOT_2026_08_13+CURRENT_REFERENCE_CROSSCHECK',
    resolution:'CURRENT_PUBLIC_FORMULA_CONFIRMED_BAD_SCREENSHOT_OBSERVATION_REJECTED',
  }),
]);

const overrideById=new Map(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.map(row=>[row.recipe_id,row]));
const formulaOverrideById=new Map(PUBLIC_RECIPE_FORMULA_OVERRIDES.map(row=>[row.recipe_id,row]));
const level1EnergyById=new Map(PUBLIC_RECIPE_LEVEL1_ENERGY_AUTHORITY.map(row=>[row.recipe_id,row]));

function applyLevel1Energy(recipe){
  const energy=level1EnergyById.get(recipe.recipe_id);
  if(!energy)throw new Error(`recipe_level1_energy_missing:${recipe.recipe_id}`);
  if(!Number.isInteger(energy.level1_energy)||energy.level1_energy<=0)throw new Error(`recipe_level1_energy_invalid:${recipe.recipe_id}:${energy.level1_energy}`);
  return Object.freeze({
    ...recipe,
    base_energy:energy.level1_energy,
    level1_energy:energy.level1_energy,
    level1_energy_version:PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION,
    ...LEVEL1_ENERGY_SOURCE,
  });
}

const upgradedBase=BASE_PUBLIC_RECIPE_MASTER.map(base=>{
  const override=overrideById.get(base.recipe_id),formulaOverride=formulaOverrideById.get(base.recipe_id);
  if(override&&base.recipe_name!==override.legacy_public_name){
    throw new Error(`recipe_name_contract_base_mismatch:${base.recipe_id}:${base.recipe_name}:${override.legacy_public_name}`);
  }
  const nameSource=override?.recipe_id==='curry_dizzy_punch'?CURRENT_NAME_SOURCE:HISTORICAL_NAME_SOURCE;
  return applyLevel1Energy(Object.freeze({
    ...base,
    ...(formulaOverride?{
      ingredients:formulaOverride.ingredients,
      total_ingredients:formulaOverride.total_ingredients,
      ...FORMULA_SOURCE,
      formula_contract_version:formulaOverride.formula_contract_version,
    }:{}),
    ...(override?{
      recipe_name:override.canonical_name_zh_tw,
      ...nameSource,
    }:{}),
    formula_audit_version:PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
    data_version:PUBLIC_RECIPE_MASTER_VERSION,
  }));
});

const activatedRecipes=PUBLIC_RECIPE_ACTIVATION_ADDITIONS.map(row=>applyLevel1Energy(Object.freeze({
  ...row,
  formula_audit_version:PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  data_version:PUBLIC_RECIPE_MASTER_VERSION,
})));

export const PUBLIC_RECIPE_MASTER=Object.freeze([
  ...upgradedBase,
  ...activatedRecipes,
]);

if(level1EnergyById.size!==PUBLIC_RECIPE_MASTER.length)throw new Error(`recipe_level1_energy_authority_count_mismatch:${level1EnergyById.size}:${PUBLIC_RECIPE_MASTER.length}`);
for(const recipe of PUBLIC_RECIPE_MASTER){
  if(Number(recipe.base_energy)!==Number(recipe.level1_energy))throw new Error(`recipe_level1_energy_semantic_mismatch:${recipe.recipe_id}`);
}

const screenshotLegacyAliases=PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.map(row=>Object.freeze({
  recipe_id:row.recipe_id,
  alias_value:row.legacy_public_name,
  alias_type:'legacy_recipe_name',
  confidence:1,
  is_auto_replace_safe:true,
  source_type:'pre_v043_public_recipe_name_compatibility',
  data_version:PUBLIC_RECIPE_MASTER_VERSION,
}));

export const PUBLIC_RECIPE_ALIASES=Object.freeze([
  ...BASE_PUBLIC_RECIPE_ALIASES.map(row=>Object.freeze({...row,data_version:PUBLIC_RECIPE_MASTER_VERSION})),
  ...screenshotLegacyAliases,
]);

export function resolvePublicRecipeName(value){
  const text=String(value??'').normalize('NFKC').trim();
  if(!text)return null;
  const exact=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_name===text);
  if(exact)return Object.freeze({
    recipe_id:exact.recipe_id,recipe_name:exact.recipe_name,resolution:'CANONICAL_EXACT',
    requires_review:false,commit_allowed:true,
  });
  const alias=PUBLIC_RECIPE_ALIASES.find(row=>row.alias_type==='legacy_recipe_name'&&row.alias_value===text);
  if(!alias)return null;
  const recipe=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_id===alias.recipe_id);
  if(!recipe)return null;
  const safe=Boolean(alias.is_auto_replace_safe);
  return Object.freeze({
    recipe_id:recipe.recipe_id,
    recipe_name:recipe.recipe_name,
    resolution:safe?'LEGACY_NAME_ALIAS_SAFE':'LEGACY_NAME_ALIAS_REVIEW',
    requires_review:!safe,
    commit_allowed:safe,
  });
}
