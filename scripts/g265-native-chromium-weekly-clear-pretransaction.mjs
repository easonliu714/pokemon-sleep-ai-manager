// G265 named production weekly clear: real Chromium two tabs, native Web Locks,
// primary IDB CAS and disposable SQL.js. No real player data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const source=fs.readFileSync('assets/js/weekly-context-manual-override.js','utf8');
function between(start,end){
  assert.equal(source.split(start).length,2,'unique source marker '+start);
  return start+source.split(start)[1].split(end)[0];
}
const code=[
  between('export const WEEKLY_MANUAL_OVERRIDE_SCHEMA=','export function weeklyManualOverrideKey(').replace(/^export /gm,''),
  source.split('export function readWeeklyManualOverride(')[1].split('export function resolveWeeklyManualOverride(')[0].replace(/^/,'function readWeeklyManualOverride('),
  source.split('export async function clearWeeklyManualOverride(')[1].replace(/^/,'async function clearWeeklyManualOverride('),
  'return clearWeeklyManualOverride;'
].join('\n');
assert.match(code,/withPrimarySqliteMutationLock\(async lease/);
assert.match(code,/persist\(\{primaryMutationLease:lease\}\)/);
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
seedDb.run("INSERT INTO settings VALUES('unrelated','retain','2026-11-08')");
for(const week of ['2026-11-02','2026-11-09','2026-11-16']){
  const record={schema:'weekly-context-manual-override/1.0',week_start:week,
    based_on_import_revision:'REV-SYNTHETIC-1',fields:{camp:'original',pot_size:null}};
  seedDb.run('INSERT INTO settings VALUES(?,?,?)',
    ['weekly_context_manual_override:'+week,JSON.stringify(record),'2026-11-08']);
}
seedDb.run("CREATE TRIGGER deny_clear BEFORE DELETE ON settings WHEN OLD.key='weekly_context_manual_override:2026-11-09' BEGIN SELECT RAISE(ABORT,'synthetic-clear-rollback'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const js=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const wasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const tabs=[];
const url=new URL('g265-weekly-clear-disposable',base).href;
async function newTab(){
  const page=await context.newPage();tabs.push(page);
  await page.goto(url);
  await page.addScriptTag({url:new URL('g265-weekly-clear-sql.js',base).href});
  await page.evaluate(async code=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-weekly-clear-sql.wasm'});
    const v={storage,guard,SQL,db:null,reads:0,mutations:0,snapshots:0,persists:0,
      hold:false,ackLoss:false};
    v.open=async()=>{
      v.db=new SQL.Database(new Uint8Array(await storage.loadDatabaseBytes()));
      v.reads=0;v.mutations=0;
    };
    const rows=(sql,params=[])=>{
      v.reads++;
      const stmt=v.db.prepare(sql),result=[];
      try{stmt.bind(params);while(stmt.step())result.push(stmt.getAsObject());}
      finally{stmt.free();}
      return result;
    };
    const run=(sql,params=[])=>{v.mutations++;v.db.run(sql,params);};
    const snapshot=async()=>{
      v.snapshots++;v.snapshotBytes=Array.from(v.db.export());
      if(v.hold){v.enteredResolve();await new Promise(resolve=>{v.release=resolve;});}
    };
    const persist=async options=>{
      v.persists++;await storage.saveDatabaseBytes(v.db.export(),options);
      if(v.ackLoss)throw Object.assign(Error('synthetic postwrite ACK loss'),{code:'SYNTHETIC_ACK_LOSS'});
    };
    v.clear=new Function('rows','run','persist','snapshot','begin','commit','rollback',
      'localIso','withPrimarySqliteMutationLock','beginSqliteExclusiveWriteWindow',
      'withSqliteCoordinatedMutation',code)(
      rows,run,persist,snapshot,
      ()=>v.db.run('BEGIN IMMEDIATE'),()=>v.db.run('COMMIT'),()=>{try{v.db.run('ROLLBACK');}catch{}},
      ()=>new Date().toISOString(),storage.withPrimarySqliteMutationLock,
      guard.beginSqliteExclusiveWriteWindow,guard.withSqliteCoordinatedMutation);
    window.__weeklyClear=v;
  },code);
  assert.equal(await page.evaluate(()=>typeof navigator.locks?.request),'function');
  return page;
}
async function attempt(page,week){
  return page.evaluate(async week=>{
    try{return {ok:true,result:await window.__weeklyClear.clear(week)};}
    catch(e){return {ok:false,code:e.code||e.message};}
  },week);
}
async function durable(page){
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__weeklyClear.storage.loadDatabaseBytes())));
  const db=new SQL.Database(Uint8Array.from(bytes));
  const rows=db.exec('SELECT key,value_json FROM settings ORDER BY key')?.[0]?.values||[];
  db.close();return {bytes,rows};
}
const get=(state,week)=>state.rows.find(x=>x[0]==='weekly_context_manual_override:'+week);
try{
  await context.route('**/g265-weekly-clear-disposable',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>G265 weekly clear disposable</title>'}));
  await context.route('**/g265-weekly-clear-sql.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:js}));
  await context.route('**/g265-weekly-clear-sql.wasm',route=>route.fulfill({status:200,contentType:'application/wasm',body:wasm}));
  const a=await newTab(),b=await newTab();
  await a.evaluate(bytes=>window.__weeklyClear.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(()=>window.__weeklyClear.open());
  await b.evaluate(()=>window.__weeklyClear.open());
  await a.evaluate(()=>{
    const v=window.__weeklyClear;v.hold=true;v.entered=new Promise(resolve=>{v.enteredResolve=resolve;});
    v.operation=v.clear('2026-11-02').then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));
  });
  await a.evaluate(()=>window.__weeklyClear.entered);
  await b.evaluate(()=>{
    const v=window.__weeklyClear;
    v.operation=v.clear('2026-11-16').then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));
  });
  await b.waitForFunction(async()=> (await navigator.locks.query()).pending.some(
    x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'),null,{timeout:5000});
  assert.equal(await b.evaluate(()=>window.__weeklyClear.reads),0,'B must not decide no-op before lock');
  assert.equal(await b.evaluate(()=>window.__weeklyClear.snapshots),0,'B must not snapshot before lock');
  assert.equal(await b.evaluate(()=>window.__weeklyClear.mutations),0,'B must not DELETE before lock');
  const winner=await a.evaluate(async()=>{window.__weeklyClear.release();return window.__weeklyClear.operation;});
  const stale=await b.evaluate(()=>window.__weeklyClear.operation);
  assert.deepEqual(winner,{ok:true,result:true});
  assert.equal(stale.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await b.evaluate(()=>window.__weeklyClear.mutations),0);
  let state=await durable(a);
  assert.equal(get(state,'2026-11-02'),undefined);
  assert.ok(get(state,'2026-11-16'),'B stale DELETE must not run');
  assert.ok(state.rows.some(x=>x[0]==='unrelated'&&x[1]==='retain'));
  assert.deepEqual(await a.evaluate(()=>window.__weeklyClear.snapshotBytes),seed);
  assert.equal((await attempt(b,'2026-11-16')).ok,false);
  assert.equal(await b.evaluate(()=>window.__weeklyClear.persists),0);
  console.log('PASS G265_NATIVE_WEEKLY_CLEAR_HELD_A_QUEUED_B_STALE_BEFORE_READ_AND_DELETE');

  const d=await newTab();await d.evaluate(()=>window.__weeklyClear.open());
  await a.evaluate(bytes=>window.__weeklyClear.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(bytes=>window.__weeklyClear.storage.saveDatabaseBytes(Uint8Array.from(bytes)),state.bytes);
  const aba=await attempt(d,'2026-11-16');
  assert.equal(aba.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__weeklyClear.mutations),0);
  console.log('PASS G265_NATIVE_WEEKLY_CLEAR_MONOTONIC_ABA_PRE_SQL_HOLD');

  await a.evaluate(()=>{window.__weeklyClear.hold=false;window.__weeklyClear.ackLoss=true;});
  const lost=await attempt(a,'2026-11-16');
  assert.equal(lost.code,'SYNTHETIC_ACK_LOSS');
  state=await durable(a);
  assert.equal(get(state,'2026-11-16'),undefined,'postwrite ACK loss can still be durable');
  const saves=await a.evaluate(()=>window.__weeklyClear.persists);
  assert.equal((await attempt(a,'2026-11-16')).ok,false);
  assert.equal(await a.evaluate(()=>window.__weeklyClear.persists),saves);
  console.log('PASS G265_NATIVE_WEEKLY_CLEAR_POSTWRITE_ACK_LOSS_STICKY_NO_RETRY');

  const c=await newTab();await c.evaluate(()=>window.__weeklyClear.open());
  const before=await durable(c);
  const blocked=await attempt(c,'2026-11-09');
  assert.match(String(blocked.code),/synthetic-clear-rollback/);
  assert.deepEqual((await durable(c)).bytes,before.bytes);
  assert.deepEqual(await c.evaluate(()=>window.__weeklyClear.snapshotBytes),before.bytes);
  assert.equal((await attempt(c,'2026-11-23')).ok,false,'failed transaction must remain sticky');
  console.log('PASS G265_NATIVE_WEEKLY_CLEAR_TRIGGER_ROLLBACK_NO_DURABLE_DELTA');

  const e=await newTab();await e.evaluate(()=>window.__weeklyClear.open());
  const noopBefore=await durable(e);
  const noop=await attempt(e,'2026-11-23');
  assert.deepEqual(noop,{ok:true,result:false});
  assert.equal(await e.evaluate(()=>window.__weeklyClear.persists),0);
  assert.equal(await e.evaluate(()=>window.__weeklyClear.snapshots),0);
  assert.deepEqual((await durable(e)).bytes,noopBefore.bytes);
  console.log('PASS G265_NATIVE_WEEKLY_CLEAR_ADMITTED_NOOP_NO_PERSIST');
  console.log('HOLD G265_OTHER_LEGACY_WRITERS_ANDROID_OWNER_UAT');
}finally{
  for(const page of tabs)if(!page.isClosed())try{await page.evaluate(()=>window.__weeklyClear?.storage?.closeStorageConnection?.());}catch{}
  await context.close();await browser.close();
}
