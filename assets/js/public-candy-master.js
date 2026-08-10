import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {PUBLIC_EVOLUTION_MASTER,PUBLIC_EVOLUTION_STATUS_MASTER,PUBLIC_POKEMON_KNOWLEDGE_VERSION} from './public-pokemon-knowledge-master.js';

export const PUBLIC_CANDY_MASTER_VERSION='public-candy-master-2026-08-10-c';
export const SPECIES_CANDY_NAME_RULE_VERSION='species-candy-name-rule-zh-tw-2026-08-10-a';

const OFFICIAL='Pokémon Sleep official zh-TW';
const fixed=(candy_id,candy_name,candy_type,target_type_name,source_ref,verification_status='OFFICIAL_ZH_TW_VERIFIED')=>Object.freeze({
  candy_id,candy_name,candy_type,target_species_name:null,target_type_name:target_type_name||null,
  name_rule:'FIXED_VERIFIED_NAME',verification_status,source_type:verification_status==='GAME_SCREENSHOT_VERIFIED'?'game_screenshot_verified':'official_zh_tw',
  source_name:verification_status==='GAME_SCREENSHOT_VERIFIED'?'In-game screenshot evidence':OFFICIAL,source_ref,verified_at:'2026-08-10',data_version:PUBLIC_CANDY_MASTER_VERSION,
});

// Fixed candy entities are only added when the item name itself has direct
// evidence. Player quantities never belong here. Multiple sizes are separate
// physical inventory entities; no conversion-equivalence is implied.
export const PUBLIC_CANDY_FIXED_MASTER=Object.freeze([
  fixed('universal_candy_s','萬能糖果S','universal',null,'https://www.pokemonsleep.net/zh/news/333731373231333131353638373839353130/'),
  fixed('universal_candy_m','萬能糖果M','universal',null,'https://www.pokemonsleep.net/zh/news/333731373231333131353638373839353130/'),
  fixed('type_fire_candy_s','火屬性的糖果S','type','火','https://www.pokemonsleep.net/zh/news/313239393831303938313333323931303039/'),
  fixed('type_fire_candy_m','火屬性的糖果M','type','火','https://www.pokemonsleep.net/zh/news/333032323433323833303539333433333631/'),
  fixed('type_water_candy_s','水屬性的糖果S','type','水','https://www.pokemonsleep.net/zh/news/313635353333363032363631303037333631/'),
  fixed('type_water_candy_m','水屬性的糖果M','type','水','https://www.pokemonsleep.net/zh/news/333032323433323833303539333433333631/'),
  fixed('type_flying_candy_s','飛行屬性的糖果S','type','飛行','https://www.pokemonsleep.net/zh/news/323234353838333334383535333536343137/'),
  fixed('type_flying_candy_m','飛行屬性的糖果M','type','飛行','https://www.pokemonsleep.net/zh/news/313434353136333830313935303238393933/'),
  fixed('type_bug_candy_m','蟲屬性的糖果M','type','蟲','https://www.pokemonsleep.net/zh/news/313434353136333830313935303238393933/'),
  fixed('type_psychic_candy_s','超能力屬性的糖果S','type','超能力','https://www.pokemonsleep.net/zh/news/323430393535333330323537373437393639/'),
  fixed('type_psychic_candy_m','超能力屬性的糖果M','type','超能力','https://www.pokemonsleep.net/zh/news/323430393535333330323537373437393639/'),
  fixed('type_ghost_candy_s','幽靈屬性的糖果S','type','幽靈','https://www.pokemonsleep.net/zh/news/313933343137303934393235313233353835/'),
  fixed('type_ghost_candy_m','幽靈屬性的糖果M','type','幽靈','https://www.pokemonsleep.net/zh/news/313933343137303934393235313233353835/'),
  fixed('type_dragon_candy_s','龍屬性的糖果S','type','龍','project-evidence:2026-07-30-item-inventory','GAME_SCREENSHOT_VERIFIED'),
]);

const normalize=value=>String(value??'').normalize('NFKC').trim();
const candyIdPart=value=>encodeURIComponent(normalize(value)).replace(/%/g,'_').toLowerCase();

export function speciesCandyName(speciesName){
  const species=normalize(speciesName);
  return species?`${species}的糖果`:'';
}

export function parseSpeciesCandyName(candyName){
  const value=normalize(candyName);
  const match=value.match(/^(.+)的糖果$/u);
  return match?normalize(match[1]):null;
}

