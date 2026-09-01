import {resolvePublicPokemonSpeciesAuthority} from './public-pokemon-species-authority.js';

export const PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION='public-candy-local-admission-2026-09-01-a';
export const PUBLIC_CANDY_LOCAL_ADMISSION_SCHEMA='pokemon-sleep-public-candy-local-admission/1.0';
export const PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY='pokemon-sleep-public-candy-local-admission-v1';
export const PUBLIC_CANDY_LOCAL_ADMISSION_ACTION='USER_CONFIRMED_PUBLIC_CANDY_ADMISSION';

export const PUBLIC_CANDY_LOCAL_ADMISSION_POLICY=Object.freeze({
  exact_observed_candy_name_required:true,
  public_species_exact_authority_required:true,
  user_confirmation_required:true,
  player_quantity_stored:false,
  source_controlled_master_mutated:false,
  local_persistent_overlay:true,
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

export function admitPublicCandyFromObservedName({observedText,sourceImageRef,observationId,confirmedAt=new Date().toISOString(),storage=defaultStorage()}={}){
  const species=parseObservedSpeciesCandyName(observedText);
  if(!species)throw new Error('畫面名稱必須是 exact「寶可夢名稱的糖果」才能建立 Public Candy identity');
  const authority=resolvePublicPokemonSpeciesAuthority(species);
  if(authority.status!=='MATCH'||authority.display_name_zh_tw!==species)throw new Error(`Public Pokémon species authority 尚未確認「${species}」；不能建立糖果公版`);
  const candyName=`${species}的糖果`,candyId=localAdmissionCandyIdForSpecies(species);
  const state=readPublicCandyLocalAdmissionState({storage});
  const same=state.rows.find(row=>row.candy_id===candyId&&normalize(row.candy_name)===normalize(candyName));
  if(same)return {status:'ALREADY_ADMITTED',row:Object.freeze(clone(same)),state};
  const idCollision=state.rows.find(row=>row.candy_id===candyId),nameCollision=state.rows.find(row=>normalize(row.candy_name)===normalize(candyName));
  if(idCollision||nameCollision)throw new Error(`Public Candy local admission identity 衝突：${candyName}`);
  const row=validateRow({
    candy_id:candyId,
    candy_name:candyName,
    candy_type:'species',
    target_species_name:species,
    target_type_name:null,
    name_rule:'USER_CONFIRMED_EXACT_GAME_SCREENSHOT_CANDY_NAME',
    verification_status:'USER_CONFIRMED_GAME_SCREENSHOT_LOCAL_ADMISSION',
    source_type:'user_confirmed_game_screenshot_local_admission',
    source_name:'User-confirmed Pokémon Sleep in-game screenshot',
    source_ref:`local-admission:${clean(sourceImageRef)}`,
    source_image_ref:clean(sourceImageRef),
    observation_id:clean(observationId),
    confirmed_at:clean(confirmedAt),
    admission_action:PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
    authority_version:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  },state.rows.length);
  if(!row.source_image_ref||!row.observation_id)throw new Error('Public Candy admission 需要 image / observation evidence');
  const next={...state,rows:[...state.rows,row]};
  writeState(next,storage);
  return {status:'CREATED',row:Object.freeze(clone(row)),state:next};
}
