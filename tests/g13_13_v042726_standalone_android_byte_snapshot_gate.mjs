import assert from 'node:assert/strict';
import {snapshotStandaloneImage} from '../assets/js/standalone-image-byte-snapshot.js';

function oneShotFile(name,bytes,{fail=false}={}){
  let reads=0;
  return {
    name,
    type:'image/png',
    size:bytes.byteLength,
    lastModified:1720000000000,
    get reads(){return reads;},
    async arrayBuffer(){
      reads+=1;
      if(fail||reads>1){
        const error=new Error('file_not_readable');
        error.name='NotReadableError';
        throw error;
      }
      return bytes.slice().buffer;
    },
  };
}

const expected=Uint8Array.from([0x89,0x50,0x4e,0x47,9,8,7,6,5,4,3,2,1]);
const source=oneShotFile('standalone-android.png',expected);
const detached=await snapshotStandaloneImage(source);
assert.equal(source.reads,1);
assert.equal(detached.snapshot.ready,true);
assert.equal(detached.snapshot.ready_images,1);
assert.equal(detached.snapshot.failed_images,0);
assert.equal(detached.snapshot.source_read_policy,'single_eager_read_then_detached_bytes');
for(let replay=0;replay<4;replay+=1){
  assert.deepEqual([...new Uint8Array(await detached.blob.arrayBuffer())],[...expected]);
}
assert.equal(source.reads,1);

const broken=oneShotFile('standalone-broken.png',Uint8Array.from([1,2,3]),{fail:true});
await assert.rejects(()=>snapshotStandaloneImage(broken),error=>error?.code==='standalone_image_snapshot_failed');
assert.equal(broken.reads,1);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.13_V042726_STANDALONE_ANDROID_BYTE_SNAPSHOT',
  raw_source_reads:source.reads,
  detached_replay_reads:4,
  failed_source_reads:broken.reads,
},null,2));
