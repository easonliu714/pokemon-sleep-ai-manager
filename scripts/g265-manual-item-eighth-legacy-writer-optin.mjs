// G265 eighth manual item isolated opt-in: real SQL.js, fake IndexedDB, cooperative
// Web Locks, atomic durable revision CAS and private audit consistency. Synthetic only.
// The exact unchanged production legacy source is asserted, not wired to this adapter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createManualItemOptIn} from '../assets/js/sqlite-manual-item-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/manual-editor.js',import.meta.url),'utf8');
const source=legacy.split('export async function saveItem(')[1]?.split('export async function savePokemonDetail(')[0];
const audit=legacy.split('async function audit(')[1]?.split('function emitPokemonEvaluationInputChanged(')[0];
assert.ok(source&&audit,'exact eighth manual item legacy source must remain identifiable');
assert.match(source,/await snapshot\(/);
assert.match(source,/await persist\(\)/);
assert.match(source,/await audit\('item_inventory'/);
assert.match(audit,/INSERT INTO import_batches/);
assert.match(audit,/INSERT INTO import_changes/);
assert.doesNotMatch(legacy,/sqlite-manual-item-optin/);
console.log('PASS G265_EIGHTH_MANUAL_ITEM_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const SQL=await initSqlJs();
const seedSql=new SQL.Database();
seedSql.run('CREATE TABLE item_master(item_name TEXT PRIMARY KEY)');
seedSql.run('CREATE TABLE item_inventory(item_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL,safe_reserve INTEGER NOT NULL,recommendation TEXT,updated_at TEXT,source_update_id TEXT)');
seedSql.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedSql.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT,PRIMARY KEY(update_id,operation_index))');
for(const name of ['SYNTHETIC_SEED','SYNTHETIC_ITEM_A','SYNTHETIC_ITEM_B','SYNTHETIC_ITEM_C','SYNTHETIC_BLOCKED'])
  seedSql.run('INSERT INTO item_master(item_name) VALUES(?)',[name]);
seedSql.run("INSERT INTO item_inventory VALUES('SYNTHETIC_SEED',3,1,'seed','2026-10-29T00:00:00.000Z','SYNTHETIC_SEED')");
seedSql.run("CREATE TRIGGER deny_fixture_item BEFORE INSERT ON item_inventory WHEN NEW.item_name='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'synthetic-item-insert-rejection'); END");
const seed=new Uint8Array(seedSql.export());seedSql.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('g265-eighth-manual-item-disposable-cas',1);
  request.onupgradeneeded=()=>{
    request.result.createObjectStore('database');
    request.result.createObjectStore('metadata');
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
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
const make=(lockOverride=locks)=>{
  const pairGate=createSqliteVersionNeutralAtomicPairGate({db,locks:lockOverride,fingerprint:hash});
  return createManualItemOptIn({pairGate,openSqlite:bytes=>{
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
  try{
    const query=q=>sql.exec(q)?.[0]?.values||[];
    return {...pair,
      items:query('SELECT item_name,quantity,safe_reserve,recommendation FROM item_inventory ORDER BY item_name'),
      batches:query('SELECT update_id,source,operation_count FROM import_batches ORDER BY update_id'),
      changes:query('SELECT update_id,entity,action,before_json,after_json FROM import_changes ORDER BY update_id'),
      masters:query('SELECT item_name FROM item_master ORDER BY item_name')
    };
  }finally{sql.close();}
};
const input={name:'SYNTHETIC_ITEM_A',quantity:11,reserve:2,recommendation:'synthetic-A',
  updatedAt:'2026-10-29T00:01:00.000Z',auditId:'MANUAL-G265-A',
  expectedGeneration:0,expectedFingerprint:seedHash};
const invalid=make();
for(const bad of [
  {...input,name:''},{...input,quantity:-1},{...input,reserve:1.5},
  {...input,quantity:Number.MAX_SAFE_INTEGER+1},
  {...input,updatedAt:'2026-02-30T00:00:00.000Z'},
  {...input,auditId:'external-id'},{...input,recommendation:null}
])await assert.rejects(invalid.execute(bad),e=>String(e.code||'').startsWith('G265_MANUAL_ITEM_'));
assert.equal(opened,0);
assert.equal((await read()).revision.generation,0);
console.log('PASS G265_EIGHTH_MANUAL_ITEM_INVALID_INPUT_PRE_SQL_ZERO_DURABLE_DELTA');

const first=await make().execute(input);
assert.equal(first.status,'PERSISTED');
assert.equal(first.generation,1);
let current=await read();
assert.equal(current.revision.sha256,first.sha256);
assert.deepEqual(current.items.find(x=>x[0]==='SYNTHETIC_ITEM_A').slice(1),[11,2,'synthetic-A']);
assert.deepEqual(current.items.find(x=>x[0]==='SYNTHETIC_SEED').slice(1),[3,1,'seed']);
assert.deepEqual(current.batches,[['MANUAL-G265-A','manual_frontend_edit',1]]);
assert.equal(current.changes.length,1);
assert.equal(JSON.parse(current.changes[0][3]),null);
assert.equal(JSON.parse(current.changes[0][4]).quantity,11);
const masterBaseline=current.masters;
console.log('PASS G265_EIGHTH_MANUAL_ITEM_FRESH_DURABLE_CAS_ITEM_AND_AUDIT_ACK_READBACK');

const beforeRaceOpen=opened;
const next={...input,name:'SYNTHETIC_ITEM_B',quantity:22,reserve:4,
  recommendation:'synthetic-B',auditId:'MANUAL-G265-B',
  updatedAt:'2026-10-29T00:02:00.000Z',
  expectedGeneration:1,expectedFingerprint:first.sha256};
const a=make(),b=make();
const [winner,stale]=await Promise.allSettled([
  a.execute(next),
  b.execute({...next,name:'SYNTHETIC_ITEM_C',quantity:33,auditId:'MANUAL-G265-C'})
]);
assert.equal(winner.status,'fulfilled');
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+2,'stale contender must open zero SQL.js connections');
current=await read();
assert.equal(current.revision.generation,2);
assert.equal(current.items.filter(x=>x[0]==='SYNTHETIC_ITEM_B').length,1);
assert.equal(current.items.filter(x=>x[0]==='SYNTHETIC_ITEM_C').length,0);
assert.deepEqual(current.batches.map(x=>x[0]),['MANUAL-G265-A','MANUAL-G265-B']);
assert.deepEqual(current.changes.map(x=>x[0]),['MANUAL-G265-A','MANUAL-G265-B']);
console.log('PASS G265_EIGHTH_MANUAL_ITEM_TWO_WRITERS_ONE_ACK_STALE_ZERO_SQLJS_NO_AUDIT_LOSS');

const third=await make().execute({...next,name:'SYNTHETIC_ITEM_C',quantity:33,
  auditId:'MANUAL-G265-C',updatedAt:'2026-10-29T00:03:00.000Z',
  expectedGeneration:2,expectedFingerprint:winner.value.sha256});
current=await read();
assert.equal(current.revision.generation,3);
assert.equal(current.items.length,4);
assert.equal(current.batches.length,3);
assert.equal(current.changes.length,3);
assert.deepEqual(current.masters,masterBaseline,'Public Master must remain unchanged');
console.log('PASS G265_EIGHTH_MANUAL_ITEM_EXPLICIT_FRESH_RELOAD_PRESERVES_THREE_ACKS_AND_MASTER');

const stable=await read();
const now={...next,name:'SYNTHETIC_ITEM_B',quantity:45,
  expectedGeneration:3,expectedFingerprint:third.sha256,
  updatedAt:'2026-10-29T00:04:00.000Z'};
const replay=make();
await assert.rejects(replay.execute({...now,auditId:'MANUAL-G265-A'}),
  e=>e.code==='G265_MANUAL_ITEM_AUDIT_ID_REPLAY');
assert.equal(replay.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const missingMaster=make();
await assert.rejects(missingMaster.execute({...now,name:'UNKNOWN_ITEM',auditId:'MANUAL-G265-UNKNOWN'}),
  e=>e.code==='G265_MANUAL_ITEM_MASTER_IDENTITY_MISSING');
assert.equal(missingMaster.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rollback=make();
await assert.rejects(rollback.execute({...now,name:'SYNTHETIC_BLOCKED',
  auditId:'MANUAL-G265-TRIGGER'}),e=>String(e.message||'').includes('synthetic-item-insert-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
let after=await read();
assert.equal(after.revision.sha256,stable.revision.sha256);
assert.deepEqual(after.items,stable.items);
assert.deepEqual(after.batches,stable.batches);
assert.deepEqual(after.changes,stable.changes);
console.log('PASS G265_EIGHTH_MANUAL_ITEM_AUDIT_REPLAY_MASTER_GUARD_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...now,auditId:'MANUAL-G265-NOLOCK'}),
  e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
after=await read();
assert.equal(after.revision.sha256,stable.revision.sha256);
console.log('PASS G265_EIGHTH_MANUAL_ITEM_NO_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_EIGHTH_MANUAL_ITEM_PRODUCTION_UNADMITTED_ALL_WRITERS_CRASH_RECOVERY_ANDROID');
