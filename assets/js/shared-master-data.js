export const MASTER_DATA_VERSION = 'shared-master-2026-07-31-a';

const SOURCE_POLICY = Object.freeze({
  source_type: 'mixed_verified_reference',
  source_name: 'Pokémon Sleep official first; RaenonX supplemental',
  source_ref: 'game-screenshots-and-raenonx-reference',
  verified_at: '2026-07-31',
});

export const PUBLIC_BERRY_TYPES = Object.freeze([
  ['一般','柿仔果'],['火','蘋野果'],['水','橙橙果'],['電','葡萄果'],['草','金枕果'],['冰','莓莓果'],
  ['格鬥','櫻子果'],['毒','零餘果'],['地面','勿花果'],['飛行','椰木果'],['超能力','芒芒果'],['蟲','木子果'],
  ['岩石','文柚果'],['幽靈','墨莓果'],['龍','番荔果'],['惡','異奇果'],['鋼','靛莓果'],['妖精','桃桃果'],
].map(([type_name,berry_name])=>Object.freeze({type_name,berry_name,...SOURCE_POLICY,data_version:MASTER_DATA_VERSION})));

const INGREDIENTS = [
  '沉甸甸南瓜','醒腦咖啡豆','萌綠玉米','萌綠大豆','放鬆可可','好眠番茄','暖暖薑','純粹油',
  '甜甜蜜','哞哞鮮奶','豆製肉','火辣香草','特選蘋果','窩心洋芋','特選蛋','粗枝大蔥',
  '品鮮蘑菇','美味尾巴','特選酪梨',
];

const RECIPES = [
  ['咖哩／濃湯','curry_ninja','忍者咖哩',9445,48,[['萌綠大豆',24],['粗枝大蔥',9],['品鮮蘑菇',12],['火辣香草',5]]],
  ['咖哩／濃湯','curry_dream_eater','絕對睡眠奶油咖哩',9010,55,[['窩心洋芋',18],['好眠番茄',15],['放鬆可可',12],['哞哞鮮奶',10]]],
  ['咖哩／濃湯','curry_spicy_leek','辣味蔥勁十足咖哩',5900,32,[['粗枝大蔥',14],['暖暖薑',10],['火辣香草',8]]],
  ['咖哩／濃湯','curry_dizzy_punch','迷昏拳辣味咖哩',5702,33,[['醒腦咖啡豆',11],['火辣香草',11],['甜甜蜜',11]]],
  ['咖哩／濃湯','curry_soft_corn','柔軟玉米濃湯',4670,30,[['萌綠玉米',14],['哞哞鮮奶',8],['窩心洋芋',8]]],
  ['咖哩／濃湯','curry_parent_child','親子愛咖哩',4523,35,[['甜甜蜜',12],['特選蘋果',11],['特選蛋',8],['窩心洋芋',4]]],
  ['咖哩／濃湯','curry_mushroom','蘑菇孢子咖哩',4162,23,[['品鮮蘑菇',14],['窩心洋芋',9]]],
  ['咖哩／濃湯','curry_solar_tomato','太陽之力番茄咖哩',2078,15,[['好眠番茄',10],['火辣香草',5]]],
  ['咖哩／濃湯','curry_apple','特選蘋果咖哩',748,7,[['特選蘋果',7]]],
  ['沙拉','salad_ninja','忍者沙拉',11659,57,[['粗枝大蔥',15],['萌綠大豆',19],['品鮮蘑菇',12],['暖暖薑',11]]],
  ['沙拉','salad_overheat','過熱沙拉',5225,35,[['火辣香草',17],['暖暖薑',10],['好眠番茄',8]]],
  ['沙拉','salad_glutton_potato','貪吃鬼洋芋沙拉',5040,36,[['窩心洋芋',14],['特選蛋',9],['豆製肉',7],['特選蘋果',6]]],
  ['沙拉','salad_tofu','濕潤豆腐沙拉',3113,24,[['萌綠大豆',15],['好眠番茄',9]]],
  ['沙拉','salad_apple_cheese','迷人蘋果起司沙拉',2655,23,[['特選蘋果',15],['哞哞鮮奶',5],['純粹油',3]]],
  ['沙拉','salad_apple','特選蘋果沙拉',855,8,[['特選蘋果',8]]],
  ['甜點／飲料','dessert_honey_chocolate','採蜜巧克力格子鬆餅',25484,115,[['甜甜蜜',38],['萌綠玉米',28],['哞哞鮮奶',28],['放鬆可可',21]]],
  ['甜點／飲料','dessert_ghost_donut','心跳加速鬼面鬆餅',24354,103,[['沉甸甸南瓜',18],['純粹油',24],['甜甜蜜',32],['好眠番茄',29]]],
  ['甜點／飲料','dessert_clodsire_eclair','土王閃電泡芙',20885,102,[['放鬆可可',30],['哞哞鮮奶',26],['醒腦咖啡豆',24],['甜甜蜜',22]]],
  ['甜點／飲料','dessert_spiced_cola','電光香料可樂',17494,87,[['好眠番茄',35],['暖暖薑',20],['粗枝大蔥',20],['醒腦咖啡豆',12]]],
  ['甜點／飲料','dessert_early_coffee_jelly','早起咖啡凍',6793,42,[['醒腦咖啡豆',16],['哞哞鮮奶',14],['甜甜蜜',12]]],
  ['甜點／飲料','dessert_apple_juice','特選蘋果汁',855,8,[['特選蘋果',8]]],
  ['甜點／飲料','dessert_warm_milk','哞哞熱鮮奶',814,7,[['哞哞鮮奶',7]]],
];

