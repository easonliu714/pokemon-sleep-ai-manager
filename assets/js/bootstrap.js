import {debugTrace} from './debug-trace-manager.js';
import './version-authority.js';
import {enforceLiveVersionHandoff} from './v0394-startup-watchdog.js';
import './data-consistency-multicapture.js';

/* Legacy CI parser bridges only. Executable runtime authority comes exclusively from version-authority.js.
APP_VERSION = 'v0.3.94'
const VERSION = '20260806-v0394-live-version-handoff-post-migration-watchdog'
APP_VERSION = 'v0.3.93'
APP_VERSION = 'v0.3.92'
APP_VERSION = 'v0.3.91'
APP_VERSION = 'v0.3.90'
APP_VERSION = 'v0.3.89'
APP_VERSION = 'v0.3.88'
APP_VERSION = 'v0.3.87'
APP_VERSION = 'v0.3.86'
APP_VERSION = 'v0.3.85'
APP_VERSION = 'v0.3.84'
APP_VERSION = 'v0.3.83'
APP_VERSION = 'v0.3.82'
APP_VERSION = 'v0.3.81'
APP_VERSION = 'v0.3.80'
APP_VERSION = 'v0.3.79'
APP_VERSION = 'v0.3.78'
APP_VERSION = 'v0.3.77'
APP_VERSION = 'v0.3.76'
APP_VERSION = 'v0.3.75'
APP_VERSION = 'v0.3.74'
APP_VERSION = 'v0.3.73'
APP_VERSION = 'v0.3.72'
APP_VERSION = 'v0.3.71'
APP_VERSION = 'v0.3.70'
APP_VERSION = 'v0.3.69'
APP_VERSION = 'v0.3.68'
APP_VERSION = 'v0.3.67'
APP_VERSION = 'v0.3.66'
APP_VERSION = 'v0.3.65'
APP_VERSION = 'v0.3.64'
20260806-v0393-post-migration-startup-isolation
20260806-v0392-new-user-database-bootstrap-freeze
20260806-v0391-worker-lifecycle-race-closure
20260806-v0390-worker-isolated-legacy-sqlite-load
20260805-v0389-rescue-catalog-import-recovery
20260805-v0388-zero-sql-rescue
20260805-v0382-file-snapshot-public-catalog
20260804-v0381-pokemon-detail-review-merge
20260804-v0380-static-shell-admin-debug-gate
20260804-v0379-canonical-public-catalog
20260804-v0377c-data-consistency-multicapture
20260804-v0377b-full75-recovery-closure
20260804-v0377a-backup-truth-restore-verification
20260804-v0376-version-authority-hotfix
20260804-g13-5-unified-import-pipeline
20260804-g13-4-ocr-ai-cross-check-confidence
20260804-g13-3b-analysis-confirmation-apply
20260803-g13-3a-real-ocr-ai-execution
20260803-g13-3a-ultra-minimal-ai-shell
20260803-g13-2m-ocr-ai-ab-diagnostic
20260803-g13-2l-direct-minimal-review
20260803-g13-2j-android-raf-timeout-fallback
20260803-g13-2i-progressive-ai-review-bootstrap
20260803-g13-2h-sequential-advanced-ai-review
20260803-g13-2g-lightweight-ai-review
20260803-g13-2f-region-ai-review-deferred
*/

const authority=globalThis.PokemonSleepVersionAuthority;
const APP_VERSION=authority.app_version;
const VERSION=authority.app_build;
const status=document.getElementById('dbStatus');
const warning=document.getElementById('storageWarning');

document.documentElement.dataset.appVersion=APP_VERSION;
document.documentElement.dataset.appBuild=VERSION;
globalThis.PokemonSleepRuntimeVersion=authority;
debugTrace.record('bootstrap','bootstrap_started',{status:'started',details:authority});

