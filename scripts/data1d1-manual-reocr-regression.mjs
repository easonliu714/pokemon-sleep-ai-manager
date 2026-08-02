import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const files=['assets/js/data1d1-manual-reocr.js','assets/js/bootstrap.js','service-worker.js'];
for(const file of files){assert.equal(fs.existsSync(file),true,`missing:${file}`);if(file.endsWith('.js')){const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(checked.status,0,`syntax:${file}:${checked.stderr}`);}}
const manual=fs.readFileSync(files[0],'utf8');
const bootstrap=fs.readFileSync(files[1],'utf8');
const worker=fs.readFileSync(files[2],'utf8');
for(const token of ['重新 OCR 已勾選圖片','manualReocrSelectedBtn','force_reocr:true','pokemon-sleep:ocr-batch-started','pokemon-sleep:ocr-batch-completed','manual_reocr_settings','archive.readImage','provider.recognize','buildRegionConfig','ocrScale','ocrContrast','ocrThreshold','ocrGrayscale','ocrBinary'])assert.match(manual,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(manual,/selected\.includes\(itemId\(item\)\)/);
assert.match(manual,/item\.status==='duplicate'/);
assert.doesNotMatch(manual,/localStorage|sessionStorage|indexedDB|image_base64|btoa\(/i);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.56'/);
assert.match(bootstrap,/20260803-data1d1-manual-reocr/);
assert.match(bootstrap,/data1d1-manual-reocr\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.56-data1d1-manual-reocr/);
assert.match(worker,/data1d1-manual-reocr\.js/);
console.log(JSON.stringify({ok:true,gate:'v0.3.56 manual re-OCR',duplicate_force_override:true,preprocess_controls:true,region_preset:true,contains_image_persistence:false}));