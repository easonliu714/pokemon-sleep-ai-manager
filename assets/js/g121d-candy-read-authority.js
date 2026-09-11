import {resolveCandyFamilyStorageForSpecies} from './candy-family-storage-authority.js';

export const G121D_CANDY_READ_AUTHORITY_VERSION='g121d-candy-read-authority-2026-09-11-a';

const text=value=>String(value??'').normalize('NFKC').trim();
const exactOne=values=>Array.isArray(values)&&values.length===1?values[0]:null;
const validKnownQuantity=value=>Number.isInteger(Number(value))&&Number(value)>=0;

export function resolveG121DCanonicalCandyRead(species,{candy_master_rows=[],candy_inventory_rows=[]}={}){
  const storage=resolveCandyFamilyStorageForSpecies(species);
  if(storage.status!=='MATCH'||!storage.family_id||!storage.canonical_species_name)return Object.freeze({
    status:'UNKNOWN',
    reason:'missing_canonical_family_candy_authority',
    family_id:storage.family_id||null,
    canonical_species_name:storage.canonical_species_name||null,
    canonical_candy_id:null,
    player_record_exists:false,
    quantity:null,
    canonical_family_candy_rows:Object.freeze([]),
  });

  const canonicalMasters=(candy_master_rows||[]).filter(row=>
    text(row.candy_type)==='species'&&text(row.target_species_name)===text(storage.canonical_species_name)
  );
  const canonicalMaster=exactOne(canonicalMasters);
  if(!canonicalMaster?.candy_id)return Object.freeze({
    status:'UNKNOWN',
    reason:'missing_canonical_candy_master_row',
    family_id:storage.family_id,
    canonical_species_name:storage.canonical_species_name,
    canonical_candy_id:null,
    player_record_exists:false,
    quantity:null,
    canonical_family_candy_rows:Object.freeze([]),
  });

  const canonicalCandyId=text(canonicalMaster.candy_id);
  const playerRows=(candy_inventory_rows||[]).filter(row=>text(row.candy_id)===canonicalCandyId);
  const playerRow=exactOne(playerRows);
  if(!playerRow)return Object.freeze({
    status:'UNKNOWN',
    reason:'canonical_family_player_inventory_unknown',
    family_id:storage.family_id,
    canonical_species_name:storage.canonical_species_name,
    canonical_candy_id:canonicalCandyId,
    player_record_exists:false,
    quantity:null,
    canonical_family_candy_rows:Object.freeze([]),
  });

  if(!validKnownQuantity(playerRow.quantity))return Object.freeze({
    status:'UNKNOWN',
    reason:'canonical_family_player_inventory_invalid',
    family_id:storage.family_id,
    canonical_species_name:storage.canonical_species_name,
    canonical_candy_id:canonicalCandyId,
    player_record_exists:true,
    quantity:null,
    canonical_family_candy_rows:Object.freeze([]),
  });

  const quantity=Number(playerRow.quantity);
  return Object.freeze({
    status:'KNOWN',
    reason:'governed_family_canonical_player_inventory_row',
    family_id:storage.family_id,
    canonical_species_name:storage.canonical_species_name,
    canonical_candy_id:canonicalCandyId,
    player_record_exists:true,
    quantity,
    canonical_family_candy_rows:Object.freeze([Object.freeze({
      candy_family_id:storage.family_id,
      quantity,
      knowledge_state:'KNOWN',
    })]),
  });
}
