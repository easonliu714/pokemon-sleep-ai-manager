import {debugTrace} from './debug-trace-manager.js?v=20260805-v0387-indexeddb-safe-boot-memory-guard';

const status=document.getElementById('dbStatus');
const warning=document.getElementById('storageWarning');
const APP_VERSION='v0.3.87';
const VERSION='20260805-v0387-indexeddb-safe-boot-memory-guard';

document.documentElement.dataset.appVersion=APP_VERSION;
document.documentElement.dataset.appBuild=VERSION;
globalThis.PokemonSleepRuntimeVersion=Object.freeze({app_version:APP_VERSION,app_build:VERSION});

debugTrace.record('bootstrap','bootstrap_started',{status:'started',details:{app_version:APP_VERSION,build:VERSION}});

function showVisibleVersion(){
  const header=document.querySelector('header');if(!header)return;
  let badge=document.getElementById('appVersion');
  if(!badge){badge=document.createElement('span');badge.id='appVersion';badge.className='badge';badge.style.marginInlineStart='8px';badge.style.whiteSpace='nowrap';const dbBadge=document.getElementById('dbStatus');if(dbBadge?.parentElement===header)dbBadge.insertAdjacentElement('afterend',badge);else header.appendChild(badge);}
  badge.textContent=`版本 ${APP_VERSION}`;
  badge.dataset.versionAuthority='bootstrap-v0387';
  badge.title=`Pokémon Sleep AI Manager ${APP_VERSION} / ${VERSION}`;
}
showVisibleVersion();

function emit(stage,message,statusValue='running',details={},error=null){
  if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent(new globalThis.CustomEvent('pokemon-sleep:startup-progress',{detail:{stage,message,status:statusValue,details,error:error?.message||error||null}}));
}
function showFailure(label,error){
  console.error(`Module probe failed: ${label}`,error);
  debugTrace.record('bootstrap','module_probe_failed',{status:'failed',details:{label},error});
  if(status){status.textContent='載入失敗';status.className='badge error';}
  if(warning){warning.textContent=`前端模組載入失敗：${label}：${error?.message||error}。請展開啟動進度並下載紀錄。`;warning.classList.remove('hidden');}
  emit('MODULE_LOAD_FAILED',`前端模組載入失敗：${label}`,'failed',{label},error);
}

const probes=[
  'runtime-version.js','storage.js','schema.js','seed-data.js','shared-master-schema.js','shared-master-data.js','public-empty-profile-master.js','canonical-registry.js','database.js','time-utils.js','pokemon-master-options.js','manual-editor.js','pokemon-detail.js','importer.js','ai-observation.js','ai-workflow.js','ai-key-vault.js','ai-project-pool-runtime.js','ai-project-pool-settings.js','ai-review-image-resolver.js','ai-review-queue-executor.js','ai-review-executor-controller.js','ai-review-executor-status-ui.js','prompt-catalog.js','g3-planning.js','identity-review.js','identity-convergence.js','identity-quality-guard.js','identity-dedup.js','identity-evidence-builder.js','ingredient-gap-engine.js','update-center-ui-guard.js','update-center-live-debug.js','shared-knowledge-ui.js','recipe-render-guard.js','identity-candidate-engine.js','sqlite-identity-candidate-adapter.js','identity-confirmation-model.js','identity-confirmation-ui.js','identity-confirmation-entry.js','identity-import-wizard.js','identity-import-pipeline.js','pokemon-screenshot-grouping.js','pokemon-zip-manifest.js','pokemon-zip-adapter.js','data1-zip-inventory.js','data1-image-fingerprint.js','data1d-local-ocr-runtime.js','ocr-runtime-monitor.js','data1d-ocr-first-classifier.js','data1d1-ocr-runtime-ui.js','data1d1-ocr-review-package.js','data1d1-ocr-region-ai-consent.js','data1d1-ocr-region-ui.js','data1d1-manual-reocr.js','data1d1-ocr-thumbnail-region-confidence.js','data1d1-ocr-thumbnail-overlay-wiring.js','data1d1-ocr-overlay-lifecycle-events.js','data1d1-ocr-overlay-controller-integration.js','data1d1-ocr-overlay-update-center-mount.js','data1d1-ocr-overlay-update-center-bridge.js','data1d1-ocr-overlay-update-center-bootstrap.js','data1d1-ocr-overlay-preview-event-wiring.js','data1-inventory-review.js','data1-inventory-review-ui.js','jszip-loader.js','android-import-file-picker.js','screenshot-observation-bridge.js','identity-import-apply-operation.js','identity-import-transaction.js','identity-import-wizard-entry.js','unified-import-analysis-workbench.js','backup-truth-restore.js','data-consistency-multicapture.js','public-catalog-workbench.js','v0382-image-byte-snapshot.js','v0382-release-authority.js','v0383-catalog-ocr-review-contract.js'
];

(async()=>{
  const operationId=debugTrace.begin('module_bootstrap',{probe_count:probes.length,app_version:APP_VERSION});
  emit('MODULE_PROBE_START',`正在載入 ${probes.length} 個網頁模組`);
  for(const file of probes){
    try{await import(`./${file}?v=${VERSION}`);debugTrace.record('bootstrap','module_probe_completed',{status:'completed',operation_id:operationId,details:{file}});}
    catch(error){showFailure(file,error);debugTrace.fail(operationId,error,{file});return;}
  }
  try{
    emit('APP_MODULE_LOADING','正在載入主要操作介面');
    await import(`./app.js?v=${VERSION}`);
    await import(`./shared-knowledge-ui.js?v=${VERSION}`);
    await import(`./identity-confirmation-entry.js?v=${VERSION}`);
    await import(`./identity-import-wizard-entry.js?v=${VERSION}`);
    await import(`./unified-import-analysis-workbench.js?v=${VERSION}`);
    await import(`./backup-truth-restore.js?v=${VERSION}`);
    await import(`./data-consistency-multicapture.js?v=${VERSION}`);
    await import(`./public-catalog-workbench.js?v=${VERSION}`);
    const {bootstrapOcrOverlayUpdateCenter}=await import(`./data1d1-ocr-overlay-update-center-bootstrap.js?v=${VERSION}`);
    const startOverlay=()=>{if(globalThis.OcrOverlayUpdateCenterBootstrap||!document.querySelector('#ocrThumbnailOverlaySlot'))return;bootstrapOcrOverlayUpdateCenter({timeoutMs:2000}).then(instance=>{globalThis.OcrOverlayUpdateCenterBootstrap=instance;}).catch(error=>debugTrace.record('ocr_thumbnail','ocr_thumbnail_overlay_bootstrap_deferred',{status:'blocked',details:{reason:error?.message||String(error)}}));};
    startOverlay();globalThis.addEventListener('pokemon-sleep:identity-import-files-selected',()=>setTimeout(startOverlay,0));
    showVisibleVersion();
    debugTrace.end(operationId,'completed',{entry_modules_loaded:true,version_authority:APP_VERSION,safe_boot_metadata:true,large_database_guard:true,rescue_mode:true,unified_import_pipeline:true,backup_truth_manifest:true,multicapture_merge:true,canonical_registry:true,public_zero_state_catalog:true});
    debugTrace.record('bootstrap','app_modules_ready',{status:'completed'});
    emit('APP_MODULES_READY','主要網頁模組已載入，等待資料庫狀態');
  }catch(error){showFailure('entry_modules',error);debugTrace.fail(operationId,error,{phase:'entry_modules'});}
})();
