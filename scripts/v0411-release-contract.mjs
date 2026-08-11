import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_MASTER_RECOGNITION_REGISTRY,
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  buildPublicMasterRecognitionJsonSchema,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';
import {PUBLIC_INGREDIENT_NAMES} from '../assets/js/shared-master-data.js';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {UC_IMG_A_VERSION,UC_IMG_A_SCENARIOS,buildScreenshotScenarioPrompt,createScreenshotUpdateSession,addScreenshotEntry,assignScreenshotScenario} from '../assets/js/unified-screenshot-update-center.js';
import {UC_IMG_GEMINI_ADAPTER_VERSION,buildUcImgGeminiSchema} from '../assets/js/uc-img-gemini-adapter.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.11','v0.4.11.1','v0.4.11.2','v0.4.11.3'].includes(appVersion),`unexpected v0.4.11 successor: ${appVersion}`);
if(appVersion==='v0.4.11'){
  assert.equal(appBuild,'20260811-v0411-public-master-constrained-recognition');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.11-v0411-public-master-constrained-recognition');
}else if(appVersion==='v0.4.11.1'){
  assert.equal(appBuild,'20260811-v04111-uc-img-session-timestamp');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.11.1-v04111-uc-img-session-timestamp');
  assert.ok(version.includes("// app_version: 'v0.4.11'"),'v0.4.11.1 must retain v0.4.11 legacy bridge');
  assert.ok(version.includes("// app_build: '20260811-v0411-public-master-constrained-recognition'"));
}else if(appVersion==='v0.4.11.2'){
  assert.equal(appBuild,'20260811-v04112-android-eager-image-bytes');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.11.2-v04112-android-eager-image-bytes');
  assert.ok(version.includes("// app_version: 'v0.4.11.1'"),'v0.4.11.2 must retain v0.4.11.1 legacy bridge');
  assert.ok(version.includes("// app_build: '20260811-v04111-uc-img-session-timestamp'"));
  assert.ok(version.includes("// app_version: 'v0.4.11'"),'v0.4.11.2 must retain v0.4.11 legacy bridge');
}else{
  assert.equal(appBuild,'20260811-v04113-weekly-recipe-semantic-safety');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.11.3-v04113-weekly-recipe-semantic-safety');
  assert.ok(version.includes("// app_version: 'v0.4.11.2'"),'v0.4.11.3 must retain v0.4.11.2 legacy bridge');
  assert.ok(version.includes("// app_build: '20260811-v04112-android-eager-image-bytes'"));
  assert.ok(version.includes("// app_version: 'v0.4.11.1'"));
  assert.ok(version.includes("// app_version: 'v0.4.11'"));
}
assert.ok(version.includes("// app_version: 'v0.4.10.3'"),'v0.4.11 lineage must retain v0.4.10.3 legacy bridge');
assert.ok(version.includes("// app_build: '20260811-v04103-ingredient-key-contract-hotfix'"));

assert.equal(UC_IMG_A_VERSION,'uc-img-a-2026-08-11-d-public-master-recognition');
assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-11-b-public-master-recognition');
assert.equal(PUBLIC_MASTER_RECOGNITION_SCHEMA,'pokemon-sleep-public-master-recognition/1.0');
assert.equal(PUBLIC_MASTER_RECOGNITION_VERSION,'public-master-recognition-2026-08-11-a');
assert.deepEqual(Object.keys(PUBLIC_MASTER_RECOGNITION_REGISTRY).sort(),['candies','ingredients','items','recipes']);
assert.deepEqual(PUBLIC_MASTER_RECOGNITION_REGISTRY.ingredients.canonical_key_fields,['ingredient_name']);
assert.deepEqual(PUBLIC_MASTER_RECOGNITION_REGISTRY.items.canonical_key_fields,['item_name']);
assert.deepEqual(PUBLIC_MASTER_RECOGNITION_REGISTRY.candies.canonical_key_fields,['candy_id','candy_name']);
assert.deepEqual(PUBLIC_MASTER_RECOGNITION_REGISTRY.recipes.canonical_key_fields,['recipe_id','recipe_name']);

const ingredientSnapshot=buildPublicMasterCatalogSnapshot('ingredients');
const recipeSnapshot=buildPublicMasterCatalogSnapshot('recipes');
assert.equal(ingredientSnapshot.row_count,19);
assert.equal(PUBLIC_INGREDIENT_NAMES.length,19);
assert.equal(recipeSnapshot.row_count,76);
assert.equal(PUBLIC_RECIPE_MASTER.length,76);
for(const key of ['ingredients','items','candies','recipes']){
  const snapshot=buildPublicMasterCatalogSnapshot(key);
  assert.equal(snapshot.privacy.public_only,true);
  assert.equal(snapshot.privacy.player_quantities_included,false);
  assert.equal(snapshot.privacy.player_unlocks_included,false);
  assert.equal(snapshot.privacy.private_pokemon_included,false);
}

