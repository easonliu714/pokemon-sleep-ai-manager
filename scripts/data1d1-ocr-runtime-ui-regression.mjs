import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui=fs.readFileSync('assets/js/data1d1-ocr-runtime-ui.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

for(const token of ['ocrRuntimeStatusPanel','ocr_runtime_loading','ocr_runtime_progress','ocr_runtime_ready','ocr_runtime_failed','pokemon-sleep:ocr-cancel-requested','preprocessImage','grayscale','binary','threshold','contrast','scale','ocr_preprocess_completed'])assert.match(ui,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(ui,/getContext\('2d'/);
assert.match(ui,/getImageData/);
assert.match(ui,/putImageData/);
assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|OpenAI|Gemini|Anthropic/i);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.45'/);
assert.match(bootstrap,/20260802-data1d1-ocr-runtime-ui/);
assert.match(bootstrap,/data1d1-ocr-runtime-ui\.js/);
assert.match(sw,/v0\.3\.45-data1d1-ocr-runtime-ui/);
assert.match(sw,/data1d1-ocr-runtime-ui\.js/);
console.log('PASS DATA.1D.1 OCR runtime UI and local preprocessing contract');
