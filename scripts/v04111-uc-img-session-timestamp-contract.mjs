import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanupRestoredUcImgSession} from '../assets/js/uc-img-session-lifecycle.js';
import {restoreScreenshotSession,UC_IMG_A_STORAGE_KEY} from '../assets/js/unified-screenshot-update-center.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';
import {buildUpdatePackageId} from '../assets/js/update-package-contract.js';

function fakeStorage(initial){
  const data=new Map(Object.entries(initial||{}));
  return {
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value)),
    dump:key=>data.get(key),
  };
}

function sessionFixture({applied=false}={}){
  return {
    schema:'pokemon-sleep-uc-img-a-session/1.0',
    version:'uc-img-a-2026-08-11-d-public-master-recognition',
    session_id:'ucimg-live-fixture',
    created_at:'2026-08-11T03:40:00.000Z',
    updated_at:'2026-08-11T03:45:00.000Z',
    status:applied?'partially_applied':'draft',
    next_image_number:6,
    entries:[{
      entry_id:'entry-image-005',image_ref:'image-005',file_name:'1000109518.png',file_size:449000,mime_type:'image/png',
      scenario_key:'ingredients',classification_source:'manual',selected_at:'2026-08-11T03:44:00.000Z',object_url:null,image_available:false,
    }],
    coverage:{weekly:'PARTIAL',ingredients:'USER_CONFIRMED_COMPLETE',recipes:'PARTIAL'},
    scenario_state:{
      weekly:{raw_response:'',response_stale:false,last_update_id:null,last_apply_status:null},
      ingredients:{
        raw_response:'{"schema":"pokemon-sleep-public-master-recognition/1.0"}',
        response_stale:false,
        last_update_id:applied?'UPD-20260811034511-CATALOG':null,
        last_apply_status:applied?'APPLIED':null,
      },
      recipes:{raw_response:'',response_stale:false,last_update_id:null,last_apply_status:null},
    },
  };
}

const cleanupAt='2026-08-11T05:12:00.000Z';
const pureDraft=cleanupRestoredUcImgSession(sessionFixture(),{cleanedAt:cleanupAt});
assert.equal(pureDraft.changed,true);
assert.equal(pureDraft.removed_entry_count,1);
assert.deepEqual(pureDraft.staled_scenarios,['ingredients']);
assert.deepEqual(pureDraft.session.entries,[]);
assert.equal(pureDraft.session.next_image_number,6,'cleanup must not recycle image refs');
assert.equal(pureDraft.session.scenario_state.ingredients.response_stale,true);

// Real UC.IMG restore remains the only localStorage owner and persists the cleaned session.
const draftStorage=fakeStorage({[UC_IMG_A_STORAGE_KEY]:JSON.stringify(sessionFixture())});
const restoredDraft=restoreScreenshotSession(draftStorage);
assert.deepEqual(restoredDraft.entries,[],'orphan screenshot metadata must disappear at restore time');
assert.equal(restoredDraft.next_image_number,6,'next image ref must remain image-006 after image-005 cleanup');
assert.equal(restoredDraft.scenario_state.ingredients.response_stale,true,'non-applied response that lost image evidence must fail closed');
const persistedDraft=JSON.parse(draftStorage.dump(UC_IMG_A_STORAGE_KEY));
assert.deepEqual(persistedDraft.entries,[],'restore owner must persist the cleanup result');
assert.equal(persistedDraft.last_restore_cleanup.removed_entry_count,1);

const appliedStorage=fakeStorage({[UC_IMG_A_STORAGE_KEY]:JSON.stringify(sessionFixture({applied:true}))});
const restoredApplied=restoreScreenshotSession(appliedStorage);
assert.deepEqual(restoredApplied.entries,[]);
assert.equal(restoredApplied.next_image_number,6);
assert.equal(restoredApplied.scenario_state.ingredients.response_stale,false,'already-applied history must remain readable after orphan cleanup');
assert.equal(restoredApplied.scenario_state.ingredients.last_apply_status,'APPLIED');
assert.equal(restoredApplied.scenario_state.ingredients.last_update_id,'UPD-20260811034511-CATALOG');

const emptyStorage=fakeStorage({[UC_IMG_A_STORAGE_KEY]:JSON.stringify({...sessionFixture(),entries:[]})});
const emptyRestored=restoreScreenshotSession(emptyStorage);
assert.deepEqual(emptyRestored.entries,[]);
assert.equal(emptyRestored.next_image_number,6,'restore without orphan entries must be idempotent');

// Gemini transport must remain storage-free; session ownership stays in UC.IMG.
const adapterSource=fs.readFileSync('assets/js/uc-img-gemini-adapter.js','utf8');
assert.equal(adapterSource.includes('localStorage'),false,'Gemini adapter must remain storage-free');
const lifecycleSource=fs.readFileSync('assets/js/uc-img-session-lifecycle.js','utf8');
assert.equal(lifecycleSource.includes('localStorage'),false,'lifecycle helper must be pure/storage-free');
const ucImgSource=fs.readFileSync('assets/js/unified-screenshot-update-center.js','utf8');
assert.ok(ucImgSource.includes('cleanupRestoredUcImgSession(parsed)'),'restore owner must invoke lifecycle cleanup');

const snapshot=buildPublicMasterCatalogSnapshot('ingredients');
const aiGeneratedAt='2025-03-09T12:00:00Z';
const recognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'ingredient_inventory_update',
  authority:'ingredient_master',
  data_version:snapshot.data_version,
  catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:aiGeneratedAt,
  visible_target_count:1,
  observations:[{
    observation_id:'obs-1',status:'MATCHED',observed_text:'沉甸甸南瓜 ×12',observed_data:{quantity:12},
    canonical_key:{ingredient_name:'沉甸甸南瓜'},canonical_name:'沉甸甸南瓜',source_image_ref:'image-005',confidence:0.99,
  }],
};
const before=Date.now();
const compiled=compilePublicMasterRecognitionToUpdatePackage(recognition,'ingredients',{allowedImageRefs:['image-005']});
const after=Date.now();
assert.equal(compiled.ok,true);
assert.notEqual(compiled.update_package.generated_at,aiGeneratedAt,'AI recognition timestamp must remain metadata, not transaction authority');
const transactionMs=Date.parse(compiled.update_package.generated_at);
assert.ok(Number.isFinite(transactionMs));
assert.ok(transactionMs>=before-1000&&transactionMs<=after+1000,'compiled transaction timestamp must be platform current time');
assert.equal(compiled.update_package.update_id,buildUpdatePackageId(compiled.update_package.generated_at,'CATALOG'),'update_id must derive from platform transaction timestamp');
assert.equal(compiled.update_package.operations[0].evidence.source_image_ref,'image-005');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04111_UC_IMG_SESSION_CLEANUP_PLATFORM_TIMESTAMP',
  restore_owner:'unified-screenshot-update-center',
  orphan_metadata_removed:true,
  non_applied_response_staled:true,
  applied_history_preserved:true,
  next_image_number_monotonic:true,
  cleanup_idempotent:true,
  gemini_adapter_storage_free:true,
  lifecycle_helper_storage_free:true,
  ai_timestamp_used_as_transaction:false,
  platform_timestamp_owned:true,
},null,2));