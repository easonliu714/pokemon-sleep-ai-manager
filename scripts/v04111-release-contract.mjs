import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanupRestoredUcImgSession,UC_IMG_SESSION_LIFECYCLE_VERSION} from '../assets/js/uc-img-session-lifecycle.js';
import {restoreScreenshotSession,UC_IMG_A_STORAGE_KEY} from '../assets/js/unified-screenshot-update-center.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';
import {buildUpdatePackageId} from '../assets/js/update-package-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.11.1','v0.4.11.2','v0.4.11.3','v0.4.11.4','v0.4.12','v0.4.13','v0.4.13.1'].includes(appVersion),`unexpected v0.4.11.1 successor: ${appVersion}`);
if(appVersion==='v0.4.11.1'){
  assert.equal(appBuild,'20260811-v04111-uc-img-session-timestamp');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.11.1-v04111-uc-img-session-timestamp');
}else if(appVersion==='v0.4.11.2'){
  assert.equal(appBuild,'20260811-v04112-android-eager-image-bytes');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.11.2-v04112-android-eager-image-bytes');
  assert.ok(version.includes("// app_version: 'v0.4.11.1'"));
}else if(appVersion==='v0.4.11.3'){
  assert.equal(appBuild,'20260811-v04113-weekly-recipe-semantic-safety');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.11.3-v04113-weekly-recipe-semantic-safety');
  for(const predecessor of ['v0.4.11.2','v0.4.11.1'])assert.ok(version.includes(`// app_version: '${predecessor}'`));
}else if(appVersion==='v0.4.11.4'){
  assert.equal(appBuild,'20260811-v04114-recipe-zh-tw-diagnostic-export');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.11.4-v04114-recipe-zh-tw-diagnostic-export');
  for(const predecessor of ['v0.4.11.3','v0.4.11.2','v0.4.11.1'])assert.ok(version.includes(`// app_version: '${predecessor}'`));
}else if(appVersion==='v0.4.12'){
  assert.equal(appBuild,'20260811-v0412-recipe-unified-player-workbench');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.12-v0412-recipe-unified-player-workbench');
  for(const predecessor of ['v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1'])assert.ok(version.includes(`// app_version: '${predecessor}'`),`v0.4.12 must retain ${predecessor} legacy bridge`);
}else if(appVersion==='v0.4.13'){
  assert.equal(appBuild,'20260811-v0413-g7-recipe-portfolio-contention');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.13-v0413-g7-recipe-portfolio-contention');
  for(const predecessor of ['v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1'])assert.ok(version.includes(`// app_version: '${predecessor}'`),`v0.4.13 must retain ${predecessor} legacy bridge`);
}else{
  assert.equal(appBuild,'20260811-v04131-data-preservation-hotfix');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.13.1-v04131-data-preservation-hotfix');
  for(const predecessor of ['v0.4.13','v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1'])assert.ok(version.includes(`// app_version: '${predecessor}'`),`v0.4.13.1 must retain ${predecessor} legacy bridge`);
}
assert.ok(version.includes("// app_version: 'v0.4.11'"),'release must retain v0.4.11 legacy bridge');
assert.ok(version.includes("// app_build: '20260811-v0411-public-master-constrained-recognition'"));
assert.equal(UC_IMG_SESSION_LIFECYCLE_VERSION,'uc-img-session-lifecycle-2026-08-11-a');

function storageFor(session){
  const map=new Map([[UC_IMG_A_STORAGE_KEY,JSON.stringify(session)]]);
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),dump:key=>map.get(key)};
}
function fixture({applied=false}={}){
  return {
    schema:'pokemon-sleep-uc-img-a-session/1.0',version:'uc-img-a-2026-08-11-d-public-master-recognition',session_id:'release-live-fixture',
    created_at:'2026-08-11T03:40:00.000Z',updated_at:'2026-08-11T03:45:00.000Z',status:applied?'partially_applied':'draft',next_image_number:6,
    entries:[{entry_id:'entry-005',image_ref:'image-005',file_name:'1000109518.png',file_size:449000,mime_type:'image/png',scenario_key:'ingredients',classification_source:'manual',selected_at:'2026-08-11T03:44:00.000Z',object_url:null,image_available:false}],
    coverage:{weekly:'PARTIAL',ingredients:'USER_CONFIRMED_COMPLETE',recipes:'PARTIAL'},
    scenario_state:{
      weekly:{raw_response:'',response_stale:false,last_update_id:null,last_apply_status:null},
      ingredients:{raw_response:'{"schema":"pokemon-sleep-public-master-recognition/1.0"}',response_stale:false,last_update_id:applied?'UPD-20260811034511-CATALOG':null,last_apply_status:applied?'APPLIED':null},
      recipes:{raw_response:'',response_stale:false,last_update_id:null,last_apply_status:null},
    },
  };
}

