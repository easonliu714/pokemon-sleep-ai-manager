// G265 eleventh weekly context isolated opt-in, synthetic SQL.js/IDB only.
// Bind unchanged legacy weeklyForm source; do not access production player storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createWeeklyContextOptIn} from '../assets/js/sqlite-weekly-context-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const operation=legacy.split('function weeklyForm() {')[1]?.split('function recipeShortageText(row) {')[0];
assert.ok(operation,'eleventh legacy writer must remain source-identifiable');
assert.match(operation,/await snapshot\('manual:weekly-context'\)/);
assert.match(operation,/INSERT OR REPLACE INTO weekly_context/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-weekly-context-optin/);
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const SQL=await initSqlJs();
const seedSql=new SQL.Database();
seedSql.run('CREATE TABLE weekly_context(context_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,camp TEXT,dish_category TEXT,favorite_berry_1 TEXT,favorite_berry_2 TEXT,favorite_berry_3 TEXT,event_name TEXT,event_effects TEXT,pot_size INTEGER,base_notes TEXT,updated_at TEXT NOT NULL)');
seedSql.run("INSERT INTO weekly_context VALUES('week_seed','2026-10-26','SYNTHETIC_SEED','','','','','','',NULL,'','2026-10-29T00:00:00.000Z')");
seedSql.run('CREATE TABLE public_event_master(event_id TEXT PRIMARY KEY,payload TEXT)');
seedSql.run("INSERT INTO public_event_master VALUES('fixture-event','SYNTHETIC_PUBLIC_MASTER_UNCHANGED')");
seedSql.run("CREATE TRIGGER deny_fixture_weekly_context BEFORE INSERT ON weekly_context WHEN NEW.camp='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'synthetic-weekly-context-rejection'); END");
const seed=new Uint8Array(seedSql.export());seedSql.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('g265-eleventh-weekly-context-disposable-cas',1);
  req.onupgradeneeded=()=>{req.result.createObjectStore('database');req.result.createObjectStore('metadata');};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
