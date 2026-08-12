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
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-canonical-authority.js';
import {PUBLIC_RECIPE_MASTER as HISTORICAL_BASE_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {UC_IMG_A_VERSION,UC_IMG_A_SCENARIOS,buildScreenshotScenarioPrompt,createScreenshotUpdateSession,addScreenshotEntry,assignScreenshotScenario} from '../assets/js/unified-screenshot-update-center.js';
import {UC_IMG_GEMINI_ADAPTER_VERSION,buildUcImgGeminiSchema} from '../assets/js/uc-img-gemini-adapter.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionTuple=value=>{const match=String(value||'').match(/^v(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/);return match?match.slice(1).map(part=>Number(part||0)):null;};
const versionAtLeast=(value,minimum)=>{const a=versionTuple(value),b=versionTuple(minimum);if(!a||!b)return false;for(let i=0;i<4;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return true;};
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
const exactReleases={
  'v0.4.11':['20260811-v0411-public-master-constrained-recognition','pokemon-sleep-ai-v0.4.11-v0411-public-master-constrained-recognition'],
  'v0.4.11.1':['20260811-v04111-uc-img-session-timestamp','pokemon-sleep-ai-v0.4.11.1-v04111-uc-img-session-timestamp'],
  'v0.4.11.2':['20260811-v04112-android-eager-image-bytes','pokemon-sleep-ai-v0.4.11.2-v04112-android-eager-image-bytes'],
  'v0.4.11.3':['20260811-v04113-weekly-recipe-semantic-safety','pokemon-sleep-ai-v0.4.11.3-v04113-weekly-recipe-semantic-safety'],
  'v0.4.11.4':['20260811-v04114-recipe-zh-tw-diagnostic-export','pokemon-sleep-ai-v0.4.11.4-v04114-recipe-zh-tw-diagnostic-export'],
  'v0.4.12':['20260811-v0412-recipe-unified-player-workbench','pokemon-sleep-ai-v0.4.12-v0412-recipe-unified-player-workbench'],
  'v0.4.13':['20260811-v0413-g7-recipe-portfolio-contention','pokemon-sleep-ai-v0.4.13-v0413-g7-recipe-portfolio-contention'],
  'v0.4.13.1':['20260811-v04131-data-preservation-hotfix','pokemon-sleep-ai-v0.4.13.1-v04131-data-preservation-hotfix'],
  'v0.4.13.2':['20260812-v04132-pot-authority-recipe78','pokemon-sleep-ai-v0.4.13.2-v04132-pot-authority-recipe78'],
};
assert.ok(versionAtLeast(appVersion,'v0.4.11'),`unexpected v0.4.11 successor: ${appVersion}`);
if(exactReleases[appVersion])assert.deepEqual([appBuild,cacheName],exactReleases[appVersion]);
else{
  for(const predecessor of ['v0.4.13.2','v0.4.13.1','v0.4.13','v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1','v0.4.11'])assert.ok(version.includes(`// app_version: '${predecessor}'`),`${appVersion} must retain ${predecessor} legacy bridge`);
}
const predecessors=['v0.4.11','v0.4.10.3'];
if(appVersion!=='v0.4.11')for(const predecessor of predecessors)assert.ok(version.includes(`// app_version: '${predecessor}'`),`${appVersion} must retain ${predecessor} legacy bridge`);
for(const [successor,required] of Object.entries({
  'v0.4.12':['v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1'],
  'v0.4.13':['v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1'],
  'v0.4.13.1':['v0.4.13','v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1'],
  'v0.4.13.2':['v0.4.13.1','v0.4.13','v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1'],
}))if(appVersion===successor)for(const predecessor of required)assert.ok(version.includes(`// app_version: '${predecessor}'`),`${successor} must retain ${predecessor} legacy bridge`);
assert.ok(version.includes("// app_build: '20260811-v04103-ingredient-key-contract-hotfix'"));

const ucImgAuthorityDate=UC_IMG_A_VERSION.match(/^uc-img-a-(\d{4}-\d{2}-\d{2})-/)?.[1]||null;
assert.ok(ucImgAuthorityDate&&ucImgAuthorityDate>='2026-08-11',`unexpected UC.IMG-A successor: ${UC_IMG_A_VERSION}`);
const adapterDate=UC_IMG_GEMINI_ADAPTER_VERSION.match(/^uc-img-gemini-(\d{4}-\d{2}-\d{2})-/)?.[1]||null;
assert.ok(adapterDate&&adapterDate>='2026-08-11',`unexpected Gemini adapter successor: ${UC_IMG_GEMINI_ADAPTER_VERSION}`);
assert.equal(PUBLIC_MASTER_RECOGNITION_SCHEMA,'pokemon-sleep-public-master-recognition/1.0');
assert.match(PUBLIC_MASTER_RECOGNITION_VERSION,/^public-master-recognition-2026-08-(?:11-(?:a|b-recipe-canonical)|12-[a-z0-9-]+)$/,'Public Master recognition successor version invalid');
assert.deepEqual(Object.keys(PUBLIC_MASTER_RECOGNITION_REGISTRY).sort(),['candies','ingredients','items','recipes']);
assert.deepEqual(PUBLIC_MASTER_RECOGNITION_REGISTRY.ingredients.canonical_key_fields,['ingredient_name']);
assert.deepEqual(PUBLIC_MASTER_RECOGNITION_REGISTRY.items.canonical_key_fields,['item_name']);
assert.deepEqual(PUBLIC_MASTER_RECOGNITION_REGISTRY.candies.canonical_key_fields,['candy_id','candy_name']);
assert.deepEqual(PUBLIC_MASTER_RECOGNITION_REGISTRY.recipes.canonical_key_fields,['recipe_id','recipe_name']);

const ingredientSnapshot=buildPublicMasterCatalogSnapshot('ingredients');
const recipeSnapshot=buildPublicMasterCatalogSnapshot('recipes');
assert.equal(ingredientSnapshot.row_count,19);assert.equal(PUBLIC_INGREDIENT_NAMES.length,19);
assert.equal(HISTORICAL_BASE_RECIPE_MASTER.length,76,'historical Public Master baseline must remain 76');
assert.equal(recipeSnapshot.row_count,PUBLIC_RECIPE_MASTER.length);
assert.ok([76,78].includes(PUBLIC_RECIPE_MASTER.length),'current canonical recipe authority is historical 76 or verified 78 successor');
const historicalIds=new Set(HISTORICAL_BASE_RECIPE_MASTER.map(row=>row.recipe_id));for(const id of historicalIds)assert.ok(PUBLIC_RECIPE_MASTER.some(row=>row.recipe_id===id),`historical recipe id disappeared: ${id}`);
if(PUBLIC_RECIPE_MASTER.length===78){assert.ok(PUBLIC_RECIPE_MASTER.some(row=>row.recipe_id==='curry_greengrass_bun'));assert.ok(PUBLIC_RECIPE_MASTER.some(row=>row.recipe_id==='curry_bounce_udon'));}
for(const key of ['ingredients','items','candies','recipes']){
  const snapshot=buildPublicMasterCatalogSnapshot(key);
  assert.equal(snapshot.privacy.public_only,true);assert.equal(snapshot.privacy.player_quantities_included,false);assert.equal(snapshot.privacy.player_unlocks_included,false);assert.equal(snapshot.privacy.private_pokemon_included,false);
}

const ingredientSchema=buildPublicMasterRecognitionJsonSchema('ingredients');
assert.deepEqual(ingredientSchema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);assert.deepEqual(ingredientSchema.properties.observations.items.properties.status.enum,['MATCHED','AMBIGUOUS','UNMATCHED']);assert.equal(ingredientSchema.properties.observations.items.properties.canonical_key.properties.ingredient_name.enum.length,19);assert.equal('ingredient_id' in ingredientSchema.properties.observations.items.properties.canonical_key.properties,false);
const runtimeIngredientSchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.ingredients,'ingredients');assert.deepEqual(runtimeIngredientSchema,ingredientSchema,'Internal Gemini must use the same constrained ingredient schema');
const runtimeRecipeSchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.recipes,'recipes');assert.deepEqual(runtimeRecipeSchema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);
const recipePotCapacityObservation=Boolean(runtimeRecipeSchema.properties.capacity_observations);
if(versionAtLeast(appVersion,'v0.4.13.2'))assert.equal(recipePotCapacityObservation,true,'Recipe successor must expose direct-visible base pot capacity observations');
const weeklySchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.weekly,'weekly');assert.deepEqual(weeklySchema.properties.schema_version.enum,['1.1']);assert.equal('capacity_observations' in weeklySchema.properties,false,'Weekly must never inherit base pot authority');

