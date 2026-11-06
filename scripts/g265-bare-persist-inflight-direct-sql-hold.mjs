// G265 negative-first: a bare database.persist() with pending raw-byte IDB save
// must block same-page SQL mutation even when the old write-session privilege is used.
// Source-bound production VM + disposable SQL.js only; no player SQLite/IDB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const read=path=>fs.readFileSync(path,'utf8');
const guard=read('assets/js/sqlite-direct-write-window-guard.js');
const coordinator=read('assets/js/sqlite-persist-coordinator.js');
const database=read('assets/js/database.js');
const SQL=await initSqlJs();
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function until(predicate){
  for(let i=0;i<100&&!predicate();i++)await tick();
  assert.ok(predicate(),'expected save attempt never started');
}
function runtime(saveDatabaseBytes){
  const fixture=new SQL.Database();
  fixture.run('CREATE TABLE bare_inflight_gate (id TEXT PRIMARY KEY)');
  const context=vm.createContext({Promise,Error,TypeError,Object,Number,Uint8Array,
    setTimeout,clearTimeout,console,saveDatabaseBytes,fixture});
  vm.runInContext(guard.replace(/^export /gm,''),context,{timeout:3000});
  vm.runInContext(coordinator.replace(/^export /gm,''),context,{timeout:3000});
  vm.runInContext(database.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),context,{timeout:3000});
  vm.runInContext('db=fixture;rescueReadonly=false;',context,{timeout:3000});
  return {context,fixture};
}
function blocked(context){
  for(const op of [
    ()=>context.run("INSERT INTO bare_inflight_gate VALUES ('blocked')"),
    ()=>context.begin(),
    ()=>context.commit(),
    ()=>context.withSqliteCoordinatedMutation(()=>context.run("INSERT INTO bare_inflight_gate VALUES ('privileged-blocked')"))
  ])assert.throws(op,e=>e.code==='SQLITE_DIRECT_WRITE_BLOCKED_DURING_PERSIST');
  return assert.rejects(context.replaceDatabase(new Uint8Array([1,2,3])),
    e=>e.code==='SQLITE_DIRECT_WRITE_BLOCKED_DURING_PERSIST');
}
{
  let releaseFirst,releaseSecond,attempts=0;
  const {context,fixture}=runtime(async()=>{
    attempts++;
    await new Promise(resolve=>{if(attempts===1)releaseFirst=resolve;else releaseSecond=resolve;});
  });
  context.run("INSERT INTO bare_inflight_gate VALUES ('before')");
  const first=context.persist();
  await until(()=>attempts===1);
  assert.equal(context.getSqliteDirectWriteGuardStatus().status,'IN_FLIGHT');
  await blocked(context);
  const second=context.persist();
  releaseFirst();
  await first;
  await until(()=>attempts===2);
  assert.equal(context.getSqliteDirectWriteGuardStatus().status,'IN_FLIGHT',
    'first ACK cannot reopen direct SQL while second bare save remains pending');
  await blocked(context);
  releaseSecond();
  await second;
  assert.equal(context.getSqliteDirectWriteGuardStatus().status,'READY');
  context.run("INSERT INTO bare_inflight_gate VALUES ('after-ack')");
  assert.equal(fixture.exec('SELECT COUNT(*) FROM bare_inflight_gate')[0].values[0][0],2);
  assert.equal(attempts,2);
  fixture.close();
  console.log('PASS G265_BARE_PERSIST_PENDING_AND_QUEUED_SAVES_BLOCK_ALL_SAME_PAGE_SQL');
}
{
  let release,attempts=0;
  const {context,fixture}=runtime(async()=>{
    attempts++;
    await new Promise(resolve=>{release=resolve;});
    throw Error('synthetic_lost_IDB_ACK');
  });
  context.run("INSERT INTO bare_inflight_gate VALUES ('before-failure')");
  const pending=context.persist();
  await until(()=>attempts===1);
  await blocked(context);
  release();
  await assert.rejects(pending,e=>e.code==='SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED');
  assert.equal(context.getSqliteDirectWriteGuardStatus().status,'UNVERIFIED_RELOAD_REQUIRED');
  assert.throws(()=>context.run("INSERT INTO bare_inflight_gate VALUES ('forbidden')"),
    e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(attempts,1);
  fixture.close();
  console.log('PASS G265_BARE_PERSIST_PENDING_THEN_ACK_LOSS_REMAINS_STICKY');
}
console.log('HOLD G265_CROSS_TAB_RAW_BYTE_GLOBAL_ADMISSION_NOT_VERIFIED');
