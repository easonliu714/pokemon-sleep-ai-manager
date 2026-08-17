export const PUBLIC_CAMP_BERRY_VERSION='public-camp-berry-2026-08-17-b-canonical-grape';

const source=(source_name,source_ref)=>Object.freeze({
  source_type:'verified_public_reference',source_name,source_ref,verified_at:'2026-08-17',data_version:PUBLIC_CAMP_BERRY_VERSION,
});
const FIXED=source('Serebii Pokémon Sleep research-area reference','research-area-favourite-berry-verified-2026-08-17');
const OFFICIAL_EX=source('Pokémon Sleep official','official-ex-mode-and-cyan-beach-ex-2026-08-10');
const GENERAL=source('Pokémon Sleep game/public reference','greengrass-weekly-random-favourite-berries');

// Legacy typo compatibility only. Canonical zh-TW authority is 「萄葡果」.
// Never emit 「葡萄果」 as a canonical berry name; old player/week observations are
// normalized at the projection boundary instead of rewriting unrelated history.
export const PUBLIC_BERRY_NAME_ALIASES=Object.freeze({'葡萄果':'萄葡果'});
export function canonicalBerryName(value){
  const key=String(value??'').normalize('NFKC').trim();
  return PUBLIC_BERRY_NAME_ALIASES[key]||key;
}

export const PUBLIC_CAMP_BERRY_MASTER=Object.freeze([
  Object.freeze({camp_name:'萌綠之島',berry_policy:'WEEKLY_RANDOM_3',favorite_berries:Object.freeze([]),main_berry_pool:Object.freeze([]),sub_berry_pool_policy:null,...GENERAL}),
  Object.freeze({camp_name:'天青沙灘',berry_policy:'FIXED_3',favorite_berries:Object.freeze(['橙橙果','桃桃果','椰木果']),main_berry_pool:Object.freeze([]),sub_berry_pool_policy:null,...FIXED}),
  Object.freeze({camp_name:'灰褐洞窟',berry_policy:'FIXED_3',favorite_berries:Object.freeze(['蘋野果','勿花果','文柚果']),main_berry_pool:Object.freeze([]),sub_berry_pool_policy:null,...FIXED}),
  Object.freeze({camp_name:'白花雪原',berry_policy:'FIXED_3',favorite_berries:Object.freeze(['莓莓果','柿仔果','異奇果']),main_berry_pool:Object.freeze([]),sub_berry_pool_policy:null,...FIXED}),
  Object.freeze({camp_name:'寶藍湖畔',berry_policy:'FIXED_3',favorite_berries:Object.freeze(['金枕果','櫻子果','芒芒果']),main_berry_pool:Object.freeze([]),sub_berry_pool_policy:null,...FIXED}),
  Object.freeze({camp_name:'黃金舊發電廠',berry_policy:'FIXED_3',favorite_berries:Object.freeze(['萄葡果','墨莓果','靛莓果']),main_berry_pool:Object.freeze([]),sub_berry_pool_policy:null,...FIXED}),
  Object.freeze({camp_name:'琥褐溪谷',berry_policy:'FIXED_3',favorite_berries:Object.freeze(['零餘果','木子果','番荔果']),main_berry_pool:Object.freeze([]),sub_berry_pool_policy:null,...FIXED}),
  Object.freeze({camp_name:'萌綠之島EX',berry_policy:'EX_DYNAMIC',favorite_berries:Object.freeze([]),main_berry_pool:Object.freeze([]),sub_berry_pool_policy:'TWO_RANDOM_NON_MAIN_BERRIES',...OFFICIAL_EX}),
  Object.freeze({camp_name:'天青沙灘EX',berry_policy:'EX_DYNAMIC',favorite_berries:Object.freeze([]),main_berry_pool:Object.freeze(['桃桃果','椰木果','橙橙果']),sub_berry_pool_policy:'TWO_RANDOM_FROM_REMAINING_17',...OFFICIAL_EX}),
]);

export function campBerryAuthority(campName){
  const key=String(campName??'').normalize('NFKC').trim();
  return PUBLIC_CAMP_BERRY_MASTER.find(row=>row.camp_name===key)||null;
}

export function resolveCampFavoriteBerries(campName,observed=[]){
  const authority=campBerryAuthority(campName);
  const clean=[...new Set((Array.isArray(observed)?observed:[]).map(canonicalBerryName).filter(Boolean))].slice(0,3);
  if(authority?.berry_policy==='FIXED_3')return Object.freeze({policy:'FIXED_3',berries:Object.freeze([...authority.favorite_berries]),locked:true,source:'PUBLIC_CAMP_MASTER'});
  if(authority?.berry_policy==='WEEKLY_RANDOM_3')return Object.freeze({policy:'WEEKLY_RANDOM_3',berries:Object.freeze(clean),locked:false,source:clean.length?'PLAYER_WEEK_OBSERVATION':'MISSING_PLAYER_WEEK_OBSERVATION'});
  if(authority?.berry_policy==='EX_DYNAMIC')return Object.freeze({policy:'EX_DYNAMIC',berries:Object.freeze(clean),locked:false,source:clean.length?'PLAYER_WEEK_OBSERVATION':'MISSING_PLAYER_WEEK_OBSERVATION'});
  return Object.freeze({policy:'UNKNOWN',berries:Object.freeze(clean),locked:false,source:clean.length?'PLAYER_WEEK_OBSERVATION':'UNKNOWN_CAMP'});
}
