// G265 independent production-source boundary: bare database.persist() ACK-loss
// must block later same-page legacy direct SQL writes and replacement.
// Synthetic SQL.js + mocked save only. No player SQLite, IndexedDB or migration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const read=p=>fs.readFileSync(p,'utf8');
const guard=read('assets/js/sqlite-direct-write-window-guard.js');
const coordinator=read('assets/js/sqlite-persist-coordinator.js');
const database=read('assets/js/database.js');
assert.match(database,/markSqliteDurabilityUncertain\(\)/);
assert.match(database,/sqlitePersistCoordinator\.status\(\)\.status==='UNVERIFIED_RELOAD_REQUIRED'/);
assert.match(guard,/export function markSqliteDurabilityUncertain\(\)/);
const SQL=await initSqlJs();
function runtime(saveDatabaseBytes){
  const fixture=new SQL.Database();
  fixture.run('CREATE TABLE bare_persist_gate (id TEXT PRIMARY KEY)');
  const context=vm.createContext({Promise,Error,TypeError,Object,Number,Uint8Array,
    setTimeout,clearTimeout,console,saveDatabaseBytes,fixture});
  vm.runInContext(guard.replace(/^export /gm,''),context,{timeout:3000});
  vm.runInContext(coordinator.replace(/^export /gm,''),context,{timeout:3000});
  vm.runInContext(database.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),context,{timeout:3000});
  vm.runInContext('db=fixture;rescueReadonly=false;',context,{timeout:3000});
  return {context,fixture};
}
{
  let acknowledged=0;
  const {context,fixture}=runtime(async()=>{acknowledged++;});
  context.run("INSERT INTO bare_persist_gate VALUES ('first')");
  await context.persist();
  assert.equal(acknowledged,1);
  assert.equal(context.getSqliteDirectWriteGuardStatus().status,'READY');
  context.run("INSERT INTO bare_persist_gate VALUES ('after-success')");
  assert.equal(fixture.exec('SELECT COUNT(*) FROM bare_persist_gate')[0].values[0][0],2);
  fixture.close();
  console.log('PASS G265_BARE_PERSIST_ACKNOWLEDGED_LEGACY_RUN_REMAINS_ALLOWED');
}
{
  let saveAttempts=0;
  const {context,fixture}=runtime(async()=>{saveAttempts++;throw Error('synthetic_IDB_ACK_LOSS');});
  context.run("INSERT INTO bare_persist_gate VALUES ('before-failure')");
  await assert.rejects(context.persist(),e=>e.code==='SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED');
  assert.equal(saveAttempts,1);
  assert.equal(context.getSqlitePersistStatus().status,'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(context.getSqliteDirectWriteGuardStatus().status,'UNVERIFIED_RELOAD_REQUIRED');
  for(const operation of [
    ()=>context.run("INSERT INTO bare_persist_gate VALUES ('forbidden')"),
    ()=>context.begin(),
    ()=>context.commit(),
    ()=>context.withSqliteCoordinatedMutation(()=>context.run("INSERT INTO bare_persist_gate VALUES ('privileged-forbidden')"))
  ])assert.throws(operation,e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  await assert.rejects(context.replaceDatabase(new Uint8Array([1,2,3])),
    e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  await assert.rejects(context.persist(),
    e=>e.code==='SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED');
  assert.equal(saveAttempts,1,'unknown durable result must never trigger a second save');
  assert.equal(fixture.exec('SELECT COUNT(*) FROM bare_persist_gate')[0].values[0][0],1);
  fixture.close();
  console.log('PASS G265_BARE_PERSIST_ACK_LOSS_STICKY_DIRECT_RUN_BEGIN_COMMIT_REPLACE_HOLD');
}
console.log('HOLD G265_CROSS_TAB_AND_23_LEGACY_GLOBAL_ADMISSION_NOT_VERIFIED');
