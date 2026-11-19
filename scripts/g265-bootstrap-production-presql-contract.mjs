// G265 #861: production database initializeDatabase() must acquire the native
// primary lease before schema/Seed/Migration SQL and exact-lease durable ACK.
// This intentionally FAILS on the prior unadmitted bootstrap; no player data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../assets/js/database.js',import.meta.url),'utf8');
const start=src.indexOf('export async function initializeDatabase(){');
const end=src.indexOf('\nexport function requestForcedDatabaseLoad()',start);
assert.ok(start>=0&&end>start,'G265 bootstrap production function not found');
const boot=src.slice(start,end);
const reserve=boot.indexOf('beginSqliteExclusiveWriteWindow(');
const lease=boot.indexOf('withPrimarySqliteMutationLock(');
const ddl=boot.indexOf('db.run(DDL)');
const seed=boot.indexOf('db.run(SEED_SQL)');
const migration=boot.indexOf('applyAllMigrations(db)');
assert.ok(reserve>=0,'G265_BOOTSTRAP_SAME_PAGE_EXCLUSIVE_WINDOW_MISSING');
assert.ok(lease>reserve,'G265_BOOTSTRAP_NATIVE_LEASE_MISSING');
assert.ok(ddl>lease&&seed>lease&&migration>lease,
  'G265_BOOTSTRAP_NATIVE_PRE_SQL_ADMISSION_REQUIRED');
assert.match(boot,/persist\s*\(\s*\{\s*primaryMutationLease\s*:\s*lease\s*\}\s*\)/,
  'G265_BOOTSTRAP_EXACT_LEASE_DURABLE_ACK_REQUIRED');
assert.match(boot,/close\s*\(\s*\{\s*uncertainOutcome\s*:\s*!acknowledged\s*\}\s*\)/,
  'G265_BOOTSTRAP_UNCERTAIN_ACK_STICKY_HOLD_REQUIRED');
assert.match(boot,/withSqliteCoordinatedMutation\s*\(/,
  'G265_BOOTSTRAP_COORDINATED_SCOPED_SQL_REQUIRED');
assert.match(boot,/dispatchReadyAsync\s*\(\s*detail\s*\)/,
  'G265_BOOTSTRAP_POST_ACK_READY_DISPATCH_REQUIRED');
console.log('PASS G265_BOOTSTRAP_PRODUCTION_NATIVE_PRE_SQL_SOURCE_BOUND');