import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_INGREDIENT_NAMES} from '../assets/js/shared-master-data.js';
import {PUBLIC_ITEM_MASTER} from '../assets/js/public-item-master.js';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {
  PUBLIC_MASTER_RECOGNITION_REGISTRY,
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  applyPublicMasterRecognitionResolution,
  buildPublicMasterCatalogSnapshot,
  buildPublicMasterRecognitionJsonSchema,
  compilePublicMasterRecognitionToUpdatePackage,
  validatePublicMasterRecognitionPayload,
} from '../assets/js/public-master-recognition.js';

const scenarios=['ingredients','items','candies','recipes'];
assert.deepEqual(Object.keys(PUBLIC_MASTER_RECOGNITION_REGISTRY).sort(),[...scenarios].sort());
assert.equal(PUBLIC_INGREDIENT_NAMES.length,19,'ingredient public authority count changed');
assert.equal(PUBLIC_RECIPE_MASTER.length,76,'recipe public authority count changed');

const snapshots=Object.fromEntries(scenarios.map(key=>[key,buildPublicMasterCatalogSnapshot(key)]));
assert.equal(snapshots.ingredients.row_count,19);
assert.equal(snapshots.items.row_count,PUBLIC_ITEM_MASTER.length);
assert.equal(snapshots.recipes.row_count,76);
assert.ok(snapshots.candies.row_count>0);
for(const [key,snapshot] of Object.entries(snapshots)){
  assert.equal(snapshot.privacy.public_only,true,`${key} snapshot must be public-only`);
  assert.equal(snapshot.privacy.player_quantities_included,false);
  assert.equal(snapshot.privacy.player_unlocks_included,false);
  assert.equal(snapshot.privacy.private_pokemon_included,false);
  const serialized=JSON.stringify(snapshot);
  for(const forbidden of ['safe_reserve','source_update_id','last_updated_at','pokemon_instance_id'])assert.equal(serialized.includes(`"${forbidden}"`),false,`${key} leaked private/player field ${forbidden}`);
}

const ingredientSchema=buildPublicMasterRecognitionJsonSchema('ingredients');
const observationSchema=ingredientSchema.properties.observations.items;
assert.deepEqual(ingredientSchema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);
assert.deepEqual(ingredientSchema.properties.recognition_version.enum,[PUBLIC_MASTER_RECOGNITION_VERSION]);
assert.equal(observationSchema.properties.canonical_key.additionalProperties,false);
assert.equal(observationSchema.properties.canonical_key.properties.ingredient_name.enum.length,19);
assert.equal('ingredient_id' in observationSchema.properties.canonical_key.properties,false,'AI must not receive invented ingredient_id authority');
assert.deepEqual(observationSchema.properties.status.enum,['MATCHED','AMBIGUOUS','UNMATCHED']);

const ingredientSnapshot=snapshots.ingredients;
const baseRecognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'ingredient_inventory_update',
  authority:'ingredient_master',
  data_version:ingredientSnapshot.data_version,
  catalog_snapshot_id:ingredientSnapshot.catalog_snapshot_id,
  generated_at:'2026-08-11T03:10:00Z',
  visible_target_count:3,
  observations:[
    {observation_id:'obs-1',status:'MATCHED',observed_text:'沉甸甸南瓜',observed_data:{quantity:12},canonical_key:{ingredient_name:'沉甸甸南瓜'},canonical_name:'沉甸甸南瓜',candidate_names:['沉甸甸南瓜'],source_image_ref:'image-004',confidence:0.99,reason:'exact'},
    {observation_id:'obs-2',status:'MATCHED',observed_text:'醒腦咖啡豆',observed_data:{quantity:11},canonical_key:{ingredient_name:'醒腦咖啡豆'},canonical_name:'醒腦咖啡豆',candidate_names:['醒腦咖啡豆'],source_image_ref:'image-004',confidence:0.99,reason:'exact'},
    {observation_id:'obs-3',status:'UNMATCHED',observed_text:'未收錄測試食材',observed_data:{quantity:7},candidate_names:['特選酪梨'],source_image_ref:'image-004',confidence:0.91,reason:'not in current catalog'},
  ],
};

const first=compilePublicMasterRecognitionToUpdatePackage(baseRecognition,'ingredients',{allowedImageRefs:['image-004']});
assert.equal(first.ok,false,'unmatched row must block recognition closure');
assert.equal(first.summary.matched_count,2);
assert.equal(first.summary.unresolved_count,1);
assert.equal(first.update_package.operations.length,2,'unknown item must not silently become an operation');
assert.deepEqual(first.update_package.operations.map(op=>op.key.ingredient_name),['沉甸甸南瓜','醒腦咖啡豆']);
assert.equal(JSON.stringify(first.update_package).includes('未收錄測試食材'),false,'unmatched item leaked into executable update package');

