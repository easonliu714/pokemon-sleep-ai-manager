import assert from 'node:assert/strict';
import {analyzeUcImgScenarioWithGemini,buildUcImgGeminiSchema} from '../assets/js/uc-img-gemini-adapter.js';
import {
  applyUcImgWeeklyPlatformAuthority,
  buildUcImgWeeklyPlatformAuthority,
} from '../assets/js/uc-img-weekly-platform-authority.js';
import {validateWeeklyContextImportPayload} from '../assets/js/weekly-context-import-contract.js';
import {PUBLIC_RECIPE_ALIASES,PUBLIC_RECIPE_ALIAS_VERSION} from '../assets/js/public-recipe-alias-master.js';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  applyPublicMasterRecognitionResolution,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
  validatePublicMasterRecognitionPayload,
} from '../assets/js/public-master-recognition.js';

const fixedNow=new Date('2026-08-11T07:45:11.014Z');
const weeklyAuthority=buildUcImgWeeklyPlatformAuthority(fixedNow);
assert.equal(weeklyAuthority.week_start,'2026-08-10');
assert.equal(weeklyAuthority.context_id,'weekly_context_2026-08-10_import');
assert.equal(weeklyAuthority.generated_at,'2026-08-11T07:45:11.014Z');
assert.ok(weeklyAuthority.update_id.startsWith('UPD-20260811074511-'));

const weeklyConfig={scenario:'weekly_context_update',entities:['weekly_context']};
const weeklySchema=buildUcImgGeminiSchema(weeklyConfig,'weekly',{platformAuthority:weeklyAuthority});
assert.deepEqual(weeklySchema.properties.generated_at.enum,[weeklyAuthority.generated_at]);
assert.deepEqual(weeklySchema.properties.update_id.enum,[weeklyAuthority.update_id]);
const weeklyOpSchema=weeklySchema.properties.operations.items;
assert.deepEqual(weeklyOpSchema.properties.key.properties.context_id.enum,[weeklyAuthority.context_id]);
assert.deepEqual(weeklyOpSchema.properties.data.properties.week_start.enum,[weeklyAuthority.week_start]);
assert.deepEqual(weeklyOpSchema.properties.data.properties.updated_at.enum,[weeklyAuthority.updated_at]);

const staleProviderWeekly={
  schema_version:'1.1',update_id:'UPD-20240715000000-AI',generated_at:'2024-07-15T00:00:00Z',source:'ai_screenshot_analysis',scenario:'weekly_context_update',context_authority:'UPDATE_CENTER_JSON',profile_audit_confirmations:[],
  operations:[{
    operation_id:'op_weekly_context_20240715',entity:'weekly_context',action:'upsert',key:{context_id:'weekly_context_2024-07-15_import'},
    data:{week_start:'2024-07-15',camp:'萌綠之島',dish_category:'咖哩／濃湯',event_name:'夏日嘉年華',event_effects:{meal_category_forced:true},updated_at:'2024-07-15T00:00:00Z'},
    evidence:{source_image_ref:'image-022',source_image_refs:['image-021','image-022'],confidence:1},review_required:false,
  }],
};
const appliedAuthority=applyUcImgWeeklyPlatformAuthority(staleProviderWeekly,weeklyAuthority);
assert.equal(appliedAuthority.generated_at,weeklyAuthority.generated_at);
assert.equal(appliedAuthority.update_id,weeklyAuthority.update_id);
assert.equal(appliedAuthority.operations[0].key.context_id,weeklyAuthority.context_id);
assert.equal(appliedAuthority.operations[0].data.week_start,weeklyAuthority.week_start);
assert.equal(appliedAuthority.operations[0].data.updated_at,weeklyAuthority.updated_at);
assert.equal(appliedAuthority.operations[0].data.camp,'萌綠之島','observable weekly facts must survive platform temporal normalization');

const externalStale=validateWeeklyContextImportPayload(staleProviderWeekly,{now:fixedNow,repairLegacy:false});
assert.equal(externalStale.ok,false,'external/pasted stale weekly JSON must remain fail-closed');
assert.ok(externalStale.issues.some(message=>message.includes('目前週期 2026-08-10')));

let capturedRequest=null;
const fakeGeminiPayload={candidates:[{content:{parts:[{text:JSON.stringify(staleProviderWeekly)}]}}]};
const internalResult=await analyzeUcImgScenarioWithGemini({
  scenarioKey:'weekly',config:weeklyConfig,
  entries:[{entry_id:'entry-1',image_ref:'image-021',file_name:'weekly.png',mime_type:'image/png'}],
  fileMap:new Map([['entry-1',new Blob([new Uint8Array([1,2,3])],{type:'image/png'})]]),
  prompt:'weekly prompt',poolData:{projects:[{alias:'Project A'}],model:'gemini-test'},platformNow:fixedNow,
  execute:async request=>{capturedRequest=request;return {ok:true,payload:fakeGeminiPayload,used_alias:'Project A',projects:request.projects,attempts:[]};},
});
assert.equal(internalResult.payload.operations[0].data.week_start,'2026-08-10','Internal Gemini provider date must not be temporal authority');
assert.equal(internalResult.payload.operations[0].key.context_id,'weekly_context_2026-08-10_import');
assert.equal(internalResult.platform_authority.provider_original_week_start,'2024-07-15');
assert.ok(capturedRequest.prompt.includes('current_week_start=2026-08-10'));
assert.deepEqual(capturedRequest.responseJsonSchema.properties.generated_at.enum,[weeklyAuthority.generated_at]);

