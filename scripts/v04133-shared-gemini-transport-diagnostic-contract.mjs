import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  classifyGeminiFailure,
  executeWithProjectPool,
} from '../assets/js/ai-project-pool-runtime.js';
import {
  UC_IMG_DIAGNOSTIC_SCHEMA,
  UC_IMG_GEMINI_ADAPTER_VERSION,
  buildUcImgDiagnosticBundle,
} from '../assets/js/uc-img-gemini-adapter.js';

const jsonResponse=(status,payload,{statusText='',retryAfter=null}={})=>({
  ok:status>=200&&status<300,
  status,
  statusText,
  headers:{get:name=>String(name).toLowerCase()==='retry-after'?retryAfter:null},
  json:async()=>payload,
});
const successPayload={candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]};

const timeout=classifyGeminiFailure({status:408});
assert.equal(timeout.class,'provider_timeout');
assert.equal(timeout.transport_kind,'http_response');
assert.equal(timeout.retryable,true);
const transient=classifyGeminiFailure({status:503});
assert.equal(transient.class,'provider_http_transient');
assert.equal(transient.transport_kind,'http_response');
assert.equal(transient.retryable,true);
const network=classifyGeminiFailure({status:0,message:'Failed to fetch',name:'TypeError'});
assert.equal(network.class,'network_transport_error');
assert.equal(network.transport_kind,'fetch_exception');
const aborted=classifyGeminiFailure({status:0,message:'The operation was aborted',name:'AbortError'});
assert.equal(aborted.class,'request_aborted');
assert.equal(aborted.transport_kind,'fetch_exception');

const retryTrace=[];
let retryCalls=0;
const retryFetch=async()=>{
  retryCalls+=1;
  if(retryCalls<3)return jsonResponse(503,{error:{message:'temporary provider failure'}},{statusText:'Service Unavailable'});
  return jsonResponse(200,successPayload,{statusText:'OK'});
};
const retryResult=await executeWithProjectPool({
  projects:[{alias:'Project A',key:'AIza-DO-NOT-EXPORT-A',fingerprint:'aaaa1111',priority:1,enabled:true}],
  model:'gemini-test-flash',prompt:'test',imageBase64:'AA==',fetchImpl:retryFetch,retryDelaysMs:[0,0],maxProjectFailovers:0,
  onTrace:(event,details)=>retryTrace.push({event,details}),
});
assert.equal(retryResult.ok,true);
assert.equal(retryResult.used_alias,'Project A');
assert.equal(retryCalls,3);
assert.equal(retryResult.attempts.length,3);
assert.deepEqual(retryResult.attempts.map(row=>row.status),['FAILED','FAILED','COMPLETED']);
assert.deepEqual(retryResult.attempts.slice(0,2).map(row=>row.error_class),['provider_http_transient','provider_http_transient']);
assert.equal(retryResult.attempts[0].http_status,503);
assert.equal(retryResult.attempts[0].transport_kind,'http_response');
assert.equal(retryTrace.filter(row=>row.event==='ai_request_retry_scheduled').length,2);

const transportTrace=[];
const transportResult=await executeWithProjectPool({
  projects:[{alias:'Project A',key:'AIza-DO-NOT-EXPORT-N',fingerprint:'bbbb2222',priority:1,enabled:true}],
  model:'gemini-test-flash',prompt:'test',imageBase64:'AA==',retryDelaysMs:[],maxProjectFailovers:0,
  fetchImpl:async()=>{throw new TypeError('Failed to fetch');},
  onTrace:(event,details)=>transportTrace.push({event,details}),
});
assert.equal(transportResult.ok,false);
assert.equal(transportResult.failure.error_class,'network_transport_error');
assert.equal(transportResult.failure.transport_kind,'fetch_exception');
assert.equal(transportResult.failure.http_status,0);
assert.equal(transportResult.failure.error_name,'TypeError');
assert.match(transportResult.failure.error_message,/Failed to fetch/);

const failoverTrace=[];
let projectACalls=0,projectBCalls=0;
const failoverFetch=async url=>{
  if(url.includes('PROJECT-A-KEY')){projectACalls+=1;return jsonResponse(503,{error:{message:'A unavailable'}},{statusText:'Service Unavailable'});}
  projectBCalls+=1;return jsonResponse(200,successPayload,{statusText:'OK'});
};
const failoverResult=await executeWithProjectPool({
  projects:[
    {alias:'Project A',key:'PROJECT-A-KEY',fingerprint:'cccc3333',priority:1,enabled:true},
    {alias:'Project B',key:'PROJECT-B-KEY',fingerprint:'dddd4444',priority:2,enabled:true},
  ],
  model:'gemini-test-flash',prompt:'test',imageBase64:'AA==',fetchImpl:failoverFetch,retryDelaysMs:[0],maxProjectFailovers:1,
  onTrace:(event,details)=>failoverTrace.push({event,details}),
});
assert.equal(failoverResult.ok,true);
assert.equal(failoverResult.used_alias,'Project B');
assert.equal(projectACalls,2,'Project A must get one bounded retry before failover');
assert.equal(projectBCalls,1);
assert.equal(failoverTrace.filter(row=>row.event==='ai_project_failover').length,1);

