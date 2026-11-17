export const MASTER_DATA_VERSION = 'shared-master-2026-11-17-official-nuts-a';

const SOURCE_POLICY = Object.freeze({
  source_type: 'mixed_verified_reference',
  source_name: 'Pokémon Sleep official first; RaenonX supplemental',
  source_ref: 'game-screenshots-and-raenonx-reference',
  verified_at: '2026-08-17',
});

// Public type→berry knowledge is projection-only.
// The current successor meaning is projection/consistency-only: it is public game knowledge
// and must never generate or overwrite player-owned Type/Berry observations.
export const PUBLIC_BERRY_TYPES = Object.freeze([
  ['一般','柿仔果'],['火','蘋野果'],['水','橙橙果'],['電','萄葡果'],['草','金枕果'],['冰','莓莓果'],
  ['格鬥','櫻子果'],['毒','零餘果'],['地面','勿花果'],['飛行','椰木果'],['超能力','芒芒果'],['蟲','木子果'],
  ['岩石','文柚果'],['幽靈','墨莓果'],['龍','番荔果'],['惡','異奇果'],['鋼','靛莓果'],['妖精','桃桃果'],
].map(([type_name,berry_name])=>Object.freeze({type_name,berry_name,...SOURCE_POLICY,data_version:MASTER_DATA_VERSION})));

// Historical authority marker is retained because older release/privacy contracts extract this exact array literal.
// v0.4.11 exports a frozen copy for Public Master Recognition without creating a second ingredient authority.
const INGREDIENTS = [
  '沉甸甸南瓜','醒腦咖啡豆','萌綠玉米','萌綠大豆','放鬆可可','好眠番茄','暖暖薑','純粹油',
  '甜甜蜜','哞哞鮮奶','豆製肉','火辣香草','特選蘋果','窩心洋芋','特選蛋','粗枝大蔥',
  '品鮮蘑菇','美味尾巴','嫩亮酪梨',
];
// Official Nov 2026 ingredient: a separate provenance record; never rewrite
// historical ingredients or player-owned inventory/quantity observations.
const NOV2026_OFFICIAL_NUT=Object.freeze({
  ingredient_name:'一口堅果',source_type:'OFFICIAL_ANNOUNCEMENT',
  source_name:'Pokémon Sleep 官方繁中公告：大餐週vol.1',
  source_ref:'https://www.pokemonsleep.net/zh/news/343537333535313639333033313031343531/',
  verified_at:'2026-11-17',data_version:MASTER_DATA_VERSION,
});
export const PUBLIC_INGREDIENT_NAMES = Object.freeze([...INGREDIENTS,NOV2026_OFFICIAL_NUT.ingredient_name]);

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
  // Add only the officially verified new ingredient to Public Master.
  // Existing player ingredient_inventory and UNKNOWN quantities stay untouched.
  db.run(`INSERT INTO ingredient_master(ingredient_name,source_type,source_name,source_ref,verified_at,data_version)
    VALUES(?,?,?,?,?,?) ON CONFLICT(ingredient_name) DO UPDATE SET source_type=excluded.source_type,source_name=excluded.source_name,
    source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,
    [NOV2026_OFFICIAL_NUT.ingredient_name,NOV2026_OFFICIAL_NUT.source_type,NOV2026_OFFICIAL_NUT.source_name,
      NOV2026_OFFICIAL_NUT.source_ref,NOV2026_OFFICIAL_NUT.verified_at,NOV2026_OFFICIAL_NUT.data_version]);
  // Deliberately do not rewrite/delete legacy player observations such as 「特選酪梨」 here.
  // They require direct screenshot review through the Visual Evidence Contract; Public Master is not a player-data generator.
  // v0.4.2: recipe facts are owned exclusively by public-recipe-master.js.
  // Shared master remains the authority for berries and ingredients only.
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('shared_master_version',?,datetime('now'))`,[JSON.stringify(MASTER_DATA_VERSION)]);
}