export function publicPokemonNamesForCandy(){
  const names=new Set();
  for(const row of PUBLIC_EVOLUTION_MASTER){if(row.from_species)names.add(normalize(row.from_species));if(row.to_species)names.add(normalize(row.to_species));}
  for(const row of PUBLIC_EVOLUTION_STATUS_MASTER){if(row.species_name)names.add(normalize(row.species_name));}
  return [...names].filter(Boolean).sort((a,b)=>a.localeCompare(b,'zh-Hant'));
}

export function buildPublicCandyMasterRows(){
  const rows=[...PUBLIC_CANDY_FIXED_MASTER];
  for(const species of publicPokemonNamesForCandy()){
    rows.push(Object.freeze({
      candy_id:`species_${candyIdPart(species)}`,
      candy_name:speciesCandyName(species),
      candy_type:'species',
      target_species_name:species,
      target_type_name:null,
      name_rule:SPECIES_CANDY_NAME_RULE_VERSION,
      verification_status:'DERIVED_FROM_PUBLIC_POKEMON_CANONICAL_NAME',
      source_type:'public_pokemon_name_projection',
      source_name:'Public Pokémon Knowledge',
      source_ref:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
      verified_at:'2026-08-10',
      data_version:PUBLIC_CANDY_MASTER_VERSION,
    }));
  }
  return Object.freeze(rows);
}

export function applyPublicCandyMasterSchema(db){
  db.run(`CREATE TABLE IF NOT EXISTS candy_master(
    candy_id TEXT PRIMARY KEY,
    candy_name TEXT NOT NULL UNIQUE,
    candy_type TEXT NOT NULL,
    target_species_name TEXT,
    target_type_name TEXT,
    name_rule TEXT NOT NULL,
    verification_status TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_ref TEXT,
    verified_at TEXT,
    data_version TEXT NOT NULL
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_candy_master_type ON candy_master(candy_type,candy_name)`);
  db.run(`CREATE VIEW IF NOT EXISTS candy_catalog_state AS
    SELECT m.candy_id,m.candy_name,m.candy_type,m.target_species_name,m.target_type_name,m.name_rule,m.verification_status,
           COALESCE(i.quantity,0) AS quantity,COALESCE(i.safe_reserve,0) AS safe_reserve,
           MAX(0,COALESCE(i.quantity,0)-COALESCE(i.safe_reserve,0)) AS available,
           CASE WHEN i.candy_id IS NULL THEN 0 ELSE 1 END AS player_record_exists,
           i.updated_at,i.source_update_id,m.data_version
      FROM candy_master m
      LEFT JOIN candy_inventory i ON i.candy_id=m.candy_id`);
}

export function syncPublicCandyMaster(db){
  applyPublicCandyMasterSchema(db);
  const rows=buildPublicCandyMasterRows();
  for(const row of rows){
    db.run(`INSERT INTO candy_master(candy_id,candy_name,candy_type,target_species_name,target_type_name,name_rule,verification_status,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(candy_id) DO UPDATE SET
      candy_name=excluded.candy_name,candy_type=excluded.candy_type,target_species_name=excluded.target_species_name,target_type_name=excluded.target_type_name,
      name_rule=excluded.name_rule,verification_status=excluded.verification_status,source_type=excluded.source_type,source_name=excluded.source_name,
      source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,[
      row.candy_id,row.candy_name,row.candy_type,row.target_species_name,row.target_type_name,row.name_rule,row.verification_status,
      row.source_type,row.source_name,row.source_ref,row.verified_at,row.data_version,
    ]);
  }
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('public_candy_master_version',?,datetime('now'))`,[JSON.stringify(PUBLIC_CANDY_MASTER_VERSION)]);
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('public_candy_master_contract',?,datetime('now'))`,[JSON.stringify({
    version:PUBLIC_CANDY_MASTER_VERSION,
    player_quantities_seeded:false,
    player_tables_untouched:true,
    fixed_verified_count:PUBLIC_CANDY_FIXED_MASTER.length,
    species_name_rule:SPECIES_CANDY_NAME_RULE_VERSION,
    pokemon_name_authority:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
    species_projection_count:publicPokemonNamesForCandy().length,
    physical_inventory_only:true,
    conversion_projection_status:'NOT_YET_VERIFIED',
  })]);
  return {row_count:rows.length,fixed_count:PUBLIC_CANDY_FIXED_MASTER.length,species_projection_count:rows.length-PUBLIC_CANDY_FIXED_MASTER.length};
}

export function candyNameCandidatesFromPokemonName(speciesName){
  const species=normalize(speciesName);
  if(!species)return [];
  return [speciesCandyName(species)];
}

export function typeCandyTargetIsKnown(typeName){
  const value=normalize(typeName);
  return PUBLIC_BERRY_TYPES.some(row=>normalize(row.type_name)===value);
}
