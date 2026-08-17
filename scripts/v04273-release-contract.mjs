import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  validatePublicMasterRecognitionPayload,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';
import {
  UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION,
  buildUcImgWeeklyPlatformAuthority,
  applyUcImgWeeklyPlatformAuthority,
} from '../assets/js/uc-img-weekly-platform-authority.js';
import {PUBLIC_CAMP_BERRY_VERSION,campBerryAuthority,resolveCampFavoriteBerries} from '../assets/js/public-camp-berry-master.js';
import {PUBLIC_BERRY_STRENGTH_VERSION,berryNameForType,resolveBerryStrength} from '../assets/js/public-berry-strength-master.js';
import {MASTER_DATA_VERSION} from '../assets/js/shared-master-data.js';
import {E3C6B_SCHEMA_MIGRATION_VERSION} from '../assets/js/migrations.js';
import {INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION} from '../assets/js/ingredient-inventory-integrity-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionSource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(versionSource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
assert.equal(authority.app_version,'v0.4.27.3');
assert.equal(authority.app_build,'20260817-v04273-weekly-recipe-semantic-intake-hotfix');
assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.27.3-v04273-weekly-recipe-semantic-intake-hotfix');
for(const token of [
  "// app_version: 'v0.4.27.2'",
  "// app_build: '20260816-v04272-ingredient-unlock-semantics-hotfix'",
  "// cache_name: 'pokemon-sleep-ai-v0.4.27.2-v04272-ingredient-unlock-semantics-hotfix'",
])assert.ok(versionSource.includes(token),`missing predecessor lineage ${token}`);

assert.equal(MASTER_DATA_VERSION,'shared-master-2026-08-17-canonical-grepa');
assert.equal(PUBLIC_CAMP_BERRY_VERSION,'public-camp-berry-2026-08-17-b-canonical-grape');
assert.equal(PUBLIC_BERRY_STRENGTH_VERSION,'public-berry-strength-2026-08-17-b-canonical-grepa');
assert.equal(PUBLIC_MASTER_RECOGNITION_VERSION,'public-master-recognition-2026-08-17-d-locked-placeholder');
assert.equal(UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION,'uc-img-weekly-platform-authority-2026-08-17-c-semantic-intake-gate');
assert.deepEqual(campBerryAuthority('黃金舊發電廠').favorite_berries,['萄葡果','墨莓果','靛莓果']);
assert.equal(berryNameForType('電'),'萄葡果');
assert.deepEqual(resolveCampFavoriteBerries('黃金舊發電廠',['葡萄果','墨莓果','靛莓果']).berries,['萄葡果','墨莓果','靛莓果']);
assert.equal(resolveBerryStrength('葡萄果',30).berry_name,'萄葡果');

const recipeSnapshot=buildPublicMasterCatalogSnapshot('recipes');
const lockedObservation={observation_id:'locked-1',status:'UNMATCHED',observed_text:'4種食材的點心',observed_data:{unlocked:false},source_image_ref:'image-079',confidence:0.99,reason:'LOCKED_UNKNOWN_RECIPE_SLOT'};
const recipePayload={schema:'pokemon-sleep-public-master-recognition/1.0',recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:recipeSnapshot.scenario,authority:recipeSnapshot.authority,data_version:recipeSnapshot.data_version,catalog_snapshot_id:recipeSnapshot.catalog_snapshot_id,generated_at:'2026-08-17T00:00:00.000Z',visible_target_count:1,observations:[lockedObservation],capacity_observations:[]};
const recipeValidation=validatePublicMasterRecognitionPayload(recipePayload,'recipes',{allowedImageRefs:['image-079']});
assert.equal(recipeValidation.ok,true);assert.equal(recipeValidation.unresolved.length,0);
const recipeCompiled=compilePublicMasterRecognitionToUpdatePackage(recipePayload,'recipes',{allowedImageRefs:['image-079']});
assert.equal(recipeCompiled.summary.ignored_count,1);assert.equal(recipeCompiled.summary.unresolved_count,0);assert.equal(recipeCompiled.update_package.operations.length,0);

const weeklyAuthority=buildUcImgWeeklyPlatformAuthority(new Date('2026-08-17T01:00:00.000Z'));
const weeklyPlatformOnly={schema_version:'1.1',update_id:'fixture',generated_at:'2026-08-17T00:00:00.000Z',source:'ai_screenshot_analysis',scenario:'weekly_context_update',context_authority:'UPDATE_CENTER_JSON',operations:[{operation_id:'weekly',entity:'weekly_context',action:'upsert',key:{context_id:'weekly_context_2026-08-17_import'},data:{week_start:'2026-08-17',updated_at:'2026-08-17T00:00:00.000Z'},evidence:{source_image_ref:'image-073',confidence:1},review_required:false}]};
assert.throws(()=>applyUcImgWeeklyPlatformAuthority(weeklyPlatformOnly,weeklyAuthority),error=>error?.code==='UC_IMG_WEEKLY_SEMANTIC_INTAKE_EMPTY');

assert.equal(E3C6B_SCHEMA_MIGRATION_VERSION,11);
assert.equal(INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION,13);
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('VALUES(10,'),false,'migration 10 must remain historical sentinel');
const production=read('assets/js/production-authority-registry.js');
for(const token of ['ingredient_probability_per_help','NOT_YET_VERIFIED','4/7'])assert.ok(production.includes(token),`Production 4/7 HOLD boundary missing ${token}`);
const sw=read('service-worker.js');for(const token of ['pokemon-sleep-ai-v0.4.27.2-v04272-ingredient-unlock-semantics-hotfix','public-camp-berry-master.js','uc-img-weekly-platform-authority.js','public-master-recognition.js','public-berry-strength-master.js','shared-master-data.js'])assert.ok(sw.includes(token),`PWA cache contract missing ${token}`);
const workflows=fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name));assert.equal(workflows.length,12,'v0.4.27.3 must not change consolidated workflow topology');

console.log(JSON.stringify({status:'PASS',gate:'V0.4.27.3_RELEASE_CONTRACT',app_version:authority.app_version,canonical_grepa:'萄葡果',locked_recipe_placeholder_review_required:false,weekly_platform_only_fail_closed:true,schema_migration_added:false,production_numeric_authority:'4/7_HOLD_INGREDIENT_PROBABILITY',workflow_count:workflows.length,android_pwa_live_validation_required:true},null,2));
