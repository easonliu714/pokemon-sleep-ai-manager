import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildGeminiGenerateBody,
  normalizeGeminiImages,
} from '../assets/js/ai-project-pool-runtime.js';
import {
  UC_IMG_GEMINI_ADAPTER_VERSION,
  analyzeUcImgScenarioWithGemini,
  buildUcImgDiagnosticBundle,
  buildUcImgGeminiSchema,
  extractGeminiJsonText,
} from '../assets/js/uc-img-gemini-adapter.js';
import {
  UC_IMG_A_SCENARIOS,
  createScreenshotUpdateSession,
  addScreenshotEntry,
  assignScreenshotScenario,
  setScenarioAiMode,
  serializableScreenshotSession,
  buildScreenshotScenarioPrompt,
  validateScreenshotScenarioPayload,
} from '../assets/js/unified-screenshot-update-center.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
} from '../assets/js/public-master-recognition.js';

const iso='2026-08-11T03:20:00.000Z';
const snapshot=buildPublicMasterCatalogSnapshot('ingredients');
const recognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'ingredient_inventory_update',
  authority:'ingredient_master',
  data_version:snapshot.data_version,
  catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:iso,
  visible_target_count:2,
  observations:[
    {observation_id:'obs-1',status:'MATCHED',observed_text:'甜甜蜜',observed_data:{quantity:34},canonical_key:{ingredient_name:'甜甜蜜'},canonical_name:'甜甜蜜',candidate_names:['甜甜蜜'],source_image_ref:'image-001',confidence:0.99,reason:'exact'},
    {observation_id:'obs-2',status:'MATCHED',observed_text:'好眠番茄',observed_data:{quantity:14},canonical_key:{ingredient_name:'好眠番茄'},canonical_name:'好眠番茄',candidate_names:['好眠番茄'],source_image_ref:'image-002',confidence:0.98,reason:'exact'},
  ],
};
const providerPayload={candidates:[{content:{parts:[{text:JSON.stringify(recognition)}]}}]};

assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-11-b-public-master-recognition');
const schema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.ingredients,'ingredients');
assert.deepEqual(schema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);
assert.deepEqual(schema.properties.authority.enum,['ingredient_master']);
assert.deepEqual(schema.properties.scenario.enum,['ingredient_inventory_update']);
assert.deepEqual(schema.properties.observations.items.properties.status.enum,['MATCHED','AMBIGUOUS','UNMATCHED']);
assert.equal(schema.properties.observations.items.properties.canonical_key.properties.ingredient_name.enum.length,19);
assert.equal('ingredient_id' in schema.properties.observations.items.properties.canonical_key.properties,false);

const weeklySchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.weekly,'weekly');
assert.deepEqual(weeklySchema.properties.schema_version.enum,['1.1']);
assert.deepEqual(weeklySchema.properties.scenario.enum,['weekly_context_update']);

const multiBody=buildGeminiGenerateBody({prompt:'multi',images:[
  {imageRef:'image-001',fileName:'ingredient-1.png',data:'AQ==',mimeType:'image/png'},
  {imageRef:'image-002',fileName:'ingredient-2.jpg',data:'Ag==',mimeType:'image/jpeg'},
],responseJsonSchema:schema});
assert.equal(multiBody.contents[0].parts.length,5,'prompt + two image-ref labels + two images');
assert.match(multiBody.contents[0].parts[1].text,/image_ref=image-001/);
assert.match(multiBody.contents[0].parts[1].text,/file=ingredient-1\.png/);
assert.equal(multiBody.contents[0].parts[2].inlineData.mimeType,'image/png');
assert.match(multiBody.contents[0].parts[3].text,/image_ref=image-002/);
assert.match(multiBody.contents[0].parts[3].text,/file=ingredient-2\.jpg/);
assert.equal(multiBody.contents[0].parts[4].inlineData.mimeType,'image/jpeg');
assert.equal(multiBody.generationConfig.responseMimeType,'application/json');
assert.deepEqual(multiBody.generationConfig.responseJsonSchema,schema);

const legacyBody=buildGeminiGenerateBody({prompt:'legacy',imageBase64:'AQ==',mimeType:'image/png'});
assert.equal(legacyBody.contents[0].parts.length,2,'legacy single-image caller remains unchanged');
assert.equal(legacyBody.contents[0].parts[1].inlineData.data,'AQ==');
assert.equal('responseJsonSchema' in legacyBody.generationConfig,false);
const legacyNormalized=normalizeGeminiImages({imageBase64:'AQ=='});
assert.equal(legacyNormalized.length,1);assert.equal(legacyNormalized[0].imageRef,null);
assert.equal(extractGeminiJsonText(providerPayload),JSON.stringify(recognition));

const session=createScreenshotUpdateSession();
const first=addScreenshotEntry(session,{name:'ingredient-1.png',size:2,type:'image/png'});
const second=addScreenshotEntry(session,{name:'ingredient-2.jpg',size:2,type:'image/jpeg'});
assignScreenshotScenario(session,first.entry_id,'ingredients');
assignScreenshotScenario(session,second.entry_id,'ingredients');
setScenarioAiMode(session,'ingredients','internal');
assert.equal(session.scenario_state.ingredients.ai_mode,'internal');
const prompt=buildScreenshotScenarioPrompt(session,'ingredients');
assert.match(prompt,/Public Master Constrained Recognition/);
assert.match(prompt,/ingredient_master/);
assert.match(prompt,/沉甸甸南瓜/);
assert.match(prompt,/UNMATCHED/);
assert.equal(prompt.includes('operations'),true,'prompt explains platform compilation boundary');

