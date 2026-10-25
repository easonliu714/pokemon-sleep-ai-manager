import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {indexedDB} from 'fake-indexeddb';
import {createSqliteDurableRevisionGate} from '../assets/js/sqlite-durable-revision-gate.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

// Disposable real SQL.js + fake IndexedDB source-bound gate. No player data.
const source=fs.readFileSync('assets/js/sqlite-durable-revision-gate.js','utf8');
const production=fs.readFileSync('assets/js/database.js','utf8');
assert.match(source,/db\.transaction\(storeName,'readwrite'\)/);
assert.match(source,/store\.put\(\{generation:/);
assert.match(source,/mode:'exclusive'/);
assert.doesNotMatch(production,/sqlite-durable-revision-gate/);
const digest=b=>sha256SqliteBytes(b,webcrypto);
const SQL=await initSqlJs();
const sql=new SQL.Database();
sql.run('CREATE TABLE revision_fixture (id TEXT PRIMARY KEY)');
sql.run("INSERT INTO revision_fixture VALUES('A')");
const original=new Uint8Array(sql.export());sql.close();
const add=(bytes,id)=>{const d=new SQL.Database(new Uint8Array(bytes));d.run('INSERT INTO revision_fixture VALUES(?)',[id]);const out=new Uint8Array(d.export());d.close();return out;};
const openDb=name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,1);
  req.onupgradeneeded=()=>req.result.createObjectStore('revision');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
const seed=(db,record)=>new Promise((resolve,reject)=>{
  const tx=db.transaction('revision','readwrite');
  tx.objectStore('revision').put(record,'primary');
  tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
});
class ExclusiveLocks{
  constructor(){this.tail=Promise.resolve();this.active=0;this.peak=0;}
  request(name,options,callback){
    assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
    assert.equal(options.mode,'exclusive');
    const prior=this.tail;let release;
    this.tail=new Promise(r=>{release=r;});
    return (async()=>{try{await prior;if(options.signal.aborted)throw Error('aborted');
      this.active++;this.peak=Math.max(this.peak,this.active);
      try{return await callback({name});}finally{this.active--;}}
      finally{release();}})();
  }
}
const locks=new ExclusiveLocks();
const db=await openDb('g265-revision-aba-disposable');
const originalHash=await digest(original);
await seed(db,{generation:0,sha256:originalHash,bytes:original});
const gate=()=>createSqliteDurableRevisionGate({db,storeName:'revision',locks,fingerprint:digest,timeoutMs:2000});
const stale=gate(),a=gate(),restore=gate();
const baseline=await stale.readVerified();
assert.equal(baseline.generation,0);
const first=await a.write({reason:'A-to-B',expectedGeneration:0,expectedFingerprint:originalHash,nextBytes:add(original,'B')});
assert.equal(first.status,'PERSISTED');assert.equal(first.generation,1);
const second=await restore.write({reason:'B-to-A-restore',expectedGeneration:1,expectedFingerprint:first.sha256,nextBytes:original});
assert.equal(second.status,'PERSISTED');assert.equal(second.generation,2);
assert.equal(second.sha256,originalHash,'ABA returns same bytes/hash');
await assert.rejects(stale.write({reason:'stale-ABA-tab',expectedGeneration:0,expectedFingerprint:originalHash,nextBytes:add(original,'stale')}),e=>e.code==='G265_REVISION_STALE_GENERATION_RELOAD_REQUIRED');
assert.equal(stale.status().status,'UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(stale.write({reason:'retry',expectedGeneration:0,expectedFingerprint:originalHash,nextBytes:original}),e=>e.code==='G265_REVISION_UNVERIFIED_RELOAD_REQUIRED');
const fresh=gate();const current=await fresh.readVerified();
assert.equal(current.generation,2);assert.equal(current.sha256,originalHash);
const third=await fresh.write({reason:'fresh-after-ABA',expectedGeneration:2,expectedFingerprint:originalHash,nextBytes:add(current.bytes,'fresh')});
assert.equal(third.generation,3);assert.equal(locks.peak,1);
const final=await gate().readVerified();assert.equal(final.generation,3);
const check=new SQL.Database(final.bytes);
assert.deepEqual(check.exec('SELECT id FROM revision_fixture ORDER BY id')[0].values.flat(),['A','fresh']);check.close();

const noLocks=createSqliteDurableRevisionGate({db,storeName:'revision',locks:null,fingerprint:digest});
await assert.rejects(noLocks.write({reason:'missing-lock',expectedGeneration:3,expectedFingerprint:final.sha256,nextBytes:final.bytes}),e=>e.code==='G265_REVISION_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const missingDb=await openDb('g265-revision-missing-disposable');
const missing=createSqliteDurableRevisionGate({db:missingDb,storeName:'revision',locks,fingerprint:digest});
await assert.rejects(missing.readVerified(),e=>e.code==='G265_REVISION_MISSING_OR_INVALID');
assert.equal(missing.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const corruptDb=await openDb('g265-revision-corrupt-disposable');
await seed(corruptDb,{generation:0,sha256:originalHash,bytes:new Uint8Array([1,2,3])});
const corrupt=createSqliteDurableRevisionGate({db:corruptDb,storeName:'revision',locks,fingerprint:digest});
await assert.rejects(corrupt.readVerified(),e=>e.code==='G265_REVISION_BYTES_DIGEST_MISMATCH');
assert.equal(corrupt.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const badTxDb=await openDb('g265-revision-closed-disposable');
await seed(badTxDb,{generation:0,sha256:originalHash,bytes:original});badTxDb.close();
const failed=createSqliteDurableRevisionGate({db:badTxDb,storeName:'revision',locks,fingerprint:digest});
await assert.rejects(failed.write({reason:'closed-db',expectedGeneration:0,expectedFingerprint:originalHash,nextBytes:original}),e=>e.code==='G265_REVISION_READ_FAILED');
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const timeoutLocks={request:async()=>new Promise(()=>{})};
const timed=createSqliteDurableRevisionGate({db,storeName:'revision',locks:timeoutLocks,fingerprint:digest,timeoutMs:15});
await assert.rejects(timed.write({reason:'lock-timeout',expectedGeneration:3,expectedFingerprint:final.sha256,nextBytes:final.bytes}),e=>e.code==='G265_REVISION_LOCK_WAIT_TIMEOUT_UNCERTAIN');
assert.equal(timed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_ATOMIC_IDB_SINGLE_RECORD_BYTES_SHA256_GENERATION_REAL_SQLJS_FAKE_IDB');
console.log('PASS G265_ABA_STALE_REVISION_REJECT_RESTORE_MONOTONIC_GENERATION');
console.log('PASS G265_MISSING_CORRUPT_NO_WEB_LOCKS_TRANSACTION_FAILURE_TIMEOUT_STICKY_HOLD');
console.log('HOLD G265_NATIVE_CHROMIUM_ATOMIC_REVISION_PRODUCTION_WIRING_LEGACY_23_ANDROID_UAT');
for(const d of [db,missingDb,corruptDb])d.close();
