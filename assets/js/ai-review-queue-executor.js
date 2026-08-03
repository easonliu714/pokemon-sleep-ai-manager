import {executeWithProjectPool,hashCacheKey,readAiResultCache,writeAiResultCache} from './ai-project-pool-runtime.js';

const EXECUTOR_SCHEMA='pokemon-sleep-ai-review-executor/1.1';
const PROMPT_VERSION='pokemon-sleep-image-review/1.1';
const DEFAULT_PROMPT='分析這張 Pokémon Sleep 截圖。只輸出 JSON，包含 screen_type、pokemon_name、level、sp、main_skill、sub_skills、nature、ingredients、confidence、uncertain_fields。無法確認的欄位使用 null，不要猜測。';
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
