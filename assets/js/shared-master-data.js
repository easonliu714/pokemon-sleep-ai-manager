export const MASTER_DATA_VERSION = 'shared-master-2026-08-15-canonical-avocado';

const SOURCE_POLICY = Object.freeze({
  source_type: 'mixed_verified_reference',
  source_name: 'Pokémon Sleep official first; RaenonX supplemental',
  source_ref: 'game-screenshots-and-raenonx-reference',
  verified_at: '2026-08-15',
});

// Public type→berry knowledge is projection-only.
// The current successor meaning is projection/consistency-only: it is public game knowledge
// and must never generate or overwrite player-owned Type/Berry observations.
export const PUBLIC_BERRY_TYPES = Object.freeze([
  ['一般','柿仔果'],['火','蘋野果'],['水','橙橙果'],['電','葡萄果'],['草','金枕果'],['冰','莓莓果'],
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
export const PUBLIC_INGREDIENT_NAMES = Object.freeze([...INGREDIENTS]);

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
  // Deliberately do not rewrite/delete legacy player observations such as 「特選酪梨」 here.
  // They require direct screenshot review through the Visual Evidence Contract; Public Master is not a player-data generator.
  // v0.4.2: recipe facts are owned exclusively by public-recipe-master.js.
  // Shared master remains the authority for berries and ingredients only.
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('shared_master_version',?,datetime('now'))`,[JSON.stringify(MASTER_DATA_VERSION)]);
}
