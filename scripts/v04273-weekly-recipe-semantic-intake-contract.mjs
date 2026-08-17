import assert from 'node:assert/strict';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
  isLockedUnknownRecipePlaceholder,
  validatePublicMasterRecognitionPayload,
} from '../assets/js/public-master-recognition.js';
import {
  buildUcImgWeeklyPlatformAuthority,
  applyUcImgWeeklyPlatformAuthority,
  ucImgWeeklySemanticFields,
} from '../assets/js/uc-img-weekly-platform-authority.js';
import {campBerryAuthority,resolveCampFavoriteBerries} from '../assets/js/public-camp-berry-master.js';
import {berryNameForType,resolveBerryStrength} from '../assets/js/public-berry-strength-master.js';
import {MASTER_DATA_VERSION} from '../assets/js/shared-master-data.js';

const recipeSnapshot=buildPublicMasterCatalogSnapshot('recipes');
const placeholders=Array.from({length:4},(_,index)=>({
  observation_id:`locked-${index+1}`,
  status:'UNMATCHED',
  observed_text:'4種食材的點心',
  observed_data:{unlocked:false},
  source_image_ref:'image-079',
  confidence:0.99,
  reason:'LOCKED_UNKNOWN_RECIPE_SLOT',
}));
for(const observation of placeholders)assert.equal(isLockedUnknownRecipePlaceholder(observation),true);
const recipePayload={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:recipeSnapshot.scenario,
  authority:recipeSnapshot.authority,
  data_version:recipeSnapshot.data_version,
  catalog_snapshot_id:recipeSnapshot.catalog_snapshot_id,
  generated_at:'2026-08-17T00:00:00.000Z',
  visible_target_count:4,
  observations:placeholders,
  capacity_observations:[],
};
const recipeValidation=validatePublicMasterRecognitionPayload(recipePayload,'recipes',{allowedImageRefs:['image-079']});
assert.equal(recipeValidation.ok,true,recipeValidation.errors.join('|'));
assert.equal(recipeValidation.unresolved.length,0);
assert.equal(recipeValidation.warnings.filter(message=>message.includes('未解鎖未知料理槽位')).length,4);
const recipeCompiled=compilePublicMasterRecognitionToUpdatePackage(recipePayload,'recipes',{allowedImageRefs:['image-079']});
assert.equal(recipeCompiled.ok,true);
assert.equal(recipeCompiled.summary.matched_count,0);
assert.equal(recipeCompiled.summary.unresolved_count,0);
assert.equal(recipeCompiled.summary.ignored_count,4);
assert.equal(recipeCompiled.update_package.operations.filter(operation=>operation.entity==='recipes').length,0);

const authority=buildUcImgWeeklyPlatformAuthority(new Date('2026-08-17T01:00:00.000Z'));
const platformOnly={
  schema_version:'1.1',
  update_id:'will-be-overridden',
  generated_at:'2026-08-17T00:00:00.000Z',
  source:'ai_screenshot_analysis',
  scenario:'weekly_context_update',
  context_authority:'UPDATE_CENTER_JSON',
  operations:[{
    operation_id:'weekly-1',entity:'weekly_context',action:'upsert',
    key:{context_id:'weekly_context_2026-08-17_import'},
    data:{week_start:'2026-08-17',updated_at:'2026-08-17T00:00:00.000Z'},
    evidence:{source_image_ref:'image-073',source_image_refs:['image-073','image-074'],confidence:0.98},
    review_required:false,
  }],
};
assert.throws(()=>applyUcImgWeeklyPlatformAuthority(platformOnly,authority),error=>error?.code==='UC_IMG_WEEKLY_SEMANTIC_INTAKE_EMPTY');
const semanticPayload=structuredClone(platformOnly);
semanticPayload.operations[0].data.camp='黃金舊發電廠';
const applied=applyUcImgWeeklyPlatformAuthority(semanticPayload,authority);
assert.deepEqual(ucImgWeeklySemanticFields(applied.operations[0].data),['camp']);
assert.equal(applied.operations[0].data.camp,'黃金舊發電廠');
assert.equal(applied.operations[0].data.week_start,'2026-08-17');

const golden=campBerryAuthority('黃金舊發電廠');
assert.deepEqual(golden.favorite_berries,['萄葡果','墨莓果','靛莓果']);
assert.deepEqual(resolveCampFavoriteBerries('黃金舊發電廠',['葡萄果','墨莓果','靛莓果']).berries,['萄葡果','墨莓果','靛莓果']);
assert.equal(berryNameForType('電'),'萄葡果');
const canonicalStrength=resolveBerryStrength('萄葡果',30);
const legacyStrength=resolveBerryStrength('葡萄果',30);
assert.equal(canonicalStrength.status,'ACTIVE_VERIFIED');
assert.equal(legacyStrength.status,'ACTIVE_VERIFIED');
assert.equal(legacyStrength.berry_name,'萄葡果');
assert.equal(legacyStrength.strength,canonicalStrength.strength);
assert.equal(MASTER_DATA_VERSION,'shared-master-2026-08-17-canonical-grepa');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04273_WEEKLY_RECIPE_SEMANTIC_INTAKE',
  locked_recipe_placeholders_ignored:4,
  weekly_platform_only_fail_closed:true,
  weekly_semantic_field:'camp',
  grepa_canonical:'萄葡果',
  legacy_grepa_alias:'葡萄果->萄葡果',
  ingredient_probability_authority:'UNCHANGED_HOLD',
},null,2));
