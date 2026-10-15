import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// G479: deterministic, isolated service-worker HTTP response replay.
// Synthetic fixture only: no Android response status is known, no player data,
// no real SW registration, and no claim of production root cause or remediation.
const swSource=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const release={app_version:'synthetic-g479',app_build:'synthetic-g479-current-build',cache_name:'synthetic-current-release-only'};
const appUrl=`https://synthetic.invalid/pokemon-sleep-ai-manager/assets/js/app.js?v=${release.app_build}`;

function makeHarness({network,hasCachedCurrent=true}){
  const listeners=new Map();
  const metrics={cache_match:0,cache_put:0,network_fetch:0};
  const cacheResponse=()=>hasCachedCurrent?new Response('synthetic-cached-current-app',{status:200}):undefined;
  const cache={put:async()=>{metrics.cache_put++;},addAll:async()=>{}};
  const caches={
    match:async()=>{metrics.cache_match++;return cacheResponse();},
    open:async name=>{assert.equal(name,release.cache_name);return cache;},
    keys:async()=>[],
  };
  const self={
    location:{origin:'https://synthetic.invalid'},
    PokemonSleepVersionAuthority:release,
    addEventListener:(name,handler)=>listeners.set(name,handler),
  };
  vm.runInNewContext(swSource,{
    self,importScripts:()=>{},URL,Response,Promise,caches,
    fetch:async()=>{
      metrics.network_fetch++;
      if(network==='reject')throw new TypeError('synthetic network disconnect');
      return new Response(`synthetic-http-${network}`,{status:network});
    },
  },{filename:'synthetic-service-worker.js',timeout:2000});
  assert.equal(typeof listeners.get('fetch'),'function');
  return {metrics,async fetchScript(){
    let pending;
    listeners.get('fetch')({
      request:{method:'GET',url:appUrl,destination:'script',mode:'cors'},
      respondWith:value=>{pending=value;},
    });
    assert.ok(pending,'SW must intercept versioned app.js');
    return pending;
  }};
}

// Only models the browser's response-status rejection, not actual Chromium import internals.
async function syntheticDynamicImport(harness){
  const response=await harness.fetchScript();
  if(!response.ok)throw new TypeError(`Failed to fetch dynamically imported module: ${appUrl}`);
  return response.text();
}
const offline=makeHarness({network:'reject'});
assert.equal(await syntheticDynamicImport(offline),'synthetic-cached-current-app');
assert.equal(offline.metrics.cache_match,1,'network rejection should attempt cached asset');
const transientHttp=makeHarness({network:503});
await assert.rejects(syntheticDynamicImport(transientHttp),/Failed to fetch dynamically imported module/);
assert.equal(transientHttp.metrics.cache_match,0,
  'CURRENT SW passes HTTP 503 through even when cached: triage gap, NOT acceptance');
const missing=makeHarness({network:404});
await assert.rejects(syntheticDynamicImport(missing),/Failed to fetch dynamically imported module/);
assert.equal(missing.metrics.cache_match,0,'genuine HTTP 404 must not be disguised as success');
const recovered=makeHarness({network:200});
assert.equal(await syntheticDynamicImport(recovered),'synthetic-http-200');
assert.equal(recovered.metrics.cache_match,0);
const uncachedOffline=makeHarness({network:'reject',hasCachedCurrent:false});
await assert.rejects(syntheticDynamicImport(uncachedOffline),/Failed to fetch dynamically imported module/);

console.log('PASS G479_SYNTHETIC_SW_NETWORK_REJECTION_CACHED_CURRENT_RECOVERY');
console.log('PASS G479_SYNTHETIC_SW_HTTP_503_CURRENT_BEHAVIOR_REPRODUCED_REVIEW_REQUIRED');
console.log('PASS G479_SYNTHETIC_SW_HTTP_404_NOT_DISGUISED_AND_NEXT_200_RECOVERS');
console.log('NOTE G479_NO_REAL_ANDROID_HTTP_STATUS_EVIDENCE_NO_RUNTIME_FIX_NO_PLAYER_DATA');
