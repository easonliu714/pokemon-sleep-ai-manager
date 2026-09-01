import {
  PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
  resolvePublicCandyFamilyForSpecies,
} from './public-candy-family-authority.js';

export const PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION='public-candy-display-name-authority-2026-09-01-d';
export const PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_STATUS='ACTIVE_EXPLICIT_FIRST_PARTY_ZH_TW_DISPLAY_NAME_AUTHORITY';

const displayText=value=>String(value??'').trim();
const normalizeKey=value=>displayText(value).normalize('NFKC');
const REAL_DEVICE_REVALIDATION_SOURCE='project-evidence:2026-09-01-p0b6-real-device-inventory-revalidation';

const evidence=(reference_species_name,candy_display_name,source_ref,verified_at,source_type='OFFICIAL_POKEMON_SLEEP_ZH_TW_EXACT_STRING')=>Object.freeze({
  reference_species_name,
  candy_display_name,
  locale:'zh-TW',
  source_type,
  source_ref,
  verified_at,
  exact_display_string_authority:true,
});
const ingameEvidence=(reference_species_name,candy_display_name,source_ref)=>evidence(
  reference_species_name,
  candy_display_name,
  source_ref,
  '2026-09-01',
  'POKEMON_SLEEP_INGAME_SCREENSHOT_OFFICIAL_EQUIVALENT_EXACT_STRING',
);

