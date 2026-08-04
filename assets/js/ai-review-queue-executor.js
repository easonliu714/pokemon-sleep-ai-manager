import {executeWithProjectPool,hashCacheKey,readAiResultCache,writeAiResultCache} from './ai-project-pool-runtime.js';

const EXECUTOR_SCHEMA='pokemon-sleep-ai-review-executor/1.2';
const PROMPT_VERSION='pokemon-sleep-image-review/1.2';
const DEFAULT_PROMPT=`分析這張 Pokémon Sleep 遊戲截圖。只輸出單一 JSON 物件，不要 Markdown，不要補猜畫面中不存在的值。

完整欄位：
{
  "screen_type": null,
  "pokemon_name": null,
  "nickname": null,
  "level": null,
  "sp": null,
  "specialty": null,
  "type": null,
  "main_skill": {"name": null, "level": null, "description": null},
  "sub_skills": [{"level": 10, "name": null, "unlocked": false}],
  "nature": {"name": null, "up": null, "down": null},
  "ingredients": [{"level": 1, "name": null, "count": null}],
  "helper_seconds": null,
  "carry_limit": null,
  "favorite_berry": null,
  "sleep_hours": null,
  "sleep_time_text": null,
  "evolution_requirements": {
    "level_required": null,
    "sleep_hours_required": null,
    "candy_required": null,
    "item_required": null,
    "other": null
  },
  "obtained_at": null,
  "is_favorite": null,
  "confidence": null,
  "uncertain_fields": [],
  "field_evidence": {}
}

規則：
1. 畫面沒有顯示的欄位一律使用 null 或空陣列，不可由遊戲常識猜補。
2. 共眠時間必須同時保留可解析數值 sleep_hours 與原畫面 sleep_time_text；例如「2756 小時 30 分」可轉為 2756.5。
3. 食材層級固定優先辨識 Lv1、Lv30、Lv60；副技能層級固定優先辨識 Lv10、Lv25、Lv50、Lv70、Lv80。
4. nature 必須是物件，禁止輸出 [object Object] 可造成的未結構化值。
5. field_evidence 以欄位名稱對應畫面短文字，供人工覆核；不要放圖片或敏感資訊。
6. 同一張畫面可能只提供部分欄位，保留 partial observation。`;
const itemId=item=>String(item?.sha256||item?.source_image_ref||item?.path||'');
const itemPath=item=>String(item?.path||item?.source_image_ref||'');
function extractJson(payload){const text=payload?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('\n')||'';const cleaned=text.replace(/^```json\s*/i,'').replace(/```$/,'').trim();try{return JSON.parse(cleaned);}catch{return {raw_text:cleaned,parse_failed:true};}}

export async function executeAiReviewQueue({queue,inventory,poolData,resolveImage,prompt=DEFAULT_PROMPT,bypassCache=false,onProgress=()=>{},onTrace=()=>{}}={}){
  if(!queue?.items?.length)throw new Error('ai_review_queue_empty');
  if(typeof resolveImage!=='function')throw new Error('ai_review_image_resolver_missing');
  if(!poolData?.projects?.length)throw new Error('ai_project_pool_missing');
  const results=[];let projects=poolData.projects;
  for(let index=0;index<queue.items.length;index++){
    const queued=queue.items[index];const id=itemId(queued);const source=(inventory?.items||[]).find(item=>itemId(item)===id)||queued;const model=poolData.model||queue.model;const cacheKey=await hashCacheKey({sha256:source.sha256||id,model,promptVersion:PROMPT_VERSION});const cached=bypassCache?null:readAiResultCache(cacheKey);
    if(cached){results.push({...cached,cached:true});onProgress({current:index+1,total:queue.items.length,cached:true});continue;}
    const image=await resolveImage(source);
    const outcome=await executeWithProjectPool({projects,model,prompt,imageBase64:image.data,mimeType:image.mimeType,onTrace});projects=outcome.projects;
    if(!outcome.ok)return {schema:EXECUTOR_SCHEMA,status:'paused',completed:results.length,total:queue.items.length,results,projects,attempts:outcome.attempts,reason:outcome.reason,prompt_version:PROMPT_VERSION};
    const result={item_id:id,source_image_ref:itemPath(source),model,project_alias:outcome.used_alias,analysis:extractJson(outcome.payload),completed_at:new Date().toISOString(),prompt_version:PROMPT_VERSION,forced:Boolean(bypassCache)};writeAiResultCache(cacheKey,result);results.push(result);onProgress({current:index+1,total:queue.items.length,cached:false,project_alias:outcome.used_alias});
  }
  return {schema:EXECUTOR_SCHEMA,status:'completed',completed:results.length,total:queue.items.length,results,projects,prompt_version:PROMPT_VERSION,forced:Boolean(bypassCache)};
}

export {EXECUTOR_SCHEMA,DEFAULT_PROMPT,PROMPT_VERSION,extractJson};
