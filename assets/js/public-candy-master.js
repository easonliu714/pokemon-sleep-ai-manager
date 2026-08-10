import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {PUBLIC_EVOLUTION_MASTER,PUBLIC_EVOLUTION_STATUS_MASTER} from './public-pokemon-knowledge-master.js';

export const PUBLIC_CANDY_MASTER_VERSION='public-candy-master-2026-08-10-a';
export const SPECIES_CANDY_NAME_RULE_VERSION='species-candy-name-rule-zh-tw-2026-08-10-a';

const BASE_SOURCE=Object.freeze({
  source_type:'game_screenshot_verified+pokemon_master_projection',
  source_name:'Pokémon Sleep in-game evidence + Public Pokémon Knowledge',
  verified_at:'2026-08-10',
  data_version:PUBLIC_CANDY_MASTER_VERSION,
});

// Fixed candy entities are only added when the item name itself has direct
// evidence. Player quantities never belong here.
export const PUBLIC_CANDY_FIXED_MASTER=Object.freeze([
  Object.freeze({
    candy_id:'universal_candy_s',candy_name:'萬能糖果S',candy_type:'universal',
    target_species_name:null,target_type_name:null,name_rule:'FIXED_VERIFIED_NAME',verification_status:'GAME_SCREENSHOT_VERIFIED',
    source_ref:'project-evidence:2026-07-30-item-inventory',...BASE_SOURCE,
  }),
  Object.freeze({
    candy_id:'type_dragon_candy_s',candy_name:'龍屬性的糖果S',candy_type:'type',
    target_species_name:null,target_type_name:'龍',name_rule:'FIXED_VERIFIED_NAME',verification_status:'GAME_SCREENSHOT_VERIFIED',
    source_ref:'project-evidence:2026-07-30-item-inventory',...BASE_SOURCE,
  }),
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
      source_ref:'PUBLIC_POKEMON_KNOWLEDGE_VERSION',
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
