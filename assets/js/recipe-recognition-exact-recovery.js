import {PUBLIC_RECIPE_MASTER} from './public-recipe-current-authority.js';
import {isRecipeAutomaticIdentityMatch} from './public-recipe-alias-master.js';

export const RECIPE_RECOGNITION_EXACT_RECOVERY_VERSION='recipe-recognition-exact-recovery-2026-08-17-a';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();

export function exactUnlockedRecipeRow(observation,rows=PUBLIC_RECIPE_MASTER){
  if(observation?.observed_data?.unlocked!==true)return null;
  const observed=clean(observation?.observed_text);
  if(!observed)return null;
  const matches=rows.filter(row=>isRecipeAutomaticIdentityMatch(observed,row));
  return matches.length===1?matches[0]:null;
}

export function recoverExactUnlockedRecipeRecognition(payload,{rows=PUBLIC_RECIPE_MASTER}={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.scenario!=='recipe_status_update')return {payload,recovered_count:0,recovered_observation_ids:[]};
  const copy=clone(payload),recovered=[];
  for(const observation of Array.isArray(copy.observations)?copy.observations:[]){
    if(!observation||observation.status==='MATCHED'||observation.status==='IGNORE_CONFIRMED')continue;
    const row=exactUnlockedRecipeRow(observation,rows);
    if(!row)continue;
    const previousStatus=observation.status||'UNKNOWN',previousReason=clean(observation.reason);
    observation.status='MATCHED';
    observation.canonical_key={recipe_id:String(row.recipe_id),recipe_name:String(row.recipe_name)};
    observation.canonical_name=String(row.recipe_name);
    observation.candidate_names=[String(row.recipe_name)];
    observation.reason=`PLATFORM_EXACT_UNLOCKED_RECIPE_RECOVERY:${previousStatus}${previousReason?`:${previousReason}`:''}`;
    recovered.push(String(observation.observation_id||''));
  }
  return {payload:copy,recovered_count:recovered.length,recovered_observation_ids:recovered.filter(Boolean)};
}
