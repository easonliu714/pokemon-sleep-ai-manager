import assert from 'node:assert/strict';
import {inspectImportFiles,ANDROID_IMPORT_ACCEPT} from '../assets/js/android-import-file-picker.js';

const image={name:'pokemon-01.png',type:'image/png'};
const image2={name:'pokemon-02.webp',type:'image/webp'};
const zip={name:'pokemon-details.zip',type:'application/zip'};
const text={name:'notes.txt',type:'text/plain'};

const screenshots=await inspectImportFiles([image,image2]);
assert.equal(screenshots.ok,true);
assert.equal(screenshots.source_type,'screenshots');
assert.equal(screenshots.files.length,2);

const mixed=await inspectImportFiles([image,zip]);
assert.equal(mixed.ok,false);
assert.deepEqual(mixed.errors,['mixed_zip_and_images_not_allowed']);

const unsupported=await inspectImportFiles([text]);
assert.equal(unsupported.ok,false);
assert.match(unsupported.errors[0],/^unsupported_file:/);

const archive={summary:{entry_count:3,image_count:2,total_uncompressed_bytes:1024}};
const zipped=await inspectImportFiles([zip],{
  loadZip:async()=>({loadAsync(){}}),
  extractZip:async()=>archive
});
assert.equal(zipped.ok,true);
assert.equal(zipped.source_type,'zip');
assert.equal(zipped.archives[0],archive);
assert.match(ANDROID_IMPORT_ACCEPT,/application\/zip/);
assert.match(ANDROID_IMPORT_ACCEPT,/image\/png/);
console.log('PASS TECH.2D Android file picker and ZIP inspection regression');
