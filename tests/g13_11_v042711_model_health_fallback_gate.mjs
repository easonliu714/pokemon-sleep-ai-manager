import assert from 'node:assert/strict';

globalThis.document={readyState:'complete',querySelector:()=>null,getElementById:()=>null};
const settings=await import('../assets/js/ai-project-pool-settings.js');
const capability=await import('../assets/js/ai-provider-capability-failover.js');
await import('../assets/js/version-authority.js');

assert.equal(globalThis.PokemonSleepVersionAuthority?.app_version,'v0.4.27.11');
assert.equal(globalThis.PokemonSleepVersionAuthority?.app_build,'20260818-v042711-model-health-fallback-persistence');
assert.equal(settings.DEFAULT_MODEL,'gemini-3.6-flash');
assert.equal(capability.MODEL_CANDIDATE_TIMEOUT_MS,45000);

// Capability listing only proves the model is callable in principle. A restored
// preference may be attempted first, but it must not consume the entire image
// deadline and block a healthy model fallback.
const modelCatalog={models:[
  {name:'models/gemini-3.7-flash',supportedGenerationMethods:['generateContent']},
  {name:'models/gemini-3.6-flash',supportedGenerationMethods:['generateContent']},
]};
const successPayload={candidates:[{content:{parts:[{text:'{"schema_version":"2.0-observation","source":"ai_screenshot_observation","observations":[]}'}]}}]};
const fetchImpl=async url=>{
  const target=String(url);
  if(target.includes('/models?key='))return {ok:true,status:200,statusText:'OK',headers:{get:()=>null},json:async()=>modelCatalog};
  if(target.includes('gemini-3.7-flash'))return await new Promise(()=>{});
  if(target.includes('gemini-3.6-flash'))return {ok:true,status:200,statusText:'OK',headers:{get:()=>null},json:async()=>successPayload};
  throw new Error(`unexpected_url:${target}`);
};
let promoted=null;
const started=Date.now();
const outcome=await capability.executeWithCapabilityFailover({
  projects:[{alias:'Project A',key:'good-key',fingerprint:'aaaa',priority:1,enabled:true}],
  preferredModel:'gemini-3.7-flash',prompt:'test',imageBase64:'AA==',fetchImpl,
  capabilityTimeoutMs:20,requestTimeoutMs:30,totalTimeoutMs:180,modelCandidateTimeoutMs:40,
  maxProjectFailovers:0,retryDelaysMs:[],onModelFallbackSuccess:detail=>{promoted=detail;},
});
assert.equal(outcome.ok,true);
assert.equal(outcome.used_model,'gemini-3.6-flash');
assert.equal(outcome.used_alias,'Project A','same healthy Project must be reusable after model-only timeout');
assert.equal(outcome.model_fallback_used,true);
assert.equal(promoted?.from_model,'gemini-3.7-flash');
assert.equal(promoted?.to_model,'gemini-3.6-flash');
assert.ok(outcome.attempts.some(row=>row.model==='gemini-3.7-flash'&&row.error_class==='provider_timeout'));
assert.ok(Date.now()-started<1000,'synthetic model fallback must preserve time for the next candidate');

const released=capability.releaseModelTimeoutState([
  {alias:'Project A',key:'good-key',fingerprint:'aaaa',priority:1,enabled:true,cooldown_until:'2099-01-01T00:00:00.000Z',last_error_class:'provider_timeout'},
  {alias:'Project B',key:'bad-key',fingerprint:'bbbb',priority:2,enabled:false,cooldown_until:null,last_error_class:'invalid_or_forbidden_key'},
]);
assert.equal(released[0].cooldown_until,null);
assert.equal(released[0].last_error_class,null);
assert.equal(released[1].enabled,false,'real key failure must remain disabled');
assert.equal(released[1].last_error_class,'invalid_or_forbidden_key');

// Successful runtime fallback becomes the next preferred model without changing
// Project ordering, persistence mode, or any secret material.
const saved={schema:'pokemon-sleep-ai-project-pool/1.0',projects:[{alias:'Project A',key:'secret-key',fingerprint:'aaaa',priority:1,enabled:true}],model:'gemini-3.7-flash',persistent:true};
const next=settings.withRuntimeModel(saved,'gemini-3.6-flash');
assert.equal(next.model,'gemini-3.6-flash');
assert.equal(next.persistent,true);
assert.deepEqual(next.projects,saved.projects);
assert.equal(settings.withRuntimeModel(saved,''),null);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042711_G13_11_MODEL_HEALTH_FALLBACK_PERSISTENCE',
  version:'v0.4.27.11',
  checks:{
    candidate_budget_preserves_fallback:true,
    listed_but_hung_model_falls_back:true,
    same_project_reusable_after_model_timeout:true,
    key_failure_state_preserved:true,
    successful_fallback_promoted:true,
    persistence_shape_preserved:true,
  },
},null,2));