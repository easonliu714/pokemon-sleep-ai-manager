// G265 #861: negative-first audit of the actual public-event refresh writer.
// This source-bound gate intentionally fails until native pre-SQL admission is
// wired. It does not access player SQLite, IndexedDB, or production PWA storage.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/js/public-event-master-store.js',import.meta.url),'utf8');
const refresh=source.slice(source.indexOf('export async function refreshPublicEventMaster('));
assert.ok(refresh.startsWith('export async function refreshPublicEventMaster('),'production refresh function missing');
assert.match(refresh,/withPrimarySqliteMutationLock\s*\(/,'native cross-tab primary lease must be acquired by public event refresh');
assert.match(refresh,/beginSqliteExclusiveWriteWindow\s*\(/,'same-page direct writes must be held before refresh SQL');
assert.match(refresh,/persist\s*\(\s*\{\s*primaryMutationLease\s*:\s*lease\s*\}\s*\)/,'durable persist must use the exact admitted primary lease');
assert.match(refresh,/withSqliteCoordinatedMutation\s*\(/,'transaction and persist must share a coordinated mutation window');
console.log('PASS G265_PUBLIC_EVENT_REFRESH_PRODUCTION_NATIVE_ADMISSION_SOURCE_BOUND');
