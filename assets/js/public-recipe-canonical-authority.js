import {
  PUBLIC_RECIPE_MASTER as BASE_PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_ALIASES as BASE_PUBLIC_RECIPE_ALIASES,
  PUBLIC_RECIPE_MASTER_VERSION as BASE_PUBLIC_RECIPE_MASTER_VERSION,
} from './public-recipe-master.js';

export const PUBLIC_RECIPE_CANONICAL_NAME_VERSION='public-recipe-zh-tw-names-2026-08-09-a';
export const PUBLIC_RECIPE_MASTER_VERSION='public-recipe-master-2026-08-09-b';
export const PUBLIC_RECIPE_BASE_MASTER_VERSION=BASE_PUBLIC_RECIPE_MASTER_VERSION;

const NAME_SOURCE=Object.freeze({
  source_type:'game_screenshot_verified',
  source_name:'sanitized in-game zh-TW recipe screenshot evidence',
  source_ref:'internal:public-recipe-zh-tw-screenshot-evidence-2026-08-09',
  verified_at:'2026-08-09',
  verification_status:'GAME_SCREENSHOT_VERIFIED_NAME_FORMULA_MATCH',
});

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

export const PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS=Object.freeze([
  Object.freeze({
    recipe_id:'curry_dizzy_punch',
    observed_name:'迷昏拳辣味咖哩',
    current_public_name:'暈眩拳辣味咖哩',
    status:'FORMULA_CONFLICT_REVIEW',
    auto_apply:false,
    observed_formula:Object.freeze([['萌綠大豆',11],['火辣香草',11],['甜甜蜜',11]]),
    current_formula:Object.freeze([['醒腦咖啡豆',11],['火辣香草',11],['甜甜蜜',11]]),
  }),
  Object.freeze({
    recipe_id:'curry_parent_child',
    observed_name:'親子愛咖哩',
    current_public_name:'親子愛咖哩',
    status:'FORMULA_CONFLICT_REVIEW',
    auto_apply:false,
    observed_formula:Object.freeze([['好眠番茄',11],['特選蛋',8],['甜甜蜜',12],['窩心洋芋',4]]),
    current_formula:Object.freeze([['特選蘋果',11],['特選蛋',8],['甜甜蜜',12],['窩心洋芋',4]]),
  }),
]);

const overrideById=new Map(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.map(row=>[row.recipe_id,row]));

export const PUBLIC_RECIPE_MASTER=Object.freeze(BASE_PUBLIC_RECIPE_MASTER.map(base=>{
  const override=overrideById.get(base.recipe_id);
  if(!override)return Object.freeze({...base,data_version:PUBLIC_RECIPE_MASTER_VERSION});
  if(base.recipe_name!==override.legacy_public_name){
    throw new Error(`recipe_name_contract_base_mismatch:${base.recipe_id}:${base.recipe_name}:${override.legacy_public_name}`);
  }
  return Object.freeze({
    ...base,
    recipe_name:override.canonical_name_zh_tw,
    ...NAME_SOURCE,
    data_version:PUBLIC_RECIPE_MASTER_VERSION,
  });
}));

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
