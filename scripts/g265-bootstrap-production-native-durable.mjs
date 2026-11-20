// G265 #861: real Chromium / SQL.js / IndexedDB / Native Web Locks.
// Two first-install tabs both observe missing primary and race bootstrap.
// The stale tab must be rejected BEFORE its first schema/Seed/Migration SQL.
// Disposable localhost state ONLY; no actual player SQLite or public promotion.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
try {
  await context.route('**/g265-bootstrap-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><html><head><title>Disposable G265 Bootstrap</title></head><body></body></html>'
  }));
  async function makeTab(){
    const page=await context.newPage();
    pages.push(page);
    await page.goto(new URL('g265-bootstrap-production-disposable',base).href);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(()=>{
      const originalInit=window.initSqlJs;
      if(typeof originalInit!=='function')throw Error('G265_BROWSER_SQLJS_REQUIRED');
      let release;
      const gate=new Promise(resolve=>{release=resolve;});
      window.__releaseBootstrapEngine=release;
      window.__bootstrapEngineWaiting=false;
      window.__bootstrapSqlRuns=0;
      window.initSqlJs=async()=>{
        window.__bootstrapEngineWaiting=true;
        await gate;
        const SQL=await originalInit({locateFile:file=>'/node_modules/sql.js/dist/'+file});
        const oldRun=SQL.Database.prototype.run;
        SQL.Database.prototype.run=function(...args){
          window.__bootstrapSqlRuns++;
          return oldRun.apply(this,args);
        };
        return SQL;
      };
    });
    return page;
  }
  // Both independent tabs inspect the same genuinely absent IDB primary before
  // releasing their SQL.js engine. No sleeps or revision normalization.
  const left=await makeTab(),right=await makeTab();
  for(const p of [left,right]){
    await p.evaluate(async()=>{
      const api=await import('/assets/js/database.js');
      window.__bootstrapPromise=api.initializeDatabase()
        .then(value=>({ok:true,seeded:value.seeded,bootPersistSkipped:value.boot_persist_skipped}))
        .catch(error=>({ok:false,code:error?.code||error?.message||String(error)}));
    });
  }
  await Promise.all([left,right].map(p=>p.waitForFunction(()=>window.__bootstrapEngineWaiting===true)));
  await Promise.all([left,right].map(p=>p.evaluate(()=>window.__releaseBootstrapEngine())));
  const results=await Promise.all([left,right].map(p=>p.evaluate(async()=>({
    outcome:await window.__bootstrapPromise,
    sqlRuns:window.__bootstrapSqlRuns
  }))));
  const accepted=results.filter(x=>x.outcome.ok);
  const denied=results.filter(x=>!x.outcome.ok);
  assert.equal(accepted.length,1,'G265_BOOTSTRAP_EXACTLY_ONE_FIRST_INSTALL_ACK:'+JSON.stringify(results));
  assert.equal(denied.length,1,'G265_BOOTSTRAP_EXACTLY_ONE_STALE_REJECT:'+JSON.stringify(results));
  assert.equal(denied[0].outcome.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED',
    'G265_BOOTSTRAP_STALE_NATIVE_REVISION_CODE:'+JSON.stringify(results));
  assert.equal(denied[0].sqlRuns,0,
    'G265_BOOTSTRAP_STALE_MUST_DENY_BEFORE_ANY_SQL:'+JSON.stringify(results));
  assert.ok(accepted[0].sqlRuns>0,'G265_BOOTSTRAP_WINNER_SEED_SQL_MISSING');
  assert.equal(accepted[0].outcome.seeded,true,'G265_BOOTSTRAP_WINNER_NEW_DB_REQUIRED');
  const idbEvidence=await left.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      const result=await new Promise((resolve,reject)=>{
        const tx=db.transaction(['database','metadata','snapshots'],'readonly');
        const bytes=tx.objectStore('database').get('primary');
        const revision=tx.objectStore('metadata').get('revision:primary');
        const snapshotCount=tx.objectStore('snapshots').count();
        tx.oncomplete=()=>resolve({bytes:bytes.result,revision:revision.result,snapshotCount:snapshotCount.result});
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      if(!(result.bytes instanceof ArrayBuffer))throw Error('G265_BOOTSTRAP_DURABLE_PRIMARY_MISSING');
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',result.bytes));
      return {sha:Array.from(digest,x=>x.toString(16).padStart(2,'0')).join(''),
        revision:result.revision,snapshotCount:result.snapshotCount};
    }finally{db.close();}
  });
  assert.equal(idbEvidence.sha,idbEvidence.revision?.sha256,'G265_BOOTSTRAP_ATOMIC_IDB_SHA_REVISION');
  assert.equal(idbEvidence.revision?.generation,0,'G265_BOOTSTRAP_SINGLE_FIRST_INSTALL_GENERATION');
  assert.equal(idbEvidence.snapshotCount,0,'G265_BOOTSTRAP_DENIAL_MUST_NOT_CREATE_SNAPSHOT');
  // A genuinely fresh tab can independently load the durable first-install DB.
  const reader=await context.newPage();pages.push(reader);
  await reader.goto(new URL('g265-bootstrap-production-disposable',base).href);
  await reader.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
  const fresh=await reader.evaluate(async()=>{
    const original=window.initSqlJs;
    window.initSqlJs=()=>original({locateFile:file=>'/node_modules/sql.js/dist/'+file});
    const api=await import('/assets/js/database.js');
    const boot=await api.initializeDatabase();
    return {restored:boot.restored,skipped:boot.boot_persist_skipped,
      schemaRows:api.rows('SELECT COUNT(*) AS count FROM schema_migrations')[0].count};
  });
  assert.equal(fresh.restored,true,'G265_BOOTSTRAP_FRESH_DURABLE_RELOAD');
  assert.ok(fresh.schemaRows>0,'G265_BOOTSTRAP_FRESH_RELOAD_MIGRATIONS');

  // G265 #861: regression for an EXISTING SQLite image missing a governed
  // migration marker. Only the disposable in-browser fixture is downgraded;
  // no production Player DB, schema file, authority or migration is modified.
  // The two restored tabs must bind the SAME legacy revision before either
  // enters Native admission. Native Web Locks are still real (not mocked).
  const legacyFixture=await reader.evaluate(async()=>{
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      const old=await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata'],'readonly');
        const bytes=tx.objectStore('database').get('primary');
        const metadata=tx.objectStore('metadata').get('primary');
        const revision=tx.objectStore('metadata').get('revision:primary');
        tx.oncomplete=()=>resolve({bytes:bytes.result,metadata:metadata.result,revision:revision.result});
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      if(!(old.bytes instanceof ArrayBuffer)||!Number.isSafeInteger(old.revision?.generation))
        throw Error('G265_LEGACY_FIXTURE_REQUIRES_DURABLE_PRIMARY_REVISION');
      const engine=await window.initSqlJs();
      const legacy=new engine.Database(new Uint8Array(old.bytes));
      try{
        const present=legacy.exec('SELECT COUNT(*) FROM schema_migrations WHERE version=11')[0]?.values[0][0];
        if(present!==1)throw Error('G265_LEGACY_MARKER_11_NOT_PRESENT_IN_SEED');
        legacy.run('DELETE FROM schema_migrations WHERE version=11');
        legacy.run("INSERT INTO collection_targets(target_id,species,target_type,priority,camp,desired_traits,capture_strategy,status,notes,updated_at) VALUES('g265-legacy-sentinel','G265_LEGACY_PLAYER_ROW','','','','','','active','','2026-11-19')");
        const legacyBuffer=legacy.export();
        const raw=legacyBuffer.buffer.slice(legacyBuffer.byteOffset,legacyBuffer.byteOffset+legacyBuffer.byteLength);
        const hashBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
        const hash=Array.from(hashBytes,b=>b.toString(16).padStart(2,'0')).join('');
        const revision={generation:old.revision.generation+1,sha256:hash};
        const metadata={...old.metadata,byte_length:raw.byteLength,updated_at:new Date().toISOString()};
        await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata'],'readwrite');
          tx.objectStore('database').put(raw,'primary');
          tx.objectStore('metadata').put(metadata,'primary');
          tx.objectStore('metadata').put(revision,'revision:primary');
          tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        return {revision,byteLength:raw.byteLength};
      }finally{legacy.close();}
    }finally{idb.close();}
  });
  assert.ok(legacyFixture.byteLength>0,'G265_LEGACY_FIXTURE_DURABLE_BYTES_MISSING');
  const legacyLeft=await makeTab(),legacyRight=await makeTab();
  for(const page of [legacyLeft,legacyRight]){
    await page.evaluate(()=>{
      // Pause only the attempted *request*, never fabricate a native lock.
      // At this point storage.js has already loaded/bound the raw IDB image.
      const nativeRequest=navigator.locks.request.bind(navigator.locks);
      let release;
      const admissionGate=new Promise(resolve=>{release=resolve;});
      window.__releaseLegacyAdmission=release;
      window.__legacyAdmissionWaiting=false;
      navigator.locks.request=(name,...args)=>{
        if(name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'){
          window.__legacyAdmissionWaiting=true;
          return admissionGate.then(()=>nativeRequest(name,...args));
        }
        return nativeRequest(name,...args);
      };
    });
    await page.evaluate(async()=>{
      const api=await import('/assets/js/database.js');
      window.__bootstrapPromise=api.initializeDatabase()
        .then(value=>({ok:true,restored:value.restored,seeded:value.seeded,
          skipped:value.boot_persist_skipped}))
        .catch(error=>({ok:false,code:error?.code||error?.message||String(error)}));
    });
  }
  await Promise.all([legacyLeft,legacyRight].map(p=>p.waitForFunction(()=>window.__bootstrapEngineWaiting===true)));
  await Promise.all([legacyLeft,legacyRight].map(p=>p.evaluate(()=>window.__releaseBootstrapEngine())));
  await Promise.all([legacyLeft,legacyRight].map(p=>p.waitForFunction(()=>window.__legacyAdmissionWaiting===true)));
  await Promise.all([legacyLeft,legacyRight].map(p=>p.evaluate(()=>window.__releaseLegacyAdmission())));
  const legacyResults=await Promise.all([legacyLeft,legacyRight].map(p=>p.evaluate(async()=>({
    outcome:await window.__bootstrapPromise,sqlRuns:window.__bootstrapSqlRuns
  }))));
  const migrated=legacyResults.filter(x=>x.outcome.ok);
  const staleLegacy=legacyResults.filter(x=>!x.outcome.ok);
  assert.equal(migrated.length,1,'G265_LEGACY_MIGRATION_ONE_ACK:'+JSON.stringify(legacyResults));
  assert.equal(staleLegacy.length,1,'G265_LEGACY_MIGRATION_ONE_STALE:'+JSON.stringify(legacyResults));
  assert.equal(staleLegacy[0].outcome.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED',
    'G265_LEGACY_MIGRATION_STALE_CODE:'+JSON.stringify(legacyResults));
  assert.equal(staleLegacy[0].sqlRuns,0,'G265_LEGACY_STALE_MUST_NOT_RUN_DDL_OR_MIGRATION');
  assert.equal(migrated[0].outcome.restored,true,'G265_LEGACY_MUST_USE_EXISTING_IMAGE');
  assert.equal(migrated[0].outcome.seeded,false,'G265_LEGACY_MUST_NOT_RESEED_PLAYER_DB');
  assert.equal(migrated[0].outcome.skipped,false,'G265_LEGACY_MIGRATION_REQUIRES_DURABLE_ACK');

  // Independent IDB bytes and SQL.js must agree with the same exact revision.
  const migratedDurable=await reader.evaluate(async()=>{
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      const image=await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
        const bytes=tx.objectStore('database').get('primary');
        const revision=tx.objectStore('metadata').get('revision:primary');
        const snapshots=tx.objectStore('snapshots').count();
        tx.oncomplete=()=>resolve({bytes:bytes.result,revision:revision.result,snapshots:snapshots.result});
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      const bytes=new Uint8Array(image.bytes);
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
      const sha=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
      const engine=await window.initSqlJs();
      const sqlite=new engine.Database(bytes);
      try{
        return {sha,generation:image.revision?.generation,revisionSha:image.revision?.sha256,
          snapshots:image.snapshots,
          migration11:sqlite.exec('SELECT COUNT(*) FROM schema_migrations WHERE version=11')[0]?.values[0][0],
          sentinel:sqlite.exec("SELECT species FROM collection_targets WHERE target_id='g265-legacy-sentinel'")[0]?.values[0][0]};
      }finally{sqlite.close();}
    }finally{idb.close();}
  });
  assert.equal(migratedDurable.sha,migratedDurable.revisionSha,'G265_LEGACY_DURABLE_SHA_PAIR');
  assert.equal(migratedDurable.generation,legacyFixture.revision.generation+1,
    'G265_LEGACY_EXACT_ONE_MIGRATION_ACK');
  assert.equal(migratedDurable.migration11,1,'G265_LEGACY_MIGRATION_DURABLE_READBACK');
  assert.equal(migratedDurable.sentinel,'G265_LEGACY_PLAYER_ROW',
    'G265_LEGACY_MUST_PRESERVE_PERSONAL_SENTINEL');
  assert.equal(migratedDurable.snapshots,0,'G265_LEGACY_STALE_MUST_NOT_SNAPSHOT');
  const legacyReload=await context.newPage();pages.push(legacyReload);
  await legacyReload.goto(new URL('g265-bootstrap-production-disposable',base).href);
  await legacyReload.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
  const restoredAgain=await legacyReload.evaluate(async()=>{
    const boot=window.initSqlJs;
    window.initSqlJs=()=>boot({locateFile:file=>'/node_modules/sql.js/dist/'+file});
    const api=await import('/assets/js/database.js');
    const status=await api.initializeDatabase();
    return {restored:status.restored,skipped:status.boot_persist_skipped,
      sentinel:api.rows("SELECT species FROM collection_targets WHERE target_id='g265-legacy-sentinel'")[0]?.species};
  });
  assert.equal(restoredAgain.restored,true);
  assert.equal(restoredAgain.skipped,true,'G265_LEGACY_POST_MIGRATION_RELOAD_MUST_BE_STABLE');
  assert.equal(restoredAgain.sentinel,'G265_LEGACY_PLAYER_ROW');
  console.log('PASS G265_BOOTSTRAP_PRODUCTION_EXISTING_MIGRATION_TWO_TAB_STALE_ZERO_SQL_ATOMIC_ACK_PLAYER_SENTINEL_FRESH_RELOAD');


  // G265 #861: real IndexedDB transaction abort during an EXISTING-IMAGE
  // Migration's exact-lease byte save. Inject only the abort, not a fake
  // WebLock/IDB ACK. Native transaction rollback must preserve raw bytes,
  // metadata, monotonic revision and the synthetic player-row sentinel.
  // This is an isolated negative fixture, not a player DB rollback operation.
  const abortFixture=await reader.evaluate(async()=>{
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      const baseline=await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata'],'readonly');
        const bytes=tx.objectStore('database').get('primary');
        const meta=tx.objectStore('metadata').get('primary');
        const revision=tx.objectStore('metadata').get('revision:primary');
        tx.oncomplete=()=>resolve({bytes:bytes.result,meta:meta.result,revision:revision.result});
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      if(!(baseline.bytes instanceof ArrayBuffer)||!Number.isSafeInteger(baseline.revision?.generation))
        throw Error('G265_ABORT_FIXTURE_REQUIRES_ATOMIC_EXISTING_PRIMARY');
      const SQL=await window.initSqlJs();
      const sqlite=new SQL.Database(new Uint8Array(baseline.bytes));
      let bytes;
      try{
        const intact=sqlite.exec('SELECT COUNT(*) FROM schema_migrations WHERE version=11')[0]?.values[0][0];
        const sentinel=sqlite.exec("SELECT species FROM collection_targets WHERE target_id='g265-legacy-sentinel'")[0]?.values[0][0];
        if(intact!==1||sentinel!=='G265_LEGACY_PLAYER_ROW')
          throw Error('G265_ABORT_FIXTURE_PREVIOUS_MIGRATION_NOT_STABLE');
        sqlite.run('DELETE FROM schema_migrations WHERE version=11');
        bytes=sqlite.export();
      }finally{sqlite.close();}
      const raw=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
      const sha=Array.from(digest,n=>n.toString(16).padStart(2,'0')).join('');
      const nextRevision={generation:baseline.revision.generation+1,sha256:sha};
      const nextMeta={...baseline.meta,byte_length:raw.byteLength,updated_at:new Date().toISOString()};
      await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata'],'readwrite');
        tx.objectStore('database').put(raw,'primary');
        tx.objectStore('metadata').put(nextMeta,'primary');
        tx.objectStore('metadata').put(nextRevision,'revision:primary');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      return {revision:nextRevision,bytesLength:raw.byteLength};
    }finally{idb.close();}
  });
  assert.ok(abortFixture.bytesLength>0,'G265_ABORT_FIXTURE_EMPTY_SQLITE');

  const abortedPage=await makeTab();
  await abortedPage.evaluate(async()=>{
    window.__g265AbortedPrimaryPut=false;
    // The native transaction has already acquired its real lease. Abort the
    // first raw primary put in a microtask while IndexedDB is still active:
    // all three atomic writes roll back together via tx.onabort.
    const nativePut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){
      const request=nativePut.apply(this,args);
      if(this.name==='database'&&args[1]==='primary'&&!window.__g265AbortedPrimaryPut){
        window.__g265AbortedPrimaryPut=true;
        const tx=this.transaction;
        queueMicrotask(()=>tx.abort());
      }
      return request;
    };
    const api=await import('/assets/js/database.js');
    window.__g265AbortApi=api;
    window.__g265AbortBootstrap=api.initializeDatabase().then(
      status=>({ok:true,status}),
      error=>({ok:false,code:error?.code||error?.message||String(error)})
    );
  });
  await abortedPage.waitForFunction(()=>window.__bootstrapEngineWaiting===true);
  await abortedPage.evaluate(()=>window.__releaseBootstrapEngine());
  const abortResult=await abortedPage.evaluate(async()=>{
    const outcome=await window.__g265AbortBootstrap;
    const sqlRunsAfterFailure=window.__bootstrapSqlRuns;
    let deniedDirect=null;
    try{window.__g265AbortApi.run('CREATE TABLE g265_unsafe_retry(id INTEGER)');}
    catch(error){deniedDirect=error.code||error.message;}
    let deniedReload=null;
    try{await window.__g265AbortApi.initializeDatabase();}
    catch(error){deniedReload=error.code||error.message;}
    return {outcome,abortObserved:window.__g265AbortedPrimaryPut,
      sqlRunsAfterFailure,sqlRunsAfterRetry:window.__bootstrapSqlRuns,
      deniedDirect,deniedReload};
  });
  assert.equal(abortResult.abortObserved,true,'G265_NATIVE_IDB_ABORT_INJECTION_NOT_REACHED');
  assert.equal(abortResult.outcome.ok,false,'G265_IDB_ABORT_MUST_NOT_ACK');
  assert.equal(abortResult.outcome.code,'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED',
    'G265_IDB_ABORT_MUST_PROPAGATE_PERSIST_UNCERTAIN:'+JSON.stringify(abortResult));
  assert.ok(abortResult.sqlRunsAfterFailure>0,'G265_ABORT_MUST_EXECUTE_REAL_LEGACY_MIGRATION');
  assert.equal(abortResult.deniedDirect,'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED',
    'G265_ABORT_DIRECT_WRITE_STICKY_HOLD');
  assert.equal(abortResult.deniedReload,'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED',
    'G265_ABORT_RETRY_MUST_FAIL_CLOSED');
  assert.equal(abortResult.sqlRunsAfterRetry,abortResult.sqlRunsAfterFailure,
    'G265_ABORT_NO_BLIND_SECOND_MIGRATION_SQL');

  // Independent IDB transaction readback: no partial raw bytes or revision
  // despite the SQL.js in-memory migration having executed before the abort.
  const abortedDurable=await reader.evaluate(async()=>{
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      const image=await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
        const bytes=tx.objectStore('database').get('primary');
        const revision=tx.objectStore('metadata').get('revision:primary');
        const snapshots=tx.objectStore('snapshots').count();
        tx.oncomplete=()=>resolve({bytes:bytes.result,revision:revision.result,snapshots:snapshots.result});
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',image.bytes));
      const sha=Array.from(digest,n=>n.toString(16).padStart(2,'0')).join('');
      const SQL=await window.initSqlJs();
      const db=new SQL.Database(new Uint8Array(image.bytes));
      try{return {sha,revision:image.revision,snapshots:image.snapshots,
        marker:db.exec('SELECT COUNT(*) FROM schema_migrations WHERE version=11')[0]?.values[0][0],
        sentinel:db.exec("SELECT species FROM collection_targets WHERE target_id='g265-legacy-sentinel'")[0]?.values[0][0]};}
      finally{db.close();}
    }finally{idb.close();}
  });
  assert.equal(abortedDurable.sha,abortFixture.revision.sha256,'G265_ABORT_RAW_BYTES_UNCHANGED');
  assert.equal(abortedDurable.revision?.generation,abortFixture.revision.generation,
    'G265_ABORT_ATOMIC_REVISION_UNCHANGED');
  assert.equal(abortedDurable.revision?.sha256,abortFixture.revision.sha256,
    'G265_ABORT_REVISION_SHA_UNCHANGED');
  assert.equal(abortedDurable.marker,0,'G265_ABORT_MIGRATION_MUST_NOT_BE_DURABLE');
  assert.equal(abortedDurable.sentinel,'G265_LEGACY_PLAYER_ROW',
    'G265_ABORT_MUST_PRESERVE_SYNTHETIC_PLAYER_ROW');
  assert.equal(abortedDurable.snapshots,0,'G265_ABORT_MUST_NOT_CREATE_SNAPSHOT');

  const recoveryPage=await context.newPage();pages.push(recoveryPage);
  await recoveryPage.goto(new URL('g265-bootstrap-production-disposable',base).href);
  await recoveryPage.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
  const recovery=await recoveryPage.evaluate(async()=>{
    const boot=window.initSqlJs;
    window.initSqlJs=()=>boot({locateFile:file=>'/node_modules/sql.js/dist/'+file});
    const api=await import('/assets/js/database.js');
    const done=await api.initializeDatabase();
    return {restored:done.restored,skipped:done.boot_persist_skipped,
      marker:api.rows('SELECT COUNT(*) AS n FROM schema_migrations WHERE version=11')[0].n,
      sentinel:api.rows("SELECT species FROM collection_targets WHERE target_id='g265-legacy-sentinel'")[0]?.species};
  });
  assert.equal(recovery.restored,true,'G265_ABORT_FRESH_RELOAD_EXISTING_DB');
  assert.equal(recovery.skipped,false,'G265_ABORT_FRESH_RELOAD_MUST_RETRY_MIGRATION');
  assert.equal(recovery.marker,1,'G265_ABORT_FRESH_RELOAD_MIGRATION_DURABLE_ACK');
  assert.equal(recovery.sentinel,'G265_LEGACY_PLAYER_ROW');
  const recoveredRevision=await reader.evaluate(async()=>{
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{return await new Promise((resolve,reject)=>{
      const tx=idb.transaction('metadata','readonly');
      const req=tx.objectStore('metadata').get('revision:primary');
      tx.oncomplete=()=>resolve(req.result);
      tx.onerror=()=>reject(tx.error);
    });}
    finally{idb.close();}
  });
  assert.equal(recoveredRevision?.generation,abortFixture.revision.generation+1,
    'G265_ABORT_FRESH_RELOAD_EXACT_ONE_DURABLE_MIGRATION_ACK');
  console.log('PASS G265_BOOTSTRAP_NATIVE_EXISTING_MIGRATION_REAL_IDB_ABORT_ATOMIC_ROLLBACK_STICKY_HOLD_FRESH_RECOVERY');


  // G265 #861: separate from native transaction.abort(). A REAL native IDB
  // transaction commits all three stores, but its completion notification is
  // deliberately dropped and translated into an uncertain caller outcome.
  // The injection never fakes a commit, bytes, revision, or Web Lock.
  const lostAckFixture=await reader.evaluate(async()=>{
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      const baseline=await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata'],'readonly');
        const bytes=tx.objectStore('database').get('primary');
        const meta=tx.objectStore('metadata').get('primary');
        const revision=tx.objectStore('metadata').get('revision:primary');
        tx.oncomplete=()=>resolve({bytes:bytes.result,meta:meta.result,revision:revision.result});
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      if(!(baseline.bytes instanceof ArrayBuffer)||!Number.isSafeInteger(baseline.revision?.generation))
        throw Error('G265_ACK_DROP_FIXTURE_REQUIRES_ATOMIC_EXISTING_PRIMARY');
      const SQL=await window.initSqlJs();
      const sqlite=new SQL.Database(new Uint8Array(baseline.bytes));
      let bytes;
      try{
        const intact=sqlite.exec('SELECT COUNT(*) FROM schema_migrations WHERE version=11')[0]?.values[0][0];
        const sentinel=sqlite.exec("SELECT species FROM collection_targets WHERE target_id='g265-legacy-sentinel'")[0]?.values[0][0];
        if(intact!==1||sentinel!=='G265_LEGACY_PLAYER_ROW')
          throw Error('G265_ACK_DROP_FIXTURE_PREVIOUS_MIGRATION_NOT_STABLE');
        sqlite.run('DELETE FROM schema_migrations WHERE version=11');
        bytes=sqlite.export();
      }finally{sqlite.close();}
      const raw=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
      const sha=Array.from(digest,n=>n.toString(16).padStart(2,'0')).join('');
      const nextRevision={generation:baseline.revision.generation+1,sha256:sha};
      const nextMeta={...baseline.meta,byte_length:raw.byteLength,updated_at:new Date().toISOString()};
      await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata'],'readwrite');
        tx.objectStore('database').put(raw,'primary');
        tx.objectStore('metadata').put(nextMeta,'primary');
        tx.objectStore('metadata').put(nextRevision,'revision:primary');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      return {revision:nextRevision,bytesLength:raw.byteLength};
    }finally{idb.close();}
  });

  assert.ok(lostAckFixture.bytesLength>0,'G265_ACK_DROP_FIXTURE_EMPTY_SQLITE');
  const lostAckPage=await makeTab();
  await lostAckPage.evaluate(async()=>{
    window.__g265LostAckObserved=false;
    const nativeTransaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(...args){
      const tx=nativeTransaction.apply(this,args);
      if(args[1]==='readwrite'&&Array.from(args[0]).includes('database')&&!window.__g265LostAckObserved){
        // Preserve the native completion event and durable commit. Replace only
        // the application completion callback, then invoke its error callback
        // to model an ACK channel reporting uncertainty AFTER native commit.
        Object.defineProperty(tx,'oncomplete',{
          configurable:true,
          set(callback){
            if(typeof callback!=='function')throw Error('G265_ACK_DROP_NO_CALLBACK');
            tx.addEventListener('complete',()=>{
              window.__g265LostAckObserved=true;
              if(typeof tx.onerror==='function')tx.onerror();
            },{once:true});
          },get(){return null;}
        });
      }
      return tx;
    };
    const api=await import('/assets/js/database.js');
    window.__g265LostAckApi=api;
    window.__g265LostAckBootstrap=api.initializeDatabase().then(
      status=>({ok:true,status}),
      error=>({ok:false,code:error?.code||error?.message||String(error)})
    );
  });
  await lostAckPage.waitForFunction(()=>window.__bootstrapEngineWaiting===true);
  await lostAckPage.evaluate(()=>window.__releaseBootstrapEngine());
  const lostAckResult=await lostAckPage.evaluate(async()=>{
    const outcome=await window.__g265LostAckBootstrap;
    const sqlBefore=window.__bootstrapSqlRuns;
    let deniedDirect=null,deniedReload=null;
    try{window.__g265LostAckApi.run('CREATE TABLE g265_forbidden_ack_retry(id INTEGER)');}
    catch(error){deniedDirect=error.code||error.message;}
    try{await window.__g265LostAckApi.initializeDatabase();}
    catch(error){deniedReload=error.code||error.message;}
    return {outcome,observed:window.__g265LostAckObserved,sqlBefore,
      sqlAfter:window.__bootstrapSqlRuns,deniedDirect,deniedReload};
  });
  assert.equal(lostAckResult.observed,true,'G265_ACK_DROP_REAL_NATIVE_COMMIT_NOT_REACHED');
  assert.equal(lostAckResult.outcome.ok,false,'G265_ACK_DROP_MUST_NOT_REPORT_SUCCESS');
  assert.equal(lostAckResult.outcome.code,'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED',
    'G265_ACK_DROP_MUST_FAIL_CLOSED:'+JSON.stringify(lostAckResult));
  assert.equal(lostAckResult.deniedDirect,'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(lostAckResult.deniedReload,'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(lostAckResult.sqlAfter,lostAckResult.sqlBefore,'G265_ACK_DROP_NO_BLIND_SQL_RETRY');
  const ackDropDurable=await reader.evaluate(async()=>{
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      const image=await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
        const bytes=tx.objectStore('database').get('primary');
        const revision=tx.objectStore('metadata').get('revision:primary');
        const snapshots=tx.objectStore('snapshots').count();
        tx.oncomplete=()=>resolve({bytes:bytes.result,revision:revision.result,snapshots:snapshots.result});
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',image.bytes));
      const sha=Array.from(digest,n=>n.toString(16).padStart(2,'0')).join('');
      const SQL=await window.initSqlJs();
      const db=new SQL.Database(new Uint8Array(image.bytes));
      try{return {sha,revision:image.revision,snapshots:image.snapshots,
        marker:db.exec('SELECT COUNT(*) FROM schema_migrations WHERE version=11')[0]?.values[0][0],
        sentinel:db.exec("SELECT species FROM collection_targets WHERE target_id='g265-legacy-sentinel'")[0]?.values[0][0]};}
      finally{db.close();}
    }finally{idb.close();}
  });

  assert.equal(ackDropDurable.marker,1,'G265_ACK_DROP_COMMITTED_MIGRATION_MUST_SURVIVE');
  assert.equal(ackDropDurable.sentinel,'G265_LEGACY_PLAYER_ROW');
  assert.equal(ackDropDurable.snapshots,0,'G265_ACK_DROP_NO_SNAPSHOT');
  assert.equal(ackDropDurable.revision?.generation,lostAckFixture.revision.generation+1,
    'G265_ACK_DROP_ONE_REAL_COMMITTED_REVISION');
  assert.equal(ackDropDurable.sha,ackDropDurable.revision?.sha256,
    'G265_ACK_DROP_REAL_BYTES_MATCH_DURABLE_SHA');
  const acknowledgedReload=await makeTab();
  await acknowledgedReload.evaluate(async()=>{
    const api=await import('/assets/js/database.js');
    window.__g265AckReload=api.initializeDatabase();
  });
  await acknowledgedReload.waitForFunction(()=>window.__bootstrapEngineWaiting===true);
  await acknowledgedReload.evaluate(()=>window.__releaseBootstrapEngine());
  const reloadOutcome=await acknowledgedReload.evaluate(async()=>await window.__g265AckReload);
  assert.equal(reloadOutcome.restored,true,'G265_ACK_DROP_RELOAD_EXISTING_IMAGE');
  assert.equal(reloadOutcome.boot_persist_skipped,true,'G265_ACK_DROP_RELOAD_NO_SECOND_PERSIST');

  // Independent readback AFTER the fresh reload: no silent second write,
  // no rollback of the committed migration, and exact durable SHA/revision.
  const reloadDurable=await reader.evaluate(async()=>{
    const idb=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      const image=await new Promise((resolve,reject)=>{
        const tx=idb.transaction(['database','metadata'],'readonly');
        const bytes=tx.objectStore('database').get('primary');
        const revision=tx.objectStore('metadata').get('revision:primary');
        tx.oncomplete=()=>resolve({bytes:bytes.result,revision:revision.result});
        tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',image.bytes));
      const sha=Array.from(digest,n=>n.toString(16).padStart(2,'0')).join('');
      const SQL=await window.initSqlJs();
      const db=new SQL.Database(new Uint8Array(image.bytes));
      try{return {sha,revision:image.revision,
        marker:db.exec('SELECT COUNT(*) FROM schema_migrations WHERE version=11')[0]?.values[0][0],
        sentinel:db.exec("SELECT species FROM collection_targets WHERE target_id='g265-legacy-sentinel'")[0]?.values[0][0]};}
      finally{db.close();}
    }finally{idb.close();}
  });
  assert.deepEqual(reloadDurable.revision,ackDropDurable.revision,
    'G265_ACK_DROP_RELOAD_MUST_NOT_ADVANCE_DURABLE_REVISION');
  assert.equal(reloadDurable.sha,ackDropDurable.sha,
    'G265_ACK_DROP_RELOAD_MUST_PRESERVE_COMMITTED_SHA');
  assert.equal(reloadDurable.marker,1,'G265_ACK_DROP_RELOAD_MIGRATION_MARKER_PRESERVED');
  assert.equal(reloadDurable.sentinel,'G265_LEGACY_PLAYER_ROW',
    'G265_ACK_DROP_RELOAD_PLAYER_SENTINEL_PRESERVED');

  console.log('PASS G265_BOOTSTRAP_NATIVE_POSTCOMMIT_LOST_ACK_STICKY_HOLD_DURABLE_READBACK');

  console.log('PASS G265_BOOTSTRAP_PRODUCTION_NATIVE_FIRST_INSTALL_TWO_TAB_STALE_ZERO_SQL_ATOMIC_ACK_FRESH_RELOAD');
}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await context.close();
  await browser.close();
}