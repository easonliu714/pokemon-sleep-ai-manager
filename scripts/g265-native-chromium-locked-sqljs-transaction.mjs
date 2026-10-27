import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

// Two disposable Chromium tabs with real native Web Locks, IndexedDB and
// browser SQL.js/WASM. No deployed origin, player SQLite or PWA runtime wiring.
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs(),db=new SQL.Database();
db.run('CREATE TABLE g265_inlock(id TEXT PRIMARY KEY)');
db.run("INSERT INTO g265_inlock(id) VALUES('seed')");
const seed=Array.from(db.export());db.close();
const digest=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
try{
  await context.route('**/g265-locked-sqljs-blank',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><title>G265 isolated SQL.js lock transaction</title>'
  }));
  await context.route('**/g265-locked-sqljs-bundle.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-locked-sqljs.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const pages=[await context.newPage(),await context.newPage()];
  for(const page of pages){
    await page.goto(new URL('g265-locked-sqljs-blank',base).href);
    await page.addScriptTag({url:new URL('g265-locked-sqljs-bundle.js',base).href});
    await page.evaluate(async()=>{
      if(typeof window.initSqlJs!=='function')throw Error('BROWSER_SQLJS_BUNDLE_UNAVAILABLE');
      const SQL=await window.initSqlJs({locateFile:()=>'/g265-locked-sqljs.wasm'});
      const storage=await import('/assets/js/storage.js');
      const {createSqliteVersionNeutralAtomicPairGate}=await import(
        '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
      const {createSqliteFreshDurableTransactionAdapter}=await import(
        '/assets/js/sqlite-fresh-durable-transaction-adapter.js');
      const open=()=>new Promise((resolve,reject)=>{
        const req=indexedDB.open('pokemon_sleep_ai_manager');
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      window.__g265={SQL,storage,open,createSqliteVersionNeutralAtomicPairGate,
        createSqliteFreshDurableTransactionAdapter,mutationCount:0};
    });
  }
  await pages[0].evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await pages[0].evaluate(async sha=>{
    const state=window.__g265,db=await state.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation:0,sha256:sha},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },digest(seed));
  for(const page of pages)await page.evaluate(async()=>{
    const v=window.__g265;v.db=await v.open();
    v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    v.adapter=v.createSqliteFreshDurableTransactionAdapter({
      pairGate:v.pair,openSqlite:bytes=>new v.SQL.Database(bytes)
    });
  });
  const race=await Promise.all(pages.map((page,index)=>page.evaluate(async arg=>{
    const v=window.__g265;
    try{return await v.adapter.execute({
      reason:'g265-locked-sqljs-race',
      expectedGeneration:0,expectedFingerprint:arg.sha,
      mutate:sql=>{
        v.mutationCount++;
        sql.run('INSERT INTO g265_inlock(id) VALUES(?)',[arg.id]);
      }
    });}catch(error){return {code:error.code};}
  },{sha:digest(seed),id:index===0?'A':'B'})));
  assert.equal(race.filter(x=>x.status==='PERSISTED').length,1);
  assert.equal(race.filter(x=>x.code==='G265_PAIR_STALE_RELOAD_REQUIRED').length,1);
  const mutationCounts=await Promise.all(pages.map(p=>p.evaluate(()=>window.__g265.mutationCount)));
  assert.equal(mutationCounts.reduce((x,y)=>x+y,0),1,'stale writer must not open/mutate SQL.js');
  console.log('PASS G265_LOCKED_SQLJS_NATIVE_TWO_TAB_ONE_WINNER_STALE_NEVER_MUTATES');
  const fresh=await pages[0].evaluate(async()=>{
    const v=window.__g265;
    const pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    const before=await pair.readVerified();
    const adapter=v.createSqliteFreshDurableTransactionAdapter({
      pairGate:pair,openSqlite:bytes=>new v.SQL.Database(bytes)
    });
    const completed=await adapter.execute({
      reason:'g265-locked-sqljs-second',
      expectedGeneration:before.generation,expectedFingerprint:before.sha256,
      mutate:(sql,latest)=>{
        if(latest.generation!==1||latest.sha256!==before.sha256)
          throw Error('SQLJS_DURABLE_BASE_NOT_FRESH');
        const current=sql.exec('SELECT id FROM g265_inlock ORDER BY id')[0].values.map(x=>x[0]);
        if(current.length!==2||current[0]!=='seed'&&current[1]!=='seed')
          throw Error('SQLJS_MISSING_ACKNOWLEDGED_ROW');
        sql.run('INSERT INTO g265_inlock(id) VALUES(?)',[current.includes('A')?'B':'A']);
      }
    });
    return {status:completed.status,generation:completed.generation,sha256:completed.sha256};
  });
  assert.equal(fresh.status,'PERSISTED');assert.equal(fresh.generation,2);
  const persisted=await pages[1].evaluate(async()=>{
    const v=window.__g265,pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    const verified=await pair.readVerified(),raw=await v.storage.loadDatabaseBytes();
    return {generation:verified.generation,sha256:verified.sha256,bytes:Array.from(verified.bytes),
      rawIsBuffer:raw instanceof ArrayBuffer};
  });
  assert.equal(persisted.generation,2);
  assert.equal(persisted.sha256,digest(persisted.bytes));
  assert.equal(persisted.rawIsBuffer,true);
  const reloaded=new SQL.Database(Uint8Array.from(persisted.bytes));
  const names=reloaded.exec('SELECT id FROM g265_inlock ORDER BY id')[0].values.map(x=>x[0]);
  reloaded.close();assert.deepEqual(names,['A','B','seed']);
  console.log('PASS G265_LOCKED_SQLJS_FRESH_DURABLE_BEGIN_COMMIT_ATOMIC_PAIR_READBACK');
  const denied=await pages[0].evaluate(async before=>{
    const v=window.__g265,pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    const adapter=v.createSqliteFreshDurableTransactionAdapter({
      pairGate:pair,openSqlite:bytes=>new v.SQL.Database(bytes)
    });
    let code=null;
    try{await adapter.execute({
      reason:'g265-async-mutation-negative',
      expectedGeneration:before.generation,expectedFingerprint:before.sha256,
      mutate:()=>Promise.resolve('unsafe')
    });}catch(error){code=error.code;}
    return {code,status:adapter.status().status};
  },persisted);
  assert.equal(denied.code,'G265_SQLJS_ASYNC_MUTATION_FORBIDDEN');
  assert.equal(denied.status,'UNVERIFIED_RELOAD_REQUIRED');
  const readAfter=await pages[1].evaluate(async()=>{
    const v=window.__g265,pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    const verified=await pair.readVerified();
    return {generation:verified.generation,sha256:verified.sha256};
  });
  assert.equal(readAfter.generation,2);assert.equal(readAfter.sha256,persisted.sha256);
  console.log('PASS G265_LOCKED_SQLJS_ASYNC_ROLLBACK_STICKY_HOLD_NO_DURABLE_WRITE');
  console.log('HOLD G265_PRODUCTION_23_LEGACY_WRITERS_SNAPSHOT_ANDROID_UAT');
  for(const page of pages)await page.evaluate(()=>{
    window.__g265.db.close();window.__g265.storage.closeStorageConnection();
  });
}finally{await context.close();await browser.close();}
