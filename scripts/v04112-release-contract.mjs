import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UC_IMG_IMAGE_RUNTIME_VERSION,isUcImgOwnedMemoryBlob,snapshotUcImgPickerFile} from '../assets/js/uc-img-image-runtime.js';
import {prepareGeminiImages,UC_IMG_GEMINI_ADAPTER_VERSION} from '../assets/js/uc-img-gemini-adapter.js';
import {addScreenshotEntry,createScreenshotUpdateSession,serializableScreenshotSession} from '../assets/js/unified-screenshot-update-center.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.11.2');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04112-android-eager-image-bytes');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.11.2-v04112-android-eager-image-bytes');
assert.ok(version.includes("// app_version: 'v0.4.11.1'"));
assert.ok(version.includes("// app_build: '20260811-v04111-uc-img-session-timestamp'"));
assert.ok(version.includes("// app_version: 'v0.4.11'"));
assert.equal(UC_IMG_IMAGE_RUNTIME_VERSION,'uc-img-image-runtime-2026-08-11-a');
assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-11-b-public-master-recognition');

const picker={name:'release-image.png',type:'image/png',size:4,arrayBuffer:async()=>Uint8Array.from([1,2,3,4]).buffer};
const snapshot=await snapshotUcImgPickerFile(picker);
assert.ok(isUcImgOwnedMemoryBlob(snapshot.blob));
assert.notEqual(snapshot.blob,picker);
const session=createScreenshotUpdateSession();
const entry=addScreenshotEntry(session,picker);entry.scenario_key='weekly';entry.byte_state='READY';entry.image_available=true;
const fileMap=new Map([[entry.entry_id,snapshot.blob]]);
const images=await prepareGeminiImages([entry],fileMap);
assert.equal(images.length,1);assert.equal(images[0].imageRef,entry.image_ref);assert.ok(images[0].data.length>0);

const persisted=serializableScreenshotSession(session);
assert.equal(persisted.entries[0].object_url,null);
assert.equal(persisted.entries[0].image_available,false);
assert.equal(persisted.entries[0].byte_state,'NOT_AVAILABLE');

const runtimeSource=read('assets/js/uc-img-image-runtime.js');
for(const forbidden of ['localStorage','indexedDB','applyPayload','dryRun'])assert.equal(runtimeSource.includes(forbidden),false,`image runtime ownership regression: ${forbidden}`);
const adapterSource=read('assets/js/uc-img-gemini-adapter.js');
assert.ok(adapterSource.includes('isUcImgOwnedMemoryBlob(blob)'));
for(const forbidden of ['localStorage','indexedDB','applyPayload','dryRun'])assert.equal(adapterSource.includes(forbidden),false,`Gemini adapter ownership regression: ${forbidden}`);
const ui=read('assets/js/unified-screenshot-update-center.js');
for(const token of [
  'snapshotUcImgPickerFile(file)',
  'runtime.files.set(entry.entry_id,result.snapshot.blob)',
  "byte_state='READY'",
  "byte_state='READ_FAILED'",
  "byte_state:'NOT_AVAILABLE'",
  'READY（記憶體快照）',
])assert.ok(ui.includes(token),`v0.4.11.2 runtime marker missing: ${token}`);
assert.equal(ui.includes('runtime.files.set(entry.entry_id,file)'),false,'raw picker File must not remain runtime byte authority');
assert.equal((ui.match(/applyPayload\(/g)||[]).length,1,'release must retain exactly one UC.IMG Apply bridge');

const lifecycle=read('assets/js/uc-img-session-lifecycle.js');
assert.ok(lifecycle.includes('cleanupRestoredUcImgSession'));
for(const forbidden of ['localStorage','indexedDB'])assert.equal(lifecycle.includes(forbidden),false);
const sw=read('service-worker.js');
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'new runtime JS must keep existing network-first/runtime-cache contract');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.11.2 must remain schema-migration-free');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.11.2_RELEASE_CONTRACT',
  app_version:'v0.4.11.2',
  eager_picker_snapshot:true,
  platform_owned_memory_blob:true,
  raw_picker_file_runtime_authority:false,
  explicit_byte_lifecycle:true,
  screenshot_bytes_persisted:false,
  v04111_restore_semantics_preserved:true,
  gemini_adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
  single_apply_bridge:true,
  sqlite_migration_added:false,
  offline_runtime_cache_contract:true,
},null,2));
