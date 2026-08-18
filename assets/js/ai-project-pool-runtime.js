const GENERATE_ENDPOINT=model=>`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
const CACHE_PREFIX='pokemon-sleep:ai-result-cache:';
const nowIso=()=>new Date().toISOString();
const clean=value=>String(value??'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const DEFAULT_TRANSIENT_RETRY_DELAYS_MS=Object.freeze([1200,3200]);
export const GEMINI_GENERATE_ATTEMPT_TIMEOUT_MS=60000;
export const GEMINI_IMAGE_TOTAL_TIMEOUT_MS=120000;

function finiteOrNull(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function clampMessage(value,max=1000){return clean(value).slice(0,max)||null;}
function monotonicNow(){return globalThis.performance?.now?.()??Date.now();}
function timeoutError(label,timeoutMs){const error=new Error(`${label}_TIMEOUT_${timeoutMs}MS`);error.name='TimeoutError';error.code='AI_PROVIDER_TIMEOUT';error.timeout_ms=timeoutMs;return error;}

export async function fetchWithTimeout(fetchImpl,url,options={},timeoutMs=GEMINI_GENERATE_ATTEMPT_TIMEOUT_MS){
  const ms=Math.max(1,Number(timeoutMs)||GEMINI_GENERATE_ATTEMPT_TIMEOUT_MS);
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timer=null;
  const request=Promise.resolve().then(()=>fetchImpl(url,{...options,...(controller?{signal:controller.signal}:{})}));
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{try{controller?.abort();}catch{}reject(timeoutError('AI_PROVIDER',ms));},ms);});
  try{return await Promise.race([request,timeout]);}finally{if(timer)clearTimeout(timer);}
}

export function classifyGeminiFailure({status=0,payload=null,retryAfter=null,message='',name=''}={}){
  const numericStatus=Number(status||0);
  const text=`${message} ${name} ${payload?.error?.message||''} ${payload?.error?.status||''}`.toLowerCase();
  const retrySeconds=Number(retryAfter||0);
  if(numericStatus===401||numericStatus===403||/api key not valid|permission denied|unauthenticated/.test(text))return {class:'invalid_or_forbidden_key',transport_kind:'http_response',retryable:false,disable_project:true,failover:true};
  if(numericStatus===404||/model.*not found|not supported/.test(text))return {class:'model_unavailable',transport_kind:'http_response',retryable:false,disable_project:false,failover:true};
  if(numericStatus===429&&/daily|per day|quota.*day|resource exhausted.*day/.test(text))return {class:'daily_project_quota_exhausted',transport_kind:'http_response',retryable:false,disable_project:false,failover:true,cooldown_seconds:86400};
  if(numericStatus===429)return {class:'temporary_rate_limit',transport_kind:'http_response',retryable:true,disable_project:false,failover:false,cooldown_seconds:retrySeconds||60};
  if(numericStatus===408)return {class:'provider_timeout',transport_kind:'http_response',retryable:true,disable_project:false,failover:false,cooldown_seconds:retrySeconds||30};
  if(numericStatus>=500)return {class:'provider_http_transient',transport_kind:'http_response',retryable:true,disable_project:false,failover:false,cooldown_seconds:retrySeconds||30};
  if(numericStatus===0&&/timeout|timeouterror|ai_provider_timeout/.test(text))return {class:'provider_timeout',transport_kind:'fetch_exception',retryable:false,disable_project:false,failover:true,cooldown_seconds:10};
  if(numericStatus===0&&/aborterror|aborted|abort/.test(`${name} ${message}`.toLowerCase()))return {class:'request_aborted',transport_kind:'fetch_exception',retryable:true,disable_project:false,failover:false,cooldown_seconds:retrySeconds||5};
  if(numericStatus===0)return {class:'network_transport_error',transport_kind:'fetch_exception',retryable:true,disable_project:false,failover:false,cooldown_seconds:retrySeconds||5};
  return {class:'request_rejected',transport_kind:'http_response',retryable:false,disable_project:false,failover:false};
}

export function normalizeProjectPool(projects=[]){return projects.map((project,index)=>({alias:clean(project.alias)||`Project ${index+1}`,key:clean(project.key),fingerprint:clean(project.fingerprint),priority:Number.isFinite(Number(project.priority))?Number(project.priority):index+1,enabled:project.enabled!==false,cooldown_until:project.cooldown_until||null,last_used_at:project.last_used_at||null,last_error_class:project.last_error_class||null})).filter(project=>project.key).sort((a,b)=>a.priority-b.priority);}
export function selectAvailableProject(projects=[],now=Date.now(),excludedAliases=new Set()){return normalizeProjectPool(projects).find(project=>project.enabled&&!excludedAliases.has(project.alias)&&(!project.cooldown_until||Date.parse(project.cooldown_until)<=now))||null;}
export function markProjectFailure(project,failure,{applyCooldown=true}={}){const cooldown=applyCooldown&&failure.cooldown_seconds?new Date(Date.now()+failure.cooldown_seconds*1000).toISOString():project.cooldown_until||null;return {...project,enabled:failure.disable_project?false:project.enabled,cooldown_until:cooldown,last_error_class:failure.class};}

export function normalizeGeminiImages({images=null,imageBase64=null,mimeType='image/png'}={}){
  const explicitImages=Array.isArray(images)&&images.length;
  const source=explicitImages?images:(imageBase64?[{data:imageBase64,mimeType}]:[]);
  return source.map(image=>({
    data:clean(image?.data),
    mimeType:clean(image?.mimeType)||mimeType,
    imageRef:explicitImages?(clean(image?.imageRef)||null):null,
    fileName:explicitImages?(clean(image?.fileName)||null):null,
  })).filter(image=>image.data);
}

function imageParts(image){
  const inline={inlineData:{mimeType:image.mimeType,data:image.data}};
  if(!image.imageRef)return [inline];
  const fileSuffix=image.fileName?` / file=${image.fileName}`:'';
  return [{text:`UC.IMG attachment: image_ref=${image.imageRef}${fileSuffix}`},inline];
}

export function buildGeminiGenerateBody({prompt,images=null,imageBase64=null,mimeType='image/png',responseJsonSchema=null,thinkingLevel=null}={}){
  const normalized=normalizeGeminiImages({images,imageBase64,mimeType});
  const parts=[{text:String(prompt||'')},...normalized.flatMap(imageParts)];
  const generationConfig={responseMimeType:'application/json'};
  if(responseJsonSchema&&typeof responseJsonSchema==='object')generationConfig.responseJsonSchema=responseJsonSchema;
  if(clean(thinkingLevel))generationConfig.thinkingConfig={thinkingLevel:clean(thinkingLevel)};
  return {contents:[{role:'user',parts}],generationConfig};
}

export async function requestGemini({project,model,prompt,imageBase64,mimeType='image/png',images=null,responseJsonSchema=null,thinkingLevel=null,fetchImpl=fetch,timeoutMs=GEMINI_GENERATE_ATTEMPT_TIMEOUT_MS}){
  const body=buildGeminiGenerateBody({prompt,imageBase64,mimeType,images,responseJsonSchema,thinkingLevel});
  const started=monotonicNow();
  let response;
  try{
    response=await fetchWithTimeout(fetchImpl,`${GENERATE_ENDPOINT(model)}?key=${encodeURIComponent(project.key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},timeoutMs);
  }catch(error){
    const elapsedMs=Math.round(monotonicNow()-started);
    const failure=classifyGeminiFailure({status:0,message:error?.message||String(error),name:error?.name||''});
    const wrapped=new Error(failure.class==='provider_timeout'?`AI Provider 超過 ${Math.ceil(Number(timeoutMs||0)/1000)} 秒未回應。`:(error?.message||String(error)));
    wrapped.failure=failure;wrapped.status=0;wrapped.statusText=null;wrapped.retryAfter=null;wrapped.elapsed_ms=elapsedMs;wrapped.original_name=error?.name||'Error';wrapped.timeout_ms=error?.timeout_ms||null;
    throw wrapped;
  }
  const elapsedMs=Math.round(monotonicNow()-started);
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const retryAfter=response.headers?.get?.('retry-after')||null;
    const failure=classifyGeminiFailure({status:response.status,payload,retryAfter});
    const error=new Error(payload?.error?.message||`Gemini HTTP ${response.status}`);
    error.failure=failure;error.status=response.status;error.statusText=response.statusText||null;error.retryAfter=retryAfter;error.elapsed_ms=elapsedMs;error.original_name='Error';throw error;
  }
  return {payload,transport:{transport_kind:'http_response',http_status:response.status,http_status_text:response.statusText||null,elapsed_ms:elapsedMs}};
}