const fileMap=new Map([
  [first.entry_id,new Blob([new Uint8Array([1,2])],{type:'image/png'})],
  [second.entry_id,new Blob([new Uint8Array([3,4])],{type:'image/jpeg'})],
]);
let captured=null;
const fakeExecute=async args=>{
  captured=args;
  return {ok:true,payload:providerPayload,projects:args.projects,used_alias:'Project A',attempts:[]};
};
const poolData={model:'gemini-test-flash',projects:[{alias:'Project A',key:'AIza-SECRET-MUST-NOT-LEAK',priority:1,enabled:true}]};
const analysis=await analyzeUcImgScenarioWithGemini({
  scenarioKey:'ingredients',config:UC_IMG_A_SCENARIOS.ingredients,
  entries:[first,second],fileMap,prompt,poolData,execute:fakeExecute,
});
assert.equal(captured.images.length,2);
assert.equal(captured.images[0].imageRef,'image-001');
assert.equal(captured.images[0].fileName,'ingredient-1.png');
assert.equal(captured.images[1].imageRef,'image-002');
assert.equal(captured.images[1].fileName,'ingredient-2.jpg');
assert.deepEqual(captured.responseJsonSchema,schema);
assert.equal(analysis.model,'gemini-test-flash');
assert.equal(analysis.project_alias,'Project A');
assert.equal(analysis.response_contract,'public-master-recognition');
assert.deepEqual(analysis.payload,recognition);

const validation=validateScreenshotScenarioPayload(session,'ingredients',analysis.payload);
assert.equal(validation.errors.length,0,validation.errors.join('\n'));
assert.equal(validation.review.length,0);
assert.equal(validation.summary.traceable_evidence,true);
assert.equal(validation.summary.recognition_contract,true);
assert.equal(validation.summary.recognition_matched_count,2);
assert.equal(validation.summary.recognition_unresolved_count,0);
assert.equal(validation.payload.operations.length,2,'platform must compile two executable operations');
assert.deepEqual(validation.payload.operations.map(op=>op.key.ingredient_name),['甜甜蜜','好眠番茄']);

session.scenario_state.ingredients.raw_response=analysis.raw_json;
session.scenario_state.ingredients.provider_meta={provider:'gemini',model:analysis.model,project_alias:analysis.project_alias,image_count:analysis.image_count,response_contract:analysis.response_contract};
const diagnostic=buildUcImgDiagnosticBundle({appVersion:'v0.4.11',session,scenarioKey:'ingredients',config:UC_IMG_A_SCENARIOS.ingredients,coverage:session.coverage.ingredients,rawResponse:analysis.raw_json,validation,providerMeta:session.scenario_state.ingredients.provider_meta});
const diagnosticText=JSON.stringify(diagnostic);
assert.equal(diagnostic.response_contract,'public-master-recognition');
assert.equal(diagnostic.safety.api_key_included,false);
assert.equal(diagnostic.safety.screenshot_bytes_included,false);
assert.equal(diagnosticText.includes('AIza-SECRET-MUST-NOT-LEAK'),false,'diagnostic must not contain API key');
assert.equal(diagnosticText.includes('AQ=='),false,'diagnostic must not contain image bytes');

first.object_url='blob:private-1';first.image_available=true;
const persisted=serializableScreenshotSession(session);
assert.equal(persisted.entries[0].object_url,null);
assert.equal(persisted.entries[0].image_available,false);
assert.equal(JSON.stringify(persisted).includes('AIza-SECRET-MUST-NOT-LEAK'),false);

const adapterSource=fs.readFileSync(new URL('../assets/js/uc-img-gemini-adapter.js',import.meta.url),'utf8');
for(const forbidden of ['applyPayload','dryRun','importer.js','indexedDB','localStorage'])assert.equal(adapterSource.includes(forbidden),false,`Gemini adapter must not own ${forbidden}`);
const uiSource=fs.readFileSync(new URL('../assets/js/unified-screenshot-update-center.js',import.meta.url),'utf8');
for(const token of ['Gemini API 直接分析','外部 AI Prompt','runtime.files','buildUcImgDiagnosticBundle','validateScreenshotScenarioPayload','compilePublicMasterRecognitionToUpdatePackage','dryRun','applyPayload'])assert.ok(uiSource.includes(token),`dual-mode UI missing ${token}`);
assert.equal((uiSource.match(/applyPayload\(/g)||[]).length,1,'there must remain exactly one UC.IMG Apply bridge');

console.log(JSON.stringify({
  status:'PASS',gate:'UC.IMG_INTERNAL_GEMINI_DUAL_MODE',
  adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
  public_master_recognition:true,
  recognition_to_update_package_compile:true,
  multi_image_structured_output:true,
  multi_image_ref_labels:true,
  legacy_single_image_compatible:true,
  direct_ai_apply_bypass:false,
  api_key_in_diagnostic:false,
  screenshot_bytes_persisted:false,
  external_prompt_fallback:true,
},null,2));