const session=createScreenshotUpdateSession();const ingredientImage=addScreenshotEntry(session,{name:'ingredient-live.png',size:10,type:'image/png'});assignScreenshotScenario(session,ingredientImage.entry_id,'ingredients');const recipeImage=addScreenshotEntry(session,{name:'recipe-live.png',size:10,type:'image/png'});assignScreenshotScenario(session,recipeImage.entry_id,'recipes');
const ingredientPrompt=buildScreenshotScenarioPrompt(session,'ingredients'),recipePrompt=buildScreenshotScenarioPrompt(session,'recipes');for(const prompt of [ingredientPrompt,recipePrompt])for(const token of ['Public Master Constrained Recognition','MATCHED','AMBIGUOUS','UNMATCHED','visible_target_count','不得自行創造 ID 或 canonical 名稱'])assert.ok(prompt.includes(token));assert.ok(ingredientPrompt.includes('ingredient_master'));assert.ok(recipePrompt.includes('recipe_master'));

const recognition={schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'ingredient_inventory_update',authority:'ingredient_master',data_version:ingredientSnapshot.data_version,catalog_snapshot_id:ingredientSnapshot.catalog_snapshot_id,generated_at:'2026-08-11T03:30:00Z',visible_target_count:2,observations:[{observation_id:'r1',status:'MATCHED',observed_text:'甜甜蜜',observed_data:{quantity:34},canonical_key:{ingredient_name:'甜甜蜜'},canonical_name:'甜甜蜜',candidate_names:['甜甜蜜'],source_image_ref:'image-001',confidence:0.99},{observation_id:'r2',status:'UNMATCHED',observed_text:'公版未收錄測試',observed_data:{quantity:9},candidate_names:[],source_image_ref:'image-001',confidence:0.9}]};
const compiled=compilePublicMasterRecognitionToUpdatePackage(recognition,'ingredients',{allowedImageRefs:['image-001']});assert.equal(compiled.ok,false);assert.equal(compiled.update_package.operations.length,1);assert.equal(compiled.update_package.operations[0].key.ingredient_name,'甜甜蜜');assert.equal(JSON.stringify(compiled.update_package).includes('公版未收錄測試'),false);

