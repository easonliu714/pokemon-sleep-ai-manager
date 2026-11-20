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