const priorResponse=JSON.stringify({schema:'previous-success',observations:[{source_image_ref:'image-old'}]});
const session={
  session_id:'ucimg-v04133-test',
  entries:[{image_ref:'image-053',scenario_key:'ingredients',byte_state:'READY',byte_snapshot_size:12345}],
  scenario_state:{ingredients:{raw_response:priorResponse,last_ai_error:'Gemini 分析暫停：network_transport_error (browser transport)'}},
};
const debugTrace={events:[
  {category:'uc_img_gemini',event:'ai_request_started',status:'started',timestamp:'2026-08-12T06:50:01.000Z',details:{scenario_key:'ingredients',scenario:'ingredient_inventory_update',adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,alias:'Project A',fingerprint:'6b96db6b',model:'gemini-3.6-flash',image_count:1,structured_output:true,attempt_number:1,project_attempt_number:1}},
  {category:'uc_img_gemini',event:'ai_request_failed',status:'failed',timestamp:'2026-08-12T06:50:24.000Z',details:{scenario_key:'ingredients',scenario:'ingredient_inventory_update',adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,alias:'Project A',fingerprint:'6b96db6b',model:'gemini-3.6-flash',image_count:1,structured_output:true,attempt_number:1,project_attempt_number:1,status:'FAILED',error_class:'network_transport_error',transport_kind:'fetch_exception',http_status:0,http_status_text:null,retry_after:null,retryable:true,failover:false,error_name:'TypeError',error_message:'Failed to fetch',elapsed_ms:23000}},
]};
const diagnostic=buildUcImgDiagnosticBundle({
  appVersion:'v0.4.13.3',session,scenarioKey:'ingredients',config:{scenario:'ingredient_inventory_update'},coverage:'USER_CONFIRMED_COMPLETE',rawResponse:priorResponse,
  validation:null,
  providerMeta:{provider:'gemini',model:'gemini-3.6-flash',project_alias:'Project A',image_count:3,response_contract:'public-master-recognition',completed_at:'2026-08-11T12:00:00Z'},
  debugTrace,
});
assert.equal(diagnostic.schema,UC_IMG_DIAGNOSTIC_SCHEMA);
assert.equal(diagnostic.assigned_image_count,1);
assert.deepEqual(diagnostic.assigned_image_refs,['image-053']);
assert.equal(diagnostic.image_count,1,'current attempt image count must override stale previous provider meta');
assert.equal(diagnostic.current_attempt.status,'FAILED');
assert.equal(diagnostic.current_attempt.failure.error_class,'network_transport_error');
assert.equal(diagnostic.current_attempt.failure.transport_kind,'fetch_exception');
assert.equal(diagnostic.current_attempt.failure.error_name,'TypeError');
assert.equal(diagnostic.current_attempt_response,null);
assert.equal(diagnostic.response,null);
assert.equal(diagnostic.response_is_current,false);
assert.equal(diagnostic.previous_success.image_count,3);
assert.deepEqual(diagnostic.previous_success.response,{schema:'previous-success',observations:[{source_image_ref:'image-old'}]});
assert.match(diagnostic.last_ai_error,/network_transport_error/);
assert.equal(diagnostic.safety.api_key_included,false);
assert.equal(diagnostic.safety.screenshot_bytes_included,false);
assert.equal(diagnostic.safety.screenshot_base64_included,false);
assert.equal(diagnostic.safety.sqlite_export_included,false);
assert.equal(diagnostic.safety.full_prompt_included,false);
const diagnosticText=JSON.stringify(diagnostic);
for(const secret of ['AIza-DO-NOT-EXPORT-A','AIza-DO-NOT-EXPORT-N','PROJECT-A-KEY','PROJECT-B-KEY'])assert.equal(diagnosticText.includes(secret),false,`secret leaked: ${secret}`);
assert.equal(diagnosticText.includes('AA=='),false,'image Base64 must not enter diagnostic');

const uiSource=fs.readFileSync(new URL('../assets/js/unified-screenshot-update-center.js',import.meta.url),'utf8');
assert.ok(uiSource.includes("uc-img-a-2026-08-12-e-attempt-lifecycle-diagnostic"));
assert.ok(uiSource.includes("s.raw_response||s.last_ai_error?'':'disabled'"),'diagnostic export must remain enabled after a first-ever Gemini failure');
assert.ok(uiSource.includes("state?.raw_response?validateScreenshotScenarioPayload(session,key,state.raw_response):null"),'failed attempt without raw response must not fabricate a JSON validation result');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04133_SHARED_GEMINI_TRANSPORT_DIAGNOSTIC',
  adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
  diagnostic_schema:UC_IMG_DIAGNOSTIC_SCHEMA,
  provider_http_transient_split:true,
  browser_transport_split:true,
  bounded_retry:true,
  controlled_project_failover:true,
  failed_attempt_diagnostic:true,
  failure_first_export_enabled:true,
  stale_previous_response_separated:true,
  current_image_count_authoritative:true,
  api_key_in_diagnostic:false,
  screenshot_base64_in_diagnostic:false,
},null,2));
