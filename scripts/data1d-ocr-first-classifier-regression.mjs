import fs from 'node:fs';
import assert from 'node:assert/strict';

const classifier=fs.readFileSync('assets/js/data1d-ocr-first-classifier.js','utf8');
const picker=fs.readFileSync('assets/js/android-import-file-picker.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const worker=fs.readFileSync('service-worker.js','utf8');

for(const token of ['classifyOcrText','classifyInventoryWithOcr','resolveOcrProvider','ocr_first_ai_opt_in_only','ai_requests:0','classification_evidence','requires_review','chi_tra+eng'])assert.match(classifier,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(classifier,/fetch\(|openai|gemini|anthropic|chatgpt/i);
for(const token of ['ocr_classification_progress','ocr_first_classification_completed','AI 請求','不會自動耗用 AI 額度'])assert.match(picker,new RegExp(token));
assert.match(bootstrap,/APP_VERSION = 'v0\.3\.42'/);
assert.match(bootstrap,/20260801-data1d-ocr-first/);
assert.match(bootstrap,/data1d-ocr-first-classifier\.js/);
assert.match(worker,/pokemon-sleep-ai-v0\.3\.42-data1d-ocr-first/);
assert.match(worker,/data1d-ocr-first-classifier\.js/);

const moduleUrl=`data:text/javascript;base64,${Buffer.from(classifier).toString('base64')}`;
const {classifyOcrText}=await import(moduleUrl);
assert.equal(classifyOcrText('主技能 副技能 幫忙速度 Lv. 30').suggested_category,'pokemon');
assert.equal(classifyOcrText('料理 食譜 所需食材 鍋子').suggested_category,'recipe');
assert.equal(classifyOcrText('').classification_status,'not_analyzed');
assert.equal(classifyOcrText('無法辨識的文字').requires_review,true);
console.log('PASS DATA.1D OCR-first classifier; automatic AI requests remain zero');