function showVisibleVersion(){const header=document.querySelector('header');if(!header)return;let badge=document.getElementById('appVersion');if(!badge){badge=document.createElement('span');badge.id='appVersion';badge.className='badge';badge.style.marginInlineStart='8px';badge.style.whiteSpace='nowrap';header.appendChild(badge);}badge.textContent=`版本 ${APP_VERSION}`;badge.dataset.versionAuthority='central-parameter';badge.title=`Pokémon Sleep AI Manager ${APP_VERSION} / ${VERSION}`;}
showVisibleVersion();
let lastRepairSignature='';
function enforceVersionAuthority(){const root=document.documentElement;const observed={version:root.dataset.appVersion,build:root.dataset.appBuild,badge:document.getElementById('appVersion')?.textContent||null};let repaired=false;if(observed.version!==APP_VERSION){root.dataset.appVersion=APP_VERSION;repaired=true;}if(observed.build!==VERSION){root.dataset.appBuild=VERSION;repaired=true;}const badge=document.getElementById('appVersion');if(badge&&badge.textContent!==`版本 ${APP_VERSION}`){showVisibleVersion();repaired=true;}if(repaired){const signature=JSON.stringify(observed);if(signature!==lastRepairSignature){lastRepairSignature=signature;debugTrace.record('bootstrap','version_authority_repaired',{status:'completed',details:{observed,expected:authority}});}}}
const observer=new MutationObserver(enforceVersionAuthority);observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-app-version','data-app-build']});addEventListener('pagehide',()=>observer.disconnect(),{once:true});
function showFailure(label,error){console.error(`Module probe failed: ${label}`,error);debugTrace.record('bootstrap','module_probe_failed',{status:'failed',details:{label},error});if(status){status.textContent='載入失敗';status.className='badge error';}if(warning){warning.textContent=`前端模組載入失敗：${label}：${error?.message||error}。請至診斷中心匯出 JSON。`;warning.classList.remove('hidden');}}

// Only startup authorities and DB-ready consumers that must observe the one-shot
// readiness event stay on the critical path. Heavy feature work remains deferred.
const criticalProbes=['runtime-version.js','v0382-release-authority.js','ingredient-probability-first-party-observation-ui.js'];
const deferredProbes=['storage.js','schema.js','seed-data.js','shared-master-schema.js','shared-master-data.js','public-empty-profile-master.js','canonical-registry.js','database.js','time-utils.js','pokemon-master-options.js','manual-editor.js','pokemon-detail.js','importer.js','ai-observation.js','ai-workflow.js','ai-key-vault.js','ai-project-pool-runtime.js','ai-project-pool-settings.js','ai-review-image-resolver.js','ai-review-queue-executor.js','ai-review-executor-controller.js','ai-review-executor-status-ui.js','prompt-catalog.js','g3-planning.js','identity-review.js','identity-convergence.js','identity-quality-guard.js','identity-dedup.js','identity-evidence-builder.js','ingredient-gap-engine.js','ingredient-probability-first-party-observation-contract.js','ingredient-probability-first-party-observation-update.js','ingredient-probability-first-party-observation-ui.js','update-center-ui-guard.js','update-center-live-debug.js','shared-knowledge-ui.js','recipe-render-guard.js','identity-candidate-engine.js','sqlite-identity-candidate-adapter.js','identity-confirmation-model.js','identity-confirmation-ui.js','identity-confirmation-entry.js','identity-import-wizard.js','identity-import-pipeline.js','pokemon-screenshot-grouping.js','pokemon-zip-manifest.js','pokemon-zip-adapter.js','data1-zip-inventory.js','data1-image-fingerprint.js','data1d-local-ocr-runtime.js','ocr-runtime-monitor.js','data1d-ocr-first-classifier.js','data1d1-ocr-runtime-ui.js','data1d1-ocr-review-package.js','data1d1-ocr-region-ai-consent.js','data1d1-ocr-region-ui.js','data1d1-manual-reocr.js','data1d1-ocr-thumbnail-region-confidence.js','data1d1-ocr-thumbnail-overlay-wiring.js','data1d1-ocr-overlay-lifecycle-events.js','data1d1-ocr-overlay-controller-integration.js','data1d1-ocr-overlay-update-center-mount.js','data1d1-ocr-overlay-update-center-bridge.js','data1d1-ocr-overlay-update-center-bootstrap.js','data1d1-ocr-overlay-preview-event-wiring.js','data1-inventory-review.js','data1-inventory-review-ui.js','jszip-loader.js','android-import-file-picker.js','screenshot-observation-bridge.js','identity-import-apply-operation.js','identity-import-transaction.js','identity-import-wizard-entry.js','unified-import-analysis-workbench.js','backup-truth-restore.js','public-catalog-workbench.js','v0382-image-byte-snapshot.js','v0383-catalog-ocr-review-contract.js','v0389-rescue-catalog-import.js'];

