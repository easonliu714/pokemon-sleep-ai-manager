import fs from 'node:fs';
import assert from 'node:assert/strict';

const moduleSource=fs.readFileSync('assets/js/data1d1-ocr-thumbnail-region-confidence.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');
for(const token of ['OcrThumbnailUrlPool','URL.createObjectURL','URL.revokeObjectURL','maxActive','releaseAll','normalizeRegionConfidence','buildRegionConfidenceSummary','low_confidence','average_confidence','ocr_thumbnail_created','ocr_thumbnail_pool_released'])assert.match(moduleSource,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
const appVersion=bootstrap.match(/APP_VERSION = '(v\d+\.\d+\.\d+)'/)?.[1];
assert.ok(appVersion,'app_version_missing');
assert.match(bootstrap,/const VERSION = '[^']+'/);
assert.match(bootstrap,/data1d1-ocr-thumbnail-region-confidence\.js/);
assert.match(worker,new RegExp(`pokemon-sleep-ai-${appVersion.replaceAll('.','\\.')}-`));
assert.match(worker,/data1d1-ocr-thumbnail-region-confidence\.js/);
assert.doesNotMatch(moduleSource,/fetch\s*\(|XMLHttpRequest|localStorage/);
console.log(`PASS DATA.1D.1 thumbnail lifecycle and region confidence contracts on ${appVersion}`);
