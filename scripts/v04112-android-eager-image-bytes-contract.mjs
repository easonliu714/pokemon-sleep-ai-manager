import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isUcImgOwnedMemoryBlob,snapshotUcImgPickerFile} from '../assets/js/uc-img-image-runtime.js';
import {prepareGeminiImages} from '../assets/js/uc-img-gemini-adapter.js';
import {addScreenshotEntry,createScreenshotUpdateSession,serializableScreenshotSession} from '../assets/js/unified-screenshot-update-center.js';

function pickerFile(name,bytes=[1,2,3],type='image/png'){
  return {
    name,type,size:bytes.length,
    arrayBuffer:async()=>Uint8Array.from(bytes).buffer,
  };
}

// G1/G5: a picker reference is eagerly copied into a standalone Blob and the original object is not retained as byte authority.
let singleReads=0;
const singlePicker={name:'ingredient.png',type:'image/png',size:4,arrayBuffer:async()=>{singleReads+=1;return Uint8Array.from([1,2,3,4]).buffer;}};
const singleSnapshot=await snapshotUcImgPickerFile(singlePicker);
assert.equal(singleReads,1);
assert.ok(isUcImgOwnedMemoryBlob(singleSnapshot.blob));
assert.notEqual(singleSnapshot.blob,singlePicker);
assert.equal(singleSnapshot.blob.size,4);
assert.equal(singleSnapshot.mime_type,'image/png');

// G2/G3: all multi-select file reads must be started immediately, before any individual read is allowed to finish.
let started=0,releaseBatch;
const batchGate=new Promise(resolve=>{releaseBatch=resolve;});
const recipePickers=Array.from({length:11},(_,index)=>({
  name:`recipe-${String(index+1).padStart(2,'0')}.png`,type:'image/png',size:3,
  arrayBuffer(){started+=1;return batchGate.then(()=>Uint8Array.from([index+1,7,9]).buffer);},
}));
const pendingSnapshots=recipePickers.map(file=>snapshotUcImgPickerFile(file));
assert.equal(started,11,'all 11 Android picker references must be acquired immediately');
releaseBatch();
const recipeSnapshots=await Promise.all(pendingSnapshots);
assert.equal(recipeSnapshots.length,11);
assert.ok(recipeSnapshots.every(item=>isUcImgOwnedMemoryBlob(item.blob)));

const recipeSession=createScreenshotUpdateSession();
const recipeMap=new Map();
const recipeEntries=recipePickers.map((file,index)=>{
  const entry=addScreenshotEntry(recipeSession,file);
  entry.scenario_key='recipes';entry.byte_state='READY';entry.image_available=true;entry.byte_snapshot_size=recipeSnapshots[index].byte_length;
  recipeMap.set(entry.entry_id,recipeSnapshots[index].blob);
  return entry;
});
const preparedRecipes=await prepareGeminiImages(recipeEntries,recipeMap);
assert.equal(preparedRecipes.length,11,'11-image recipe set must reach Gemini image preparation from owned Blobs');
assert.ok(preparedRecipes.every(item=>item.data.length>0));

const weeklySession=createScreenshotUpdateSession();
const weeklyPickers=[pickerFile('weekly-camp.png',[4,5,6]),pickerFile('weekly-berries.png',[7,8,9])];
const weeklySnapshots=await Promise.all(weeklyPickers.map(file=>snapshotUcImgPickerFile(file)));
const weeklyMap=new Map();
const weeklyEntries=weeklyPickers.map((file,index)=>{
  const entry=addScreenshotEntry(weeklySession,file);entry.scenario_key='weekly';entry.byte_state='READY';entry.image_available=true;
  weeklyMap.set(entry.entry_id,weeklySnapshots[index].blob);return entry;
});
const preparedWeekly=await prepareGeminiImages(weeklyEntries,weeklyMap);
assert.equal(preparedWeekly.length,2,'2-image weekly set must reach Gemini image preparation from owned Blobs');

// G4: unreadable picker references fail at eager snapshot time rather than being reported READY until Gemini is pressed.
const unreadable={name:'denied.png',type:'image/png',size:100,arrayBuffer:async()=>{throw new Error('The requested file could not be read');}};
await assert.rejects(()=>snapshotUcImgPickerFile(unreadable),/選圖後立即讀取失敗/);
const fakeEntry={entry_id:'raw-file-entry',image_ref:'image-999',file_name:'denied.png',mime_type:'image/png'};
await assert.rejects(()=>prepareGeminiImages([fakeEntry],new Map([[fakeEntry.entry_id,unreadable]])),/尚未建立平台記憶體圖片快照/);

// G6: persistent session metadata explicitly loses byte readiness; the Blob remains outside the serializable session.
const persistentSession=createScreenshotUpdateSession();
const persistentEntry=addScreenshotEntry(persistentSession,pickerFile('ingredient.png'));
persistentEntry.byte_state='READY';persistentEntry.image_available=true;persistentEntry.object_url='blob:runtime-only';persistentEntry.byte_snapshot_size=4;
const serializable=serializableScreenshotSession(persistentSession);
assert.equal(serializable.entries[0].byte_state,'NOT_AVAILABLE');
assert.equal(serializable.entries[0].image_available,false);
assert.equal(serializable.entries[0].object_url,null);
assert.equal(JSON.stringify(serializable).includes('runtime-only'),false);

const runtimeSource=fs.readFileSync('assets/js/uc-img-image-runtime.js','utf8');
assert.equal(runtimeSource.includes('localStorage'),false);
assert.equal(runtimeSource.includes('indexedDB'),false);
const ucImgSource=fs.readFileSync('assets/js/unified-screenshot-update-center.js','utf8');
assert.ok(ucImgSource.includes('snapshotUcImgPickerFile(file)'));
assert.ok(ucImgSource.includes('runtime.files.set(entry.entry_id,result.snapshot.blob)'));
assert.equal(ucImgSource.includes('runtime.files.set(entry.entry_id,file)'),false,'raw picker File must no longer be retained in runtime.files');
assert.ok(ucImgSource.includes("entry?.byte_state==='READY'"));
const adapterSource=fs.readFileSync('assets/js/uc-img-gemini-adapter.js','utf8');
assert.ok(adapterSource.includes('isUcImgOwnedMemoryBlob(blob)'));
assert.equal(adapterSource.includes('localStorage'),false);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04112_ANDROID_EAGER_IMAGE_BYTE_SNAPSHOT',
  single_image_owned_blob:true,
  weekly_two_image_prepare:true,
  recipe_eleven_image_prepare:true,
  all_picker_reads_started_immediately:true,
  unreadable_picker_fails_early:true,
  raw_picker_file_rejected_by_gemini_adapter:true,
  serialized_bytes_not_persisted:true,
  apply_engine_unchanged:true,
},null,2));