await new Promise((resolve,reject)=>{
  const tx=db.transaction(['database','metadata'],'readwrite');
  tx.objectStore('database').put(seed.slice().buffer,'primary');
  tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
let queue=Promise.resolve(),opened=0;
const locks={request(_name,_options,callback){
  const next=queue.then(()=>callback({mode:'exclusive'}));
  queue=next.catch(()=>{});return next;
}};
const make=(override=locks)=>{
  const pairGate=createSqliteVersionNeutralAtomicPairGate({db,locks:override,fingerprint:hash});
  return createWeeklyContextOptIn({pairGate,openSqlite:bytes=>{opened++;return new SQL.Database(bytes);}});
};
const durable=()=>new Promise((resolve,reject)=>{
  const tx=db.transaction(['database','metadata'],'readonly');
  const raw=tx.objectStore('database').get('primary');
  const rev=tx.objectStore('metadata').get('revision:primary');
  tx.oncomplete=()=>resolve({bytes:new Uint8Array(raw.result),revision:rev.result});
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
const read=async()=>{
  const pair=await durable();
  assert.equal(await hash(pair.bytes),pair.revision.sha256);
  const sql=new SQL.Database(pair.bytes);
  try{
    return {...pair,
      rows:sql.exec('SELECT * FROM weekly_context ORDER BY context_id')?.[0]?.values||[],
      master:sql.exec('SELECT * FROM public_event_master')?.[0]?.values||[]};
  }finally{sql.close();}
};
const input={weekStart:'2026-11-02',camp:'SYNTHETIC_A',dishCategory:'沙拉',
  favoriteBerry1:'SYNTHETIC_BERRY_A',favoriteBerry2:'SYNTHETIC_BERRY_B',
  potSize:24,updatedAt:'2026-10-30T00:01:00.000Z',
  expectedPreviousUpdatedAt:null,expectedGeneration:0,expectedFingerprint:seedHash};
const invalid=make();
for(const bad of [
  {...input,weekStart:'2026-02-30'}, {...input,weekStart:'2026-11-02T00:00:00Z'},
  {...input,camp:123},{...input,eventEffects:'bad\u0000text'},
  {...input,potSize:0},{...input,potSize:-1},{...input,potSize:Infinity},
  {...input,updatedAt:'2026-02-30T00:00:00.000Z'},
  {...input,expectedPreviousUpdatedAt:'invalid'},
  {...input,favoriteBerry2:'SYNTHETIC_BERRY_A'}
])await assert.rejects(invalid.execute(bad),
  error=>String(error.code||'').startsWith('G265_WEEKLY_CONTEXT_'));
assert.equal(opened,0);assert.equal((await read()).revision.generation,0);
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_INVALID_INPUT_DUPLICATE_BERRY_PRE_SQL_ZERO_DURABLE_DELTA');

const first=await make().execute(input);
assert.equal(first.status,'PERSISTED');assert.equal(first.generation,1);
let current=await read();
assert.equal(current.revision.sha256,first.sha256);
assert.equal(current.rows.length,2);
assert.ok(current.rows.some(row=>row[0]==='week_seed'&&row[2]==='SYNTHETIC_SEED'));
assert.ok(current.rows.some(row=>row[0]==='week_2026-11-02'&&row[2]==='SYNTHETIC_A'&&row[9]===24));
assert.deepEqual(current.master,[['fixture-event','SYNTHETIC_PUBLIC_MASTER_UNCHANGED']]);
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_FRESH_DURABLE_CAS_ACK_MASTER_UNCHANGED');

const beforeRaceOpen=opened;
const next={...input,weekStart:'2026-11-09',camp:'SYNTHETIC_B',
  favoriteBerry1:'SYNTHETIC_BERRY_C',favoriteBerry2:'',
  updatedAt:'2026-10-30T00:02:00.000Z',
  expectedGeneration:1,expectedFingerprint:first.sha256};
const a=make(),b=make();
const [winner,stale]=await Promise.allSettled([
  a.execute(next),b.execute({...next,weekStart:'2026-11-16',camp:'SYNTHETIC_C'})
]);
assert.equal(winner.status,'fulfilled');assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+2,'stale contender must open zero SQL.js');
current=await read();
assert.equal(current.revision.generation,2);
assert.equal(current.rows.length,3);
assert.ok(!current.rows.some(row=>row[0]==='week_2026-11-16'));
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_TWO_WRITERS_ONE_ACK_STALE_ZERO_SQLJS');

const third=await make().execute({...next,weekStart:'2026-11-16',
  camp:'SYNTHETIC_C',updatedAt:'2026-10-30T00:03:00.000Z',
  expectedGeneration:2,expectedFingerprint:winner.value.sha256});
current=await read();
assert.equal(current.revision.generation,3);assert.equal(current.rows.length,4);
assert.deepEqual(current.rows.map(row=>row[0]),[
  'week_2026-11-02','week_2026-11-09','week_2026-11-16','week_seed'
]);
assert.deepEqual(current.master,[['fixture-event','SYNTHETIC_PUBLIC_MASTER_UNCHANGED']]);
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_FRESH_RELOAD_PRESERVES_ALL_CONFIRMED_ROWS');

const stable=await read();
const replace={...input,camp:'SYNTHETIC_REPLACE',
  updatedAt:'2026-10-30T00:04:00.000Z',
  expectedGeneration:3,expectedFingerprint:third.sha256};
const wrongPrevious=make();
await assert.rejects(wrongPrevious.execute(replace),
  error=>error.code==='G265_WEEKLY_CONTEXT_PREVIOUS_REVISION_CHANGED');
assert.equal(wrongPrevious.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rollback=make();
await assert.rejects(rollback.execute({...replace,weekStart:'2026-11-23',
  camp:'SYNTHETIC_BLOCKED'}),
  error=>String(error.message||'').includes('synthetic-weekly-context-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
current=await read();
assert.equal(current.revision.sha256,stable.revision.sha256);
assert.deepEqual(current.rows,stable.rows);
assert.deepEqual(current.master,stable.master);
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_PRECONDITION_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

const fourth=await make().execute({...replace,expectedPreviousUpdatedAt:input.updatedAt});
current=await read();
assert.equal(current.revision.generation,4);
assert.ok(current.rows.some(row=>row[0]==='week_2026-11-02'&&row[2]==='SYNTHETIC_REPLACE'));
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_EXPLICIT_PREVIOUS_ROW_ACK_READBACK');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...replace,expectedGeneration:4,
  expectedFingerprint:fourth.sha256,expectedPreviousUpdatedAt:replace.updatedAt}),
  error=>error.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
assert.equal((await read()).revision.sha256,fourth.sha256);
console.log('PASS G265_ELEVENTH_WEEKLY_CONTEXT_NO_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_ELEVENTH_WEEKLY_CONTEXT_PRODUCTION_UNADMITTED_CRASH_RECOVERY_ANDROID');
