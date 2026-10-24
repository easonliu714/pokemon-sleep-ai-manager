import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual, presently unimported production-candidate source.
// Synthetic only: no player SQLite, IndexedDB, network or game-side writes.
const source=fs.readFileSync('assets/js/sqlite-persist-coordinator.js','utf8');
const context=vm.createContext({Promise,Error,TypeError,Object,Number,setTimeout,clearTimeout});
vm.runInContext(source.replace(/^export /gm,''),context,{timeout:3000});
const make=context.createSqlitePersistCoordinator;
assert.equal(typeof make,'function');
assert.match(source,/const bytes=capture\(\)/);
assert.match(source,/uncertain=true/);

const live=new Map([['draft','local']]);
let persisted='[]',releaseFirst,saveCalls=0,captureCalls=0;
const coordinator=make({
  capture:()=>{captureCalls++;return JSON.stringify([...live.entries()]);},
  save:async bytes=>{
    saveCalls++;
    if(saveCalls===1)await new Promise(resolve=>{releaseFirst=resolve;});
    persisted=bytes;
  },
  timeoutMs:5000
});
const first=coordinator.persist();
for(let i=0;i<50&&saveCalls<1;i++)await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(saveCalls,1);
live.set('independent-writer','new-value');
const second=coordinator.persist();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(saveCalls,1,'later writer must not begin save while earlier save is unresolved');
assert.equal(captureCalls,1,'later snapshot must be deferred until earlier save finishes');
releaseFirst();
const results=await Promise.all([first,second]);
assert.equal(results[0].status,'PERSISTED');
assert.equal(results[1].status,'PERSISTED');
assert.equal(saveCalls,2);
assert.equal(captureCalls,2);
assert.equal(new Map(JSON.parse(persisted)).get('independent-writer'),'new-value');
assert.equal(coordinator.status().status,'READY');

let failedCalls=0;
const failing=make({capture:()=>new Uint8Array([1]),save:async()=>{failedCalls++;throw Error('idb_failed');}});
await assert.rejects(failing.persist(),{code:'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED'});
await assert.rejects(failing.persist(),{code:'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED'});
assert.equal(failedCalls,1,'uncertain outcome must not trigger another save');
assert.equal(failing.status().status,'UNVERIFIED_RELOAD_REQUIRED');

let timeoutCalls=0;
const timed=make({capture:()=>new Uint8Array([2]),save:async()=>{timeoutCalls++;await new Promise(()=>{});},timeoutMs:15});
const timedPromise=timed.persist();
await new Promise(resolve=>setTimeout(resolve,30));
await assert.rejects(timedPromise,{code:'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED'});
await assert.rejects(timed.persist(),{code:'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED'});
assert.equal(timeoutCalls,1);
assert.equal(timed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.throws(()=>make({capture:null,save:()=>{}}),/INVALID_SQLITE_PERSIST_COORDINATOR/);
console.log('PASS G265_SHARED_SQLITE_PERSIST_COORDINATOR_SOURCE_BOUND_ORDER_AND_UNCERTAIN_HOLD');
console.log('HOLD G265_DATABASE_RUNTIME_WIRING_ALL_WRITERS_AND_ANDROID_UAT');
