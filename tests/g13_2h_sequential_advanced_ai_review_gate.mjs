import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files=['assets/js/identity-import-wizard-entry.js','assets/js/bootstrap.js','service-worker.js'];
for(const file of files){assert.ok(fs.existsSync(file),`missing:${file}`);const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(checked.status,0,`syntax:${file}:${checked.stderr}`);}
const [wizard,bootstrap,worker]=files.map(file=>fs.readFileSync(file,'utf8'));
for(const token of ['createSequentialAdvancedReview','sequential_single_item','items:[item]','optional-region-ai-advanced-item-started','optional-region-ai-advanced-item-completed','依序覆核選取圖片','上一張','下一張'])assert.match(wizard,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(wizard,/items:selectedItems,summary/);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.67'/);
assert.match(bootstrap,/20260803-g13-2i-progressive-ai-review-bootstrap/);
assert.match(bootstrap,/sequential_advanced_ai_review:true/);
assert.match(bootstrap,/progressive_ai_review_bootstrap:true/);
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.66' 20260803-g13-2h-sequential-advanced-ai-review/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.67-g13-2i-progressive-ai-review-bootstrap/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.66-g13-2h-sequential-advanced-ai-review/);
console.log(JSON.stringify({ok:true,gate:'G13.2H sequential advanced AI review compatibility',version:'v0.3.67'}));