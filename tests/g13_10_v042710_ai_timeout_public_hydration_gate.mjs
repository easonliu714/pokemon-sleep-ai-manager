import assert from 'node:assert/strict';

// ai-project-pool-settings is browser-oriented; a minimal no-op document keeps
// module installation inert while exposing its pure selection helpers.
globalThis.document={readyState:'complete',querySelector:()=>null};
const settings=await import('../assets/js/ai-project-pool-settings.js');
const runtime=await import('../assets/js/ai-project-pool-runtime.js');
const evolution=await import('../assets/js/analysis-confirmation-evolution-authority.js');
await import('../assets/js/version-authority.js');

assert.equal(globalThis.PokemonSleepVersionAuthority?.app_version,'v0.4.27.10');
assert.equal(globalThis.PokemonSleepVersionAuthority?.app_build,'20260818-v042710-ai-startup-timeout-public-hydration');

// Startup model governance: a blank/stale selection can never resolve to blank.
assert.equal(settings.chooseModel(['gemini-3.6-flash'],''),'gemini-3.6-flash');
assert.equal(settings.chooseModel(['gemini-3.6-flash'],'gemini-3.7-flash'),'gemini-3.6-flash');
assert.notEqual(settings.chooseModel([],''),'');
assert.equal(settings.DEFAULT_MODEL,'gemini-3.6-flash');
assert.equal(settings.MODEL_DISCOVERY_TIMEOUT_MS,15000);

// A hung project must timeout and fail over to another project instead of
// waiting forever. The fake never resolves for Project A and succeeds for B.
const payload={candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]};
const fetchImpl=async url=>{
  if(String(url).includes('key=hang-key'))return await new Promise(()=>{});
  return {ok:true,status:200,statusText:'OK',headers:{get:()=>null},json:async()=>payload};
};
const started=Date.now();
const timeoutOutcome=await runtime.executeWithProjectPool({
  projects:[
    {alias:'Project A',key:'hang-key',fingerprint:'aaaa',priority:1,enabled:true},
    {alias:'Project B',key:'good-key',fingerprint:'bbbb',priority:2,enabled:true},
  ],
  model:'gemini-3.6-flash',prompt:'test',imageBase64:'AA==',fetchImpl,
  requestTimeoutMs:30,totalTimeoutMs:200,maxProjectFailovers:1,retryDelaysMs:[],
});
assert.equal(timeoutOutcome.ok,true);
assert.equal(timeoutOutcome.used_alias,'Project B');
assert.ok(timeoutOutcome.attempts.some(row=>row.error_class==='provider_timeout'));
assert.ok(Date.now()-started<1000,'provider timeout gate must terminate quickly in synthetic test');
const timeoutAttempt=timeoutOutcome.attempts.find(row=>row.error_class==='provider_timeout');
assert.equal(timeoutAttempt.retryable,false);
assert.equal(timeoutAttempt.failover,true);
assert.equal(String(timeoutAttempt.error_message||'').includes('hang-key'),false,'trace must not leak API key');

// A single permanently hung provider must stop at the configured total deadline.
const totalStarted=Date.now();
const totalOutcome=await runtime.executeWithProjectPool({
  projects:[{alias:'Project A',key:'hang-key',fingerprint:'aaaa',priority:1,enabled:true}],
  model:'gemini-3.6-flash',prompt:'test',imageBase64:'AA==',fetchImpl,
  requestTimeoutMs:35,totalTimeoutMs:80,maxProjectFailovers:0,retryDelaysMs:[],
});
assert.equal(totalOutcome.ok,false);
assert.ok(['provider_timeout','provider_total_timeout'].includes(totalOutcome.reason));
assert.ok(Date.now()-totalStarted<1000,'total timeout gate must terminate quickly in synthetic test');

// Public main-skill hydration: exact public identity can supply explanation,
// but must never overwrite a direct nonblank observation.
const unresolved={status:'SPECIES_UNRESOLVED',species:null,requirements:{},conflicts:[]};
const skillDraft=evolution.hydrateEvolutionDraft({main_skill:'能量填充M',main_skill_description:null,field_evidence:{}},unresolved);
assert.equal(skillDraft.main_skill_description,'大量增加卡比獸的能量；效果量依主技能等級而異。');
assert.equal(skillDraft.field_evidence.main_skill_description?.status,'PUBLIC_MASTER_HYDRATED');
assert.equal(skillDraft.field_evidence.main_skill_description?.observation_basis,'PUBLIC_MASTER');
const directDescription=evolution.hydrateEvolutionDraft({main_skill:'能量填充M',main_skill_description:'圖片直接文字',field_evidence:{}},unresolved);
assert.equal(directDescription.main_skill_description,'圖片直接文字');

// Tinkatink evolution authority: numeric requirements are Lv18 / candy40;
// verified absences are display metadata only, never string sentinels in data.
const authority=evolution.resolveEvolutionAuthority('小鍛匠',()=>[]);
const evo=evolution.hydrateEvolutionDraft({species:'小鍛匠',field_evidence:{}},authority);
assert.equal(evo.evolution_level_required,18);
assert.equal(evo.evolution_candy_required,40);
assert.equal(evo.evolution_sleep_hours_required,undefined);
assert.equal(evo.evolution_item_required,undefined);
assert.equal(evo.evolution_other_requirement,undefined);
assert.equal(evo.evolution_authority.requirement_states.evolution_sleep_hours_required,'VERIFIED_NOT_REQUIRED');
assert.equal(evo.evolution_authority.requirement_states.evolution_item_required,'VERIFIED_NOT_REQUIRED');
assert.equal(evo.evolution_authority.requirement_states.evolution_other_requirement,'VERIFIED_NOT_REQUIRED');
assert.equal(evo.evolution_authority.to_species,null,'unknown evolution target must remain unguessed');
assert.match(evolution.evolutionAuthorityLabel(evo.evolution_authority),/不需要（公版已驗證）/);
assert.equal(Object.values(evo).includes(evolution.DISPLAY_NOT_REQUIRED),false,'display sentinel must not enter writable draft values');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042710_G13_10_AI_TIMEOUT_PUBLIC_HYDRATION',
  version:'v0.4.27.10',
  checks:{
    startup_model_nonblank:true,
    stale_model_fallback:true,
    provider_timeout_failover:true,
    total_deadline:true,
    timeout_trace_secret_safe:true,
    main_skill_public_description_hydration:true,
    direct_description_preserved:true,
    evolution_required_values:true,
    verified_not_required_display_only:true,
    unknown_target_not_inferred:true,
  },
},null,2));
