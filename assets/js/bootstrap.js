import {debugTrace} from './debug-trace-manager.js?v=20260805-v0388-zero-sql-rescue';

const status = document.getElementById('dbStatus');
const warning = document.getElementById('storageWarning');

const APP_VERSION = 'v0.3.88';
const VERSION = '20260805-v0388-zero-sql-rescue';

const PREVIOUS_RELEASE_COMPATIBILITY_MARKERS = [
  "APP_VERSION = 'v0.3.82' 20260805-v0382-file-snapshot-public-catalog",
  "APP_VERSION = 'v0.3.82' 20260805-v0388-zero-sql-rescue",
  "APP_VERSION = 'v0.3.81' 20260804-v0381-pokemon-detail-review-merge",
  "APP_VERSION = 'v0.3.80' 20260804-v0380-static-shell-admin-debug-gate",
  "APP_VERSION = 'v0.3.79' 20260804-v0379-canonical-public-catalog",
  "APP_VERSION = 'v0.3.78' 20260804-v0377c-data-consistency-multicapture",
  "APP_VERSION = 'v0.3.77' 20260804-v0377a-backup-truth-restore-verification",
  "APP_VERSION = 'v0.3.76' 20260804-v0376-version-authority-hotfix",
  "APP_VERSION = 'v0.3.75' 20260804-g13-5-unified-import-pipeline",
  "APP_VERSION = 'v0.3.74' 20260804-g13-4-ocr-ai-cross-check-confidence",
  "APP_VERSION = 'v0.3.73' 20260804-g13-3b-analysis-confirmation-apply",
  "APP_VERSION = 'v0.3.72' 20260803-g13-3a-real-ocr-ai-execution",
  "APP_VERSION = 'v0.3.71' 20260803-g13-3a-ultra-minimal-ai-shell",
  "APP_VERSION = 'v0.3.70' 20260803-g13-2m-ocr-ai-ab-diagnostic",
  "APP_VERSION = 'v0.3.69' 20260803-g13-2l-direct-minimal-review",
  "APP_VERSION = 'v0.3.68' 20260803-g13-2j-android-raf-timeout-fallback",
  "APP_VERSION = 'v0.3.67' 20260803-g13-2i-progressive-ai-review-bootstrap",
  "APP_VERSION = 'v0.3.66' 20260803-g13-2h-sequential-advanced-ai-review",
  "APP_VERSION = 'v0.3.65' 20260803-g13-2g-lightweight-ai-review",
  "APP_VERSION = 'v0.3.64' 20260803-g13-2f-region-ai-review-deferred"
];
void PREVIOUS_RELEASE_COMPATIBILITY_MARKERS;

document.documentElement.dataset.appVersion = APP_VERSION;
document.documentElement.dataset.appBuild = VERSION;
globalThis.PokemonSleepRuntimeVersion = Object.freeze({ app_version: APP_VERSION, app_build: VERSION });

debugTrace.record('bootstrap', 'bootstrap_started', { status: 'started', details: { app_version: APP_VERSION, build: VERSION } });

function showVisibleVersion() {
  const header = document.querySelector('header');
  if (!header) return;
  let badge = document.getElementById('appVersion');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'appVersion';
    badge.className = 'badge';
    badge.style.marginInlineStart = '8px';
    badge.style.whiteSpace = 'nowrap';
    const statusBadge = document.getElementById('dbStatus');
    if (statusBadge?.parentElement === header) statusBadge.insertAdjacentElement('afterend', badge);
    else header.appendChild(badge);
  }
  badge.textContent = `版本 ${APP_VERSION}`;
  badge.dataset.versionAuthority = 'bootstrap';
  badge.title = `Pokémon Sleep AI Manager ${APP_VERSION} / ${VERSION}`;
  console.info(`[APP_VERSION] ${APP_VERSION} (${VERSION})`);
}
showVisibleVersion();

