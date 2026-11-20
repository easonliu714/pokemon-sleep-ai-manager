// G265 negative-first admission contract for the actual weekly activity bonus writer.
// Disposable source inspection only: never opens a player database or IndexedDB.
// This MUST fail against the legacy FIFO-only implementation until a native
// cross-tab pre-SQL lease is acquired and held through durable persistence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const writer=read('assets/js/weekly-manual-activity-bonuses.js');
const runtime=read('assets/js/sqlite-write-session-runtime.js');
const coordinator=read('assets/js/sqlite-write-session-coordinator.js');
// Behavioral negative-first: exercise the real coordinator, not a source-string
// approximation. A denied native admission must leave snapshot/SQL/persist at zero.
// The legacy coordinator currently has no admission dependency and will fail this
// assertion; do not count this as a passing native Chromium or Android test.
import {createSqliteWriteSessionCoordinator} from '../assets/js/sqlite-write-session-coordinator.js';
// Independent production-coordinator durable ACK-loss regression: a COMMIT can
// have happened before persist rejects. Do not re-enter SQL on the same page.
const ackEvents=[];
const ackCoordinator=createSqliteWriteSessionCoordinator({
  snapshot:async()=>{ackEvents.push('snapshot');},
  begin:()=>{ackEvents.push('begin');},
  commit:()=>{ackEvents.push('commit');},
  rollback:()=>{ackEvents.push('rollback');},
  persist:async()=>{ackEvents.push('persist');throw Object.assign(new Error('ACK_DROPPED'),{code:'ACK_DROPPED'});},
  timeoutMs:30000
});
const first=await ackCoordinator.execute({
  reason:'disposable postcommit ACK loss',
  mutate:()=>{ackEvents.push('sql-mutate');}
}).then(()=>({accepted:true}),error=>({accepted:false,code:error?.code}));
assert.deepEqual(first,{accepted:false,code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'},
  'COMMIT followed by missing durable ACK must be uncertain, not success');
assert.equal(ackCoordinator.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const beforeRetry=ackEvents.slice();
const second=await ackCoordinator.execute({
  reason:'same-page retry must be denied',
  mutate:()=>{ackEvents.push('forbidden-retry-sql');}
}).then(()=>({accepted:true}),error=>({accepted:false,code:error?.code}));
assert.deepEqual(second,{accepted:false,code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
assert.deepEqual(ackEvents,beforeRetry,
  'Sticky uncertainty must reject same-page retry before snapshot/SQL/persist');
console.log('PASS_G265_WEEKLY_ACTIVITY_POSTCOMMIT_ACK_LOSS_STICKY_NO_RETRY');

// Negative-first SQL mutation failure: rollback must occur and no durable persist.
// This checks the production coordinator's existing rollback contract independently
// of the intentionally red native lease-admission assertion below.
const rollbackEvents=[];
const rollbackCoordinator=createSqliteWriteSessionCoordinator({
  snapshot:async()=>{rollbackEvents.push('snapshot');},
  begin:()=>{rollbackEvents.push('begin');},
  commit:()=>{rollbackEvents.push('commit');},
  rollback:()=>{rollbackEvents.push('rollback');},
  persist:async()=>{rollbackEvents.push('persist');}
});
const rollbackResult=await rollbackCoordinator.execute({
  reason:'disposable SQL mutation failure',
  mutate:()=>{rollbackEvents.push('mutate');throw Object.assign(new Error('SQL_MUTATION_FAILED'),{code:'SQL_MUTATION_FAILED'});}
}).then(()=>({accepted:true}),error=>({accepted:false,code:error?.code}));
assert.deepEqual(rollbackResult,{accepted:false,code:'SQL_MUTATION_FAILED'});
assert.deepEqual(rollbackEvents,['snapshot','begin','mutate','rollback'],
  'SQL mutation failure must rollback without COMMIT or durable persist');
console.log('PASS_G265_WEEKLY_ACTIVITY_SQL_MUTATION_ROLLBACK_NO_PERSIST');

// Negative-first snapshot rejection: a failed pre-SQL snapshot must not BEGIN,
// mutate, COMMIT, or persist. Keep this independent of the native admission red gate.
const snapshotEvents=[];
const snapshotCoordinator=createSqliteWriteSessionCoordinator({
  snapshot:async()=>{snapshotEvents.push('snapshot');throw Object.assign(new Error('SNAPSHOT_DENIED'),{code:'SNAPSHOT_DENIED'});},
  begin:()=>{snapshotEvents.push('begin');},
  commit:()=>{snapshotEvents.push('commit');},
  rollback:()=>{snapshotEvents.push('rollback');},
  persist:async()=>{snapshotEvents.push('persist');}
});
const snapshotResult=await snapshotCoordinator.execute({
  reason:'disposable snapshot failure before SQL',
  mutate:()=>{snapshotEvents.push('sql-mutate');}
}).then(()=>({accepted:true}),error=>({accepted:false,code:error?.code}));
assert.deepEqual(snapshotResult,{accepted:false,code:'SNAPSHOT_DENIED'});
assert.deepEqual(snapshotEvents,['snapshot'],
  'Snapshot failure must never enter SQL or durable persist');
console.log('PASS_G265_WEEKLY_ACTIVITY_SNAPSHOT_FAILURE_ZERO_SQL');

// G265 negative-first async mutation containment: a thenable SQL mutation can
// continue after rollback. Production must stickily quarantine this page and
// never allow a second snapshot, SQL transaction or durable persist.
const thenableEvents=[];
const thenableCoordinator=createSqliteWriteSessionCoordinator({
  snapshot:async()=>{thenableEvents.push('snapshot');},
  begin:()=>{thenableEvents.push('begin');},
  commit:()=>{thenableEvents.push('commit');},
  rollback:()=>{thenableEvents.push('rollback');},
  persist:async()=>{thenableEvents.push('persist');}
});
const thenableFirst=await thenableCoordinator.execute({
  reason:'disposable thenable mutation containment',
  mutate:()=>{thenableEvents.push('mutate');return Promise.resolve('late');}
}).then(()=>({accepted:true}),error=>({accepted:false,code:error?.code}));
assert.deepEqual(thenableFirst,{accepted:false,code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
assert.deepEqual(thenableEvents,['snapshot','begin','mutate','rollback'],
  'Thenable mutation must rollback, never COMMIT or persist');
assert.equal(thenableCoordinator.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const thenableBeforeRetry=thenableEvents.slice();
const thenableSecond=await thenableCoordinator.execute({
  reason:'forbidden second mutation after thenable',
  mutate:()=>{thenableEvents.push('forbidden-mutate');}
}).then(()=>({accepted:true}),error=>({accepted:false,code:error?.code}));
assert.deepEqual(thenableSecond,{accepted:false,code:'SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED'});
assert.deepEqual(thenableEvents,thenableBeforeRetry,
  'Unsafe thenable must block all same-page retry work before snapshot');
console.log('PASS_G265_WEEKLY_ACTIVITY_THENABLE_MUTATION_STICKY_ZERO_RETRY');

// Deliberately red native admission regression remains the release blocker.
const events=[];
const coordinator=createSqliteWriteSessionCoordinator({
  snapshot:async()=>{events.push('snapshot');},
  begin:()=>{events.push('begin');},
  commit:()=>{events.push('commit');},
  rollback:()=>{events.push('rollback');},
  persist:async()=>{events.push('persist');},
  timeoutMs:30000
});
const result=await coordinator.execute({
  reason:'negative-first: native admission denied',
  mutate:()=>{events.push('sql-mutate');}
}).then(()=>({accepted:true}),error=>({accepted:false,code:error?.code}));
assert.equal(result.accepted,false,
  'FAIL_NATIVE_LEASE_DENIAL: a missing/denied native lease must reject before snapshot');
assert.deepEqual(events,[],
  'FAIL_ZERO_PRE_SQL: denied admission must never snapshot, BEGIN, mutate, COMMIT or persist');


// Source contract runs after the executable denied-admission regression.
assert.match(writer,/export async function saveWeeklyManualActivityBonus\(/,
  'The exact production named writer must remain the test target');
assert.match(writer,/runSqliteWriteSession\(/,
  'Do not silently bypass the existing FIFO/rollback behavior');
assert.match(runtime,/withPrimarySqliteMutationLock/,
  'FAIL_NATIVE_ADMISSION: the runtime must acquire native primary Web Lock before snapshot/SQL');
assert.match(runtime,/beginSqliteExclusiveWriteWindow/,
  'FAIL_SAME_PAGE_WINDOW: reserve a same-page exclusive window before native lock wait');
assert.match(coordinator,/primaryMutationLease/,
  'FAIL_LEASE_PROPAGATION: coordinator must carry the same opaque lease to durable persist');
assert.match(coordinator,/persist\(\{primaryMutationLease/,
  'FAIL_BARE_PERSIST: never persist the primary SQLite image without the acquired lease');
assert.match(coordinator,/blocked=true;throw uncertain\(cause\)/,
  'Postcommit ACK uncertainty must remain sticky fail-closed');
console.log('PASS_G265_WEEKLY_ACTIVITY_NATIVE_ADMISSION_SOURCE_CONTRACT');


