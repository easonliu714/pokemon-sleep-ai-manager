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

  console.log('PASS G265_BOOTSTRAP_PRODUCTION_NATIVE_FIRST_INSTALL_TWO_TAB_STALE_ZERO_SQL_ATOMIC_ACK_FRESH_RELOAD');
}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await context.close();
  await browser.close();
}