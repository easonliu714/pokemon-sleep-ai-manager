import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {
  PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION,
  publicPokemonNamesForLegacyCandyProjection,
  resolvePublicPokemonSpeciesAuthority,
} from './public-pokemon-species-authority.js';
import {
  PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  publicCandyLocalAdmissionRows,
} from './public-candy-local-admission-authority.js';

export const PUBLIC_CANDY_MASTER_VERSION='public-candy-master-2026-09-01-f';
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

// Source-controlled compatibility additions remain intentionally narrow. .53
// does NOT pre-admit the user's newly observed gaps here. Runtime admissions
// live in the separately governed local overlay and are promoted globally only
// by a later release after physical validation.
export const PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS=Object.freeze([
  Object.freeze({
    species_name:'小火焰猴',
    source_ref:'https://www.serebii.net/pokemonsleep/pokemon/chimchar.shtml',
    verification_status:'REFERENCE_CANDY_FAMILY_VERIFIED',
    evidence_note:'Pokémon Sleep reference lists 40/80 Chimchar Candy for the Chimchar evolution line.',
  }),
]);

// Keep authoritative zh-TW display strings byte-for-byte apart from outer
// whitespace. NFKC is safe for comparison/stable-id keys, but must never be
// used as the projected display name because it turns canonical full-width
// punctuation such as 「（高調的樣子）」 into ASCII parentheses.
const displayText=value=>String(value??'').trim();
const normalizeKey=value=>displayText(value).normalize('NFKC');
const candyIdPart=value=>encodeURIComponent(normalizeKey(value)).replace(/%/g,'_').toLowerCase();

export function speciesCandyName(speciesName){
  const species=displayText(speciesName);
  return species?`${species}的糖果`:'';
}

export function parseSpeciesCandyName(candyName){
  const value=displayText(candyName);
  const match=value.match(/^(.+)的糖果$/u);
  return match?displayText(match[1]):null;
}

function compatibilityAdditionForSpecies(speciesName){
  const key=normalizeKey(speciesName);
  return PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS.find(row=>normalizeKey(row.species_name)===key)||null;
}

export function publicPokemonNamesForCandy(){
  const names=new Map();
  const add=value=>{
    const display=displayText(value),key=normalizeKey(value);
    if(display&&key&&!names.has(key))names.set(key,display);
  };
  for(const name of publicPokemonNamesForLegacyCandyProjection())add(name);
  for(const evidenceRow of PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS){
    const species=resolvePublicPokemonSpeciesAuthority(evidenceRow.species_name);
    if(species.status!=='MATCH')throw new Error(`public_candy_legacy_addition_species_not_governed:${evidenceRow.species_name}`);
    add(species.display_name_zh_tw);
  }
  return [...names.values()].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
}

export function buildPublicCandyMasterRows(){
  const rows=[...PUBLIC_CANDY_FIXED_MASTER];
  for(const species of publicPokemonNamesForCandy()){
    const addition=compatibilityAdditionForSpecies(species);
    rows.push(Object.freeze({
      candy_id:`species_${candyIdPart(species)}`,
      candy_name:speciesCandyName(species),
      candy_type:'species',
      target_species_name:species,
      target_type_name:null,
      name_rule:SPECIES_CANDY_NAME_RULE_VERSION,
      verification_status:addition?'REFERENCE_CANDY_FAMILY_LEGACY_COMPATIBILITY':'DERIVED_FROM_PUBLIC_POKEMON_CANONICAL_NAME',
      source_type:addition?'reference_candy_family_legacy_projection':'public_pokemon_name_projection',
      source_name:addition?'Pokémon Sleep Candy family reference + Public Pokémon Species Authority':'Public Pokémon Species Authority (legacy Candy compatibility projection)',
      source_ref:addition?addition.source_ref:PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION,
      verified_at:addition?'2026-09-01':'2026-08-29',
      data_version:PUBLIC_CANDY_MASTER_VERSION,
    }));
  }

  // Local admissions are persistent Public Master overlays on this device only.
  // They contain exact identity/evidence and never player quantity. A later
  // source-controlled release may make an identical row global; exact duplicates
  // are therefore ignored while non-identical id/name collisions fail closed.
  const ids=new Map(rows.map(row=>[row.candy_id,row]));
  const names=new Map(rows.map(row=>[normalizeKey(row.candy_name),row]));
  for(const local of publicCandyLocalAdmissionRows()){
    const idHit=ids.get(local.candy_id),nameHit=names.get(normalizeKey(local.candy_name));
    if(idHit||nameHit){
      if(idHit&&nameHit&&idHit===nameHit&&idHit.candy_id===local.candy_id&&normalizeKey(idHit.candy_name)===normalizeKey(local.candy_name))continue;
      throw new Error(`public_candy_local_admission_collision:${local.candy_name}`);
    }
    const row=Object.freeze({...local,data_version:PUBLIC_CANDY_MASTER_VERSION});
    rows.push(row);ids.set(row.candy_id,row);names.set(normalizeKey(row.candy_name),row);
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
      row.candy_id,row.candy_name,row.candy_type,row.target_species_name,row.target_type_name,row.name_rule,row.verification_status,row.source_type,row.source_name,row.source_ref,row.verified_at,row.data_version,
    ]);
  }
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('public_candy_master_version',?,datetime('now'))`,[JSON.stringify(PUBLIC_CANDY_MASTER_VERSION)]);
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('public_candy_master_contract',?,datetime('now'))`,[JSON.stringify({
    version:PUBLIC_CANDY_MASTER_VERSION,
    player_quantities_seeded:false,
    player_tables_untouched:true,
    fixed_verified_count:PUBLIC_CANDY_FIXED_MASTER.length,
    species_name_rule:SPECIES_CANDY_NAME_RULE_VERSION,
    pokemon_name_authority:PUBLIC_POKEMON_SPECIES_AUTHORITY_VERSION,
    species_projection_count:publicPokemonNamesForCandy().length,
    explicit_legacy_compatibility_evidence_addition_count:PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS.length,
    local_admission_authority:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
    physical_inventory_only:true,
    conversion_projection_status:'NOT_YET_VERIFIED',
  })]);
  return {row_count:rows.length,fixed_count:PUBLIC_CANDY_FIXED_MASTER.length,species_projection_count:rows.length-PUBLIC_CANDY_FIXED_MASTER.length};
}

export function candyNameCandidatesFromPokemonName(speciesName){
  const species=displayText(speciesName);
  if(!species)return [];
  return [speciesCandyName(species)];
}

export function typeCandyTargetIsKnown(typeName){
  const value=normalizeKey(typeName);
  return PUBLIC_BERRY_TYPES.some(row=>normalizeKey(row.type_name)===value);
}
