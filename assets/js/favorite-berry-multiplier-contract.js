import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';
import {canonicalBerryName} from './public-berry-strength-master.js';

export const FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID='favorite-berry-base-strength-multiplier-2026-08-13-a';
export const FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION='favorite-berry-base-strength-x2-v1';
export const FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER=2;
export const NON_FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER=1;
export const REQUIRED_WEEKLY_FAVORITE_BERRY_COUNT=3;

const text=value=>String(value??'').normalize('NFKC').trim();
const berryIdentity=value=>canonicalBerryName(text(value));
const KNOWN_BERRIES=new Set(PUBLIC_BERRY_TYPES.map(row=>berryIdentity(row.berry_name)).filter(Boolean));
const freeze=value=>Object.freeze(value);

export const FAVORITE_BERRY_MULTIPLIER_BOUNDARY=freeze({
  applies_to:'BASE_BERRY_STRENGTH_ONLY',
  excluded_modifiers:freeze([
    'EXPERT_MODE_MAIN_FAVORITE_HELPING_FREQUENCY_BONUS',
    'EXPERT_MODE_NON_FAVORITE_HELPING_FREQUENCY_PENALTY',
    'EXPERT_MODE_ADDITIONAL_FAVORITE_STRENGTH_EFFECT',
    'EVENT_BERRY_STRENGTH_MULTIPLIER',
    'EVENT_BERRY_OUTPUT_PER_HELP_BONUS',
    'AREA_OR_EXPERT_BONUS',
  ]),
  missing_is_zero:false,
  runtime_network_fetch:false,
});

function normalizeFavoriteContext(values){
  if(!Array.isArray(values))return {status:'FAVORITE_CONTEXT_MISSING',berries:[]};
  const berries=[...new Set(values.map(berryIdentity).filter(Boolean))];
  if(berries.length!==REQUIRED_WEEKLY_FAVORITE_BERRY_COUNT)return {status:'FAVORITE_CONTEXT_INCOMPLETE',berries};
  if(berries.some(berry=>!KNOWN_BERRIES.has(berry)))return {status:'FAVORITE_CONTEXT_UNKNOWN_BERRY',berries};
  return {status:'READY',berries};
}

export function resolveFavoriteBerryMultiplier({berry_name=null,weekly_favorite_berries=[]}={}){
  const berry=berryIdentity(berry_name);
  if(!berry)return freeze({
    status:'BERRY_IDENTITY_MISSING',berry_name:null,is_favorite:null,multiplier:null,
    contract_id:FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,contract_version:FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION,
  });
  if(!KNOWN_BERRIES.has(berry))return freeze({
    status:'UNKNOWN_BERRY',berry_name:berry,is_favorite:null,multiplier:null,
    contract_id:FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,contract_version:FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION,
  });
  const context=normalizeFavoriteContext(weekly_favorite_berries);
  if(context.status!=='READY')return freeze({
    status:context.status,berry_name:berry,is_favorite:null,multiplier:null,
    contract_id:FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,contract_version:FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION,
  });
  const isFavorite=context.berries.includes(berry);
  return freeze({
    status:'ACTIVE_VERIFIED',berry_name:berry,is_favorite:isFavorite,
    multiplier:isFavorite?FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER:NON_FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER,
    contract_id:FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,contract_version:FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION,
  });
}

export function resolveFavoriteBerryMultiplierFromMatch(match){
  if(match!==true&&match!==false)return freeze({
    status:'FAVORITE_MATCH_MISSING',is_favorite:null,multiplier:null,
    contract_id:FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,contract_version:FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION,
  });
  return freeze({
    status:'ACTIVE_VERIFIED',is_favorite:match,
    multiplier:match?FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER:NON_FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER,
    contract_id:FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,contract_version:FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION,
  });
}
