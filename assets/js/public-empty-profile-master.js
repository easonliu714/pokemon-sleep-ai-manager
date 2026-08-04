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

  // Public master loading must never create or mutate player-owned inventory,
  // recipe unlock, capacity or Pokémon rows. Neutral 0/locked projections are
  // exposed through read-only catalog views defined in shared-master-schema.js.
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('public_profile_contract',?,datetime('now'))`,[JSON.stringify({version:ITEM_MASTER_VERSION,personal_seed:false,player_tables_untouched:true,catalog_defaults:{quantity:0,recipe_unlocked:false}})]);
}