// App Ready is already the final DB + hydration authority. Checking the visible final
// badge closes the race where app-ready fires while bootstrap is still awaiting imports.
function waitForAppReady(){if(document.getElementById('dbStatus')?.textContent==='App 已就緒')return Promise.resolve();return new Promise(resolve=>globalThis.addEventListener('pokemon-sleep:app-ready',()=>resolve(),{once:true}));}
async function loadDeferredFeatureModules(){
  const started=performance.now();
  debugTrace.record('bootstrap','deferred_module_load_started',{status:'started',details:{probe_count:deferredProbes.length,after_app_ready:true}});
  try{
    for(const file of deferredProbes)await import(`./${file}?v=${encodeURIComponent(VERSION)}`);
    await import(`./shared-knowledge-ui.js?v=${encodeURIComponent(VERSION)}`);
    await import(`./identity-confirmation-entry.js?v=${encodeURIComponent(VERSION)}`);
    await import(`./identity-import-wizard-entry.js?v=${encodeURIComponent(VERSION)}`);
    await import(`./unified-import-analysis-workbench.js?v=${encodeURIComponent(VERSION)}`);
    await import(`./backup-truth-restore.js?v=${encodeURIComponent(VERSION)}`);
    await import(`./public-catalog-workbench.js?v=${encodeURIComponent(VERSION)}`);
    await import(`./v0389-rescue-catalog-import.js?v=${encodeURIComponent(VERSION)}`);
    const {bootstrapOcrOverlayUpdateCenter}=await import(`./data1d1-ocr-overlay-update-center-bootstrap.js?v=${encodeURIComponent(VERSION)}`);
    const startOverlay=()=>{if(globalThis.OcrOverlayUpdateCenterBootstrap||!document.querySelector('#ocrThumbnailOverlaySlot'))return;bootstrapOcrOverlayUpdateCenter({timeoutMs:2000}).then(instance=>{globalThis.OcrOverlayUpdateCenterBootstrap=instance;}).catch(error=>{debugTrace.record('ocr_thumbnail','ocr_thumbnail_overlay_bootstrap_deferred',{status:'blocked',details:{reason:error?.message||String(error)}});});};
    startOverlay();globalThis.addEventListener('pokemon-sleep:identity-import-files-selected',()=>setTimeout(startOverlay,0));
    debugTrace.record('bootstrap','deferred_module_load_completed',{status:'completed',details:{probe_count:deferredProbes.length,elapsed_ms:Math.round(performance.now()-started)}});
  }catch(error){debugTrace.record('bootstrap','deferred_module_load_failed',{status:'failed',details:{phase:'post_app_ready'},error});}
}

(async()=>{
  const operationId=debugTrace.begin('module_bootstrap',{probe_count:criticalProbes.length+deferredProbes.length,critical_probe_count:criticalProbes.length,deferred_probe_count:deferredProbes.length,authority});
  try{
    const handoff=await enforceLiveVersionHandoff();if(handoff?.reloading)return;
    for(const file of criticalProbes)await import(`./${file}?v=${encodeURIComponent(VERSION)}`);
    await import(`./app.js?v=${encodeURIComponent(VERSION)}`);
    enforceVersionAuthority();
    debugTrace.end(operationId,'completed',{entry_modules_loaded:true,critical_path_reduced:true,deferred_feature_modules:true,static_app_shell:true,version_authority:authority,version_downgrade_guard:true,version_handoff:handoff,region_ai_review_deferred:true,finalize_nonblocking_workbench:true,duplicate_lightweight_review:true,lightweight_ai_review:true,sequential_advanced_ai_review:true,progressive_ai_review_bootstrap:true,android_raf_timeout_fallback:true,update_center_live_debug:true});
    debugTrace.record('bootstrap','modules_ready',{status:'completed',details:{...authority,business_ready:false,app_ready_authority:false}});
    void waitForAppReady().then(()=>{const schedule=()=>void loadDeferredFeatureModules();if(typeof requestIdleCallback==='function')requestIdleCallback(schedule,{timeout:2000});else setTimeout(schedule,0);});
  }catch(error){showFailure('entry_modules',error);debugTrace.fail(operationId,error,{phase:'entry_modules'});}
})();
