// G265 tenth weekly strategy isolated opt-in, synthetic SQL.js/IDB only.
// Bind the unchanged legacy form source; never touch production player storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createWeeklyStrategyOptIn} from '../assets/js/sqlite-weekly-strategy-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const operation=legacy.split('function warroomForm() {')[1]?.split('function renderCollection() {')[0];
assert.ok(operation,'tenth legacy writer must remain source-identifiable');
assert.match(operation,/await snapshot\('manual:weekly-strategy'\)/);
assert.match(operation,/INSERT OR REPLACE INTO weekly_strategy/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-weekly-strategy-optin/);
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const SQL=await initSqlJs();
const seedSql=new SQL.Database();
seedSql.run('CREATE TABLE weekly_strategy(strategy_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,team_summary TEXT,substitution_rules TEXT,time_schedule TEXT,meal_strategy TEXT,ingredient_estimate REAL,berry_estimate REAL,shard_estimate REAL,snorlax_energy_estimate REAL,assumptions TEXT,updated_at TEXT NOT NULL)');
seedSql.run("INSERT INTO weekly_strategy VALUES('strategy_seed','2026-10-26','SYNTHETIC_SEED','','','',NULL,NULL,NULL,NULL,'','2026-10-29T00:00:00.000Z')");
seedSql.run("CREATE TRIGGER deny_fixture_strategy BEFORE INSERT ON weekly_strategy WHEN NEW.team_summary='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'synthetic-strategy-rejection'); END");
const seed=new Uint8Array(seedSql.export());seedSql.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('g265-tenth-weekly-strategy-disposable-cas',1);
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
  return createWeeklyStrategyOptIn({pairGate,openSqlite:bytes=>{opened++;return new SQL.Database(bytes);}});
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
  try{return {...pair,rows:sql.exec('SELECT * FROM weekly_strategy ORDER BY strategy_id')?.[0]?.values||[]};}
  finally{sql.close();}
};
const input={weekStart:'2026-11-02',teamSummary:'SYNTHETIC_A',
  ingredientEstimate:25,updatedAt:'2026-10-30T00:01:00.000Z',
  expectedPreviousUpdatedAt:null,expectedGeneration:0,expectedFingerprint:seedHash};
const invalid=make();
for(const bad of [
  {...input,weekStart:'2026-02-30'},{...input,weekStart:'2026-11-02T00:00:00Z'},
  {...input,teamSummary:123},{...input,teamSummary:'bad\u0000text'},
  {...input,ingredientEstimate:-1},{...input,ingredientEstimate:Infinity},
  {...input,berryEstimate:0},{...input,updatedAt:'2026-02-30T00:00:00.000Z'},
  {...input,expectedPreviousUpdatedAt:'not-a-timestamp'}
])await assert.rejects(invalid.execute(bad),e=>String(e.code||'').startsWith('G265_WEEKLY_STRATEGY_'));
assert.equal(opened,0);assert.equal((await read()).revision.generation,0);
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_INVALID_INPUT_PRE_SQL_ZERO_DURABLE_DELTA');

const first=await make().execute(input);
assert.equal(first.status,'PERSISTED');assert.equal(first.generation,1);
let current=await read();
assert.equal(current.revision.sha256,first.sha256);
assert.equal(current.rows.length,2);
assert.ok(current.rows.some(row=>row[0]==='strategy_seed'&&row[2]==='SYNTHETIC_SEED'));
assert.ok(current.rows.some(row=>row[0]==='strategy_2026-11-02'&&row[2]==='SYNTHETIC_A'&&row[6]===25));
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_FRESH_DURABLE_CAS_ACK_AND_UNRELATED_ROW_PRESERVED');

const beforeRaceOpen=opened;
const next={...input,weekStart:'2026-11-09',teamSummary:'SYNTHETIC_B',
  updatedAt:'2026-10-30T00:02:00.000Z',expectedGeneration:1,expectedFingerprint:first.sha256};
const a=make(),b=make();
const [winner,stale]=await Promise.allSettled([
  a.execute(next),b.execute({...next,weekStart:'2026-11-16',teamSummary:'SYNTHETIC_C'})
]);
assert.equal(winner.status,'fulfilled');assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+2,'stale contender must open zero SQL.js');
current=await read();
assert.equal(current.revision.generation,2);
assert.equal(current.rows.length,3);
assert.ok(!current.rows.some(row=>row[0]==='strategy_2026-11-16'));
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_TWO_WRITERS_ONE_ACK_STALE_ZERO_SQLJS');

const third=await make().execute({...next,weekStart:'2026-11-16',teamSummary:'SYNTHETIC_C',
  updatedAt:'2026-10-30T00:03:00.000Z',expectedGeneration:2,
  expectedFingerprint:winner.value.sha256});
current=await read();
assert.equal(current.revision.generation,3);assert.equal(current.rows.length,4);
assert.deepEqual(current.rows.map(row=>row[0]),[
  'strategy_2026-11-02','strategy_2026-11-09','strategy_2026-11-16','strategy_seed'
]);
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_EXPLICIT_FRESH_RELOAD_PRESERVES_ALL_CONFIRMED_ROWS');

const stable=await read();
const now={...input,weekStart:'2026-11-02',teamSummary:'SYNTHETIC_REPLACE',
  updatedAt:'2026-10-30T00:04:00.000Z',expectedGeneration:3,
  expectedFingerprint:third.sha256};
const wrongPrevious=make();
await assert.rejects(wrongPrevious.execute({...now,expectedPreviousUpdatedAt:null}),
  e=>e.code==='G265_WEEKLY_STRATEGY_PREVIOUS_REVISION_CHANGED');
assert.equal(wrongPrevious.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rollback=make();
await assert.rejects(rollback.execute({...now,weekStart:'2026-11-23',
  teamSummary:'SYNTHETIC_BLOCKED'}),e=>String(e.message||'').includes('synthetic-strategy-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
current=await read();
assert.equal(current.revision.sha256,stable.revision.sha256);
assert.deepEqual(current.rows,stable.rows);
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_PRECONDITION_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

const fourth=await make().execute({...now,expectedPreviousUpdatedAt:input.updatedAt});
current=await read();
assert.equal(current.revision.generation,4);
assert.ok(current.rows.some(row=>row[0]==='strategy_2026-11-02'&&row[2]==='SYNTHETIC_REPLACE'));
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_EXPLICIT_PRIOR_ROW_PRECONDITION_AND_ACK_READBACK');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...now,expectedGeneration:4,
  expectedFingerprint:fourth.sha256,expectedPreviousUpdatedAt:now.updatedAt}),
  e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
assert.equal((await read()).revision.sha256,fourth.sha256);
console.log('PASS G265_TENTH_WEEKLY_STRATEGY_NO_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_TENTH_WEEKLY_STRATEGY_PRODUCTION_UNADMITTED_ALL_WRITERS_CRASH_RECOVERY_ANDROID');
