import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files={diagnostic:'assets/js/data1d1-ocr-ai-ab-diagnostic.js',hotfix:'assets/js/data1d1-ocr-region-direct-minimal-hotfix.js',shell:'assets/js/data1d1-ocr-region-single-item-ui.js',liveDebug:'assets/js/update-center-live-debug.js'};
for(const file of Object.values(files))assert.ok(fs.existsSync(file),`missing:${file}`);
for(const file of Object.values(files)){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`syntax:${file}:${result.stderr}`);}
const source=Object.fromEntries(Object.entries(files).map(([key,path])=>[key,fs.readFileSync(path,'utf8')]));
const requireTokens=(text,tokens,label)=>{for(const token of tokens)assert.ok(text.includes(token),`${label}_missing:${token}`);};
requireTokens(source.diagnostic,['OCR-only 單張覆核','loadSelectedOcrOnlyReview','ocr_only_review_started','ocr_only_review_completed','ocr_only_review_saved','單張圖片 AI 分析（獨立診斷）','standalone_single_image_ai_started','standalone_single_image_ai_completed','createSingleItemOcrRegionAiReviewPanel','accept="image/png,image/jpeg,image/webp,image/avif"'],'diagnostic');
assert.doesNotMatch(source.diagnostic,/buildAiConsentQueue|validateAiConsent|AI Provider.*OCR-only/,'ocr_only_must_not_build_ai_queue');
requireTokens(source.hotfix,["import './data1d1-ocr-ai-ab-diagnostic.js?v=20260803-g13-2n-ultra-minimal-ai-shell'","HOTFIX_VERSION='v0.3.71'","ultra_minimal_ai_hotfix_ready"],'hotfix');
requireTokens(source.shell,['ultra-minimal-ai-shell','ultra_minimal_ai_shell_completed','contains_image_bytes:false','contains_api_key:false','Promise.resolve(root)'],'shell');
assert.doesNotMatch(source.shell,/requestAnimationFrame|buildAiConsentQueue|validateAiConsent/,'legacy_ai_core_must_be_removed');
requireTokens(source.liveDebug,["const DISPLAY_ENTRIES=8","const RENDER_DELAY_MS=1500","if(type==='function')return '[function omitted]'","event==='identity_import_files_selected'?summarizeIdentityImport(detail):safe(detail)",'detail_text'],'live_debug');
assert.doesNotMatch(source.liveDebug,/takeOverSingleItemAdvancedReview|single_item_minimal_takeover_requested/,'legacy_takeover_listener_must_be_removed');
console.log(JSON.stringify({ok:true,gate:'G13.2M OCR vs ultra-minimal single-image AI diagnostics',version:'v0.3.71'}));