const pure=cleanupRestoredUcImgSession(fixture(),{cleanedAt:'2026-08-11T05:20:00.000Z'});
assert.equal(pure.changed,true);assert.equal(pure.removed_entry_count,1);assert.deepEqual(pure.session.entries,[]);assert.equal(pure.session.next_image_number,6);assert.equal(pure.session.scenario_state.ingredients.response_stale,true);
const storage=storageFor(fixture({applied:true}));
const restored=restoreScreenshotSession(storage);
assert.deepEqual(restored.entries,[]);assert.equal(restored.next_image_number,6);assert.equal(restored.scenario_state.ingredients.response_stale,false);assert.equal(restored.scenario_state.ingredients.last_apply_status,'APPLIED');assert.equal(restored.scenario_state.ingredients.last_update_id,'UPD-20260811034511-CATALOG');
assert.deepEqual(JSON.parse(storage.dump(UC_IMG_A_STORAGE_KEY)).entries,[],'restore owner must persist orphan cleanup');

const snapshot=buildPublicMasterCatalogSnapshot('ingredients');
const aiGeneratedAt='2026-08-11T00:00:00Z';
const recognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'ingredient_inventory_update',authority:'ingredient_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:aiGeneratedAt,visible_target_count:1,
  observations:[{observation_id:'obs-1',status:'MATCHED',observed_text:'沉甸甸南瓜 ×12',observed_data:{quantity:12},canonical_key:{ingredient_name:'沉甸甸南瓜'},canonical_name:'沉甸甸南瓜',source_image_ref:'image-006',confidence:0.99}],
};
const before=Date.now(),compiled=compilePublicMasterRecognitionToUpdatePackage(recognition,'ingredients',{allowedImageRefs:['image-006']}),after=Date.now();
assert.equal(compiled.ok,true);assert.notEqual(compiled.update_package.generated_at,aiGeneratedAt);
const tx=Date.parse(compiled.update_package.generated_at);assert.ok(tx>=before-1000&&tx<=after+1000);
assert.equal(compiled.update_package.update_id,buildUpdatePackageId(compiled.update_package.generated_at,'CATALOG'));

const adapter=read('assets/js/uc-img-gemini-adapter.js');
for(const forbidden of ['localStorage','indexedDB','applyPayload','dryRun'])assert.equal(adapter.includes(forbidden),false,`Gemini adapter ownership regression: ${forbidden}`);
const lifecycle=read('assets/js/uc-img-session-lifecycle.js');
for(const forbidden of ['localStorage','indexedDB'])assert.equal(lifecycle.includes(forbidden),false,`lifecycle helper must remain storage-free: ${forbidden}`);
const ui=read('assets/js/unified-screenshot-update-center.js');
assert.ok(ui.includes('cleanupRestoredUcImgSession(parsed)'));
assert.equal((ui.match(/applyPayload\(/g)||[]).length,1,'release must retain exactly one UC.IMG Apply bridge');
const sw=read('service-worker.js');
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'dynamic lifecycle JS must retain network-first/runtime-cache offline contract');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.11.1 lineage must remain schema-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.11.1_RELEASE_CONTRACT',app_version:appVersion,
  successor_v04112:appVersion==='v0.4.11.2',successor_v04113:appVersion==='v0.4.11.3',successor_v04114:appVersion==='v0.4.11.4',successor_v0412:appVersion==='v0.4.12',successor_v0413:appVersion==='v0.4.13',successor_v04131:appVersion==='v0.4.13.1',
  orphan_screenshot_metadata_cleanup:true,restore_owner:'unified-screenshot-update-center',next_image_number_monotonic:true,
  non_applied_response_fail_closed:true,applied_history_preserved:true,
  platform_owned_catalog_transaction_timestamp:true,ai_timestamp_transaction_authority:false,
  gemini_adapter_storage_free:true,lifecycle_helper_storage_free:true,screenshot_bytes_persisted:false,
  single_apply_bridge:true,sqlite_migration_added:false,offline_runtime_cache_contract:true,
},null,2));
