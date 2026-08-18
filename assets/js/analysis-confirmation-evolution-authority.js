export const V04278_EVOLUTION_REQUIREMENT_MASTER_VERSION='pokemon-evolution-requirement-2026-08-18-a';

// Direct game-UI requirement evidence is stored only as a public structured fact.
// No player screenshot, Pokémon instance data, filename, or private identifier is committed.
// The current evidence proves the requirement shown for 小鍛匠, but the target name
// is hidden as ??? in that screen, so this hotfix deliberately does not invent a route.
export const V04278_EVOLUTION_REQUIREMENT_MASTER=Object.freeze([
  Object.freeze({
    species_name:'小鍛匠',
    required_level:18,
    required_sleep_hours:null,
    required_candy:40,
    required_item:null,
    other_requirement:null,
    verification_status:'DIRECT_GAME_UI_REQUIREMENT_VERIFIED_TARGET_PENDING',
    source_type:'direct_game_ui_verified',
    source_name:'Pokémon Sleep in-game evolution requirement screen',
    source_ref:'DIRECT_GAME_UI_2026-08-18_TINKATINK_REQUIREMENT',
    verified_at:'2026-08-18',
    data_version:V04278_EVOLUTION_REQUIREMENT_MASTER_VERSION,
  }),
]);

const FIELD_MAP=Object.freeze([
  ['evolution_level_required','required_level'],
  ['evolution_sleep_hours_required','required_sleep_hours'],
  ['evolution_candy_required','required_candy'],
  ['evolution_item_required','required_item'],
  ['evolution_other_requirement','other_requirement'],
]);
const meaningful=value=>value!==null&&value!==undefined&&value!=='';
const comparable=value=>typeof value==='number'?String(value):String(value??'').trim();

function requirementHotfix(species){return V04278_EVOLUTION_REQUIREMENT_MASTER.find(row=>row.species_name===String(species||'').trim())||null;}
function safeRows(queryRows,sql,params){try{return typeof queryRows==='function'?(queryRows(sql,params)||[]):[];}catch{return [];}}
function routeRequirements(route){return Object.fromEntries(FIELD_MAP.map(([draftField,masterField])=>[draftField,route?.[masterField]??null]));}
function requirementConflicts(left,right){
  if(!left||!right)return [];
  return FIELD_MAP.flatMap(([draftField,masterField])=>meaningful(left?.[masterField])&&meaningful(right?.[masterField])&&comparable(left[masterField])!==comparable(right[masterField])?[{field:draftField,public_route_value:left[masterField],direct_requirement_value:right[masterField]}]:[]);
}

export function resolveEvolutionAuthority(species,queryRows){
  const normalized=String(species||'').trim();
  if(!normalized)return {status:'SPECIES_UNRESOLVED',species:null,requirements:{},conflicts:[]};
  const routes=safeRows(queryRows,'SELECT from_species,to_species,required_level,required_sleep_hours,required_candy,required_item,other_requirement,verification_status,source_type,source_name,source_ref,verified_at,data_version FROM pokemon_evolution_master WHERE from_species=? ORDER BY to_species',[normalized]);
  const terminal=safeRows(queryRows,'SELECT species_name,evolution_status,verification_status,source_type,source_name,source_ref,verified_at,data_version FROM pokemon_evolution_status_master WHERE species_name=?',[normalized])[0]||null;
  const direct=requirementHotfix(normalized);
  if(routes.length>1)return {status:'MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED',species:normalized,routes,terminal,direct_requirement:direct,requirements:{},conflicts:[]};
  if(routes.length===1){
    const route=routes[0],conflicts=requirementConflicts(route,direct);
    if(conflicts.length)return {status:'REVIEW_REQUIRED_PUBLIC_AUTHORITY_CONFLICT',species:normalized,routes,route,terminal,direct_requirement:direct,requirements:{},conflicts};
    const requirements=routeRequirements(route);
    if(direct)for(const [draftField,masterField] of FIELD_MAP)if(!meaningful(requirements[draftField])&&meaningful(direct[masterField]))requirements[draftField]=direct[masterField];
    return {status:direct?'PUBLIC_ROUTE_PLUS_DIRECT_REQUIREMENT_VERIFIED':'PUBLIC_ROUTE_VERIFIED',species:normalized,routes,route,terminal,direct_requirement:direct,requirements,conflicts:[]};
  }
  if(direct)return {status:'PUBLIC_REQUIREMENT_HOTFIX_VERIFIED_ROUTE_PENDING',species:normalized,routes:[],route:null,terminal,direct_requirement:direct,requirements:routeRequirements(direct),conflicts:[]};
  if(terminal?.evolution_status==='VERIFIED_TERMINAL_CURRENT_SLEEP')return {status:'VERIFIED_TERMINAL_CURRENT_SLEEP',species:normalized,routes:[],route:null,terminal,direct_requirement:null,requirements:{},conflicts:[]};
  return {status:'PUBLIC_MASTER_NOT_YET_VERIFIED',species:normalized,routes:[],route:null,terminal,direct_requirement:null,requirements:{},conflicts:[]};
}