// Display names are literal evidence rows. Never derive them from a species,
// structural root, family root, or `${species}的糖果` style string rule.
export const PUBLIC_CANDY_DISPLAY_NAME_EVIDENCE_ROWS=Object.freeze([
  evidence(
    '妙蛙種子',
    '妙蛙種子的糖果',
    'https://www.pokemonsleep.net/zh/news/333435333139353737393034373432343032/',
    '2026-08-31',
  ),
  evidence(
    '皮卡丘',
    '皮卡丘的糖果',
    'https://www.pokemonsleep.net/zh/news/333435333139353737393034373432343032/',
    '2026-08-31',
  ),
  evidence(
    '伊布',
    '伊布的糖果',
    'https://www.pokemonsleep.net/zh/news/323030373835373533323933313933323137/',
    '2026-08-31',
  ),
  ingameEvidence('草苗龜','草苗龜的糖果','project-evidence:2026-09-01-p0b5-ingame-candy#obs_001'),
  ingameEvidence('木守宮','木守宮的糖果','project-evidence:2026-09-01-p0b5-ingame-candy#obs_002'),
  ingameEvidence('小鍛匠','小鍛匠的糖果','project-evidence:2026-09-01-p0b5-ingame-candy#obs_004'),
  ingameEvidence('波加曼','波加曼的糖果','project-evidence:2026-09-01-p0b5-ingame-candy#obs_007'),
  ingameEvidence('水躍魚','水躍魚的糖果','project-evidence:2026-09-01-p0b5-ingame-candy#obs_008'),
  ingameEvidence('摔角鷹人的糖果'.replace('的糖果',''),'摔角鷹人的糖果','project-evidence:2026-09-01-p0b5-ingame-candy#obs_009'),
  ingameEvidence('火稚雞','火稚雞的糖果','project-evidence:2026-09-01-p0b5-ingame-candy#obs_014'),
  ingameEvidence('菊草葉','菊草葉的糖果','project-evidence:2026-09-01-p0b5-ingame-candy#obs_019'),
  ingameEvidence('卡拉卡拉','卡拉卡拉的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#cubone`),
  ingameEvidence('卡蒂狗','卡蒂狗的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#growlithe`),
  ingameEvidence('夢幻','夢幻的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#mew`),
  ingameEvidence('寶寶暴龍','寶寶暴龍的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#tyrunt`),
  ingameEvidence('小火焰猴','小火焰猴的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#chimchar`),
  ingameEvidence('拉帝亞斯','拉帝亞斯的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#latias`),
  ingameEvidence('拉帝歐斯','拉帝歐斯的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#latios`),
  ingameEvidence('胖丁','胖丁的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#jigglypuff`),
  ingameEvidence('迷你龍','迷你龍的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#dratini`),
  ingameEvidence('達克萊伊','達克萊伊的糖果',`${REAL_DEVICE_REVALIDATION_SOURCE}#darkrai`),
]);

function bindEvidenceRow(row){
  const family=resolvePublicCandyFamilyForSpecies(row.reference_species_name);
  if(family.status!=='MATCH'){
    return Object.freeze({
      ...row,
      status:'REVIEW_REQUIRED',
      reason:'DISPLAY_NAME_EVIDENCE_FAMILY_NOT_GOVERNED',
      family_id:null,
      family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
      member_species_names:Object.freeze([]),
      candy_display_name_authority:false,
    });
  }
  return Object.freeze({
    ...row,
    status:'MATCH',
    reason:'FIRST_PARTY_EXACT_CANDY_DISPLAY_NAME_BOUND_TO_GOVERNED_FAMILY',
    family_id:family.family_id,
    family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
    member_species_names:Object.freeze([...(family.member_species_names||[])]),
    candy_display_name_authority:true,
  });
}

function buildAuthorityRows(){
  const rows=PUBLIC_CANDY_DISPLAY_NAME_EVIDENCE_ROWS.map(bindEvidenceRow);
  const byFamily=new Map();
  for(const row of rows){
    if(row.status!=='MATCH'||!row.family_id)continue;
    const existing=byFamily.get(row.family_id);
    if(existing&&normalizeKey(existing.candy_display_name)!==normalizeKey(row.candy_display_name)){
      throw new Error(`public_candy_display_name_conflict:${row.family_id}:${existing.candy_display_name}:${row.candy_display_name}`);
    }
    if(!existing)byFamily.set(row.family_id,row);
  }
  return Object.freeze(rows);
}

export const PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS=buildAuthorityRows();
const MATCH_BY_FAMILY=new Map(
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS
    .filter(row=>row.status==='MATCH'&&row.family_id)
    .map(row=>[row.family_id,row]),
);

export const PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY=Object.freeze({
  candy_family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
  exact_official_zh_tw_string_required:true,
  ingame_screenshot_official_equivalent_exact_string_supported:true,
  real_device_user_revalidation_exact_string_supported:true,
  structural_root_is_not_display_name_anchor:true,
  species_name_concatenation_forbidden:true,
  automatic_display_name_generation:false,
  unverified_family_fail_closed:true,
  legacy_candy_master_mutation_authority:false,
  legacy_candy_id_remap_authority:false,
  candy_inventory_migration_authority:false,
  player_quantity_write_authority:false,
  professor_transfer_write_behavior_changed:false,
});

export function currentPublicCandyDisplayNameAuthorityRows(){
  return Object.freeze(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS.map(row=>Object.freeze({
    ...row,
    member_species_names:Object.freeze([...(row.member_species_names||[])]),
  })));
}

export function resolvePublicCandyDisplayNameForSpecies(speciesName){
  const family=resolvePublicCandyFamilyForSpecies(speciesName);
  if(family.status!=='MATCH'){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'PUBLIC_CANDY_FAMILY_AUTHORITY_REQUIRED_FOR_DISPLAY_NAME',
      observed_species_name:displayText(speciesName),
      family_status:family.status,
      family_id:null,
      candy_display_name:null,
      candy_display_name_authority:false,
      automatic_display_name_generation:false,
    });
  }
  const authority=MATCH_BY_FAMILY.get(family.family_id);
  if(!authority){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'FIRST_PARTY_ZH_TW_CANDY_DISPLAY_NAME_NOT_VERIFIED',
      observed_species_name:displayText(speciesName),
      canonical_species_name:family.canonical_species_name,
      family_id:family.family_id,
      member_species_names:family.member_species_names,
      candy_display_name:null,
      candy_display_name_authority:false,
      automatic_display_name_generation:false,
    });
  }
  return Object.freeze({
    status:'MATCH',
    reason:'EXACT_FIRST_PARTY_ZH_TW_CANDY_DISPLAY_NAME',
    observed_species_name:displayText(speciesName),
    canonical_species_name:family.canonical_species_name,
    family_id:family.family_id,
    member_species_names:family.member_species_names,
    candy_display_name:authority.candy_display_name,
    candy_display_name_authority:true,
    source_type:authority.source_type,
    source_ref:authority.source_ref,
    verified_at:authority.verified_at,
    automatic_display_name_generation:false,
  });
}

export function resolvePublicCandyDisplayNameForFamilyId(familyId){
  const key=displayText(familyId);
  const authority=MATCH_BY_FAMILY.get(key);
  if(!authority){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'FIRST_PARTY_ZH_TW_CANDY_DISPLAY_NAME_NOT_VERIFIED',
      family_id:key||null,
      candy_display_name:null,
      candy_display_name_authority:false,
      automatic_display_name_generation:false,
    });
  }
  return Object.freeze({
    status:'MATCH',
    reason:'EXACT_FIRST_PARTY_ZH_TW_CANDY_DISPLAY_NAME',
    family_id:authority.family_id,
    candy_display_name:authority.candy_display_name,
    candy_display_name_authority:true,
    source_type:authority.source_type,
    source_ref:authority.source_ref,
    verified_at:authority.verified_at,
    automatic_display_name_generation:false,
  });
}
