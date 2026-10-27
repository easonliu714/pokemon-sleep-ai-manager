import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

// G265: test-only same-origin Chromium tabs; never access the deployed site or player DB.
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs(),sqlite=new SQL.Database();
sqlite.run('CREATE TABLE g265_lock_probe (id TEXT PRIMARY KEY)');
sqlite.run("INSERT INTO g265_lock_probe VALUES ('seed')");
const seed=Array.from(sqlite.export());
sqlite.run("INSERT INTO g265_lock_probe VALUES ('legacy-during-lock')");
const legacy=Array.from(sqlite.export());
sqlite.close();
const hash=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
assert.notEqual(hash(seed),hash(legacy));
const lockName='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
let a,b;
try{
  await context.route('**/g265-lock-held-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 isolated lock probe</title>'
  }));
  a=await context.newPage();b=await context.newPage();
  for(const page of [a,b]){
    await page.goto(new URL('g265-lock-held-blank',base).href);
    await page.evaluate(async()=>{
      const storage=await import('/assets/js/storage.js');
      const {createSqliteVersionNeutralAtomicPairGate}=await import(
        '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
      const open=()=>new Promise((resolve,reject)=>{
        const req=indexedDB.open('pokemon_sleep_ai_manager');
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      window.__g265={storage,open,createSqliteVersionNeutralAtomicPairGate};
    });
  }
  await a.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(async sha256=>{
    const db=await window.__g265.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation:0,sha256},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },hash(seed));
  // Hold the exact lock used by the opt-in atomic writer in tab A.
  await a.evaluate(name=>{
    let notify;
    window.__g265.acquired=new Promise(resolve=>{notify=resolve;});
    window.__g265.lockDone=navigator.locks.request(name,{mode:'exclusive'},async lock=>{
      if(!lock)throw new Error('lock_not_acquired');
      await new Promise(resolve=>{
        window.__g265.release=resolve;
        notify();
      });
    });
    window.__g265.lockDone.catch(()=>{});
  },lockName);
  await a.evaluate(()=>window.__g265.acquired);
  const lockDenied=await b.evaluate(name=>navigator.locks.request(
    name,{mode:'exclusive',ifAvailable:true},lock=>lock===null),lockName);
  assert.equal(lockDenied,true,'native Web Locks must exclude a cooperating writer');
  console.log('PASS G265_NATIVE_WEB_LOCKS_EXCLUSIVE_COOPERATING_WRITER_DENIED');
  // The actual unchanged production legacy save does NOT request that lock.
  await b.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),legacy);
  const observed=await b.evaluate(async()=>{
    const state=window.__g265;
    const bytes=await state.storage.loadDatabaseBytes();
    const db=await state.open();
    try{
      const revision=await new Promise((resolve,reject)=>{
        const tx=db.transaction('metadata','readonly');
        const req=tx.objectStore('metadata').get('revision:primary');
        tx.oncomplete=()=>resolve(req.result);
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      return {bytes:Array.from(new Uint8Array(bytes)),revision};
    }finally{db.close();}
  });
  assert.equal(hash(observed.bytes),hash(legacy));
  assert.equal(observed.revision.generation,0);
  assert.equal(observed.revision.sha256,hash(seed));
  console.log('REPRODUCED_HOLD G265_LEGACY_SAVE_COMMITS_WHILE_NATIVE_EXCLUSIVE_LOCK_HELD');
  const mismatch=await a.evaluate(async()=>{
    const state=window.__g265,db=await state.open();
    try{
      const gate=state.createSqliteVersionNeutralAtomicPairGate({db});
      let code;
      try{await gate.readVerified();}catch(error){code=error.code;}
      return {code,status:gate.status().status};
    }finally{db.close();}
  });
  assert.equal(mismatch.code,'G265_PAIR_DIGEST_MISMATCH');
  assert.equal(mismatch.status,'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_ATOMIC_PAIR_DETECTS_LEGACY_BYPASS_FAIL_CLOSED_AFTER_FACT');
  console.log('HOLD G265_ALL_LEGACY_WRITERS_LOCK_ADMISSION_PRODUCTION_CROSS_TAB_ANDROID_UAT');
}finally{
  if(a&&!a.isClosed())try{await a.evaluate(async()=>{
    window.__g265?.release?.();
    await window.__g265?.lockDone?.catch(()=>{});
    window.__g265?.storage?.closeStorageConnection?.();
  });}catch{}
  if(b&&!b.isClosed())try{await b.evaluate(()=>{
    window.__g265?.storage?.closeStorageConnection?.();
  });}catch{}
  await context.close();await browser.close();
}
