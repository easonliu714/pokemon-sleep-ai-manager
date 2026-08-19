import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  clearGeminiCapabilityCache,
  clearGeminiModelProjectRejections,
  executeWithCapabilityFailover,
  isModelAllowedForFeature,
  rankGenerateContentModels,
} from '../assets/js/ai-provider-capability-failover.js';
import {buildPerImageAnalysisExport,AI_IMAGE_ANALYSIS_EXPORT_SCHEMA} from '../assets/js/ai-image-analysis-export.js';

const response=(status,payload)=>({ok:status>=200&&status<300,status,statusText:status===200?'OK':'Error',headers:{get:()=>null},json:async()=>payload});
const project=(alias,key,priority)=>({alias,key,fingerprint:`fp-${alias}`,priority,enabled:true,cooldown_until:null,last_used_at:null,last_error_class:null});

// Release authority.
const versionSource=fs.readFileSync('assets/js/version-authority.js','utf8'),sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(versionSource,sandbox,{filename:'version-authority.js'});
assert.equal(sandbox.PokemonSleepVersionAuthority.app_version,'v0.4.27.13');
assert.equal(sandbox.PokemonSleepVersionAuthority.app_build,'20260819-v042713-physical-validation-closure');

// 1. Active review group navigation must be stateful, not an empty-group button only.
const multi=fs.readFileSync('assets/js/data-consistency-multicapture.js','utf8');
for(const token of ['function selectGroup(','function advanceReviewGroup(','function closeActiveGroup(','pokemon-sleep:analysis-confirmation-group-selected','confirmation_group_advanced','confirmation_group_closed'])assert.ok(multi.includes(token),`multi-capture navigation missing ${token}`);
const workbench=fs.readFileSync('assets/js/analysis-confirmation-workbench.js','utf8');
for(const token of ['let currentGroupId=null','pokemon-sleep:analysis-confirmation-group-selected','confirmation_group_rendered','if(globalThis.PokemonSleepMultiCaptureConsistency)return'])assert.ok(workbench.includes(token),`confirmation workbench missing ${token}`);

// 2. Progress must be event-driven and AI-only must mark OCR skipped.
const unified=fs.readFileSync('assets/js/unified-import-analysis-workbench.js','utf8');
const statusUi=fs.readFileSync('assets/js/ai-review-executor-status-ui.js','utf8');
for(const token of ['pokemon-sleep:unified-analysis-stage','publishStage(\'ai\',\'running\'','publishStage(\'ocr\',[\'ai_only\',\'existing\'].includes(mode)?\'skipped\''])assert.ok(unified.includes(token),`unified progress producer missing ${token}`);
for(const token of ["skipped:'略過'",'pokemon-sleep:unified-analysis-stage','unifiedState.event_authoritative=true','pokemon-sleep:ai-capability-model-event'])assert.ok(statusUi.includes(token),`event-driven status UI missing ${token}`);

// 3. Roster display name must fall back to species without rewriting SQLite.
const roster=fs.readFileSync('assets/js/pokemon-roster-filter-ui.js','utf8');
assert.ok(roster.includes('resolvePokemonRosterDisplayName'));
assert.ok(roster.includes('[pokemon?.original_label,pokemon?.species,pokemon?.nickname]'));
assert.ok(roster.includes('applyRosterNameFallback'));

// 4. Feature-model capability guard must reject image-generation/audio-only models.
assert.equal(isModelAllowedForFeature('gemini-2.5-flash','pokemon_visual_json'),true);
assert.equal(isModelAllowedForFeature('gemini-2.5-flash-image','pokemon_visual_json'),false);
assert.equal(isModelAllowedForFeature('gemini-2.5-flash-preview-image','uc_img_ingredient'),false);
assert.equal(isModelAllowedForFeature('gemini-2.5-flash-native-audio','uc_img_ingredient'),false);
assert.deepEqual(rankGenerateContentModels(['gemini-2.5-flash-image','gemini-3.6-flash','gemini-2.5-flash'],'gemini-2.5-flash','visual_json'),['gemini-2.5-flash','gemini-3.6-flash']);

