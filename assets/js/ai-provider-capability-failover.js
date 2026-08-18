import {GEMINI_IMAGE_TOTAL_TIMEOUT_MS,classifyGeminiFailure,executeWithProjectPool,fetchWithTimeout,markProjectFailure,normalizeProjectPool} from './ai-project-pool-runtime.js';

const MODELS_ENDPOINT='https://generativelanguage.googleapis.com/v1beta/models?key=';
const CAPABILITY_TTL_MS=10*60*1000;
export const CAPABILITY_PREFLIGHT_TIMEOUT_MS=15000;
export const MODEL_CANDIDATE_TIMEOUT_MS=45000;
const capabilityCache=new Map();
const clean=value=>String(value??'').trim();
const nowIso=()=>new Date().toISOString();

function normalizeModelName(value){return clean(value).replace(/^models\//,'');}
function capabilityKey(project){return clean(project?.fingerprint)||clean(project?.alias)||null;}
function mergeProjectState(base=[],patch=[]){const byAlias=new Map(patch.map(row=>[row.alias,row]));return normalizeProjectPool(base).map(row=>byAlias.get(row.alias)||row);}
export function releaseModelTimeoutState(projects=[]){return normalizeProjectPool(projects).map(project=>project.last_error_class==='provider_timeout'?{...project,cooldown_until:null,last_error_class:null}:project);}
function modelScore(model,preferred){
  if(model===preferred)return 0;
  const stable=!/(?:preview|experimental|exp\b)/i.test(model);
  if(/gemini/i.test(model)&&/flash/i.test(model)&&stable)return 10;
  if(/gemini/i.test(model)&&/flash/i.test(model))return 20;
  if(/gemini/i.test(model)&&stable)return 30;
  if(/gemini/i.test(model))return 40;
  return 100;
}

export function rankGenerateContentModels(models=[],preferredModel=null){
  const preferred=normalizeModelName(preferredModel);
  const unique=[...new Set((Array.isArray(models)?models:[]).map(normalizeModelName).filter(Boolean))].filter(model=>/gemini/i.test(model));
  return unique.sort((a,b)=>modelScore(a,preferred)-modelScore(b,preferred)||a.localeCompare(b));
}

export function clearGeminiCapabilityCache(){capabilityCache.clear();}

export async function fetchGeminiProjectCapabilities(project,{fetchImpl=fetch,now=Date.now(),force=false,timeoutMs=CAPABILITY_PREFLIGHT_TIMEOUT_MS}={}){
  const key=capabilityKey(project),cached=key?capabilityCache.get(key):null;
  if(!force&&cached&&now-cached.cached_at_ms<CAPABILITY_TTL_MS)return {...cached,cache_hit:true};
  let response;
  try{response=await fetchWithTimeout(fetchImpl,`${MODELS_ENDPOINT}${encodeURIComponent(project.key)}`,{cache:'no-store'},timeoutMs);}catch(error){
    const failure=classifyGeminiFailure({status:0,message:error?.message||String(error),name:error?.name||''});
    const wrapped=new Error(failure.class==='provider_timeout'?`Gemini 模型能力檢查超過 ${Math.ceil(Number(timeoutMs||0)/1000)} 秒。`:(error?.message||String(error)));wrapped.failure=failure;wrapped.status=0;wrapped.original_name=error?.name||'Error';throw wrapped;
  }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const failure=classifyGeminiFailure({status:response.status,payload,message:payload?.error?.message||'',retryAfter:response.headers?.get?.('retry-after')||null});
    const error=new Error(payload?.error?.message||`Gemini models HTTP ${response.status}`);error.failure=failure;error.status=response.status;error.statusText=response.statusText||null;throw error;
  }
  const models=[...new Set((payload.models||[]).filter(model=>(model.supportedGenerationMethods||[]).includes('generateContent')).map(model=>normalizeModelName(model.name)).filter(Boolean))];
  const record={models,checked_at:nowIso(),cached_at_ms:now,cache_hit:false};if(key)capabilityCache.set(key,record);return record;
}

function failureSummary(error,project){return {error_class:error?.failure?.class||'capability_preflight_failed',transport_kind:error?.failure?.transport_kind||null,http_status:Number.isFinite(Number(error?.status))?Number(error.status):null,retryable:Boolean(error?.failure?.retryable),alias:project.alias,fingerprint:project.fingerprint,model:null,error_message:clean(error?.message).slice(0,500)||null,completed_at:nowIso()};}
function isModelSpecificFailure(outcome){const cls=outcome?.failure?.error_class||outcome?.reason||'';if(cls==='model_unavailable')return true;if(cls!=='request_rejected')return false;return /model|response.?json.?schema|response schema|thinking|generation.?config|not supported|unsupported/i.test(String(outcome?.failure?.error_message||''));}
function totalTimeoutOutcome({state,attempts,preflight,started,totalMs,preferred}){return {ok:false,paused:true,projects:state,attempts,reason:'provider_total_timeout',failure:{error_class:'provider_total_timeout',error_message:`AI 圖片分析超過 ${Math.ceil(totalMs/1000)} 秒，已停止等待。`,elapsed_ms:Date.now()-started},preferred_model:preferred||null,preflight};}
function publishSuccessfulModelFallback(detail){try{if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-model-fallback-success',{detail}));}catch{}}

export async function executeWithCapabilityFailover({projects,preferredModel,prompt,imageBase64,mimeType='image/png',images=null,responseJsonSchema=null,thinkingLevel=null,fetchImpl=fetch,onTrace=()=>{},retryDelaysMs,maxProjectFailovers=null,capabilityTimeoutMs=CAPABILITY_PREFLIGHT_TIMEOUT_MS,requestTimeoutMs,totalTimeoutMs=GEMINI_IMAGE_TOTAL_TIMEOUT_MS,modelCandidateTimeoutMs=MODEL_CANDIDATE_TIMEOUT_MS,onModelFallbackSuccess=publishSuccessfulModelFallback}={}){
  const executionStarted=Date.now(),totalMs=Math.max(1,Number(totalTimeoutMs)||GEMINI_IMAGE_TOTAL_TIMEOUT_MS),candidateLimitMs=Math.max(1,Number(modelCandidateTimeoutMs)||MODEL_CANDIDATE_TIMEOUT_MS);
  let state=normalizeProjectPool(projects),catalogs=new Map(),unknownAliases=new Set(),preflight=[];
  const enabledAtStart=state.filter(row=>row.enabled);
  const checks=await Promise.all(enabledAtStart.map(async project=>{
    try{return {project,capability:await fetchGeminiProjectCapabilities(project,{fetchImpl,timeoutMs:Math.min(capabilityTimeoutMs,totalMs)})};}
    catch(error){return {project,error};}
  }));
  for(const check of checks){
    const project=check.project;
    if(check.capability){
      const capability=check.capability;catalogs.set(project.alias,new Set(capability.models));
      const record={alias:project.alias,fingerprint:project.fingerprint,status:'READY',model_count:capability.models.length,cache_hit:Boolean(capability.cache_hit),checked_at:capability.checked_at};preflight.push(record);onTrace(capability.cache_hit?'ai_project_capability_cache_hit':'ai_project_capability_ready',record);
    }else{
      const error=check.error;const failure=error?.failure||classifyGeminiFailure({status:error?.status,message:error?.message,name:error?.name});const record={...failureSummary(error,project),status:'FAILED'};preflight.push(record);
      if(failure.disable_project){state=state.map(row=>row.alias===project.alias?markProjectFailure(row,failure,{applyCooldown:false}):row);onTrace('ai_project_preflight_key_rejected',record);}
      else{unknownAliases.add(project.alias);onTrace(failure.class==='provider_timeout'?'ai_project_preflight_timeout':'ai_project_preflight_failed',record);}
    }
  }
  const preferred=normalizeModelName(preferredModel);
  if(Date.now()-executionStarted>=totalMs)return totalTimeoutOutcome({state,attempts:[...preflight],preflight,started:executionStarted,totalMs,preferred});
  const enabled=state.filter(row=>row.enabled);if(!enabled.length)return {ok:false,paused:true,projects:state,attempts:preflight,reason:'all_projects_unavailable',failure:preflight.at(-1)||null,preflight};
  const knownModels=[...catalogs.values()].flatMap(set=>[...set]);const preferredSupported=preferred&&[...catalogs.values()].some(set=>set.has(preferred));const anyCatalog=catalogs.size>0;
  const candidates=[];
  if(preferred&&(!anyCatalog||preferredSupported||unknownAliases.size))candidates.push(preferred);
  if(preferred&&anyCatalog&&!preferredSupported&&!unknownAliases.size)onTrace('ai_model_preflight_skipped',{model:preferred,reason:'MODEL_NOT_LISTED_BY_ANY_VALID_PROJECT'});
  for(const model of rankGenerateContentModels(knownModels,preferred))if(!candidates.includes(model))candidates.push(model);
  if(!candidates.length)return {ok:false,paused:true,projects:state,attempts:preflight,reason:'model_unavailable',failure:{error_class:'model_unavailable',error_message:'No generateContent Gemini model is available for the validated project pool.'},preflight};

  const attempts=[...preflight];let last=null;
  for(let index=0;index<candidates.length;index++){
    const remaining=totalMs-(Date.now()-executionStarted);if(remaining<=0)return totalTimeoutOutcome({state,attempts,preflight,started:executionStarted,totalMs,preferred});
    const model=candidates[index],candidateBudget=Math.min(remaining,candidateLimitMs);const compatible=state.filter(project=>project.enabled&&(unknownAliases.has(project.alias)||catalogs.get(project.alias)?.has(model)||!anyCatalog));if(!compatible.length)continue;
    const candidateThinking=/^gemini-3(?:[.-]|$)/i.test(model)?thinkingLevel:null;onTrace('ai_model_candidate_started',{model,candidate_number:index+1,candidate_count:candidates.length,compatible_project_count:compatible.length,preferred_model:preferred||null,remaining_ms:remaining,candidate_budget_ms:candidateBudget});
    const outcome=await executeWithProjectPool({projects:compatible,model,prompt,imageBase64,mimeType,images,responseJsonSchema,thinkingLevel:candidateThinking,fetchImpl,onTrace,retryDelaysMs,maxProjectFailovers:maxProjectFailovers==null?Math.max(0,compatible.length-1):maxProjectFailovers,requestTimeoutMs:Math.min(Number(requestTimeoutMs)||candidateBudget,candidateBudget),totalTimeoutMs:candidateBudget});
    state=mergeProjectState(state,outcome.projects||[]);attempts.push(...(outcome.attempts||[]));
    if(outcome.ok){
      const fallbackUsed=Boolean(preferred&&model!==preferred),result={...outcome,projects:state,attempts,used_model:model,used_thinking_level:candidateThinking,preferred_model:preferred||null,model_fallback_used:fallbackUsed,preflight};
      if(fallbackUsed){const detail={from_model:preferred,to_model:model,used_alias:outcome.used_alias||null,completed_at:nowIso()};try{onModelFallbackSuccess?.(detail);}catch{}onTrace('ai_model_fallback_promoted',detail);}
      return result;
    }
    last=outcome;const failureClass=outcome?.failure?.error_class||outcome?.reason||null;onTrace('ai_model_candidate_failed',{model,error_class:failureClass,candidate_budget_ms:candidateBudget});
    if(Date.now()-executionStarted>=totalMs)return totalTimeoutOutcome({state,attempts,preflight,started:executionStarted,totalMs,preferred});
    if(!isModelSpecificFailure(outcome)&&!['provider_timeout','provider_total_timeout','request_aborted'].includes(failureClass))return {...outcome,projects:state,attempts,preferred_model:preferred||null,preflight};
    const next=candidates[index+1];
    if(next&&['provider_timeout','provider_total_timeout'].includes(failureClass)){state=releaseModelTimeoutState(state);onTrace('ai_model_timeout_project_state_released',{from_model:model,to_model:next});}
    if(next)onTrace('ai_model_failover',{from_model:model,to_model:next,error_class:failureClass});
  }
  return {...(last||{}),ok:false,paused:true,projects:state,attempts,reason:last?.reason||'model_unavailable',failure:last?.failure||{error_class:'model_unavailable'},preferred_model:preferred||null,preflight};
}

export const AI_PROVIDER_CAPABILITY_FAILOVER_VERSION='pokemon-sleep-ai-provider-capability-failover/1.3-v042711';