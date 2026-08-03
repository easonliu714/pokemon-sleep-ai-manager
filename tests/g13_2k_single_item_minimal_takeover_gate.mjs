import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files=['assets/js/data1d1-ocr-region-single-item-ui.js','assets/js/update-center-live-debug.js'];
for(const file of files){assert.ok(fs.existsSync(file),`missing:${file}`);const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(checked.status,0,`syntax:${file}:${checked.stderr}`);}
const [single,live]=files.map(file=>fs.readFileSync(file,'utf8'));
for(const token of ['single_item_minimal_core','advanced_review_core_completed','buildAiConsentQueue([item]','candidate_count:1','root.ready','root.dispose'])assert.match(single,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for(const token of ['single_item_minimal_takeover_requested','single_item_minimal_takeover_mounted','single_item_minimal_takeover_completed','selectedLightweightItems','data1d1-ocr-region-single-item-ui.js'])assert.match(live,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(live,/source_entry\|compressedContent\|_data/);
assert.match(live,/depth>=4/);
assert.doesNotMatch(single,/CANDIDATE_BATCH_SIZE|createDocumentFragment|querySelectorAll\('\[data-ai-item\]'/);
console.log(JSON.stringify({ok:true,gate:'G13.2K single-item minimal takeover',single_item_minimal_core:true,debug_payload_bounded:true}));
