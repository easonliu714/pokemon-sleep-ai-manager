import {executeAiReviewQueue} from './ai-review-queue-executor.js';
import {createArchiveImageResolver} from './ai-review-image-resolver.js';
import {saveEncryptedProjectPool} from './ai-key-vault.js';

const SESSION_KEY='pokemon-sleep:ai-project-pool/session';
const CONTROLLER_SCHEMA='pokemon-sleep-ai-review-executor-controller/1.1-model-status';
const MODEL_STATUS_EVENTS=new Set(['ai_model_candidate_started','ai_model_candidate_failed','ai_model_timeout_project_state_released','ai_model_failover','ai_model_fallback_promoted']);

function persistPool(data){sessionStorage.setItem(SESSION_KEY,JSON.stringify(data));if(data?.persistent)return saveEncryptedProjectPool(data);return Promise.resolve();}
export function sanitizeModelStatusTrace(event,details={}){
  if(!MODEL_STATUS_EVENTS.has(event))return null;
  const d=details||{};
  return {
    event,
    model:d.model||null,
    from_model:d.from_model||null,
    to_model:d.to_model||null,
    candidate_number:Number(d.candidate_number)||null,
    candidate_count:Number(d.candidate_count)||null,
    error_class:d.error_class||null,
    remaining_ms:Number(d.remaining_ms)||null,
    candidate_budget_ms:Number(d.candidate_budget_ms)||null,
    completed_at:d.completed_at||null,
  };
}
export function createAiReviewExecutorController({target=globalThis}={}){
  let source=null,running=false,lastResult=null;
  const onSource=event=>{source=event?.detail||null;};
  const trace=(event,details)=>{
    target.DebugTrace?.record?.('ai_executor',event,{status:event.endsWith('failed')?'failed':'completed',details});
    const modelStatus=sanitizeModelStatusTrace(event,details);
    if(modelStatus)target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-review-model-status',{detail:modelStatus}));
  };
  const onQueue=async event=>{
    if(running)return;const queue=event?.detail?.queue;const poolData=target.PokemonSleepAiProjectPool;const archive=source?.archives?.[0],inventory=source?.inventory;
    if(!queue?.items?.length||!archive||!inventory){trace('ai_executor_blocked',{reason:'queue_or_source_missing',selected_count:queue?.selected_count||0});return;}
    if(!poolData?.projects?.length){trace('ai_executor_blocked',{reason:'project_pool_missing',selected_count:queue.selected_count});target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-review-executor-blocked',{detail:{reason:'project_pool_missing'}}));return;}
    running=true;target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-review-executor-started',{detail:{selected_count:queue.selected_count,model:poolData.model}}));
    try{lastResult=await executeAiReviewQueue({queue,archive,inventory,poolData,resolveImage:createArchiveImageResolver(archive),onProgress:progress=>target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-review-executor-progress',{detail:progress})),onTrace:(name,details)=>trace(name,details)});const updated={...poolData,projects:lastResult.projects};target.PokemonSleepAiProjectPool=updated;await persistPool(updated);target.dispatchEvent?.(new CustomEvent(lastResult.status==='completed'?'pokemon-sleep:ai-review-executor-completed':'pokemon-sleep:ai-review-executor-paused',{detail:lastResult}));trace(lastResult.status==='completed'?'ai_executor_completed':'ai_executor_paused',{completed:lastResult.completed,total:lastResult.total,reason:lastResult.reason||null});}
    catch(error){lastResult={schema:CONTROLLER_SCHEMA,status:'failed',message:error?.message||String(error)};trace('ai_executor_failed',{error_class:error?.failure?.class||'unexpected',message:lastResult.message});target.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-review-executor-failed',{detail:lastResult}));}
    finally{running=false;}
  };
  target.addEventListener?.('pokemon-sleep:identity-import-files-selected',onSource);target.addEventListener?.('pokemon-sleep:ai-review-queue-consented',onQueue);
  return {schema:CONTROLLER_SCHEMA,get running(){return running;},get lastResult(){return lastResult;},dispose(){target.removeEventListener?.('pokemon-sleep:identity-import-files-selected',onSource);target.removeEventListener?.('pokemon-sleep:ai-review-queue-consented',onQueue);source=null;}};
}
if(typeof window!=='undefined'&&!globalThis.PokemonSleepAiReviewExecutorController)globalThis.PokemonSleepAiReviewExecutorController=createAiReviewExecutorController();
export {CONTROLLER_SCHEMA};