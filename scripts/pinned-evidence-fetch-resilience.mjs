export const PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION='pinned-evidence-fetch-resilience-2026-08-17-b-github-contents-api';
export const DEFAULT_PRIMARY_ATTEMPTS=2;
export const DEFAULT_API_ATTEMPTS=2;
export const DEFAULT_BACKOFF_MS=350;
export const MAX_RETRY_AFTER_MS=2000;

const RETRYABLE_HTTP_STATUS=new Set([408,425,429,500,502,503,504]);
const PINNED_RAW_GITHUB=/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([0-9a-f]{40})\/(.+)$/i;

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function retryAfterMs(response){
  const raw=response?.headers?.get?.('retry-after');
  if(!raw)return null;
  const seconds=Number(raw);
  if(Number.isFinite(seconds)&&seconds>=0)return Math.min(MAX_RETRY_AFTER_MS,Math.round(seconds*1000));
  const timestamp=Date.parse(raw);
  if(Number.isFinite(timestamp))return Math.min(MAX_RETRY_AFTER_MS,Math.max(0,timestamp-Date.now()));
  return null;
}

function backoffMs(response,attemptIndex,baseMs){
  const retryAfter=retryAfterMs(response);
  if(retryAfter!==null)return retryAfter;
  return Math.min(MAX_RETRY_AFTER_MS,Math.max(0,baseMs)*(2**attemptIndex));
}

function pinnedRawParts(rawUrl){
  const match=String(rawUrl||'').match(PINNED_RAW_GITHUB);
  if(!match)return null;
  const [,owner,repo,commit,filePath]=match;
  return {owner,repo,commit,filePath};
}

export function pinnedGitHubContentsApiUrl(rawUrl){
  const parts=pinnedRawParts(rawUrl);
  if(!parts)return null;
  const path=parts.filePath.split('/').map(segment=>encodeURIComponent(segment)).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}/contents/${path}?ref=${parts.commit}`;
}

function apiRequestInit(originalInit={},githubToken=null){
  const headers=new Headers(originalInit?.headers||{});
  headers.set('Accept','application/vnd.github+json');
  headers.set('X-GitHub-Api-Version','2022-11-28');
  headers.set('User-Agent','pokemon-sleep-ai-manager-ci');
  if(githubToken)headers.set('Authorization',`Bearer ${githubToken}`);
  return {...originalInit,method:'GET',headers};
}

async function boundedFetch(url,init,{fetchImpl,sleepFn,attempts,baseBackoffMs,onRetry,transport}){
  let lastResponse=null,lastError=null;
  for(let attempt=0;attempt<attempts;attempt+=1){
    try{
      const response=await fetchImpl(url,init);
      lastResponse=response;
      if(response?.ok||!RETRYABLE_HTTP_STATUS.has(Number(response?.status)))return response;
      if(attempt+1<attempts){
        const delay=backoffMs(response,attempt,baseBackoffMs);
        onRetry?.({transport,url,attempt:attempt+1,status:Number(response?.status),delay_ms:delay});
        await sleepFn(delay);
      }
    }catch(error){
      lastError=error;
      if(attempt+1<attempts){
        const delay=backoffMs(null,attempt,baseBackoffMs);
        onRetry?.({transport,url,attempt:attempt+1,status:null,delay_ms:delay,error:String(error?.message||error)});
        await sleepFn(delay);
      }
    }
  }
  if(lastResponse)return lastResponse;
  throw lastError||new Error(`PINNED_EVIDENCE_TRANSPORT_FAILED:${transport}`);
}

function syntheticFailureResponse(status,message){
  return new Response(String(message||''),{status,headers:{'content-type':'text/plain; charset=utf-8','x-pinned-evidence-transport':'GITHUB_CONTENTS_API'}});
}

async function decodeContentsApiResponse(response){
  if(!response?.ok)return response;
  let payload=null;
  try{payload=await response.json();}
  catch(error){return syntheticFailureResponse(502,`PINNED_CONTENTS_API_JSON_INVALID:${error?.message||String(error)}`);}
  if(payload?.type!=='file'||payload?.encoding!=='base64'||typeof payload?.content!=='string'||!payload.content.trim()){
    return syntheticFailureResponse(502,'PINNED_CONTENTS_API_FILE_PAYLOAD_INVALID');
  }
  let text='';
  try{text=Buffer.from(payload.content.replace(/\s/g,''),'base64').toString('utf8');}
  catch(error){return syntheticFailureResponse(502,`PINNED_CONTENTS_API_BASE64_INVALID:${error?.message||String(error)}`);}
  return new Response(text,{status:200,headers:{'content-type':'text/plain; charset=utf-8','x-pinned-evidence-transport':'GITHUB_CONTENTS_API','x-pinned-evidence-api-blob-sha':String(payload.sha||'')}});
}

export function createPinnedEvidenceFetch({
  fetchImpl=globalThis.fetch?.bind(globalThis),
  sleepFn=wait,
  primaryAttempts=DEFAULT_PRIMARY_ATTEMPTS,
  apiAttempts=DEFAULT_API_ATTEMPTS,
  baseBackoffMs=DEFAULT_BACKOFF_MS,
  githubToken=process?.env?.PINNED_EVIDENCE_GITHUB_TOKEN||null,
  onRetry=null,
  onFallback=null,
}={}){
  if(typeof fetchImpl!=='function')throw new Error('PINNED_EVIDENCE_FETCH_IMPL_REQUIRED');
  return async function resilientPinnedEvidenceFetch(input,init){
    const url=typeof input==='string'?input:input?.url;
    const apiUrl=pinnedGitHubContentsApiUrl(url);
    const method=String(init?.method||(typeof input==='string'?'GET':input?.method||'GET')).toUpperCase();
    if(!apiUrl||method!=='GET')return fetchImpl(input,init);

    let primaryResponse=null;
    try{
      primaryResponse=await boundedFetch(url,init,{fetchImpl,sleepFn,attempts:Math.max(1,primaryAttempts),baseBackoffMs,onRetry,transport:'RAW_GITHUB'});
    }catch(error){
      onFallback?.({from:'RAW_GITHUB',to:'GITHUB_CONTENTS_API',url,api_url:apiUrl,reason:'NETWORK_ERROR',error:String(error?.message||error)});
      const apiResponse=await boundedFetch(apiUrl,apiRequestInit(init,githubToken),{fetchImpl,sleepFn,attempts:Math.max(1,apiAttempts),baseBackoffMs,onRetry,transport:'GITHUB_CONTENTS_API'});
      return decodeContentsApiResponse(apiResponse);
    }

    if(primaryResponse?.ok||!RETRYABLE_HTTP_STATUS.has(Number(primaryResponse?.status)))return primaryResponse;
    onFallback?.({from:'RAW_GITHUB',to:'GITHUB_CONTENTS_API',url,api_url:apiUrl,reason:`HTTP_${primaryResponse.status}`});
    const apiResponse=await boundedFetch(apiUrl,apiRequestInit(init,githubToken),{fetchImpl,sleepFn,attempts:Math.max(1,apiAttempts),baseBackoffMs,onRetry,transport:'GITHUB_CONTENTS_API'});
    return decodeContentsApiResponse(apiResponse);
  };
}

export function installPinnedEvidenceFetchResilience(options={}){
  const original=options.fetchImpl||globalThis.fetch?.bind(globalThis);
  const wrapped=createPinnedEvidenceFetch({...options,fetchImpl:original});
  globalThis.fetch=wrapped;
  return Object.freeze({version:PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION,installed:true});
}
