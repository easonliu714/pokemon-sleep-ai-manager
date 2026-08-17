import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGeminiGenerateBody,normalizeGeminiImages} from '../assets/js/ai-project-pool-runtime.js';
import {UC_IMG_GEMINI_ADAPTER_VERSION,UC_IMG_DIAGNOSTIC_SCHEMA,analyzeUcImgScenarioWithGemini,buildUcImgDiagnosticBundle,buildUcImgGeminiSchema,extractGeminiJsonText} from '../assets/js/uc-img-gemini-adapter.js';
import {SCREENSHOT_PROMPT_SAFETY_VERSION} from '../assets/js/pokemon-visual-prompt-policy.js';
import {UC_IMG_A_SCENARIOS,createScreenshotUpdateSession,addScreenshotEntry,assignScreenshotScenario,setScenarioAiMode,serializableScreenshotSession,buildScreenshotScenarioPrompt,validateScreenshotScenarioPayload} from '../assets/js/unified-screenshot-update-center.js';
import {PUBLIC_MASTER_RECOGNITION_SCHEMA,PUBLIC_MASTER_RECOGNITION_VERSION,buildPublicMasterCatalogSnapshot} from '../assets/js/public-master-recognition.js';
import {buildUcImgWeeklyPlatformAuthority} from '../assets/js/uc-img-weekly-platform-authority.js';

const iso='2026-08-11T03:20:00.000Z';
const snapshot=buildPublicMasterCatalogSnapshot('ingredients');
const recognition={schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'ingredient_inventory_update',authority:'ingredient_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,generated_at:iso,visible_target_count:2,observations:[
  {observation_id:'obs-1',status:'MATCHED',observed_text:'甜甜蜜',observed_data:{quantity:34},canonical_key:{ingredient_name:'甜甜蜜'},canonical_name:'甜甜蜜',candidate_names:['甜甜蜜'],source_image_ref:'image-001',confidence:0.99,reason:'exact'},
  {observation_id:'obs-2',status:'MATCHED',observed_text:'好眠番茄',observed_data:{quantity:14},canonical_key:{ingredient_name:'好眠番茄'},canonical_name:'好眠番茄',candidate_names:['好眠番茄'],source_image_ref:'image-002',confidence:0.98,reason:'exact'},
]};
const providerPayload={candidates:[{content:{parts:[{text:JSON.stringify(recognition)}]}}]};

const successorVersions=[
  'uc-img-gemini-2026-08-11-b-public-master-recognition',
  'uc-img-gemini-2026-08-12-a-pot-capacity-authority',
  'uc-img-gemini-2026-08-12-b-shared-transport-diagnostic',
  'uc-img-gemini-2026-08-15-c-prompt-safety-contract',
  'uc-img-gemini-2026-08-17-d-live-recovery-schema',
];
assert.ok(successorVersions.includes(UC_IMG_GEMINI_ADAPTER_VERSION));
const potCapacityAdapter=!['uc-img-gemini-2026-08-11-b-public-master-recognition'].includes(UC_IMG_GEMINI_ADAPTER_VERSION);
const promptSafetyAdapter=['uc-img-gemini-2026-08-15-c-prompt-safety-contract','uc-img-gemini-2026-08-17-d-live-recovery-schema'].includes(UC_IMG_GEMINI_ADAPTER_VERSION);
const schema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.ingredients,'ingredients');
assert.deepEqual(schema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);assert.deepEqual(schema.properties.authority.enum,['ingredient_master']);assert.deepEqual(schema.properties.scenario.enum,['ingredient_inventory_update']);assert.deepEqual(schema.properties.observations.items.properties.status.enum,['MATCHED','AMBIGUOUS','UNMATCHED']);assert.equal(schema.properties.observations.items.properties.canonical_key.properties.ingredient_name.enum.length,19);assert.equal('ingredient_id' in schema.properties.observations.items.properties.canonical_key.properties,false);assert.equal('capacity_observations' in schema.properties,false,'ingredient recognition must not inherit recipe pot-capacity observations');

const recipeSchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.recipes,'recipes');
if(potCapacityAdapter){
  assert.ok(recipeSchema.properties.capacity_observations,'recipe recognition must expose optional pot-capacity observations');
  const cap=recipeSchema.properties.capacity_observations.items.properties;
  assert.deepEqual(cap.capacity_key.enum,['pot']);assert.equal(cap.total_capacity.minimum,1);assert.deepEqual(cap.observation_context.enum,['RECIPE_SCREEN_BASE_POT_CAPACITY']);
}
const weeklyPlatformAuthority=buildUcImgWeeklyPlatformAuthority(new Date('2026-08-17T01:00:00.000Z'));
const weeklySchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.weekly,'weekly',{platformAuthority:weeklyPlatformAuthority});assert.deepEqual(weeklySchema.properties.schema_version.enum,['1.1']);assert.deepEqual(weeklySchema.properties.scenario.enum,['weekly_context_update']);assert.equal('capacity_observations' in weeklySchema.properties,false,'Weekly recognition must not gain base-pot authority');
if(UC_IMG_GEMINI_ADAPTER_VERSION==='uc-img-gemini-2026-08-17-d-live-recovery-schema'){
  const weeklyData=weeklySchema.properties.operations.items.properties.data.properties;
  for(const key of ['camp','dish_category','event_name','event_effects','base_notes'])assert.ok(weeklyData[key],`live semantic schema missing ${key}`);
  assert.equal('pot_size' in weeklyData,false,'Internal Weekly schema must not reclaim account pot authority');
}

