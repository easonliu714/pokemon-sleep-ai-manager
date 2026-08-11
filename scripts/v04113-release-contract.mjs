import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildUcImgWeeklyPlatformAuthority,applyUcImgWeeklyPlatformAuthority} from '../assets/js/uc-img-weekly-platform-authority.js';
import {PUBLIC_RECIPE_ALIASES,PUBLIC_RECIPE_ALIAS_VERSION} from '../assets/js/public-recipe-alias-master.js';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-canonical-authority.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  applyPublicMasterRecognitionResolution,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';
import {validateWeeklyContextImportPayload} from '../assets/js/weekly-context-import-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.11.3');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04113-weekly-recipe-semantic-safety');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.11.3-v04113-weekly-recipe-semantic-safety');
assert.ok(version.includes("// app_version: 'v0.4.11.2'"));
assert.ok(version.includes("// app_build: '20260811-v04112-android-eager-image-bytes'"));

const fixedNow=new Date('2026-08-11T08:45:00Z');
const authority=buildUcImgWeeklyPlatformAuthority(fixedNow);
assert.equal(authority.week_start,'2026-08-10');
const providerWeekly={
  schema_version:'1.1',update_id:'UPD-20240715000000-AI',generated_at:'2024-07-15T00:00:00Z',source:'ai_screenshot_analysis',scenario:'weekly_context_update',context_authority:'UPDATE_CENTER_JSON',operations:[{
    operation_id:'weekly-old',entity:'weekly_context',action:'upsert',key:{context_id:'weekly_context_2024-07-15_import'},
    data:{week_start:'2024-07-15',camp:'萌綠之島',dish_category:'咖哩／濃湯',updated_at:'2024-07-15T00:00:00Z'},
    evidence:{source_image_ref:'image-021',confidence:1},review_required:false,
  }],
};
const normalized=applyUcImgWeeklyPlatformAuthority(providerWeekly,authority);
assert.equal(normalized.operations[0].data.week_start,'2026-08-10');
assert.equal(normalized.operations[0].key.context_id,'weekly_context_2026-08-10_import');
assert.equal(normalized.generated_at,authority.generated_at);
assert.equal(normalized.update_id,authority.update_id);
assert.equal(normalized.operations[0].data.camp,'萌綠之島');
const externalStale=validateWeeklyContextImportPayload(providerWeekly,{now:fixedNow,repairLegacy:false});
assert.equal(externalStale.ok,false,'external stale Weekly JSON must remain blocked');

const allowedAliasSuccessors=new Set([
  'public-recipe-alias-2026-08-11-a',
  'public-recipe-alias-2026-08-11-b',
]);
assert.ok(allowedAliasSuccessors.has(PUBLIC_RECIPE_ALIAS_VERSION),'v0.4.11.3 approved-alias capability must allow only reviewed successor registries');
assert.ok(PUBLIC_RECIPE_ALIASES.length>=3,'reviewed alias capability must not regress');
const snapshot=buildPublicMasterCatalogSnapshot('recipes');
assert.equal(snapshot.identity_alias_version,PUBLIC_RECIPE_ALIAS_VERSION);
assert.ok(snapshot.catalog_snapshot_id.includes(PUBLIC_RECIPE_ALIAS_VERSION));
const dream=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_id==='curry_dream_eater');assert.ok(dream);
const recognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'recipe_status_update',authority:'recipe_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:'2026-08-11T08:45:00Z',visible_target_count:1,
  observations:[{observation_id:'recipe-live',status:'MATCHED',observed_text:'語意相近但未核准的奶油咖哩',observed_data:{unlocked:true,recipe_level:16,current_energy:11533},canonical_key:{recipe_id:dream.recipe_id,recipe_name:dream.recipe_name},canonical_name:dream.recipe_name,source_image_ref:'image-023',confidence:0.98}],
};
const unsafe=compilePublicMasterRecognitionToUpdatePackage(recognition,'recipes',{allowedImageRefs:['image-023']});
assert.equal(unsafe.ok,false);
assert.equal(unsafe.summary.unresolved_count,1);
assert.equal(unsafe.update_package.operations.length,0,'valid recipe_id alone must never authorize fuzzy auto-write');
const confirmed=applyPublicMasterRecognitionResolution(recognition,'recipes','recipe-live','MATCH',dream.recipe_name);
const afterConfirm=compilePublicMasterRecognitionToUpdatePackage(confirmed,'recipes',{allowedImageRefs:['image-023']});
assert.equal(afterConfirm.ok,true);
assert.equal(afterConfirm.update_package.operations.length,1);

const ui=read('assets/js/unified-screenshot-update-center.js');
assert.equal((ui.match(/applyPayload\(/g)||[]).length,1,'v0.4.11.3 must retain one UC.IMG Apply bridge');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.11.3 must remain schema-migration-free');
const aliasSource=read('assets/js/public-recipe-alias-master.js');
for(const forbidden of ['recipe_level','current_energy','player_record_exists','pokemon_instance_id','INSERT INTO','UPDATE recipes'])assert.equal(aliasSource.includes(forbidden),false,`public alias registry leaked/owned forbidden field: ${forbidden}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.11.3_RELEASE_CONTRACT_SUCCESSOR_AWARE',app_version:'v0.4.11.3',
  weekly_platform_current_week_authority:true,
  weekly_external_stale_fail_closed:true,
  recipe_exact_or_approved_alias_only:true,
  recipe_fuzzy_auto_write:false,
  recipe_user_review_resolution:true,
  alias_registry_version:PUBLIC_RECIPE_ALIAS_VERSION,
  canonical_recipe_authority:true,
  sqlite_migration_added:false,
  single_apply_bridge:true,
},null,2));
