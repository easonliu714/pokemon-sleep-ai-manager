import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

// G265 isolated feasibility gate: actual legacy storage reader/writer,
// disposable fake IndexedDB and synthetic SQL.js bytes only. NOT production.
globalThis.indexedDB=indexedDB;
const {saveDatabaseBytes,loadDatabaseBytes,closeStorageConnection}=await import('../assets/js/storage.js');
const digest=bytes=>sha256SqliteBytes(bytes,webcrypto);
const SQL=await initSqlJs(),sqlite=new SQL.Database();
sqlite.run('CREATE TABLE atomic_pair_fixture (id TEXT PRIMARY KEY)');
sqlite.run("INSERT INTO atomic_pair_fixture VALUES ('seed')");
const first=new Uint8Array(sqlite.export());
sqlite.run("INSERT INTO atomic_pair_fixture VALUES ('second')");
const second=new Uint8Array(sqlite.export());
sqlite.run("INSERT INTO atomic_pair_fixture VALUES ('third')");
const third=new Uint8Array(sqlite.export());sqlite.close();
const hashFirst=await digest(first),hashSecond=await digest(second),hashThird=await digest(third);
const bytesEqual=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const buffer=bytes=>new Uint8Array(bytes).slice().buffer;
const open=()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('pokemon_sleep_ai_manager');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
const read=(db,store,key)=>new Promise((resolve,reject)=>{
  const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).get(key);
  tx.oncomplete=()=>resolve(req.result);
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
const seedRevision=(db,hash)=>new Promise((resolve,reject)=>{
  const tx=db.transaction('metadata','readwrite');
  tx.objectStore('metadata').put({generation:0,sha256:hash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});

// No await inside this single IDB readwrite transaction. Raw ArrayBuffer,
// revision and legacy metadata commit together. Test-only, not runtime wiring.
const atomicPair=(db,{expectedGeneration,expectedHash,expectedBytes,nextBytes,nextHash,abortAfterWrite=false})=>
  new Promise((resolve,reject)=>{
    const tx=db.transaction(['database','metadata'],'readwrite');
    const dbStore=tx.objectStore('database'),metaStore=tx.objectStore('metadata');
    const rawReq=dbStore.get('primary'),revReq=metaStore.get('revision:primary');
    let rawReady=false,revReady=false,failCode=null;
    const abort=code=>{failCode=code;try{tx.abort();}catch{}};
    const stage=()=>{
      if(!rawReady||!revReady||failCode)return;
      const raw=rawReq.result,rev=revReq.result;
      if(!(raw instanceof ArrayBuffer)||!rev||rev.generation!==expectedGeneration||
         rev.sha256!==expectedHash||!bytesEqual(new Uint8Array(raw),expectedBytes)){
        abort('G265_ATOMIC_PAIR_STALE_CAS');return;
      }
      if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration>=Number.MAX_SAFE_INTEGER){
        abort('G265_ATOMIC_PAIR_INVALID_GENERATION');return;
      }
      dbStore.put(buffer(nextBytes),'primary');
      metaStore.put({generation:expectedGeneration+1,sha256:nextHash},'revision:primary');
      metaStore.put({byte_length:nextBytes.byteLength,updated_at:new Date().toISOString(),
        format:'sqlite-arraybuffer',safe_boot_version:2},'primary');
      if(abortAfterWrite)abort('G265_ATOMIC_PAIR_INJECTED_ABORT');
    };
    rawReq.onsuccess=()=>{rawReady=true;stage();};
    revReq.onsuccess=()=>{revReady=true;stage();};
    rawReq.onerror=()=>abort('G265_ATOMIC_PAIR_READ_FAILED');
    revReq.onerror=()=>abort('G265_ATOMIC_PAIR_READ_FAILED');
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(Object.assign(new Error(failCode||'G265_ATOMIC_PAIR_ABORTED'),
      {code:failCode||'G265_ATOMIC_PAIR_ABORTED'}));
    // fake-indexeddb can fire error before abort: preserve the first CAS/rollback cause.
    tx.onerror=()=>reject(Object.assign(new Error(failCode||'G265_ATOMIC_PAIR_TRANSACTION_FAILED'),
      {code:failCode||'G265_ATOMIC_PAIR_TRANSACTION_FAILED',cause:tx.error}));
  });

await saveDatabaseBytes(first);
const db=await open();
await seedRevision(db,hashFirst);
await atomicPair(db,{expectedGeneration:0,expectedHash:hashFirst,expectedBytes:first,
  nextBytes:second,nextHash:hashSecond});
let raw=await loadDatabaseBytes(),rev=await read(db,'metadata','revision:primary');
assert.ok(raw instanceof ArrayBuffer,'legacy boot loader must still receive raw ArrayBuffer');
assert.equal(await digest(new Uint8Array(raw)),hashSecond);
assert.deepEqual(rev,{generation:1,sha256:hashSecond});
assert.equal((await read(db,'metadata','primary')).byte_length,second.byteLength);
const restored=new SQL.Database(new Uint8Array(raw));
assert.equal(restored.exec('SELECT COUNT(*) FROM atomic_pair_fixture')[0].values[0][0],2);
restored.close();
console.log('PASS G265_VERSION_NEUTRAL_RAW_ARRAYBUFFER_ATOMIC_DUAL_STORE_PAIR_FEASIBLE');

await assert.rejects(atomicPair(db,{expectedGeneration:0,expectedHash:hashFirst,
  expectedBytes:first,nextBytes:third,nextHash:hashThird}),
  error=>error.code==='G265_ATOMIC_PAIR_STALE_CAS');
await assert.rejects(atomicPair(db,{expectedGeneration:1,expectedHash:hashSecond,
  expectedBytes:second,nextBytes:third,nextHash:hashThird,abortAfterWrite:true}),
  error=>error.code==='G265_ATOMIC_PAIR_INJECTED_ABORT');
raw=await loadDatabaseBytes();rev=await read(db,'metadata','revision:primary');
assert.equal(await digest(new Uint8Array(raw)),hashSecond);
assert.deepEqual(rev,{generation:1,sha256:hashSecond});
console.log('PASS G265_ATOMIC_PAIR_STALE_CAS_AND_ABORT_ROLLBACK_BOTH_STORES');

// Production saveDatabaseBytes() bypasses revision metadata: permanent HOLD.
await saveDatabaseBytes(third);
raw=await loadDatabaseBytes();rev=await read(db,'metadata','revision:primary');
assert.equal(await digest(new Uint8Array(raw)),hashThird);
assert.equal(rev.sha256,hashSecond);
assert.notEqual(rev.sha256,await digest(new Uint8Array(raw)));
console.log('REPRODUCED_HOLD G265_LEGACY_SAVE_BYPASSES_ATOMIC_PAIR_REVISION');
console.log('HOLD G265_ALL_WRITER_CONTAINMENT_NATIVE_CHROMIUM_AND_ANDROID_UAT');
db.close();closeStorageConnection();
