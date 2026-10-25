import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// G265 source-bound synthetic-only fixture: actual candidate coordinator code.
// Does NOT migrate production writers or access IndexedDB / player data.
const source=fs.readFileSync('assets/js/sqlite-write-session-coordinator.js','utf8');
const database=fs.readFileSync('assets/js/database.js','utf8');
assert.match(database,/export function begin\(\)/);
assert.match(database,/export function commit\(\)/);
assert.match(database,/export async function snapshot\(reason\)/);
assert.match(database,/export async function persist\(\)/);
assert.doesNotMatch(database,/sqlite-write-session-coordinator\.js/,'candidate must remain unbound');
const ctx=vm.createContext({Promise,Error,TypeError,Object,Number,setTimeout,clearTimeout});
vm.runInContext(source.replace(/^export /gm,''),ctx,{timeout:3000});
const make=ctx.createSqliteWriteSessionCoordinator;
assert.equal(typeof make,'function');

const events=[],rows=new Map();let inTx=false,backup=null,releaseFirst;
const gate=new Promise(resolve=>{releaseFirst=resolve;});
const coordinator=make({
  snapshot:async reason=>{events.push('snapshot:'+reason);if(reason==='A')await gate;},
  begin:()=>{assert.equal(inTx,false);inTx=true;backup=new Map(rows);events.push('begin');},
  commit:()=>{assert.equal(inTx,true);inTx=false;events.push('commit');},
  rollback:()=>{rows.clear();for(const [k,v] of backup)rows.set(k,v);inTx=false;events.push('rollback');},
  persist:async()=>{assert.equal(inTx,false);events.push('persist');}
});
const a=coordinator.execute({reason:'A',mutate:()=>{rows.set('A',1);events.push('mutate:A');}});
await new Promise(resolve=>setTimeout(resolve,0));
const b=coordinator.execute({reason:'B',mutate:()=>{assert.equal(rows.get('A'),1);rows.set('B',2);events.push('mutate:B');}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(events,['snapshot:A'],'B cannot snapshot before A finishes');
releaseFirst();
assert.equal((await a).status,'PERSISTED');
assert.equal((await b).status,'PERSISTED');
assert.deepEqual(events,['snapshot:A','begin','mutate:A','commit','persist','snapshot:B','begin','mutate:B','commit','persist']);
assert.equal(rows.get('B'),2);

let snapshotFailures=0,mutationCount=0,rollbackCount=0;
const rollbackGate=make({snapshot:async()=>{if(++snapshotFailures===1)throw Error('snapshot failed');},
  begin:()=>{},commit:()=>{},rollback:()=>{rollbackCount++;},persist:async()=>{}});
await assert.rejects(rollbackGate.execute({reason:'snapshot-reject',mutate:()=>{mutationCount++;}}),/snapshot failed/);
assert.equal(mutationCount,0);
await assert.rejects(rollbackGate.execute({reason:'mutation-throw',mutate:()=>{throw Error('bad mutation');}}),/bad mutation/);
assert.equal(rollbackCount,1);
assert.equal((await rollbackGate.execute({reason:'safe-after-rollback',mutate:()=>{mutationCount++;}})).status,'PERSISTED');
assert.equal(mutationCount,1);

let persistCalls=0,mutationCalls=0;
const failing=make({snapshot:async()=>{},begin:()=>{},commit:()=>{},rollback:()=>{},persist:async()=>{persistCalls++;throw Error('idb failed');}});
await assert.rejects(failing.execute({reason:'fail',mutate:()=>{mutationCalls++;}}),{code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
await assert.rejects(failing.execute({reason:'must-hold',mutate:()=>{mutationCalls++;}}),{code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
assert.equal(persistCalls,1);assert.equal(mutationCalls,1);
assert.equal(failing.status().status,'UNVERIFIED_RELOAD_REQUIRED');

let timeoutMutation=0;
const timeoutGate=make({snapshot:()=>new Promise(()=>{}),begin:()=>{timeoutMutation++;},commit:()=>{},rollback:()=>{},persist:async()=>{},timeoutMs:10});
await assert.rejects(timeoutGate.execute({reason:'timeout',mutate:()=>{timeoutMutation++;}}),{code:'SQLITE_WRITE_SESSION_SNAPSHOT_TIMEOUT'});
await assert.rejects(timeoutGate.execute({reason:'later',mutate:()=>{timeoutMutation++;}}),{code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
assert.equal(timeoutMutation,0);

let asyncMutationCalls=0;
const asyncGate=make({snapshot:async()=>{},begin:()=>{},commit:()=>{},rollback:()=>{rollbackCount++;},persist:async()=>{}});
await assert.rejects(asyncGate.execute({reason:'async',mutate:async()=>{asyncMutationCalls++;}}),{code:'SQLITE_WRITE_SESSION_ASYNC_MUTATION_FORBIDDEN'});
assert.equal(asyncMutationCalls,0);
assert.equal(asyncGate.status().status,'READY');
await assert.rejects(asyncGate.execute({reason:'thenable',mutate:()=>Promise.resolve('unsafe')}),{code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
assert.equal(asyncGate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const commitFailure=make({snapshot:async()=>{},begin:()=>{},commit:()=>{throw Error('commit uncertain');},rollback:()=>{},persist:async()=>{}});
await assert.rejects(commitFailure.execute({reason:'commit-unknown',mutate:()=>{}}),{code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
assert.equal(commitFailure.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rollbackFailure=make({snapshot:async()=>{},begin:()=>{},commit:()=>{},rollback:()=>{throw Error('rollback failed');},persist:async()=>{}});
await assert.rejects(rollbackFailure.execute({reason:'rollback-unknown',mutate:()=>{throw Error('mutate failed');}}),{code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
assert.equal(rollbackFailure.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.throws(()=>make({snapshot:null}),/INVALID_SQLITE_WRITE_SESSION_COORDINATOR/);
console.log('PASS G265_SHARED_WRITE_SESSION_SOURCE_BOUND_FIFO_SNAPSHOT_SQL_COMMIT_PERSIST_ROLLBACK_FAIL_CLOSED');
console.log('HOLD G265_ALL_WRITER_RUNTIME_WIRING_MULTI_TAB_ANDROID_UAT');
