// G265 tenth weekly strategy: isolated native Chromium two-tab durable CAS/recovery.
// Uses disposable loopback IndexedDB, real SQL.js/WASM and native Web Locks only.
// Production g3-planning.js::warroomForm(), player database and SW are unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const legacy=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const exact=legacy.split('function warroomForm() {')[1]?.split('function renderCollection() {')[0];
assert.ok(exact,'tenth legacy weekly strategy writer must remain source-bound');
assert.match(exact,/await snapshot\('manual:weekly-strategy'\)/);
assert.match(exact,/INSERT OR REPLACE INTO weekly_strategy/);
assert.match(exact,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-weekly-strategy-optin/);
console.log('PASS G265_TENTH_NATIVE_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE weekly_strategy(strategy_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,team_summary TEXT,substitution_rules TEXT,time_schedule TEXT,meal_strategy TEXT,ingredient_estimate REAL,berry_estimate REAL,shard_estimate REAL,snorlax_energy_estimate REAL,assumptions TEXT,updated_at TEXT NOT NULL)');
seedDb.run("INSERT INTO weekly_strategy VALUES('strategy_seed','2026-10-26','SYNTHETIC_SEED','','','',NULL,NULL,NULL,NULL,'','2026-10-29T00:00:00.000Z')");
seedDb.run("CREATE TRIGGER deny_native_strategy BEFORE INSERT ON weekly_strategy WHEN NEW.team_summary='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'native-strategy-insert-rejection'); END");
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
  await page.goto(new URL('g265-strategy-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-strategy-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createWeeklyStrategyOptIn}=await import('/assets/js/sqlite-weekly-strategy-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-strategy-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const req=indexedDB.open('pokemon_sleep_ai_manager');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createWeeklyStrategyOptIn,opened:0,db:null,pair:null,writer:null};
    window.__g265.reset=()=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      v.writer=v.createWeeklyStrategyOptIn({pairGate:v.pair,
        openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}});
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const input=(weekStart,teamSummary,generation,sha256,
  updatedAt='2026-10-30T01:00:00.000Z',expectedPreviousUpdatedAt=null)=>({
    weekStart,teamSummary,ingredientEstimate:25,updatedAt,expectedPreviousUpdatedAt,
    expectedGeneration:generation,expectedFingerprint:sha256
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
    rows:sql.exec('SELECT strategy_id,week_start,team_summary,ingredient_estimate,updated_at FROM weekly_strategy ORDER BY strategy_id')?.[0]?.values||[]};
  }finally{sql.close();}
});
const has=(state,week)=>state.rows.find(row=>row[0]==='strategy_'+week);
try{
  await context.route('**/g265-strategy-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable weekly strategy</title>'
  }));
  await context.route('**/g265-strategy-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-strategy-native.wasm',route=>route.fulfill({
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

  // Two native tabs race from the same revision: one durable ACK only.
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
  console.log('PASS G265_TENTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  // Explicit fresh reload appends the second strategy without losing either ACK.
  await loser.evaluate(()=>window.__g265.reset());
  const second=await run(loser,input(loserWeek,'SYNTHETIC_SECOND',1,first.sha256,
    '2026-10-30T01:01:00.000Z'));
  assert.equal(second.ok,true,JSON.stringify(second));
  const after=await inspect(loser);
  assert.equal(after.generation,2);assert.equal(after.sha256,digest(after.bytes));
  assert.equal(after.rows.length,3);
  assert.deepEqual(after.rows.find(row=>row[0]==='strategy_seed'),
    first.rows.find(row=>row[0]==='strategy_seed'));
  assert.deepEqual(has(after,winnerWeek),has(first,winnerWeek));
  assert.ok(has(after,loserWeek));
  console.log('PASS G265_TENTH_NATIVE_FRESH_DURABLE_ALL_CONFIRMED_STRATEGIES_PRESERVED');

  // An old row revision cannot overwrite a newer acknowledged row.
  await active.evaluate(()=>window.__g265.reset());
  const wrong=await run(active,input(winnerWeek,'SYNTHETIC_REPLACE',2,after.sha256,
    '2026-10-30T01:02:00.000Z',null));
  assert.deepEqual(wrong,{ok:false,code:'G265_WEEKLY_STRATEGY_PREVIOUS_REVISION_CHANGED'});
  assert.equal(await active.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(loser),after);
  console.log('PASS G265_TENTH_NATIVE_PREVIOUS_ROW_REVISION_CONFLICT_ZERO_DURABLE_DELTA');

  // Correct row precondition may update exactly one row and preserve others.
  await active.evaluate(()=>window.__g265.reset());
  const update=await run(active,input(winnerWeek,'SYNTHETIC_REPLACE',2,after.sha256,
    '2026-10-30T01:02:00.000Z','2026-10-30T01:00:00.000Z'));
  assert.equal(update.ok,true,JSON.stringify(update));
  const updated=await inspect(active);
  assert.equal(updated.generation,3);assert.equal(updated.sha256,digest(updated.bytes));
  assert.equal(has(updated,winnerWeek)[2],'SYNTHETIC_REPLACE');
  assert.deepEqual(has(updated,loserWeek),has(after,loserWeek));
  console.log('PASS G265_TENTH_NATIVE_EXACT_ROW_PRECONDITION_ACK_READBACK');

  // Close successful tab, then a fresh tab must reject a stale ACK replay.
  await active.evaluate(()=>window.__g265.db.close());await active.close();
  const c=await newTab();
  await c.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(c),updated);
  const openedBefore=await c.evaluate(()=>window.__g265.opened);
  const replay=await run(c,input('2026-11-16','SYNTHETIC_REPLAY',2,after.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(await c.evaluate(()=>window.__g265.opened),openedBefore);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_TENTH_NATIVE_TAB_CLOSE_ACK_LOSS_STALE_REPLAY_ZERO_SQLJS');

  // SQL trigger abort must leave both SQLite bytes and revision untouched.
  await c.evaluate(()=>window.__g265.reset());
  const abort=await run(c,input('2026-11-23','SYNTHETIC_BLOCKED',3,updated.sha256));
  assert.equal(abort.ok,false,JSON.stringify(abort));
  assert.match(abort.code,/native-strategy-insert-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();
  await d.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(d),updated);
  console.log('PASS G265_TENTH_NATIVE_SQL_ROLLBACK_INDEPENDENT_DURABLE_READBACK_UNCHANGED');
  console.log('HOLD G265_TENTH_NATIVE_OPTIN_NOT_PRODUCTION_ALL_WRITERS_CRASH_RESTORE_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed()){
    try{await page.evaluate(()=>window.__g265?.db?.close());}catch{}
  }
  await context.close();await browser.close();
}