function buildAttemptRecord({project,model,imageCount,structuredOutput,thinkingLevel=null,attemptNumber,projectAttemptNumber,error=null,transport=null}={}){
  const failure=error?.failure||null;
  return {
    attempt_number:Number(attemptNumber||1),
    project_attempt_number:Number(projectAttemptNumber||1),
    alias:project?.alias||null,
    fingerprint:project?.fingerprint||null,
    model:model||null,
    image_count:Number(imageCount||0),
    structured_output:Boolean(structuredOutput),
    thinking_level:clean(thinkingLevel)||null,
    status:error?'FAILED':'COMPLETED',
    error_class:failure?.class||null,
    transport_kind:failure?.transport_kind||transport?.transport_kind||null,
    http_status:error?finiteOrNull(error?.status):finiteOrNull(transport?.http_status),
    http_status_text:error?clampMessage(error?.statusText,200):clampMessage(transport?.http_status_text,200),
    retry_after:error?clampMessage(error?.retryAfter,100):null,
    retryable:Boolean(failure?.retryable),
    failover:Boolean(failure?.failover),
    error_name:error?clampMessage(error?.original_name||error?.name,120):null,
    error_message:error?clampMessage(error?.message,1000):null,
    elapsed_ms:Number(error?.elapsed_ms??transport?.elapsed_ms??0),
    completed_at:nowIso(),
  };
}

