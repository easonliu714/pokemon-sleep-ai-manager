import assert from 'node:assert/strict';
import {extractZipEntries} from '../assets/js/pokemon-zip-adapter.js';
import {buildObservationPayloadFromScreenshotGroups} from '../assets/js/screenshot-observation-bridge.js';
import {buildCreatePayload,buildUpdatePayload} from '../assets/js/identity-import-apply-operation.js';

const fakeArchive={files:{
  'a.png':{name:'a.png',dir:false,_data:{uncompressedSize:100},async:async()=>new Uint8Array([1])},
  'notes.txt':{name:'notes.txt',dir:false,_data:{uncompressedSize:10},async:async()=>new Uint8Array([2])},
  'folder/':{name:'folder/',dir:true,_data:{uncompressedSize:0},async:async()=>new Uint8Array([])}
},file(path){return this.files[path]||null;}};
const JSZip={loadAsync:async()=>fakeArchive};
const extracted=await extractZipEntries(new Uint8Array([0]),{JSZip});
assert.equal(extracted.summary.entry_count,3);
assert.equal(extracted.summary.image_count,1);
assert.equal((await extracted.readImage('a.png',{type:'uint8array'}))[0],1);
await assert.rejects(()=>extracted.readImage('notes.txt'),/zip_entry_not_image/);

const groups=[{group_key:'土王|31|1183',header:{name:'土王',level:31,sp:1183},images:[{path:'a.png'}]}];
const bridged=buildObservationPayloadFromScreenshotGroups(groups,{
  '土王|31|1183':{
    ocrObservation:{profile:{species:'土王',level:31,sp:1183},progression:{sleep_hours_with_helper:125},evidence:{source_image_refs:['a.png']}},
    aiObservation:{profile:{nature:'慢吞吞'},evidence:{field_confidence:{nature:0.99}}}
  }
});
assert.equal(bridged.errors.length,0);
assert.equal(bridged.payload.observations[0].profile.nature,'慢吞吞');
assert.equal(bridged.payload.observations[0].progression.sleep_hours_with_helper,125);

const observation=bridged.payload.observations[0];
const createPayload=buildCreatePayload({action:'create_new'},observation);
assert.equal(createPayload.species,'土王');
assert.equal(createPayload.sleep_hours_with_helper,125);
const updatePayload=buildUpdatePayload({action:'accept_existing',pokemon_instance_id:'inst-1'},observation,{sleep_hours_with_helper:100});
assert.equal(updatePayload.sleep_hours_with_helper,125);
assert.throws(()=>buildUpdatePayload({action:'accept_existing',pokemon_instance_id:'inst-1'},{profile:{level:31},progression:{sleep_hours_with_helper:90}},{sleep_hours_with_helper:100}),/sleep_hours_regression_requires_review/);
console.log('PASS TECH.2D ZIP extraction observation bridge and guarded apply allowlists');
