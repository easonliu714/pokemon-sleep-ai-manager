export const PUBLIC_RECIPE_NAME_AUDIT_VERSION='public-recipe-name-audit-2026-08-14-a';

const currentReferenceSource=Object.freeze({
  source_type:'current_reference_crosscheck',
  source_name:'current Taiwan zh-TW recipe-name crosscheck',
  source_ref:'52poke:pokemon-sleep-cooking-current-2026-07-01',
  verified_at:'2026-08-14',
});
const playerScreenshotCrosscheckSource=Object.freeze({
  source_type:'game_screenshot_reference_crosscheck',
  source_name:'current Taiwan game screenshot + current recipe reference crosscheck',
  source_ref:'user-game-screenshot-2026-08-14+52poke:pokemon-sleep-cooking-current-2026-07-01',
  verified_at:'2026-08-14',
});
const playerScreenshotSource=Object.freeze({
  source_type:'game_screenshot_verified',
  source_name:'current Taiwan game screenshot verified',
  source_ref:'user-game-screenshot-2026-08-14',
  verified_at:'2026-08-14',
});

const row=(recipe_id,canonical_name_zh_tw,legacy_public_name,source=currentReferenceSource)=>Object.freeze({
  recipe_id,canonical_name_zh_tw,legacy_public_name,...source,
});

// These rows are the recipes that still inherited their current display-name authority
// from the v0.3.85 migration baseline before v0.4.25. The baseline remains historical
// evidence only; every current zh-TW display name below has an explicit current authority.
export const PUBLIC_RECIPE_ZH_TW_NAME_AUDIT=Object.freeze([
  row('curry_apple','特選蘋果咖哩','特選蘋果咖哩'),
  row('curry_mushroom','蘑菇孢子咖哩','孢子蘑菇咖哩'),
  row('curry_parent_child','親子愛咖哩','親子愛咖哩'),
  row('curry_spicy_leek','辣味蔥勁十足咖哩','微辣蔥咖哩',playerScreenshotCrosscheckSource),
  row('recipe_curry_002','炙燒尾肉咖哩','炙燒尾巴咖哩'),
  row('recipe_curry_009','窩心白醬濃湯','柔軟洋芋濃湯'),
  row('recipe_curry_016','健美豆子咖哩','健美豆子咖哩'),
  row('recipe_curry_018','煉獄玉米乾咖哩','煉獄玉米乾咖哩'),
  row('recipe_curry_020','覺醒力量濃湯','覺醒能量濃湯'),
  row('recipe_curry_021','居合斬壽喜燒咖哩','居合斬壽喜燒'),
  row('recipe_curry_022','扮演南瓜精濃湯','南瓜精角色扮演濃湯'),
  row('recipe_curry_023','茂盛焗烤酪梨','茂盛酪梨焗烤'),
  row('recipe_salad_001','呆呆獸尾巴的胡椒沙拉','呆呆獸尾巴胡椒沙拉'),
  row('recipe_salad_002','蘑菇孢子沙拉','孢子蘑菇沙拉'),
  row('recipe_salad_008','好眠番茄沙拉','好眠番茄沙拉'),
  row('recipe_salad_013','免疫蔥花沙拉','免疫力蔥花沙拉'),
  row('recipe_salad_017','萌綠沙拉','萌綠沙拉'),
  row('recipe_salad_019','亂擊玉米沙拉','亂擊玉米沙拉'),
  row('recipe_salad_021','不服輸咖啡沙拉','不服輸咖啡調味沙拉'),
  row('recipe_salad_023','蘋果酸優格沙拉','蘋果酸優格沙拉'),
  row('recipe_salad_024','碎裂酪梨沙拉','碎裂鱷梨沙拉'),
  row('recipe_salad_025','重踏酪梨醬脆片','重踏鱷梨醬脆片'),
  row('recipe_salad_026','大塊滿滿熱水沙拉','大塊滿滿熱水沙拉',playerScreenshotSource),
  row('salad_apple','特選蘋果沙拉','特選蘋果沙拉'),
  row('salad_ninja','忍者沙拉','忍者沙拉'),
  row('dessert_apple_juice','特選蘋果汁','特選蘋果汁'),
  row('dessert_clodsire_eclair','土王閃電泡芙','土王閃電泡芙'),
  row('dessert_early_coffee_jelly','早起咖啡凍','早起咖啡凍'),
  row('recipe_dessert_002','不屈薑餅','不屈薑餅'),
  row('recipe_dessert_006','胖丁百匯布丁','胖丁百匯布丁'),
  row('recipe_dessert_009','橙夢的排毒茶','橙夢排毒茶'),
  row('recipe_dessert_010','甜甜香氣巧克力蛋糕','甜甜香氣巧克力蛋糕'),
  row('recipe_dessert_015','大馬拉薩達','大馬拉薩達'),
  row('recipe_dessert_016','大力士豆香甜甜圈','大力士豆香甜甜圈'),
  row('recipe_dessert_018','茶會玉米司康','茶會玉米司康'),
  row('recipe_dessert_019','花瓣舞巧克力塔','花瓣舞巧克力塔'),
  row('recipe_dessert_020','花之禮馬卡龍','花之禮物馬卡龍'),
  row('recipe_dessert_026','青草攪拌器冰沙','青草攪拌機冰沙'),
]);

export function auditedRecipeNameById(){return new Map(PUBLIC_RECIPE_ZH_TW_NAME_AUDIT.map(entry=>[entry.recipe_id,entry]));}
