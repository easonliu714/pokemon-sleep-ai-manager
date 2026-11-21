import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {createSqlitePersistCoordinator} from '../assets/js/sqlite-persist-coordinator.js';
import {createSqliteWriteSessionCoordinator} from '../assets/js/sqlite-write-session-coordinator.js';

// G265 independent cross-tab negative fixture, not a multi-tab fix or UAT.
// Two independent VM globals behave as separate tabs with separate SQL.js memory,
// coordinators and direct-run guards but one synthetic durable IndexedDB byte slot.
const read=p=>fs.readFileSync(p,'utf8');
const dbSource=read('assets/js/database.js');
const guardSource=read('assets/js/sqlite-direct-write-window-guard.js');
const runtimeSource=read('assets/js/sqlite-write-session-runtime.js');
assert.match(dbSource,/createSqlitePersistCoordinator\(/);
assert.match(dbSource,/assertSqliteDirectWriteAllowed\(\);db\.run\(sql,params\)/);
// Production now has stronger exclusive + native admission. Keep this legacy
// negative fixture deliberately without REAL native lock/CAS enforcement.
assert.match(runtimeSource,/beginSqliteExclusiveWriteWindow\(\)/);
assert.match(runtimeSource,/admit:withPrimarySqliteMutationLock/);
assert.match(runtimeSource,/persist:options=>withSqliteCoordinatedMutation\(\(\)=>persistDatabase\(options\)\)/);
assert.doesNotMatch(runtimeSource,/navigator\.locks|BroadcastChannel/,'cross-tab policy changed: independently re-audit');
assert.doesNotMatch(dbSource,/navigator\.locks|BroadcastChannel/,'database cross-tab policy changed: independently re-audit');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE g265_tab_change (id TEXT PRIMARY KEY, tab TEXT NOT NULL)');
seed.run("INSERT INTO g265_tab_change VALUES('seed','initial')");
let durable=new Uint8Array(seed.export());
seed.close();
let serial=0;
function openTab(name){
  // Each tab explicitly opens bytes from the same initial durable state.
  const fixture=new SQL.Database(new Uint8Array(durable));
  const initialDigest=Array.from(durable).length;
  let syntheticAdmissions=0;
  const syntheticLease=Object.freeze({tab:name});
  const ctx=vm.createContext({
    Promise,Error,TypeError,Object,Number,Uint8Array,console,setTimeout,clearTimeout,
    fixture,createSqlitePersistCoordinator,createSqliteWriteSessionCoordinator,
    createSnapshot:async()=>({status:'synthetic-snapshot-ack'}),
    // Synthetic tab-only lease deliberately DOES NOT implement cross-tab native
    // revision comparison; preserve the historical negative stale-overwrite
    // reproduction. Actual Chromium/IDB admission is tested separately.
    withPrimarySqliteMutationLock:async callback=>{syntheticAdmissions++;return callback(syntheticLease);},
    saveDatabaseBytes:async(bytes,{primaryMutationLease}={})=>{
      assert.equal(primaryMutationLease,syntheticLease,'VM opt-in persist must keep its synthetic lease');
      durable=new Uint8Array(bytes);serial++;
    }
  });
  vm.runInContext(guardSource.replace(/^export /gm,''),ctx,{timeout:3000});
  vm.runInContext(dbSource.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),ctx,{timeout:3000});
  vm.runInContext('db=fixture;rescueReadonly=false;',ctx,{timeout:3000});
  // The VM strips ESM imports; preserve the actual runtime's aliased import.
  assert.match(runtimeSource,/persist as persistDatabase/);
  vm.runInContext('const persistDatabase=persist;',ctx,{timeout:3000});
  vm.runInContext(runtimeSource.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,''),ctx,{timeout:3000});
  assert.equal(ctx.getSqliteDirectWriteGuardStatus().status,'READY',name);
  return {name,ctx,fixture,initialDigest,admissions:()=>syntheticAdmissions};
}
const tabA=openTab('tab-A');
const tabB=openTab('tab-B'); // stale after A commits, but loaded BEFORE A commits
assert.equal(tabA.initialDigest,tabB.initialDigest);
assert.equal((await tabA.ctx.runSqliteWriteSession({
  reason:'tab-A:first-write',
  mutate:()=>tabA.ctx.run("INSERT INTO g265_tab_change VALUES('A','tab-A')")
})).status,'PERSISTED');
let check=new SQL.Database(durable);
assert.equal(check.exec("SELECT COUNT(*) FROM g265_tab_change WHERE id='A'")[0].values[0][0],1);
check.close();
assert.equal(tabA.ctx.getSqliteWriteSessionStatus().status,'READY');
assert.equal(tabB.ctx.getSqliteWriteSessionStatus().status,'READY');
// Tab B has no durable reload/fingerprint gate. Its per-tab queue is READY,
// so B persists an old SQLite image and overwrites the durable A write.
assert.equal((await tabB.ctx.runSqliteWriteSession({
  reason:'tab-B:stale-writer',
  mutate:()=>tabB.ctx.run("INSERT INTO g265_tab_change VALUES('B','tab-B')")
})).status,'PERSISTED');
check=new SQL.Database(durable);
const rows=check.exec('SELECT id FROM g265_tab_change ORDER BY id')[0].values.flat();
assert.deepEqual(rows,['B','seed'],'two independent tabs must reproduce stale overwrite without shared reload');
check.close();
assert.equal(serial,2);
assert.equal(tabA.admissions(),1,'historical VM A must enter its synthetic admission');
assert.equal(tabB.admissions(),1,'historical VM B must enter its synthetic admission');
assert.equal(tabA.ctx.getSqliteDirectWriteGuardStatus().status,'READY');
assert.equal(tabB.ctx.getSqliteDirectWriteGuardStatus().status,'READY');
tabA.fixture.close();tabB.fixture.close();
console.log('PASS G265_TWO_TAB_SOURCE_BOUND_REAL_SQLITE_DISPOSABLE_VM');
console.log('REPRODUCED_HOLD G265_HISTORICAL_VM_WITHOUT_NATIVE_REVISION_CAS_CAN_OVERWRITE_STALE_IMAGE');
console.log('HOLD G265_CROSS_TAB_EXCLUSIVE_LOCK_DURABLE_RELOAD_VERSION_CHECK_ANDROID_UAT');
