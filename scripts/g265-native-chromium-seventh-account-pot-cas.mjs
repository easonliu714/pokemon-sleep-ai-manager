// G265 seventh legacy account pot: isolated native Chromium two-tab CAS/recovery.
// Disposable loopback origin, native Web Locks/IndexedDB and real SQL.js/WASM.
// No player database, production writer admission, service worker or migration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const legacy=fs.readFileSync(new URL('../assets/js/weekly-context-ui-bridge.js',import.meta.url),'utf8');
const exact=legacy.split('async function saveAccountPotCapacity(edit){')[1]
  ?.split('async function saveFallback(')[0];
const helper=legacy.split('function writeAccountPotCapacity(capacity,source=')[1]
  ?.split('async function saveAccountPotCapacity(')[0];
assert.ok(exact&&helper,'seventh exact legacy writer must remain source-bound');
assert.match(exact,/await snapshot\(/);
assert.match(exact,/await persist\(\)/);
assert.match(helper,/INSERT INTO account_capacity/);
assert.doesNotMatch(legacy,/sqlite-account-pot-capacity-optin/);

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE account_capacity(capacity_key TEXT PRIMARY KEY,total_capacity INTEGER NOT NULL,used_count INTEGER,updated_at TEXT NOT NULL,source TEXT)');
seedDb.run("INSERT INTO account_capacity VALUES('pot',30,7,'2026-10-29T00:00:00.000Z','SYNTHETIC_SEED')");
seedDb.run("INSERT INTO account_capacity VALUES('unrelated',123,2,'2026-10-29T00:00:00.000Z','SYNTHETIC_SEED')");
seedDb.run("CREATE TRIGGER deny_native_pot_update BEFORE UPDATE ON account_capacity WHEN NEW.capacity_key='pot' AND NEW.total_capacity=99 BEGIN SELECT RAISE(ABORT,'native-pot-update-rejection'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const digest=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const seedHash=digest(seed);
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
async function newTab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(new URL('g265-pot-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-pot-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createAccountPotCapacityOptIn}=await import('/assets/js/sqlite-account-pot-capacity-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-pot-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createAccountPotCapacityOptIn,opened:0,db:null,pair:null,writer:null};
    window.__g265.reset=()=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      v.writer=v.createAccountPotCapacityOptIn({pairGate:v.pair,
        openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}});
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const input=(capacity,previous,expectedGeneration,expectedFingerprint,
  updatedAt='2026-10-29T10:00:00.000Z')=>({
  capacity,source:'MANUAL_WEEKLY_CONTEXT_UI',updatedAt,
  expectedPreviousCapacity:previous,expectedGeneration,expectedFingerprint
});
const run=(page,payload)=>page.evaluate(async data=>{
  try{return {ok:true,result:await window.__g265.writer.execute(data)};}
  catch(error){return {ok:false,code:error.code||error.message};}
},payload);
const inspect=page=>page.evaluate(async()=>{
  const v=window.__g265;
  const current=await v.pair.readVerified();
  const sql=new v.SQL.Database(current.bytes);
  try{return {generation:current.generation,sha256:current.sha256,
    bytes:Array.from(current.bytes),
    records:sql.exec('SELECT capacity_key,total_capacity,used_count,updated_at,source FROM account_capacity ORDER BY capacity_key')?.[0]?.values||[]};
  }finally{sql.close();}
});
const pot=state=>state.records.find(row=>row[0]==='pot');
const unrelated=state=>state.records.find(row=>row[0]==='unrelated');
try{
  await context.route('**/g265-pot-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable pot</title>'
  }));
  await context.route('**/g265-pot-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-pot-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await newTab(),b=await newTab();
  await a.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(async sha256=>{
    const db=await window.__g265.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation:0,sha256},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },seedHash);
  for(const page of [a,b])await page.evaluate(async()=>{
    window.__g265.db=await window.__g265.open();window.__g265.reset();
  });

  // Two independent Chromium tabs contend for one durable generation.
  // The losing writer must fail before opening SQL.js, not merely at ACK.
  const race=await Promise.all([
    run(a,input(55,30,0,seedHash)),
    run(b,input(70,30,0,seedHash))
  ]);
  assert.equal(race.filter(x=>x.ok).length,1,JSON.stringify(race));
  assert.equal(race.filter(x=>!x.ok)[0].code,'G265_PAIR_STALE_RELOAD_REQUIRED');
  const winnerValue=race[0].ok?55:70;
  const active=race[0].ok?a:b,loser=race[0].ok?b:a;
  assert.equal(await loser.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await loser.evaluate(()=>window.__g265.opened),0,
    'stale contender must not open SQL.js');
  const first=await inspect(active);
  assert.equal(first.generation,1);
  assert.equal(first.sha256,digest(first.bytes));
  assert.equal(pot(first)[1],winnerValue);
  assert.equal(pot(first)[2],7);
  assert.deepEqual(unrelated(first),['unrelated',123,2,'2026-10-29T00:00:00.000Z','SYNTHETIC_SEED']);
  console.log('PASS G265_SEVENTH_NATIVE_TWO_TAB_ONE_ACK_STALE_ZERO_SQLJS');

  // Explicit latest durable reload permits a new ACK without losing used_count.
  await loser.evaluate(()=>window.__g265.reset());
  const second=await run(loser,input(80,winnerValue,1,first.sha256,
    '2026-10-29T10:01:00.000Z'));
  assert.equal(second.ok,true,JSON.stringify(second));
  assert.equal(second.result.generation,2);
  const after=await inspect(loser);
  assert.equal(after.generation,2);
  assert.equal(after.sha256,digest(after.bytes));
  assert.equal(pot(after)[1],80);
  assert.equal(pot(after)[2],7);
  assert.deepEqual(unrelated(after),unrelated(first));
  console.log('PASS G265_SEVENTH_NATIVE_FRESH_RELOAD_POT_USED_COUNT_UNRELATED_PRESERVED');

  // ACK may be lost after a tab closes. A fresh tab reads generation 2 and
  // rejects an old generation-1 replay before any SQL.js open.
  await loser.evaluate(()=>window.__g265.db.close());
  await loser.close();
  const c=await newTab();
  await c.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const reloaded=await inspect(c);
  assert.deepEqual(reloaded,after);
  const openedBefore=await c.evaluate(()=>window.__g265.opened);
  const replay=await run(c,input(80,winnerValue,1,first.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(await c.evaluate(()=>window.__g265.opened),openedBefore);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_SEVENTH_NATIVE_TAB_CLOSE_ACK_LOSS_STALE_REPLAY_ZERO_SQLJS');

  // Both logical precondition mismatch and SQL trigger failure fail closed.
  // An independent tab must see byte-identical durable data and revision.
  await c.evaluate(()=>window.__g265.reset());
  const mismatch=await run(c,input(90,30,2,after.sha256,'2026-10-29T11:00:00.000Z'));
  assert.deepEqual(mismatch,{ok:false,code:'G265_ACCOUNT_POT_PREVIOUS_CAPACITY_CHANGED'});
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  await c.evaluate(()=>window.__g265.reset());
  const abort=await run(c,input(99,80,2,after.sha256,'2026-10-29T11:01:00.000Z'));
  assert.equal(abort.ok,false,JSON.stringify(abort));
  assert.match(abort.code,/native-pot-update-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();
  await d.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const recovered=await inspect(d);
  assert.deepEqual(recovered,after);
  console.log('PASS G265_SEVENTH_NATIVE_PRECONDITION_AND_SQL_ROLLBACK_ZERO_DURABLE_DELTA');
  console.log('HOLD G265_SEVENTH_NATIVE_OPTIN_NOT_PRODUCTION_23_LEGACY_RECOVERY_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed()){
    try{await page.evaluate(()=>window.__g265?.db?.close());}catch{}
  }
  await context.close();await browser.close();
}