assert.equal(PUBLIC_RECIPE_ALIAS_VERSION,'public-recipe-alias-2026-08-11-a');
assert.equal(PUBLIC_RECIPE_ALIASES.length,3);
const aliasSerialized=JSON.stringify(PUBLIC_RECIPE_ALIASES);
for(const forbidden of ['recipe_level','current_energy','player_record','pokemon_instance'])assert.equal(aliasSerialized.includes(forbidden),false,`public alias registry leaked ${forbidden}`);

const recipeSnapshot=buildPublicMasterCatalogSnapshot('recipes');
assert.equal(recipeSnapshot.identity_alias_version,PUBLIC_RECIPE_ALIAS_VERSION);
assert.ok(recipeSnapshot.catalog_snapshot_id.includes(PUBLIC_RECIPE_ALIAS_VERSION));
const dream=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_id==='curry_dream_eater');assert.ok(dream);
const ninja=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_name==='忍者咖哩');assert.ok(ninja);

const recognitionFor=(row,observedText,id='recipe-test')=>({
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'recipe_status_update',authority:'recipe_master',data_version:recipeSnapshot.data_version,catalog_snapshot_id:recipeSnapshot.catalog_snapshot_id,
  generated_at:'2026-08-11T07:45:00Z',visible_target_count:1,
  observations:[{observation_id:id,status:'MATCHED',observed_text:observedText,observed_data:{unlocked:true,recipe_level:16,current_energy:11533},canonical_key:{recipe_id:row.recipe_id,recipe_name:row.recipe_name},canonical_name:row.recipe_name,source_image_ref:'image-023',confidence:0.98}],
});

const exact=recognitionFor(ninja,'忍者咖哩','exact');
const exactCompiled=compilePublicMasterRecognitionToUpdatePackage(exact,'recipes',{allowedImageRefs:['image-023']});
assert.equal(exactCompiled.ok,true);
assert.equal(exactCompiled.update_package.operations.length,1,'exact canonical name should auto-compile');

const alias=recognitionFor(dream,'絕對睡眠奶油咖哩','approved-alias');
const aliasCompiled=compilePublicMasterRecognitionToUpdatePackage(alias,'recipes',{allowedImageRefs:['image-023']});
assert.equal(aliasCompiled.ok,true,'reviewed alias should auto-match');
assert.equal(aliasCompiled.update_package.operations.length,1);
assert.equal(aliasCompiled.update_package.operations[0].key.recipe_id,'curry_dream_eater');

const unsafe=recognitionFor(dream,'語意相近但未核准的奶油咖哩','unsafe');
const unsafeValidation=validatePublicMasterRecognitionPayload(unsafe,'recipes',{allowedImageRefs:['image-023']});
assert.equal(unsafeValidation.ok,false);
assert.equal(unsafeValidation.errors.length,0,'non-approved fuzzy mapping should become review, not schema error');
assert.equal(unsafeValidation.unresolved.length,1);
assert.equal(unsafeValidation.unresolved[0].status,'AMBIGUOUS');
assert.equal(unsafeValidation.unresolved[0].reason,'RECIPE_NAME_REQUIRES_EXACT_OR_APPROVED_ALIAS');
const unsafeCompiled=compilePublicMasterRecognitionToUpdatePackage(unsafe,'recipes',{allowedImageRefs:['image-023']});
assert.equal(unsafeCompiled.update_package.operations.length,0,'valid recipe_id alone must not authorize a write');

const confirmed=applyPublicMasterRecognitionResolution(unsafe,'recipes','unsafe','MATCH',dream.recipe_name);
const confirmedCompiled=compilePublicMasterRecognitionToUpdatePackage(confirmed,'recipes',{allowedImageRefs:['image-023']});
assert.equal(confirmedCompiled.ok,true,'explicit user confirmation should authorize this import');
assert.equal(confirmedCompiled.update_package.operations.length,1);
assert.equal(confirmed.observations[0].user_resolution.action,'USER_CONFIRMED_MATCH');

console.log(JSON.stringify({
  status:'PASS',gate:'V04113_WEEKLY_RECIPE_SEMANTIC_SAFETY',
  weekly_current_week:weeklyAuthority.week_start,
  weekly_internal_provider_old_date_rewritten:true,
  weekly_external_stale_still_blocks:true,
  recipe_exact_auto_match:true,
  recipe_approved_alias_auto_match:true,
  recipe_unapproved_fuzzy_blocks:true,
  recipe_user_confirmed_match_compiles:true,
  alias_registry_version:PUBLIC_RECIPE_ALIAS_VERSION,
},null,2));
