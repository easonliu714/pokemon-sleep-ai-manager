import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const unifiedRecipePath='assets/js/recipe-unified-player-workbench.js';
const sources={dedup:read('assets/js/identity-dedup.js'),quality:read('assets/js/identity-quality-guard.js'),evidence:read('assets/js/identity-evidence-builder.js'),recipeGuard:read('assets/js/recipe-render-guard.js'),shared:read('assets/js/shared-knowledge-ui.js'),master:read('assets/js/pokemon-master-options.js'),detail:read('assets/js/pokemon-detail.js'),bootstrap:read('assets/js/bootstrap.js'),sw:read('service-worker.js'),picker:read('assets/js/android-import-file-picker.js'),loader:read('assets/js/jszip-loader.js'),wizard:read('assets/js/identity-import-wizard-entry.js'),inventory:read('assets/js/data1-zip-inventory.js'),review:read('assets/js/data1-inventory-review.js'),reviewUi:read('assets/js/data1-inventory-review-ui.js'),fingerprint:read('assets/js/data1-image-fingerprint.js'),classifier:read('assets/js/data1d-ocr-first-classifier.js'),runtime:read('assets/js/data1d-local-ocr-runtime.js'),runtimeUi:read('assets/js/data1d1-ocr-runtime-ui.js'),reviewPackage:read('assets/js/data1d1-ocr-review-package.js'),regionConsent:read('assets/js/data1d1-ocr-region-ai-consent.js'),regionUi:read('assets/js/data1d1-ocr-region-ui.js'),thumbnail:read('assets/js/data1d1-ocr-thumbnail-region-confidence.js'),overlayBootstrap:read('assets/js/data1d1-ocr-overlay-update-center-bootstrap.js'),aiSettings:read('assets/js/ai-project-pool-settings.js')};
const matchTokens=(source,tokens,label)=>{for(const token of tokens)assert.match(source,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${label}:${token}`);};
for(const pattern of [/snapshot\(`identity-merge-v4:/,/begin\(\)/,/commit\(\)/,/rollback\(\)/,/status='archived'/,/SYSTEM-IDENTITY-MERGE-v0\.3\.30/])assert.match(sources.dedup,pattern);
for(const pattern of [/isProfileComplete/,/profileCompleteness\(item\)>=4/,/profileCompleteness\(item\)<=1/])assert.match(sources.quality,pattern);
for(const pattern of [/identity_review_required/,/registered_at/,/identity_fingerprint/])assert.doesNotMatch(sources.quality,pattern);
const qualityUrl=`data:text/javascript;base64,${Buffer.from(sources.quality).toString('base64')}`;
const {isWeakSkeleton,isProfileComplete,planSkeletonMerges,auditActivePokemon}=await import(qualityUrl);
const complete=(id,name,level,overrides={})=>({pokemon_id:id,original_label:name,species:name,level,specialty:'食材',type:'毒',identity_confidence:0,identity_review_required:0,registered_at:null,identity_fingerprint:null,sp:1183,main_skill:'活力填充S',main_skill_level:1,nature:'慢吞吞',helper_seconds:3290,carry_limit:31,core_role:'咖啡／可可核心',recommendation:'目標Lv.50食材機率S',...overrides});
const skeleton=(id,name,level,overrides={})=>({pokemon_id:id,original_label:name,species:name,level,specialty:'食材',type:'毒',identity_confidence:0.99,identity_review_required:0,registered_at:'legacy',identity_fingerprint:'legacy',sp:null,main_skill:null,main_skill_level:null,nature:null,helper_seconds:null,carry_limit:null,core_role:'咖啡／可可核心',recommendation:'目標Lv.50食材機率S',...overrides});
const quagsire=complete('pkm-quagsire','土王',31),staleQuagsire=skeleton('pkm-private-quagsire','土王',30);
assert.equal(isProfileComplete(quagsire),true);assert.equal(isWeakSkeleton(staleQuagsire),true);assert.equal(planSkeletonMerges([quagsire,staleQuagsire]).length,1);assert.equal(auditActivePokemon([quagsire,staleQuagsire]).ok,false);assert.equal(auditActivePokemon([quagsire]).ok,true);
assert.match(sources.evidence,/buildAbilitySignature/);assert.match(sources.recipeGuard,/MutationObserver/);assert.match(sources.recipeGuard,/renderSharedKnowledge\(true\)/);
if(fs.existsSync(unifiedRecipePath)){
  const unified=read(unifiedRecipePath),publicCatalog=read('assets/js/public-catalog-workbench.js');
  assert.match(sources.shared,/renderSharedKnowledge\(/,'shared knowledge renderer must remain available for encyclopedia rendering');
  assert.doesNotMatch(sources.shared,/personalRecipeAnalysisTable|referenceRecipeTable/,'v0.4.12 shared knowledge must not own duplicate recipe tables');
  assert.match(unified,/recipeWeeklyAuthoritySummary/);
  assert.match(unified,/lockedRecipeTable/);
  assert.match(publicCatalog,/renderRecipeUnifiedWorkbench\(\)/,'recipeTable authority must delegate to unified workbench');
  assert.equal((unified.match(/INSERT INTO recipes/g)||[]).length,1,'unified recipe player writer must remain single-owner');
}else{
  assert.match(sources.shared,/renderSharedKnowledge\(force=false\)/);
}
assert.match(sources.master,/BERRY_BY_TYPE/);assert.match(sources.detail,/pokemonTypeSelect/);
const appVersion=sources.bootstrap.match(/APP_VERSION = '(v\d+\.\d+\.\d+)'/)?.[1];
const cache=sources.sw.match(/const CACHE = '([^']+)'/)?.[1];
assert.ok(appVersion,'app_version_missing');assert.ok(cache?.startsWith(`pokemon-sleep-ai-${appVersion}-`),'service_worker_version_mismatch');
const modules=['data1-zip-inventory.js','data1-inventory-review.js','data1-inventory-review-ui.js','data1-image-fingerprint.js','data1d-local-ocr-runtime.js','data1d-ocr-first-classifier.js','data1d1-ocr-runtime-ui.js','data1d1-ocr-review-package.js','data1d1-ocr-region-ai-consent.js','data1d1-ocr-region-ui.js','data1d1-ocr-thumbnail-region-confidence.js','data1d1-ocr-overlay-update-center-bootstrap.js','ai-project-pool-settings.js','debug-trace-manager.js','identity-import-wizard-entry.js','pokemon-screenshot-grouping.js','pokemon-zip-manifest.js','identity-import-transaction.js','jszip-loader.js','android-import-file-picker.js'];
const pageAwareSuccessor=/pageModuleGroups=Object\.freeze\(/.test(sources.bootstrap)&&/global_deferred_sweep:false/.test(sources.bootstrap);
for(const moduleName of modules){
  // Before .55.3.2 bootstrap listed every deferred/transitive module explicitly.
  // The page-aware successor intentionally lists only entrypoints; transitive
  // modules remain required in the offline Service Worker asset authority.
  if(!pageAwareSuccessor)assert.match(sources.bootstrap,new RegExp(moduleName.replaceAll('.','\\.')));
  assert.match(sources.sw,new RegExp(moduleName.replaceAll('.','\\.')));
}
if(pageAwareSuccessor){
  for(const entry of ['identity-import-wizard-entry.js','data1d1-ocr-overlay-update-center-bootstrap.js'])assert.match(sources.bootstrap,new RegExp(entry.replaceAll('.','\\.')));
  assert.match(sources.bootstrap,/single_flight:true/);
  assert.match(sources.bootstrap,/yield_between_modules:true/);
}
matchTokens(sources.loader,['DEFAULT_JSZIP_URL','jszip_script_load_failed'],'loader');
matchTokens(sources.picker,['IMAGE_ACCEPT','ZIP_ACCEPT','tech2dImageInput','tech2dZipInput','mixed_zip_and_images_not_allowed','single_zip_per_batch_required','createAndroidImportFilePicker','AbortController','pokemon-sleep:ocr-cancel-requested','unified_import_source_inspection'],'picker');
matchTokens(sources.inventory,['source_image_ref','review_required','output_package_ref','validatePrivateZipInventory'],'inventory');matchTokens(sources.review,['filterInventoryItems','bulkPatchInventoryReview','buildReviewPackage'],'review');matchTokens(sources.reviewUi,['createInventoryReviewWorkbench','duplicate_gate_decision_applied','fingerprint_manifest_exported','review_package_exported'],'review_ui');matchTokens(sources.fingerprint,['sha256Hex','SHA-256','enrichInventoryWithFingerprints','duplicate_group_id'],'fingerprint');assert.doesNotMatch(sources.fingerprint,/btoa\(|base64/i);
matchTokens(sources.classifier,['PokemonSleepOCR','chi_tra+eng','classification_status','classification_confidence','requires_review','ocr_first_ai_opt_in_only','recognizeRegion','was_cancelled'],'classifier');assert.doesNotMatch(sources.classifier,/fetch\s*\(|XMLHttpRequest|OpenAI|Gemini|Anthropic/i);
matchTokens(sources.runtime,['Tesseract','5.1.1','chi_tra','eng','ocr_runtime_loading','ocr_runtime_progress','ocr_runtime_ready','ocr_runtime_failed','offline_after_first_load','workerPromise'],'runtime');assert.doesNotMatch(sources.runtime,/OpenAI|Gemini|Anthropic/i);
matchTokens(sources.runtimeUi,['ocr_runtime_loading','ocr_runtime_progress','ocr_runtime_ready','ocr_runtime_failed','pokemon-sleep:ocr-cancel-requested','ocr_preprocess_completed','canvas','grayscale','threshold'],'runtime_ui');
matchTokens(sources.reviewPackage,['OCR_REVIEW_SCHEMA','buildOcrReviewQueue','buildPrivateOcrReviewPackage','downloadPrivateOcrReviewPackage','contains_image_bytes:false','contains_ocr_full_text:false'],'review_package');assert.doesNotMatch(sources.reviewPackage,/(^|[,{]\s*)image_bytes\s*:|(^|[,{]\s*)image_base64\s*:|(^|[,{]\s*)ocr_full_text\s*:/m);
matchTokens(sources.regionConsent,['OCR_REGION_PRESETS','normalizeRegion','buildRegionConfig','buildAiConsentQueue','validateAiConsent','explicit_consent_required','contains_image_bytes:false','contains_api_key:false'],'region_consent');assert.doesNotMatch(sources.regionConsent,/fetch\s*\(|XMLHttpRequest/);
matchTokens(sources.regionUi,['createOcrRegionAiReviewPanel','ocrRegionPreset','ocr-region-preview','ocrAiConsent','ocrAiUploadAck','prepareAiReviewBtn'],'region_ui');assert.doesNotMatch(sources.regionUi,/fetch\s*\(|XMLHttpRequest/);
matchTokens(sources.thumbnail,['OcrThumbnailUrlPool','URL.createObjectURL','URL.revokeObjectURL','maxActive','releaseAll','normalizeRegionConfidence','buildRegionConfidenceSummary'],'thumbnail');assert.doesNotMatch(sources.thumbnail,/fetch\s*\(|XMLHttpRequest|localStorage/);
matchTokens(sources.overlayBootstrap,['waitForHost','OcrOverlayUpdateCenterBootstrapPromise','pagehide','dispose'],'overlay_bootstrap');assert.doesNotMatch(sources.overlayBootstrap,/fetch\s*\(|XMLHttpRequest|localStorage/);
matchTokens(sources.aiSettings,['sessionStorage','gemini-3.6-flash','models?key=','generateContent','type="password"'],'ai_settings');assert.doesNotMatch(sources.aiSettings,/localStorage/);
assert.match(sources.wizard,/emit\('identity-import-files-selected'/);
matchTokens(sources.wizard,['tech2dFilePickerSlot','匯出私人清點 Manifest','createInventoryReviewWorkbench','停止 OCR','匯出私人 OCR Review Package','OCR 覆核佇列','ocrRegionAiReviewSlot'],'wizard');
console.log(`PASS identity, recipe, OCR overlay, unified Android import, offline PWA, and privacy contracts on ${appVersion}`);
