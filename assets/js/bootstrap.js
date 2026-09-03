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

// v0.4.27.55.3.2: only startup authorities and DB-ready consumers stay on the
// critical path. Feature modules are page-aware and are never swept globally.
const criticalProbes=['runtime-version.js','v0382-release-authority.js','ingredient-probability-first-party-observation-ui.js'];
const pageModuleGroups=Object.freeze({
  updates:Object.freeze([
    'update-center-ui-guard.js',
    'update-center-live-debug.js',
    'identity-confirmation-entry.js',
    'identity-import-wizard-entry.js',
    'unified-import-analysis-workbench.js',
    'data1d1-ocr-overlay-update-center-bootstrap.js',
  ]),
  // backup-truth-restore.js remains a historical direct entry for now; do not
  // import it again under a query-versioned ESM identity. Backup navigation only
  // hydrates the metadata-only snapshot list.
  backup:Object.freeze([]),
  knowledge:Object.freeze([
    'shared-knowledge-ui.js',
  ]),
});
const pageLoads=new Map();
const moduleLoads=new Map();
const yieldToBrowser=()=>new Promise(resolve=>{
  if(typeof requestIdleCallback==='function')requestIdleCallback(()=>resolve(),{timeout:120});
  else if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(resolve,0));
  else setTimeout(resolve,0);
});
function importFeatureModule(file){
  if(moduleLoads.has(file))return moduleLoads.get(file);
  const started=performance.now();
  const promise=import(`./${file}?v=${encodeURIComponent(VERSION)}`).then(value=>{
    debugTrace.record('bootstrap','page_feature_module_loaded',{status:'completed',details:{file,elapsed_ms:Math.round(performance.now()-started)}});
    return value;
  }).catch(error=>{moduleLoads.delete(file);throw error;});
  moduleLoads.set(file,promise);
  return promise;
}
async function loadPageModules(page){
  const knownPage=Object.prototype.hasOwnProperty.call(pageModuleGroups,page);
  if(!knownPage)return {page,module_count:0,known_page:false};
  const files=pageModuleGroups[page];
  if(pageLoads.has(page))return pageLoads.get(page);
  const promise=(async()=>{
    const started=performance.now();
    debugTrace.record('bootstrap','page_feature_load_started',{status:'started',details:{page,module_count:files.length,single_flight:true,navigation_only:true}});
    for(const file of files){
      await yieldToBrowser();
      await importFeatureModule(file);
    }
    if(page==='updates')await hydrateUpdateCenterShells();
    if(page==='backup')await hydrateBackupSnapshotPanel();
    debugTrace.record('bootstrap','page_feature_load_completed',{status:'completed',details:{page,module_count:files.length,elapsed_ms:Math.round(performance.now()-started),single_flight:true,navigation_only:true}});
    return {page,module_count:files.length,known_page:true};
  })().catch(error=>{pageLoads.delete(page);debugTrace.record('bootstrap','page_feature_load_failed',{status:'failed',details:{page},error});throw error;});
  pageLoads.set(page,promise);
  return promise;
}

async function hydrateBackupSnapshotPanel(){
  const host=document.getElementById('snapshotList');
  if(!host)return;
  const started=performance.now();
  host.dataset.pageHydration='loading';
  try{
    const {listSnapshots}=await importFeatureModule('storage.js');
    const {formatLocal}=await importFeatureModule('time-utils.js');
    const snapshots=await listSnapshots({force:true});
    const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
    host.innerHTML=snapshots.length?snapshots.map(item=>`<div class="snapshot"><b>${esc(item.reason)}</b><br><small>${esc(formatLocal(item.created_at))}</small></div>`).join(''):'尚無自動快照';
    host.dataset.pageHydration='ready';
    debugTrace.record('bootstrap','backup_snapshot_page_hydrated',{status:'completed',details:{snapshot_count:snapshots.length,elapsed_ms:Math.round(performance.now()-started),metadata_only:true,navigation_only:true}});
  }catch(error){host.dataset.pageHydration='failed';debugTrace.record('bootstrap','backup_snapshot_page_hydration_failed',{status:'failed',error});}
}

async function hydrateUpdateCenterShells(){
  document.querySelectorAll('[data-update-static-shell]').forEach(shell=>shell.dataset.hydrationState='ready');
  const heading=document.getElementById('importHistoryHeading');
  if(heading)heading.hidden=true;
}

function bindStaticHistoryExport(){
  const button=document.getElementById('exportImportHistoryJsonBtnV042745');
  if(!button||button.dataset.staticExportBound==='true')return;
  button.dataset.staticExportBound='true';
  button.addEventListener('click',async event=>{
    event.preventDefault();event.stopPropagation();
    const started=performance.now();
    try{
      const module=await importFeatureModule('review-reference-history-ux-v042745.js');
      module.downloadImportHistoryJson({doc:document});
      debugTrace.record('bootstrap','static_history_export_completed',{status:'completed',details:{elapsed_ms:Math.round(performance.now()-started)}});
    }catch(error){alert(`匯出失敗：${error?.message||error}`);debugTrace.record('bootstrap','static_history_export_failed',{status:'failed',error});}
  });
}

function bindPageAwareFeatureLoading(){
  document.querySelectorAll('nav button[data-view]').forEach(button=>{
    if(button.dataset.pageAwareBound==='true')return;
    button.dataset.pageAwareBound='true';
    button.addEventListener('click',()=>{void loadPageModules(button.dataset.view).catch(()=>{});},{capture:false});
  });
  bindStaticHistoryExport();
  globalThis.PokemonSleepPageFeatureLoaderV04275532=Object.freeze({
    version:'v0.4.27.55.3.2-page-aware-static-shell',
    loadPage:loadPageModules,
    loadedPages:()=>[...pageLoads.keys()],
    loadedModules:()=>[...moduleLoads.keys()],
  });
  debugTrace.record('bootstrap','page_feature_loader_ready',{status:'completed',details:{global_deferred_sweep:false,page_groups:Object.keys(pageModuleGroups),single_flight:true,yield_between_modules:true,backup_navigation_only:true}});
}

(async()=>{
  const operationId=debugTrace.begin('module_bootstrap',{probe_count:criticalProbes.length,critical_probe_count:criticalProbes.length,deferred_probe_count:0,page_aware_feature_loading:true,authority});
  try{
    const handoff=await enforceLiveVersionHandoff();if(handoff?.reloading)return;
    for(const file of criticalProbes)await import(`./${file}?v=${encodeURIComponent(VERSION)}`);
    await import(`./app.js?v=${encodeURIComponent(VERSION)}`);
    enforceVersionAuthority();
    bindPageAwareFeatureLoading();
    debugTrace.end(operationId,'completed',{entry_modules_loaded:true,critical_path_reduced:true,global_deferred_sweep:false,page_aware_feature_loading:true,static_app_shell:true,version_authority:authority,version_downgrade_guard:true,version_handoff:handoff});
    debugTrace.record('bootstrap','modules_ready',{status:'completed',details:{...authority,business_ready:false,app_ready_authority:false,page_aware_feature_loading:true}});
  }catch(error){showFailure('entry_modules',error);debugTrace.fail(operationId,error,{phase:'entry_modules'});}
})();
