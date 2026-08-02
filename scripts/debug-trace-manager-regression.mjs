import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const paths={
  trace:'assets/js/debug-trace-manager.js',
  bootstrap:'assets/js/bootstrap.js',
  picker:'assets/js/android-import-file-picker.js',
  wizard:'assets/js/identity-import-wizard-entry.js',
  inventory:'assets/js/data1-zip-inventory.js',
  review:'assets/js/data1-inventory-review.js',
  reviewUi:'assets/js/data1-inventory-review-ui.js',
  fingerprint:'assets/js/data1-image-fingerprint.js',
  classifier:'assets/js/data1d-ocr-first-classifier.js',
  runtime:'assets/js/data1d-local-ocr-runtime.js',
  runtimeUi:'assets/js/data1d1-ocr-runtime-ui.js',
  reviewPackage:'assets/js/data1d1-ocr-review-package.js',
  regionConsent:'assets/js/data1d1-ocr-region-ai-consent.js',
  regionUi:'assets/js/data1d1-ocr-region-ui.js',
  thumbnail:'assets/js/data1d1-ocr-thumbnail-region-confidence.js',
  aiSettings:'assets/js/ai-project-pool-settings.js',
  worker:'service-worker.js'
};

for(const path of Object.values(paths)){
  if(!fs.existsSync(path))throw new Error(`missing_required_file:${path}`);
  if(path.endsWith('.js')){
    const checked=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    if(checked.status!==0)throw new Error(`javascript_syntax_failed:${path}:${checked.stderr}`);
  }
}

const read=key=>fs.readFileSync(paths[key],'utf8');
const source=Object.fromEntries(Object.keys(paths).map(key=>[key,read(key)]));
const requireTokens=(text,tokens,label)=>{for(const token of tokens)if(!text.includes(token))throw new Error(`${label}_contract_missing:${token}`);};

requireTokens(source.trace,['class DebugTraceManager','window_error','unhandled_rejection','control_clicked','control_changed','service_worker','operation_id','parent_operation_id','completed','blocked','cancelled','failed','timeout','export()','exportIssueBundle','recordStage','recordProgress','business_stage','sanitize','[redacted]','MAX_STORAGE_BYTES','診斷中心','匯出診斷 JSON','匯出 Issue Bundle','目前紀錄模式：','標準模式：','明細模式：','localTime'],'trace');
requireTokens(source.picker,['IMAGE_ACCEPT','ZIP_ACCEPT','tech2dImageInput','tech2dZipInput','選擇圖片','選擇 ZIP','single_zip_per_batch_required','一次只能選擇一個 ZIP','import_source_inspection','file_selection_received','image_fingerprint_progress','ocr_classification_progress','ocr_first_classification_completed','AbortController','pokemon-sleep:ocr-cancel-requested','ocr_classification_cancelled','was_cancelled','buildPrivateZipInventory','enrichInventoryWithFingerprints','classifyInventoryWithOcr'],'picker');
requireTokens(source.inventory,['PRIVATE_ZIP_INVENTORY_SCHEMA','source_image_ref','review_required','validatePrivateZipInventory','downloadPrivateZipInventory'],'inventory');
requireTokens(source.review,['filterInventoryItems','bulkPatchInventoryReview','buildReviewPackage'],'review');
requireTokens(source.reviewUi,['createInventoryReviewWorkbench','duplicate_gate_decision_applied','fingerprint_manifest_exported','review_package_exported','待處理','重複圖片','寶可夢資訊'],'review_ui');
requireTokens(source.fingerprint,['sha256Hex','SHA-256','enrichInventoryWithFingerprints','within_archive','existing_index','existing_database_match','duplicate_group_id'],'fingerprint');
requireTokens(source.classifier,['PokemonSleepOCR','chi_tra+eng','classification_status','suggested_category','classification_confidence','classification_evidence','requires_review','ocr_first_ai_opt_in_only','ai_requests','signal','shouldCancel','cancelled','recognizeRegion','ocr_region_count','was_cancelled','region_mode'],'ocr_classifier');
requireTokens(source.runtime,['Tesseract','5.1.1','chi_tra','eng','ocr_runtime_loading','ocr_runtime_progress','ocr_runtime_ready','ocr_runtime_failed','recognize','offline_after_first_load','network_required_for_first_load','workerPromise'],'ocr_runtime');
requireTokens(source.runtimeUi,['ocr_runtime_loading','ocr_runtime_progress','ocr_runtime_ready','ocr_runtime_failed','pokemon-sleep:ocr-cancel-requested','ocr_preprocess_completed','ocr_cancel_requested','canvas','grayscale','threshold'],'ocr_ui');
requireTokens(source.reviewPackage,['OCR_REVIEW_SCHEMA','buildOcrReviewQueue','buildPrivateOcrReviewPackage','downloadPrivateOcrReviewPackage','ocr_review_package_exported','contains_image_bytes:false','contains_ocr_full_text:false'],'ocr_review_package');
requireTokens(source.regionConsent,['REGION_SCHEMA','AI_CONSENT_SCHEMA','OCR_REGION_PRESETS','full_image','pokemon_profile','recipe','normalizeRegion','buildRegionConfig','buildAiConsentQueue','validateAiConsent','explicit_consent_required','image_upload_acknowledgement_required','ai_review_consent_prepared','contains_image_bytes:false','contains_api_key:false'],'ocr_region_ai_consent');
requireTokens(source.regionUi,['createOcrRegionAiReviewPanel','ocrRegionPreset','ocr-region-preview','全選待覆核','清除選取','ocrAiConsent','ocrAiUploadAck','prepareAiReviewBtn','ai_review_queue_ready','gemini-3.6-flash'],'ocr_region_ui');
requireTokens(source.thumbnail,['OcrThumbnailUrlPool','URL.createObjectURL','URL.revokeObjectURL','maxActive','releaseAll','normalizeRegionConfidence','buildRegionConfidenceSummary','low_confidence','average_confidence','ocr_thumbnail_created','ocr_thumbnail_pool_released'],'ocr_thumbnail_confidence');
requireTokens(source.wizard,['humanizeImportError','tech2d-file-picker-actions','匯出私人清點 Manifest','停止 OCR','匯出私人 OCR Review Package','OCR 覆核佇列','ocrRegionAiReviewSlot','createOcrRegionAiReviewPanel','AI 覆核 Queue 已準備'],'wizard');
requireTokens(source.aiSettings,['sessionStorage','gemini-3.6-flash','models?key=','generateContent','ai_project_pool_tested','type="password"','，','；'],'ai_settings');

