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
const ownerSql=new SQL.Database(Uint8Array.from(seed));
ownerSql.run("INSERT INTO g265_lock_probe VALUES ('optin-owner-inside-lock')");
const owner=Array.from(ownerSql.export());
ownerSql.run("INSERT INTO g265_lock_probe VALUES ('legacy-after-fresh-reload')");
const merged=Array.from(ownerSql.export());ownerSql.close();
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
  // G265: bind this independent legacy tab to its loaded source image.
  // Atomic revision CAS now also shares native Web Locks at the save boundary.
  const baseline=await b.evaluate(async()=>{
    const bytes=await window.__g265.storage.loadDatabaseBytes();
    return Array.from(new Uint8Array(bytes));
  });
  assert.equal(hash(baseline),hash(seed));
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
  // The actual production save now queues on the same native Web Lock.
  // Retain the original negative witness: while owner A holds that lock, B
  // cannot commit even if B's durable revision was fresh when its SQL work began.
  await b.evaluate(bytes=>{
    window.__g265.pendingStatus='QUEUED';
    window.__g265.pendingSave=window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes))
      .then(()=>{window.__g265.pendingStatus='UNEXPECTED_COMMIT';return 'UNEXPECTED_COMMIT';},
        error=>{window.__g265.pendingStatus=error.code;return error.code;});
  },legacy);
  await b.waitForFunction(async name=>{
    const state=await navigator.locks.query();
    return state.pending.some(lock=>lock.name===name);
  },lockName,{timeout:5000});
  assert.equal(await b.evaluate(()=>window.__g265.pendingStatus),'QUEUED');
  console.log('PASS G265_SHARED_PRIMARY_NATIVE_SAVE_QUEUED_BEHIND_HELD_OPTIN_WEB_LOCK');

  // Test-only synthetic opt-in owner commits the newer authoritative image
  // WHILE holding its Web Lock, then releases the lock. No direct production
  // player DB write is involved. The queued older legacy export must fail CAS.
  await a.evaluate(async data=>{
    const db=await window.__g265.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction(['database','metadata'],'readwrite');
      const bytes=Uint8Array.from(data.bytes);
      tx.objectStore('database').put(bytes.buffer,'primary');
      const store=tx.objectStore('metadata');
      store.put({generation:1,sha256:data.sha256},'revision:primary');
      store.put({byte_length:bytes.byteLength,updated_at:'2026-11-08T00:00:00.000Z',
        format:'sqlite-arraybuffer',safe_boot_version:2,
        revision_scheme:'g265-atomic-primary-cas-v1'},'primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },{bytes:owner,sha256:hash(owner)});
  assert.equal(await b.evaluate(()=>window.__g265.pendingStatus),'QUEUED');
  await a.evaluate(async()=>{
    window.__g265.release();
    await window.__g265.lockDone;
  });
  const stale=await b.evaluate(()=>window.__g265.pendingSave);
  assert.equal(stale,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  const afterOwner=await a.evaluate(async()=>{
    const db=await window.__g265.open();
    try{
      const gate=window.__g265.createSqliteVersionNeutralAtomicPairGate({db});
      const record=await gate.readVerified();
      return {generation:record.generation,sha256:record.sha256,bytes:Array.from(record.bytes)};
    }finally{db.close();}
  });
  assert.equal(afterOwner.generation,1);
  assert.equal(afterOwner.sha256,hash(owner));
  assert.equal(hash(afterOwner.bytes),hash(owner));
  console.log('PASS G265_SHARED_PRIMARY_HELD_LOCK_OWNER_COMMIT_STALE_LEGACY_REJECT_NO_DATA_LOSS');

  // Only an explicit fresh reload permits a new user action based on the
  // verified owner image. Never silently retry a pre-lock legacy export.
  const fresh=await b.evaluate(async()=>{
    const bytes=await window.__g265.storage.loadDatabaseBytes();
    return Array.from(new Uint8Array(bytes));
  });
  assert.equal(hash(fresh),hash(owner));
  await b.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),merged);
  const verified=await b.evaluate(async()=>{
    const bytes=await window.__g265.storage.loadDatabaseBytes();
    const db=await window.__g265.open();
    try{
      const record=await new Promise((resolve,reject)=>{
        const tx=db.transaction('metadata','readonly');
        const request=tx.objectStore('metadata').get('revision:primary');
        tx.oncomplete=()=>resolve(request.result);
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      return {bytes:Array.from(new Uint8Array(bytes)),revision:record};
    }finally{db.close();}
  });
  assert.equal(verified.revision.generation,2);
  assert.equal(verified.revision.sha256,hash(merged));
  assert.equal(hash(verified.bytes),hash(merged));
  const persisted=new SQL.Database(Uint8Array.from(verified.bytes));
  assert.deepEqual(persisted.exec('SELECT id FROM g265_lock_probe ORDER BY id')[0].values.map(x=>x[0]),
    ['legacy-after-fresh-reload','optin-owner-inside-lock','seed']);
  persisted.close();
  console.log('PASS G265_SHARED_PRIMARY_FRESH_RELOAD_MANUAL_REBASE_PRESERVES_BOTH_SQL_ROWS');
  console.log('HOLD G265_LEGACY_PRE_PERSIST_SQL_MUTATION_INTERVALS_AND_ANDROID_OWNER_UAT');
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
