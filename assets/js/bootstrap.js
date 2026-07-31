const status = document.getElementById('dbStatus');
const warning = document.getElementById('storageWarning');
const APP_VERSION = 'v0.3.32';
const VERSION = '20260731-tech2c-confirmation-ui';

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
  badge.title = `Pokémon Sleep AI Manager ${APP_VERSION} / ${VERSION}`;
  document.documentElement.dataset.appVersion = APP_VERSION;
  console.info(`[APP_VERSION] ${APP_VERSION} (${VERSION})`);
}
showVisibleVersion();
function showFailure(label,error){console.error(`Module probe failed: ${label}`,error);if(status){status.textContent='載入失敗';status.className='badge error';}if(warning){warning.textContent=`前端模組載入失敗：${label}：${error?.message||error}`;warning.classList.remove('hidden');}}
const probes=['storage.js','schema.js','seed-data.js','shared-master-schema.js','shared-master-data.js','database.js','time-utils.js','pokemon-master-options.js','manual-editor.js','pokemon-detail.js','importer.js','ai-observation.js','ai-workflow.js','prompt-catalog.js','g3-planning.js','identity-review.js','identity-convergence.js','identity-quality-guard.js','identity-dedup.js','identity-evidence-builder.js','ingredient-gap-engine.js','update-center-ui-guard.js','shared-knowledge-ui.js','recipe-render-guard.js','identity-candidate-engine.js','sqlite-identity-candidate-adapter.js','identity-confirmation-model.js','identity-confirmation-ui.js','identity-confirmation-entry.js'];
(async()=>{for(const file of probes){try{await import(`./${file}?v=${VERSION}`);}catch(error){showFailure(file,error);return;}}try{await import(`./app.js?v=${VERSION}`);await import(`./shared-knowledge-ui.js?v=${VERSION}`);await import(`./identity-confirmation-entry.js?v=${VERSION}`);}catch(error){showFailure('app.js/shared-knowledge-ui.js/identity-confirmation-entry.js',error);}})();
