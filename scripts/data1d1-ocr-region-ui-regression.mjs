import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui=fs.readFileSync('assets/js/data1d1-ocr-region-ui.js','utf8');
const wizard=fs.readFileSync('assets/js/identity-import-wizard-entry.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');

for(const token of ['createOcrRegionAiReviewPanel','ocrRegionPreset','ocr-region-preview','全選待覆核','清除選取','ocrAiConsent','ocrAiUploadAck','prepareAiReviewBtn','ai_review_queue_ready','gemini-3.6-flash'])assert.match(ui,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for(const token of ['createOcrRegionAiReviewPanel','ocrRegionAiReviewSlot','AI 覆核 Queue 已準備','預計送出','Project'])assert.match(wizard,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest/);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.48'/);
assert.match(bootstrap,/20260802-data1d1-ocr-region-ui-preview/);
assert.match(bootstrap,/data1d1-ocr-region-ui\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.48-data1d1-ocr-region-ui-preview/);
assert.match(worker,/data1d1-ocr-region-ui\.js/);
console.log('PASS DATA.1D.1 OCR region preview, explicit AI consent UI, private queue boundary, and offline cache contracts');
