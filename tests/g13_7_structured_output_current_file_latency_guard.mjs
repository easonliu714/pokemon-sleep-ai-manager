import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGeminiGenerateBody} from '../assets/js/ai-project-pool-runtime.js';
import {AI_OBSERVATION_RESPONSE_JSON_SCHEMA,projectObservationV2ForLegacy} from '../assets/js/ai-review-queue-executor.js';

const read=path=>fs.readFileSync(path,'utf8');

assert.equal(AI_OBSERVATION_RESPONSE_JSON_SCHEMA.type,'object');
assert.ok(AI_OBSERVATION_RESPONSE_JSON_SCHEMA.required.includes('schema_version'));
assert.ok(AI_OBSERVATION_RESPONSE_JSON_SCHEMA.required.includes('source'));
assert.ok(AI_OBSERVATION_RESPONSE_JSON_SCHEMA.required.includes('observations'));
assert.deepEqual(AI_OBSERVATION_RESPONSE_JSON_SCHEMA.properties.schema_version.enum,['2.0-observation']);
assert.deepEqual(AI_OBSERVATION_RESPONSE_JSON_SCHEMA.properties.source.enum,['ai_screenshot_observation']);
assert.equal(AI_OBSERVATION_RESPONSE_JSON_SCHEMA.properties.observations.minItems,1);
assert.equal(AI_OBSERVATION_RESPONSE_JSON_SCHEMA.properties.observations.maxItems,1);

const structured=buildGeminiGenerateBody({
  prompt:'fixture',
  imageBase64:'ZmFrZQ==',
  responseJsonSchema:AI_OBSERVATION_RESPONSE_JSON_SCHEMA,
  thinkingLevel:'low',
});
assert.equal(structured.generationConfig.responseMimeType,'application/json');
assert.deepEqual(structured.generationConfig.responseJsonSchema,AI_OBSERVATION_RESPONSE_JSON_SCHEMA);
assert.deepEqual(structured.generationConfig.thinkingConfig,{thinkingLevel:'low'});

const legacyCompatible=buildGeminiGenerateBody({prompt:'fixture',imageBase64:'ZmFrZQ=='});
assert.equal(Object.hasOwn(legacyCompatible.generationConfig,'thinkingConfig'),false,'thinkingConfig must stay opt-in for models that may not support it');
assert.equal(Object.hasOwn(legacyCompatible.generationConfig,'responseJsonSchema'),false,'structured schema must stay opt-in outside governed observation calls');

const rejected=projectObservationV2ForLegacy({screen_type:'pokemon_details',pokemon_name:'fixture'});
assert.equal(rejected.contract_status,'REVIEW_REQUIRED');
assert.equal(rejected.analysis.internal_compatibility.reason,'AI_OUTPUT_NOT_OBSERVATION_V2');
assert.equal(rejected.analysis.observations.length,0);

const executor=read('assets/js/ai-review-queue-executor.js');
for(const token of [
  'responseJsonSchema:AI_OBSERVATION_RESPONSE_JSON_SCHEMA',
  "?'low':null",
  "phase:'started'",
  'file_name:fileName',
  'source_image_ref:sourceImageRef',
  'structured_output:true',
  'provider_elapsed_ms',
])assert.ok(executor.includes(token),`G13.7 executor missing ${token}`);

const runtime=read('assets/js/ai-project-pool-runtime.js');
for(const token of ['thinkingLevel=null','generationConfig.thinkingConfig={thinkingLevel:clean(thinkingLevel)}','thinking_level:clean(thinkingLevel)||null'])assert.ok(runtime.includes(token),`G13.7 Gemini runtime missing ${token}`);

const diagnostic=read('assets/js/data1d1-ocr-ai-ab-diagnostic.js');
for(const token of ['batchIndex=1,batchTotal=1','AI ${batchIndex}/${batchTotal}：${name}','｜等待 ${Math.max','檔案：${escapeHtml(name)}'])assert.ok(diagnostic.includes(token),`G13.7 local progress missing ${token}`);

const workbench=read('assets/js/unified-import-analysis-workbench.js');
assert.ok(workbench.includes("globalThis.PokemonSleepVersionAuthority?.app_version||'unknown'"),'Unified workbench must consume central version authority');
assert.equal(workbench.includes("const VERSION='v0.3.75'"),false,'Unified workbench must not roll visible version back to stale local constant');
assert.ok(workbench.includes('runAi(item,preset,status,results,index+1,chosen.length)'),'Unified workbench must preserve batch index/total into AI status');

const version=read('assets/js/version-authority.js');
assert.ok(version.includes("app_version: 'v0.4.27.7'"));
assert.ok(version.includes("app_build: '20260818-v04277-g13-structured-output-current-file-ux'"));
assert.ok(version.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.7-v04277-g13-structured-output-current-file-ux'"));

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.7_STRUCTURED_OUTPUT_CURRENT_FILE_LATENCY_GUARD',
  structured_observation_v2:true,
  minimum_observation_count:1,
  gemini3_low_thinking:true,
  legacy_thinking_path_untouched:true,
  current_filename_visible:true,
  elapsed_seconds_visible:true,
  fail_closed_preserved:true,
  central_version:'v0.4.27.7',
},null,2));