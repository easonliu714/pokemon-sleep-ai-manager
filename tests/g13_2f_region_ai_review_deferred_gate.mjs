import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const files=['assets/js/identity-import-wizard-entry.js','assets/js/bootstrap.js','service-worker.js'];
for(const file of files){assert.equal(fs.existsSync(file),true,`missing:${file}`);const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`syntax:${file}:${result.stderr}`);}
const wizard=fs.readFileSync(files[0],'utf8');
const bootstrap=fs.readFileSync(files[1],'utf8');
const worker=fs.readFileSync(files[2],'utf8');
for(const token of ['mountRegionAiReview','loadRegionAiReviewBtn','optional-region-ai-review-ready','optional-region-ai-review-started','optional-region-ai-review-completed','optional-region-ai-review-failed'])assert.match(wizard,new RegExp(token));
assert.match(wizard,/const batches=\[\['inventory_export',attachInventoryExport\],\['ocr_actions',attachOcrReviewActions\]\]/);
assert.doesNotMatch(wizard,/\['region_ai_review',attachRegionAiReview\]/);
assert.ok(wizard.indexOf("emit('review-render-completed'")<wizard.indexOf("emit('optional-region-ai-review-ready'"),'terminal completion must precede optional AI review readiness');
assert.match(wizard,/AI 覆核面板採兩階段載入/);
assert.match(wizard,/完整人工工作台已改為手動載入/);
assert.match(wizard,/createLightweightReview/);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.66'/);
assert.match(bootstrap,/20260803-g13-2h-sequential-advanced-ai-review/);
assert.match(bootstrap,/region_ai_review_deferred:true/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.66-g13-2h-sequential-advanced-ai-review/);
console.log(JSON.stringify({ok:true,gate:'G13.2F region AI review deferred compatibility',version:'v0.3.66'}));
