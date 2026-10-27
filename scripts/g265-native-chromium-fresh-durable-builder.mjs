import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

// G265 opt-in source Gate. Disposable same-origin Chromium storage, not player data.
// The next SQLite image is selected by a SYNCHRONOUS callback after the locked
// durable generation/digest has been checked. No production writer uses this API.
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const make=ids=>{
  const db=new SQL.Database();
  db.run('CREATE TABLE g265_fresh(id TEXT PRIMARY KEY)');
  for(const id of ids)db.run('INSERT INTO g265_fresh(id) VALUES(?)',[id]);
  const bytes=Array.from(db.export());db.close();return bytes;
};
const seed=make(['seed']),aOnly=make(['seed','A']),bOnly=make(['seed','B']);
const both=make(['seed','A','B']);
const digest=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
try{
  await context.route('**/g265-fresh-durable-fixture',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 fresh durable builder fixture</title>'
  }));
  const pages=[await context.newPage(),await context.newPage()];
  for(const page of pages){
    await page.goto(new URL('g265-fresh-durable-fixture',base).href);
    await page.evaluate(async()=>{
      const storage=await import('/assets/js/storage.js');
      const {createSqliteVersionNeutralAtomicPairGate}=await import(
        '/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
      const open=()=>new Promise((resolve,reject)=>{
        const req=indexedDB.open('pokemon_sleep_ai_manager');
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      window.__fresh={storage,open,createSqliteVersionNeutralAtomicPairGate,calls:0};
    });
  }
  await pages[0].evaluate(bytes=>window.__fresh.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await pages[0].evaluate(async hash=>{
    const db=await window.__fresh.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation:0,sha256:hash},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },digest(seed));
  for(const page of pages)await page.evaluate(async()=>{
    const v=window.__fresh;v.db=await v.open();
    v.gate=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
  });
  const initial={generation:0,sha:digest(seed)};
  const race=await Promise.all(pages.map((page,index)=>page.evaluate(async arg=>{
    const v=window.__fresh;
    try{
      return await v.gate.write({
        reason:'g265-fresh-builder-race',
        expectedGeneration:arg.generation,expectedFingerprint:arg.sha,
        buildNextBytes:before=>{
          v.calls++;
          if(before.generation!==arg.generation||before.sha256!==arg.sha
            ||!(before.bytes instanceof Uint8Array))throw Error('NOT_LATEST_DURABLE');
          return Uint8Array.from(arg.next);
        }
      });
    }catch(error){return {code:error.code,status:v.gate.status().status};}
  },{...initial,next:index===0?aOnly:bOnly})));
  assert.equal(race.filter(x=>x.status==='PERSISTED').length,1);
  assert.equal(race.filter(x=>x.code==='G265_PAIR_STALE_RELOAD_REQUIRED').length,1);
  const calls=await Promise.all(pages.map(page=>page.evaluate(()=>window.__fresh.calls)));
  assert.equal(calls.reduce((x,y)=>x+y,0),1,'stale tab may not invoke builder');
  console.log('PASS G265_FRESH_BUILDER_NATIVE_TWO_TAB_STALE_REJECT_BEFORE_MUTATION');
  const loaded=await pages[0].evaluate(async()=>{
    const v=window.__fresh;
    const fresh=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    const before=await fresh.readVerified();
    return {generation:before.generation,sha256:before.sha256,bytes:Array.from(before.bytes)};
  });
  const first=loaded.bytes;
  assert.equal(loaded.generation,1);
  assert.ok([digest(aOnly),digest(bOnly)].includes(digest(first)));
  const updated=await pages[0].evaluate(async arg=>{
    const v=window.__fresh;
    const fresh=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    const result=await fresh.write({
      reason:'g265-fresh-builder-second',
      expectedGeneration:arg.generation,expectedFingerprint:arg.sha,
      buildNextBytes:before=>{
        v.calls++;
        if(before.sha256!==arg.sha||before.generation!==arg.generation
          ||before.bytes[0]!==0x53)throw Error('BAD_SQLITE_BASE');
        return Uint8Array.from(arg.next);
      }
    });
    return {status:result.status,generation:result.generation,sha256:result.sha256};
  },{generation:loaded.generation,sha:loaded.sha256,next:both});
  assert.equal(updated.status,'PERSISTED');
  assert.equal(updated.generation,2);
  assert.equal(updated.sha256,digest(both));
  const reloaded=await pages[1].evaluate(async()=>{
    const v=window.__fresh;
    const gate=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    const verified=await gate.readVerified();
    const raw=await v.storage.loadDatabaseBytes();
    return {bytes:Array.from(verified.bytes),rawIsBuffer:raw instanceof ArrayBuffer,
      generation:verified.generation,sha256:verified.sha256};
  });
  assert.equal(reloaded.generation,2);
  assert.equal(reloaded.sha256,digest(reloaded.bytes));
  assert.equal(reloaded.sha256,digest(both));
  assert.equal(reloaded.rawIsBuffer,true,'boot raw ArrayBuffer remains compatible');
  const sql=new SQL.Database(Uint8Array.from(reloaded.bytes));
  const names=sql.exec('SELECT id FROM g265_fresh ORDER BY id')[0].values.map(row=>row[0]);
  sql.close();
  assert.deepEqual(names,['A','B','seed']);
  console.log('PASS G265_FRESH_BUILDER_LOCKED_LATEST_DURABLE_SQLITE_PAIR_RELOAD');
  const rejection=await pages[0].evaluate(async arg=>{
    const v=window.__fresh;
    const gate=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
    let code=null;
    try{await gate.write({
      reason:'g265-async-builder-prohibited',expectedGeneration:arg.generation,
      expectedFingerprint:arg.sha,
      buildNextBytes:()=>Promise.resolve(Uint8Array.from(arg.next))
    });}catch(error){code=error.code;}
    return {code,status:gate.status().status};
  },{generation:2,sha:digest(both),next:both});
  assert.equal(rejection.code,'G265_PAIR_ASYNC_BUILDER_FORBIDDEN');
  assert.equal(rejection.status,'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_FRESH_BUILDER_ASYNC_CALLBACK_FAIL_CLOSED_NO_ACK');
  for(const page of pages)await page.evaluate(()=>{
    window.__fresh.db.close();window.__fresh.storage.closeStorageConnection();
  });
  console.log('HOLD G265_23_LEGACY_WRITERS_PRODUCTION_WIRING_NAMED_DRAFT_ANDROID');
}finally{await context.close();await browser.close();}
