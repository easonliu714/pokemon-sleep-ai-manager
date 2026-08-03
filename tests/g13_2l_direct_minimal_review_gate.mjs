import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const files=[
  'assets/js/data1d1-ocr-region-direct-minimal-hotfix.js',
  'assets/js/data1d1-ocr-region-single-item-ui.js',
  'index.html',
  'service-worker.js'
];
for(const file of files)assert.ok(fs.existsSync(file),`missing:${file}`);
for(const file of files.filter(file=>file.endsWith('.js'))){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,`syntax:${file}:${result.stderr}`);
}
const hotfix=fs.readFileSync(files[0],'utf8');
const index=fs.readFileSync(files[2],'utf8');
const worker=fs.readFileSync(files[3],'utf8');
for(const token of [
  "document.addEventListener('click'",
  "closest?.('#loadSelectedAdvancedReview')",
  'event.stopImmediatePropagation()',
  'createSingleItemOcrRegionAiReviewPanel',
  'direct_minimal_review_intercepted',
  'direct_minimal_review_completed',
  "HOTFIX_VERSION='v0.3.69'",
  "HOTFIX_BUILD='20260803-g13-2l-direct-minimal-review'"
])assert.match(hotfix,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(index,/data1d1-ocr-region-direct-minimal-hotfix\.js\?v=20260803-g13-2l-direct-minimal-review/);
assert.match(index,/bootstrap\.js\?v=20260803-g13-2l-direct-minimal-review/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.68-g13-2j-android-raf-timeout-fallback/);
assert.match(worker,/data1d1-ocr-region-direct-minimal-hotfix\.js/);
assert.ok(index.indexOf('bootstrap.js?v=20260803-g13-2l-direct-minimal-review')<index.indexOf('data1d1-ocr-region-direct-minimal-hotfix.js?v=20260803-g13-2l-direct-minimal-review'));
console.log(JSON.stringify({ok:true,gate:'G13.2L direct minimal review preemption',version:'v0.3.69',cache_contract:'v0.3.68-bootstrap-compatible'}));
