import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files=['assets/js/identity-import-wizard-entry.js','assets/js/update-center-live-debug.js','assets/js/bootstrap.js','service-worker.js'];
for(const file of files){assert.ok(fs.existsSync(file),`missing:${file}`);const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(checked.status,0,`syntax:${file}:${checked.stderr}`);}
const [wizard,live,bootstrap,worker]=files.map(file=>fs.readFileSync(file,'utf8'));
for(const token of ['createLightweightReview','light-review-check','preview-one','archive.readImage','optional-region-preview-started','optional-region-preview-completed','optional-region-ai-advanced-started','selectedItems'])assert.match(wizard,new RegExp(token));
assert.ok(wizard.indexOf('function createLightweightReview')<wizard.indexOf('createOcrRegionAiReviewPanel({inventory:subset'),'lightweight review implementation must contain advanced selected-only mount');
assert.doesNotMatch(wizard,/slot\.replaceChildren\(createOcrRegionAiReviewPanel\(\{inventory:current\.fileResult\.inventory/);
assert.match(wizard,/mode:'lightweight'/);
assert.match(live,/pokemon-sleep-update-center-live-debug\/1\.2/);assert.match(live,/除錯紀錄已匯出/);assert.match(live,/live_debug_exported/);assert.match(live,/document\.body\.appendChild\(link\)/);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.65'/);assert.match(bootstrap,/20260803-g13-2g-lightweight-ai-review/);assert.match(worker,/pokemon-sleep-ai-v0\.3\.65-g13-2g-lightweight-ai-review/);
console.log(JSON.stringify({ok:true,gate:'G13.2G lightweight AI review and export feedback',version:'v0.3.65'}));
