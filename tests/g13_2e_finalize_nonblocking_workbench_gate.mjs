import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files=['assets/js/identity-import-wizard-entry.js','assets/js/update-center-live-debug.js','assets/js/bootstrap.js','service-worker.js'];
for(const file of files){assert.equal(fs.existsSync(file),true,`missing:${file}`);const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`syntax:${file}:${result.stderr}`);}
const wizard=fs.readFileSync(files[0],'utf8'),live=fs.readFileSync(files[1],'utf8'),bootstrap=fs.readFileSync(files[2],'utf8'),worker=fs.readFileSync(files[3],'utf8');
for(const token of ['duplicateOnly','renderDuplicateLite','attachEssentialBatches','mountOptionalWorkbench','review-render-completed','optional-workbench-started','optional-workbench-completed'])assert.match(wizard,new RegExp(token));
assert.ok(wizard.indexOf("emit('review-render-completed'")<wizard.indexOf("emit('optional-workbench-ready'"),'terminal completion must precede optional workbench readiness');
assert.doesNotMatch(wizard,/\['review_workbench',attachReviewWorkbench\]/);
assert.match(wizard,/完整人工工作台已改為手動載入/);
assert.match(live,/LIVE_DEBUG_SCHEMA='pokemon-sleep-update-center-live-debug\/1\.2'/);
assert.match(live,/optional-workbench-failed/);
assert.match(live,/const REDACT_KEY=\/\^\(/);
assert.match(live,/ocr_full_text\)\$\/i/);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.65'/);
assert.match(bootstrap,/20260803-g13-2g-lightweight-ai-review/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.65-g13-2g-lightweight-ai-review/);
console.log(JSON.stringify({ok:true,gate:'G13.2E finalize nonblocking workbench compatibility',version:'v0.3.65'}));
