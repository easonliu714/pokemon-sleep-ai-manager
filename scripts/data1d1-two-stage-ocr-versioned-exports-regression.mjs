import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const files=['assets/js/runtime-version.js','assets/js/data1d1-manual-reocr.js','assets/js/data1-inventory-review-ui.js','assets/js/data1-zip-inventory.js','assets/js/data1d1-ocr-review-package.js','assets/js/bootstrap.js','service-worker.js'];
for(const file of files){assert.equal(fs.existsSync(file),true,`missing:${file}`);if(file.endsWith('.js')){const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(checked.status,0,`syntax:${file}:${checked.stderr}`);}}
const runtime=fs.readFileSync(files[0],'utf8');
const manual=fs.readFileSync(files[1],'utf8');
const reviewUi=fs.readFileSync(files[2],'utf8');
const inventory=fs.readFileSync(files[3],'utf8');
const ocrReview=fs.readFileSync(files[4],'utf8');
const bootstrap=fs.readFileSync(files[5],'utf8');
const worker=fs.readFileSync(files[6],'utf8');

for(const token of ['getRuntimeVersion','buildVersionedExportFilename','attachRuntimeVersion','app_version','app_build'])assert.match(runtime,new RegExp(token));
assert.match(runtime,/pokemon_sleep_\$\{cleanToken\(kind/);
assert.match(reviewUi,/buildVersionedExportFilename\('fingerprint_duplicate_manifest'/);
assert.match(reviewUi,/buildVersionedExportFilename\('private_review_package'/);
assert.match(inventory,/attachRuntimeVersion\(manifest\)/);
assert.match(ocrReview,/buildVersionedExportFilename\('private_ocr_review'/);
assert.doesNotMatch(reviewUi,/safeBase\(current\?\.archive\?\.name\)_fingerprint/);

for(const token of ['GENERAL_SCALE=2','SMALL_TEXT_SCALE=4','two_stage:true','evidence_merged:true','mergeUniqueTexts'])assert.match(manual,new RegExp(token));
assert.match(manual,/provider,'general'\)/);
assert.match(manual,/provider,'small_text'\)/);
assert.match(manual,/stage:output\.stage/);
assert.match(manual,/binary:false/);
assert.match(manual,/全圖一般倍率/);
assert.match(manual,/全圖小字補辨識/);
assert.doesNotMatch(manual,/localStorage|sessionStorage|indexedDB|image_base64|btoa\(/i);

assert.match(bootstrap,/APP_VERSION = 'v0\.3\.57'/);
assert.match(bootstrap,/20260803-data1d1-two-stage-ocr-versioned-exports/);
assert.match(bootstrap,/runtime-version\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.57-data1d1-two-stage-ocr-versioned-exports/);
assert.match(worker,/runtime-version\.js/);
console.log(JSON.stringify({ok:true,gate:'v0.3.57 two-stage OCR and versioned exports',general_scale:2,small_text_scale:4,versioned_exports:true}));
