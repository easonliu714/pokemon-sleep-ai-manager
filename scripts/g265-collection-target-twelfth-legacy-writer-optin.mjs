// G265 twelfth collection target: disposable SQL.js + fake IndexedDB only.
// Tests opt-in admission; unchanged legacy two-ACK overwrite remains reproduced separately.
// No production app import, player SQLite/IndexedDB, migration, or public catalog mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createCollectionTargetOptIn} from '../assets/js/sqlite-collection-target-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const marker='export function setupG3Pages() {';
assert.equal(legacy.split(marker).length,2);
const operation=legacy.slice(legacy.indexOf(marker));
assert.match(operation,/document\.getElementById\('collectionAddForm'\)\.onsubmit/);
assert.match(operation,/await snapshot\('manual:collection-target'\)/);
assert.match(operation,/INSERT OR REPLACE INTO collection_targets/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-collection-target-optin/);
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const SQL=await initSqlJs();
const initial=new SQL.Database();
initial.run('CREATE TABLE collection_targets(target_id TEXT PRIMARY KEY,species TEXT NOT NULL,target_type TEXT,priority TEXT,camp TEXT,desired_traits TEXT,capture_strategy TEXT,status TEXT,notes TEXT,updated_at TEXT NOT NULL)');
initial.run("INSERT INTO collection_targets VALUES('target_seed','SYNTHETIC_SEED','observe','B','','','','active','','2026-10-29T00:00:00.000Z')");
initial.run('CREATE TABLE public_event_master(event_id TEXT PRIMARY KEY,payload TEXT)');
initial.run("INSERT INTO public_event_master VALUES('fixture-event','SYNTHETIC_MASTER_UNCHANGED')");
initial.run("CREATE TRIGGER deny_fixture_collection_target BEFORE INSERT ON collection_targets WHEN NEW.species='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'synthetic-target-rejection'); END");
const seed=new Uint8Array(initial.export());initial.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('g265-twelfth-collection-target-disposable-cas',1);
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
  return createCollectionTargetOptIn({pairGate,openSqlite:bytes=>{opened++;return new SQL.Database(bytes);}});
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
      rows:sql.exec('SELECT * FROM collection_targets ORDER BY target_id')?.[0]?.values||[],
      master:sql.exec('SELECT * FROM public_event_master')?.[0]?.values||[]};
  }finally{sql.close();}
};
const input={targetId:'target_1001',species:'SYNTHETIC_A',targetType:'observe',
  priority:'A',camp:'SYNTHETIC_CAMP',desiredTraits:'SYNTHETIC_TRAITS',
  captureStrategy:'SYNTHETIC_STRATEGY',updatedAt:'2026-10-30T01:00:00.000Z',
  expectedPreviousUpdatedAt:null,expectedGeneration:0,expectedFingerprint:seedHash};
const invalid=make();
for(const bad of [
  {...input,species:''},{...input,species:' SYNTHETIC_A'},
  {...input,targetId:'target_bad;DROP TABLE'},{...input,targetId:'other_1001'},
  {...input,priority:'bad\u0000value'},{...input,updatedAt:'2026-02-30T00:00:00.000Z'},
  {...input,expectedPreviousUpdatedAt:'not-a-timestamp'}
])await assert.rejects(invalid.execute(bad),
  error=>String(error.code||'').startsWith('G265_COLLECTION_TARGET_'));
assert.equal(opened,0);assert.equal((await read()).revision.generation,0);
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_INVALID_INPUT_PRE_SQL_ZERO_DURABLE_DELTA');

const first=await make().execute(input);
assert.equal(first.status,'PERSISTED');assert.equal(first.generation,1);
let current=await read();
assert.equal(current.revision.sha256,first.sha256);
assert.equal(current.rows.length,2);
assert.ok(current.rows.some(row=>row[0]==='target_seed'&&row[1]==='SYNTHETIC_SEED'));
assert.ok(current.rows.some(row=>row[0]==='target_1001'&&row[1]==='SYNTHETIC_A'&&row[7]==='active'));
assert.deepEqual(current.master,[['fixture-event','SYNTHETIC_MASTER_UNCHANGED']]);
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_FRESH_DURABLE_CAS_ACK_MASTER_UNCHANGED');

const beforeRaceOpen=opened;
const next={...input,targetId:'target_1002',species:'SYNTHETIC_B',
  updatedAt:'2026-10-30T01:01:00.000Z',
  expectedGeneration:1,expectedFingerprint:first.sha256};
const a=make(),b=make();
const [winner,stale]=await Promise.allSettled([
  a.execute(next),b.execute({...next,targetId:'target_1003',species:'SYNTHETIC_C'})
]);
assert.equal(winner.status,'fulfilled');assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+2,'stale writer must not open SQL.js');
current=await read();
assert.equal(current.revision.generation,2);
assert.equal(current.rows.length,3);
assert.ok(!current.rows.some(row=>row[0]==='target_1003'));
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_TWO_WRITERS_ONE_ACK_STALE_ZERO_SQLJS');

const third=await make().execute({...next,targetId:'target_1003',
  species:'SYNTHETIC_C',updatedAt:'2026-10-30T01:02:00.000Z',
  expectedGeneration:2,expectedFingerprint:winner.value.sha256});
current=await read();
assert.equal(current.revision.generation,3);
assert.deepEqual(current.rows.map(row=>row[0]),[
  'target_1001','target_1002','target_1003','target_seed'
]);
assert.deepEqual(current.master,[['fixture-event','SYNTHETIC_MASTER_UNCHANGED']]);
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_FRESH_RELOAD_PRESERVES_ALL_ACK_TARGETS');

const stable=await read();
const replace={...input,species:'SYNTHETIC_REPLACE',
  updatedAt:'2026-10-30T01:03:00.000Z',
  expectedGeneration:3,expectedFingerprint:third.sha256};
const wrong=make();
await assert.rejects(wrong.execute(replace),
  error=>error.code==='G265_COLLECTION_TARGET_PREVIOUS_REVISION_CHANGED');
assert.equal(wrong.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rollback=make();
await assert.rejects(rollback.execute({...replace,targetId:'target_blocked',
  species:'SYNTHETIC_BLOCKED'}),
  error=>String(error.message||'').includes('synthetic-target-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
current=await read();
assert.equal(current.revision.sha256,stable.revision.sha256);
assert.deepEqual(current.rows,stable.rows);
assert.deepEqual(current.master,stable.master);
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_PRECONDITION_ROLLBACK_ZERO_DURABLE_DELTA');

const fourth=await make().execute({...replace,
  expectedPreviousUpdatedAt:input.updatedAt});
current=await read();
assert.equal(current.revision.generation,4);
assert.ok(current.rows.some(row=>row[0]==='target_1001'&&row[1]==='SYNTHETIC_REPLACE'));
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_EXPLICIT_PREVIOUS_ROW_ACK_READBACK');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...replace,expectedGeneration:4,
  expectedFingerprint:fourth.sha256,expectedPreviousUpdatedAt:replace.updatedAt}),
  error=>error.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
assert.equal((await read()).revision.sha256,fourth.sha256);
console.log('PASS G265_TWELFTH_COLLECTION_TARGET_NO_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_TWELFTH_COLLECTION_TARGET_PRODUCTION_UNADMITTED_CRASH_RECOVERY_ANDROID');
