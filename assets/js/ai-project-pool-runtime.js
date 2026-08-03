const GENERATE_ENDPOINT=model=>`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
const CACHE_PREFIX='pokemon-sleep:ai-result-cache:';
const nowIso=()=>new Date().toISOString();
const clean=value=>String(value??'').trim();

export function classifyGeminiFailure({status=0,payload=null,retryAfter=null,message=''}={}){
  const text=`${message} ${payload?.error?.message||''} ${payload?.error?.status||''}`.toLowerCase();
  const retrySeconds=Number(retryAfter||0);
  if(status===401||status===403||/api key not valid|permission denied|unauthenticated/.test(text))return {class:'invalid_or_forbidden_key',retryable:false,disable_project:true,failover:true};
  if(status===404||/model.*not found|not supported/.test(text))return {class:'model_unavailable',retryable:false,disable_project:false,failover:true};
  if(status===429&&/daily|per day|quota.*day|resource exhausted.*day/.test(text))return {class:'daily_project_quota_exhausted',retryable:false,disable_project:false,failover:true,cooldown_seconds:86400};
  if(status===429)return {class:'temporary_rate_limit',retryable:true,disable_project:false,failover:false,cooldown_seconds:retrySeconds||60};
  if(status>=500||status===408||status===0)return {class:'provider_transient',retryable:true,disable_project:false,failover:false,cooldown_seconds:retrySeconds||30};
  return {class:'request_rejected',retryable:false,disable_project:false,failover:false};
}

export function normalizeProjectPool(projects=[]){return projects.map((project,index)=>({alias:clean(project.alias)||`Project ${index+1}`,key:clean(project.key),fingerprint:clean(project.fingerprint),priority:Number.isFinite(Number(project.priority))?Number(project.priority):index+1,enabled:project.enabled!==false,cooldown_until:project.cooldown_until||null,last_used_at:project.last_used_at||null,last_error_class:project.last_error_class||null})).filter(project=>project.key).sort((a,b)=>a.priority-b.priority);}
export function selectAvailableProject(projects=[],now=Date.now()){return normalizeProjectPool(projects).find(project=>project.enabled&&(!project.cooldown_until||Date.parse(project.cooldown_until)<=now))||null;}
export function markProjectFailure(project,failure){const cooldown=failure.cooldown_seconds?new Date(Date.now()+failure.cooldown_seconds*1000).toISOString():project.cooldown_until||null;return {...project,enabled:failure.disable_project?false:project.enabled,cooldown_until:cooldown,last_error_class:failure.class};}

export async function requestGemini({project,model,prompt,imageBase64,mimeType='image/png',fetchImpl=fetch}){
  const response=await fetchImpl(`${GENERATE_ENDPOINT(model)}?key=${encodeURIComponent(project.key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType,data:imageBase64}}]}],generationConfig:{responseMimeType:'application/json'}})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const failure=classifyGeminiFailure({status:response.status,payload,retryAfter:response.headers?.get?.('retry-after')});const error=new Error(payload?.error?.message||`Gemini HTTP ${response.status}`);error.failure=failure;error.status=response.status;throw error;}
  return payload;
}

export async function executeWithProjectPool({projects,model,prompt,imageBase64,mimeType='image/png',fetchImpl=fetch,onTrace=()=>{}}){
  let state=normalizeProjectPool(projects);const attempts=[];
  for(let guard=0;guard<state.length*3;guard++){
    const project=selectAvailableProject(state);if(!project)break;
    try{onTrace('ai_request_started',{alias:project.alias,fingerprint:project.fingerprint,model});const payload=await requestGemini({project,model,prompt,imageBase64,mimeType,fetchImpl});const used={...project,last_used_at:nowIso(),last_error_class:null};state=state.map(item=>item.alias===project.alias?used:item);onTrace('ai_request_completed',{alias:project.alias,fingerprint:project.fingerprint,model});return {ok:true,payload,projects:state,used_alias:project.alias,attempts};}
    catch(error){const failure=error.failure||classifyGeminiFailure({status:error.status,message:error.message});attempts.push({alias:project.alias,fingerprint:project.fingerprint,error_class:failure.class});state=state.map(item=>item.alias===project.alias?markProjectFailure(item,failure):item);onTrace('ai_request_failed',{alias:project.alias,fingerprint:project.fingerprint,model,error_class:failure.class,failover:failure.failover});if(failure.retryable)break;if(!failure.failover)break;}
  }
  return {ok:false,paused:true,projects:state,attempts,reason:'all_projects_unavailable'};
}

export async function hashCacheKey({sha256,model,promptVersion}){const bytes=new TextEncoder().encode(`${sha256}|${model}|${promptVersion}`);const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('');}
export function readAiResultCache(key){try{return JSON.parse(localStorage.getItem(CACHE_PREFIX+key)||'null');}catch{return null;}}
export function writeAiResultCache(key,value){localStorage.setItem(CACHE_PREFIX+key,JSON.stringify({...value,cached_at:nowIso()}));}
export const AI_PROJECT_POOL_SCHEMA='pokemon-sleep-ai-project-pool/1.0';
