// G265 evaluation snapshot: source-bound isolated opt-in CAS matrix.
// Synthetic SQL.js, fake IndexedDB and queueing locks; NEVER production/player data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createEvaluationSnapshotOptIn} from '../assets/js/sqlite-evaluation-snapshot-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/pokemon-evaluation-store.js',import.meta.url),'utf8');
const marker='export async function refreshFactEvaluationSnapshots(';
assert.equal(legacy.split(marker).length,2);
const operation=marker+legacy.split(marker)[1];
assert.match(operation,/await snapshot\('war-room:evaluation-snapshots'\)/);
assert.match(operation,/INSERT INTO pokemon_evaluation_snapshot\(/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-evaluation-snapshot-optin/);
const schema=fs.readFileSync(new URL('../assets/js/schema.js',import.meta.url),'utf8');
assert.match(schema,/CREATE TABLE IF NOT EXISTS pokemon_evaluation_snapshot\(/);
assert.match(schema,/UNIQUE\(pokemon_id,input_fingerprint\)/);
console.log('PASS G265_EVALUATION_OPTIN_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run("CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,status TEXT NOT NULL)");
seedDb.run("INSERT INTO pokemon VALUES('SYNTHETIC_SEED','active'),('SYNTHETIC_A','active'),('SYNTHETIC_B','active'),('SYNTHETIC_C','active'),('SYNTHETIC_BLOCKED','active'),('SYNTHETIC_INACTIVE','inactive')");
seedDb.run("CREATE TABLE pokemon_evaluation_snapshot(evaluation_id TEXT PRIMARY KEY,pokemon_id TEXT NOT NULL,input_fingerprint TEXT NOT NULL,context_id TEXT,goal_profile_id TEXT,master_versions_json TEXT NOT NULL DEFAULT '{}',rule_version TEXT NOT NULL,intrinsic_score REAL,current_readiness_score REAL,weekly_fit_score REAL,roster_marginal_value_score REAL,training_roi_score REAL,score_breakdown_json TEXT NOT NULL DEFAULT '{}',reasons_json TEXT NOT NULL DEFAULT '[]',missing_inputs_json TEXT NOT NULL DEFAULT '[]',hard_constraint_status TEXT NOT NULL DEFAULT 'REVIEW',failed_constraints_json TEXT NOT NULL DEFAULT '[]',evaluation_status TEXT NOT NULL,evaluated_at TEXT NOT NULL,stale_at TEXT,UNIQUE(pokemon_id,input_fingerprint))");
seedDb.run("INSERT INTO pokemon_evaluation_snapshot(evaluation_id,pokemon_id,input_fingerprint,rule_version,evaluation_status,evaluated_at) VALUES('eval_seed','SYNTHETIC_SEED','seed:synthetic','SYNTHETIC_RULE','READY','2026-10-30T00:00:00.000Z')");
seedDb.run("CREATE TABLE public_event_master(event_id TEXT PRIMARY KEY,payload TEXT)");
seedDb.run("INSERT INTO public_event_master VALUES('fixture-event','SYNTHETIC_MASTER_UNCHANGED')");
seedDb.run("CREATE TRIGGER deny_fixture_evaluation BEFORE INSERT ON pokemon_evaluation_snapshot WHEN NEW.evaluation_id='eval_blocked' BEGIN SELECT RAISE(ABORT,'synthetic-evaluation-rejection'); END");
const seed=new Uint8Array(seedDb.export());seedDb.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('g265-evaluation-snapshot-disposable-cas',1);
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
  return createEvaluationSnapshotOptIn({pairGate,openSqlite:bytes=>{opened++;return new SQL.Database(bytes);}});
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
      rows:sql.exec('SELECT evaluation_id,pokemon_id,input_fingerprint,stale_at FROM pokemon_evaluation_snapshot ORDER BY evaluation_id')?.[0]?.values||[],
      pokemon:sql.exec('SELECT * FROM pokemon ORDER BY pokemon_id')?.[0]?.values||[],
      master:sql.exec('SELECT * FROM public_event_master')?.[0]?.values||[]};
  }finally{sql.close();}
};
const input={pokemonId:'SYNTHETIC_A',evaluationId:'eval_A',
  inputFingerprint:'synthetic:A1',evaluatedAt:'2026-10-31T00:00:00.000Z',
  expectedCurrentEvaluationId:null,expectedGeneration:0,expectedFingerprint:seedHash,
  scores:{intrinsic:1,readiness:2,weekly:3,marginal:4,roi:5}};
const before=await read();
const invalid=make();
for(const bad of [
  {...input,pokemonId:'bad id'},{...input,evaluationId:'invalid'},
  {...input,inputFingerprint:' bad'},{...input,evaluatedAt:'2026-02-30T00:00:00.000Z'},
  {...input,scores:{...input.scores,roi:Infinity}},
  {...input,expectedCurrentEvaluationId:'bad;DROP TABLE'}
])await assert.rejects(invalid.execute(bad),
  error=>String(error.code||'').startsWith('G265_EVALUATION_'));
