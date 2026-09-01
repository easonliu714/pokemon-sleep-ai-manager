import {resolvePublicPokemonSpeciesAuthority} from './public-pokemon-species-authority.js';

export const PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION='public-candy-local-admission-2026-09-01-b';
export const PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA='pokemon-sleep-public-candy-local-admission/1.0';
export const PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY='pokemon-sleep-public-candy-local-admission-v1';
export const PUBLIC_CANDY_LOCAL_ADMISSION_ACTION='USER_CONFIRMED_PUBLIC_CANDY_ADMISSION';

export const PUBLIC_CANDY_LOCAL_ADMISSION_POLICY=Object.freeze({
  exact_observed_candy_name_required:true,
  public_species_exact_authority_required:true,
  observation_must_be_unmatched:true,
  user_confirmation_required:true,
  player_quantity_stored:false,
  source_controlled_master_mutated:false,
  local_persistent_overlay:true,
  storage_readback_verification:true,
  family_id_consolidation:false,
});

const clean=value=>String(value??'').trim();
const normalize=value=>clean(value).normalize('NFKC');
const candyIdPart=value=>encodeURIComponent(normalize(value)).replace(/%/g,'_').toLowerCase();
const clone=value=>JSON.parse(JSON.stringify(value));
const defaultState=()=>({schema:PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA,authority_version:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,rows:[]});

function defaultStorage(){
  try{return globalThis?.localStorage||null;}catch{return null;}
}

export function parseObservedSpeciesCandyName(observedText){
  const match=clean(observedText).match(/^(.+)的糖果$/u);
  return match?clean(match[1]):null;
}

export function localAdmissionCandyIdForSpecies(speciesName){
  const species=clean(speciesName);
  return species?`species_${candyIdPart(species)}`:'';
}

function validateRow(row,index){
  const label=`local admission #${index+1}`;
  if(!row||typeof row!=='object'||Array.isArray(row))throw new Error(`${label} 格式錯誤`);
  const species=clean(row.target_species_name),candyName=clean(row.candy_name),candyId=clean(row.candy_id);
  const speciesAuthority=resolvePublicPokemonSpeciesAuthority(species);
  if(speciesAuthority.status!=='MATCH'||speciesAuthority.display_name_zh_tw!==species)throw new Error(`${label} Public Pokémon species authority 不成立：${species||'missing'}`);
  if(candyName!==`${species}的糖果`)throw new Error(`${label} candy_name 必須與 exact species identity 一致`);
  if(candyId!==localAdmissionCandyIdForSpecies(species))throw new Error(`${label} candy_id 不符合 deterministic identity`);
  if(row.candy_type!=='species')throw new Error(`${label} candy_type 必須為 species`);
  if(row.admission_action!==PUBLIC_CANDY_LOCAL_ADMISSION_ACTION)throw new Error(`${label} 缺少使用者 admission authority`);
  if(!clean(row.confirmed_at)||!clean(row.source_image_ref)||!clean(row.observation_id))throw new Error(`${label} evidence 不完整`);
  if(Object.prototype.hasOwnProperty.call(row,'quantity'))throw new Error(`${label} Public Master admission 禁止包含玩家 quantity`);
  return Object.freeze({...clone(row),target_type_name:null});
}

export function readPublicCandyLocalAdmissionState({storage=defaultStorage()}={}){
  if(!storage)return defaultState();
  const raw=storage.getItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY);
  if(!raw)return defaultState();
  let parsed;
  try{parsed=JSON.parse(raw);}catch{throw new Error('Public Candy local admission storage JSON 損毀');}
  if(parsed?.schema!==PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA||parsed?.authority_version!==PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION||!Array.isArray(parsed?.rows))throw new Error('Public Candy local admission storage schema/version 不相符');
  const rows=parsed.rows.map(validateRow),ids=new Set(),names=new Set();
  for(const row of rows){
    if(ids.has(row.candy_id))throw new Error(`Public Candy local admission candy_id 衝突：${row.candy_id}`);
    if(names.has(normalize(row.candy_name)))throw new Error(`Public Candy local admission candy_name 衝突：${row.candy_name}`);
    ids.add(row.candy_id);names.add(normalize(row.candy_name));
  }
  return {schema:PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA,authority_version:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,rows};
}

function writeState(state,storage){
  if(!storage)throw new Error('瀏覽器無可用 localStorage；不能建立可持久化 Public Candy admission');
  storage.setItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,JSON.stringify({schema:PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA,authority_version:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,rows:state.rows}));
}

