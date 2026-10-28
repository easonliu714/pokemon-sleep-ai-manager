import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

// G265: disposable same-origin Chromium tabs, real Web Locks, native IndexedDB,
// browser SQL.js/WASM. No production app mount, player data, or runtime wiring.
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','isolated fixture must stay loopback-only');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
seedDb.run("INSERT INTO settings VALUES('unrelated','retain','2026-10-01T00:00:00Z')");
seedDb.run("INSERT INTO settings VALUES('weekly_context_manual_override:2026-11-02','present','2026-11-02T00:00:00Z')");
const seed=Array.from(seedDb.export());seedDb.close();
const hash=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const seedHash=hash(seed);
const lockName='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write';
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
let a,b,c;
try{
  await context.route('**/g265-weekly-clear-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable weekly clear probe</title>'
  }));
  await context.route('**/g265-weekly-clear-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-weekly-clear-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  a=await context.newPage();b=await context.newPage();
  for(const page of [a,b]){
    await page.goto(new URL('g265-weekly-clear-native-blank',base).href);
    await page.addScriptTag({url:new URL('g265-weekly-clear-native.js',base).href});
    await page.evaluate(async()=>{
      const storage=await import('/assets/js/storage.js');
      const {createSqliteVersionNeutralAtomicPairGate}=await import(
        '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
      const {createWeeklyManualOverrideClearNoopProbe}=await import(
        '/assets/js/sqlite-weekly-manual-override-clear-optin.js');
      const SQL=await window.initSqlJs({locateFile:()=>'/g265-weekly-clear-native.wasm'});
      const open=()=>new Promise((resolve,reject)=>{
        const request=indexedDB.open('pokemon_sleep_ai_manager');
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
        createWeeklyManualOverrideClearNoopProbe,opened:0};
    });
    assert.deepEqual(await page.evaluate(()=>({
      secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
      digest:typeof crypto.subtle?.digest==='function'
    })),{secure:true,locks:true,digest:true});
  }
  await a.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(async sha256=>{
    const db=await window.__g265.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation:0,sha256},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },seedHash);
  await b.evaluate(async()=>{
    const v=window.__g265;
    v.db=await v.open();
    v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    v.probe=(timeoutMs=5000,pairGate=v.pair)=>v.createWeeklyManualOverrideClearNoopProbe({
      pairGate,locks:navigator.locks,timeoutMs,
      openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}
    });
  });
  const input={weekStart:'2026-10-26',expectedGeneration:0,expectedFingerprint:seedHash};
  const holdA=async()=>{
    await a.evaluate(name=>{
      let notify;
      window.__g265.acquired=new Promise(resolve=>{notify=resolve;});
      window.__g265.lockDone=navigator.locks.request(name,{mode:'exclusive'},async lock=>{
        if(!lock)throw Error('NATIVE_LOCK_NOT_ACQUIRED');
        await new Promise(resolve=>{window.__g265.releaseLock=resolve;notify();});
      });
      window.__g265.lockDone.catch(()=>{});
    },lockName);
    await a.evaluate(()=>window.__g265.acquired);
  };

  // Tab A owns the native exclusive lock; B must time out before opening SQL.js.
  await holdA();
  await b.evaluate(input=>{
    const v=window.__g265;v.timed=v.probe(600);
    v.waiting=v.timed.inspect(input).then(value=>({ok:true,value}),
      error=>({ok:false,code:error.code}));
  },input);
  await b.waitForFunction(async name=>(await navigator.locks.query()).pending.some(
    lock=>lock.name===name),lockName,{timeout:5000});
  const waitResult=await b.evaluate(()=>window.__g265.waiting);
  assert.deepEqual(waitResult,{ok:false,code:'G265_WEEKLY_CLEAR_PROBE_LOCK_WAIT_TIMEOUT'});
  assert.deepEqual(await b.evaluate(()=>({
    opened:window.__g265.opened,status:window.__g265.timed.status().status
  })),{opened:0,status:'UNVERIFIED_RELOAD_REQUIRED'});
  await a.evaluate(async()=>{window.__g265.releaseLock();await window.__g265.lockDone;});
  const sticky=await b.evaluate(async input=>{
    try{await window.__g265.timed.inspect(input);return 'UNEXPECTED_PASS';}
    catch(error){return error.code;}
  },input);
  assert.equal(sticky,'G265_WEEKLY_CLEAR_PROBE_UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_NATIVE_TWO_TAB_LOCK_WAIT_TIMEOUT_NO_SQLJS_STICKY_HOLD');

  // A newly constructed probe may read the latest durable pair and report
  // missing-key false without DELETE, generation increment or persisted write.
  const fresh=await b.evaluate(async input=>{
    const v=window.__g265,probe=v.probe();
    const absent=await probe.inspect(input);
    const present=await probe.inspect({...input,weekStart:'2026-11-02'});
    const verified=await v.pair.readVerified();
    return {absent,present,status:probe.status().status,
      generation:verified.generation,sha256:verified.sha256,
      bytes:Array.from(verified.bytes),opened:v.opened};
  },input);
  assert.equal(fresh.absent.status,'ABSENT_NOOP');
  assert.equal(fresh.absent.legacyResult,false);
  assert.equal(fresh.present.status,'PRESENT_REQUIRES_CAS_WRITE');
  assert.equal(fresh.present.legacyResult,null);
  assert.equal(fresh.status,'READY');
  assert.equal(fresh.generation,0);
  assert.equal(fresh.sha256,seedHash);
  assert.equal(hash(fresh.bytes),seedHash);
  assert.equal(fresh.opened,2);
  console.log('PASS G265_NATIVE_CHROMIUM_ABSENT_FALSE_PRESENT_CAS_NO_DURABLE_WRITE');

  // Closing the owning tab releases the real browser lock. The waiting
  // read-only probe must then finish safely against the same durable bytes.
  await holdA();
  await b.evaluate(input=>{
    const v=window.__g265;v.afterClose=v.probe(6000);
    v.afterCloseResult=v.afterClose.inspect(input).then(value=>({ok:true,value}),
      error=>({ok:false,code:error.code}));
  },input);
  await b.waitForFunction(async name=>(await navigator.locks.query()).pending.some(
    lock=>lock.name===name),lockName,{timeout:5000});
  await a.close();
  const afterClose=await b.evaluate(()=>window.__g265.afterCloseResult);
  assert.equal(afterClose.ok,true,JSON.stringify(afterClose));
  assert.equal(afterClose.value.status,'ABSENT_NOOP');
  assert.equal(await b.evaluate(()=>window.__g265.afterClose.status().status),'READY');
  console.log('PASS G265_NATIVE_OWNER_TAB_CLOSE_RELEASES_LOCK_WAITING_PROBE_READS_FRESH');

  // Timeout after lock acquisition but before readVerified resolves: releasing
  // a delayed read must NOT resume SQL.js or clear the sticky fail-closed state.
  await b.evaluate(input=>{
    const v=window.__g265;
    v.lateStarted=false;
    const delayed={readVerified:()=>{
      v.lateStarted=true;
      return new Promise(resolve=>{v.releaseLateRead=resolve;});
    }};
    v.lateProbe=v.probe(250,delayed);
    v.lateResult=v.lateProbe.inspect(input).then(value=>({ok:true,value}),
      error=>({ok:false,code:error.code}));
  },input);
  await b.waitForFunction(()=>window.__g265.lateStarted===true,null,{timeout:5000});
  const heldResult=await b.evaluate(()=>window.__g265.lateResult);
  assert.deepEqual(heldResult,{ok:false,code:'G265_WEEKLY_CLEAR_PROBE_HELD_LOCK_TIMEOUT'});
  const openedBeforeRelease=await b.evaluate(()=>window.__g265.opened);
  await b.evaluate(async()=>{
    const v=window.__g265,current=await v.pair.readVerified();
    v.releaseLateRead(current);
    await new Promise(resolve=>setTimeout(resolve,0));
  });
  assert.equal(await b.evaluate(()=>window.__g265.opened),openedBeforeRelease);
  assert.equal(await b.evaluate(()=>window.__g265.lateProbe.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const last=await b.evaluate(async()=>{
    const v=window.__g265,verified=await v.pair.readVerified();
    return {generation:verified.generation,sha256:verified.sha256,
      bytes:Array.from(verified.bytes)};
  });
  assert.equal(last.generation,0);
  assert.equal(last.sha256,seedHash);
  assert.equal(hash(last.bytes),seedHash);
  console.log('PASS G265_NATIVE_HELD_LOCK_LATE_READ_TIMEOUT_ZERO_LATE_SQLJS');

  // G265 crash-after-IDB-commit, before ACK: a closed writer tab cannot claim
  // success. A fresh tab must read the new durable pair and reject blind retry.
  const changedDb=new SQL.Database(Uint8Array.from(seed));
  changedDb.run("INSERT OR REPLACE INTO settings VALUES('crash-recovery-fixture','committed','2026-10-29T00:00:00Z')");
  const changed=Array.from(changedDb.export());changedDb.close();
  const changedHash=hash(changed);
  c=await context.newPage();
  await c.goto(new URL('g265-weekly-clear-native-blank',base).href);
  await c.evaluate(async()=>{
    const {createSqliteVersionNeutralAtomicPairGate}=await import(
      '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    let digestCalls=0;
    const fingerprint=async bytes=>{
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const value=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      digestCalls++;
      // First digest verifies baseline; second hashes next bytes; third is
      // post-commit readback. Simulate lost ACK by never resolving that read.
      if(digestCalls===3){
        window.__g265Crash.postCommitReadEntered=true;
        await new Promise(()=>{});
      }
      return value;
    };
    window.__g265Crash={db,postCommitReadEntered:false,ack:false};
    window.__g265Crash.gate=createSqliteVersionNeutralAtomicPairGate({
      db,locks:navigator.locks,fingerprint,timeoutMs:15000
    });
  });
  await c.evaluate(input=>{
    const v=window.__g265Crash;
    v.pending=v.gate.write({
      reason:'g265:disposable:postcommit-ack-loss',
      expectedGeneration:input.generation,expectedFingerprint:input.sha256,
      nextBytes:Uint8Array.from(input.bytes)
    }).then(()=>{v.ack=true;},error=>{v.failure=error.code;});
  },{generation:0,sha256:seedHash,bytes:changed});
  await c.waitForFunction(()=>window.__g265Crash.postCommitReadEntered===true,
    null,{timeout:10000});
  const committed=await b.evaluate(async()=>{
    const pair=await window.__g265.pair.readVerified();
    return {generation:pair.generation,sha256:pair.sha256,bytes:Array.from(pair.bytes)};
  });
  assert.equal(committed.generation,1);
  assert.equal(committed.sha256,changedHash);
  assert.equal(hash(committed.bytes),changedHash);
  assert.equal(await c.evaluate(()=>window.__g265Crash.ack),false,
    'post-commit pending readback must not issue success ACK');
  await c.close();c=null;

  // A new browser document opens the existing IDB without migration. It must
  // distinguish the committed generation from the caller's stale expectation.
  await b.reload();
  await b.evaluate(async()=>{
    const {createSqliteVersionNeutralAtomicPairGate}=await import(
      '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    window.__g265Recovery={db,gate:createSqliteVersionNeutralAtomicPairGate({
      db,locks:navigator.locks
    })};
  });
  const recovered=await b.evaluate(async()=>{
    const pair=await window.__g265Recovery.gate.readVerified();
    return {generation:pair.generation,sha256:pair.sha256,bytes:Array.from(pair.bytes)};
  });
  assert.equal(recovered.generation,1);
  assert.equal(recovered.sha256,changedHash);
  assert.equal(hash(recovered.bytes),changedHash);
  const retry=await b.evaluate(async input=>{
    const v=window.__g265Recovery;
    try{
      await v.gate.write({
        reason:'g265:disposable:forbidden-blind-retry',
        expectedGeneration:0,expectedFingerprint:input.oldHash,
        nextBytes:Uint8Array.from(input.bytes)
      });
      return {code:'UNEXPECTED_ACK',status:v.gate.status().status};
    }catch(error){return {code:error.code,status:v.gate.status().status};}
  },{oldHash:seedHash,bytes:changed});
  assert.deepEqual(retry,{
    code:'G265_PAIR_STALE_RELOAD_REQUIRED',status:'UNVERIFIED_RELOAD_REQUIRED'
  });
  const unchanged=await b.evaluate(async()=>{
    const db=window.__g265Recovery.db;
    const {createSqliteVersionNeutralAtomicPairGate}=await import(
      '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const fresh=createSqliteVersionNeutralAtomicPairGate({db,locks:navigator.locks});
    const pair=await fresh.readVerified();
    return {generation:pair.generation,sha256:pair.sha256};
  });
  assert.deepEqual(unchanged,{generation:1,sha256:changedHash});
  console.log('PASS G265_NATIVE_POSTCOMMIT_ACK_LOSS_TAB_CLOSE_RELOAD_GENERATION_READBACK');
  console.log('PASS G265_NATIVE_AMBIGUOUS_ACK_BLIND_RETRY_STALE_FAIL_CLOSED');


  // G265 native PRE-COMMIT abort: all three IDB writes are staged, but the
  // actual browser readwrite transaction is aborted before oncomplete.
  // A rejected ACK must leave generation/bytes/metadata unchanged after reload.
  const abortedDb=new SQL.Database(Uint8Array.from(changed));
  abortedDb.run("INSERT OR REPLACE INTO settings VALUES('precommit-abort-fixture','must-not-persist','2026-10-29T00:00:00Z')");
  const abortedBytes=Array.from(abortedDb.export());abortedDb.close();
  assert.notEqual(hash(abortedBytes),changedHash);
  c=await context.newPage();
  await c.goto(new URL('g265-weekly-clear-native-blank',base).href);
  await c.evaluate(async()=>{
    const {createSqliteVersionNeutralAtomicPairGate}=await import(
      '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    window.__g265Abort={db,stagedAbortCount:0,ack:false};
    // Forward the real IDB transaction; intercept only the final staged put.
    // Abort the native transaction after all puts, before durable commit.
    const injected={
      objectStoreNames:db.objectStoreNames,
      transaction(names,mode){
        const tx=db.transaction(names,mode);
        if(mode!=='readwrite')return tx;
        return {
          objectStore(name){
            const store=tx.objectStore(name);
            return {
              get:key=>store.get(key),
              put:(value,key)=>{
                const request=store.put(value,key);
                if(name==='metadata'&&key==='primary'){
                  window.__g265Abort.stagedAbortCount++;
                  tx.abort();
                }
                return request;
              }
            };
          },
          abort:()=>tx.abort(),
          get error(){return tx.error;},
          set oncomplete(fn){tx.oncomplete=fn;},
          set onerror(fn){tx.onerror=fn;},
          set onabort(fn){tx.onabort=fn;}
        };
      }
    };
    window.__g265Abort.gate=createSqliteVersionNeutralAtomicPairGate({
      db:injected,locks:navigator.locks,timeoutMs:10000
    });
  });
  const precommit=await c.evaluate(async input=>{
    const v=window.__g265Abort;
    try{
      await v.gate.write({
        reason:'g265:disposable:staged-precommit-native-abort',
        expectedGeneration:1,expectedFingerprint:input.sha256,
        nextBytes:Uint8Array.from(input.bytes)
      });
      v.ack=true;
      return {code:'UNEXPECTED_ACK',ack:v.ack,abortCount:v.stagedAbortCount};
    }catch(error){
      return {code:error.code,ack:v.ack,abortCount:v.stagedAbortCount,
        status:v.gate.status().status};
    }
  },{sha256:changedHash,bytes:abortedBytes});
  assert.deepEqual(precommit,{
    code:'G265_PAIR_TRANSACTION_ABORTED',ack:false,abortCount:1,
    status:'UNVERIFIED_RELOAD_REQUIRED'
  });
  const stickyAbort=await c.evaluate(async input=>{
    try{
      await window.__g265Abort.gate.write({
        reason:'g265:disposable:forbidden-abort-retry',
        expectedGeneration:1,expectedFingerprint:input.sha256,
        nextBytes:Uint8Array.from(input.bytes)
      });
      return 'UNEXPECTED_ACK';
    }catch(error){return error.code;}
  },{sha256:changedHash,bytes:abortedBytes});
  assert.equal(stickyAbort,'G265_PAIR_UNVERIFIED_RELOAD_REQUIRED');
  await c.close();c=null;
  await b.reload();
  const afterAbort=await b.evaluate(async()=>{
    const {createSqliteVersionNeutralAtomicPairGate}=await import(
      '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const gate=createSqliteVersionNeutralAtomicPairGate({db,locks:navigator.locks});
    const verified=await gate.readVerified();
    db.close();
    return {generation:verified.generation,sha256:verified.sha256,
      bytes:Array.from(verified.bytes)};
  });
  assert.equal(afterAbort.generation,1);
  assert.equal(afterAbort.sha256,changedHash);
  assert.deepEqual(afterAbort.bytes,changed,
    'native staged transaction abort must preserve the complete durable SQLite image');
  const verifiedDb=new SQL.Database(Uint8Array.from(afterAbort.bytes));
  assert.equal(verifiedDb.exec("SELECT key FROM settings WHERE key='precommit-abort-fixture'").length,0);
  verifiedDb.close();
  console.log('PASS G265_NATIVE_PRECOMMIT_STAGED_IDB_ABORT_ZERO_ACK_ZERO_DURABLE_CHANGE');
  console.log('PASS G265_NATIVE_PRECOMMIT_ABORT_STICKY_HOLD_RELOAD_READBACK_NO_BLIND_RETRY');

  console.log('HOLD G265_NATIVE_PROBE_ONLY_PRODUCTION_23_LEGACY_WRITERS_CRASH_RECOVERY_ANDROID_UAT');
}finally{
  if(c&&!c.isClosed())try{await c.close();}catch{}
  if(b&&!b.isClosed())try{await b.evaluate(()=>{
    window.__g265?.db?.close();window.__g265?.storage?.closeStorageConnection?.();
  });}catch{}
  if(a&&!a.isClosed())try{await a.evaluate(()=>{
    window.__g265?.releaseLock?.();window.__g265?.storage?.closeStorageConnection?.();
  });}catch{}
  await context.close();await browser.close();
}