assert.equal(opened,0);
assert.equal((await read()).revision.generation,0);
console.log('PASS G265_EVALUATION_OPTIN_INVALID_INPUT_PRE_SQL_ZERO_DURABLE_DELTA');

const first=await make().execute(input);
assert.equal(first.status,'PERSISTED');assert.equal(first.generation,1);
let current=await read();
assert.equal(current.rows.length,2);
assert.ok(current.rows.some(row=>row[0]==='eval_seed'&&row[3]===null));
assert.ok(current.rows.some(row=>row[0]==='eval_A'&&row[1]==='SYNTHETIC_A'));
assert.deepEqual(current.master,before.master);
assert.deepEqual(current.pokemon,before.pokemon);
console.log('PASS G265_EVALUATION_OPTIN_FRESH_DURABLE_CAS_ACK_MASTER_PLAYER_UNCHANGED');

const next={...input,pokemonId:'SYNTHETIC_B',evaluationId:'eval_B',
  inputFingerprint:'synthetic:B1',evaluatedAt:'2026-10-31T00:01:00.000Z',
  expectedGeneration:1,expectedFingerprint:first.sha256};
const openBeforeRace=opened;
const [winner,loser]=await Promise.allSettled([
  make().execute(next),
  make().execute({...next,pokemonId:'SYNTHETIC_C',evaluationId:'eval_C',
    inputFingerprint:'synthetic:C1'})
]);
assert.equal(winner.status,'fulfilled');
assert.equal(loser.status,'rejected');
assert.equal(loser.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(opened,openBeforeRace+2,'stale session must not open SQL.js');
current=await read();
assert.equal(current.revision.generation,2);
assert.ok(current.rows.some(row=>row[0]==='eval_B'));
assert.ok(!current.rows.some(row=>row[0]==='eval_C'));
console.log('PASS G265_EVALUATION_OPTIN_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

const third=await make().execute({...next,pokemonId:'SYNTHETIC_C',
  evaluationId:'eval_C',inputFingerprint:'synthetic:C1',
  evaluatedAt:'2026-10-31T00:02:00.000Z',
  expectedGeneration:2,expectedFingerprint:winner.value.sha256});
current=await read();
assert.equal(current.revision.generation,3);
assert.deepEqual(current.rows.map(row=>row[0]),['eval_A','eval_B','eval_C','eval_seed']);
console.log('PASS G265_EVALUATION_OPTIN_FRESH_RETRY_PRESERVES_ALL_CONFIRMED_ROWS');

const stable=await read();
const wrong=make();
await assert.rejects(wrong.execute({...input,evaluationId:'eval_A2',
  inputFingerprint:'synthetic:A2',evaluatedAt:'2026-10-31T00:03:00.000Z',
  expectedGeneration:3,expectedFingerprint:third.sha256}),
  error=>error.code==='G265_EVALUATION_CURRENT_REVISION_CHANGED');
assert.equal(wrong.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const rollback=make();
await assert.rejects(rollback.execute({...input,pokemonId:'SYNTHETIC_BLOCKED',
  evaluationId:'eval_blocked',inputFingerprint:'synthetic:blocked',
  expectedGeneration:3,expectedFingerprint:third.sha256}),
  error=>String(error.message||'').includes('synthetic-evaluation-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const inactive=make();
await assert.rejects(inactive.execute({...input,pokemonId:'SYNTHETIC_INACTIVE',
  evaluationId:'eval_inactive',inputFingerprint:'synthetic:inactive',
  expectedGeneration:3,expectedFingerprint:third.sha256}),
  error=>error.code==='G265_EVALUATION_POKEMON_NOT_ACTIVE');
current=await read();
assert.equal(current.revision.sha256,stable.revision.sha256);
assert.deepEqual(current.rows,stable.rows);
assert.deepEqual(current.master,before.master);
console.log('PASS G265_EVALUATION_OPTIN_PRECONDITION_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

const fourth=await make().execute({...input,evaluationId:'eval_A2',
  inputFingerprint:'synthetic:A2',evaluatedAt:'2026-10-31T00:04:00.000Z',
  expectedCurrentEvaluationId:'eval_A',expectedGeneration:3,expectedFingerprint:third.sha256});
current=await read();
assert.equal(current.revision.generation,4);
assert.ok(current.rows.some(row=>row[0]==='eval_A'&&row[3]==='2026-10-31T00:04:00.000Z'));
assert.ok(current.rows.some(row=>row[0]==='eval_A2'&&row[3]===null));
assert.deepEqual(current.master,before.master);
console.log('PASS G265_EVALUATION_OPTIN_PREVIOUS_ROW_STALE_AND_INDEPENDENT_ACK_READBACK');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...input,pokemonId:'SYNTHETIC_B',
  evaluationId:'eval_B2',inputFingerprint:'synthetic:B2',
  expectedCurrentEvaluationId:'eval_B',expectedGeneration:4,
  expectedFingerprint:fourth.sha256}),
  error=>error.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
assert.equal((await read()).revision.sha256,fourth.sha256);
console.log('PASS G265_EVALUATION_OPTIN_NO_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_EVALUATION_OPTIN_NOT_PRODUCTION_ALL_WRITERS_CRASH_RESTORE_ANDROID');