export function publicCandyLocalAdmissionRows(options={}){
  return Object.freeze(readPublicCandyLocalAdmissionState(options).rows.map(row=>Object.freeze(clone(row))));
}

export function publicCandyLocalAdmissionFingerprint(options={}){
  const rows=publicCandyLocalAdmissionRows(options);
  if(!rows.length)return 'none';
  const source=rows.map(row=>`${row.candy_id}|${row.candy_name}|${row.confirmed_at}`).sort().join('\n');
  let hash=2166136261;
  for(let index=0;index<source.length;index+=1){hash^=source.charCodeAt(index);hash=Math.imul(hash,16777619)>>>0;}
  return hash.toString(16).padStart(8,'0');
}

export function preparePublicCandyLocalAdmission({observation,confirmedAt=new Date().toISOString()}={}){
  if(!observation||typeof observation!=='object'||Array.isArray(observation))throw new Error('Public Candy admission 需要 Recognition observation');
  if(observation.status!=='UNMATCHED')throw new Error('只有 UNMATCHED observation 才能建立本機 Public Candy identity');
  const species=parseObservedSpeciesCandyName(observation.observed_text);
  if(!species)throw new Error('畫面名稱必須是 exact「寶可夢名稱的糖果」才能建立 Public Candy identity');
  const authority=resolvePublicPokemonSpeciesAuthority(species);
  if(authority.status!=='MATCH'||authority.display_name_zh_tw!==species)throw new Error(`Public Pokémon species authority 尚未確認「${species}」；不能建立糖果公版`);
  const sourceImageRef=clean(observation.source_image_ref),observationId=clean(observation.observation_id);
  if(!sourceImageRef||!observationId)throw new Error('Public Candy admission 需要 image / observation evidence');
  return validateRow({
    candy_id:localAdmissionCandyIdForSpecies(species),
    candy_name:`${species}的糖果`,
    candy_type:'species',
    target_species_name:species,
    target_type_name:null,
    name_rule:'USER_CONFIRMED_EXACT_GAME_SCREENSHOT_CANDY_NAME',
    verification_status:'USER_CONFIRMED_GAME_SCREENSHOT_LOCAL_ADMISSION',
    source_type:'user_confirmed_game_screenshot_local_admission',
    source_name:'User-confirmed Pokémon Sleep in-game screenshot',
    source_ref:`local-admission:${sourceImageRef}`,
    source_image_ref:sourceImageRef,
    observation_id:observationId,
    confirmed_at:clean(confirmedAt),
    admission_action:PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
    authority_version:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  },0);
}

export function commitPublicCandyLocalAdmission(row,{storage=defaultStorage()}={}){
  const prepared=validateRow(row,0);
  const state=readPublicCandyLocalAdmissionState({storage});
  const same=state.rows.find(item=>item.candy_id===prepared.candy_id&&normalize(item.candy_name)===normalize(prepared.candy_name));
  if(same)return {status:'ALREADY_ADMITTED',row:Object.freeze(clone(same)),state};
  const idCollision=state.rows.find(item=>item.candy_id===prepared.candy_id),nameCollision=state.rows.find(item=>normalize(item.candy_name)===normalize(prepared.candy_name));
  if(idCollision||nameCollision)throw new Error(`Public Candy local admission identity 衝突：${prepared.candy_name}`);
  const next={...state,rows:[...state.rows,prepared]};
  writeState(next,storage);
  const verified=readPublicCandyLocalAdmissionState({storage});
  const readback=verified.rows.find(item=>item.candy_id===prepared.candy_id&&normalize(item.candy_name)===normalize(prepared.candy_name));
  if(!readback)throw new Error(`Public Candy local admission 儲存後 readback 驗證失敗：${prepared.candy_name}`);
  return {status:'CREATED',row:Object.freeze(clone(readback)),state:verified};
}

export function removePublicCandyLocalAdmission(candyId,{storage=defaultStorage(),expectedObservationId=null}={}){
  const id=clean(candyId),state=readPublicCandyLocalAdmissionState({storage});
  const current=state.rows.find(row=>row.candy_id===id);
  if(!current)return {status:'ABSENT',state};
  if(expectedObservationId&&clean(current.observation_id)!==clean(expectedObservationId))throw new Error(`Public Candy local admission rollback ownership 不符：${id}`);
  const next={...state,rows:state.rows.filter(row=>row.candy_id!==id)};
  writeState(next,storage);
  const verified=readPublicCandyLocalAdmissionState({storage});
  if(verified.rows.some(row=>row.candy_id===id))throw new Error(`Public Candy local admission rollback readback 失敗：${id}`);
  return {status:'REMOVED',state:verified};
}
