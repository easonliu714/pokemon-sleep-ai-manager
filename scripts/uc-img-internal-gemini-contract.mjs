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

const iso='2026-08-11T01:30:00.000Z';
const payload={
  schema_version:'1.1',
  update_id:'TEST-INTERNAL-GEMINI',
  generated_at:iso,
  source:'ai_screenshot_analysis',
  scenario:'ingredient_inventory_update',
  update_policy:{blank_values:'preserve_existing',missing_fields:'no_change',explicit_zero_and_false:'write_value',identity_resolution:'platform'},
  profile_audit_confirmations:[],
  operations:[{
    operation_id:'OP-001',entity:'ingredient_inventory',action:'upsert',
    key:{ingredient_name:'甜甜蜜'},data:{quantity:34},clear_fields:[],
    evidence:{source_type:'screenshot',source_image_ref:'image-001',source_image_refs:['image-001','image-002'],confidence:0.99},
    review_required:false,user_audit:{accepted_current_observation:true},
  }],
};
const providerPayload={candidates:[{content:{parts:[{text:JSON.stringify(payload)}]}}]};

assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-11-a');
const schema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.ingredients,'ingredients');
assert.deepEqual(schema.properties.schema_version.enum,['1.1']);
assert.deepEqual(schema.properties.source.enum,['ai_screenshot_analysis']);
assert.deepEqual(schema.properties.scenario.enum,['ingredient_inventory_update']);
assert.deepEqual(schema.properties.operations.items.properties.entity.enum,['ingredient_inventory','account_capacity']);
assert.deepEqual(schema.properties.operations.items.properties.action.enum,['upsert']);

const multiBody=buildGeminiGenerateBody({prompt:'multi',images:[{data:'AQ==',mimeType:'image/png'},{data:'Ag==',mimeType:'image/jpeg'}],responseJsonSchema:schema});
assert.equal(multiBody.contents[0].parts.length,3,'prompt + two images');
assert.equal(multiBody.contents[0].parts[1].inlineData.mimeType,'image/png');
assert.equal(multiBody.contents[0].parts[2].inlineData.mimeType,'image/jpeg');
assert.equal(multiBody.generationConfig.responseMimeType,'application/json');
assert.deepEqual(multiBody.generationConfig.responseJsonSchema,schema);

const legacyBody=buildGeminiGenerateBody({prompt:'legacy',imageBase64:'AQ==',mimeType:'image/png'});
assert.equal(legacyBody.contents[0].parts.length,2,'legacy single-image caller remains supported');
assert.equal(legacyBody.contents[0].parts[1].inlineData.data,'AQ==');
assert.equal('responseJsonSchema' in legacyBody.generationConfig,false);
assert.equal(normalizeGeminiImages({imageBase64:'AQ=='}).length,1);
assert.equal(extractGeminiJsonText(providerPayload),JSON.stringify(payload));

const session=createScreenshotUpdateSession();
const first=addScreenshotEntry(session,{name:'ingredient-1.png',size:2,type:'image/png'});
const second=addScreenshotEntry(session,{name:'ingredient-2.jpg',size:2,type:'image/jpeg'});
assignScreenshotScenario(session,first.entry_id,'ingredients');
assignScreenshotScenario(session,second.entry_id,'ingredients');
setScenarioAiMode(session,'ingredients','internal');
assert.equal(session.scenario_state.ingredients.ai_mode,'internal');
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
  entries:[first,second],fileMap,prompt:buildScreenshotScenarioPrompt(session,'ingredients'),poolData,execute:fakeExecute,
});
assert.equal(captured.images.length,2);
assert.equal(captured.images[0].imageRef,'image-001');
assert.equal(captured.images[1].imageRef,'image-002');
assert.deepEqual(captured.responseJsonSchema,schema);
assert.equal(analysis.model,'gemini-test-flash');
assert.equal(analysis.project_alias,'Project A');
assert.deepEqual(analysis.payload,payload);

const validation=validateScreenshotScenarioPayload(session,'ingredients',analysis.payload);
assert.equal(validation.errors.length,0,validation.errors.join('\n'));
assert.equal(validation.review.length,0);
assert.equal(validation.summary.traceable_evidence,true);

session.scenario_state.ingredients.raw_response=analysis.raw_json;
session.scenario_state.ingredients.provider_meta={provider:'gemini',model:analysis.model,project_alias:analysis.project_alias,image_count:analysis.image_count};
const diagnostic=buildUcImgDiagnosticBundle({appVersion:'v0.4.10.2',session,scenarioKey:'ingredients',config:UC_IMG_A_SCENARIOS.ingredients,coverage:session.coverage.ingredients,rawResponse:analysis.raw_json,validation,providerMeta:session.scenario_state.ingredients.provider_meta});
const diagnosticText=JSON.stringify(diagnostic);
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
for(const token of ['Gemini API 直接分析','外部 AI Prompt','runtime.files','buildUcImgDiagnosticBundle','validateScreenshotScenarioPayload','dryRun','applyPayload'])assert.ok(uiSource.includes(token),`dual-mode UI missing ${token}`);
assert.equal((uiSource.match(/applyPayload\(/g)||[]).length,1,'there must remain exactly one UC.IMG Apply bridge');

console.log(JSON.stringify({
  status:'PASS',gate:'UC.IMG_INTERNAL_GEMINI_DUAL_MODE',
  adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
  multi_image_structured_output:true,
  legacy_single_image_compatible:true,
  existing_validator_bridge:true,
  direct_ai_apply_bypass:false,
  api_key_in_diagnostic:false,
  screenshot_bytes_persisted:false,
  external_prompt_fallback:true,
},null,2));
