import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createWeeklyManualOverrideOptIn} from '../assets/js/sqlite-weekly-manual-override-optin.js';

// Source-bound exact second legacy writer; all bytes and rows are synthetic.
const legacy=fs.readFileSync(new URL('../assets/js/weekly-context-manual-override.js',import.meta.url),'utf8');
const original=legacy.split('export async function saveWeeklyManualOverride(')[1];
assert.ok(original,'weekly override legacy writer must remain present');
assert.match(original,/await snapshot\('manual:weekly-context-override'\)/);
assert.match(original,/INSERT OR REPLACE INTO settings\(key,value_json,updated_at\) VALUES\(\?,\?,\?\)/);
assert.match(original,/await persist\(\)/);
assert.match(legacy,/weekly_context_manual_override:/);
assert.match(legacy,/weekly-context-manual-override\/1\.0/);
assert.match(legacy,/weekly-manual-override-2026-08-11-b-data-preservation/);
assert.doesNotMatch(legacy,/sqlite-weekly-manual-override-optin/);
console.log('PASS G265_WEEKLY_OVERRIDE_SECOND_EXACT_LEGACY_WRITER_SOURCE_BOUND_NOT_WIRED');

globalThis.indexedDB=indexedDB;
const {saveDatabaseBytes,loadDatabaseBytes,closeStorageConnection}=await import('../assets/js/storage.js');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
seedDb.run("INSERT INTO settings VALUES('unrelated','keep-me','2026-10-01T00:00:00.000Z')");
seedDb.run("CREATE TRIGGER deny_weekly_override BEFORE INSERT ON settings WHEN NEW.key='weekly_context_manual_override:2026-11-02' BEGIN SELECT RAISE(ABORT,'synthetic-insert-rejection'); END");
const seed=new Uint8Array(seedDb.export());seedDb.close();
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
let tail=Promise.resolve();
const locks={request(_name,_options,callback){
  const next=tail.then(()=>callback({mode:'exclusive'}));
  tail=next.catch(()=>{});return next;
}};
let opened=0;
const make=(locksOverride=locks)=>{
  const pairGate=createSqliteVersionNeutralAtomicPairGate({db,locks:locksOverride,fingerprint:hash});
  return createWeeklyManualOverrideOptIn({pairGate,openSqlite:bytes=>{
    opened++;return new SQL.Database(bytes);
  }});
};
const first=make();
const input={weekStart:'2026-10-26',basedOnImportRevision:'synthetic-weekly-rev-1',
  fields:{camp:'synthetic-camp',pot_size:42,base_notes:'player observation',ignored_field:'must-not-persist'},
  updatedAt:'2026-10-29T01:00:00.000Z',expectedGeneration:0,expectedFingerprint:seedHash};
for(const invalid of [
  {...input,weekStart:'2026-02-30'},
  {...input,updatedAt:'2026-02-30T01:00:00.000Z'},
  {...input,fields:{unknown:'no recognized field'}},
  {...input,fields:{camp:1n}},
  {...input,basedOnImportRevision:''},
]){
  await assert.rejects(first.execute(invalid),error=>String(error.code||'').startsWith('G265_WEEKLY_OVERRIDE_'));
}
assert.equal(opened,0,'invalid inputs must not open SQL.js');
console.log('PASS G265_WEEKLY_OVERRIDE_INVALID_CALENDAR_JSON_AND_REVISION_DENIED_PRE_SQL');
const result=await first.execute(input);
assert.equal(result.status,'PERSISTED');assert.equal(result.generation,1);
const read=async()=>{
  const bytes=new Uint8Array(await loadDatabaseBytes());
  const sql=new SQL.Database(bytes);
  const rows=sql.exec('SELECT key,value_json,updated_at FROM settings ORDER BY key')[0].values;
  sql.close();return {bytes,rows};
};
const afterFirst=await read();
const row=afterFirst.rows.find(x=>x[0]==='weekly_context_manual_override:2026-10-26');
assert.ok(row);
const record=JSON.parse(row[1]);
assert.deepEqual(record.fields,{camp:'synthetic-camp',pot_size:42,base_notes:'player observation'});
assert.equal(record.schema,'weekly-context-manual-override/1.0');
assert.equal(record.based_on_import_revision,'synthetic-weekly-rev-1');
assert.equal(row[2],input.updatedAt);
assert.ok(afterFirst.rows.some(x=>x[0]==='unrelated'&&x[1]==='keep-me'));
assert.equal(result.sha256,await hash(afterFirst.bytes));
console.log('PASS G265_WEEKLY_OVERRIDE_FRESH_DURABLE_SQLJS_ATOMIC_CAS_READBACK_UNRELATED_PRESERVED');

const a=make(),b=make(),beforeRace=opened;
const next={...input,fields:{camp:'new-camp'},expectedGeneration:1,expectedFingerprint:result.sha256,
  updatedAt:'2026-10-29T02:00:00.000Z'};
const [winner,stale]=await Promise.allSettled([
  a.execute(next),b.execute({...next,fields:{camp:'stale-overwrite'}})
]);
assert.equal(winner.status,'fulfilled');
assert.equal(winner.value.generation,2);
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(opened,beforeRace+1,'stale contender must not open SQL.js');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const afterRace=await read();
assert.equal(JSON.parse(afterRace.rows.find(x=>x[0]==='weekly_context_manual_override:2026-10-26')[1]).fields.camp,'new-camp');
console.log('PASS G265_WEEKLY_OVERRIDE_TWO_TAB_SAME_GENERATION_ONE_WINNER_STALE_PRE_SQL');

const noLocks=make(null);
await assert.rejects(noLocks.execute({...next,expectedGeneration:2,
  expectedFingerprint:winner.value.sha256}),e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const failed=make(),beforeFail=await hash((await read()).bytes);
await assert.rejects(failed.execute({...next,weekStart:'2026-11-02',
  expectedGeneration:2,expectedFingerprint:winner.value.sha256}),
  e=>String(e.message||'').includes('synthetic-insert-rejection')||String(e.code||'').startsWith('G265_'));
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await hash((await read()).bytes),beforeFail,'SQL rollback must preserve durable bytes');
console.log('PASS G265_WEEKLY_OVERRIDE_NO_LOCKS_SQL_ABORT_STICKY_HOLD_NO_DURABLE_WRITE');
console.log('HOLD G265_WEEKLY_OVERRIDE_PRODUCTION_WIRING_23_LEGACY_CROSS_TAB_ANDROID_OWNER_UAT');
db.close();closeStorageConnection();
