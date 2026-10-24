import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// G479: execute the production DebugTraceManager class in an isolated VM.
// No browser profile, player SQLite, network, private trace, or real localStorage is used.
const source=readFileSync(new URL('../assets/js/debug-trace-manager.js',import.meta.url),'utf8');
assert.match(source,/class DebugTraceManager/);
assert.match(source,/export const debugTrace=new DebugTraceManager\(\)/);
const isolated=source.replace(/export const debugTrace=new DebugTraceManager\(\);[\s\S]*$/,'globalThis.DebugTraceManagerForTest=DebugTraceManager;');
assert.notEqual(isolated,source,'test must isolate the real class without boot-time listeners');
const store=new Map();
const nodes=new Map();
const document={
  querySelector:()=>null,
  getElementById:id=>{
    if(id==='debugEventTable')return null;
    if(!nodes.has(id))nodes.set(id,{textContent:''});
    return nodes.get(id);
  },
  documentElement:{dataset:{appVersion:'synthetic',appBuild:'synthetic'}},
};
const scope={
  Blob,Date,Intl,JSON,URL,Math,Promise,Error,Set,Map,
  performance:{now:()=>100},
  localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  document,location:{href:'http://127.0.0.1/',origin:'http://127.0.0.1',pathname:'/'},
  navigator:{userAgent:'synthetic',language:'zh-TW',platform:'synthetic',onLine:true},
  matchMedia:()=>({matches:false}),innerWidth:390,innerHeight:844,devicePixelRatio:1,
  setTimeout:()=>1,clearTimeout:()=>{},
};
scope.globalThis=scope;
vm.runInNewContext(isolated,scope,{filename:'production-debug-trace-manager.js'});
const trace=new scope.DebugTraceManagerForTest();
const prior={session_id:'prior-android-session',category:'bootstrap',event:'module_probe_failed',status:'failed',error:{name:'TypeError',message:'transient module import'},timestamp:'2026-10-14T04:28:42Z'};
const current={session_id:trace.sessionId,category:'app',event:'app_ready',status:'completed',error:null,timestamp:'2026-10-24T00:00:00Z'};
trace.events=[prior,current];
let summary=trace.summary();
assert.equal(summary.event_count,1,'current event_count remains current-session only');
assert.equal(summary.error_count,0,'current error_count remains current-session only');
assert.equal(summary.historical_event_count,1);
assert.equal(summary.historical_error_count,1,'retained prior failure must not be silently hidden');
assert.equal(summary.retained_event_count,2);
assert.equal(summary.retained_error_count,1);
const report=trace.buildReport();
assert.equal(report.summary.error_count,0);
assert.equal(report.summary.historical_error_count,1);
assert.equal(report.events.length,2,'historical evidence must remain in redacted export');
trace.refreshUI();
assert.equal(nodes.get('debugErrorCount').textContent,0);
assert.match(nodes.get('debugHistoryScope').textContent,/歷史保留錯誤 1/);
trace.record('bootstrap','module_probe_failed',{status:'failed',error:new TypeError('synthetic current error')});
summary=trace.summary();
assert.equal(summary.error_count,1,'new current failure must still be counted');
assert.equal(summary.historical_error_count,1,'historical failure must not be double-counted');
assert.equal(summary.retained_error_count,2);
console.log('PASS G479_DEBUG_CURRENT_VS_RETAINED_HISTORY_SCOPE');
console.log('PASS G479_DEBUG_EXPORT_HISTORY_PRESERVED_AND_REDACTED');

