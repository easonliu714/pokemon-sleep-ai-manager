import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

// G265: disposable, same-origin, native Chromium Web Locks + IndexedDB.
// This never opens the production application or any player database.
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','test must use loopback only');
const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE g265_revision_rows (id TEXT PRIMARY KEY)');
seed.run("INSERT INTO g265_revision_rows VALUES ('seed')");
const original=new Uint8Array(seed.export());seed.close();
const add=(bytes,id)=>{
  const db=new SQL.Database(new Uint8Array(bytes));
  try{db.run('INSERT INTO g265_revision_rows VALUES (?)',[id]);return Array.from(new Uint8Array(db.export()));}
  finally{db.close();}
};
const seedHash=createHash('sha256').update(original).digest('hex');
const aBytes=add(original,'A'),bBytes=add(original,'B');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const dbName='g265-native-atomic-revision-'+Date.now()+'-'+Math.random().toString(36).slice(2);
try{
  await context.route('**/g265-atomic-revision-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><html><body>G265 disposable native revision</body></html>'
  }));
  const tabA=await context.newPage(),tabB=await context.newPage();
  for(const tab of [tabA,tabB]){
    await tab.goto(new URL('g265-atomic-revision-blank',base).href);
    await tab.evaluate(async name=>{
      const {createSqliteDurableRevisionGate}=await import('/assets/js/sqlite-durable-revision-gate.js');
      const {sha256SqliteBytes}=await import('/assets/js/sqlite-cross-tab-write-admission.js');
      const db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open(name,1);
        req.onupgradeneeded=()=>req.result.createObjectStore('revision');
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      const state={db,holdNext:false,holding:false};
      const fingerprint=async bytes=>{
        if(state.holdNext){state.holdNext=false;state.holding=true;await state.holdPromise;}
        return sha256SqliteBytes(bytes);
      };
      state.gate=(opts={})=>createSqliteDurableRevisionGate({
        db,storeName:'revision',timeoutMs:12000,fingerprint,...opts
      });
      state.seed=record=>new Promise((resolve,reject)=>{
        const tx=db.transaction('revision','readwrite');
        tx.objectStore('revision').put(record,'primary');
        tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
      });
      state.get=()=>new Promise((resolve,reject)=>{
        const tx=db.transaction('revision','readonly');
        const req=tx.objectStore('revision').get('primary');
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);tx.onerror=()=>reject(tx.error);
      });
      window.__rev=state;
    },dbName);
    const primitives=await tab.evaluate(()=>({
      secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
      indexedDB:typeof indexedDB.open==='function',crypto:typeof crypto.subtle?.digest==='function'
    }));
    assert.deepEqual(primitives,{secure:true,locks:true,indexedDB:true,crypto:true});
  }
  await tabA.evaluate(({bytes,hash})=>window.__rev.seed({generation:0,sha256:hash,bytes:new Uint8Array(bytes)}),
    {bytes:Array.from(original),hash:seedHash});
  const baselineA=await tabA.evaluate(async()=>window.__rev.gate().readVerified());
  const baselineB=await tabB.evaluate(async()=>window.__rev.gate().readVerified());
  assert.equal(baselineA.generation,0);assert.equal(baselineB.generation,0);
  assert.equal(baselineA.sha256,seedHash);assert.equal(baselineB.sha256,seedHash);
  await tabA.evaluate(()=>{
    const s=window.__rev;s.holdNext=true;s.holdPromise=new Promise(resolve=>{s.releaseHold=resolve;});
    s.writer=s.gate();
  });
  await tabB.evaluate(()=>{window.__rev.writer=window.__rev.gate();});
  const first=tabA.evaluate(async ({hash,bytes})=>{
    try{return {ok:true,...await window.__rev.writer.write({
      reason:'native-A',expectedGeneration:0,expectedFingerprint:hash,nextBytes:new Uint8Array(bytes)
    })};}catch(e){return {ok:false,code:e.code||e.message};}
  },{hash:seedHash,bytes:aBytes});
  await tabA.waitForFunction(()=>window.__rev.holding===true,null,{timeout:8000});
  const second=tabB.evaluate(async ({hash,bytes})=>{
    try{return {ok:true,...await window.__rev.writer.write({
      reason:'native-B-stale',expectedGeneration:0,expectedFingerprint:hash,nextBytes:new Uint8Array(bytes)
    })};}catch(e){return {ok:false,code:e.code||e.message};}
  },{hash:seedHash,bytes:bBytes});
  await tabB.waitForFunction(async()=>{
    const locks=await navigator.locks.query();
    return locks.pending.some(x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
  },null,{timeout:8000});
  const whileHeld=await tabB.evaluate(()=>window.__rev.get());
  assert.equal(whileHeld.generation,0,'native IndexedDB must not advance while A is paused under lock');
  await tabA.evaluate(()=>window.__rev.releaseHold());
  const resultA=await first,resultB=await second;
  assert.equal(resultA.status,'PERSISTED');assert.equal(resultA.generation,1);
  assert.deepEqual(resultB,{ok:false,code:'G265_REVISION_STALE_GENERATION_RELOAD_REQUIRED'});
  assert.equal(await tabB.evaluate(()=>window.__rev.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal((await tabB.evaluate(()=>window.__rev.get())).generation,1);
  console.log('PASS G265_NATIVE_CHROMIUM_ATOMIC_REVISION_TWO_TAB_EXCLUSIVE_LOCK_AND_STALE_REJECT');

  const restored=await tabA.evaluate(async ({bytes})=>{
    const gate=window.__rev.gate(),before=await gate.readVerified();
    return gate.write({reason:'native-ABA-restore',expectedGeneration:before.generation,
      expectedFingerprint:before.sha256,nextBytes:new Uint8Array(bytes)});
  },{bytes:Array.from(original)});
  assert.equal(restored.generation,2);assert.equal(restored.sha256,seedHash);
  const aba=await tabB.evaluate(async ({hash,bytes})=>{
    const gate=window.__rev.gate();
    try{await gate.write({reason:'native-ABA-stale',expectedGeneration:0,
      expectedFingerprint:hash,nextBytes:new Uint8Array(bytes)});
      return {code:'UNEXPECTED_PASS',status:gate.status().status};
    }catch(e){return {code:e.code,status:gate.status().status};}
  },{hash:seedHash,bytes:bBytes});
  assert.deepEqual(aba,{code:'G265_REVISION_STALE_GENERATION_RELOAD_REQUIRED',status:'UNVERIFIED_RELOAD_REQUIRED'});
  const fresh=await tabB.evaluate(async ({bytes})=>{
    const gate=window.__rev.gate(),before=await gate.readVerified();
    return gate.write({reason:'native-B-fresh',expectedGeneration:before.generation,
      expectedFingerprint:before.sha256,nextBytes:new Uint8Array(bytes)});
  },{bytes:bBytes});
  assert.equal(fresh.generation,3);
  const final=await tabA.evaluate(async()=>{
    const r=await window.__rev.gate().readVerified();
    return {generation:r.generation,sha256:r.sha256,bytes:Array.from(r.bytes)};
  });
  assert.equal(final.generation,3);
  const check=new SQL.Database(new Uint8Array(final.bytes));
  try{assert.deepEqual(check.exec('SELECT id FROM g265_revision_rows ORDER BY id')[0].values.flat(),['B','seed']);}
  finally{check.close();}
  console.log('PASS G265_NATIVE_CHROMIUM_ABA_MONOTONIC_GENERATION_AND_FRESH_RELOAD');

  const noLocks=await tabB.evaluate(async()=>{
    const gate=window.__rev.gate({locks:null});
    try{await gate.write({reason:'native-no-lock',expectedGeneration:3,
      expectedFingerprint:'0'.repeat(64),nextBytes:new Uint8Array([1])});
      return {code:'UNEXPECTED_PASS',status:gate.status().status};
    }catch(e){return {code:e.code,status:gate.status().status};}
  });
  assert.deepEqual(noLocks,{code:'G265_REVISION_WEB_LOCKS_UNAVAILABLE',status:'UNVERIFIED_RELOAD_REQUIRED'});
  await tabA.evaluate(()=>{
    const s=window.__rev;s.manualHold=new Promise(resolve=>{s.releaseManual=resolve;});
    s.manualLock=navigator.locks.request('pokemon-sleep-ai-manager:sqlite-primary-exclusive-write',
      {mode:'exclusive'},async()=>{s.manualAcquired=true;await s.manualHold;});
  });
  await tabA.waitForFunction(()=>window.__rev.manualAcquired===true,null,{timeout:8000});
  const timeout=await tabB.evaluate(async ({bytes})=>{
    const gate=window.__rev.gate({timeoutMs:80});
    try{await gate.write({reason:'native-lock-timeout',expectedGeneration:3,
      expectedFingerprint:(await window.__rev.get()).sha256,nextBytes:new Uint8Array(bytes)});
      return {code:'UNEXPECTED_PASS',status:gate.status().status};
    }catch(e){return {code:e.code,status:gate.status().status};}
  },{bytes:bBytes});
  assert.deepEqual(timeout,{code:'G265_REVISION_LOCK_WAIT_TIMEOUT_UNCERTAIN',status:'UNVERIFIED_RELOAD_REQUIRED'});
  await tabA.evaluate(()=>window.__rev.releaseManual());
  await tabA.evaluate(()=>window.__rev.manualLock);
  assert.equal((await tabA.evaluate(()=>window.__rev.get())).generation,3);
  console.log('PASS G265_NATIVE_CHROMIUM_MISSING_WEB_LOCKS_AND_WAIT_TIMEOUT_STICKY_HOLD');
  console.log('HOLD G265_PRODUCTION_RUNTIME_WIRING_LEGACY_23_WRITERS_ANDROID_OWNER_UAT_NAMED_DRAFT');
  for(const tab of [tabA,tabB])await tab.evaluate(()=>window.__rev.db.close());
}finally{
  await context.close();await browser.close();
}