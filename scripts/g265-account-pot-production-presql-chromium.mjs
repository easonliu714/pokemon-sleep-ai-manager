// G265 #861: test the actual imported-authority account-pot production
// function with native Chromium Web Locks, IndexedDB, and disposable SQL.js.
// This is NOT Android UAT and never reads an Owner's PWA/player database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const main=fs.readFileSync('assets/js/weekly-context-ui-bridge.js','utf8');
function section(start,end){
  assert.equal(main.split(start).length,2,'unique production anchor '+start);
  const tail=main.split(start)[1];
  assert.ok(tail.includes(end),'end anchor '+end);
  return start+tail.split(end)[0];
}
const typed=section('function typedValue(field,raw){','function resolvedValue(');
const helper=section('function writeAccountPotCapacity(capacity,source=', 'async function saveAccountPotCapacity(');
const imported=section('function hasImportedAuthority(current){','function existingOverrideFields(');
const functionAnchor='async function saveAccountPotCapacity(edit,current){';
const writer=section(functionAnchor,'async function saveFallback(');
// Negative-first release gate: these assertions MUST fail against the pre-#861
// production source before any correction is made.
assert.match(writer,/beginSqliteExclusiveWriteWindow\(\)/);
assert.match(writer,/withPrimarySqliteMutationLock\(async lease=>/);
assert.ok(writer.indexOf('withPrimarySqliteMutationLock')<writer.indexOf('await snapshot('),
  'native lease must precede first snapshot or player SQL');
assert.match(writer,/withSqliteCoordinatedMutation\(begin\)/);
assert.match(writer,/withSqliteCoordinatedMutation\(rollback\)/);
assert.match(writer,/persist\(\{primaryMutationLease:lease\}\)/);
assert.match(writer,/close\(\{uncertainOutcome:!acknowledged\}\)/);
assert.match(helper,/INSERT INTO account_capacity/);

const code=typed+'\n'+helper+'\n'+imported+'\n'+writer;
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE account_capacity(capacity_key TEXT PRIMARY KEY,total_capacity INTEGER,used_count INTEGER,updated_at TEXT,source TEXT)');
seedDb.run("INSERT INTO account_capacity VALUES('pot',30,7,'SEED','SYNTHETIC_SEED')");
seedDb.run("INSERT INTO account_capacity VALUES('unrelated',123,2,'SEED','UNRELATED')");
seedDb.run("CREATE TRIGGER abort_pot_99 BEFORE UPDATE ON account_capacity WHEN NEW.capacity_key='pot' AND NEW.total_capacity=99 BEGIN SELECT RAISE(ABORT,'SYNTHETIC_POT_SQL_ABORT'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
await context.route('**/g265-pot-prod-blank',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>G265 #861 isolated</title>'}));
await context.route('**/g265-pot-prod.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:browserJs}));
await context.route('**/g265-pot-prod.wasm',route=>route.fulfill({status:200,contentType:'application/wasm',body:browserWasm}));
async function tab(){
  const p=await context.newPage();pages.push(p);
  await p.goto(new URL('g265-pot-prod-blank',base).href);
  await p.addScriptTag({url:new URL('g265-pot-prod.js',base).href});
  return p;
}
async function install(page){
  await page.evaluate(async source=>{
    const s=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-pot-prod.wasm'});
    const bytes=await s.loadDatabaseBytes();
    if(!bytes)throw Error('DISPOSABLE_POT_SQLITE_NOT_SEEDED');
    const db=new SQL.Database(new Uint8Array(bytes));
    const v={db,storage:s,snapshots:0,sqlWrites:0,persistCount:0,ackLoss:false,
      current:{authority_revision:'SYNTHETIC_REV_1',authority_context_id:'synthetic_import',
        week_start:'2026-11-09',pot_size:30,
        field_sources:{pot_size:'ACCOUNT_CAPACITY'}}};
    function rows(sql,params=[]){
      const statement=db.prepare(sql);
      try{statement.bind(params);const result=[];
        while(statement.step())result.push(statement.getAsObject());return result;
      }finally{statement.free();}
    }
    // Derive the initial admitted pot value from this tab's loaded SQL image,
    // never synthesize UNKNOWN=0. The captured UI baseline stays stale on a
    // competing tab until that document explicitly reloads.
    v.current.pot_size=rows("SELECT total_capacity FROM account_capacity WHERE capacity_key='pot'")[0]?.total_capacity??null;
    function run(sql,params=[]){v.sqlWrites++;db.run(sql,params);}
    const env={
      Number,String,Error,Date,Object,
      localIso:()=> '2026-11-11T00:00:00.000+08:00',
      currentWeeklyContext:()=>({...v.current,
        pot_size:rows("SELECT total_capacity FROM account_capacity WHERE capacity_key='pot'")[0]?.total_capacity??null}),
      beginSqliteExclusiveWriteWindow:guard.beginSqliteExclusiveWriteWindow,
      withSqliteCoordinatedMutation:guard.withSqliteCoordinatedMutation,
      withPrimarySqliteMutationLock:async callback=>{
        if(v.denyLock)throw Error('SYNTHETIC_NATIVE_LOCK_DENIED');
        return s.withPrimarySqliteMutationLock(callback);
      },
      rows,run,begin:()=>run('BEGIN IMMEDIATE'),commit:()=>run('COMMIT'),
      rollback:()=>run('ROLLBACK'),
      async snapshot(reason){
        v.snapshots++;
        if(v.pauseSnapshot)await new Promise(resolve=>{v.releaseSnapshot=resolve;});
        return s.createSnapshot(db.export(),reason);
      },
      async persist({primaryMutationLease}={}){
        v.persistCount++;
        await s.saveDatabaseBytes(db.export(),{primaryMutationLease});
        if(v.ackLoss)throw Error('SYNTHETIC_POT_ACK_LOST_AFTER_SAVE');
      },
    };
    v.writer=new Function('env','with(env){'+source+';return saveAccountPotCapacity;}')(env);
    v.save=async(value,options={})=>{
      const current=options.current||v.current;
      try{
        return {ok:true,value:await v.writer({changed:true,needsAccountWrite:true,
          source:'MANUAL_WEEKLY_CONTEXT_UI',value},current)};
      }catch(e){return {ok:false,code:e.code||e.message};}
    };
    window.__pot=v;
  },code);
}
const save=(page,value,opts={})=>page.evaluate(([n,o])=>window.__pot.save(n,o),[value,opts]);
const persisted=page=>page.evaluate(async()=>Array.from(new Uint8Array(
  await window.__pot.storage.loadDatabaseBytes())));
function inspect(bytes){
  const sql=new SQL.Database(Uint8Array.from(bytes));
  try{
    const rows=sql.exec('SELECT capacity_key,total_capacity,used_count,source FROM account_capacity ORDER BY capacity_key')?.[0]?.values||[];
    return {pot:rows.find(x=>x[0]==='pot'),unrelated:rows.find(x=>x[0]==='unrelated')};
  }finally{sql.close();}
}
try{
  const a=await tab();
  await a.evaluate(async data=>{
    const s=await import('/assets/js/storage.js');
    await s.loadDatabaseBytes();
    await s.saveDatabaseBytes(Uint8Array.from(data));
  },seed);
  await install(a);
  const b=await tab();await install(b);
  assert.equal(await a.evaluate(()=>typeof navigator.locks?.request),'function');
  const first=await save(a,55);
  assert.deepEqual(first,{ok:true,value:55});
  assert.equal(inspect(await persisted(a)).pot[1],55);
  const stale=await save(b,70);
  assert.equal(stale.ok,false,JSON.stringify(stale));
  assert.match(stale.code,/STALE_REVISION_RELOAD_REQUIRED/);
  assert.deepEqual(await b.evaluate(()=>({
    snapshots:window.__pot.snapshots,sqlWrites:window.__pot.sqlWrites,
    persistCount:window.__pot.persistCount})),
    {snapshots:0,sqlWrites:0,persistCount:0});
  assert.equal(inspect(await persisted(a)).pot[1],55);
  console.log('PASS G265_861_PRODUCTION_NATIVE_TWO_TAB_STALE_ZERO_SQL_ZERO_SNAPSHOT');

  const changed=await tab();await install(changed);
  const wrongContext={authority_revision:'UNRELATED_REV',authority_context_id:'synthetic_import',
    week_start:'2026-11-09',pot_size:30,field_sources:{pot_size:'ACCOUNT_CAPACITY'}};
  const rejected=await save(changed,70,{current:wrongContext});
  assert.equal(rejected.ok,false);
  assert.match(rejected.code,/ACCOUNT_POT_.*RELOAD_REQUIRED/);
  assert.equal(await changed.evaluate(()=>window.__pot.snapshots),0);
  console.log('PASS G265_861_IMPORTED_AUTHORITY_RECHECK_BEFORE_SNAPSHOT');

  const fresh=await tab();await install(fresh);
  const second=await save(fresh,70);
  assert.deepEqual(second,{ok:true,value:70});
  const durable=inspect(await persisted(fresh));
  assert.deepEqual(durable.pot,['pot',70,7,'MANUAL_WEEKLY_CONTEXT_UI']);
  assert.deepEqual(durable.unrelated,['unrelated',123,2,'UNRELATED']);
  console.log('PASS G265_861_PRODUCTION_DURABLE_RELOAD_EXISTING_USED_COUNT_PRESERVED');

  const failed=await tab();await install(failed);
  const before=await persisted(fresh);
  const abort=await save(failed,99);
  assert.equal(abort.ok,false);
  assert.match(abort.code,/SYNTHETIC_POT_SQL_ABORT/);
  assert.deepEqual(await persisted(fresh),before);
  console.log('PASS G265_861_PRODUCTION_SQL_ABORT_ROLLBACK_ZERO_DURABLE_DELTA');

  // The same-page exclusive window must refuse a competing reentrant
  // submit before it can produce even a snapshot or SQL statement.
  const denied=await tab();await install(denied);
  await denied.evaluate(()=>{window.__pot.denyLock=true;});
  const lockDenied=await save(denied,75);
  assert.equal(lockDenied.ok,false);
  assert.equal(lockDenied.code,'SYNTHETIC_NATIVE_LOCK_DENIED');
  assert.equal(await denied.evaluate(()=>window.__pot.snapshots),0);
  assert.equal(await denied.evaluate(()=>window.__pot.sqlWrites),0);
  assert.deepEqual(await persisted(fresh),before);
  console.log('PASS G265_861_PRODUCTION_LOCK_DENIAL_PRE_SNAPSHOT_ZERO_SQL');

  const samePage=await tab();await install(samePage);
  await samePage.evaluate(()=>{window.__pot.pauseSnapshot=true;});
  const firstInFlight=samePage.evaluate(()=>window.__pot.save(75));
  await samePage.waitForFunction(()=>typeof window.__pot?.releaseSnapshot==='function');
  const overlapped=await save(samePage,90);
  assert.equal(overlapped.ok,false);
  assert.match(overlapped.code,/SQLITE_PRIMARY_MUTATION_SESSION_ACTIVE/);
  assert.equal(await samePage.evaluate(()=>window.__pot.sqlWrites),0);
  await samePage.evaluate(()=>{window.__pot.pauseSnapshot=false;window.__pot.releaseSnapshot();});
  const finished=await firstInFlight;
  assert.deepEqual(finished,{ok:true,value:75});
  assert.equal(inspect(await persisted(samePage)).pot[1],75);
  console.log('PASS G265_861_PRODUCTION_SAME_PAGE_INFLIGHT_NO_SECOND_SQL');

  const lost=await tab();await install(lost);
  await lost.evaluate(()=>{window.__pot.ackLoss=true;});
  const failure=await save(lost,80);
  assert.equal(failure.ok,false);
  assert.equal(failure.code,'SYNTHETIC_POT_ACK_LOST_AFTER_SAVE');
  const retry=await save(lost,90);
  assert.equal(retry.ok,false);
  assert.match(retry.code,/UNVERIFIED_RELOAD_REQUIRED/);
  assert.equal(await lost.evaluate(()=>window.__pot.persistCount),1);
  const reloaded=await tab();await install(reloaded);
  assert.equal(inspect(await persisted(reloaded)).pot[1],80);
  assert.deepEqual(inspect(await persisted(reloaded)).unrelated,durable.unrelated);
  console.log('PASS G265_861_PRODUCTION_ACK_LOSS_STICKY_HOLD_FRESH_RELOAD');
}finally{
  for(const p of pages)if(!p.isClosed())await p.close();
  await context.close();await browser.close();
}
