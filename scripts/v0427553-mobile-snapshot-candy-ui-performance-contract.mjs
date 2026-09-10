import assert from 'node:assert/strict';
import fs from 'node:fs';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory.js';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';
import {shouldInvalidatePublicCatalogFingerprint,publicCatalogProjectionViewForLocalEntity} from '../assets/js/public-catalog-fingerprint-policy.js';

const read=path=>fs.readFileSync(path,'utf8');
const publicCatalogSource=read('assets/js/public-catalog-workbench.js');
const versionSource=read('assets/js/version-authority.js');
globalThis.indexedDB=new FDBFactory();
globalThis.window=globalThis;

assert.equal(publicCatalogProjectionViewForLocalEntity('item_inventory'),'items');
assert.equal(publicCatalogProjectionViewForLocalEntity('unrelated_player_state'),null);
assert.equal(shouldInvalidatePublicCatalogFingerprint({entity:'ingredient_inventory'}),false,'local player mutation must not invalidate Public Master fingerprint');
assert.equal(shouldInvalidatePublicCatalogFingerprint({public_master_changed:true}),true);
assert.match(publicCatalogSource,/PUBLIC_CATALOG_VERSION_CHECK/);assert.match(publicCatalogSource,/VERSION_MATCH_BYPASS/);assert.match(publicCatalogSource,/HYDRATE_STARTED/);assert.match(publicCatalogSource,/HYDRATE_COMPLETED/);assert.match(publicCatalogSource,/RENDER_DEDUPED/);assert.match(publicCatalogSource,/PUBLIC_CATALOG_LAZY_READY/);assert.match(publicCatalogSource,/persistPublicCatalogFingerprint/);assert.match(publicCatalogSource,/runtime\.draining&&runtime\.pendingView===view/);assert.match(publicCatalogSource,/global_singleton:true/);assert.doesNotMatch(publicCatalogSource,/window\.addEventListener\('pokemon-sleep:data-changed',\(\)=>requestRender/);

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite migration authority must remain frozen at 15');
// Governed .55.3 successors preserve this performance contract unchanged; only
// the release-version whitelist advances through .55.3.3.
assert.match(versionSource,/app_version: 'v0\.4\.27\.55\.3(?:\.[12]|\.3(?:\.[123456])?)?'/);
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
assert.match(globalThis.PokemonSleepVersionAuthority?.app_version||'',/^v0\.4\.27\.55\.3(?:\.[12]|\.3(?:\.[123456])?)?$/);
console.log('v0.4.27.55.3 mobile snapshot / Candy incremental UI / static shell / persisted Public Master bypass contract PASS');