import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const files=['assets/js/android-import-file-picker.js','assets/js/identity-import-wizard-entry.js','assets/js/update-center-live-debug.js','assets/js/bootstrap.js','service-worker.js','index.html'];
for(const file of files){assert.equal(fs.existsSync(file),true,`missing:${file}`);if(file.endsWith('.js')){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`syntax:${file}:${result.stderr}`);}}
const picker=fs.readFileSync(files[0],'utf8');
const wizard=fs.readFileSync(files[1],'utf8');
const live=fs.readFileSync(files[2],'utf8');
const bootstrap=fs.readFileSync(files[3],'utf8');
const worker=fs.readFileSync(files[4],'utf8');
const html=fs.readFileSync(files[5],'utf8');

for(const token of ['ocr_skipped_duplicate_only','ocrTotal===0','review_render_started','review_render_completed','review_render_failed','withTimeout(onInspect','dispatchBatch(\'completed\''])assert.match(picker,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.ok(picker.indexOf("await withTimeout(onInspect?.(result),15000)")<picker.indexOf("dispatchBatch('completed',batchDetail)"),'completed must occur after essential review render');
for(const token of ['review-render-started','review-render-batch','review-render-completed','attachEssentialBatches','scheduleOptionalWorkbench','yieldUi','updateCenterDynamicContent'])assert.match(wizard,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for(const token of ['本頁即時除錯紀錄','MAX_ENTRIES=120','update-center-debug','review_render_batch','optional-workbench-failed','exportSnapshot'])assert.match(live,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(live,/localStorage|sessionStorage|indexedDB/);
assert.match(live,/REDACT_KEY/);
assert.match(html,/id="updateCenterLiveDebug"/);
assert.match(html,/id="updateCenterDynamicContent"/);
assert.ok(html.indexOf('id="updateCenterDynamicContent"')<html.indexOf('id="importHistoryHeading"'),'history must remain below dynamic content');
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.63'/);
assert.match(bootstrap,/20260803-g13-2e-finalize-nonblocking-workbench/);
assert.match(bootstrap,/update-center-live-debug\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.63-g13-2e-finalize-nonblocking-workbench/);
assert.match(worker,/update-center-live-debug\.js/);
console.log(JSON.stringify({ok:true,gate:'G13.2D duplicate-only finalize isolation and live debug compatibility',version:'v0.3.63'}));