export function applySharedMasterData(db) {
  const meta = SOURCE_POLICY;
  for (const item of PUBLIC_BERRY_TYPES) {
    db.run(`INSERT INTO berry_master(type_name,berry_name,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(type_name) DO UPDATE SET berry_name=excluded.berry_name,source_type=excluded.source_type,
      source_name=excluded.source_name,source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,
      [item.type_name,item.berry_name,meta.source_type,meta.source_name,meta.source_ref,meta.verified_at,MASTER_DATA_VERSION]);
  }
  for (const name of INGREDIENTS) {
    db.run(`INSERT INTO ingredient_master(ingredient_name,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?) ON CONFLICT(ingredient_name) DO UPDATE SET source_type=excluded.source_type,source_name=excluded.source_name,
      source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,
      [name,meta.source_type,meta.source_name,meta.source_ref,meta.verified_at,MASTER_DATA_VERSION]);
  }
  for (const [category,id,name,energy,total,ingredients] of RECIPES) {
    db.run(`INSERT INTO recipe_master(recipe_id,category,recipe_name,base_energy,total_ingredients,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(recipe_id) DO UPDATE SET category=excluded.category,recipe_name=excluded.recipe_name,
      base_energy=excluded.base_energy,total_ingredients=excluded.total_ingredients,source_type=excluded.source_type,
      source_name=excluded.source_name,source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,
      [id,category,name,energy,total,meta.source_type,meta.source_name,meta.source_ref,meta.verified_at,MASTER_DATA_VERSION]);
    db.run('DELETE FROM recipe_master_ingredients WHERE recipe_id=?',[id]);
    for (const [ingredient,quantity] of ingredients) {
      db.run('INSERT INTO recipe_master_ingredients(recipe_id,ingredient_name,quantity) VALUES(?,?,?)',[id,ingredient,quantity]);
    }
  }
  db.run(`UPDATE pokemon SET favorite_berry=(SELECT berry_name FROM berry_master WHERE type_name=pokemon.type)
    WHERE (favorite_berry IS NULL OR favorite_berry='') AND type IS NOT NULL`);
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('shared_master_version',?,datetime('now'))`,[JSON.stringify(MASTER_DATA_VERSION)]);
}
