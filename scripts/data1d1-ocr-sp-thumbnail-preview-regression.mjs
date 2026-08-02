import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyOcrText,CLASSIFIER_SCHEMA,CATEGORY_RULES,tokenMatches} from '../assets/js/data1d-ocr-first-classifier.js';
import {buildAiConsentQueue,AI_CONSENT_SCHEMA} from '../assets/js/data1d1-ocr-region-ai-consent.js';

const paths={classifier:'assets/js/data1d-ocr-first-classifier.js',regionUi:'assets/js/data1d1-ocr-region-ui.js',consent:'assets/js/data1d1-ocr-region-ai-consent.js',wiring:'assets/js/data1d1-ocr-overlay-preview-event-wiring.js',bootstrap:'assets/js/bootstrap.js',worker:'service-worker.js'};
for(const path of Object.values(paths)){assert.equal(fs.existsSync(path),true,`missing:${path}`);const checked=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});assert.equal(checked.status,0,`syntax:${path}:${checked.stderr}`);}
const source=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,fs.readFileSync(path,'utf8')]));
assert.equal(CLASSIFIER_SCHEMA,'pokemon-sleep-ocr-first-classifier/1.3');
assert.equal(CATEGORY_RULES.pokemon.tokens.includes('sp'),true);
const joint=classifyOcrText('Lv. 31 SP 1789');
const levelOnly=classifyOcrText('Lv. 31');
const spOnly=classifyOcrText('SP 1789');
const strong=classifyOcrText('主技能 Lv. 31');
assert.equal(joint.suggested_category,'pokemon');
assert.equal(levelOnly.suggested_category,'other');
assert.equal(spOnly.suggested_category,'other');
assert.equal(strong.suggested_category,'pokemon');
assert.ok(joint.classification_confidence>levelOnly.classification_confidence,'lv_sp_joint_boost_missing');
assert.ok(joint.classification_evidence.some(value=>value.includes('sp')),'sp_evidence_missing');
assert.equal(tokenMatches('display response screenshot inspection','sp'),false,'sp_substring_false_positive');
assert.equal(tokenMatches('pokemon sp 1789','sp'),true,'sp_word_boundary_missing');

const duplicate={sha256:'dup-sha',path:'duplicate.png',status:'duplicate',classification_status:'skipped'};
const review={sha256:'review-sha',path:'review.png',requires_review:true,classification_status:'suggested'};
assert.equal(buildAiConsentQueue([duplicate],{selectedIds:[]}).selected_count,0);
const manual=buildAiConsentQueue([duplicate],{selectedIds:['dup-sha']});
assert.equal(AI_CONSENT_SCHEMA,'pokemon-sleep-ai-consent-queue/1.1');
assert.equal(manual.selected_count,1);
assert.equal(manual.manual_duplicate_count,1);
assert.equal(manual.items[0].manual_duplicate_override,true);
assert.equal(buildAiConsentQueue([duplicate,review],{selectedIds:['dup-sha','review-sha']}).selected_count,2);

for(const token of ['ocr-ai-candidate','PREVIEW_ROW_SELECTOR',"archive.readImage(path,{type:'blob'})",'pokemon-sleep:ocr-overlay-preview-requested'])assert.match(source.wiring,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for(const token of ['URL.createObjectURL','URL.revokeObjectURL','ocr-region-preview-image','updatePreviewDom','previousScrollTop','list_position_preserved','ocr_region_preview_rendered','pokemon-sleep:ocr-overlay-preview-cleared','重複圖片：需人工勾選才覆判','duplicate_ai_review_manually_selected','全選一般待覆核','root.dispose'])assert.match(source.regionUi,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(source.regionUi,/localStorage|sessionStorage|image_base64|btoa\(/);
assert.match(source.bootstrap,/APP_VERSION = 'v0\.3\.54'/);
assert.match(source.bootstrap,/20260802-data1d1-preview-scroll-ocr-precision/);
assert.match(source.worker,/pokemon-sleep-ai-v0\.3\.54-data1d1-preview-scroll-ocr-precision/);
console.log(JSON.stringify({ok:true,gate:'v0.3.54 preview scroll preservation + OCR weak-token precision',classifier_schema:CLASSIFIER_SCHEMA,ai_consent_schema:AI_CONSENT_SCHEMA,joint_confidence:joint.classification_confidence,level_only_category:levelOnly.suggested_category,sp_only_category:spOnly.suggested_category,manual_duplicate_queue_count:manual.selected_count}));
