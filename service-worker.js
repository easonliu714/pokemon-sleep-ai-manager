const APP_VERSION = 'v0.3.88';
const APP_BUILD = '20260805-v0388-zero-sql-rescue';
const CACHE = 'pokemon-sleep-ai-v0.3.88-v0388-zero-sql-rescue';

const PREVIOUS_CACHE_COMPATIBILITY_MARKERS = [
  'pokemon-sleep-ai-v0.3.82-v0382-file-snapshot-public-catalog',
  'pokemon-sleep-ai-v0.3.81-v0381-pokemon-detail-review-merge',
  'pokemon-sleep-ai-v0.3.80-v0380-static-shell-admin-debug-gate',
  'pokemon-sleep-ai-v0.3.79-v0379-canonical-public-catalog',
  'pokemon-sleep-ai-v0.3.78-v0377c-data-consistency-multicapture',
  'pokemon-sleep-ai-v0.3.77-v0377a-backup-truth-restore-verification',
  'pokemon-sleep-ai-v0.3.76-v0376-version-authority-hotfix',
  'pokemon-sleep-ai-v0.3.75-g13-5-unified-import-pipeline',
  'pokemon-sleep-ai-v0.3.74-g13-4-ocr-ai-cross-check-confidence',
  'pokemon-sleep-ai-v0.3.73-g13-3b-analysis-confirmation-apply',
  'pokemon-sleep-ai-v0.3.72-g13-3a-real-ocr-ai-execution',
  'pokemon-sleep-ai-v0.3.71-g13-3a-ultra-minimal-ai-shell',
  'pokemon-sleep-ai-v0.3.70-g13-2m-ocr-ai-ab-diagnostic',
  'pokemon-sleep-ai-v0.3.69-g13-2l-direct-minimal-review',
  'pokemon-sleep-ai-v0.3.68-g13-2j-android-raf-timeout-fallback',
  'pokemon-sleep-ai-v0.3.67-g13-2i-progressive-ai-review-bootstrap',
  'pokemon-sleep-ai-v0.3.66-g13-2h-sequential-advanced-ai-review',
  'pokemon-sleep-ai-v0.3.65-g13-2g-lightweight-ai-review',
  'pokemon-sleep-ai-v0.3.64-g13-2f-region-ai-review-deferred'
];
void PREVIOUS_CACHE_COMPATIBILITY_MARKERS;

