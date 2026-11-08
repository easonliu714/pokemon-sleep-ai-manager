// G265 production shared storage boundary: actual save/load API, disposable
// SQL.js bytes and fake IndexedDB. No player origin, DB, PWA, or private input.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import initSqlJs from 'sql.js';
import {indexedDB} from 'fake-indexeddb';
globalThis.indexedDB=indexedDB;
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const tabA=await import('../assets/js/storage.js?g265-primary-tab-A');
const tabB=await import('../assets/js/storage.js?g265-primary-tab-B');
const sha=bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE g265_primary (id TEXT PRIMARY KEY)');
seed.run("INSERT INTO g265_primary VALUES ('seed')");
const original=new Uint8Array(seed.export());
seed.run("INSERT INTO g265_primary VALUES ('A')");
const afterA=new Uint8Array(seed.export());
seed.run("INSERT INTO g265_primary VALUES ('B')");
const afterAB=new Uint8Array(seed.export());
seed.close();

const open=()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('pokemon_sleep_ai_manager');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
const readPair=async()=>{
  const db=await open();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(['database','metadata'],'readonly');
    const raw=tx.objectStore('database').get('primary');
    const revision=tx.objectStore('metadata').get('revision:primary');
    const meta=tx.objectStore('metadata').get('primary');
    tx.oncomplete=()=>resolve({raw:raw.result,revision:revision.result,metadata:meta.result});
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
};
const atomicRawOnlyOverwrite=async bytes=>{
  const db=await open();
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction(['database','metadata'],'readwrite');
    tx.objectStore('database').put(Uint8Array.from(bytes).buffer,'primary');
    // Old-version bypass is explicitly simulated; next reader must detect it.
    tx.objectStore('metadata').put({byte_length:bytes.length,updated_at:'legacy-bypass',
      format:'sqlite-arraybuffer',safe_boot_version:2},'primary');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
};

await tabA.saveDatabaseBytes(original);
let durable=await readPair();
assert.ok(durable.raw instanceof ArrayBuffer,'primary must remain raw ArrayBuffer');
assert.equal(durable.revision.generation,0);
assert.equal(durable.revision.sha256,sha(original));
assert.equal(durable.metadata.byte_length,original.length);
const bInitial=await tabB.loadDatabaseBytes();
assert.equal(sha(bInitial),sha(original));
await tabA.saveDatabaseBytes(afterA);
durable=await readPair();
assert.equal(durable.revision.generation,1);
await assert.rejects(tabB.saveDatabaseBytes(afterAB),e=>e.code==='SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
durable=await readPair();
assert.equal(durable.revision.generation,1);
assert.equal(sha(durable.raw),sha(afterA));
console.log('PASS G265_PRODUCTION_ALL_PERSIST_CALLERS_ATOMIC_PRIMARY_REVISION_STALE_TAB_REJECT');

await tabA.saveDatabaseBytes(original);
durable=await readPair();
assert.equal(durable.revision.generation,2);
assert.equal(sha(durable.raw),sha(original),'ABA may return to exact old bytes');
await assert.rejects(tabB.saveDatabaseBytes(afterAB),e=>e.code==='SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
assert.equal((await readPair()).revision.generation,2);
const tabC=await import('../assets/js/storage.js?g265-primary-tab-C');
assert.equal(sha(await tabC.loadDatabaseBytes()),sha(original));
await tabC.saveDatabaseBytes(afterAB);
durable=await readPair();
assert.equal(durable.revision.generation,3);
assert.equal(sha(durable.raw),sha(afterAB));
console.log('PASS G265_PRODUCTION_REVISION_MONOTONIC_ABA_FRESH_RELOAD_WRITE');

await atomicRawOnlyOverwrite(original);
const tabD=await import('../assets/js/storage.js?g265-primary-tab-D');
await assert.rejects(tabD.loadDatabaseBytes(),
  e=>e.code==='SQLITE_PRIMARY_REVISION_BYTES_MISMATCH_RELOAD_REQUIRED');
await assert.rejects(tabC.saveDatabaseBytes(original),
  e=>e.code==='SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
assert.equal(sha((await readPair()).raw),sha(original));
console.log('PASS G265_LEGACY_BYPASS_REVISION_BYTES_READBACK_HOLD');

// A prior-version raw DB can be loaded without migration and gains revision
// metadata on its FIRST guarded write; corrupt/write-only revision is rejected.
await tabA.clearAllStorage();
await atomicRawOnlyOverwrite(original);
const legacy=await import('../assets/js/storage.js?g265-primary-legacy');
assert.equal(sha(await legacy.loadDatabaseBytes()),sha(original));
await legacy.saveDatabaseBytes(afterA);
durable=await readPair();
assert.ok(durable.raw instanceof ArrayBuffer);
assert.equal(durable.revision.generation,0);
assert.equal(durable.revision.sha256,sha(afterA));
await tabB.closeStorageConnection();
await tabA.closeStorageConnection();
await tabC.closeStorageConnection();
await tabD.closeStorageConnection();
await legacy.closeStorageConnection();
const worker=fs.readFileSync('assets/js/sqlite-load-worker.js','utf8');
const main=fs.readFileSync('assets/js/storage.js','utf8');
assert.match(worker,/db\.transaction\(\[DB_STORE,META_STORE\],'readonly'\)/);
assert.match(worker,/revision:revisionReq\.result/);
assert.match(main,/bindPrimaryImage\(\{bytes:message\.buffer/);
console.log('PASS G265_LEGACY_RAW_COMPATIBLE_FIRST_CAS_REVISION_WORKER_PAIRED_READ');
