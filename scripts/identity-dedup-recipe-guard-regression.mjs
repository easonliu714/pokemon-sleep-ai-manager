import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const dedup=read('assets/js/identity-dedup.js');
const quality=read('assets/js/identity-quality-guard.js');
const evidence=read('assets/js/identity-evidence-builder.js');
const recipeGuard=read('assets/js/recipe-render-guard.js');
const shared=read('assets/js/shared-knowledge-ui.js');
const master=read('assets/js/pokemon-master-options.js');
const detail=read('assets/js/pokemon-detail.js');
const bootstrap=read('assets/js/bootstrap.js');
const sw=read('service-worker.js');
const picker=read('assets/js/android-import-file-picker.js');
const loader=read('assets/js/jszip-loader.js');
const wizardEntry=read('assets/js/identity-import-wizard-entry.js');
const inventory=read('assets/js/data1-zip-inventory.js');
const review=read('assets/js/data1-inventory-review.js');
const reviewUi=read('assets/js/data1-inventory-review-ui.js');
const fingerprint=read('assets/js/data1-image-fingerprint.js');
const ocrClassifier=read('assets/js/data1d-ocr-first-classifier.js');
const ocrRuntime=read('assets/js/data1d-local-ocr-runtime.js');
const aiSettings=read('assets/js/ai-project-pool-settings.js');

