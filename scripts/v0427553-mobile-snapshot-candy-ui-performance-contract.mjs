import assert from 'node:assert/strict';
import fs from 'node:fs';
import 'fake-indexeddb/auto';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const storageSource=fs.readFileSync(new URL('../assets/js/storage.js',import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const candyUiSource=fs.readFileSync(new URL('../assets/js/candy-quantity-screenshot-ui.js',import.meta.url),'utf8');
const versionSource=fs.readFileSync(new URL('../assets/js/version-authority.js',import.meta.url),'utf8');

assert.match(storageSource,/const IDB_VERSION = 3;/);
assert.match(storageSource,/const SNAPSHOT_META_STORE = "snapshot_metadata";/);
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

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite migration authority must remain frozen at 15');
assert.match(versionSource,/app_version: 'v0\.4\.27\.55\.3'/);
assert.match(versionSource,/app_build: '20260902-v0427553-mobile-snapshot-candy-ui-performance'/);
assert.match(versionSource,/cache_name: 'pokemon-sleep-ai-v0\.4\.27\.55\.3-v0427553-mobile-snapshot-candy-ui-performance'/);
assert.match(versionSource,/app_version: 'v0\.4\.27\.55\.2'/);

const dbName='pokemon_sleep_ai_manager';
await new Promise((resolve,reject)=>{
  const req=indexedDB.deleteDatabase(dbName);
  req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('delete blocked'));
});

// Seed an exact pre-.55.3 IndexedDB v2 snapshot. Upgrading to v3 must not
// materialize its SQLite bytes merely to display the snapshot list.
await new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName,2);
  req.onupgradeneeded=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains('database'))db.createObjectStore('database');
    if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'id'});
    if(!db.objectStoreNames.contains('metadata'))db.createObjectStore('metadata');
  };
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
    const db=req.result;
    const tx=db.transaction('snapshots','readwrite');
    tx.objectStore('snapshots').put({
      id:'SNAP-20260901010101-abcd',
      created_at:'2026-09-01T01:01:01.000Z',
      reason:'legacy-before-v55.3',
      bytes:new Uint8Array([1,2,3,4]).buffer,
    });
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>reject(tx.error);
  };
});

const storage=await import(`../assets/js/storage.js?v0427553=${Date.now()}`);
const legacyList=await storage.listSnapshots();
assert.equal(legacyList.length,1);
assert.equal(legacyList[0].legacy_metadata,true);
assert.equal(Object.hasOwn(legacyList[0],'bytes'),false);
assert.match(legacyList[0].reason,/Legacy snapshot/);

for(let index=0;index<12;index+=1){
  const bytes=new Uint8Array([index,10,20,30]);
  await storage.createSnapshot(bytes,`perf-${String(index).padStart(2,'0')}`);
}
const listed=await storage.listSnapshots();
assert.equal(listed.length,10,'snapshot retention remains capped at 10');
assert.ok(listed.every(item=>!Object.hasOwn(item,'bytes')),'snapshot list must remain metadata-only');
assert.ok(listed.some(item=>item.byte_length===4),'new snapshot metadata must retain byte length without payload materialization');

const upgraded=await new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName,3);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>resolve(req.result);
});
assert.ok(upgraded.objectStoreNames.contains('snapshot_metadata'));
const snapshotKeys=await new Promise((resolve,reject)=>{
  const tx=upgraded.transaction('snapshots','readonly');const req=tx.objectStore('snapshots').getAllKeys();
  tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);
});
assert.equal(snapshotKeys.length,10);
upgraded.close();

await import('../assets/js/version-authority.js');
assert.equal(globalThis.PokemonSleepVersionAuthority?.app_version,'v0.4.27.55.3');
assert.equal(globalThis.PokemonSleepVersionAuthority?.app_build,'20260902-v0427553-mobile-snapshot-candy-ui-performance');
assert.equal(globalThis.PokemonSleepVersionAuthority?.cache_name,'pokemon-sleep-ai-v0.4.27.55.3-v0427553-mobile-snapshot-candy-ui-performance');

console.log('v0.4.27.55.3 mobile snapshot / Candy incremental UI performance contract PASS');