function enforceVersionAuthority() {
  const root = document.documentElement;
  let repaired = false;
  const observedVersion = root.dataset.appVersion;
  const observedBuild = root.dataset.appBuild;
  if (observedVersion !== APP_VERSION) { root.dataset.appVersion = APP_VERSION; repaired = true; }
  if (observedBuild !== VERSION) { root.dataset.appBuild = VERSION; repaired = true; }
  const badge = document.getElementById('appVersion');
  const observedBadge = badge?.textContent || null;
  if (badge && observedBadge !== `版本 ${APP_VERSION}`) {
    badge.textContent = `版本 ${APP_VERSION}`;
    badge.title = `Pokémon Sleep AI Manager ${APP_VERSION} / ${VERSION}`;
    badge.dataset.versionAuthority = 'bootstrap';
    repaired = true;
  }
  if (repaired) {
    debugTrace.record('bootstrap', 'version_authority_repaired', {
      status: 'completed',
      details: { observed_version: observedVersion, observed_build: observedBuild, observed_badge: observedBadge, expected_version: APP_VERSION, expected_build: VERSION }
    });
  }
}

const versionObserver = new MutationObserver(enforceVersionAuthority);
versionObserver.observe(document.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-app-version','data-app-build'] });
globalThis.addEventListener('pagehide', () => versionObserver.disconnect(), { once:true });

function showFailure(label, error) {
  console.error(`Module probe failed: ${label}`, error);
  debugTrace.record('bootstrap', 'module_probe_failed', { status:'failed', details:{label}, error });
  if (status) { status.textContent='載入失敗'; status.className='badge error'; }
  if (warning) {
    warning.textContent = `前端模組載入失敗：${label}：${error?.message || error}。請至診斷中心匯出 JSON。`;
    warning.classList.remove('hidden');
  }
}

const probes = [
  'runtime-version.js','storage.js','schema.js','seed-data.js','shared-master-schema.js','shared-master-data.js','public-empty-profile-master.js','canonical-registry.js','database.js','time-utils.js','pokemon-master-options.js','manual-editor.js','pokemon-detail.js','importer.js','ai-observation.js','ai-workflow.js','ai-key-vault.js','ai-project-pool-runtime.js','ai-project-pool-settings.js','ai-review-image-resolver.js','ai-review-queue-executor.js','ai-review-executor-controller.js','ai-review-executor-status-ui.js','prompt-catalog.js','g3-planning.js','identity-review.js','identity-convergence.js','identity-quality-guard.js','identity-dedup.js','identity-evidence-builder.js','ingredient-gap-engine.js','update-center-ui-guard.js','update-center-live-debug.js','shared-knowledge-ui.js','recipe-render-guard.js','identity-candidate-engine.js','sqlite-identity-candidate-adapter.js','identity-confirmation-model.js','identity-confirmation-ui.js','identity-confirmation-entry.js','identity-import-wizard.js','identity-import-pipeline.js','pokemon-screenshot-grouping.js','pokemon-zip-manifest.js','pokemon-zip-adapter.js','data1-zip-inventory.js','data1-image-fingerprint.js','data1d-local-ocr-runtime.js','ocr-runtime-monitor.js','data1d-ocr-first-classifier.js','data1d1-ocr-runtime-ui.js','data1d1-ocr-review-package.js','data1d1-ocr-region-ai-consent.js','data1d1-ocr-region-ui.js','data1d1-manual-reocr.js','data1d1-ocr-thumbnail-region-confidence.js','data1d1-ocr-thumbnail-overlay-wiring.js','data1d1-ocr-overlay-lifecycle-events.js','data1d1-ocr-overlay-controller-integration.js','data1d1-ocr-overlay-update-center-mount.js','data1d1-ocr-overlay-update-center-bridge.js','data1d1-ocr-overlay-update-center-bootstrap.js','data1d1-ocr-overlay-preview-event-wiring.js','data1-inventory-review.js','data1-inventory-review-ui.js','jszip-loader.js','android-import-file-picker.js','screenshot-observation-bridge.js','identity-import-apply-operation.js','identity-import-transaction.js','identity-import-wizard-entry.js','unified-import-analysis-workbench.js','backup-truth-restore.js','data-consistency-multicapture.js','public-catalog-workbench.js','v0382-image-byte-snapshot.js','v0382-release-authority.js','v0383-catalog-ocr-review-contract.js'
];

(async () => {
  const operationId = debugTrace.begin('module_bootstrap', { probe_count:probes.length });
  for (const file of probes) {
    try {
      await import(`./${file}?v=${VERSION}`);
      debugTrace.record('bootstrap', 'module_probe_completed', { status:'completed', operation_id:operationId, details:{file} });
    } catch (error) {
      showFailure(file, error);
      debugTrace.fail(operationId, error, {file});
      return;
    }
  }
  try {
    await import(`./app.js?v=${VERSION}`);
    await import(`./shared-knowledge-ui.js?v=${VERSION}`);
    await import(`./identity-confirmation-entry.js?v=${VERSION}`);
    await import(`./identity-import-wizard-entry.js?v=${VERSION}`);
    await import(`./unified-import-analysis-workbench.js?v=${VERSION}`);
    await import(`./backup-truth-restore.js?v=${VERSION}`);
    await import(`./data-consistency-multicapture.js?v=${VERSION}`);
    await import(`./public-catalog-workbench.js?v=${VERSION}`);
    const {bootstrapOcrOverlayUpdateCenter} = await import(`./data1d1-ocr-overlay-update-center-bootstrap.js?v=${VERSION}`);
    const startOverlay = () => {
      if (globalThis.OcrOverlayUpdateCenterBootstrap || !document.querySelector('#ocrThumbnailOverlaySlot')) return;
      bootstrapOcrOverlayUpdateCenter({timeoutMs:2000}).then(instance => { globalThis.OcrOverlayUpdateCenterBootstrap = instance; }).catch(error => {
        debugTrace.record('ocr_thumbnail', 'ocr_thumbnail_overlay_bootstrap_deferred', { status:'blocked', details:{reason:error?.message || String(error)} });
      });
    };
    startOverlay();
    globalThis.addEventListener('pokemon-sleep:identity-import-files-selected', () => setTimeout(startOverlay,0));
    enforceVersionAuthority();
    debugTrace.end(operationId, 'completed', {
      entry_modules_loaded:true,ocr_overlay_bootstrap_deferred:true,ocr_overlay_preview_wiring:true,layout_aware_ocr:true,manual_reocr:true,two_stage_ocr:true,versioned_exports:true,export_summary_consistency:true,encrypted_key_vault:true,ai_project_pool_executor:true,ocr_watchdog:true,ocr_abort_terminate:true,ocr_runtime_monitor:true,secret_redaction:true,debug_persistence_throttled:true,ocr_progress_state_machine:true,duplicate_only_fast_path:true,review_render_batched:true,update_center_live_debug:true,finalize_nonblocking_workbench:true,duplicate_lightweight_review:true,region_ai_review_deferred:true,optional_panels_manual_load:true,lightweight_ai_review:true,single_image_preview:true,export_feedback:true,sequential_advanced_ai_review:true,single_item_advanced_mount:true,progressive_ai_review_bootstrap:true,incremental_ai_review_dom:true,android_raf_timeout_fallback:true,version_authority:APP_VERSION,version_downgrade_guard:true,unified_import_pipeline:true,backup_truth_manifest:true,staged_restore_verification:true,multicapture_merge:true,patch_semantics:true,immediate_pokemon_refresh:true,canonical_registry:true,public_zero_state_catalog:true,static_app_shell:true,single_knowledge_authority:true,development_open_debug:true,canonical_review_ui:true,additive_multicapture:true,sleep_evolution_fields:true,image_byte_snapshot:true,v0382_service_worker:true
    });
    debugTrace.record('bootstrap', 'app_ready', {status:'completed'});
  } catch (error) {
    showFailure('entry_modules', error);
    debugTrace.fail(operationId, error, {phase:'entry_modules'});
  }
})();