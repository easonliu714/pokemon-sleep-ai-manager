import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectObservationV2ForLegacy} from '../assets/js/ai-review-queue-executor.js';
import {clearGeminiCapabilityCache,executeWithCapabilityFailover,rankGenerateContentModels} from '../assets/js/ai-provider-capability-failover.js';
import {V04278_EVOLUTION_REQUIREMENT_MASTER,resolveEvolutionAuthority,hydrateEvolutionDraft} from '../assets/js/analysis-confirmation-evolution-authority.js';

const response=(status,payload)=>({ok:status>=200&&status<300,status,statusText:status===200?'OK':'Bad Request',headers:{get:()=>null},json:async()=>payload});
const project=(alias,key,priority)=>({alias,key,fingerprint:`fp-${alias}`,priority,enabled:true,cooldown_until:null,last_used_at:null,last_error_class:null});

assert.deepEqual(rankGenerateContentModels(['models/gemini-3-pro-preview','models/gemini-2.5-flash','models/gemini-3-flash-preview'],'gemini-missing'),['gemini-2.5-flash','gemini-3-flash-preview','gemini-3-pro-preview']);

clearGeminiCapabilityCache();
const modelCalls=[];
const modelFallback=await executeWithCapabilityFailover({
  projects:[project('Project A','key-a',1)],preferredModel:'gemini-missing',prompt:'fixture',imageBase64:'ZmFrZQ==',responseJsonSchema:{type:'object'},thinkingLevel:'low',retryDelaysMs:[],
  fetchImpl:async url=>{
    modelCalls.push(url);
    if(url.includes('/models?key='))return response(200,{models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]});
    if(url.includes('gemini-2.5-flash:generateContent'))return response(200,{candidates:[]});
    throw new Error(`unexpected_url:${url}`);
  },
});
assert.equal(modelFallback.ok,true);
assert.equal(modelFallback.used_model,'gemini-2.5-flash');
assert.equal(modelFallback.model_fallback_used,true);
assert.equal(modelCalls.some(url=>url.includes('gemini-missing:generateContent')),false,'unsupported selected model must be skipped before image generation');
assert.equal(modelCalls.filter(url=>url.includes(':generateContent')).length,1);

clearGeminiCapabilityCache();
const keyCalls=[];
const keyFallback=await executeWithCapabilityFailover({
  projects:[project('Project A','bad-key',1),project('Project B','good-key',2)],preferredModel:'gemini-2.5-flash',prompt:'fixture',imageBase64:'ZmFrZQ==',retryDelaysMs:[],
  fetchImpl:async url=>{
    keyCalls.push(url);
    if(url.includes('/models?key=bad-key'))return response(400,{error:{message:'API key not valid. Please pass a valid API key.',status:'INVALID_ARGUMENT'}});
    if(url.includes('/models?key=good-key'))return response(200,{models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]});
    if(url.includes('gemini-2.5-flash:generateContent')&&url.includes('good-key'))return response(200,{candidates:[]});
    throw new Error(`unexpected_url:${url}`);
  },
});
assert.equal(keyFallback.ok,true);
assert.equal(keyFallback.used_alias,'Project B');
assert.equal(keyFallback.projects.find(row=>row.alias==='Project A')?.enabled,false,'invalid key must be disabled before image upload');
assert.equal(keyCalls.some(url=>url.includes(':generateContent')&&url.includes('bad-key')),false,'invalid key must fail fast at capability preflight');

const observation={
  schema_version:'2.0-observation',source:'ai_screenshot_observation',prompt_policy_version:null,update_id:'V04278-FIXTURE',generated_at:'2026-08-18T09:00:00.000Z',
  observations:[{
    incoming_ref:'pokemon-image-001',requested_action:'resolve_on_import',identity:{registered_date:'2026-08-18'},
    profile:{header_name_text:'小鍛匠',species:null,species_observation_basis:null,nickname:null,level:14,sp:467,specialty:'樹果',type:'妖精',nature:'勇敢',nature_bonus:'幫忙速度',nature_penalty:'EXP獲得量',main_skill:'能量填充M',main_skill_level:1,helper_seconds:3944,carry_limit:12,favorite_berry:'桃桃果',sleep_time_text:'0分鐘',sleep_hours:0},
    ingredients:[],subskills:[],audit_candidates:[],evidence:{source_image_refs:['image-001'],field_confidence:{},unreadable_fields:[],notes:null},visual_evidence:null,is_favorite:false,
  }],
};
const projected=projectObservationV2ForLegacy(observation);
assert.equal(projected.analysis.main_skill.level,1,'Observation v2 main skill Lv1 must not become 0');
assert.equal(projected.analysis.obtained_at,'2026-08-18','identity.registered_date must project into confirmation obtained_at');
assert.equal(projected.analysis.is_favorite,false,'boolean false must remain an observed value');

