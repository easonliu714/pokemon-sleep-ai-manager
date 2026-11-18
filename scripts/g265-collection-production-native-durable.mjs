// G265 #861 — actual production Collection Target writer, not an opt-in adapter.
// Two real Chromium tabs, native Web Locks, production storage.js/database.js,
// IndexedDB primary revision + SHA CAS and independent SQL.js readback.
// Only disposable localhost / incognito browser state: never a player database.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const tabs=[];
try{
  await context.route('**/g265-collection-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><html><head><title>G265 disposable collection</title></head><body><nav><button data-view="guide">Guide</button></nav><main></main></body></html>'
  }));
  async function newTab(){
    const page=await context.newPage();tabs.push(page);
    await page.goto(new URL('g265-collection-production-disposable',base).href);
    await page.addScriptTag({url:new URL('node_modules/sql.js/dist/sql-wasm.js',base).href});
    await page.evaluate(async()=>{
      const boot=window.initSqlJs;
      if(typeof boot!=='function')throw new Error('G265_SQLJS_BROWSER_RUNTIME_MISSING');
      window.initSqlJs=()=>boot({locateFile:file=>'/node_modules/sql.js/dist/'+file});
      window.__g265Database=await import('/assets/js/database.js');
      await window.__g265Database.initializeDatabase();
      const module=await import('/assets/js/g3-planning.js');
      module.setupG3Pages();
      if(typeof document.getElementById('collectionAddForm')?.onsubmit!=='function')
        throw new Error('G265_PRODUCTION_FORM_HANDLER_NOT_INSTALLED');
    });
    return page;
  }
  async function inspect(page){
    return page.evaluate(async()=>{
      const idb=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('pokemon_sleep_ai_manager');
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      try{
        const result=await new Promise((resolve,reject)=>{
          const tx=idb.transaction(['database','metadata','snapshots'],'readonly');
          const bytes=tx.objectStore('database').get('primary');
          const revision=tx.objectStore('metadata').get('revision:primary');
          const snapshotCount=tx.objectStore('snapshots').count();
          tx.oncomplete=()=>resolve({bytes:bytes.result,revision:revision.result,snapshotCount:snapshotCount.result});
          tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        if(!(result.bytes instanceof ArrayBuffer))throw new Error('G265_PRIMARY_ARRAYBUFFER_MISSING');
        const bytes=new Uint8Array(result.bytes);
        const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
        const hash=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
        return {revision:result.revision,hash,snapshotCount:result.snapshotCount,
          rawBytes:Array.from(bytes),
          loadedRows:window.__g265Database.rows('SELECT target_id,species FROM collection_targets ORDER BY target_id')};
      }finally{idb.close();}
    });
  }
  async function submit(page,species){
    return page.evaluate(async value=>{
      const form=document.getElementById('collectionAddForm');
      form.elements.namedItem('species').value=value;
      try{
        await form.onsubmit({preventDefault(){},target:form});
        return {ok:true,rows:window.__g265Database.rows('SELECT target_id,species FROM collection_targets ORDER BY target_id')};
      }catch(error){
        return {ok:false,code:error?.code||error?.message||String(error),
          rows:window.__g265Database.rows('SELECT target_id,species FROM collection_targets ORDER BY target_id')};
      }
    },species);
  }
  const writer=await newTab();
  const stale=await newTab();
  // A separate, UI-free production storage binding proves native stale CAS
  // even if an unrelated page-local sticky guard rejects the UI earlier.
  const nativeProbe=await context.newPage();tabs.push(nativeProbe);
  await nativeProbe.goto(new URL('g265-collection-production-disposable',base).href);
  await nativeProbe.evaluate(async()=>{
    window.__g265Storage=await import('/assets/js/storage.js');
    await window.__g265Storage.loadDatabaseBytes();
  });
  // Diagnose the exact durable revision after each tab's boot, without assuming
  // that separate asynchronous initialization paths share one generation.
  // This is an observation-only probe: no synthetic write or retry is allowed.
  const before=await inspect(writer);
  const staleBefore=await inspect(stale);
  const nativeBefore=await inspect(nativeProbe);
  const revisionEvidence={
    writer:{generation:before.revision?.generation,revisionSha:before.revision?.sha256,bytesSha:before.hash,loadedRows:before.loadedRows.length},
    stale:{generation:staleBefore.revision?.generation,revisionSha:staleBefore.revision?.sha256,bytesSha:staleBefore.hash,loadedRows:staleBefore.loadedRows.length},
    probe:{generation:nativeBefore.revision?.generation,revisionSha:nativeBefore.revision?.sha256,bytesSha:nativeBefore.hash,loadedRows:nativeBefore.loadedRows.length}
  };
  console.log('G265_INITIAL_DURABLE_ATOMIC_REVISION_EVIDENCE',JSON.stringify(revisionEvidence));
  assert.equal(before.hash,before.revision?.sha256,'G265_INIT_PRIMARY_RAW_REVISION_SHA');
  assert.equal(staleBefore.hash,staleBefore.revision?.sha256,'G265_STALE_INIT_PRIMARY_RAW_REVISION_SHA');
  assert.equal(nativeBefore.hash,nativeBefore.revision?.sha256,'G265_PROBE_INIT_PRIMARY_RAW_REVISION_SHA');
  assert.equal(staleBefore.revision?.generation,before.revision.generation,
    'G265_INITIAL_REVISION_MISMATCH:'+JSON.stringify(revisionEvidence));
  assert.equal(staleBefore.hash,before.hash);
  const accepted=await submit(writer,'SYNTHETIC_G265_ACK');
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  assert.equal(accepted.rows.length,before.loadedRows.length+1);
  const committed=await inspect(writer);
  assert.equal(committed.hash,committed.revision?.sha256,'G265_POST_ACK_NATIVE_SHA_READBACK');
  assert.equal(committed.revision.generation,before.revision.generation+1,'G265_MONOTONIC_REVISION_ACK');
  assert.equal(committed.loadedRows.length,before.loadedRows.length+1);
  assert.equal(committed.snapshotCount,before.snapshotCount+1,'G265_ONE_ACK_SNAPSHOT');
  const nativeStale=await nativeProbe.evaluate(async()=>{
    try{await window.__g265Storage.withPrimarySqliteMutationLock(async()=>{
      throw Error('G265_UNEXPECTED_NATIVE_LEASE_GRANT');
    });return 'G265_UNEXPECTED_NATIVE_LEASE_GRANT';}
    catch(error){return error.code||error.message;}
  });
  assert.equal(nativeStale,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED',
    'G265_REAL_STORAGE_NATIVE_STALE_REVISION_MUST_REFUSE_LEASE');
  console.log('PASS G265_COLLECTION_REAL_STORAGE_NATIVE_CAS_STALE_REVISION_REJECTED');
  // A separate SQL.js connection must independently read the acknowledged IDB bytes.
  const durableDb=new SQL.Database(Uint8Array.from(committed.rawBytes));
  const durableRows=durableDb.exec('SELECT species FROM collection_targets ORDER BY species')?.[0]?.values||[];
  durableDb.close();
  assert.ok(durableRows.some(r=>r[0]==='SYNTHETIC_G265_ACK'),'G265_DURABLE_SQLJS_READBACK_ROW');
  console.log('PASS G265_COLLECTION_PRODUCTION_NATIVE_WRITER_ACK_AND_IDB_SHA_REVISION');
  // Stale loaded DB may not snapshot, BEGIN SQL or overwrite a later durable image.
  const rejected=await submit(stale,'SYNTHETIC_G265_STALE');
  assert.equal(rejected.ok,false,'G265_STALE_PRODUCTION_HANDLER_MUST_REJECT');
  // The actual page must deny before SQL. A prior independent uncertain
  // page-local writer can refuse even earlier than native revision admission;
  // the UI-free real storage probe above must independently prove stale CAS.
  assert.ok(['SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED',
    'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED'].includes(rejected.code),
    'G265_PRODUCTION_STALE_PRE_SQL_DENIAL:'+rejected.code);
  assert.deepEqual(rejected.rows,staleBefore.loadedRows,'G265_STALE_LOADED_SQLITE_MUST_BE_UNTOUCHED');
  const afterDenied=await inspect(stale);
  assert.equal(afterDenied.revision.generation,committed.revision.generation);
  assert.equal(afterDenied.hash,committed.hash);
  assert.equal(afterDenied.snapshotCount,committed.snapshotCount,'G265_STALE_MUST_NOT_SNAPSHOT');
  assert.deepEqual(afterDenied.rawBytes,committed.rawBytes,'G265_STALE_MUST_NOT_OVERWRITE_IDB_PRIMARY');
  const retry=await submit(stale,'SYNTHETIC_G265_BLIND_RETRY');
  assert.equal(retry.ok,false,'G265_STALE_MUST_HOLD_NO_BLIND_RETRY');
  assert.ok(['SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED','SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED'].includes(retry.code),retry.code);
  const afterRetry=await inspect(stale);
  assert.equal(afterRetry.hash,committed.hash);
  assert.equal(afterRetry.snapshotCount,committed.snapshotCount);
  console.log('PASS G265_COLLECTION_PRODUCTION_STALE_PRE_SQL_ZERO_SNAPSHOT_PERSIST_STICKY');
  const fresh=await newTab();
  const independentlyLoaded=await inspect(fresh);
  assert.equal(independentlyLoaded.hash,committed.hash);
  assert.equal(independentlyLoaded.revision.generation,committed.revision.generation);
  assert.ok(independentlyLoaded.loadedRows.some(r=>r.species==='SYNTHETIC_G265_ACK'));
  assert.ok(!independentlyLoaded.loadedRows.some(r=>r.species==='SYNTHETIC_G265_STALE'));
  console.log('PASS G265_COLLECTION_PRODUCTION_NATIVE_TWO_TAB_CAS_DURABLE_FRESH_RELOAD');
}finally{
  await Promise.all(tabs.map(p=>p.close().catch(()=>{})));
  await browser.close();
}
