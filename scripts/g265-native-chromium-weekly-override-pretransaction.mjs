// G265: exact production saveWeeklyManualOverride, native Chromium two-tab
// Web Lock + primary IDB CAS + SQL.js, disposable loopback origin only.
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
  between('export const WEEKLY_MANUAL_OVERRIDE_SCHEMA=', 'export function weeklyManualOverrideKey(').replace(/^export /gm,''),
  between('export async function saveWeeklyManualOverride(','export async function clearWeeklyManualOverride(').replace(/^export /,''),
  'return saveWeeklyManualOverride;'
].join('\n');
assert.match(code,/withPrimarySqliteMutationLock\(async lease/);
assert.match(code,/persist\(\{primaryMutationLease:lease\}\)/);
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
seedDb.run("INSERT INTO settings VALUES('unrelated','retain','2026-11-08')");
seedDb.run("CREATE TRIGGER deny_weekly BEFORE INSERT ON settings WHEN NEW.key='weekly_context_manual_override:2026-11-09' BEGIN SELECT RAISE(ABORT,'synthetic-weekly-rollback'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const js=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const wasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const tabs=[];
const url=new URL('g265-weekly-override-disposable',base).href;
async function newTab(){
  const page=await context.newPage();tabs.push(page);
  await page.goto(url);
  await page.addScriptTag({url:new URL('g265-weekly-override-sql.js',base).href});
  await page.evaluate(async code=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-weekly-override-sql.wasm'});
    const v={storage,guard,SQL,db:null,reads:0,mutations:0,snapshots:0,persists:0,hold:false,ackLoss:false};
    v.open=async()=>{
      v.db=new SQL.Database(new Uint8Array(await storage.loadDatabaseBytes()));
      v.reads=0;v.mutations=0;
    };
    const rows=(sql,params=[])=>{
      v.reads++;
      const stmt=v.db.prepare(sql);const result=[];
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
    v.save=new Function('rows','run','persist','snapshot','begin','commit','rollback',
      'localIso','withPrimarySqliteMutationLock','beginSqliteExclusiveWriteWindow',
      'withSqliteCoordinatedMutation',code)(
      rows,run,persist,snapshot,
      ()=>v.db.run('BEGIN IMMEDIATE'),()=>v.db.run('COMMIT'),()=>{try{v.db.run('ROLLBACK');}catch{}},
      ()=>new Date().toISOString(),storage.withPrimarySqliteMutationLock,
      guard.beginSqliteExclusiveWriteWindow,guard.withSqliteCoordinatedMutation);
    window.__weekly=v;
  },code);
  assert.equal(await page.evaluate(()=>typeof navigator.locks?.request),'function');
  return page;
}
const input=(weekStart,camp)=>({weekStart,basedOnImportRevision:'REV-SYNTHETIC-1',fields:{camp,pot_size:42}});
async function attempt(page,weekStart,camp){
  return page.evaluate(async data=>{
    try{return {ok:true,result:await window.__weekly.save(data)};}
    catch(e){return {ok:false,code:e.code||e.message};}
  },input(weekStart,camp));
}
async function durable(page){
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__weekly.storage.loadDatabaseBytes())));
  const db=new SQL.Database(Uint8Array.from(bytes));
  const rows=db.exec('SELECT key,value_json FROM settings ORDER BY key')?.[0]?.values||[];
  db.close();return {bytes,rows};
}
const get=(state,week)=>state.rows.find(x=>x[0]==='weekly_context_manual_override:'+week);
try{
  await context.route('**/g265-weekly-override-disposable',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>G265 weekly disposable</title>'}));
  await context.route('**/g265-weekly-override-sql.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:js}));
  await context.route('**/g265-weekly-override-sql.wasm',route=>route.fulfill({status:200,contentType:'application/wasm',body:wasm}));
  const a=await newTab(),b=await newTab();
  await a.evaluate(bytes=>window.__weekly.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(()=>window.__weekly.open());
  await b.evaluate(()=>window.__weekly.open());
  await a.evaluate(()=>{
    const v=window.__weekly;v.hold=true;v.entered=new Promise(resolve=>{v.enteredResolve=resolve;});
    v.operation=v.save({weekStart:'2026-11-02',basedOnImportRevision:'REV-SYNTHETIC-1',fields:{camp:'A',pot_size:42}})
      .then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));
  });
  await a.evaluate(()=>window.__weekly.entered);
  await b.evaluate(()=>{
    const v=window.__weekly;
    v.operation=v.save({weekStart:'2026-11-16',basedOnImportRevision:'REV-SYNTHETIC-1',fields:{camp:'B'}})
      .then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));
  });
  await b.waitForFunction(async()=> (await navigator.locks.query()).pending.some(
    x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'),null,{timeout:5000});
  assert.equal(await b.evaluate(()=>window.__weekly.snapshots),0,'B must not snapshot before lock');
  assert.equal(await b.evaluate(()=>window.__weekly.mutations),0,'B must not SQL before lock');
  const winner=await a.evaluate(async()=>{window.__weekly.release();return window.__weekly.operation;});
  const stale=await b.evaluate(()=>window.__weekly.operation);
  assert.equal(winner.ok,true,JSON.stringify(winner));
  assert.equal(stale.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await b.evaluate(()=>window.__weekly.mutations),0);
  let state=await durable(a);
  assert.equal(JSON.parse(get(state,'2026-11-02')[1]).fields.camp,'A');
  assert.equal(get(state,'2026-11-16'),undefined);
  assert.ok(state.rows.some(x=>x[0]==='unrelated'&&x[1]==='retain'));
  assert.deepEqual(await a.evaluate(()=>window.__weekly.snapshotBytes),seed);
  assert.equal((await attempt(b,'2026-11-16','retry')).ok,false);
  assert.equal(await b.evaluate(()=>window.__weekly.persists),0);
  console.log('PASS G265_NATIVE_WEEKLY_A_HELD_B_QUEUED_STALE_BEFORE_SQL');

  const d=await newTab();await d.evaluate(()=>window.__weekly.open());
  await a.evaluate(bytes=>window.__weekly.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(bytes=>window.__weekly.storage.saveDatabaseBytes(Uint8Array.from(bytes)),state.bytes);
  const aba=await attempt(d,'2026-11-16','aba');
  assert.equal(aba.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__weekly.mutations),0);
  console.log('PASS G265_NATIVE_WEEKLY_MONOTONIC_ABA_PRE_SQL_HOLD');

  await a.evaluate(()=>{window.__weekly.hold=false;window.__weekly.ackLoss=true;});
  const lost=await attempt(a,'2026-11-16','C');
  assert.equal(lost.code,'SYNTHETIC_ACK_LOSS');
  state=await durable(a);
  assert.equal(JSON.parse(get(state,'2026-11-16')[1]).fields.camp,'C');
  const saves=await a.evaluate(()=>window.__weekly.persists);
  assert.equal((await attempt(a,'2026-11-16','retry')).ok,false);
  assert.equal(await a.evaluate(()=>window.__weekly.persists),saves);
  console.log('PASS G265_NATIVE_WEEKLY_POSTWRITE_ACK_LOSS_STICKY_NO_RETRY');

  const c=await newTab();await c.evaluate(()=>window.__weekly.open());
  const before=await durable(c);
  const blocked=await attempt(c,'2026-11-09','blocked');
  assert.match(String(blocked.code),/synthetic-weekly-rollback/);
  assert.deepEqual((await durable(c)).bytes,before.bytes);
  assert.deepEqual(await c.evaluate(()=>window.__weekly.snapshotBytes),before.bytes);
  assert.equal((await attempt(c,'2026-11-23','retry')).ok,false);
  console.log('PASS G265_NATIVE_WEEKLY_TRIGGER_ROLLBACK_NO_DURABLE_DELTA');
  console.log('HOLD G265_OTHER_LEGACY_WRITERS_ANDROID_OWNER_UAT');
}finally{
  for(const page of tabs)if(!page.isClosed())try{await page.evaluate(()=>window.__weekly?.storage?.closeStorageConnection?.());}catch{}
  await context.close();await browser.close();
}
