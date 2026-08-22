import assert from 'node:assert/strict';
import {
  createImageArchive,
  ANDROID_IMAGE_BYTE_SNAPSHOT_SCHEMA,
} from '../assets/js/android-import-file-picker.js';

function oneShotFile({name,bytes,type='image/png',lastModified=1720000000000,failImmediately=false}){
  let reads=0;
  return {
    name,
    type,
    size:bytes.byteLength,
    lastModified,
    get reads(){return reads;},
    async arrayBuffer(){
      reads+=1;
      if(failImmediately||reads>1){
        const error=new Error(`The requested file could not be read: ${name}`);
        error.name='NotReadableError';
        throw error;
      }
      return bytes.slice().buffer;
    },
  };
}

async function assertBytes(value,expected){
  const buffer=value instanceof Blob?await value.arrayBuffer():value;
  assert.deepEqual([...new Uint8Array(buffer)],[...expected]);
}

const expected=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3,4]);
const source=oneShotFile({name:'1000111060.png',bytes:expected});
const archive=await createImageArchive([source]);

assert.equal(source.reads,1,'raw Android File must be consumed exactly once at intake');
assert.equal(archive.byte_snapshot.schema,ANDROID_IMAGE_BYTE_SNAPSHOT_SCHEMA);
assert.equal(archive.byte_snapshot.ready,true);
assert.equal(archive.byte_snapshot.ready_images,1);
assert.equal(archive.byte_snapshot.failed_images,0);
assert.equal(archive.byte_snapshot.source_read_policy,'single_eager_read_then_detached_bytes');
assert.notEqual(archive.entries[0].file,source,'archive entry must not retain the raw Android File object');
assert.equal(archive.entries[0].byte_snapshot_status,'ready');

await assertBytes(await archive.readImage(source.name,{type:'arraybuffer'}),expected);
await assertBytes(await archive.readImage(source.name,{type:'arraybuffer'}),expected);
await assertBytes(await archive.readImage(source.name,{type:'blob'}),expected);
const uint8=await archive.readImage(source.name,{type:'uint8array'});
assert.deepEqual([...uint8],[...expected]);
assert.equal(source.reads,1,'fingerprint/OCR/preview/AI-style rereads must never return to the raw File');

// Fail-closed per item: one broken SAF handle must be visible in snapshot evidence,
// while already detached sibling images remain reusable.
const good=oneShotFile({name:'good.png',bytes:Uint8Array.from([1,2,3,4])});
const broken=oneShotFile({name:'broken.png',bytes:Uint8Array.from([5,6,7,8]),failImmediately:true});
const mixed=await createImageArchive([good,broken]);
assert.equal(mixed.byte_snapshot.ready,false);
assert.equal(mixed.byte_snapshot.ready_images,1);
assert.equal(mixed.byte_snapshot.failed_images,1);
assert.equal(good.reads,1);
assert.equal(broken.reads,1);
await assertBytes(await mixed.readImage('good.png',{type:'arraybuffer'}),Uint8Array.from([1,2,3,4]));
await assert.rejects(()=>mixed.readImage('broken.png',{type:'arraybuffer'}),error=>error?.name==='NotReadableError');
assert.equal(good.reads,1,'healthy sibling must remain detached after another item fails');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.12_V042725_ANDROID_BYTE_SNAPSHOT',
  raw_source_reads:source.reads,
  replay_reads:4,
  mixed_ready_images:mixed.byte_snapshot.ready_images,
  mixed_failed_images:mixed.byte_snapshot.failed_images,
  snapshot_schema:ANDROID_IMAGE_BYTE_SNAPSHOT_SCHEMA,
},null,2));
