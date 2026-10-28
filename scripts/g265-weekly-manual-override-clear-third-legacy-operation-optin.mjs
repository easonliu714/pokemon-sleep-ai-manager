import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createWeeklyManualOverrideClearOptIn,createWeeklyManualOverrideClearNoopProbe} from '../assets/js/sqlite-weekly-manual-override-clear-optin.js';

// Third exact legacy operation: source-bound, isolated, never production-wired.
const legacy=fs.readFileSync(new URL('../assets/js/weekly-context-manual-override.js',import.meta.url),'utf8');
const original=legacy.split('export async function clearWeeklyManualOverride(')[1];
assert.ok(original,'clearWeeklyManualOverride legacy writer must exist');
assert.match(original,/await snapshot\('manual:weekly-context-override-clear'\)/);
assert.match(original,/run\('DELETE FROM settings WHERE key=\?',\[settingKey\(epoch\)\]\)/);
assert.match(original,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-weekly-manual-override-clear-optin/);
console.log('PASS G265_WEEKLY_CLEAR_THIRD_EXACT_LEGACY_OPERATION_SOURCE_BOUND_NOT_WIRED');

globalThis.indexedDB=indexedDB;
const {saveDatabaseBytes,loadDatabaseBytes,closeStorageConnection}=await import('../assets/js/storage.js');
const SQL=await initSqlJs();
const sql=new SQL.Database();
sql.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
sql.run("INSERT INTO settings VALUES('unrelated','retain-me','2026-10-01T00:00:00.000Z')");
sql.run("INSERT INTO settings VALUES('weekly_context_manual_override:2026-10-26','delete-me','2026-10-26T00:00:00.000Z')");
sql.run("INSERT INTO settings VALUES('weekly_context_manual_override:2026-11-02','must-survive','2026-11-02T00:00:00.000Z')");
sql.run("CREATE TRIGGER deny_clear BEFORE DELETE ON settings WHEN OLD.key='weekly_context_manual_override:2026-11-02' BEGIN SELECT RAISE(ABORT,'synthetic-delete-denial'); END");
const seed=new Uint8Array(sql.export());sql.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
await saveDatabaseBytes(seed);
const db=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('pokemon_sleep_ai_manager');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
const seedHash=await hash(seed);
await new Promise((resolve,reject)=>{
  const tx=db.transaction('metadata','readwrite');
  tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
let tail=Promise.resolve(),opened=0;
const locks={request(_name,_options,callback){
  const next=tail.then(()=>callback({mode:'exclusive'}));
  tail=next.catch(()=>{});return next;
}};
const make=(lockSource=locks)=>{
  const pairGate=createSqliteVersionNeutralAtomicPairGate({db,locks:lockSource,fingerprint:hash});
  return createWeeklyManualOverrideClearOptIn({pairGate,openSqlite:bytes=>{
    opened++;return new SQL.Database(bytes);
  }});
};
const read=async()=>{
  const bytes=new Uint8Array(await loadDatabaseBytes());
  const connection=new SQL.Database(bytes);
  const rows=connection.exec('SELECT key,value_json FROM settings ORDER BY key')[0].values;
  connection.close();return {bytes,rows};
};
const input={weekStart:'2026-10-26',expectedGeneration:0,expectedFingerprint:seedHash};
const first=make();
for(const invalid of ['2026-02-30','2026-13-01','2026-10-26T00:00:00Z','']){
  await assert.rejects(first.execute({...input,weekStart:invalid}),e=>e.code==='G265_WEEKLY_CLEAR_INVALID_WEEK');
}
assert.equal(opened,0);
console.log('PASS G265_WEEKLY_CLEAR_INVALID_CALENDAR_REJECTED_BEFORE_SQL');

const second=make(),before=opened;
const [winner,stale]=await Promise.allSettled([first.execute(input),second.execute(input)]);
assert.equal(winner.status,'fulfilled');
assert.equal(winner.value.status,'PERSISTED');
assert.equal(winner.value.generation,1);
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(opened,before+1,'stale writer must never open SQL.js');
const after=await read();
assert.ok(!after.rows.some(row=>row[0]==='weekly_context_manual_override:2026-10-26'));
assert.ok(after.rows.some(row=>row[0]==='weekly_context_manual_override:2026-11-02'&&row[1]==='must-survive'));
assert.ok(after.rows.some(row=>row[0]==='unrelated'&&row[1]==='retain-me'));
assert.equal(await hash(after.bytes),winner.value.sha256);
console.log('PASS G265_WEEKLY_CLEAR_ATOMIC_CAS_TWO_WRITERS_STALE_PRE_SQL_AND_UNRELATED_PRESERVED');

const missing=make();
await assert.rejects(missing.execute({...input,expectedGeneration:1,expectedFingerprint:winner.value.sha256}),
  e=>e.code==='G265_WEEKLY_CLEAR_MISSING_ROW_HOLD');
assert.equal(missing.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),winner.value.sha256);
const noLocks=make(null);
await assert.rejects(noLocks.execute({...input,weekStart:'2026-11-02',expectedGeneration:1,
  expectedFingerprint:winner.value.sha256}),e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rejected=make();
await assert.rejects(rejected.execute({...input,weekStart:'2026-11-02',expectedGeneration:1,
  expectedFingerprint:winner.value.sha256}),e=>String(e.message||'').includes('synthetic-delete-denial'));
assert.equal(rejected.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),winner.value.sha256);
console.log('PASS G265_WEEKLY_CLEAR_MISSING_ROW_NO_ACK_NO_LOCKS_SQL_ROLLBACK_STICKY_HOLD');
console.log('HOLD G265_WEEKLY_CLEAR_PRODUCTION_23_LEGACY_WRITERS_NATIVE_CHROMIUM_ANDROID_OWNER_UAT');

const probeMake=(lockSource=locks,timeoutMs=30000)=>createWeeklyManualOverrideClearNoopProbe({
  pairGate:createSqliteVersionNeutralAtomicPairGate({db,locks:lockSource,fingerprint:hash}),
  openSqlite:bytes=>{opened++;return new SQL.Database(bytes);},
  locks:lockSource,timeoutMs
});
const noop=probeMake();
const beforeProbe=await read();
const missingProbe=await noop.inspect({weekStart:'2026-10-26',expectedGeneration:1,
  expectedFingerprint:winner.value.sha256});
assert.equal(missingProbe.status,'ABSENT_NOOP');
assert.equal(missingProbe.legacyResult,false,'legacy missing key returns false');
assert.equal(missingProbe.generation,1);
assert.equal(missingProbe.sha256,winner.value.sha256);
assert.equal(await hash((await read()).bytes),await hash(beforeProbe.bytes),
  'absent probe must not persist or alter durable bytes');
const presentProbe=await noop.inspect({weekStart:'2026-11-02',expectedGeneration:1,
  expectedFingerprint:winner.value.sha256});
assert.equal(presentProbe.status,'PRESENT_REQUIRES_CAS_WRITE');
assert.equal(presentProbe.legacyResult,null,'present key is not a DELETE ACK');
assert.equal(await hash((await read()).bytes),winner.value.sha256);
console.log('PASS G265_WEEKLY_CLEAR_MISSING_FALSE_NOOP_PRESENT_REQUIRES_CAS_NO_DURABLE_WRITE');

const staleProbe=probeMake(),beforeStaleProbe=opened;
await assert.rejects(staleProbe.inspect({weekStart:'2026-10-26',expectedGeneration:0,
  expectedFingerprint:seedHash}),e=>e.code==='G265_WEEKLY_CLEAR_PROBE_STALE_RELOAD_REQUIRED');
assert.equal(opened,beforeStaleProbe,'stale probe must reject before SQL.js');
assert.equal(staleProbe.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const missingLocksProbe=probeMake(null);
await assert.rejects(missingLocksProbe.inspect({weekStart:'2026-10-26',
  expectedGeneration:1,expectedFingerprint:winner.value.sha256}),
  e=>e.code==='G265_WEEKLY_CLEAR_PROBE_WEB_LOCKS_UNAVAILABLE');
assert.equal(missingLocksProbe.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const waitForever={request(){return new Promise(()=>{});}};
const timeoutProbe=probeMake(waitForever,20);
await assert.rejects(timeoutProbe.inspect({weekStart:'2026-10-26',
  expectedGeneration:1,expectedFingerprint:winner.value.sha256}),
  e=>e.code==='G265_WEEKLY_CLEAR_PROBE_LOCK_WAIT_TIMEOUT');
assert.equal(timeoutProbe.status().status,'UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(timeoutProbe.inspect({weekStart:'2026-10-26',
  expectedGeneration:1,expectedFingerprint:winner.value.sha256}),
  e=>e.code==='G265_WEEKLY_CLEAR_PROBE_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),winner.value.sha256);
console.log('PASS G265_WEEKLY_CLEAR_PROBE_STALE_PRE_SQL_NO_LOCKS_TIMEOUT_STICKY_HOLD');
console.log('HOLD G265_WEEKLY_CLEAR_PROBE_SYNTHETIC_ONLY_LEGACY_BYPASS_PRODUCTION_ANDROID');

// A held lock can time out while readVerified() is pending. A late durable
// read must not resume SQLite work after the caller has received sticky HOLD.
let releaseLateRead,notifyReadStarted;
const readStarted=new Promise(resolve=>{notifyReadStarted=resolve;});
const lateReadGate={readVerified:()=>{
  notifyReadStarted();
  return new Promise(resolve=>{releaseLateRead=resolve;});
}};
let lateOpened=0;
const lateProbe=createWeeklyManualOverrideClearNoopProbe({
  pairGate:lateReadGate,
  openSqlite:bytes=>{lateOpened++;return new SQL.Database(bytes);},
  locks,timeoutMs:20
});
const lateInput={weekStart:'2026-10-26',expectedGeneration:1,
  expectedFingerprint:winner.value.sha256};
const lateInspection=lateProbe.inspect(lateInput);
await readStarted;
await assert.rejects(lateInspection,
  e=>e.code==='G265_WEEKLY_CLEAR_PROBE_HELD_LOCK_TIMEOUT');
assert.equal(lateProbe.status().status,'UNVERIFIED_RELOAD_REQUIRED');
releaseLateRead({generation:1,sha256:winner.value.sha256,bytes:after.bytes});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(lateOpened,0,'timed-out probe must never open SQL.js on late read');
await assert.rejects(lateProbe.inspect(lateInput),
  e=>e.code==='G265_WEEKLY_CLEAR_PROBE_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),winner.value.sha256);
console.log('PASS G265_WEEKLY_CLEAR_LATE_READ_AFTER_HELD_LOCK_TIMEOUT_NO_SQLJS');

db.close();closeStorageConnection();
