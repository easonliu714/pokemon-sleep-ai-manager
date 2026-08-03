import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files=['assets/js/data1d1-ocr-region-direct-minimal-hotfix.js','assets/js/data1d1-ocr-region-single-item-ui.js','index.html','service-worker.js'];
for(const file of files)assert.ok(fs.existsSync(file),`missing:${file}`);
for(const file of files.filter(file=>file.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`syntax:${file}:${result.stderr}`);}
const hotfix=fs.readFileSync(files[0],'utf8');
const shell=fs.readFileSync(files[1],'utf8');
const index=fs.readFileSync(files[2],'utf8');
const worker=fs.readFileSync(files[3],'utf8');
for(const token of ["document.addEventListener('click'","closest?.('#loadSelectedAdvancedReview')",'event.stopImmediatePropagation()','createSingleItemOcrRegionAiReviewPanel','direct_ultra_minimal_ai_intercepted','direct_ultra_minimal_ai_completed',"HOTFIX_VERSION='v0.3.71'","HOTFIX_BUILD='20260803-g13-2n-ultra-minimal-ai-shell'"])assert.match(hotfix,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for(const token of ['ultra-minimal-ai-shell','ultra_minimal_ai_shell_completed','contains_image_bytes:false','contains_api_key:false','Promise.resolve(root)'])assert.match(shell,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(shell,/requestAnimationFrame/);
assert.doesNotMatch(shell,/buildAiConsentQueue/);
assert.match(index,/data1d1-ocr-region-direct-minimal-hotfix\.js/);
assert.match(worker,/data1d1-ocr-region-direct-minimal-hotfix\.js/);
console.log(JSON.stringify({ok:true,gate:'G13.2L direct ultra-minimal AI preemption',version:'v0.3.71',legacy_advanced_core:false}));
