import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const target='assets/js/data1d1-ocr-region-ui.js';
assert.ok(fs.existsSync(target),`missing:${target}`);
const checked=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});
assert.equal(checked.status,0,`syntax:${target}:${checked.stderr}`);

const source=fs.readFileSync(target,'utf8');
for(const token of [
  'advanced_review_shell_mounted',
  'advanced_review_frame_yielded',
  'advanced_review_core_started',
  'advanced_review_regions_rendered',
  'advanced_review_candidates_rendered',
  'advanced_review_buttons_rendered',
  'advanced_review_events_attached',
  'advanced_review_core_completed',
  'advanced_review_core_failed',
  'requestAnimationFrame',
  'CANDIDATE_BATCH_SIZE=12',
  'root.ready=initializationPromise',
  'root.dispose=()=>',
  'data-ai-cancel-bootstrap',
  'data-ai-retry-bootstrap'
])assert.match(source,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));

assert.doesNotMatch(source,/const render=\(\)=>\{/);
assert.doesNotMatch(source,/root\.innerHTML=`<h4>OCR 分區與 AI 覆核準備/);
assert.doesNotMatch(source,/\[data-ai-item\]'\)\.forEach\(input=>input\.addEventListener/);

const shellIndex=source.indexOf('advanced_review_shell_mounted');
const coreIndex=source.indexOf('advanced_review_core_started');
const firstYieldIndex=source.indexOf('await yieldFrame(id)');
assert.ok(shellIndex>=0&&firstYieldIndex>shellIndex&&coreIndex>firstYieldIndex,'shell must mount before yielded core initialization');

console.log(JSON.stringify({ok:true,gate:'G13.2I progressive single-item AI review bootstrap',version:'v0.3.67'}));