export function hydrateEvolutionDraft(draft,authority){
  const next={...(draft||{}),field_evidence:{...(draft?.field_evidence||{})}};
  const baseStatus=authority?.status||'PUBLIC_MASTER_NOT_YET_VERIFIED';
  const blocked=['MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED','REVIEW_REQUIRED_PUBLIC_AUTHORITY_CONFLICT','SPECIES_UNRESOLVED'].includes(baseStatus);
  const observationConflicts=[];
  if(!blocked){
    for(const [field] of FIELD_MAP){
      const masterValue=authority?.requirements?.[field];if(!meaningful(masterValue))continue;
      if(!meaningful(next[field]))next[field]=masterValue;
      else if(comparable(next[field])!==comparable(masterValue))observationConflicts.push({field,observation_value:next[field],public_master_value:masterValue});
    }
  }
  let status=baseStatus;
  if(observationConflicts.length)status='REVIEW_REQUIRED_OBSERVATION_MASTER_CONFLICT';
  else if(!blocked&&FIELD_MAP.some(([field])=>meaningful(authority?.requirements?.[field])))status='MASTER_HYDRATED';
  next.evolution_authority={status,base_status:baseStatus,species:authority?.species||next.species||null,to_species:authority?.route?.to_species||null,verification_status:authority?.route?.verification_status||authority?.direct_requirement?.verification_status||authority?.terminal?.verification_status||null,data_version:authority?.route?.data_version||authority?.direct_requirement?.data_version||authority?.terminal?.data_version||null,conflicts:[...(authority?.conflicts||[]),...observationConflicts]};
  next.field_evidence.evolution_authority={...next.evolution_authority,source_type:authority?.route?.source_type||authority?.direct_requirement?.source_type||authority?.terminal?.source_type||null,source_name:authority?.route?.source_name||authority?.direct_requirement?.source_name||authority?.terminal?.source_name||null,source_ref:authority?.route?.source_ref||authority?.direct_requirement?.source_ref||authority?.terminal?.source_ref||null,verified_at:authority?.route?.verified_at||authority?.direct_requirement?.verified_at||authority?.terminal?.verified_at||null};
  return next;
}

export function evolutionAuthorityLabel(authority){
  const row=authority||{};
  if(row.status==='MASTER_HYDRATED'){
    if(row.base_status==='PUBLIC_REQUIREMENT_HOTFIX_VERIFIED_ROUTE_PENDING')return '公版進化條件已帶入；進化目標 Route 尚待核對。';
    return row.to_species?`公版進化 Master 已帶入（下一階段：${row.to_species}）。`:'公版進化 Master 已帶入。';
  }
  if(row.status==='REVIEW_REQUIRED_OBSERVATION_MASTER_CONFLICT')return '圖片／AI Observation 與公版進化條件衝突，需人工確認；系統未覆寫 Observation。';
  if(row.status==='MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED')return '此物種有多條公版進化 Route，系統不自動猜測條件。';
  if(row.status==='REVIEW_REQUIRED_PUBLIC_AUTHORITY_CONFLICT')return '公版進化 Evidence 彼此衝突，已停止自動帶入。';
  if(row.status==='VERIFIED_TERMINAL_CURRENT_SLEEP')return '公版目前確認為 Pokémon Sleep 最終進化型。';
  if(row.status==='SPECIES_UNRESOLVED')return '物種尚未確認，暫不查詢公版進化條件。';
  return '公版進化條件尚未收錄／待核對；系統不會自行猜測。';
}