const multiBody=buildGeminiGenerateBody({prompt:'multi',images:[{imageRef:'image-001',fileName:'ingredient-1.png',data:'AQ==',mimeType:'image/png'},{imageRef:'image-002',fileName:'ingredient-2.jpg',data:'Ag==',mimeType:'image/jpeg'}],responseJsonSchema:schema});
assert.equal(multiBody.contents[0].parts.length,5,'prompt + two image-ref labels + two images');assert.match(multiBody.contents[0].parts[1].text,/image_ref=image-001/);assert.match(multiBody.contents[0].parts[1].text,/file=ingredient-1\.png/);assert.equal(multiBody.contents[0].parts[2].inlineData.mimeType,'image/png');assert.match(multiBody.contents[0].parts[3].text,/image_ref=image-002/);assert.match(multiBody.contents[0].parts[3].text,/file=ingredient-2\.jpg/);assert.equal(multiBody.contents[0].parts[4].inlineData.mimeType,'image/jpeg');assert.equal(multiBody.generationConfig.responseMimeType,'application/json');assert.deepEqual(multiBody.generationConfig.responseJsonSchema,schema);
const legacyBody=buildGeminiGenerateBody({prompt:'legacy',imageBase64:'AQ==',mimeType:'image/png'});assert.equal(legacyBody.contents[0].parts.length,2);assert.equal(legacyBody.contents[0].parts[1].inlineData.data,'AQ==');assert.equal('responseJsonSchema' in legacyBody.generationConfig,false);const legacyNormalized=normalizeGeminiImages({imageBase64:'AQ=='});assert.equal(legacyNormalized.length,1);assert.equal(legacyNormalized[0].imageRef,null);assert.equal(extractGeminiJsonText(providerPayload),JSON.stringify(recognition));

const session=createScreenshotUpdateSession();const first=addScreenshotEntry(session,{name:'ingredient-1.png',size:2,type:'image/png'});const second=addScreenshotEntry(session,{name:'ingredient-2.jpg',size:2,type:'image/jpeg'});assignScreenshotScenario(session,first.entry_id,'ingredients');assignScreenshotScenario(session,second.entry_id,'ingredients');setScenarioAiMode(session,'ingredients','internal');assert.equal(session.scenario_state.ingredients.ai_mode,'internal');const prompt=buildScreenshotScenarioPrompt(session,'ingredients');assert.match(prompt,/Public Master Constrained Recognition/);assert.match(prompt,/ingredient_master/);assert.match(prompt,/沉甸甸南瓜/);assert.match(prompt,/UNMATCHED/);assert.equal(prompt.includes('operations'),true);

const fileMap=new Map([[first.entry_id,new Blob([new Uint8Array([1,2])],{type:'image/png'})],[second.entry_id,new Blob([new Uint8Array([3,4])],{type:'image/jpeg'})]]);
let captured=null;const fakeExecute=async args=>{captured=args;return {ok:true,payload:providerPayload,projects:args.projects,used_alias:'Project A',attempts:[]};};const poolData={model:'gemini-test-flash',projects:[{alias:'Project A',key:'AIza-SECRET-MUST-NOT-LEAK',priority:1,enabled:true}]};
const analysis=await analyzeUcImgScenarioWithGemini({scenarioKey:'ingredients',config:UC_IMG_A_SCENARIOS.ingredients,entries:[first,second],fileMap,prompt,poolData,execute:fakeExecute});
assert.equal(captured.images.length,2);assert.equal(captured.images[0].imageRef,'image-001');assert.equal(captured.images[0].fileName,'ingredient-1.png');assert.equal(captured.images[1].imageRef,'image-002');assert.equal(captured.images[1].fileName,'ingredient-2.jpg');assert.deepEqual(captured.responseJsonSchema,schema);assert.equal(analysis.model,'gemini-test-flash');assert.equal(analysis.project_alias,'Project A');assert.equal(analysis.response_contract,'public-master-recognition');assert.deepEqual(analysis.payload,recognition);
if(promptSafetyAdapter){
  assert.ok(captured.prompt.includes(SCREENSHOT_PROMPT_SAFETY_VERSION),'provider-bound prompt must contain screenshot safety version');
  assert.ok(captured.prompt.includes('檔名'));
  assert.ok(captured.prompt.includes('confidence'));
  assert.equal((captured.prompt.match(new RegExp(SCREENSHOT_PROMPT_SAFETY_VERSION,'g'))||[]).length,1,'transport safety append must be idempotent');
  assert.equal(analysis.prompt_safety_version,SCREENSHOT_PROMPT_SAFETY_VERSION);
}
const validation=validateScreenshotScenarioPayload(session,'ingredients',analysis.payload);assert.equal(validation.errors.length,0,validation.errors.join('\n'));assert.equal(validation.review.length,0);assert.equal(validation.summary.traceable_evidence,true);assert.equal(validation.summary.recognition_contract,true);assert.equal(validation.summary.recognition_matched_count,2);assert.equal(validation.summary.recognition_unresolved_count,0);assert.equal(validation.payload.operations.length,2);assert.deepEqual(validation.payload.operations.map(op=>op.key.ingredient_name),['甜甜蜜','好眠番茄']);

