import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files=['assets/js/data1d1-ocr-ai-ab-diagnostic.js','assets/js/data1d1-ocr-region-direct-minimal-hotfix.js','assets/js/data1d1-ocr-region-single-item-ui.js','assets/js/ai-review-queue-executor.js','assets/js/analysis-revision-store.js'];
for(const file of files){assert.ok(fs.existsSync(file),`missing:${file}`);const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`syntax:${file}:${result.stderr}`);}
const diagnostic=fs.readFileSync(files[0],'utf8'),hotfix=fs.readFileSync(files[1],'utf8'),panel=fs.readFileSync(files[2],'utf8'),executor=fs.readFileSync(files[3],'utf8'),store=fs.readFileSync(files[4],'utf8');
for(const token of ['localOcrRuntime.recognize','cropBlob','forced_ocr_started','forced_ocr_completed','executeAiReviewQueue','createArchiveImageResolver','readBlobAsData','real_ai_analysis_started','real_ai_analysis_completed','saveAnalysisRevision','listAnalysisRevisions'])assert.ok(diagnostic.includes(token),`diagnostic_missing:${token}`);
for(const token of ["HOTFIX_VERSION='v0.3.72'","HOTFIX_BUILD='20260803-g13-3a-real-ocr-ai-execution'",'executePreparedAiPayload','direct_real_ai_execution_requested'])assert.ok(hotfix.includes(token),`hotfix_missing:${token}`);
for(const token of ['強制執行單張 AI 分析','await onPrepared','pokemon-sleep-ai-consent-queue/1.4-real-execution'])assert.ok(panel.includes(token),`panel_missing:${token}`);
for(const token of ['prompt=DEFAULT_PROMPT','bypassCache=false','const cached=bypassCache?null','imageBase64'])assert.ok(executor.includes(token),`executor_missing:${token}`);
assert.ok(executor.includes('prompt,imageBase64')||executor.includes('prompt:effectivePrompt,imageBase64'),'executor_missing:prompt transport binding');
if(executor.includes('buildExistingBaselinePrompt')){
  assert.ok(executor.includes('const effectivePrompt=promptContext.prompt'),'baseline successor must build effective prompt');
  assert.ok(executor.includes('prompt:effectivePrompt,imageBase64'),'baseline successor must send effective prompt with real image bytes');
}
for(const token of ['CREATE TABLE IF NOT EXISTS image_analysis_revision','before_analysis_revision_','supersedes_analysis_id','await persist()'])assert.ok(store.includes(token),`store_missing:${token}`);
assert.ok(!diagnostic.includes('只在本機建立預覽與 AI Queue，絕不自動送出'),'obsolete_queue_only_text');
console.log(JSON.stringify({ok:true,gate:'G13.3A duplicate-selectable real OCR and AI execution',version:'v0.3.72',baseline_prompt_successor_compatible:true}));
