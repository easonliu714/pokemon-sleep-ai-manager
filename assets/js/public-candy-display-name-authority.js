import {
  PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
  resolvePublicCandyFamilyForSpecies,
} from './public-candy-family-authority.js';
import {publicCandyLocalAdmissionRows} from './public-candy-local-admission-authority.js';

export const PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION='public-candy-display-name-authority-2026-09-02-f';
export const PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_STATUS='ACTIVE_LOCAL_PRIMARY_PUBLIC_SUPPLEMENTAL_ZH_TW_DISPLAY_NAME_AUTHORITY';

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

// Source-controlled display names remain literal evidence rows. No display name
// is synthesized from a species or structural root. Local user-confirmed rows
// are durable authorities for Pokémon/Candy zh-TW names; public rows supplement
// and corroborate them, but never silently overwrite a conflicting local name.
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

function buildStaticAuthorityRows(){
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

const STATIC_PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS=buildStaticAuthorityRows();

function localAdmissionAuthorityRows(){
  const output=[];
  // .55.2: do not swallow local authority migration/corruption errors. A local
  // row that cannot be read is a HOLD condition, never equivalent to no row.
  const localRows=publicCandyLocalAdmissionRows();
  for(const local of localRows){
    const family=resolvePublicCandyFamilyForSpecies(local.target_species_name);
    if(family.status!=='MATCH'||!family.family_id)continue;
    output.push(Object.freeze({
      reference_species_name:local.target_species_name,
      candy_display_name:local.candy_name,
      locale:'zh-TW',
      source_type:local.source_type||'user_confirmed_game_screenshot_local_admission',
      source_ref:local.source_ref||`local-admission:${local.observation_id||'unknown'}`,
      verified_at:local.confirmed_at||null,
      exact_display_string_authority:true,
      local_admission_authority:true,
      local_evidence_preserved:true,
      status:'MATCH',
      reason:'USER_CONFIRMED_LOCAL_EXACT_CANDY_DISPLAY_NAME_BOUND_TO_FAMILY',
      family_id:family.family_id,
      family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
      member_species_names:Object.freeze([...(family.member_species_names||[])]),
      candy_display_name_authority:true,
    }));
  }
  return Object.freeze(output);
}

function currentAuthorityRowsInternal(){
  const staticRows=[...STATIC_PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS];
  const localRows=[...localAdmissionAuthorityRows()];
  const staticByFamily=new Map(staticRows.filter(row=>row.status==='MATCH'&&row.family_id).map(row=>[row.family_id,row]));
  const localByFamily=new Map();
  for(const local of localRows){
    const existingLocal=localByFamily.get(local.family_id);
    if(existingLocal&&normalizeKey(existingLocal.candy_display_name)!==normalizeKey(local.candy_display_name)){
      throw new Error(`public_candy_display_name_local_local_conflict:${local.family_id}:${existingLocal.candy_display_name}:${local.candy_display_name}`);
    }
    if(!existingLocal)localByFamily.set(local.family_id,local);
  }

  const rows=[];
  const handledFamilies=new Set();
  // Pokémon/Candy names are local-primary while public completeness remains
  // unattested. Exact public rows corroborate; a mismatch fails closed.
  for(const local of localRows){
    if(handledFamilies.has(local.family_id))continue;
    const publicRow=staticByFamily.get(local.family_id)||null;
    if(publicRow&&normalizeKey(publicRow.candy_display_name)!==normalizeKey(local.candy_display_name)){
      throw new Error(`public_candy_display_name_local_conflict:${local.family_id}:${publicRow.candy_display_name}:${local.candy_display_name}`);
    }
    rows.push(Object.freeze({
      ...local,
      public_corroborated:Boolean(publicRow),
      public_source_ref:publicRow?.source_ref||null,
      public_source_type:publicRow?.source_type||null,
      reason:publicRow?'USER_CONFIRMED_LOCAL_CANDY_NAME_PUBLIC_CORROBORATED':'USER_CONFIRMED_LOCAL_CANDY_NAME_PUBLIC_SUPPLEMENT_MISSING',
    }));
    handledFamilies.add(local.family_id);
  }
  for(const row of staticRows){
    if(row.status==='MATCH'&&row.family_id&&handledFamilies.has(row.family_id))continue;
    rows.push(row);
  }
  return Object.freeze(rows);
}

// Read-only dynamic Array facade. Resolving at property access means a local
// admission committed in the same browser session becomes immediately visible.
export const PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS=new Proxy([],{
  get(_target,property){
    const rows=currentAuthorityRowsInternal();
    const value=Reflect.get(rows,property,rows);
    return typeof value==='function'?value.bind(rows):value;
  },
  set(){return false;},
  deleteProperty(){return false;},
  defineProperty(){return false;},
});

export const PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY=Object.freeze({
  candy_family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
  exact_official_zh_tw_string_supported:true,
  ingame_screenshot_official_equivalent_exact_string_supported:true,
  real_device_user_revalidation_exact_string_supported:true,
  local_user_confirmed_exact_string_supported:true,
  local_name_precedes_public_name_while_public_completeness_unattested:true,
  public_name_supplements_local_gap:true,
  public_name_may_silently_overwrite_local_name:false,
  local_admission_read_failure_silent_drop:false,
  local_admission_quantity_authority:false,
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
  return Object.freeze(currentAuthorityRowsInternal().map(row=>Object.freeze({
    ...row,
    member_species_names:Object.freeze([...(row.member_species_names||[])]),
  })));
}

function authorityForFamily(familyId){
  return currentAuthorityRowsInternal().find(row=>row.status==='MATCH'&&row.family_id===familyId&&row.candy_display_name_authority===true)||null;
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
  const authority=authorityForFamily(family.family_id);
  if(!authority){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'FIRST_PARTY_OR_LOCAL_ZH_TW_CANDY_DISPLAY_NAME_NOT_VERIFIED',
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
    reason:authority.local_admission_authority?'EXACT_USER_CONFIRMED_LOCAL_ZH_TW_CANDY_DISPLAY_NAME':'EXACT_FIRST_PARTY_ZH_TW_CANDY_DISPLAY_NAME',
    observed_species_name:displayText(speciesName),
    canonical_species_name:authority.reference_species_name,
    family_id:family.family_id,
    member_species_names:family.member_species_names,
    candy_display_name:authority.candy_display_name,
    candy_display_name_authority:true,
    source_type:authority.source_type,
    source_ref:authority.source_ref,
    verified_at:authority.verified_at,
    local_admission_authority:Boolean(authority.local_admission_authority),
    local_evidence_preserved:Boolean(authority.local_evidence_preserved),
    public_corroborated:Boolean(authority.public_corroborated),
    automatic_display_name_generation:false,
  });
}

export function resolvePublicCandyDisplayNameForFamilyId(familyId){
  const key=displayText(familyId);
  const authority=authorityForFamily(key);
  if(!authority){
    return Object.freeze({
      status:'REVIEW_REQUIRED',
      reason:'FIRST_PARTY_OR_LOCAL_ZH_TW_CANDY_DISPLAY_NAME_NOT_VERIFIED',
      family_id:key||null,
      candy_display_name:null,
      candy_display_name_authority:false,
      automatic_display_name_generation:false,
    });
  }
  return Object.freeze({
    status:'MATCH',
    reason:authority.local_admission_authority?'EXACT_USER_CONFIRMED_LOCAL_ZH_TW_CANDY_DISPLAY_NAME':'EXACT_FIRST_PARTY_ZH_TW_CANDY_DISPLAY_NAME',
    family_id:authority.family_id,
    candy_display_name:authority.candy_display_name,
    candy_display_name_authority:true,
    source_type:authority.source_type,
    source_ref:authority.source_ref,
    verified_at:authority.verified_at,
    local_admission_authority:Boolean(authority.local_admission_authority),
    local_evidence_preserved:Boolean(authority.local_evidence_preserved),
    public_corroborated:Boolean(authority.public_corroborated),
    automatic_display_name_generation:false,
  });
}
