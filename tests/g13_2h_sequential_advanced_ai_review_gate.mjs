import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files=['assets/js/identity-import-wizard-entry.js','assets/js/bootstrap.js','service-worker.js','assets/js/version-authority.js'];
for(const file of files){assert.ok(fs.existsSync(file),`missing:${file}`);const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(checked.status,0,`syntax:${file}:${checked.stderr}`);}
const [wizard,bootstrap,worker,authority]=files.map(file=>fs.readFileSync(file,'utf8'));
for(const token of ['createSequentialAdvancedReview','sequential_single_item','items:[item]','optional-region-ai-advanced-item-started','optional-region-ai-advanced-item-completed','依序覆核選取圖片','上一張','下一張'])assert.match(wizard,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(wizard,/items:selectedItems,summary/);
assert.match(bootstrap,/20260803-g13-2j-android-raf-timeout-fallback/);
assert.match(bootstrap,/sequential_advanced_ai_review:true/);
assert.match(bootstrap,/progressive_ai_review_bootstrap:true/);
assert.match(bootstrap,/android_raf_timeout_fallback:true/);
assert.match(bootstrap,/20260803-g13-2i-progressive-ai-review-bootstrap/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.68-g13-2j-android-raf-timeout-fallback/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.67-g13-2i-progressive-ai-review-bootstrap/);
assert.match(authority,/app_version:\s*'v0\.3\.\d+'/);
assert.match(bootstrap,/authority\.app_version/);
console.log(JSON.stringify({ok:true,gate:'G13.2H sequential advanced AI review compatibility',version_authority:'central'}));