assert.equal(V04278_EVOLUTION_REQUIREMENT_MASTER.length,1);
assert.equal(V04278_EVOLUTION_REQUIREMENT_MASTER[0].species_name,'小鍛匠');
assert.equal(V04278_EVOLUTION_REQUIREMENT_MASTER[0].required_level,18);
assert.equal(V04278_EVOLUTION_REQUIREMENT_MASTER[0].required_candy,40);
assert.equal(Object.hasOwn(V04278_EVOLUTION_REQUIREMENT_MASTER[0],'to_species'),false,'hidden ??? target must not be invented from the supplied requirement screen');

const emptyRows=()=>[];
const authority=resolveEvolutionAuthority('小鍛匠',emptyRows);
assert.equal(authority.status,'PUBLIC_REQUIREMENT_HOTFIX_VERIFIED_ROUTE_PENDING');
const hydrated=hydrateEvolutionDraft({species:'小鍛匠',evolution_level_required:null,evolution_candy_required:null,field_evidence:{}},authority);
assert.equal(hydrated.evolution_level_required,18);
assert.equal(hydrated.evolution_candy_required,40);
assert.equal(hydrated.evolution_authority.status,'MASTER_HYDRATED');
assert.equal(hydrated.evolution_authority.to_species,null);

const conflict=hydrateEvolutionDraft({species:'小鍛匠',evolution_level_required:23,evolution_candy_required:40,field_evidence:{}},authority);
assert.equal(conflict.evolution_level_required,23,'observed conflict must never be silently overwritten by Public Master');
assert.equal(conflict.evolution_authority.status,'REVIEW_REQUIRED_OBSERVATION_MASTER_CONFLICT');
assert.equal(conflict.evolution_authority.conflicts.some(row=>row.field==='evolution_level_required'),true);

const multiRows=(sql)=>sql.includes('pokemon_evolution_master')?[{to_species:'甲',required_level:10},{to_species:'乙',required_level:20}]:[];
const multi=resolveEvolutionAuthority('分歧測試',multiRows);
assert.equal(multi.status,'MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED');
assert.equal(hydrateEvolutionDraft({species:'分歧測試',evolution_level_required:null,field_evidence:{}},multi).evolution_level_required,null,'multiple routes must not auto-fill a guessed condition');

const terminalRows=(sql)=>sql.includes('pokemon_evolution_status_master')?[{species_name:'終點測試',evolution_status:'VERIFIED_TERMINAL_CURRENT_SLEEP',verification_status:'REFERENCE_VERIFIED'}]:[];
assert.equal(resolveEvolutionAuthority('終點測試',terminalRows).status,'VERIFIED_TERMINAL_CURRENT_SLEEP');
assert.equal(resolveEvolutionAuthority('未知測試',emptyRows).status,'PUBLIC_MASTER_NOT_YET_VERIFIED');

const css=fs.readFileSync('assets/css/app.css','utf8');
for(const token of ['white-space:pre-wrap','overflow-wrap:anywhere','word-break:break-word'])assert.ok(css.includes(token),`AI JSON visual wrap missing ${token}`);
const diagnostic=fs.readFileSync('assets/js/data1d1-ocr-ai-ab-diagnostic.js','utf8');
assert.ok(diagnostic.includes('JSON.stringify(result.analysis,null,2)'),'JSON display must preserve the original serialized result');
const workbench=fs.readFileSync('assets/js/analysis-confirmation-workbench.js','utf8');
for(const token of ['resolveEvolutionAuthority','hydrateEvolutionDraft','profile.main_skill_level??raw.main_skill?.level','identity.registered_date??raw.obtained_at','data-evolution-authority-status'])assert.ok(workbench.includes(token),`confirmation workbench missing ${token}`);
const sw=fs.readFileSync('service-worker.js','utf8');
for(const token of ['./assets/js/ai-provider-capability-failover.js','./assets/js/analysis-confirmation-evolution-authority.js'])assert.ok(sw.includes(token),`offline precache missing ${token}`);

const versionSource=fs.readFileSync('assets/js/version-authority.js','utf8'),sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(versionSource,sandbox,{filename:'version-authority.js'});
assert.equal(sandbox.PokemonSleepVersionAuthority.app_version,'v0.4.27.8');
assert.equal(sandbox.PokemonSleepVersionAuthority.app_build,'20260818-v04278-ai-resilience-evolution-master-review');

console.log(JSON.stringify({
  status:'PASS',gate:'G13.8_V04278_AI_RESILIENCE_EVOLUTION_CONFIRMATION',
  invalid_key_preflight_fail_fast:true,model_capability_failover:true,main_skill_level_one_preserved:true,registered_date_projection:true,
  evolution_requirement_master:{species:'小鍛匠',level:18,candy:40,target_route_invented:false},
  evolution_master_hydration:true,observation_master_conflict_fail_closed:true,multiple_route_guessing:false,json_visual_wrap_only:true,offline_precache:true,version:'v0.4.27.8',
},null,2));
