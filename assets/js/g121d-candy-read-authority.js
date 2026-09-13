import {resolveCandyFamilyStorageForSpecies} from './candy-family-storage-authority.js';
import {resolvePublicCandyFamilyForSpecies} from './public-candy-family-authority.js';

export const G121D_CANDY_READ_AUTHORITY_VERSION='g121d-candy-read-authority-2026-09-13-b';

const text=value=>String(value??'').normalize('NFKC').trim();
const exactOne=values=>Array.isArray(values)&&values.length===1?values[0]:null;
const validKnownQuantity=value=>Number.isInteger(Number(value))&&Number(value)>=0;

function unknown({reason,family_id=null,canonical_species_name=null,canonical_candy_id=null,player_record_exists=false,resolution_mode=null}={}){
  return Object.freeze({
    status:'UNKNOWN',
    reason,
    family_id,
    canonical_species_name,
    canonical_candy_id,
    player_record_exists,
    quantity:null,
    resolution_mode,
    canonical_family_candy_rows:Object.freeze([]),
  });
}

function resolveFamilyAndMaster(species,candyMasterRows){
  const storage=resolveCandyFamilyStorageForSpecies(species);
  if(storage.status==='MATCH'&&storage.family_id&&storage.canonical_species_name){
    const canonicalMasters=(candyMasterRows||[]).filter(row=>
      text(row.candy_type)==='species'&&text(row.target_species_name)===text(storage.canonical_species_name)
    );
    const canonicalMaster=exactOne(canonicalMasters);
    if(!canonicalMaster?.candy_id)return unknown({
      reason:'missing_canonical_candy_master_row',
      family_id:storage.family_id,
      canonical_species_name:storage.canonical_species_name,
      resolution_mode:'STORAGE_CANONICAL_SPECIES',
    });
    return {
      status:'MATCH',
      family_id:storage.family_id,
      canonical_species_name:storage.canonical_species_name,
      canonical_master:canonicalMaster,
      resolution_mode:'STORAGE_CANONICAL_SPECIES',
    };
  }

  // G12.1 .55.3.3.8 real-device closure:
  // runtime READ authority must not collapse merely because the family lacks a
  // separate zh-TW Candy display-name authority. Family membership itself is
  // governed by Public Candy Family authority. For such a family, accept a
  // candy_master identity only when exactly one species master row belongs to
  // the governed family. This is exact-set resolution, not a species-name guess.
  const family=resolvePublicCandyFamilyForSpecies(species);
  if(family.status!=='MATCH'||!family.family_id||!Array.isArray(family.member_species_names)||!family.member_species_names.length){
    return unknown({
      reason:'missing_canonical_family_candy_authority',
      family_id:family.family_id||storage.family_id||null,
      canonical_species_name:family.canonical_species_name||storage.canonical_species_name||null,
      resolution_mode:'GOVERNED_FAMILY_EXACT_MASTER',
    });
  }
  const memberNames=new Set(family.member_species_names.map(text).filter(Boolean));
  const familyMasters=(candyMasterRows||[]).filter(row=>
    text(row.candy_type)==='species'&&memberNames.has(text(row.target_species_name))
  );
  if(familyMasters.length===0)return unknown({
    reason:'missing_canonical_candy_master_row',
    family_id:family.family_id,
    canonical_species_name:null,
    resolution_mode:'GOVERNED_FAMILY_EXACT_MASTER',
  });
  if(familyMasters.length!==1)return unknown({
    reason:'ambiguous_canonical_candy_master_rows',
    family_id:family.family_id,
    canonical_species_name:null,
    resolution_mode:'GOVERNED_FAMILY_EXACT_MASTER',
  });
  const canonicalMaster=familyMasters[0];
  if(!text(canonicalMaster.candy_id))return unknown({
    reason:'missing_canonical_candy_master_row',
    family_id:family.family_id,
    canonical_species_name:text(canonicalMaster.target_species_name)||null,
    resolution_mode:'GOVERNED_FAMILY_EXACT_MASTER',
  });
  return {
    status:'MATCH',
    family_id:family.family_id,
    canonical_species_name:text(canonicalMaster.target_species_name),
    canonical_master:canonicalMaster,
    resolution_mode:'GOVERNED_FAMILY_EXACT_MASTER',
  };
}

export function resolveG121DCanonicalCandyRead(species,{candy_master_rows=[],candy_inventory_rows=[]}={}){
  const resolved=resolveFamilyAndMaster(species,candy_master_rows);
  if(resolved.status!=='MATCH')return resolved;

  const canonicalCandyId=text(resolved.canonical_master.candy_id);
  const playerRows=(candy_inventory_rows||[]).filter(row=>text(row.candy_id)===canonicalCandyId);
  const playerRow=exactOne(playerRows);
  if(!playerRow)return unknown({
    reason:'canonical_family_player_inventory_unknown',
    family_id:resolved.family_id,
    canonical_species_name:resolved.canonical_species_name,
    canonical_candy_id:canonicalCandyId,
    player_record_exists:false,
    resolution_mode:resolved.resolution_mode,
  });

  if(!validKnownQuantity(playerRow.quantity))return unknown({
    reason:'canonical_family_player_inventory_invalid',
    family_id:resolved.family_id,
    canonical_species_name:resolved.canonical_species_name,
    canonical_candy_id:canonicalCandyId,
    player_record_exists:true,
    resolution_mode:resolved.resolution_mode,
  });

  const quantity=Number(playerRow.quantity);
  return Object.freeze({
    status:'KNOWN',
    reason:'governed_family_canonical_player_inventory_row',
    family_id:resolved.family_id,
    canonical_species_name:resolved.canonical_species_name,
    canonical_candy_id:canonicalCandyId,
    player_record_exists:true,
    quantity,
    resolution_mode:resolved.resolution_mode,
    canonical_family_candy_rows:Object.freeze([Object.freeze({
      candy_family_id:resolved.family_id,
      quantity,
      knowledge_state:'KNOWN',
    })]),
  });
}