{
  // G479: HTTP timing is an observation, not a root cause. Zero/absent stays UNKNOWN.
  const target='http://127.0.0.1/assets/js/app.js?v=secret-query-must-not-export';
  scope.document.visibilityState='visible';
  scope.navigator.serviceWorker={controller:{scriptURL:'http://127.0.0.1/service-worker.js?secret-controller-query'}};
  scope.performance.getEntriesByType=kind=>kind==='resource'?[{name:target,responseStatus:503,duration:12.3,workerStart:4.2}]:[];
  let evidence=trace.captureModuleImportFailureProvenance(target);
  assert.equal(evidence.classification,'HTTP_RESPONSE_STATUS_OBSERVED');
  assert.equal(evidence.resource_response_status,503);
  assert.equal(evidence.service_worker_controlled,true);
  assert.equal(evidence.controller_script_path,'/service-worker.js');
  assert.equal(evidence.target_path,'/assets/js/app.js');
  assert.equal(JSON.stringify(evidence).includes('secret-'),false,'no URL query tokens');
  scope.performance.getEntriesByType=()=>[{name:target,responseStatus:0,transferSize:0,duration:0,workerStart:0}];
  evidence=trace.captureModuleImportFailureProvenance(target);
  assert.equal(evidence.classification,'UNDETERMINED','status=0 is not transport proof');
  assert.equal(evidence.resource_response_status,null);
  scope.performance.getEntriesByType=()=>[];
  evidence=trace.captureModuleImportFailureProvenance(target);
  assert.equal(evidence.classification,'UNDETERMINED','missing timing is not network proof');
  evidence=trace.captureModuleImportFailureProvenance('https://other.invalid/private?token=secret');
  assert.equal(evidence.classification,'TARGET_ORIGIN_MISMATCH');
  assert.equal(evidence.target_path,null,'foreign private path cannot leak');
  assert.equal(trace.events.filter(event=>event.event==='module_import_failure_provenance').length,4);
  console.log('PASS G479_PASSIVE_ESM_HTTP_VS_UNKNOWN_SOURCE_BOUND');
  console.log('PASS G479_PASSIVE_ESM_NO_FETCH_NO_PRIVATE_URL_QUERY');
}
// G479 positive safety regression: Resource Timing identity includes query in memory.
{
  const current='http://127.0.0.1/assets/js/app.js?v=current-release';
  const stale='http://127.0.0.1/assets/js/app.js?v=stale-release';
  scope.performance.getEntriesByType=kind=>kind==='resource'?
    [{name:current,responseStatus:0,duration:8,workerStart:0},
     {name:stale,responseStatus:503,duration:21,workerStart:5}]:[];
  let evidence=trace.captureModuleImportFailureProvenance(current);
  assert.equal(evidence.resource_timing_entries,1,'stale query-version must not be counted');
  assert.equal(evidence.resource_response_status,null,'stale 503 must not be attributed to current import');
  assert.equal(evidence.classification,'UNDETERMINED','current status 0 remains undetermined');
  assert.equal(JSON.stringify(evidence).includes('stale-release'),false,'stale query must not be exported');
  assert.equal(JSON.stringify(evidence).includes('current-release'),false,'current query must not be exported');
  scope.performance.getEntriesByType=kind=>kind==='resource'?
    [{name:stale,responseStatus:200,duration:5,workerStart:0},
     {name:current,responseStatus:503,duration:18,workerStart:3}]:[];
  evidence=trace.captureModuleImportFailureProvenance(current);
  assert.equal(evidence.resource_timing_entries,1);
  assert.equal(evidence.resource_response_status,503,'exact current query HTTP 503 is observable');
  assert.equal(evidence.classification,'HTTP_RESPONSE_STATUS_OBSERVED');
  assert.equal(JSON.stringify(evidence).includes('current-release'),false);
  scope.performance.getEntriesByType=()=>[{name:stale,responseStatus:503,duration:21,workerStart:5}];
  evidence=trace.captureModuleImportFailureProvenance(current);
  assert.equal(evidence.resource_timing_entries,0);
  assert.equal(evidence.resource_response_status,null);
  assert.equal(evidence.classification,'UNDETERMINED');
  console.log('PASS G479_RESOURCE_TIMING_EXACT_QUERY_VERSION_ATTRIBUTION_SOURCE_BOUND');
  console.log('PASS G479_RESOURCE_TIMING_ZERO_MISSING_UNDETERMINED_AND_PRIVATE_QUERY_REDACTED');
}

console.log('NOTE G479_ANDROID_ESM_ROOT_CAUSE_STILL_UNVERIFIED');
