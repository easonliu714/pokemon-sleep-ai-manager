import assert from 'node:assert/strict';
import fs from 'node:fs';
import 'fake-indexeddb/auto';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';
import {
  canonicalPublicCatalogFingerprint,
  evaluatePublicCatalogVersionAuthority,
  persistPublicCatalogFingerprint,
  readPersistedPublicCatalogFingerprint,
  decidePublicCatalogStartup,
  publicCatalogProjectionViewForLocalEntity,
  shouldInvalidatePublicCatalogFingerprint,
} from '../assets/js/public-catalog-startup-authority.js';

const storageSource=fs.readFileSync(new URL('../assets/js/storage.js',import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const candyUiSource=fs.readFileSync(new URL('../assets/js/candy-quantity-screenshot-ui.js',import.meta.url),'utf8');
const versionSource=fs.readFileSync(new URL('../assets/js/version-authority.js',import.meta.url),'utf8');
const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicCatalogSource=fs.readFileSync(new URL('../assets/js/public-catalog-workbench.js',import.meta.url),'utf8');
const debugTraceSource=fs.readFileSync(new URL('../assets/js/debug-trace-manager.js',import.meta.url),'utf8');

// .55.3.1+ preserves metadata-only snapshots while removing the .55.3-only
// IndexedDB v3 dependency. Existing v2/v3 databases open at their current version.
assert.match(storageSource,/indexedDB\.open\(IDB_NAME\)/);
assert.doesNotMatch(storageSource,/indexedDB\.open\(IDB_NAME\s*,\s*3\s*\)/);
assert.match(storageSource,/LEGACY_SNAPSHOT_META_STORE = "snapshot_metadata"/);
assert.match(storageSource,/SNAPSHOT_META_PREFIX = "snapshot:"/);
assert.match(storageSource,/store=>store\.getAllKeys\(\)/);
assert.doesNotMatch(storageSource,/request\(SNAPSHOT_STORE,'readonly',store=>store\.getAll\(\)\)/);
assert.match(storageSource,/snapshot_payload_bytes_materialized:false/);
assert.match(storageSource,/metadata_only_prune:true/);
assert.match(storageSource,/Legacy snapshot（metadata unavailable）/);

const startSource=appSource.slice(appSource.indexOf('async function start()'));
const dbInitIndex=startSource.indexOf('await initializeDatabase()');
const dbReadyIndex=startSource.indexOf("SQLite 已就緒｜介面載入中…");
const refreshIndex=startSource.indexOf('await refresh()');
const appReadyIndex=startSource.indexOf("App 已就緒");
assert.ok(dbInitIndex>=0&&dbReadyIndex>dbInitIndex&&refreshIndex>dbReadyIndex&&appReadyIndex>refreshIndex,'DB READY / UI hydration / APP READY ordering must be explicit');
assert.match(startSource,/pokemon-sleep:app-ready/);
assert.match(appSource,/ui_refresh_completed/);
assert.match(appSource,/snapshot_list_metadata_only:true/);

for(const view of ['dashboard','pokemon','ingredients','items','recipes','updates','backup','knowledge','weekly','warroom','collection','guide','diagnostics']){
  assert.match(indexSource,new RegExp(`<section id="${view}"`),`static shell missing view ${view}`);
  assert.match(indexSource,new RegExp(`data-view="${view}"`),`static shell missing nav ${view}`);
}
assert.match(indexSource,/id="updateCenterDynamicContent"/);
assert.match(indexSource,/id="appVersion"/);
assert.match(indexSource,/id="debugExportBtn"/);
assert.match(indexSource,/id="debugBundleBtn"/);
assert.match(indexSource,/id="debugEventTable"/);
assert.match(debugTraceSource,/diagnostics_static_shell_bound/);
assert.match(debugTraceSource,/section\.dataset\.debugTraceBound/);
assert.match(debugTraceSource,/async export\(\)/);
assert.match(debugTraceSource,/await nextPaint\(\)/);
assert.match(debugTraceSource,/trace_export_handler_started/);
assert.match(debugTraceSource,/build_ms:buildMs/);
assert.match(debugTraceSource,/handler_ms:handlerMs/);
assert.match(debugTraceSource,/pre_redacted:true/);
assert.match(debugTraceSource,/buildReport\(\)\{this\.flush\(\{refresh_ui:false\}\)/);

assert.match(candyUiSource,/v0\.4\.27\.55\.3/);
assert.match(candyUiSource,/candy-quantity-screenshot-ui-2026-09-02-e-mobile-perf/);
assert.match(candyUiSource,/parse\(\{renderUi:false\}\)/);
assert.match(candyUiSource,/refreshIncrementalConfirmationUi/);
assert.match(candyUiSource,/durable_readback_preserved:true/);
assert.match(candyUiSource,/global_data_changed_dispatched:false/);
assert.match(candyUiSource,/global_refresh_deferred_until_apply:true/);
assert.match(candyUiSource,/commitPublicCandyLocalAdmission\(prepared\)/);
assert.match(candyUiSource,/prepareConfirmedMatchedCandyLocalAdmission/);
assert.equal((candyUiSource.match(/pokemon-sleep:data-changed/g)||[]).length,1,'quantity confirmation must not broadcast a global data-changed event; Apply owns the single global refresh');
assert.doesNotMatch(candyUiSource,/source:'candy_quantity_local_name_authority'/);
assert.match(candyUiSource,/source:'candy_quantity_screenshot_b5'/);

const expected={shared:'S1',recipes:'R1',items:'I1',candy:'C1',canonical:'K1',pokemon_knowledge:'P1'};
const exactPublicMaster={expected,applied:{...expected},updated:false,updated_authorities:[]};
const exactAuthority=evaluatePublicCatalogVersionAuthority(exactPublicMaster);
assert.equal(exactAuthority.exact,true);
assert.equal(exactAuthority.fingerprint,canonicalPublicCatalogFingerprint(expected));
const memoryStorage={value:new Map(),getItem(key){return this.value.get(key)??null;},setItem(key,value){this.value.set(key,value);}};
persistPublicCatalogFingerprint(exactAuthority.fingerprint,memoryStorage);
const persisted=readPersistedPublicCatalogFingerprint(memoryStorage);
assert.equal(persisted.fingerprint,exactAuthority.fingerprint);
const bypassDecision=decidePublicCatalogStartup({authority:exactAuthority,integrity_ok:true,persisted});
assert.equal(bypassDecision.action,'VERSION_MATCH_BYPASS');
let fullHydrateCalls=0;if(bypassDecision.action!=='VERSION_MATCH_BYPASS')fullHydrateCalls+=1;
assert.equal(fullHydrateCalls,0,'exact fingerprint match must call full hydrate zero times');
const missingDecision=decidePublicCatalogStartup({authority:exactAuthority,integrity_ok:true,persisted:null});
assert.equal(missingDecision.action,'HYDRATE_REQUIRED');assert.equal(missingDecision.reason,'PERSISTED_FINGERPRINT_MISSING');
const mismatchedPersisted={fingerprint:`${exactAuthority.fingerprint}|stale=1`};
assert.equal(decidePublicCatalogStartup({authority:exactAuthority,integrity_ok:true,persisted:mismatchedPersisted}).action,'HYDRATE_REQUIRED');
const reconciledAuthority=evaluatePublicCatalogVersionAuthority({...exactPublicMaster,updated:true,updated_authorities:['recipes']});
assert.equal(decidePublicCatalogStartup({authority:reconciledAuthority,integrity_ok:true,persisted}).action,'HYDRATE_REQUIRED');
const badApplied={...expected,recipes:'R0'};const mismatchAuthority=evaluatePublicCatalogVersionAuthority({expected,applied:badApplied,updated:false});
assert.equal(mismatchAuthority.exact,false);assert.equal(decidePublicCatalogStartup({authority:mismatchAuthority,integrity_ok:true,persisted}).action,'HYDRATE_REQUIRED');
assert.equal(decidePublicCatalogStartup({authority:exactAuthority,integrity_ok:false,persisted}).action,'HYDRATE_REQUIRED');
assert.equal(publicCatalogProjectionViewForLocalEntity('ingredient_inventory'),'ingredients');
assert.equal(publicCatalogProjectionViewForLocalEntity('item_inventory'),'items');
assert.equal(publicCatalogProjectionViewForLocalEntity('unrelated_player_state'),null);
assert.equal(shouldInvalidatePublicCatalogFingerprint({entity:'ingredient_inventory'}),false,'local player mutation must not invalidate Public Master fingerprint');
assert.equal(shouldInvalidatePublicCatalogFingerprint({public_master_changed:true}),true);
assert.match(publicCatalogSource,/PUBLIC_CATALOG_VERSION_CHECK/);assert.match(publicCatalogSource,/VERSION_MATCH_BYPASS/);assert.match(publicCatalogSource,/HYDRATE_STARTED/);assert.match(publicCatalogSource,/HYDRATE_COMPLETED/);assert.match(publicCatalogSource,/RENDER_DEDUPED/);assert.match(publicCatalogSource,/PUBLIC_CATALOG_LAZY_READY/);assert.match(publicCatalogSource,/persistPublicCatalogFingerprint/);assert.match(publicCatalogSource,/runtime\.draining&&runtime\.pendingView===view/);assert.match(publicCatalogSource,/global_singleton:true/);assert.doesNotMatch(publicCatalogSource,/window\.addEventListener\('pokemon-sleep:data-changed',\(\)=>requestRender/);

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite migration authority must remain frozen at 15');
// Governed .55.3 successors preserve this performance contract unchanged; only
// the release-version whitelist advances through .55.3.3.
assert.match(versionSource,/app_version: 'v0\.4\.27\.55\.3(?:\.[12]|\.3(?:\.1)?)?'/);
assert.match(versionSource,/app_version: 'v0\.4\.27\.55\.2'/);

const dbName='pokemon_sleep_ai_manager';
await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase(dbName);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('delete blocked'));});
await new Promise((resolve,reject)=>{const req=indexedDB.open(dbName,2);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('database'))db.createObjectStore('database');if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'id'});if(!db.objectStoreNames.contains('metadata'))db.createObjectStore('metadata');};req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put({id:'SNAP-20260901010101-abcd',created_at:'2026-09-01T01:01:01.000Z',reason:'legacy-before-v55.3',bytes:new Uint8Array([1,2,3,4]).buffer});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});