session.scenario_state.ingredients.raw_response=analysis.raw_json;session.scenario_state.ingredients.provider_meta={provider:'gemini',model:analysis.model,project_alias:analysis.project_alias,image_count:analysis.image_count,response_contract:analysis.response_contract,prompt_safety_version:analysis.prompt_safety_version};const diagnostic=buildUcImgDiagnosticBundle({appVersion:'v0.4.13.3',session,scenarioKey:'ingredients',config:UC_IMG_A_SCENARIOS.ingredients,coverage:session.coverage.ingredients,rawResponse:analysis.raw_json,validation,providerMeta:session.scenario_state.ingredients.provider_meta,debugTrace:{events:[]}});const diagnosticText=JSON.stringify(diagnostic);assert.equal(diagnostic.schema,UC_IMG_DIAGNOSTIC_SCHEMA);assert.equal(diagnostic.response_contract,'public-master-recognition');assert.equal(diagnostic.safety.api_key_included,false);assert.equal(diagnostic.safety.screenshot_bytes_included,false);assert.equal(diagnostic.safety.screenshot_base64_included,false);assert.equal(diagnosticText.includes('AIza-SECRET-MUST-NOT-LEAK'),false);assert.equal(diagnosticText.includes('AQ=='),false);if(promptSafetyAdapter)assert.equal(diagnostic.prompt_safety_version,SCREENSHOT_PROMPT_SAFETY_VERSION);
first.object_url='blob:private-1';first.image_available=true;const persisted=serializableScreenshotSession(session);assert.equal(persisted.entries[0].object_url,null);assert.equal(persisted.entries[0].image_available,false);assert.equal(JSON.stringify(persisted).includes('AIza-SECRET-MUST-NOT-LEAK'),false);

const adapterSource=fs.readFileSync(new URL('../assets/js/uc-img-gemini-adapter.js',import.meta.url),'utf8');for(const forbidden of ['applyPayload','dryRun','importer.js','indexedDB','localStorage'])assert.equal(adapterSource.includes(forbidden),false,`Gemini adapter must not own ${forbidden}`);assert.equal(adapterSource.includes('buildRecipePotCapacityPromptInstruction'),false,'Recipe pot contract must remain owned by Public Master Recognition, not duplicated in adapter');if(promptSafetyAdapter){assert.ok(adapterSource.includes('appendScreenshotPromptSafety'));assert.ok(adapterSource.includes('SCREENSHOT_PROMPT_SAFETY_VERSION'));}
const uiSource=fs.readFileSync(new URL('../assets/js/unified-screenshot-update-center.js',import.meta.url),'utf8');for(const token of ['Gemini API 直接分析','外部 AI Prompt','runtime.files','buildUcImgDiagnosticBundle','validateScreenshotScenarioPayload','compilePublicMasterRecognitionToUpdatePackage','dryRun','applyPayload'])assert.ok(uiSource.includes(token),`dual-mode UI missing ${token}`);assert.equal((uiSource.match(/applyPayload\(/g)||[]).length,1);

console.log(JSON.stringify({status:'PASS',gate:'UC.IMG_INTERNAL_GEMINI_DUAL_MODE_PROMPT_SAFETY_SUCCESSOR_AWARE',adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,prompt_safety_version:promptSafetyAdapter?SCREENSHOT_PROMPT_SAFETY_VERSION:null,provider_prompt_safety_enforced:promptSafetyAdapter,diagnostic_schema:UC_IMG_DIAGNOSTIC_SCHEMA,public_master_recognition:true,recipe_pot_capacity_schema:potCapacityAdapter,weekly_base_pot_authority:false,recognition_to_update_package_compile:true,multi_image_structured_output:true,multi_image_ref_labels:true,legacy_single_image_compatible:true,direct_ai_apply_bypass:false,adapter_storage_free:true,pot_contract_single_owner:true,api_key_in_diagnostic:false,screenshot_bytes_persisted:false,external_prompt_fallback:true},null,2));
