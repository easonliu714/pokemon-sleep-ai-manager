export const STRATEGY_ANALYSIS_PRIVACY_VERSION='strategy-analysis-privacy-2026-08-10-b';

const text=value=>String(value??'').normalize('NFKC').trim();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const POKEMON_IDENTITY_CONSTRAINTS=Object.freeze(['must_include_pokemon','exclude_pokemon','sleep_evolution_member_at_night']);
const FORBIDDEN_KEY_NORMALIZED=Object.freeze(new Set([
  'apikey','rawsqlite','rawscreenshot','rawocr','sourceimageref','sourceimagerefs','sourceimagerefsjson',
  'fieldevidencejson','identityfingerprint','pokemonid','pokemoninstanceid','privatenotes',
]));
const normalizeKey=key=>String(key??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');

function sanitizePokemonConstraintValue(value,{stableToRef,speciesNames}){
  const token=text(value);if(!token)return null;
  const mapped=stableToRef?.get?.(token);if(mapped)return mapped;
  if(speciesNames?.has?.(token))return `species:${token}`;
  return 'UNRESOLVED_LOCAL_REFERENCE';
}

export function sanitizeGoalProfileForExternal(goalProfile,{stableToRef=new Map(),candidates=[]}={}){
  if(!goalProfile)return null;
  const speciesNames=new Set((candidates||[]).map(row=>text(row?.species||row?.current_species)).filter(Boolean));
  const hard={...(goalProfile.hard_constraints||{})};
  for(const key of POKEMON_IDENTITY_CONSTRAINTS){
    const source=Array.isArray(hard[key])?hard[key]:[];
    hard[key]=[...new Set(source.map(value=>sanitizePokemonConstraintValue(value,{stableToRef,speciesNames})).filter(Boolean))].sort();
  }
  return stable({
    primary_goal:text(goalProfile.primary_goal)||null,
    secondary_goals:Array.isArray(goalProfile.secondary_goals)?[...goalProfile.secondary_goals]:[],
    weights:goalProfile.weights||{},
    hard_constraints:hard,
    profile_version:text(goalProfile.profile_version)||null,
  });
}

export function stablePokemonIdLeaks(serialized,resolver){
  const source=String(serialized??'');
  const leaks=[];
  for(const stableId of resolver?.stable_to_ref?.keys?.()||[]){
    const token=text(stableId);if(token&&source.includes(token))leaks.push(token);
  }
  return Object.freeze([...new Set(leaks)].sort());
}

export function assertNoStablePokemonIds(serialized,resolver,label='Strategy Analysis Pack'){
  const leaks=stablePokemonIdLeaks(serialized,resolver);
  if(leaks.length)throw new Error(`${label} privacy guard blocked ${leaks.length} stable Pokémon ID leak(s)`);
  return true;
}

export function forbiddenKeyPaths(value,{root='$'}={}){
  const found=[];
  const walk=(node,path)=>{
    if(Array.isArray(node)){node.forEach((item,index)=>walk(item,`${path}[${index}]`));return;}
    if(!node||typeof node!=='object')return;
    for(const [key,item] of Object.entries(node)){
      const child=`${path}.${key}`;
      if(FORBIDDEN_KEY_NORMALIZED.has(normalizeKey(key)))found.push(child);
      walk(item,child);
    }
  };
  walk(value,root);
  return Object.freeze([...new Set(found)].sort());
}

export function assertNoForbiddenKeyPaths(value,label='Strategy Analysis Pack'){
  const paths=forbiddenKeyPaths(value);
  if(paths.length)throw new Error(`${label} privacy guard blocked forbidden key path(s): ${paths.join(', ')}`);
  return true;
}

export function strategyAnalysisPrivacyManifest(){return Object.freeze({
  privacy_version:STRATEGY_ANALYSIS_PRIVACY_VERSION,
  api_key_in_pack:false,
  raw_sqlite_in_pack:false,
  raw_screenshot_in_pack:false,
  raw_ocr_in_pack:false,
  stable_pokemon_ids_in_pack:false,
  identity_fingerprint_in_pack:false,
  private_notes_in_pack:false,
  source_image_refs_in_pack:false,
  ephemeral_candidate_refs:true,
  structural_forbidden_key_guard:true,
});}
