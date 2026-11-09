// G265 production weekly fallback: native Chromium Web Locks, SQL.js and IDB CAS.
// Executes the exact named source on disposable loopback two-tab fixtures only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync('assets/js/weekly-context-ui-bridge.js','utf8');
const start='async function saveFallback(form,current,potEdit){';
const end='\nfunction emitEntityChanged(';
const helperStart='function writeAccountPotCapacity(capacity,source=';
const helperEnd='\nasync function saveAccountPotCapacity(';
assert.equal(source.split(start).length,2);
assert.equal(source.split(helperStart).length,2);
const operation=source.slice(source.indexOf(start),source.indexOf(end));
const helper=source.slice(source.indexOf(helperStart),source.indexOf(helperEnd));
assert.match(operation,/withPrimarySqliteMutationLock\(async lease/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/);
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE weekly_context(context_id TEXT PRIMARY KEY,week_start TEXT,camp TEXT,dish_category TEXT,favorite_berry_1 TEXT,favorite_berry_2 TEXT,favorite_berry_3 TEXT,event_name TEXT,event_effects TEXT,pot_size INTEGER,base_notes TEXT,updated_at TEXT)');
seedDb.run('CREATE TABLE account_capacity(capacity_key TEXT PRIMARY KEY,total_capacity INTEGER,used_count INTEGER,updated_at TEXT,source TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seedDb.run("INSERT INTO account_capacity VALUES('pot',30,7,'seed','SYNTHETIC')");
seedDb.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
seedDb.run("INSERT INTO weekly_context(context_id,week_start,camp) VALUES('seed_week','2026-11-02','PRESERVE')");
const seed=Array.from(seedDb.export());seedDb.close();
const hash=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[],endpoint=name=>new URL(name,base).href;
await context.route('**/g265-fallback-production-blank',route=>route.fulfill({
  status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable fallback</title>'}));
await context.route('**/g265-fallback-production.js',route=>route.fulfill({
  status:200,contentType:'application/javascript',body:browserJs}));
await context.route('**/g265-fallback-production.wasm',route=>route.fulfill({
  status:200,contentType:'application/wasm',body:browserWasm}));
async function newTab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(endpoint('g265-fallback-production-blank'));
  await page.addScriptTag({url:endpoint('g265-fallback-production.js')});
  return page;
}
async function install(page){
  await page.evaluate(async ({operation,helper})=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-fallback-production.wasm'});
    const bytes=await storage.loadDatabaseBytes();
    if(!bytes)throw Error('DISPOSABLE_SEED_REQUIRED');
    const db=new SQL.Database(new Uint8Array(bytes));
    const v={storage,db,reads:0,writes:0,snapshots:0,persists:0,held:false,
      hold:false,failPot:false,ackLoss:false,imported:false,release:null,entered:null,pending:null};
    let enteredResolve;v.entered=new Promise(resolve=>{enteredResolve=resolve;});
    const check=()=>{if(!v.held)throw Error('SQL_BEFORE_NATIVE_LEASE');};
    const env={
      beginSqliteExclusiveWriteWindow:()=>guard.beginSqliteExclusiveWriteWindow(),
      withSqliteCoordinatedMutation:fn=>guard.withSqliteCoordinatedMutation(fn),
      async withPrimarySqliteMutationLock(fn){
        return storage.withPrimarySqliteMutationLock(async lease=>{
          v.held=true;try{return await fn(lease);}finally{v.held=false;}
        });
      },
      currentWeeklyContext(){
        check();v.reads++;
        db.exec('SELECT COUNT(*) FROM weekly_context');
        return {week_start:'2026-11-09',authority_revision:v.imported?'IMPORTED_REVISION':''};
      },
      hasImportedAuthority:c=>Boolean(c.authority_revision),
      validateManualForm(){check();},
      q:(form,name)=>({value:form.values[name]??''}),
      formBerryObservation:()=>['BERRY_A','BERRY_B','BERRY_C'],
      resolveCampFavoriteBerries:(_camp,berries)=>({berries}),
      typedValue:(_field,value)=>value===''?null:value,
      localWeekStart:()=> '2026-11-09',
      localIso:()=> '2026-11-09T19:55:00+08:00',
      async snapshot(reason){
        check();if(reason!=='manual:weekly-context-fallback')throw Error('SNAPSHOT_REASON');
        v.snapshots++;
        if(v.hold){v.hold=false;enteredResolve();
          await new Promise(resolve=>{v.release=resolve;});}
      },
      run(sql,params=[]){
        check();guard.assertSqliteDirectWriteAllowed();v.writes++;
        if(v.failPot&&sql.includes('INSERT INTO account_capacity'))
          throw Error('SYNTHETIC_POT_SQL_ABORT');
        db.run(sql,params);
      },
      begin(){check();guard.assertSqliteDirectWriteAllowed();db.run('BEGIN IMMEDIATE');},
      commit(){check();guard.assertSqliteDirectWriteAllowed();db.run('COMMIT');},
      rollback(){check();guard.assertSqliteDirectWriteAllowed();db.run('ROLLBACK');},
      async persist({primaryMutationLease}={}){
        check();v.persists++;
        await storage.saveDatabaseBytes(db.export(),{primaryMutationLease});
        if(v.ackLoss)throw Error('SYNTHETIC_POST_COMMIT_ACK_LOST');
      },
      String,Error,JSON,Object,Array,Number
    };
    v.save=new Function('env','with(env){'+helper+'\n'+operation+';return saveFallback;}')(env);
    v.start=(camp,capacity=69)=>{
      const form={values:{camp,dish_category:'甜點飲料',event_name:'SYNTHETIC_EVENT',
        event_effects:'',base_notes:'disposable'}};
      const current={week_start:'2026-11-09',authority_revision:''};
      const edit={needsAccountWrite:true,value:capacity,source:'MANUAL_WEEKLY_CONTEXT_UI'};
      v.pending=v.save(form,current,edit).then(
        result=>({ok:true,result}),error=>({ok:false,error:error.code||error.message}));
    };
    window.__fallback=v;
  },{operation,helper});
}
const state=page=>page.evaluate(()=>({
  reads:window.__fallback.reads,writes:window.__fallback.writes,
  snapshots:window.__fallback.snapshots,persists:window.__fallback.persists}));
const result=page=>page.evaluate(()=>window.__fallback.pending);
const durable=async page=>page.evaluate(async()=>Array.from(
  new Uint8Array(await window.__fallback.storage.loadDatabaseBytes())));
const inspect=bytes=>{
  const db=new SQL.Database(Uint8Array.from(bytes));
  try{return {
    weekly:db.exec('SELECT context_id,week_start,camp,pot_size FROM weekly_context ORDER BY context_id')?.[0]?.values||[],
    pot:db.exec("SELECT total_capacity,used_count FROM account_capacity WHERE capacity_key='pot'")[0].values[0],
    public:db.exec('SELECT value FROM synthetic_public_master')[0].values[0][0]
  };}finally{db.close();}
};
try{
  const a=await newTab();
  await a.evaluate(async()=>{window.__seedStorage=await import('/assets/js/storage.js');
    await window.__seedStorage.loadDatabaseBytes();});
  await a.evaluate(async bytes=>{
    await window.__seedStorage.saveDatabaseBytes(Uint8Array.from(bytes));
    await window.__seedStorage.loadDatabaseBytes();
  },seed);
  const b=await newTab();await install(a);await install(b);
  assert.equal(await a.evaluate(()=>typeof navigator.locks?.request),'function');
  await a.evaluate(()=>{window.__fallback.hold=true;window.__fallback.start('CAMP_A');});
  await a.evaluate(()=>window.__fallback.entered);
  await b.evaluate(()=>window.__fallback.start('CAMP_B',80));
  await b.waitForFunction(async()=>{
    const q=await navigator.locks.query();
    return q.pending.some(x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
  });
  assert.deepEqual(await state(b),{reads:0,writes:0,snapshots:0,persists:0},
    'queued second tab must execute zero player SQL');
  await a.evaluate(()=>window.__fallback.release());
  assert.equal((await result(a)).ok,true);
  const loser=await result(b);
  assert.equal(loser.ok,false);
  assert.match(loser.error,/STALE_REVISION_RELOAD_REQUIRED/);
  assert.deepEqual(await state(b),{reads:0,writes:0,snapshots:0,persists:0});
  const firstBytes=await durable(a),first=inspect(firstBytes);
  assert.equal(first.pot[0],69);assert.equal(first.pot[1],7);
  assert.equal(first.public,'IMMUTABLE');
  assert.ok(first.weekly.some(x=>x[0]==='weekly_context_2026-11-09_manual'&&x[2]==='CAMP_A'&&x[3]===null));
  assert.ok(first.weekly.some(x=>x[0]==='seed_week'&&x[2]==='PRESERVE'));
  console.log('PASS G265_WEEKLY_FALLBACK_NATIVE_TWO_TAB_QUEUED_ZERO_SQL_STALE_NO_OVERWRITE');

  // Explicit fresh document, never a blind stale retry.
  const c=await newTab();await install(c);
  await c.evaluate(()=>window.__fallback.start('CAMP_C',70));
  assert.equal((await result(c)).ok,true);
  const secondBytes=await durable(c),second=inspect(secondBytes);
  assert.equal(second.pot[0],70);assert.equal(second.pot[1],7);
  assert.ok(second.weekly.some(x=>x[2]==='CAMP_C'));
  assert.equal(second.public,'IMMUTABLE');
  assert.notEqual(hash(firstBytes),hash(secondBytes));
  console.log('PASS G265_WEEKLY_FALLBACK_NATIVE_FRESH_RELOAD_DURABLE_ACK_POT_PRESERVE');

  await c.evaluate(()=>{window.__fallback.failPot=true;window.__fallback.start('ROLLBACK',99);});
  const failed=await result(c);
  assert.equal(failed.ok,false);assert.match(failed.error,/SYNTHETIC_POT_SQL_ABORT/);
  assert.equal(hash(await durable(c)),hash(secondBytes));
  assert.equal(inspect(await durable(c)).pot[0],70);
  console.log('PASS G265_WEEKLY_FALLBACK_NATIVE_SQL_ROLLBACK_NO_DURABLE_DELTA');

  // Failed SQL session is fail-closed in this page; new tab can test ACK loss.
  const d=await newTab();await install(d);
  await d.evaluate(()=>{window.__fallback.ackLoss=true;window.__fallback.start('ACK_LOSS',71);});
  const lost=await result(d);
  assert.equal(lost.ok,false);assert.match(lost.error,/SYNTHETIC_POST_COMMIT_ACK_LOST/);
  await d.evaluate(()=>window.__fallback.start('BLIND_RETRY',72));
  const retried=await result(d);
  assert.equal(retried.ok,false);assert.match(retried.error,/UNVERIFIED_RELOAD_REQUIRED/);
  assert.equal((await state(d)).persists,1);
  const afterLoss=inspect(await durable(d));
  assert.equal(afterLoss.pot[1],7);assert.equal(afterLoss.public,'IMMUTABLE');
  console.log('PASS G265_WEEKLY_FALLBACK_NATIVE_ACK_LOSS_STICKY_NO_BLIND_RETRY');

  const e=await newTab();await install(e);
  await e.evaluate(()=>{window.__fallback.imported=true;window.__fallback.start('IMPORTED_GUARD',88);});
  const imported=await result(e);
  assert.equal(imported.ok,false);
  assert.match(imported.error,/WEEKLY_FALLBACK_IMPORTED_AUTHORITY_RELOAD_REQUIRED/);
  assert.equal((await state(e)).snapshots,0);
  assert.equal((await state(e)).writes,0);
  console.log('PASS G265_WEEKLY_FALLBACK_NATIVE_IMPORTED_JSON_AUTHORITY_NO_REPLACE');
}finally{
  for(const page of pages)if(!page.isClosed())await page.close();
  await context.close();await browser.close();
}