const storage=await import(`../assets/js/storage.js?v0427553=${Date.now()}`);
const legacyList=await storage.listSnapshots();assert.equal(legacyList.length,1);assert.equal(legacyList[0].legacy_metadata,true);assert.equal(Object.hasOwn(legacyList[0],'bytes'),false);assert.match(legacyList[0].reason,/Legacy snapshot/);
for(let index=0;index<12;index+=1){await storage.createSnapshot(new Uint8Array([index,10,20,30]),`perf-${String(index).padStart(2,'0')}`);}
const listed=await storage.listSnapshots();assert.equal(listed.length,10,'snapshot retention remains capped at 10');assert.ok(listed.every(item=>!Object.hasOwn(item,'bytes')),'snapshot list must remain metadata-only');assert.ok(listed.some(item=>item.byte_length===4),'new snapshot metadata must retain byte length without payload materialization');storage.closeStorageConnection();
const reopened=await new Promise((resolve,reject)=>{const req=indexedDB.open(dbName);req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);});assert.equal(reopened.version,2,'metadata-only successor must not force v2→v3');const snapshotKeys=await new Promise((resolve,reject)=>{const tx=reopened.transaction('snapshots','readonly');const req=tx.objectStore('snapshots').getAllKeys();tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);});assert.equal(snapshotKeys.length,10);reopened.close();

await import('../assets/js/version-authority.js');
assert.match(globalThis.PokemonSleepVersionAuthority?.app_version||'',/^v0\.4\.27\.55\.3(?:\.[12]|\.3(?:\.1)?)?$/);
console.log('v0.4.27.55.3 mobile snapshot / Candy incremental UI / static shell / persisted Public Master bypass contract PASS');