if(!/cacheMethod\s*:\s*['"]write['"]/.test(source.runtime))throw new Error('ocr_runtime_cache_contract_missing');
if(/fetch\s*\(|XMLHttpRequest|OpenAI|Gemini|Anthropic/i.test(source.classifier))throw new Error('ocr_classifier_must_not_call_external_ai');
if(/OpenAI|Gemini|Anthropic/i.test(source.runtime))throw new Error('ocr_runtime_must_not_call_external_ai');
if(/fetch\s*\(|XMLHttpRequest/.test(source.regionConsent)||/fetch\s*\(|XMLHttpRequest/.test(source.regionUi)||/fetch\s*\(|XMLHttpRequest/.test(source.thumbnail))throw new Error('ocr_local_modules_must_not_upload_directly');
if(/localStorage/.test(source.aiSettings)||/localStorage/.test(source.thumbnail))throw new Error('browser_secret_or_thumbnail_must_not_use_local_storage');
if(/console\.(log|info|warn|error)\s*\([^)]*key/i.test(source.aiSettings))throw new Error('ai_keys_must_not_be_logged');
if(/btoa\(|base64/i.test(source.fingerprint))throw new Error('fingerprint_must_not_persist_base64');
if(/(^|[,{]\s*)image_bytes\s*:|(^|[,{]\s*)image_base64\s*:|(^|[,{]\s*)ocr_full_text\s*:/m.test(source.reviewPackage))throw new Error('ocr_review_package_private_boundary_failed');
if(!source.bootstrap.startsWith("import {debugTrace} from './debug-trace-manager.js"))throw new Error('debug_trace_not_initialized_first');
if(!source.bootstrap.includes("APP_VERSION = 'v0.3.49'"))throw new Error('app_version_not_bumped');
if(!source.bootstrap.includes('20260802-data1d1-ocr-thumbnail-region-confidence'))throw new Error('build_not_bumped');

for(const token of ['data1d1-ocr-runtime-ui.js','data1d1-ocr-review-package.js','data1d1-ocr-region-ai-consent.js','data1d1-ocr-region-ui.js','data1d1-ocr-thumbnail-region-confidence.js','data1d-ocr-first-classifier.js','android-import-file-picker.js','identity-import-wizard-entry.js'])if(!source.bootstrap.includes(token))throw new Error(`module_not_probed:${token}`);
for(const token of ['./assets/js/data1d1-ocr-runtime-ui.js','./assets/js/data1d1-ocr-review-package.js','./assets/js/data1d1-ocr-region-ai-consent.js','./assets/js/data1d1-ocr-region-ui.js','./assets/js/data1d1-ocr-thumbnail-region-confidence.js','./assets/js/data1d-ocr-first-classifier.js','./assets/js/android-import-file-picker.js','./assets/js/identity-import-wizard-entry.js'])if(!source.worker.includes(token))throw new Error(`module_not_precached:${token}`);
if(!source.worker.includes('v0.3.49-data1d1-ocr-thumbnail-region-confidence'))throw new Error('service_worker_cache_not_bumped');
if(/\.content\b|\.payload\b/.test(source.trace.match(/function safeFile[\s\S]*?\n}/)?.[0]||''))throw new Error('file_content_must_not_be_exported');

console.log(JSON.stringify({ok:true,trace_schema:'pokemon-sleep-debug-trace/1.1',version:'v0.3.49',checks:178}));