const recognitionSource=read('assets/js/public-master-recognition.js');for(const forbidden of ['INSERT INTO','UPDATE ingredient_master','UPDATE item_master','UPDATE candy_master','UPDATE recipe_master','DELETE FROM','applyPayload(','dryRun(','indexedDB','localStorage'])assert.equal(recognitionSource.includes(forbidden),false,`recognition layer must not own write path: ${forbidden}`);
const ui=read('assets/js/unified-screenshot-update-center.js');assert.equal((ui.match(/applyPayload\(/g)||[]).length,1);for(const token of ['Public Master 對應待確認','確認公版候選','辨識誤判／忽略','標記公版缺口','PUBLIC_MASTER_GAP_CONFIRMED'])assert.ok(ui.includes(token));
const adapter=read('assets/js/uc-img-gemini-adapter.js');for(const forbidden of ['applyPayload','dryRun','importer.js','localStorage','indexedDB'])assert.equal(adapter.includes(forbidden),false,`Gemini adapter must not own ${forbidden}`);
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.11 lineage remains schema-migration-free');

console.log(JSON.stringify({status:'PASS',gate:'V0.4.11_RELEASE_CONTRACT_SUCCESSOR_AWARE',app_version:appVersion,uc_img_authority_date:ucImgAuthorityDate,gemini_adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,gemini_adapter_authority_date:adapterDate,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,ingredient_catalog_count:ingredientSnapshot.row_count,historical_recipe_catalog_count:HISTORICAL_BASE_RECIPE_MASTER.length,recipe_catalog_count:recipeSnapshot.row_count,historical_recipe_ids_preserved:true,recipe_pot_capacity_observation:recipePotCapacityObservation,weekly_base_pot_authority:false,public_only_catalogs:true,ai_created_ids:false,unknown_silent_drop:false,fuzzy_auto_write:false,direct_ai_apply_bypass:false,single_apply_bridge:true,screenshot_bytes_persisted:false,sqlite_migration_added:false,public_master_runtime_mutation:false},null,2));