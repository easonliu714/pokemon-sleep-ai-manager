// G265 eleventh weekly context: disposable native Chromium two-tab CAS/recovery.
// Real SQL.js/WASM, native Web Locks and IndexedDB on loopback; no player DB or app wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const legacy=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const exact=legacy.split('function weeklyForm() {')[1]?.split('function recipeShortageText(row) {')[0];
assert.ok(exact,'eleventh weekly context writer must remain source-bound');
assert.match(exact,/await snapshot\('manual:weekly-context'\)/);
assert.match(exact,/INSERT OR REPLACE INTO weekly_context/);
assert.match(exact,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-weekly-context-optin/);
console.log('PASS G265_ELEVENTH_NATIVE_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE weekly_context(context_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,camp TEXT,dish_category TEXT,favorite_berry_1 TEXT,favorite_berry_2 TEXT,favorite_berry_3 TEXT,event_name TEXT,event_effects TEXT,pot_size INTEGER,base_notes TEXT,updated_at TEXT NOT NULL)');
seedDb.run("INSERT INTO weekly_context VALUES('week_seed','2026-10-26','SYNTHETIC_SEED','','','','','','',NULL,'','2026-10-29T00:00:00.000Z')");
seedDb.run('CREATE TABLE public_event_master(event_id TEXT PRIMARY KEY,payload TEXT)');
seedDb.run("INSERT INTO public_event_master VALUES('fixture-event','SYNTHETIC_PUBLIC_MASTER_UNCHANGED')");
seedDb.run("CREATE TRIGGER deny_native_weekly_context BEFORE INSERT ON weekly_context WHEN NEW.camp='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'native-weekly-context-insert-rejection'); END");
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
  await page.goto(new URL('g265-context-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-context-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createWeeklyContextOptIn}=await import('/assets/js/sqlite-weekly-context-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-context-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const req=indexedDB.open('pokemon_sleep_ai_manager');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createWeeklyContextOptIn,opened:0,db:null,pair:null,writer:null};
    window.__g265.reset=()=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      v.writer=v.createWeeklyContextOptIn({pairGate:v.pair,
        openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}});
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const input=(weekStart,camp,generation,sha256,
  updatedAt='2026-10-30T01:00:00.000Z',expectedPreviousUpdatedAt=null)=>({
    weekStart,camp,dishCategory:'沙拉',favoriteBerry1:'SYNTHETIC_BERRY_A',
    favoriteBerry2:'SYNTHETIC_BERRY_B',potSize:24,updatedAt,
    expectedPreviousUpdatedAt,expectedGeneration:generation,expectedFingerprint:sha256
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
    rows:sql.exec('SELECT context_id,week_start,camp,pot_size,updated_at FROM weekly_context ORDER BY context_id')?.[0]?.values||[],
    master:sql.exec('SELECT event_id,payload FROM public_event_master')?.[0]?.values||[]};
  }finally{sql.close();}
});
const has=(state,week)=>state.rows.find(row=>row[0]==='week_'+week);
try{
  await context.route('**/g265-context-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable weekly context</title>'
  }));
  await context.route('**/g265-context-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-context-native.wasm',route=>route.fulfill({
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

  // Input rejection precedes any SQL.js open or durable mutation.
  const invalid=await run(a,{...input('2026-11-02','SYNTHETIC_BAD',0,seedHash),
    favoriteBerry2:'SYNTHETIC_BERRY_A'});
  assert.deepEqual(invalid,{ok:false,code:'G265_WEEKLY_CONTEXT_DUPLICATE_BERRY'});
  const invalidPot=await run(a,{...input('2026-11-02','SYNTHETIC_BAD',0,seedHash),potSize:0});
  assert.deepEqual(invalidPot,{ok:false,code:'G265_WEEKLY_CONTEXT_INPUT_INVALID'});
  assert.equal(await a.evaluate(()=>window.__g265.opened),0);
  assert.equal((await inspect(a)).generation,0);
  console.log('PASS G265_ELEVENTH_NATIVE_DUPLICATE_BERRY_INVALID_POT_PRE_SQL');

  const race=await Promise.all([
    run(a,input('2026-11-02','SYNTHETIC_A',0,seedHash)),
    run(b,input('2026-11-09','SYNTHETIC_B',0,seedHash))
  ]);
  assert.equal(race.filter(x=>x.ok).length,1,JSON.stringify(race));
  assert.equal(race.filter(x=>!x.ok)[0].code,'G265_PAIR_STALE_RELOAD_REQUIRED');
  const active=race[0].ok?a:b,loser=race[0].ok?b:a;
  const winnerWeek=race[0].ok?'2026-11-02':'2026-11-09';
  const loserWeek=race[0].ok?'2026-11-09':'2026-11-02';
  assert.equal(await loser.evaluate(()=>window.__g265.opened),0);
  assert.equal(await loser.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const first=await inspect(active);
  assert.equal(first.generation,1);assert.equal(first.sha256,digest(first.bytes));
  assert.equal(first.rows.length,2);assert.ok(has(first,winnerWeek));
  assert.equal(has(first,loserWeek),undefined);
  assert.deepEqual(first.master,[['fixture-event','SYNTHETIC_PUBLIC_MASTER_UNCHANGED']]);
  console.log('PASS G265_ELEVENTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await loser.evaluate(()=>window.__g265.reset());
  const second=await run(loser,input(loserWeek,'SYNTHETIC_SECOND',1,first.sha256,
    '2026-10-30T01:01:00.000Z'));
  assert.equal(second.ok,true,JSON.stringify(second));
  const after=await inspect(loser);
  assert.equal(after.generation,2);assert.equal(after.sha256,digest(after.bytes));
  assert.equal(after.rows.length,3);
  assert.deepEqual(after.rows.find(row=>row[0]==='week_seed'),
    first.rows.find(row=>row[0]==='week_seed'));
  assert.deepEqual(has(after,winnerWeek),has(first,winnerWeek));
  assert.ok(has(after,loserWeek));
  assert.deepEqual(after.master,first.master);
  console.log('PASS G265_ELEVENTH_NATIVE_FRESH_DURABLE_ALL_CONFIRMED_CONTEXTS_MASTER_PRESERVED');

  await active.evaluate(()=>window.__g265.reset());
  const wrong=await run(active,input(winnerWeek,'SYNTHETIC_REPLACE',2,after.sha256,
    '2026-10-30T01:02:00.000Z',null));
  assert.deepEqual(wrong,{ok:false,code:'G265_WEEKLY_CONTEXT_PREVIOUS_REVISION_CHANGED'});
  assert.equal(await active.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(loser),after);
  console.log('PASS G265_ELEVENTH_NATIVE_PREVIOUS_ROW_REVISION_CONFLICT_ZERO_DURABLE_DELTA');

  await active.evaluate(()=>window.__g265.reset());
  const update=await run(active,input(winnerWeek,'SYNTHETIC_REPLACE',2,after.sha256,
    '2026-10-30T01:02:00.000Z','2026-10-30T01:00:00.000Z'));
  assert.equal(update.ok,true,JSON.stringify(update));
  const updated=await inspect(active);
  assert.equal(updated.generation,3);assert.equal(updated.sha256,digest(updated.bytes));
  assert.equal(has(updated,winnerWeek)[2],'SYNTHETIC_REPLACE');
  assert.deepEqual(has(updated,loserWeek),has(after,loserWeek));
  assert.deepEqual(updated.master,after.master);
  console.log('PASS G265_ELEVENTH_NATIVE_EXACT_ROW_PRECONDITION_ACK_READBACK');

  await active.evaluate(()=>window.__g265.db.close());await active.close();
  const c=await newTab();
  await c.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(c),updated);
  const openedBefore=await c.evaluate(()=>window.__g265.opened);
  const replay=await run(c,input('2026-11-16','SYNTHETIC_REPLAY',2,after.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(await c.evaluate(()=>window.__g265.opened),openedBefore);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_ELEVENTH_NATIVE_TAB_CLOSE_ACK_LOSS_STALE_REPLAY_ZERO_SQLJS');

  await c.evaluate(()=>window.__g265.reset());
  const abort=await run(c,input('2026-11-23','SYNTHETIC_BLOCKED',3,updated.sha256));
  assert.equal(abort.ok,false,JSON.stringify(abort));
  assert.match(abort.code,/native-weekly-context-insert-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();
  await d.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(d),updated);
  console.log('PASS G265_ELEVENTH_NATIVE_SQL_ROLLBACK_INDEPENDENT_DURABLE_READBACK_UNCHANGED');
  console.log('HOLD G265_ELEVENTH_NATIVE_OPTIN_NOT_PRODUCTION_ALL_WRITERS_CRASH_RESTORE_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed()){
    try{await page.evaluate(()=>window.__g265?.db?.close());}catch{}
  }
  await context.close();await browser.close();
}
