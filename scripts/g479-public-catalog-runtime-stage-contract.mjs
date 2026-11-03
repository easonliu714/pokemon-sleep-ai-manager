import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {
  evaluatePublicCatalogVersionAuthority,
  readPersistedPublicCatalogFingerprint,
  persistPublicCatalogFingerprint,
  decidePublicCatalogStartup,
} from '../assets/js/public-catalog-startup-authority.js';

// G479: exercise the actual production Public Catalog terminal-stage handler.
// Isolated synthetic event, metadata Map and integrity sentinel; no player SQLite,
// IndexedDB, Service Worker, network, real localStorage or PWA version changes.
const raw=readFileSync(new URL('../assets/js/public-catalog-workbench.js',import.meta.url),'utf8');
const start=raw.indexOf('function emitLazyReady(authority,decision){');
const end=raw.indexOf('function handleDataChanged(event){');
assert.ok(start>=0&&end>start,'production Public Catalog handler must be source-bound');
const actualHandler=raw.slice(start,end);
assert.match(actualHandler,/function handleDatabaseReady\(event\)/);

const metadata=new Map();
let silentWrite=false,corruptReadback=false;
const storage={
  getItem:key=>corruptReadback?'CORRUPTED_SYNTHETIC_READBACK':metadata.get(key)||null,
  setItem:(key,value)=>{if(!silentWrite)metadata.set(key,value);},
};
const events=[];
const runtime={
  publicFingerprint:null,
  publicExactMatch:false,
  publicAuthorityReady:false,
  prewarmed:new Map(),
  renderedKeys:new Map([['recipes','synthetic-prior-render']]),
};
let integrityOk=true,persistFailure=false,renderCount=0;
const context={
  evaluatePublicCatalogVersionAuthority,
  readPersistedPublicCatalogFingerprint:()=>readPersistedPublicCatalogFingerprint(storage),
  persistPublicCatalogFingerprint:fingerprint=>{
    if(persistFailure)throw new Error('synthetic metadata storage denied');
    return persistPublicCatalogFingerprint(fingerprint,storage);
  },
  decidePublicCatalogStartup,
  lightweightIntegritySentinel:()=>({ok:integrityOk,reason:integrityOk?'OK':'SYNTHETIC_INTEGRITY_FAILURE'}),
  runtime,
  progress:(stage,message,status,details)=>events.push({stage,status,details}),
  BUILD:'synthetic',
  PUBLIC_RECIPE_MASTER_VERSION:'synthetic',
  RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION:'synthetic',
  isPublicView:()=>false,
  activeView:()=> 'dashboard',
  requestRender:()=>{renderCount++;},
};
vm.createContext(context);
vm.runInContext(actualHandler,context,{filename:'public-catalog-workbench.js',timeout:2000});
const expected=Object.fromEntries(['shared','recipes','items','candy','canonical','pokemon_knowledge'].map(key=>[key,'synthetic-'+key+'-v1']));
const fire=master=>{
  events.length=0;
  context.handleDatabaseReady({detail:{public_master:master}});
  return events.map(row=>row.stage);
};
const mismatched={expected,applied:{...expected,items:'synthetic-stale-items'},updated:true};
let stages=fire(mismatched);
assert.ok(stages.includes('PUBLIC_CATALOG_HYDRATE_FAILED'),'mismatched authority must fail closed');
assert.ok(!stages.includes('PUBLIC_CATALOG_LAZY_READY'),'failed hydration must not emit a completed ready stage');
assert.ok(!stages.includes('VERSION_MATCH_BYPASS'));
assert.equal(runtime.publicExactMatch,false);
assert.equal(runtime.publicAuthorityReady,false,'mismatch must not admit public rendering');
assert.equal(metadata.size,0,'failed authority must never persist a public fingerprint');
assert.equal(runtime.renderedKeys.size,0,'failed authority must invalidate old render keys');

integrityOk=false;
stages=fire({expected,applied:{...expected},updated:false});
assert.ok(stages.includes('PUBLIC_CATALOG_HYDRATE_FAILED'));
assert.ok(!stages.includes('PUBLIC_CATALOG_LAZY_READY'),'integrity failure must not claim lazy ready');
assert.equal(metadata.size,0);
integrityOk=true;

persistFailure=true;
stages=fire({expected,applied:{...expected},updated:true});
assert.ok(stages.includes('PUBLIC_CATALOG_FINGERPRINT_PERSIST_FAILED'));
assert.ok(!stages.includes('PUBLIC_CATALOG_LAZY_READY'),'failed metadata persist must not claim lazy ready');
assert.equal(metadata.size,0);
persistFailure=false;

// G479 independent failure mode: storage.setItem can be callable yet silently
// discard metadata, or getItem can return a different value. Neither may claim
// HYDRATE_COMPLETED or allow a public projection. No real browser storage used.
assert.throws(()=>persistPublicCatalogFingerprint('synthetic',{setItem(){}}),
  /public_catalog_fingerprint_storage_unavailable/);
