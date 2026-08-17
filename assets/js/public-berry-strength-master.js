import {PUBLIC_BERRY_TYPES} from './shared-master-data.js';

export const PUBLIC_BERRY_STRENGTH_VERSION='public-berry-strength-2026-08-17-b-canonical-grepa';
export const BERRY_STRENGTH_MIN_LEVEL=1;
export const BERRY_STRENGTH_MAX_LEVEL=70;
export const BERRY_STRENGTH_FORMULA_VERSION='berry-strength-max-linear-exp-1.025-round-v1';

const SOURCE=Object.freeze({
  source_type:'verified_public_reference',
  source_name:'Pokémon Sleep 攻略・検証 Wiki berry base energy/formula; official v3.6.0 level-cap confirmation',
  source_ref:'pokemon-sleep-berry-base-energy-formula-verified-2026-08-13',
  verified_at:'2026-08-17',
  data_version:PUBLIC_BERRY_STRENGTH_VERSION,
});

const BASE_ROWS=Object.freeze([
  ['一般','柿仔果','Persim Berry',28],['火','蘋野果','Leppa Berry',27],['水','橙橙果','Oran Berry',31],['電','萄葡果','Grepa Berry',25],
  ['草','金枕果','Durin Berry',30],['冰','莓莓果','Rawst Berry',32],['格鬥','櫻子果','Cheri Berry',27],['毒','零餘果','Chesto Berry',32],
  ['地面','勿花果','Figy Berry',29],['飛行','椰木果','Pamtre Berry',24],['超能力','芒芒果','Mago Berry',26],['蟲','木子果','Lum Berry',24],
  ['岩石','文柚果','Sitrus Berry',30],['幽靈','墨莓果','Bluk Berry',26],['龍','番荔果','Yache Berry',35],['惡','異奇果','Wiki Berry',31],
  ['鋼','靛莓果','Belue Berry',33],['妖精','桃桃果','Pecha Berry',26],
]);

export const PUBLIC_BERRY_STRENGTH_MASTER=Object.freeze(BASE_ROWS.map(([type_name,berry_name,reference_name,base_strength])=>Object.freeze({
  type_name,berry_name,reference_name,base_strength,min_level:BERRY_STRENGTH_MIN_LEVEL,max_level:BERRY_STRENGTH_MAX_LEVEL,
  formula_version:BERRY_STRENGTH_FORMULA_VERSION,...SOURCE,
})));

const text=value=>String(value??'').normalize('NFKC').trim();
const BERRY_ALIASES=Object.freeze({'葡萄果':'萄葡果'});
const canonicalBerry=value=>BERRY_ALIASES[text(value)]||text(value);
const BY_BERRY=new Map(PUBLIC_BERRY_STRENGTH_MASTER.map(row=>[row.berry_name,row]));
const BY_TYPE=new Map(PUBLIC_BERRY_TYPES.map(row=>[text(row.type_name),text(row.berry_name)]).filter(([type,berry])=>type&&berry));

function validLevel(value){
  const level=Number(value);
  return Number.isInteger(level)&&level>=BERRY_STRENGTH_MIN_LEVEL&&level<=BERRY_STRENGTH_MAX_LEVEL?level:null;
}

export function berryStrengthAuthority(berryName){return BY_BERRY.get(canonicalBerry(berryName))||null;}
export function berryNameForType(typeName){return BY_TYPE.get(text(typeName))||null;}

export function berryStrengthAtLevel(berryName,levelValue){
  const authority=berryStrengthAuthority(berryName),level=validLevel(levelValue);
  if(!authority||level===null)return null;
  const linear=authority.base_strength+(level-1);
  const exponential=Math.round(authority.base_strength*Math.pow(1.025,level-1));
  return Math.max(linear,exponential);
}

export function resolveBerryStrength(berryName,levelValue){
  const berry_name=canonicalBerry(berryName),authority=berryStrengthAuthority(berry_name),level=validLevel(levelValue);
  if(!authority)return Object.freeze({status:'UNKNOWN_BERRY',berry_name:berry_name||null,level:null,strength:null,rule_version:BERRY_STRENGTH_FORMULA_VERSION});
  if(level===null)return Object.freeze({status:'LEVEL_OUT_OF_VERIFIED_RANGE',berry_name:authority.berry_name,level:Number.isFinite(Number(levelValue))?Number(levelValue):null,strength:null,min_level:BERRY_STRENGTH_MIN_LEVEL,max_level:BERRY_STRENGTH_MAX_LEVEL,rule_version:BERRY_STRENGTH_FORMULA_VERSION});
  return Object.freeze({status:'ACTIVE_VERIFIED',berry_name:authority.berry_name,type_name:authority.type_name,level,base_strength:authority.base_strength,strength:berryStrengthAtLevel(authority.berry_name,level),rule_version:BERRY_STRENGTH_FORMULA_VERSION,data_version:PUBLIC_BERRY_STRENGTH_VERSION,source_ref:authority.source_ref});
}

export function resolveBerryStrengthForTypeAtLevel(typeName,levelValue){
  const type_name=text(typeName),berry_name=berryNameForType(type_name);
  if(!berry_name)return Object.freeze({status:'UNKNOWN_TYPE',type_name:type_name||null,berry_name:null,level:null,strength:null,rule_version:BERRY_STRENGTH_FORMULA_VERSION});
  return Object.freeze({...resolveBerryStrength(berry_name,levelValue),type_name});
}