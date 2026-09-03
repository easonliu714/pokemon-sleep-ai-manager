import assert from 'node:assert/strict';
import fs from 'node:fs';
import 'fake-indexeddb/auto';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const storageSource=fs.readFileSync(new URL('../assets/js/storage.js',import.meta.url),'utf8');
const databaseSource=fs.readFileSync(new URL('../assets/js/database.js',import.meta.url),'utf8');
const watchdogSource=fs.readFileSync(new URL('../assets/js/v0394-startup-watchdog.js',import.meta.url),'utf8');
const releaseSource=fs.readFileSync(new URL('../assets/js/v0382-release-authority.js',import.meta.url),'utf8');
const bootstrapSource=fs.readFileSync(new URL('../assets/js/bootstrap.js',import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');

assert.doesNotMatch(storageSource,/indexedDB\.open\(IDB_NAME\s*,\s*[23]\s*\)/,'normal IndexedDB open must not force v2/v3');
assert.match(storageSource,/indexedDB\.open\(IDB_NAME\)/,'normal IndexedDB open must be version-neutral');
assert.match(storageSource,/SNAPSHOT_META_PREFIX\s*=\s*"snapshot:"/);
assert.match(storageSource,/tx\.objectStore\(META_STORE\)\.put\(metadata,snapshotMetaKey\(id\)\)/);
assert.match(storageSource,/LEGACY_SNAPSHOT_META_STORE\s*=\s*"snapshot_metadata"/,'existing v3 legacy store remains orphan-compatible');
assert.match(storageSource,/store=>store\.getAllKeys\(\)/);
assert.doesNotMatch(storageSource,/request\(SNAPSHOT_STORE,'readonly',store=>store\.getAll\(\)\)/);
assert.match(storageSource,/snapshot_payload_bytes_materialized:false/);
assert.match(storageSource,/metadata_only_prune:true/);
assert.match(storageSource,/resetStorageConnection/);

assert.match(databaseSource,/database_metadata_probe_timeout_retryable/);
assert.match(databaseSource,/safeBootError\('database_metadata_probe_timeout_retryable'/);
assert.match(databaseSource,/resetStorageConnection\('metadata_probe_timeout'\)/);
assert.doesNotMatch(databaseSource,/emit\('APP_READY','App 已在零 SQLite 救援模式/);
assert.match(databaseSource,/RESCUE_UI_READY/);

assert.match(watchdogSource,/version_handoff_update_background_started/);
assert.match(watchdogSource,/scheduleBackgroundServiceWorkerUpdate\(registration\)/);
const liveHandoffSource=watchdogSource.slice(watchdogSource.indexOf('export async function enforceLiveVersionHandoff()'),watchdogSource.indexOf('export function getLastStartupStage'));
assert.doesNotMatch(liveHandoffSource,/registration\.update\s*\(/,'Service Worker update must not block live-version handoff');
assert.match(watchdogSource,/await registration\.update\(\)/,'background Service Worker refresh must still execute');
assert.match(watchdogSource,/requestIdleCallback|setTimeout/,'background update must be scheduled off the immediate critical path');
assert.match(watchdogSource,/update_on_critical_path:false/);

assert.match(releaseSource,/STARTUP_SLOW_WARNING/);
assert.match(releaseSource,/不會自動切換唯讀/);
const slowTimerSource=releaseSource.slice(releaseSource.indexOf('slowTimer=setTimeout'),releaseSource.indexOf("globalThis.addEventListener('pokemon-sleep:startup-progress'"));
assert.doesNotMatch(slowTimerSource,/enterReadonlyMode\(/,'8-second slow timer must never switch authority to readonly');
assert.match(releaseSource,/SERVICE_WORKER_UPDATE_BACKGROUND/);
assert.match(releaseSource,/critical_path:false/);
assert.match(releaseSource,/APP_READY_REJECTED/);
assert.match(releaseSource,/document\.documentElement\.dataset\.databaseReady!==\'true\'/);

assert.match(bootstrapSource,/criticalProbes=/);
const legacyDeferredArchitecture=/const deferredProbes=/.test(bootstrapSource);
const successorPageAwareArchitecture=/const pageModuleGroups=Object\.freeze\(/.test(bootstrapSource)&&/global_deferred_sweep:false/.test(bootstrapSource);
assert.ok(legacyDeferredArchitecture||successorPageAwareArchitecture,'v0.4.27.55.3.1 deferred-startup contract must remain or be replaced only by the narrower page-aware successor');
if(legacyDeferredArchitecture){
  assert.match(bootstrapSource,/waitForAppReady/);
  assert.match(bootstrapSource,/deferred_module_load_started/);
}else{
  assert.match(bootstrapSource,/pageLoads=new Map/);
  assert.match(bootstrapSource,/moduleLoads=new Map/);
  assert.match(bootstrapSource,/await yieldToBrowser\(\)/);
  assert.doesNotMatch(bootstrapSource,/waitForAppReady\(\)\.then/,'successor must not restart an all-feature chain after APP_READY');
}
assert.match(bootstrapSource,/debugTrace\.record\('bootstrap','modules_ready'/);
assert.doesNotMatch(bootstrapSource,/debugTrace\.record\('bootstrap','app_ready'/,'module bootstrap must not claim business-ready');
assert.equal((appSource.match(/pokemon-sleep:app-ready/g)||[]).length,1,'App business-ready event must have a single production dispatch site');
assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite migration authority remains 15');

async function deleteDb(){await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase('pokemon_sleep_ai_manager');req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('delete blocked'));});}
async function seed(version,{legacyMetaStore=false}={}){return new Promise((resolve,reject)=>{const req=indexedDB.open('pokemon_sleep_ai_manager',version);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('database'))db.createObjectStore('database');if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'id'});if(!db.objectStoreNames.contains('metadata'))db.createObjectStore('metadata');if(legacyMetaStore&&!db.objectStoreNames.contains('snapshot_metadata'))db.createObjectStore('snapshot_metadata',{keyPath:'id'});};req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);});}
async function currentVersion(){return new Promise((resolve,reject)=>{const req=indexedDB.open('pokemon_sleep_ai_manager');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const version=req.result.version;req.result.close();resolve(version);};});}

await deleteDb();
const heldV2=await seed(2);
// Keeping a v2 connection open proves the hotfix does not request v3 and therefore
// does not enter a blocked upgrade merely to list snapshot metadata.
const storageV2=await import(`../assets/js/storage.js?v5531v2=${Date.now()}`);
assert.deepEqual(await storageV2.listSnapshots(),[]);
assert.equal(await currentVersion(),2,'v2 fixture must remain v2');
heldV2.close();
await storageV2.createSnapshot(new Uint8Array([1,2,3,4]),'v2-version-neutral');
const v2List=await storageV2.listSnapshots();
assert.equal(v2List.length,1);assert.equal(v2List[0].byte_length,4);assert.equal(Object.hasOwn(v2List[0],'bytes'),false);
storageV2.closeStorageConnection();
assert.equal(await currentVersion(),2,'snapshot metadata must not force v2→v3');

await deleteDb();
const v3=await seed(3,{legacyMetaStore:true});v3.close();
const storageV3=await import(`../assets/js/storage.js?v5531v3=${Date.now()}`);
assert.deepEqual(await storageV3.listSnapshots(),[]);
storageV3.closeStorageConnection();
assert.equal(await currentVersion(),3,'existing v3 database must open at v3 without downgrade or upgrade');

console.log('v0.4.27.55.3.1 startup IndexedDB / Service Worker / readiness reliability contract PASS');
