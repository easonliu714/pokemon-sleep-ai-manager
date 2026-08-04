import assert from 'node:assert/strict';
import {inspectImportFiles,ANDROID_IMPORT_ACCEPT} from '../assets/js/android-import-file-picker.js';

function image(name,type,bytes){const data=new TextEncoder().encode(bytes);return {name,type,size:data.byteLength,lastModified:Date.now(),arrayBuffer:async()=>data.buffer};}
const image1=image('pokemon-01.png','image/png','image-one');
const image2=image('pokemon-02.webp','image/webp','image-two');
const zip={name:'pokemon-details.zip',type:'application/zip'};
const text={name:'notes.txt',type:'text/plain'};
const ocrProvider={name:'test-ocr',recognize:async()=>({text:'SP 468 Lv.14',confidence:99,duration_ms:1})};

const screenshots=await inspectImportFiles([image1,image2],{ocrProvider});
assert.equal(screenshots.ok,true);
assert.equal(screenshots.source_type,'images');
assert.equal(screenshots.files.length,2);
assert.equal(screenshots.inventory.summary.total,2);
assert.equal(typeof screenshots.archives[0].readImage,'function');

const mixed=await inspectImportFiles([image1,zip]);
assert.equal(mixed.ok,false);
assert.deepEqual(mixed.errors,['mixed_zip_and_images_not_allowed']);

const unsupported=await inspectImportFiles([text]);
assert.equal(unsupported.ok,false);
assert.match(unsupported.errors[0],/^unsupported_file:/);

const zipData=new TextEncoder().encode('zip-image');
const archive={entries:[{path:'a.png',name:'a.png',extension:'png',size:zipData.byteLength,directory:false}],summary:{entry_count:1,image_count:1,total_uncompressed_bytes:zipData.byteLength},readImage:async(path,{type='arraybuffer'}={})=>type==='blob'?new Blob([zipData],{type:'image/png'}):zipData.buffer};
const zipped=await inspectImportFiles([zip],{loadZip:async()=>({}),extractZip:async()=>archive,ocrProvider});
assert.equal(zipped.ok,true);
assert.equal(zipped.source_type,'zip');
assert.equal(zipped.archives[0],archive);
assert.equal(zipped.inventory.summary.total,1);
assert.match(ANDROID_IMPORT_ACCEPT,/application\/zip/);
assert.match(ANDROID_IMPORT_ACCEPT,/image\/png/);
console.log('PASS TECH.2D unified Android image and ZIP inspection regression');