silentWrite=true;
stages=fire({expected,applied:{...expected},updated:true});
assert.ok(stages.includes('PUBLIC_CATALOG_FINGERPRINT_PERSIST_FAILED'));
assert.ok(!stages.includes('HYDRATE_COMPLETED'));
assert.ok(!stages.includes('PUBLIC_CATALOG_LAZY_READY'));
assert.equal(runtime.publicAuthorityReady,false);
assert.equal(metadata.size,0,'silent metadata discard must not be accepted');
silentWrite=false;
corruptReadback=true;
stages=fire({expected,applied:{...expected},updated:true});
assert.ok(stages.includes('PUBLIC_CATALOG_FINGERPRINT_PERSIST_FAILED'));
assert.ok(!stages.includes('HYDRATE_COMPLETED'));
assert.equal(runtime.publicAuthorityReady,false);
corruptReadback=false;
metadata.clear();
console.log('PASS G479_SILENT_STORAGE_DISCARD_AND_CORRUPTED_READBACK_FAIL_CLOSED');

stages=fire({expected,applied:{...expected},updated:true});
assert.ok(stages.includes('HYDRATE_COMPLETED'),'reconciled authority must complete');
assert.ok(stages.includes('PUBLIC_CATALOG_LAZY_READY'),'only verified completion may announce lazy ready');
assert.ok(stages.indexOf('HYDRATE_COMPLETED')<stages.indexOf('PUBLIC_CATALOG_LAZY_READY'),
  'terminal ready must follow verified metadata persistence');
assert.equal(metadata.size,1,'only synthetic fingerprint metadata may be persisted');
assert.equal(runtime.publicAuthorityReady,true,'successful same-boot reconciliation admits verified rendering');
assert.equal(runtime.publicExactMatch,false,'same-boot reconciliation is not a persisted bypass');

stages=fire({expected,applied:{...expected},updated:false});
assert.ok(stages.includes('VERSION_MATCH_BYPASS'),'subsequent exact readback may bypass');
assert.ok(stages.includes('PUBLIC_CATALOG_LAZY_READY'));
assert.ok(!stages.includes('HYDRATE_STARTED'));
assert.equal(runtime.publicExactMatch,true);
assert.equal(runtime.publicAuthorityReady,true,'persisted exact bypass admits verified rendering');
assert.equal(renderCount,0,'fixture never renders or mutates player data');

console.log('PASS G479_ACTUAL_PUBLIC_CATALOG_FAILED_HYDRATION_NEVER_CLAIMS_LAZY_READY');
console.log('PASS G479_INTEGRITY_AND_METADATA_PERSIST_FAILURE_FAIL_CLOSED');
console.log('PASS G479_POST_RECONCILIATION_READY_AND_EXACT_RELOAD_BYPASS');
console.log('NOTE G479_SYNTHETIC_SOURCE_BOUND_NOT_ANDROID_UAT_OR_PLAYER_SQLITE_PARITY');


// G479 independent read-side regression: execute production renderView itself.
// A migrated SQLite schema or stale cached fingerprint cannot override a failed
// Public Master authority. Synthetic only; no player DB, writes, or DOM.
const renderStart=raw.indexOf('function renderView(view){');
const renderEnd=raw.indexOf('async function drainRenderQueue(){');
assert.ok(renderStart>=0&&renderEnd>renderStart,'production renderView must remain source-bound');
context.isPublicView=view=>view==='recipes';
context.databaseReady=()=>true;
context.projectionKey=view=>String(runtime.publicFingerprint)+'|'+view;
context.pageProgress=(view,state,message,details)=>events.push({stage:'PAGE_'+state,status:state,details});
context.renderRecipeUnifiedWorkbench=()=>{renderCount++;return {unlocked_count:0,locked_count:0,total_count:0};};
context.applyConfirmedRecipeDisplayNames=()=>{};
context.isRescueReadonly=()=>false;
runtime.localRevision={recipes:0};
vm.runInContext(raw.slice(renderStart,renderEnd),context,{filename:'public-catalog-renderView.js',timeout:2000});
stages=fire(mismatched);
const priorRenders=renderCount;
assert.equal(runtime.publicAuthorityReady,false,'failed authority must revoke prior successful readiness');
assert.equal(context.renderView('recipes'),false,'failed authority must refuse a recipe projection');
assert.equal(renderCount,priorRenders,'no unverified recipe renderer may run');
assert.ok(events.some(e=>e.stage==='PUBLIC_CATALOG_RENDER_HOLD'),'explicit hold stage required');
stages=fire({expected,applied:{...expected},updated:true});
assert.equal(runtime.publicAuthorityReady,true);
assert.equal(context.renderView('recipes'),true,'verified reconciliation must allow the recipe renderer');
assert.equal(renderCount,priorRenders+1,'only verified recipe projection runs');
console.log('PASS G479_FAILED_PUBLIC_AUTHORITY_BLOCKS_RENDER_AND_PREWARM_SOURCE_BOUND');
console.log('PASS G479_VERIFIED_RECONCILIATION_READMITS_PUBLIC_READ_PROJECTION');
