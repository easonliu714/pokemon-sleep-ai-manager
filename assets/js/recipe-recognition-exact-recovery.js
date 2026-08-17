import {PUBLIC_RECIPE_MASTER} from './public-recipe-current-authority.js';
import {isRecipeAutomaticIdentityMatch} from './public-recipe-alias-master.js';

export const RECIPE_RECOGNITION_EXACT_RECOVERY_VERSION='recipe-recognition-exact-recovery-2026-08-17-b-prompt';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();

export function buildExactRecipeRecognitionPromptInstruction(){
  return `\n\n料理名稱精確比對補充規則：\n- 若料理卡片的完整料理名稱可以讀清楚，而且 observed_text 與唯一一筆 Public Master recipe_name 或核准 legacy alias 逐字一致，即使卡片下緣、食材列或部分 UI 被遮住，也必須 status=MATCHED；遮住的是其他欄位，不會讓已完整讀到的料理名稱失去 identity。\n- UI 遮蔽只影響被遮住欄位是否可以輸出以及 confidence，不可用 PARTIALLY_OCCLUDED_BY_UI 把一個完整且唯一 exact-name match 改成 UNMATCHED。\n- 只有料理名稱本身看不清、不是 exact/approved-alias、或存在多個合理候選時，才使用 AMBIGUOUS/UNMATCHED。`;
}

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