for(const pattern of [/snapshot\(`identity-merge-v4:/,/begin\(\)/,/commit\(\)/,/rollback\(\)/,/status='archived'/,/SYSTEM-IDENTITY-MERGE-v0\.3\.30/])assert.match(dedup,pattern);
for(const pattern of [/isProfileComplete/,/profileCompleteness\(item\)>=4/,/profileCompleteness\(item\)<=1/])assert.match(quality,pattern);
for(const pattern of [/identity_review_required/,/registered_at/,/identity_fingerprint/])assert.doesNotMatch(quality,pattern);

const qualityUrl=`data:text/javascript;base64,${Buffer.from(quality).toString('base64')}`;
const {isWeakSkeleton,isProfileComplete,planSkeletonMerges,auditActivePokemon}=await import(qualityUrl);
const complete=(id,name,level,overrides={})=>({pokemon_id:id,original_label:name,species:name,level,specialty:'食材',type:'毒',identity_confidence:0,identity_review_required:0,registered_at:null,identity_fingerprint:null,sp:1183,main_skill:'活力填充S',main_skill_level:1,nature:'慢吞吞',helper_seconds:3290,carry_limit:31,core_role:'咖啡／可可核心',recommendation:'目標Lv.50食材機率S',...overrides});
const skeleton=(id,name,level,overrides={})=>({pokemon_id:id,original_label:name,species:name,level,specialty:'食材',type:'毒',identity_confidence:0.99,identity_review_required:0,registered_at:'legacy',identity_fingerprint:'legacy',sp:null,main_skill:null,main_skill_level:null,nature:null,helper_seconds:null,carry_limit:null,core_role:'咖啡／可可核心',recommendation:'目標Lv.50食材機率S',...overrides});
const quagsire=complete('pkm-quagsire','土王',31);
const staleQuagsire=skeleton('pkm-private-quagsire','土王',30);
assert.equal(isProfileComplete(quagsire),true);
assert.equal(isWeakSkeleton(staleQuagsire),true);
assert.equal(planSkeletonMerges([quagsire,staleQuagsire]).length,1);
assert.equal(auditActivePokemon([quagsire,staleQuagsire]).ok,false);
assert.equal(auditActivePokemon([quagsire]).ok,true);

assert.match(evidence,/buildAbilitySignature/);
assert.match(recipeGuard,/MutationObserver/);
assert.match(recipeGuard,/renderSharedKnowledge\(true\)/);
assert.match(shared,/renderSharedKnowledge\(force=false\)/);
assert.match(master,/BERRY_BY_TYPE/);
assert.match(detail,/pokemonTypeSelect/);

assert.match(bootstrap,/APP_VERSION = 'v0\.3\.44'/);
assert.match(bootstrap,/20260802-data1d-ocr-ui-ai-settings/);
for(const token of ['data1-zip-inventory.js','data1-inventory-review.js','data1-inventory-review-ui.js','data1-image-fingerprint.js','data1d-local-ocr-runtime.js','data1d-ocr-first-classifier.js','ai-project-pool-settings.js','debug-trace-manager.js','identity-import-wizard-entry.js','pokemon-screenshot-grouping.js','pokemon-zip-manifest.js','identity-import-transaction.js','jszip-loader.js','android-import-file-picker.js'])assert.match(bootstrap,new RegExp(token.replace('.','\\.')));

assert.match(sw,/pokemon-sleep-ai-v0\.3\.44-data1d-ocr-ui-ai-settings/);
for(const token of ['data1-zip-inventory.js','data1-inventory-review.js','data1-inventory-review-ui.js','data1-image-fingerprint.js','data1d-local-ocr-runtime.js','data1d-ocr-first-classifier.js','ai-project-pool-settings.js','debug-trace-manager.js','identity-import-pipeline.js','pokemon-screenshot-grouping.js','pokemon-zip-manifest.js','identity-import-transaction.js','identity-import-wizard-entry.js','android-import-file-picker.js'])assert.match(sw,new RegExp(token.replace('.','\\.')));
assert.match(sw,/jszip@3\.10\.1\/dist\/jszip\.min\.js/);
assert.match(sw,/tesseract\.js@5\.1\.1\/dist\/tesseract\.min\.js/);

assert.match(loader,/DEFAULT_JSZIP_URL/);
assert.match(loader,/data-tech2d-dependency|tech2dDependency/);
assert.match(loader,/jszip_script_load_failed/);
for(const token of ['IMAGE_ACCEPT','ZIP_ACCEPT','tech2dImageInput','tech2dZipInput','multiple:true','multiple:false','mixed_zip_and_images_not_allowed','single_zip_per_batch_required','createAndroidImportFilePicker','humanizeImportError','import_source_inspection','buildPrivateZipInventory','enrichInventoryWithFingerprints','classifyInventoryWithOcr','ocr_classification_progress','ocr_first_classification_completed'])assert.match(picker,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));

for(const token of ['source_image_ref','review_required','output_package_ref','validatePrivateZipInventory'])assert.match(inventory,new RegExp(token));
for(const token of ['filterInventoryItems','bulkPatchInventoryReview','buildReviewPackage'])assert.match(review,new RegExp(token));
for(const token of ['createInventoryReviewWorkbench','duplicate_gate_decision_applied','fingerprint_manifest_exported','review_package_exported','待處理','重複圖片','寶可夢資訊'])assert.match(reviewUi,new RegExp(token));
for(const token of ['sha256Hex','SHA-256','enrichInventoryWithFingerprints','within_archive','existing_index','existing_database_match','duplicate_group_id'])assert.match(fingerprint,new RegExp(token));
assert.doesNotMatch(fingerprint,/btoa\(|base64/i);
for(const token of ['PokemonSleepOCR','chi_tra+eng','classification_status','suggested_category','classification_confidence','classification_evidence','requires_review','ocr_first_ai_opt_in_only','ai_requests'])assert.match(ocrClassifier,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(ocrClassifier,/fetch\s*\(|XMLHttpRequest|OpenAI|Gemini|Anthropic/i);
for(const pattern of [/Tesseract/,/5\.1\.1/,/chi_tra/,/eng/,/ocr_runtime_loading/,/ocr_runtime_progress/,/ocr_runtime_ready/,/ocr_runtime_failed/,/cacheMethod\s*:\s*['"]write['"]/,/offline_after_first_load/,/network_required_for_first_load/,/workerPromise/,/recognize/])assert.match(ocrRuntime,pattern);
assert.doesNotMatch(ocrRuntime,/OpenAI|Gemini|Anthropic/i);
for(const pattern of [/sessionStorage/,/gemini-3\.6-flash/,/models\?key=/,/generateContent/,/ai_project_pool_tested/,/type="password"/,/，/,/；/])assert.match(aiSettings,pattern);
assert.doesNotMatch(aiSettings,/localStorage/);
assert.doesNotMatch(aiSettings,/console\.(log|info|warn|error)\s*\([^)]*key/i);

for(const token of ['pokemon-sleep:identity-import-files-selected','tech2dFilePickerSlot','tech2d-file-picker-actions','匯出私人清點 Manifest','createInventoryReviewWorkbench','min-height:44px'])assert.match(wizardEntry,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));

console.log('PASS identity guard, DATA.1D local OCR runtime, browser-local AI settings, Android split picker, offline PWA, and Debug Trace contracts');
