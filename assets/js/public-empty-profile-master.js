const ITEM_MASTER_VERSION='public-item-master-2026-08-04-b';

// Canonical item names only. No player quantity, reserve, recommendation or
// unlock state is encoded here. Names in SCREENSHOT_VERIFIED_ITEMS were
// observed directly in the user's 2026-08-04 Traditional Chinese game UI.
const SCREENSHOT_VERIFIED_ITEMS=[
  ['大師沙布蕾','biscuit'],['高級沙布蕾','biscuit'],['超級沙布蕾','biscuit'],['寶可沙布蕾','biscuit'],
  ['主技能種子','skill_seed'],['副技能種子','skill_seed'],
  ['回復薰香','incense'],['專注薰香','incense'],['幸運薰香','incense'],['成長薰香','incense'],['友好薰香','incense'],
  ['活力枕頭','recovery'],['幫手哨子','helper'],
  ['食材券S','ingredient_ticket'],['食材券M','ingredient_ticket'],
  ['萬能糖果S','candy'],['萬能糖果M','candy'],
  ['營地移動券','ticket'],['EX券','ticket'],['好露營券','ticket'],['午睡放鬆券','ticket'],
  ['夢之塊S','dream_cluster'],['夢之塊M','dream_cluster'],
  ['火之石','evolution'],['水之石','evolution'],['雷之石','evolution'],['葉之石','evolution'],['冰之石','evolution'],['月之石','evolution'],['光之石','evolution'],['暗之石','evolution'],['覺醒之石','evolution'],['渾圓之石','evolution'],
  ['王者之證','evolution'],['聯繫繩','evolution'],['金屬膜','evolution'],['銳利之爪','evolution'],
];

const SUPPLEMENTAL_ITEMS=[
  ['波加曼的薰香','incense'],['妙蛙種子的薰香','incense'],
  ['龍屬性的糖果S','candy'],['超能力屬性的糖果S','candy'],
];

function upsert(db,name,category,sourceType,sourceRef){
  db.run(`INSERT INTO item_master(item_name,item_category,source_type,source_name,source_ref,verified_at,data_version)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(item_name) DO UPDATE SET item_category=excluded.item_category,
    source_type=excluded.source_type,source_name=excluded.source_name,source_ref=excluded.source_ref,
    verified_at=excluded.verified_at,data_version=excluded.data_version`,
    [name,category,sourceType,sourceType==='game_screenshot_verified'?'Pokémon Sleep Traditional Chinese game UI':'Pokémon Sleep official terminology / structured reference',sourceRef,'2026-08-04',ITEM_MASTER_VERSION]);
}

export function applyPublicEmptyProfileMaster(db){
  for(const [name,category] of SCREENSHOT_VERIFIED_ITEMS) upsert(db,name,category,'game_screenshot_verified','user-evidence-manifest:game-ui-names-2026-08-04');
  for(const [name,category] of SUPPLEMENTAL_ITEMS) upsert(db,name,category,'reference_verified','official-announcement-and-raenonx-reference');

  // Public master loading must never create or mutate player-owned inventory,
  // recipe unlock, capacity or Pokémon rows. Neutral 0/locked projections are
  // exposed through read-only catalog views defined in shared-master-schema.js.
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('public_profile_contract',?,datetime('now'))`,[JSON.stringify({version:ITEM_MASTER_VERSION,personal_seed:false,player_tables_untouched:true,catalog_defaults:{quantity:0,recipe_unlocked:false},screenshot_verified_item_count:SCREENSHOT_VERIFIED_ITEMS.length})]);
}

// The commit gate is a browser-only controller. Dynamic loading here avoids a
// database-module cycle while ensuring it registers before the later
// multi-capture document-level transaction handler.
if(typeof window!=='undefined'){
  import('./canonical-commit-gate.js?v=20260804-v0379-canonical-commit-gate').catch((error)=>{
    console.error('Canonical commit gate load failed',error);
    globalThis.UpdateCenterLiveDebug?.record?.('canonical_commit_gate_load_failed',{message:error?.message||String(error)});
  });
}
