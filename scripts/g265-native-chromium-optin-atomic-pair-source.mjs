import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

// G265 test-only Chromium context on loopback; no production origin or player DB.
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs(),sqlite=new SQL.Database();
sqlite.run('CREATE TABLE g265_optin (id TEXT PRIMARY KEY)');
sqlite.run("INSERT INTO g265_optin VALUES ('seed')");
const first=Array.from(sqlite.export());
sqlite.run("INSERT INTO g265_optin VALUES ('A')");
const second=Array.from(sqlite.export());
sqlite.run("INSERT INTO g265_optin VALUES ('B')");
const third=Array.from(sqlite.export());sqlite.close();
const hash=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
try{
  await context.route('**/g265-optin-pair-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 isolated</title>'
  }));
  const a=await context.newPage(),b=await context.newPage();
  for(const page of [a,b]){
    await page.goto(new URL('g265-optin-pair-blank',base).href);
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
  await a.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),first);
  await a.evaluate(async sha256=>{
    const db=await window.__g265.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation:0,sha256},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },hash(first));
  for(const page of [a,b])await page.evaluate(async()=>{
    const state=window.__g265;
    state.db=await state.open();
    state.gate=state.createSqliteVersionNeutralAtomicPairGate({db:state.db});
  });
  const boot=await b.evaluate(async()=>{
    const raw=await window.__g265.storage.loadDatabaseBytes();
    return {rawIsBuffer:raw instanceof ArrayBuffer,bytes:Array.from(new Uint8Array(raw))};
  });
  assert.equal(boot.rawIsBuffer,true);
  assert.equal(hash(boot.bytes),hash(first));
  console.log('PASS G265_OPTIN_SOURCE_LEGACY_RAW_ARRAYBUFFER_BOOT_COMPATIBLE');
  const writeArgs=next=>({reason:'synthetic',expectedGeneration:0,
    expectedFingerprint:hash(first),nextBytes:next});
  const results=await Promise.all([a.evaluate(async arg=>{
    try{return await window.__g265.gate.write({...arg,nextBytes:Uint8Array.from(arg.nextBytes)});}
    catch(error){return {code:error.code};}
  },writeArgs(second)),b.evaluate(async arg=>{
    try{return await window.__g265.gate.write({...arg,nextBytes:Uint8Array.from(arg.nextBytes)});}
    catch(error){return {code:error.code};}
  },writeArgs(third))]);
  assert.equal(results.filter(x=>x.status==='PERSISTED').length,1);
  assert.equal(results.filter(x=>x.code==='G265_PAIR_STALE_RELOAD_REQUIRED').length,1);
  const fresh=await a.evaluate(async()=>{
    const state=window.__g265;
    const gate=state.createSqliteVersionNeutralAtomicPairGate({db:state.db});
    const v=await gate.readVerified();
    const raw=await state.storage.loadDatabaseBytes();
    return {generation:v.generation,sha256:v.sha256,rawIsBuffer:raw instanceof ArrayBuffer,
      bytes:Array.from(new Uint8Array(raw))};
  });
  assert.equal(fresh.generation,1);
  assert.equal(fresh.rawIsBuffer,true);
  assert.equal(fresh.sha256,hash(fresh.bytes));
  const winner=hash(fresh.bytes)===hash(second)?second:third;
  const loser=winner===second?third:second;
  console.log('PASS G265_OPTIN_SOURCE_NATIVE_TWO_TAB_EXCLUSIVE_CAS_RELOAD');
  const missing=await a.evaluate(async arg=>{
    const state=window.__g265;
    const gate=state.createSqliteVersionNeutralAtomicPairGate({db:state.db,locks:null});
    let code;try{await gate.write({...arg,nextBytes:Uint8Array.from(arg.nextBytes)});}
    catch(error){code=error.code;}
    return {code,status:gate.status().status};
  },{reason:'missing-lock',expectedGeneration:1,expectedFingerprint:hash(winner),nextBytes:loser});
  assert.equal(missing.code,'G265_PAIR_WEB_LOCKS_UNAVAILABLE');
  assert.equal(missing.status,'UNVERIFIED_RELOAD_REQUIRED');
  const timeout=await a.evaluate(async arg=>{
    const state=window.__g265;
    const locks={request:()=>new Promise(()=>{})};
    const gate=state.createSqliteVersionNeutralAtomicPairGate({db:state.db,locks,timeoutMs:20});
    let code;try{await gate.write({...arg,nextBytes:Uint8Array.from(arg.nextBytes)});}
    catch(error){code=error.code;}
    return {code,status:gate.status().status};
  },{reason:'timeout',expectedGeneration:1,expectedFingerprint:hash(winner),nextBytes:loser});
  assert.equal(timeout.code,'G265_PAIR_LOCK_WAIT_TIMEOUT_UNCERTAIN');
  assert.equal(timeout.status,'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_OPTIN_SOURCE_MISSING_LOCK_TIMEOUT_STICKY_HOLD');
  // The unchanged legacy production writer bypasses this opt-in revision pair.
  await b.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),loser);
  const bypass=await a.evaluate(async()=>{
    const state=window.__g265;
    const gate=state.createSqliteVersionNeutralAtomicPairGate({db:state.db});
    let code;try{await gate.readVerified();}catch(error){code=error.code;}
    return {code,status:gate.status().status};
  });
  assert.equal(bypass.code,'G265_PAIR_DIGEST_MISMATCH');
  assert.equal(bypass.status,'UNVERIFIED_RELOAD_REQUIRED');
  console.log('REPRODUCED_HOLD G265_OPTIN_SOURCE_LEGACY_WRITER_BYPASSES_ATOMIC_PAIR');
  console.log('HOLD G265_PRODUCTION_ALL_WRITER_CONTAINMENT_ANDROID_OWNER_UAT');
  for(const page of [a,b])await page.evaluate(()=>{
    window.__g265.db.close();window.__g265.storage.closeStorageConnection();
  });
}finally{await context.close();await browser.close();}
