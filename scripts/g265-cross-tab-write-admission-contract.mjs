import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

// Independent opt-in contract. Do NOT wire to production database or touch
// personal IndexedDB. Test uses actual SQL.js bytes and a fake Web Locks FIFO.
const source=fs.readFileSync('assets/js/sqlite-cross-tab-write-admission.js','utf8');
const dbSource=fs.readFileSync('assets/js/database.js','utf8');
const runtimeSource=fs.readFileSync('assets/js/sqlite-write-session-runtime.js','utf8');
assert.match(source,/locks\.request\(/);
assert.match(source,/mode:'exclusive'/);
assert.match(source,/SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED/);
assert.match(source,/SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE/);
assert.doesNotMatch(dbSource,/sqlite-cross-tab-write-admission/,'no production runtime wiring authorized');
assert.doesNotMatch(runtimeSource,/sqlite-cross-tab-write-admission/,'no production runtime wiring authorized');
const digest=b=>sha256SqliteBytes(b,webcrypto);
class FakeLocks{
  constructor(){this.tail=Promise.resolve();this.active=0;this.peak=0;this.calls=0;}
  request(name,options,callback){
    assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
    assert.equal(options.mode,'exclusive');
    assert.ok(options.signal);
    this.calls++;
    const prior=this.tail;
    let release;
    this.tail=new Promise(resolve=>{release=resolve;});
    return (async()=>{
      try{
        await prior;
        if(options.signal.aborted)throw Error('synthetic_lock_aborted');
        this.active++;
        this.peak=Math.max(this.peak,this.active);
        try{return await callback({name,mode:'exclusive'});}
        finally{this.active--;}
      }finally{release();}
    })();
  }
}
const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE g265_lock_test (id TEXT PRIMARY KEY, tab TEXT NOT NULL)');
seed.run("INSERT INTO g265_lock_test VALUES('seed','initial')");
let durable=new Uint8Array(seed.export());seed.close();
const original=await digest(durable);
const locks=new FakeLocks();
let writeCount=0,releaseFirst;
const holdFirst=new Promise(resolve=>{releaseFirst=resolve;});
const adapter=async({latestBytes,reason})=>{
  if(reason==='tab-A')await holdFirst;
  const sql=new SQL.Database(new Uint8Array(latestBytes));
  sql.run('INSERT INTO g265_lock_test VALUES(?,?)',[reason,reason]);
  const next=new Uint8Array(sql.export());sql.close();
  durable=next;writeCount++;
  return {persistedBytes:next};
};
const gate=()=>createSqliteCrossTabWriteAdmission({locks,readDurable:async()=>new Uint8Array(durable),fingerprint:digest,timeoutMs:1000});
const a=gate(),b=gate();
const first=a.execute({reason:'tab-A',expectedFingerprint:original,writeUnderLock:adapter});
await new Promise(resolve=>setTimeout(resolve,0));
const second=b.execute({reason:'tab-B',expectedFingerprint:original,writeUnderLock:adapter});
assert.equal(a.status().status,'IN_FLIGHT');
releaseFirst();
const aResult=await first;
assert.equal(aResult.status,'PERSISTED');
await assert.rejects(second,e=>e.code==='SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
assert.equal(writeCount,1);
await assert.rejects(b.execute({reason:'retry',expectedFingerprint:original,writeUnderLock:adapter}),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const fresh=gate();
const cResult=await fresh.execute({reason:'tab-C',expectedFingerprint:await digest(durable),writeUnderLock:adapter});
assert.equal(cResult.status,'PERSISTED');
const check=new SQL.Database(durable);
assert.deepEqual(check.exec('SELECT id FROM g265_lock_test ORDER BY id')[0].values.flat(),['seed','tab-A','tab-C']);
check.close();
assert.equal(writeCount,2);

const noLocks=createSqliteCrossTabWriteAdmission({locks:null,readDurable:async()=>durable,fingerprint:digest});
await assert.rejects(noLocks.execute({reason:'no-web-locks',expectedFingerprint:await digest(durable),writeUnderLock:adapter}),e=>e.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const failingRead=createSqliteCrossTabWriteAdmission({locks,readDurable:async()=>{throw Error('synthetic-read-fail');},fingerprint:digest});
await assert.rejects(failingRead.execute({reason:'read-fail',expectedFingerprint:await digest(durable),writeUnderLock:adapter}),/synthetic-read-fail/);
assert.equal(failingRead.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const failingWrite=createSqliteCrossTabWriteAdmission({locks,readDurable:async()=>durable,fingerprint:digest});
await assert.rejects(failingWrite.execute({reason:'write-fail',expectedFingerprint:await digest(durable),writeUnderLock:async()=>{throw Error('synthetic-write-fail');}}),/synthetic-write-fail/);
assert.equal(failingWrite.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const mismatch=createSqliteCrossTabWriteAdmission({locks,readDurable:async()=>durable,fingerprint:digest});
await assert.rejects(mismatch.execute({reason:'ack-mismatch',expectedFingerprint:await digest(durable),writeUnderLock:async()=>({persistedBytes:new Uint8Array([1,2,3])})}),e=>e.code==='SQLITE_CROSS_TAB_POST_WRITE_DURABLE_MISMATCH');
assert.equal(mismatch.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const held=createSqliteCrossTabWriteAdmission({locks,readDurable:async()=>durable,fingerprint:digest,timeoutMs:15});
let releaseHeld;
const heldPromise=new Promise(resolve=>{releaseHeld=resolve;});
await assert.rejects(held.execute({reason:'held-timeout',expectedFingerprint:await digest(durable),writeUnderLock:async()=>{await heldPromise;return {persistedBytes:durable};}}),e=>e.code==='SQLITE_CROSS_TAB_HELD_LOCK_TIMEOUT_UNCERTAIN');
assert.equal(held.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.active,1,'held Web Lock must remain acquired until callback settles');
releaseHeld();await locks.tail;
assert.equal(locks.active,0);
const waiterLocks=new FakeLocks();
let releaseWait;
const blocker=new Promise(resolve=>{releaseWait=resolve;});
const blockerJob=waiterLocks.request('pokemon-sleep-ai-manager:sqlite-primary-exclusive-write',{mode:'exclusive',signal:new AbortController().signal},async()=>blocker);
const waitGate=createSqliteCrossTabWriteAdmission({locks:waiterLocks,readDurable:async()=>durable,fingerprint:digest,timeoutMs:15});
await assert.rejects(waitGate.execute({reason:'wait-timeout',expectedFingerprint:await digest(durable),writeUnderLock:adapter}),e=>e.code==='SQLITE_CROSS_TAB_LOCK_WAIT_TIMEOUT_UNCERTAIN');
assert.equal(waitGate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
releaseWait();await blockerJob;await waiterLocks.tail;
console.log('PASS G265_CROSS_TAB_WEB_LOCKS_FIFO_EXCLUSIVE_SOURCE_CONTRACT');
console.log('PASS G265_IN_LOCK_DURABLE_SHA256_STALE_FAIL_CLOSED_REAL_SQLITE');
console.log('PASS G265_POST_WRITE_DURABLE_READBACK_AND_TIMEOUT_STICKY_HOLD');
console.log('HOLD G265_PRODUCTION_RUNTIME_WIRING_LEGACY_23_WRITERS_REAL_CHROMIUM_ANDROID_UAT');
