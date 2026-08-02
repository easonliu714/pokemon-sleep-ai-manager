import fs from 'node:fs';
import assert from 'node:assert/strict';

const moduleSource=fs.readFileSync('assets/js/data1d1-ocr-thumbnail-region-confidence.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');
for(const token of ['OcrThumbnailUrlPool','URL.createObjectURL','URL.revokeObjectURL','maxActive','releaseAll','normalizeRegionConfidence','buildRegionConfidenceSummary','low_confidence','average_confidence','ocr_thumbnail_created','ocr_thumbnail_pool_released'])assert.match(moduleSource,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.49'/);
assert.match(bootstrap,/20260802-data1d1-ocr-thumbnail-region-confidence/);
assert.match(bootstrap,/data1d1-ocr-thumbnail-region-confidence\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.49-data1d1-ocr-thumbnail-region-confidence/);
assert.match(worker,/data1d1-ocr-thumbnail-region-confidence\.js/);
assert.doesNotMatch(moduleSource,/fetch\s*\(|XMLHttpRequest|localStorage/);
console.log('PASS DATA.1D.1 thumbnail lifecycle and region confidence contracts');
