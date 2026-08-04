const ITEM_MASTER_VERSION='public-item-master-2026-08-04-a';

// Canonical item names only. No player quantity, reserve, recommendation or
// unlock state is encoded here.
const ITEMS=[
  ['波加曼的薰香','incense'],['妙蛙種子的薰香','incense'],['友好薰香','incense'],['回復薰香','incense'],['幸運薰香','incense'],
  ['月之石','evolution'],['冰之石','evolution'],['葉之石','evolution'],['火之石','evolution'],['聯繫繩','evolution'],
  ['好露營券','ticket'],['EX券','ticket'],['寶可沙布蕾','biscuit'],['副技能種子','skill_seed'],['主技能種子','skill_seed'],
  ['夢之塊M','dream_cluster'],['夢之塊S','dream_cluster'],['食材券S','ingredient_ticket'],['龍屬性的糖果S','candy'],
  ['超能力屬性的糖果S','candy'],['萬能糖果S','candy'],['活力枕頭','recovery'],
];

export function applyPublicEmptyProfileMaster(db){
  const meta=['official_name_registry','Pokémon Sleep official terminology','public-canonical-item-names','2026-08-04',ITEM_MASTER_VERSION];
  for(const [name,category] of ITEMS){
    db.run(`INSERT INTO item_master(item_name,item_category,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(item_name) DO UPDATE SET item_category=excluded.item_category,
      source_type=excluded.source_type,source_name=excluded.source_name,source_ref=excluded.source_ref,
      verified_at=excluded.verified_at,data_version=excluded.data_version`,[name,category,...meta]);
  }

  // Player-facing tables receive only neutral defaults. INSERT OR IGNORE keeps
  // every existing user's local quantities and unlock choices intact.
  db.run(`INSERT OR IGNORE INTO ingredient_inventory(ingredient_name,quantity,updated_at,source_update_id)
    SELECT ingredient_name,0,datetime('now'),'PUBLIC-EMPTY-PROFILE' FROM ingredient_master`);
  db.run(`INSERT OR IGNORE INTO item_inventory(item_name,quantity,safe_reserve,recommendation,updated_at,source_update_id)
    SELECT item_name,0,0,NULL,datetime('now'),'PUBLIC-EMPTY-PROFILE' FROM item_master`);
  db.run(`INSERT OR IGNORE INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source)
    SELECT recipe_id,category,recipe_name,0,total_ingredients,'PUBLIC-MASTER' FROM recipe_master`);
  db.run(`INSERT OR IGNORE INTO recipe_ingredients(recipe_id,ingredient_name,quantity)
    SELECT recipe_id,ingredient_name,quantity FROM recipe_master_ingredients`);
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('public_profile_contract',?,datetime('now'))`,[JSON.stringify({version:ITEM_MASTER_VERSION,personal_seed:false,default_quantities:0,default_recipe_unlocked:false})]);
}