export async function executeWithProjectPool({projects,model,prompt,imageBase64,mimeType='image/png',images=null,responseJsonSchema=null,thinkingLevel=null,fetchImpl=fetch,onTrace=()=>{},retryDelaysMs=DEFAULT_TRANSIENT_RETRY_DELAYS_MS,maxProjectFailovers=1,requestTimeoutMs=GEMINI_GENERATE_ATTEMPT_TIMEOUT_MS,totalTimeoutMs=GEMINI_IMAGE_TOTAL_TIMEOUT_MS}={}){
  let state=normalizeProjectPool(projects);
  const attempts=[];
  const excludedAliases=new Set();
  const imageCount=normalizeGeminiImages({images,imageBase64,mimeType}).length;
  const structuredOutput=Boolean(responseJsonSchema);
  const executionStarted=Date.now();
  let totalAttempt=0,failoverCount=0;
  const totalExpired=()=>Date.now()-executionStarted>=Number(totalTimeoutMs||GEMINI_IMAGE_TOTAL_TIMEOUT_MS);
  while(true){
    if(totalExpired())return {ok:false,paused:true,projects:state,attempts,reason:'provider_total_timeout',failure:{error_class:'provider_total_timeout',error_message:`AI 圖片分析超過 ${Math.ceil(Number(totalTimeoutMs||0)/1000)} 秒，已停止等待。`,elapsed_ms:Date.now()-executionStarted}};
    const project=selectAvailableProject(state,Date.now(),excludedAliases);
    if(!project)break;
    let projectAttempt=0;
    while(true){
      if(totalExpired())return {ok:false,paused:true,projects:state,attempts,reason:'provider_total_timeout',failure:{error_class:'provider_total_timeout',error_message:`AI 圖片分析超過 ${Math.ceil(Number(totalTimeoutMs||0)/1000)} 秒，已停止等待。`,elapsed_ms:Date.now()-executionStarted}};
      projectAttempt+=1;totalAttempt+=1;
      const remaining=Math.max(1,Number(totalTimeoutMs||GEMINI_IMAGE_TOTAL_TIMEOUT_MS)-(Date.now()-executionStarted));
      const attemptTimeout=Math.min(Number(requestTimeoutMs||GEMINI_GENERATE_ATTEMPT_TIMEOUT_MS),remaining);
      onTrace('ai_request_started',{alias:project.alias,fingerprint:project.fingerprint,model,image_count:imageCount,structured_output:structuredOutput,thinking_level:clean(thinkingLevel)||null,attempt_number:totalAttempt,project_attempt_number:projectAttempt,timeout_ms:attemptTimeout});
      try{
        const result=await requestGemini({project,model,prompt,imageBase64,mimeType,images,responseJsonSchema,thinkingLevel,fetchImpl,timeoutMs:attemptTimeout});
        const record=buildAttemptRecord({project,model,imageCount,structuredOutput,thinkingLevel,attemptNumber:totalAttempt,projectAttemptNumber:projectAttempt,transport:result.transport});
        attempts.push(record);
        const used={...project,last_used_at:nowIso(),last_error_class:null,cooldown_until:null};state=state.map(item=>item.alias===project.alias?used:item);
        onTrace('ai_request_completed',{...record});
        return {ok:true,payload:result.payload,projects:state,used_alias:project.alias,attempts,transport:result.transport};
      }catch(error){
        const failure=error.failure||classifyGeminiFailure({status:error.status,message:error.message,name:error.name});
        error.failure=failure;
        const record=buildAttemptRecord({project,model,imageCount,structuredOutput,thinkingLevel,attemptNumber:totalAttempt,projectAttemptNumber:projectAttempt,error});
        attempts.push(record);
        onTrace(failure.class==='provider_timeout'?'ai_request_timeout':'ai_request_failed',{...record});
        const retryIndex=projectAttempt-1;
        const canRetry=failure.retryable&&retryIndex<retryDelaysMs.length&&!totalExpired();
        if(canRetry){
          const delayMs=Number(retryDelaysMs[retryIndex]||0);
          onTrace('ai_request_retry_scheduled',{alias:project.alias,fingerprint:project.fingerprint,model,attempt_number:totalAttempt,next_project_attempt_number:projectAttempt+1,delay_ms:delayMs,error_class:failure.class});
          if(delayMs>0)await sleep(Math.min(delayMs,Math.max(0,Number(totalTimeoutMs||GEMINI_IMAGE_TOTAL_TIMEOUT_MS)-(Date.now()-executionStarted))));
          continue;
        }
        state=state.map(item=>item.alias===project.alias?markProjectFailure(item,failure,{applyCooldown:true}):item);
        excludedAliases.add(project.alias);
        const hasAnother=Boolean(selectAvailableProject(state,Date.now(),excludedAliases));
        const allowControlledFailover=hasAnother&&failoverCount<Number(maxProjectFailovers||0)&&(failure.failover||failure.retryable);
        if(allowControlledFailover){
          failoverCount+=1;
          onTrace('ai_project_failover',{from_alias:project.alias,model,error_class:failure.class,failover_number:failoverCount});
          break;
        }
        return {ok:false,paused:true,projects:state,attempts,reason:failure.class||'all_projects_unavailable',failure:lastFailureSummary(attempts)};
      }
    }
  }
  return {ok:false,paused:true,projects:state,attempts,reason:'all_projects_unavailable',failure:lastFailureSummary(attempts)};
}

function lastFailureSummary(attempts=[]){
  const row=[...attempts].reverse().find(item=>item.status==='FAILED');
  if(!row)return null;
  return {error_class:row.error_class,transport_kind:row.transport_kind,http_status:row.http_status,http_status_text:row.http_status_text,retry_after:row.retry_after,retryable:row.retryable,error_name:row.error_name,error_message:row.error_message,elapsed_ms:row.elapsed_ms,alias:row.alias,fingerprint:row.fingerprint,model:row.model,attempt_number:row.attempt_number,project_attempt_number:row.project_attempt_number,completed_at:row.completed_at};
}

export async function hashCacheKey({sha256,model,promptVersion}){const bytes=new TextEncoder().encode(`${sha256}|${model}|${promptVersion}`);const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('');}
export function readAiResultCache(key){try{return JSON.parse(localStorage.getItem(CACHE_PREFIX+key)||'null');}catch{return null;}}
export function writeAiResultCache(key,value){localStorage.setItem(CACHE_PREFIX+key,JSON.stringify({...value,cached_at:nowIso()}));}
export const AI_PROJECT_POOL_SCHEMA='pokemon-sleep-ai-project-pool/1.0';
