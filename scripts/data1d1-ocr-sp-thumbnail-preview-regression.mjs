import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyOcrText,CLASSIFIER_SCHEMA,CATEGORY_RULES} from '../assets/js/data1d-ocr-first-classifier.js';

const paths={classifier:'assets/js/data1d-ocr-first-classifier.js',regionUi:'assets/js/data1d1-ocr-region-ui.js',wiring:'assets/js/data1d1-ocr-overlay-preview-event-wiring.js',bootstrap:'assets/js/bootstrap.js',worker:'service-worker.js'};
for(const path of Object.values(paths)){assert.equal(fs.existsSync(path),true,`missing:${path}`);const checked=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});assert.equal(checked.status,0,`syntax:${path}:${checked.stderr}`);}
const source=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,fs.readFileSync(path,'utf8')]));
assert.equal(CLASSIFIER_SCHEMA,'pokemon-sleep-ocr-first-classifier/1.2');
assert.equal(CATEGORY_RULES.pokemon.tokens.includes('sp'),true);
const joint=classifyOcrText('Lv. 31 SP 1789');
const levelOnly=classifyOcrText('Lv. 31');
assert.equal(joint.suggested_category,'pokemon');
assert.ok(joint.classification_confidence>levelOnly.classification_confidence,'lv_sp_joint_boost_missing');
assert.ok(joint.classification_evidence.some(value=>value.includes('sp')),'sp_evidence_missing');
for(const token of ['ocr-ai-candidate','PREVIEW_ROW_SELECTOR','archive.readImage(path,{type:\'blob\'})','pokemon-sleep:ocr-overlay-preview-requested'])assert.match(source.wiring,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for(const token of ['URL.createObjectURL','URL.revokeObjectURL','ocr-region-preview-image','ocr_region_preview_rendered','pokemon-sleep:ocr-overlay-preview-cleared','root.dispose'])assert.match(source.regionUi,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(source.regionUi,/localStorage|sessionStorage|image_base64|btoa\(/);
assert.match(source.bootstrap,/APP_VERSION = 'v0\.3\.53'/);
assert.match(source.bootstrap,/20260802-data1d1-ocr-sp-thumbnail-preview/);
assert.match(source.worker,/pokemon-sleep-ai-v0\.3\.53-data1d1-ocr-sp-thumbnail-preview/);
console.log(JSON.stringify({ok:true,gate:'v0.3.53 OCR SP + thumbnail preview',classifier_schema:CLASSIFIER_SCHEMA,joint_confidence:joint.classification_confidence,level_only_confidence:levelOnly.classification_confidence}));