const ASSETS = [
  './','./index.html','./manifest.webmanifest','./assets/css/app.css','./assets/css/editor.css',
  './assets/js/bootstrap.js','./assets/js/runtime-version.js','./assets/js/debug-trace-manager.js','./assets/js/app.js','./assets/js/database.js','./assets/js/storage.js','./assets/js/backup-truth-restore.js','./assets/js/data-consistency-multicapture.js','./assets/js/public-catalog-workbench.js',
  './assets/js/schema.js','./assets/js/migrations.js','./assets/js/importer.js','./assets/js/seed-data.js','./assets/js/pokemon-detail.js','./assets/js/pokemon-master-options.js','./assets/js/ai-observation.js','./assets/js/ai-workflow.js','./assets/js/ai-key-vault.js','./assets/js/ai-project-pool-runtime.js','./assets/js/ai-project-pool-settings.js','./assets/js/ai-review-image-resolver.js','./assets/js/ai-review-queue-executor.js','./assets/js/ai-review-executor-controller.js','./assets/js/ai-review-executor-status-ui.js','./assets/js/manual-editor.js','./assets/js/prompt-catalog.js','./assets/js/g3-planning.js','./assets/js/ingredient-gap-engine.js','./assets/js/time-utils.js','./assets/js/analysis-revision-store.js','./assets/js/analysis-confirmation-workbench.js','./assets/js/analysis-cross-check-confidence.js','./assets/js/two-stage-forced-ocr-entry.js','./assets/js/unified-import-analysis-workbench.js','./assets/js/full75-recovery-workbench.js','./assets/js/v0382-image-byte-snapshot.js','./assets/js/v0382-release-authority.js','./assets/js/v0383-catalog-ocr-review-contract.js',
  './assets/js/identity-review.js','./assets/js/identity-convergence.js','./assets/js/identity-quality-guard.js','./assets/js/identity-dedup.js','./assets/js/identity-evidence-builder.js','./assets/js/identity-candidate-engine.js','./assets/js/sqlite-identity-candidate-adapter.js','./assets/js/identity-confirmation-model.js','./assets/js/identity-confirmation-ui.js','./assets/js/identity-confirmation-entry.js',
  './assets/js/identity-import-wizard.js','./assets/js/identity-import-pipeline.js','./assets/js/pokemon-screenshot-grouping.js','./assets/js/pokemon-zip-manifest.js','./assets/js/pokemon-zip-adapter.js','./assets/js/data1-zip-inventory.js','./assets/js/data1-image-fingerprint.js','./assets/js/data1d-local-ocr-runtime.js','./assets/js/ocr-runtime-monitor.js','./assets/js/data1d-ocr-first-classifier.js','./assets/js/data1d1-ocr-runtime-ui.js','./assets/js/data1d1-ocr-review-package.js','./assets/js/data1d1-ocr-region-ai-consent.js','./assets/js/data1d1-ocr-region-ui.js','./assets/js/data1d1-ocr-region-single-item-ui.js','./assets/js/data1d1-ocr-region-direct-minimal-hotfix.js','./assets/js/data1d1-manual-reocr.js','./assets/js/data1d1-ocr-thumbnail-region-confidence.js','./assets/js/data1d1-ocr-thumbnail-overlay-wiring.js','./assets/js/data1d1-ocr-overlay-lifecycle-events.js','./assets/js/data1d1-ocr-overlay-controller-integration.js','./assets/js/data1d1-ocr-overlay-update-center-mount.js','./assets/js/data1d1-ocr-overlay-update-center-bridge.js','./assets/js/data1d1-ocr-overlay-update-center-bootstrap.js','./assets/js/data1d1-ocr-overlay-preview-event-wiring.js','./assets/js/data1-inventory-review.js','./assets/js/data1-inventory-review-ui.js','./assets/js/jszip-loader.js','./assets/js/android-import-file-picker.js','./assets/js/screenshot-observation-bridge.js','./assets/js/identity-import-apply-operation.js','./assets/js/identity-import-transaction.js','./assets/js/identity-import-wizard-entry.js',
  './assets/js/update-center-ui-guard.js','./assets/js/update-center-live-debug.js','./assets/js/shared-master-schema.js','./assets/js/shared-master-data.js','./assets/js/public-empty-profile-master.js','./assets/js/canonical-registry.js','./assets/js/shared-knowledge-ui.js','./assets/js/recipe-render-guard.js','./assets/icons/icon.svg',
  'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.js','https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm','https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
];

self.addEventListener('install',(event)=>{
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',(event)=>{
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(keys.filter((key) => key !== CACHE).map((key)=>caches.delete(key))))
      .then(()=>self.clients.claim())
      .then(()=>self.clients.matchAll({type:'window',includeUncontrolled:true}))
      .then((clients)=>Promise.all(clients.map((client)=>client.postMessage({
        type:'pokemon-sleep-version-activated',
        app_version:APP_VERSION,
        build:APP_BUILD
      }))))
  );
});

self.addEventListener('fetch',(event)=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const versionAuthorityAsset=sameOrigin&&(url.pathname.endsWith('/index.html')||url.pathname.endsWith('/bootstrap.js')||url.pathname.endsWith('/service-worker.js'));
  const networkFirst=sameOrigin&&(event.request.mode==='navigate'||url.pathname.endsWith('.js')||url.pathname.endsWith('.html'));
  if(versionAuthorityAsset||networkFirst){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then((response)=>{
      const copy=response.clone();
      caches.open(CACHE).then((cache)=>cache.put(event.request,copy));
      return response;
    }).catch(()=>caches.match(event.request).then((hit)=>hit||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then((hit)=>hit||fetch(event.request).then((response)=>{
    const copy=response.clone();
    caches.open(CACHE).then((cache)=>cache.put(event.request,copy));
    return response;
  })));
});