// A model may be listed but return 404 for only some Projects. Those exact pairs must be quarantined.
clearGeminiCapabilityCache();clearGeminiModelProjectRejections();
const calls=[];
const catalog={models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.6-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-flash-image',supportedGenerationMethods:['generateContent']}]};
const okPayload={candidates:[{content:{parts:[{text:'{}'}]}}]};
const fetchImpl=async url=>{
  calls.push(String(url));
  if(String(url).includes('/models?key='))return response(200,catalog);
  if(String(url).includes('gemini-2.5-flash:generateContent')&&(String(url).includes('key-a')||String(url).includes('key-b')))return response(404,{error:{message:'model unavailable for this project'}});
  if(String(url).includes('gemini-2.5-flash:generateContent')&&String(url).includes('key-c'))return response(200,okPayload);
  if(String(url).includes('gemini-3.6-flash:generateContent'))return response(200,okPayload);
  throw new Error(`unexpected_url:${url}`);
};
const pool=[project('A','key-a',1),project('B','key-b',2),project('C','key-c',3)];
const first=await executeWithCapabilityFailover({projects:pool,preferredModel:'gemini-2.5-flash',feature:'pokemon_visual_json',prompt:'x',imageBase64:'AA==',fetchImpl,retryDelaysMs:[],maxProjectFailovers:2,totalTimeoutMs:5000,modelCandidateTimeoutMs:3000});
assert.equal(first.ok,true);assert.equal(first.used_model,'gemini-2.5-flash');assert.equal(first.used_alias,'C');
const aBefore=calls.filter(url=>url.includes('gemini-2.5-flash:generateContent')&&url.includes('key-a')).length;
const bBefore=calls.filter(url=>url.includes('gemini-2.5-flash:generateContent')&&url.includes('key-b')).length;
const second=await executeWithCapabilityFailover({projects:pool,preferredModel:'gemini-2.5-flash',feature:'pokemon_visual_json',prompt:'x',imageBase64:'AA==',fetchImpl,retryDelaysMs:[],maxProjectFailovers:2,totalTimeoutMs:5000,modelCandidateTimeoutMs:3000});
assert.equal(second.ok,true);assert.equal(second.used_alias,'C');
assert.equal(calls.filter(url=>url.includes('gemini-2.5-flash:generateContent')&&url.includes('key-a')).length,aBefore,'quarantined A/model pair must not repeat');
assert.equal(calls.filter(url=>url.includes('gemini-2.5-flash:generateContent')&&url.includes('key-b')).length,bBefore,'quarantined B/model pair must not repeat');
assert.equal(calls.some(url=>url.includes('gemini-2.5-flash-image:generateContent')),false,'image-generation model must not enter visual JSON fallback');
const ucAdapter=fs.readFileSync('assets/js/uc-img-gemini-adapter.js','utf8');
assert.ok(ucAdapter.includes("import {executeWithCapabilityFailover}"));
assert.ok(ucAdapter.includes('preferredModel:model'));
assert.ok(ucAdapter.includes('const feature=`uc_img_${scenarioKey}`'));

// 5. Per-image JSON export includes result + model process but never provider secrets.
assert.equal(AI_IMAGE_ANALYSIS_EXPORT_SCHEMA,'pokemon-sleep-ai-image-analysis-export/1.0');
const exported=buildPerImageAnalysisExport({
  item:{sha256:'sha',file_name:'fixture.png',source_image_ref:'fixture.png'},
  revision:{analysis_id:'a1',revision_no:2,analysis_type:'ai',provider:'gemini',model:'gemini-2.5-flash',result:{analysis:{schema_version:'2.0-observation',observations:[]}}},
  selectedModel:'gemini-3.6-flash',
  execution:{outcome:{results:[{model:'gemini-2.5-flash',preferred_model:'gemini-3.6-flash',model_fallback_used:true,project_alias:'Project C',provider_elapsed_ms:1234,analysis:{schema_version:'2.0-observation',observations:[]}}]}},
  modelEvents:[{event:'ai_model_failover',from_model:'gemini-3.6-flash',to_model:'gemini-2.5-flash',error_class:'provider_timeout'}],
});
assert.equal(exported.provider_process.actual_model,'gemini-2.5-flash');
assert.equal(exported.provider_process.model_fallback_used,true);
assert.equal(exported.safety.api_key_included,false);
assert.equal(JSON.stringify(exported).includes('api_key'),true,'safety field is expected');
assert.equal(JSON.stringify(exported).includes('key-a'),false);
assert.ok(unified.includes('buildPerImageAnalysisExport'));
assert.ok(unified.includes('匯出最新 AI JSON'));
assert.ok(unified.includes('匯出 JSON'));

// Numeric production authority remains unchanged at 4/7; this hotfix is UX/runtime only.
const production=fs.readFileSync('assets/js/production-authority-registry.js','utf8');
for(const token of ["ingredient_probability_per_help',status:'NOT_YET_VERIFIED'","main_skill_trigger_probability:Object.freeze({dimension:'main_skill_trigger_probability',status:'NOT_YET_VERIFIED'","main_skill_effect_value:Object.freeze({dimension:'main_skill_effect_value',status:'NOT_YET_VERIFIED'"])assert.ok(production.includes(token),`production boundary changed unexpectedly: ${token}`);

const sw=fs.readFileSync('service-worker.js','utf8');
assert.ok(sw.includes("'./assets/js/ai-image-analysis-export.js'"),'new per-image export runtime must be offline cached');

console.log(JSON.stringify({status:'PASS',gate:'V042713_PHYSICAL_VALIDATION_CLOSURE',checks:{active_review_group_navigation:true,event_driven_progress:true,roster_name_fallback:true,feature_model_capability_guard:true,project_model_404_quarantine:true,per_image_json_export:true,production_numeric_authority:'4/7'}},null,2));