const confirmed=applyPublicMasterRecognitionResolution(baseRecognition,'ingredients','obs-3','MATCH','特選酪梨');
const afterConfirm=compilePublicMasterRecognitionToUpdatePackage(confirmed,'ingredients',{allowedImageRefs:['image-004']});
assert.equal(afterConfirm.ok,true);
assert.equal(afterConfirm.summary.matched_count,3);
assert.equal(afterConfirm.summary.unresolved_count,0);
assert.equal(afterConfirm.update_package.operations[2].key.ingredient_name,'特選酪梨');
assert.equal(afterConfirm.update_package.operations[2].data.quantity,7);
assert.equal(confirmed.observations[2].user_resolution.action,'USER_CONFIRMED_MATCH');

const ignored=applyPublicMasterRecognitionResolution(baseRecognition,'ingredients','obs-3','IGNORE');
const afterIgnore=compilePublicMasterRecognitionToUpdatePackage(ignored,'ingredients',{allowedImageRefs:['image-004']});
assert.equal(afterIgnore.ok,true);
assert.equal(afterIgnore.summary.matched_count,2);
assert.equal(afterIgnore.summary.ignored_count,1);
assert.equal(afterIgnore.update_package.operations.length,2);

const gap=applyPublicMasterRecognitionResolution(baseRecognition,'ingredients','obs-3','MASTER_GAP');
const afterGap=compilePublicMasterRecognitionToUpdatePackage(gap,'ingredients',{allowedImageRefs:['image-004']});
assert.equal(afterGap.ok,false,'confirmed master gap must remain non-executable');
assert.equal(afterGap.summary.unresolved_count,1);
assert.equal(gap.observations[2].user_resolution.action,'PUBLIC_MASTER_GAP_CONFIRMED');

const stale=structuredClone(baseRecognition);stale.data_version='stale-master-version';
const staleValidation=validatePublicMasterRecognitionPayload(stale,'ingredients',{allowedImageRefs:['image-004']});
assert.equal(staleValidation.ok,false);
assert.ok(staleValidation.errors.some(message=>message.includes('Public Master snapshot')));

const omitted=structuredClone(baseRecognition);omitted.visible_target_count=4;
const omittedValidation=validatePublicMasterRecognitionPayload(omitted,'ingredients',{allowedImageRefs:['image-004']});
assert.equal(omittedValidation.ok,false);
assert.ok(omittedValidation.errors.some(message=>message.includes('不得靜默省略')));

const recipeSnapshot=snapshots.recipes;
const recipeRow=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_name==='忍者咖哩');assert.ok(recipeRow);
const recipeRecognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'recipe_status_update',authority:'recipe_master',data_version:recipeSnapshot.data_version,catalog_snapshot_id:recipeSnapshot.catalog_snapshot_id,
  generated_at:'2026-08-11T03:11:00Z',visible_target_count:1,
  observations:[{observation_id:'recipe-1',status:'MATCHED',observed_text:'忍者咖哩',observed_data:{unlocked:true,recipe_level:23,current_energy:10000},canonical_key:{recipe_id:recipeRow.recipe_id,recipe_name:recipeRow.recipe_name},canonical_name:recipeRow.recipe_name,candidate_names:[recipeRow.recipe_name],source_image_ref:'image-009',confidence:0.98,reason:'exact'}],
};
const recipeCompiled=compilePublicMasterRecognitionToUpdatePackage(recipeRecognition,'recipes',{allowedImageRefs:['image-009']});
assert.equal(recipeCompiled.ok,true);
assert.equal(recipeCompiled.update_package.operations.length,1);
assert.equal(recipeCompiled.update_package.operations[0].key.recipe_id,recipeRow.recipe_id);
assert.equal(recipeCompiled.update_package.operations[0].key.recipe_name,recipeRow.recipe_name);
assert.deepEqual(recipeCompiled.update_package.operations[0].data,{unlocked:true,recipe_level:23,current_energy:10000});

const ucImg=fs.readFileSync('assets/js/unified-screenshot-update-center.js','utf8');
for(const token of ['buildPublicMasterRecognitionPrompt','compilePublicMasterRecognitionToUpdatePackage','Public Master 對應待確認','PUBLIC_MASTER_GAP_CONFIRMED'])assert.ok(ucImg.includes(token),`UC.IMG missing recognition token ${token}`);
assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1,'recognition must not create a second Apply engine');

console.log(JSON.stringify({
  status:'PASS',gate:'PUBLIC_MASTER_CONSTRAINED_RECOGNITION',
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  registry_scenarios:scenarios,
  ingredient_catalog_count:snapshots.ingredients.row_count,
  item_catalog_count:snapshots.items.row_count,
  candy_catalog_count:snapshots.candies.row_count,
  recipe_catalog_count:snapshots.recipes.row_count,
  unknown_silent_drop:false,
  fuzzy_auto_write:false,
  user_confirmed_match_compiles:true,
  public_master_gap_blocks:true,
  stale_catalog_blocks:true,
  visible_count_reconciliation:true,
  second_apply_engine:false,
},null,2));
