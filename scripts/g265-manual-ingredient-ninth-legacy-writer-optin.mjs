// G265 ninth manual ingredient isolated opt-in: real SQL.js, fake IndexedDB,
// cooperative Web Locks, durable generation/SHA CAS, UNKNOWN unlock and private audit.
// Synthetic fixtures only. Original legacy source is asserted, never production-wired.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createManualIngredientOptIn} from '../assets/js/sqlite-manual-ingredient-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/manual-editor.js',import.meta.url),'utf8');
const source=legacy.split('export async function saveIngredient(')[1]?.split('export async function saveItem(')[0];
const audit=legacy.split('async function audit(')[1]?.split('function emitPokemonEvaluationInputChanged(')[0];
assert.ok(source&&audit,'exact ninth manual ingredient legacy source must remain identifiable');
assert.match(source,/await snapshot\(/);
assert.match(source,/commit\(\);await persist\(\)/);
assert.match(source,/q>0&&unlocked===0/);
assert.match(source,/if\(q>0\)unlocked=1/);
assert.match(source,/if\(q===0&&unlockInput===undefined\)/);
assert.match(source,/await audit\('ingredient_inventory'/);
assert.match(audit,/INSERT INTO import_batches/);
assert.match(audit,/INSERT INTO import_changes/);
assert.doesNotMatch(legacy,/sqlite-manual-ingredient-optin/);
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const SQL=await initSqlJs();
const seedSql=new SQL.Database();
seedSql.run('CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY)');
seedSql.run('CREATE TABLE ingredient_inventory(ingredient_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL,unlocked INTEGER,updated_at TEXT,source_update_id TEXT)');
seedSql.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedSql.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT,PRIMARY KEY(update_id,operation_index))');
for(const name of ['SYNTHETIC_SEED','SYNTHETIC_INGREDIENT_A','SYNTHETIC_INGREDIENT_B','SYNTHETIC_INGREDIENT_C','SYNTHETIC_BLOCKED'])
  seedSql.run('INSERT INTO ingredient_master(ingredient_name) VALUES(?)',[name]);
seedSql.run("INSERT INTO ingredient_inventory VALUES('SYNTHETIC_SEED',2,1,'2026-10-29T00:00:00.000Z','SYNTHETIC_SEED')");
seedSql.run("CREATE TRIGGER deny_fixture_ingredient BEFORE INSERT ON ingredient_inventory WHEN NEW.ingredient_name='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'synthetic-ingredient-insert-rejection'); END");
const seed=new Uint8Array(seedSql.export());seedSql.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('g265-ninth-manual-ingredient-disposable-cas',1);
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
  return createManualIngredientOptIn({pairGate,openSqlite:bytes=>{
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
      ingredients:query('SELECT ingredient_name,quantity,unlocked,source_update_id FROM ingredient_inventory ORDER BY ingredient_name'),
      batches:query('SELECT update_id,source,operation_count FROM import_batches ORDER BY update_id'),
      changes:query('SELECT update_id,entity,action,before_json,after_json FROM import_changes ORDER BY update_id'),
      masters:query('SELECT ingredient_name FROM ingredient_master ORDER BY ingredient_name')
    };
  }finally{sql.close();}
};
const input={name:'SYNTHETIC_INGREDIENT_A',quantity:9,
  updatedAt:'2026-10-29T00:01:00.000Z',auditId:'MANUAL-G265-ING-A',
  expectedGeneration:0,expectedFingerprint:seedHash};
const invalid=make();
for(const bad of [
  {...input,name:''},{...input,quantity:-1},{...input,quantity:1.5},
  {...input,quantity:Number.MAX_SAFE_INTEGER+1},
  {...input,unlockInput:0},{...input,unlockInput:'bad'},
  {...input,updatedAt:'2026-02-30T00:00:00.000Z'},
  {...input,auditId:'external-id'}
])await assert.rejects(invalid.execute(bad),
  e=>String(e.code||'').startsWith('G265_MANUAL_INGREDIENT_'));
assert.equal(opened,0);
assert.equal((await read()).revision.generation,0);
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_INVALID_INPUT_UNLOCK_CONTRADICTION_PRE_SQL');

const first=await make().execute(input);
assert.equal(first.status,'PERSISTED');
assert.equal(first.generation,1);
assert.equal(first.unlocked,1);
let current=await read();
assert.equal(current.revision.sha256,first.sha256);
assert.deepEqual(current.ingredients.find(x=>x[0]==='SYNTHETIC_INGREDIENT_A').slice(1),[9,1,'MANUAL-EDIT']);
assert.deepEqual(current.ingredients.find(x=>x[0]==='SYNTHETIC_SEED').slice(1),[2,1,'SYNTHETIC_SEED']);
assert.deepEqual(current.batches,[['MANUAL-G265-ING-A','manual_frontend_edit',1]]);
assert.equal(current.changes.length,1);
assert.equal(JSON.parse(current.changes[0][3]),null);
assert.equal(JSON.parse(current.changes[0][4]).unlocked,1);
const masterBaseline=current.masters;
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_FRESH_DURABLE_CAS_UNLOCK_AND_PRIVATE_AUDIT_ACK');

const beforeRaceOpen=opened;
const next={...input,name:'SYNTHETIC_INGREDIENT_B',quantity:0,
  auditId:'MANUAL-G265-ING-B',updatedAt:'2026-10-29T00:02:00.000Z',
  expectedGeneration:1,expectedFingerprint:first.sha256};
const a=make(),b=make();
const [winner,stale]=await Promise.allSettled([
  a.execute(next),
  b.execute({...next,name:'SYNTHETIC_INGREDIENT_C',quantity:4,auditId:'MANUAL-G265-ING-C'})
]);
assert.equal(winner.status,'fulfilled');
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+2,'stale contender must open zero SQL.js connections');
current=await read();
assert.equal(current.revision.generation,2);
assert.deepEqual(current.ingredients.find(x=>x[0]==='SYNTHETIC_INGREDIENT_B').slice(1),[0,null,'MANUAL-EDIT']);
assert.equal(current.ingredients.filter(x=>x[0]==='SYNTHETIC_INGREDIENT_C').length,0);
assert.deepEqual(current.batches.map(x=>x[0]),['MANUAL-G265-ING-A','MANUAL-G265-ING-B']);
assert.deepEqual(current.changes.map(x=>x[0]),['MANUAL-G265-ING-A','MANUAL-G265-ING-B']);
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_TWO_WRITERS_ONE_ACK_STALE_ZERO_SQLJS_NO_AUDIT_LOSS');

