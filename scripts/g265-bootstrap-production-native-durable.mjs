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
  console.log('PASS G265_BOOTSTRAP_PRODUCTION_NATIVE_FIRST_INSTALL_TWO_TAB_STALE_ZERO_SQL_ATOMIC_ACK_FRESH_RELOAD');
}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await context.close();
  await browser.close();
}