// G265 one named production entry: real native Chromium two-tab pre-SQL
// lock admission on disposable origin, never deployed site/player data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const fixture=new SQL.Database();
fixture.run('CREATE TABLE pokemon (pokemon_id TEXT PRIMARY KEY,rating TEXT)');
fixture.run("INSERT INTO pokemon VALUES('seed','S')");
const seed=Array.from(fixture.export());
fixture.run("INSERT INTO pokemon VALUES('A','A+')");
const aBytes=Array.from(fixture.export());
fixture.close();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
let a,b;
try{
  await context.route('**/g265-manual-pokemon-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable manual Pokémon</title>'
  }));
  a=await context.newPage();b=await context.newPage();
  for(const page of [a,b]){
    await page.goto(new URL('g265-manual-pokemon-disposable',base).href);
    await page.evaluate(async()=>{
      window.__g265={storage:await import('/assets/js/storage.js'),sqlCalls:0};
    });
  }
  await a.evaluate(async bytes=>{
    await window.__g265.storage.loadDatabaseBytes();
    await window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes));
    await window.__g265.storage.loadDatabaseBytes();
  },seed);
  await b.evaluate(()=>window.__g265.storage.loadDatabaseBytes());
  await a.evaluate(bytes=>{
    let ready;
    window.__g265.ready=new Promise(resolve=>{ready=resolve;});
    window.__g265.operation=window.__g265.storage.withPrimarySqliteMutationLock(async lease=>{
      ready();
      await new Promise(resolve=>{window.__g265.release=resolve;});
      window.__g265.sqlCalls++;
      await window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes),{primaryMutationLease:lease});
      return 'ACK';
    });
    window.__g265.operation.catch(()=>{});
  },aBytes);
  await a.evaluate(()=>window.__g265.ready);
  await b.evaluate(()=>{
    window.__g265.operation=window.__g265.storage.withPrimarySqliteMutationLock(async()=>{
      window.__g265.sqlCalls++;
      return 'UNSAFE_SQL';
    }).then(x=>x,e=>e.code);
  });
  await b.waitForFunction(async()=>{
    const q=await navigator.locks.query();
    return q.pending.some(x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
  },null,{timeout:5000});
  assert.equal(await b.evaluate(()=>window.__g265.sqlCalls),0);
  assert.equal(await a.evaluate(async()=>{
    window.__g265.release();
    return window.__g265.operation;
  }),'ACK');
  assert.equal(await b.evaluate(()=>window.__g265.operation),
    'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await b.evaluate(()=>window.__g265.sqlCalls),0);
  const durable=await a.evaluate(async()=>Array.from(new Uint8Array(
    await window.__g265.storage.loadDatabaseBytes())));
  const verify=new SQL.Database(Uint8Array.from(durable));
  assert.deepEqual(verify.exec('SELECT pokemon_id,rating FROM pokemon ORDER BY pokemon_id')[0].values,
    [['A','A+'],['seed','S']]);
  verify.close();
  console.log('PASS G265_NATIVE_MANUAL_POKEMON_HELD_LOCK_B_QUEUED_STALE_PRE_SQL_NO_ROW_LOSS');
  assert.equal(await b.evaluate(()=>window.__g265.storage.withPrimarySqliteMutationLock(
    async()=>{window.__g265.sqlCalls++;}).then(()=>null,e=>e.code)),
    'SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await b.evaluate(()=>window.__g265.sqlCalls),0);
  const ack=await a.evaluate(async()=>{
    try{
      await window.__g265.storage.withPrimarySqliteMutationLock(async lease=>{
        await window.__g265.storage.saveDatabaseBytes(
          new Uint8Array(await window.__g265.storage.loadDatabaseBytes()),
          {primaryMutationLease:lease});
        throw Object.assign(Error('synthetic ACK ambiguity'),{code:'SYNTHETIC_ACK_LOSS'});
      });
      return 'UNSAFE';
    }catch(e){return e.code;}
  });
  assert.equal(ack,'SYNTHETIC_ACK_LOSS');
  assert.equal(await a.evaluate(()=>window.__g265.storage.withPrimarySqliteMutationLock(
    async()=>{}).then(()=>null,e=>e.code)),
    'SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_NATIVE_MANUAL_POKEMON_POST_ACK_AMBIGUITY_STICKY_HOLD');
  // New isolated tab, fresh read: mutation callback throws before save, so
  // rollback leaves the durable SQLite image untouched; no blind retry.
  const c=await context.newPage();
  try{
    await c.goto(new URL('g265-manual-pokemon-disposable',base).href);
    await c.evaluate(async()=>{window.storage=await import('/assets/js/storage.js');
      await window.storage.loadDatabaseBytes();});
    const failure=await c.evaluate(()=>window.storage.withPrimarySqliteMutationLock(
      async()=>{throw Object.assign(Error('synthetic SQL rollback'),{code:'SYNTHETIC_SQL_ROLLBACK'});}
    ).then(()=>null,e=>e.code));
    assert.equal(failure,'SYNTHETIC_SQL_ROLLBACK');
    const after=await c.evaluate(async()=>Array.from(new Uint8Array(await window.storage.loadDatabaseBytes())));
    assert.deepEqual(after,durable);
    console.log('PASS G265_NATIVE_MANUAL_POKEMON_PRE_SAVE_ROLLBACK_NO_DURABLE_DELTA');
  }finally{await c.close();}
  console.log('HOLD G265_REMAINING_LEGACY_WRITERS_ANDROID_OWNER_UAT');
}finally{
  for(const page of [a,b])if(page&&!page.isClosed())try{await page.evaluate(
    ()=>window.__g265?.storage?.closeStorageConnection?.());}catch{}
  await context.close();await browser.close();
}
