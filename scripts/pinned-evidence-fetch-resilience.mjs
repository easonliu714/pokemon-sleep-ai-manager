export const PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION='pinned-evidence-fetch-resilience-2026-08-17-a';
export const DEFAULT_PRIMARY_ATTEMPTS=2;
export const DEFAULT_MIRROR_ATTEMPTS=2;
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

export function pinnedMirrorUrl(rawUrl){
  const match=String(rawUrl||'').match(PINNED_RAW_GITHUB);
  if(!match)return null;
  const [,owner,repo,commit,filePath]=match;
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${commit}/${filePath}`;
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

export function createPinnedEvidenceFetch({
  fetchImpl=globalThis.fetch?.bind(globalThis),
  sleepFn=wait,
  primaryAttempts=DEFAULT_PRIMARY_ATTEMPTS,
  mirrorAttempts=DEFAULT_MIRROR_ATTEMPTS,
  baseBackoffMs=DEFAULT_BACKOFF_MS,
  onRetry=null,
  onFallback=null,
}={}){
  if(typeof fetchImpl!=='function')throw new Error('PINNED_EVIDENCE_FETCH_IMPL_REQUIRED');
  return async function resilientPinnedEvidenceFetch(input,init){
    const url=typeof input==='string'?input:input?.url;
    const mirror=pinnedMirrorUrl(url);
    if(!mirror)return fetchImpl(input,init);

    let primaryResponse=null;
    try{
      primaryResponse=await boundedFetch(url,init,{fetchImpl,sleepFn,attempts:Math.max(1,primaryAttempts),baseBackoffMs,onRetry,transport:'RAW_GITHUB'});
    }catch(error){
      onFallback?.({from:'RAW_GITHUB',to:'JSDELIVR_PINNED_COMMIT',url,mirror_url:mirror,reason:'NETWORK_ERROR',error:String(error?.message||error)});
      return boundedFetch(mirror,init,{fetchImpl,sleepFn,attempts:Math.max(1,mirrorAttempts),baseBackoffMs,onRetry,transport:'JSDELIVR_PINNED_COMMIT'});
    }

    if(primaryResponse?.ok||!RETRYABLE_HTTP_STATUS.has(Number(primaryResponse?.status)))return primaryResponse;
    onFallback?.({from:'RAW_GITHUB',to:'JSDELIVR_PINNED_COMMIT',url,mirror_url:mirror,reason:`HTTP_${primaryResponse.status}`});
    return boundedFetch(mirror,init,{fetchImpl,sleepFn,attempts:Math.max(1,mirrorAttempts),baseBackoffMs,onRetry,transport:'JSDELIVR_PINNED_COMMIT'});
  };
}

export function installPinnedEvidenceFetchResilience(options={}){
  const original=options.fetchImpl||globalThis.fetch?.bind(globalThis);
  const wrapped=createPinnedEvidenceFetch({...options,fetchImpl:original});
  globalThis.fetch=wrapped;
  return Object.freeze({version:PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION,installed:true});
}