const third=await make().execute({...next,name:'SYNTHETIC_INGREDIENT_C',quantity:4,
  auditId:'MANUAL-G265-ING-C',updatedAt:'2026-10-29T00:03:00.000Z',
  expectedGeneration:2,expectedFingerprint:winner.value.sha256});
assert.equal(third.unlocked,1);
current=await read();
assert.equal(current.revision.generation,3);
assert.equal(current.ingredients.length,4);
assert.equal(current.batches.length,3);
assert.equal(current.changes.length,3);
assert.deepEqual(current.masters,masterBaseline,'Public Master must remain unchanged');
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_EXPLICIT_FRESH_RELOAD_PRESERVES_ALL_ACKS_MASTER');

const fourth=await make().execute({...next,name:'SYNTHETIC_INGREDIENT_A',quantity:0,
  auditId:'MANUAL-G265-ING-A-ZERO',updatedAt:'2026-10-29T00:04:00.000Z',
  expectedGeneration:3,expectedFingerprint:third.sha256});
assert.equal(fourth.unlocked,1,'zero quantity with omitted unlock preserves durable prior unlock');
const fifth=await make().execute({...next,name:'SYNTHETIC_INGREDIENT_B',quantity:0,unlockInput:0,
  auditId:'MANUAL-G265-ING-B-LOCKED',updatedAt:'2026-10-29T00:05:00.000Z',
  expectedGeneration:4,expectedFingerprint:fourth.sha256});
assert.equal(fifth.unlocked,0,'explicit zero quantity locked state must remain distinguishable');
current=await read();
assert.deepEqual(current.ingredients.find(x=>x[0]==='SYNTHETIC_INGREDIENT_A').slice(1),[0,1,'MANUAL-EDIT']);
assert.deepEqual(current.ingredients.find(x=>x[0]==='SYNTHETIC_INGREDIENT_B').slice(1),[0,0,'MANUAL-EDIT']);
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_ZERO_OMITTED_PRESERVES_PRIOR_EXPLICIT_LOCKED_DISTINCT_UNKNOWN');

const stable=await read();
const now={...next,name:'SYNTHETIC_INGREDIENT_B',quantity:7,
  expectedGeneration:5,expectedFingerprint:fifth.sha256,
  updatedAt:'2026-10-29T00:06:00.000Z'};
const replay=make();
await assert.rejects(replay.execute({...now,auditId:'MANUAL-G265-ING-A'}),
  e=>e.code==='G265_MANUAL_INGREDIENT_AUDIT_ID_REPLAY');
assert.equal(replay.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const missingMaster=make();
await assert.rejects(missingMaster.execute({...now,name:'UNKNOWN_INGREDIENT',auditId:'MANUAL-G265-ING-UNKNOWN'}),
  e=>e.code==='G265_MANUAL_INGREDIENT_MASTER_IDENTITY_MISSING');
assert.equal(missingMaster.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rollback=make();
await assert.rejects(rollback.execute({...now,name:'SYNTHETIC_BLOCKED',
  auditId:'MANUAL-G265-ING-TRIGGER'}),
  e=>String(e.message||'').includes('synthetic-ingredient-insert-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
let after=await read();
assert.equal(after.revision.sha256,stable.revision.sha256);
assert.deepEqual(after.ingredients,stable.ingredients);
assert.deepEqual(after.batches,stable.batches);
assert.deepEqual(after.changes,stable.changes);
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_AUDIT_REPLAY_MASTER_GUARD_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...now,auditId:'MANUAL-G265-ING-NOLOCK'}),
  e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
after=await read();
assert.equal(after.revision.sha256,stable.revision.sha256);
console.log('PASS G265_NINTH_MANUAL_INGREDIENT_NO_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_NINTH_MANUAL_INGREDIENT_PRODUCTION_UNADMITTED_ALL_WRITERS_CRASH_RECOVERY_ANDROID');
