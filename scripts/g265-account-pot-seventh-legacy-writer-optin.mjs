// G265 seventh account-pot opt-in: isolated SQL.js + fake IndexedDB CAS fixture.
// Exact unchanged legacy source is bound; no production player DB or app wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createAccountPotCapacityOptIn} from '../assets/js/sqlite-account-pot-capacity-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/weekly-context-ui-bridge.js',import.meta.url),'utf8');
const writer=legacy.split('async function saveAccountPotCapacity(edit){')[1]?.split('async function saveFallback(')[0];
const sqlWriter=legacy.split('function writeAccountPotCapacity(capacity,source=')[1]?.split('async function saveAccountPotCapacity(')[0];
assert.ok(writer&&sqlWriter,'exact seventh legacy source must remain identifiable');
assert.match(writer,/await snapshot\(/);
assert.match(writer,/await persist\(\)/);
assert.match(sqlWriter,/INSERT INTO account_capacity/);
assert.doesNotMatch(legacy,/sqlite-account-pot-capacity-optin/);
console.log('PASS G265_SEVENTH_ACCOUNT_POT_EXACT_LEGACY_SOURCE_BOUND_NOT_WIRED');

const SQL=await initSqlJs();
const seedSql=new SQL.Database();
seedSql.run('CREATE TABLE account_capacity(capacity_key TEXT PRIMARY KEY,total_capacity INTEGER NOT NULL,used_count INTEGER,updated_at TEXT NOT NULL,source TEXT)');
seedSql.run("INSERT INTO account_capacity VALUES('pot',30,7,'2026-10-29T00:00:00.000Z','SYNTHETIC_SEED')");
seedSql.run("INSERT INTO account_capacity VALUES('unrelated',123,2,'2026-10-29T00:00:00.000Z','SYNTHETIC_SEED')");
seedSql.run("CREATE TRIGGER deny_pot_fixture BEFORE UPDATE ON account_capacity WHEN NEW.capacity_key='pot' AND NEW.total_capacity=99 BEGIN SELECT RAISE(ABORT,'synthetic-pot-update-rejection'); END");
const seed=new Uint8Array(seedSql.export());seedSql.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('g265-seventh-pot-disposable-cas',1);
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
  return createAccountPotCapacityOptIn({pairGate,openSqlite:bytes=>{
    opened++;return new SQL.Database(bytes);
  }});
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
  const records=sql.exec('SELECT capacity_key,total_capacity,used_count,updated_at,source FROM account_capacity ORDER BY capacity_key')?.[0]?.values||[];
  sql.close();return {...pair,records,pot:records.find(x=>x[0]==='pot')};
};
const input={capacity:55,source:'MANUAL_WEEKLY_CONTEXT_UI',
  updatedAt:'2026-10-29T00:01:00.000Z',expectedPreviousCapacity:30,
  expectedGeneration:0,expectedFingerprint:seedHash};
const invalid=make();
for(const bad of [
  {...input,capacity:0},{...input,capacity:1.5},
  {...input,capacity:Number.MAX_SAFE_INTEGER+1},
  {...input,source:'SYNTHETIC_UNTRUSTED'},
  {...input,updatedAt:'2026-02-30T00:00:00.000Z'},
  {...input,expectedPreviousCapacity:-1}
])await assert.rejects(invalid.execute(bad),e=>String(e.code||'').startsWith('G265_ACCOUNT_POT_'));
assert.equal(opened,0);
assert.equal((await read()).revision.generation,0);
console.log('PASS G265_SEVENTH_ACCOUNT_POT_INVALID_INPUT_PRE_SQL_ZERO_DURABLE_DELTA');

const first=await make().execute(input);
assert.equal(first.status,'PERSISTED');assert.equal(first.generation,1);
let current=await read();
assert.equal(current.revision.sha256,first.sha256);
assert.equal(current.pot[1],55);assert.equal(current.pot[2],7);
assert.equal(current.records.find(x=>x[0]==='unrelated')[1],123);
console.log('PASS G265_SEVENTH_ACCOUNT_POT_FRESH_DURABLE_CAS_ACK_ROW_AND_UNRELATED_PRESERVED');

const beforeRaceOpen=opened;
const next={...input,capacity:70,expectedPreviousCapacity:55,
  updatedAt:'2026-10-29T00:02:00.000Z',expectedGeneration:1,expectedFingerprint:first.sha256};
const a=make(),b=make();
const [winner,stale]=await Promise.allSettled([a.execute(next),b.execute({...next,capacity:65})]);
assert.equal(winner.status,'fulfilled');
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+2,'stale contender opens zero SQL.js');
current=await read();
assert.equal(current.pot[1],70);assert.equal(current.pot[2],7);
assert.equal(current.revision.generation,2);
console.log('PASS G265_SEVENTH_ACCOUNT_POT_TWO_WRITERS_ONE_ACK_STALE_ZERO_SQLJS');

const third=await make().execute({...next,capacity:80,expectedPreviousCapacity:70,
  updatedAt:'2026-10-29T00:03:00.000Z',
  expectedGeneration:2,expectedFingerprint:winner.value.sha256});
current=await read();
assert.equal(current.pot[1],80);assert.equal(current.pot[2],7);
assert.equal(current.revision.generation,3);
console.log('PASS G265_SEVENTH_ACCOUNT_POT_EXPLICIT_FRESH_RELOAD_ACK_PRESERVED');

const stable=await read();
const now={...next,expectedPreviousCapacity:80,expectedGeneration:3,
  expectedFingerprint:third.sha256,updatedAt:'2026-10-29T00:04:00.000Z'};
const wrongPrevious=make();
await assert.rejects(wrongPrevious.execute({...now,capacity:90,expectedPreviousCapacity:70}),
  e=>e.code==='G265_ACCOUNT_POT_PREVIOUS_CAPACITY_CHANGED');
assert.equal(wrongPrevious.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rollback=make();
await assert.rejects(rollback.execute({...now,capacity:99}),
  e=>String(e.message||'').includes('synthetic-pot-update-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal((await read()).revision.sha256,stable.revision.sha256);
assert.deepEqual((await read()).records,stable.records);
console.log('PASS G265_SEVENTH_ACCOUNT_POT_PRECONDITION_AND_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...now,capacity:85}),
  e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
assert.equal((await read()).revision.sha256,stable.revision.sha256);
console.log('PASS G265_SEVENTH_ACCOUNT_POT_NO_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_SEVENTH_ACCOUNT_POT_PRODUCTION_UNADMITTED_ALL_WRITERS_RECOVERY_ANDROID');
