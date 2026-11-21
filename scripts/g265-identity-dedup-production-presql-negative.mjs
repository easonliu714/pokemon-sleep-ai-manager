// G265 21st writer: source-bound negative-first witness, NOT a Chromium/Android PASS.
// This intentionally fails against the 2026-11-22 protected-main production writer.
// It must remain red until a real native pre-SQL admission + lease-bound persist repair.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../assets/js/identity-dedup.js', import.meta.url), 'utf8');
const match = source.match(/export async function repairPokemonDuplicates\(\)\s*\{([\s\S]*?)\n\}\n/);
assert.ok(match, 'production repairPokemonDuplicates() must exist');
const body = match[1];
const firstPlayerRead = body.indexOf('active()');
const firstSnapshot = body.indexOf('snapshot(');
const firstSql = body.indexOf('begin()');
const nativeLock = body.indexOf('withPrimarySqliteMutationLock(');
const samePage = body.indexOf('beginSqliteExclusiveWriteWindow(');
const persistLease = body.indexOf('persist({primaryMutationLease:');
assert.ok(firstPlayerRead >= 0 && firstSnapshot > firstPlayerRead && firstSql > firstSnapshot,
  'witness must locate actual production player read, snapshot and SQL transaction');
assert.ok(samePage >= 0 && samePage < firstPlayerRead,
  'FAIL: same-page exclusive admission must precede the first player read');
assert.ok(nativeLock >= 0 && nativeLock < firstPlayerRead,
  'FAIL: native primary mutation lease must precede the first player read');
assert.ok(persistLease > firstSql,
  'FAIL: durable primary persist must carry the exact native lease');
assert.ok(!/catch\s*\([^)]*\)\s*\{[^}]*return 0;/.test(body),
  'FAIL: unknown durable ACK cannot silently return success-like zero and permit blind retry');
console.log('PASS_G265_IDENTITY_DEDUP_SOURCE_BOUND_PRESQL_CONTRACT');
// This is only a precondition. Final DoD additionally requires disposable actual-production
// Chromium two-tab Web Locks/IDB stale zero-SQL, rollback, SHA/revision, ACK-loss sticky readback.