const ingredientSchema=buildPublicMasterRecognitionJsonSchema('ingredients');
assert.deepEqual(ingredientSchema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);
assert.deepEqual(ingredientSchema.properties.observations.items.properties.status.enum,['MATCHED','AMBIGUOUS','UNMATCHED']);
assert.equal(ingredientSchema.properties.observations.items.properties.canonical_key.properties.ingredient_name.enum.length,19);
assert.equal('ingredient_id' in ingredientSchema.properties.observations.items.properties.canonical_key.properties,false);
const runtimeIngredientSchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.ingredients,'ingredients');
assert.deepEqual(runtimeIngredientSchema,ingredientSchema,'Internal Gemini must use the same constrained ingredient schema');
const runtimeRecipeSchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.recipes,'recipes');
assert.deepEqual(runtimeRecipeSchema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);
const weeklySchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.weekly,'weekly');
assert.deepEqual(weeklySchema.properties.schema_version.enum,['1.1'],'Weekly remains Update Package v1.1 until a matching public authority is defined');

const session=createScreenshotUpdateSession();
const ingredientImage=addScreenshotEntry(session,{name:'ingredient-live.png',size:10,type:'image/png'});assignScreenshotScenario(session,ingredientImage.entry_id,'ingredients');
const recipeImage=addScreenshotEntry(session,{name:'recipe-live.png',size:10,type:'image/png'});assignScreenshotScenario(session,recipeImage.entry_id,'recipes');
const ingredientPrompt=buildScreenshotScenarioPrompt(session,'ingredients');
const recipePrompt=buildScreenshotScenarioPrompt(session,'recipes');
for(const prompt of [ingredientPrompt,recipePrompt]){
  assert.ok(prompt.includes('Public Master Constrained Recognition'));
  assert.ok(prompt.includes('MATCHED'));
  assert.ok(prompt.includes('AMBIGUOUS'));
  assert.ok(prompt.includes('UNMATCHED'));
  assert.ok(prompt.includes('visible_target_count'));
  assert.ok(prompt.includes('不得自行創造 ID 或 canonical 名稱'));
}
assert.ok(ingredientPrompt.includes('ingredient_master'));
assert.ok(recipePrompt.includes('recipe_master'));

const recognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'ingredient_inventory_update',authority:'ingredient_master',data_version:ingredientSnapshot.data_version,catalog_snapshot_id:ingredientSnapshot.catalog_snapshot_id,
  generated_at:'2026-08-11T03:30:00Z',visible_target_count:2,
  observations:[
    {observation_id:'r1',status:'MATCHED',observed_text:'甜甜蜜',observed_data:{quantity:34},canonical_key:{ingredient_name:'甜甜蜜'},canonical_name:'甜甜蜜',candidate_names:['甜甜蜜'],source_image_ref:'image-001',confidence:0.99},
    {observation_id:'r2',status:'UNMATCHED',observed_text:'公版未收錄測試',observed_data:{quantity:9},candidate_names:[],source_image_ref:'image-001',confidence:0.9},
  ],
};
const compiled=compilePublicMasterRecognitionToUpdatePackage(recognition,'ingredients',{allowedImageRefs:['image-001']});
assert.equal(compiled.ok,false,'unresolved recognition must block executable closure');
assert.equal(compiled.update_package.operations.length,1,'only MATCHED may compile into Update Package');
assert.equal(compiled.update_package.operations[0].key.ingredient_name,'甜甜蜜');
assert.equal(JSON.stringify(compiled.update_package).includes('公版未收錄測試'),false,'unknown observation must never leak into executable player update');

const recognitionSource=read('assets/js/public-master-recognition.js');
for(const forbidden of ['INSERT INTO','UPDATE ingredient_master','UPDATE item_master','UPDATE candy_master','UPDATE recipe_master','DELETE FROM','applyPayload(','dryRun(','indexedDB','localStorage']){
  assert.equal(recognitionSource.includes(forbidden),false,`recognition layer must not own write path: ${forbidden}`);
}
const ui=read('assets/js/unified-screenshot-update-center.js');
assert.equal((ui.match(/applyPayload\(/g)||[]).length,1,'there must remain exactly one UC.IMG Apply bridge');
for(const token of ['Public Master 對應待確認','確認公版候選','辨識誤判／忽略','標記公版缺口','PUBLIC_MASTER_GAP_CONFIRMED'])assert.ok(ui.includes(token),`missing unresolved governance UI: ${token}`);
const adapter=read('assets/js/uc-img-gemini-adapter.js');
for(const forbidden of ['applyPayload','dryRun','importer.js','localStorage','indexedDB'])assert.equal(adapter.includes(forbidden),false,`Gemini adapter must not own ${forbidden}`);

const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.11 lineage is schema-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.11_RELEASE_CONTRACT',
  app_version:appVersion,
  successor_v04111:appVersion==='v0.4.11.1',
  successor_v04112:appVersion==='v0.4.11.2',
  successor_v04113:appVersion==='v0.4.11.3',
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  executable_scenarios:['ingredients','recipes'],
  registry_ready_scenarios:['items','candies'],
  ingredient_catalog_count:ingredientSnapshot.row_count,
  recipe_catalog_count:recipeSnapshot.row_count,
  public_only_catalogs:true,
  ai_created_ids:false,
  unknown_silent_drop:false,
  fuzzy_auto_write:false,
  external_prompt_parity:true,
  direct_ai_apply_bypass:false,
  single_apply_bridge:true,
  screenshot_bytes_persisted:false,
  sqlite_migration_added:false,
  public_master_runtime_mutation:false,
},null,2));
