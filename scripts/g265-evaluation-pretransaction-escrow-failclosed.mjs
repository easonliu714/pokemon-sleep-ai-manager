// G265 thirteenth evaluation: independently durable pre-transaction escrow.
// Disposable synthetic SQL.js + fake IndexedDB only; never production player data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createEvaluationSnapshotOptIn} from '../assets/js/sqlite-evaluation-snapshot-optin.js';
import {createDisposableEvaluationEscrowStore,
  createEvaluationPreTransactionEscrowOptIn} from '../assets/js/sqlite-evaluation-pretransaction-escrow-optin.js';

const legacy=fs.readFileSync(new URL('../assets/js/pokemon-evaluation-store.js',import.meta.url),'utf8');
assert.match(legacy,/export async function refreshFactEvaluationSnapshots\(/);
assert.match(legacy,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-evaluation-pretransaction-escrow-optin/);
console.log('PASS G265_ESCROW_EXACT_LEGACY_WRITER_NOT_PRODUCTION_WIRED');

const SQL=await initSqlJs(),hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,status TEXT NOT NULL)');
seedDb.run("INSERT INTO pokemon VALUES('SYNTHETIC_A','active'),('SYNTHETIC_B','active'),('SYNTHETIC_BLOCKED','active')");
seedDb.run("CREATE TABLE pokemon_evaluation_snapshot(evaluation_id TEXT PRIMARY KEY,pokemon_id TEXT NOT NULL,input_fingerprint TEXT NOT NULL,context_id TEXT,goal_profile_id TEXT,master_versions_json TEXT NOT NULL DEFAULT '{}',rule_version TEXT NOT NULL,intrinsic_score REAL,current_readiness_score REAL,weekly_fit_score REAL,roster_marginal_value_score REAL,training_roi_score REAL,score_breakdown_json TEXT NOT NULL DEFAULT '{}',reasons_json TEXT NOT NULL DEFAULT '[]',missing_inputs_json TEXT NOT NULL DEFAULT '[]',hard_constraint_status TEXT NOT NULL DEFAULT 'REVIEW',failed_constraints_json TEXT NOT NULL DEFAULT '[]',evaluation_status TEXT NOT NULL,evaluated_at TEXT NOT NULL,stale_at TEXT,UNIQUE(pokemon_id,input_fingerprint))");
seedDb.run('CREATE TABLE public_event_master(event_id TEXT PRIMARY KEY,payload TEXT)');
seedDb.run("INSERT INTO public_event_master VALUES('synthetic-master','DO_NOT_CHANGE')");
seedDb.run("CREATE TRIGGER deny_evaluation BEFORE INSERT ON pokemon_evaluation_snapshot WHEN NEW.evaluation_id='eval_blocked' BEGIN SELECT RAISE(ABORT,'synthetic-denial'); END");
const seed=new Uint8Array(seedDb.export());seedDb.close();
const seedHash=await hash(seed);
const openDb=(name,version,upgrade)=>new Promise((resolve,reject)=>{
  const request=indexedDB.open(name,version);
  request.onupgradeneeded=()=>upgrade?.(request.result);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});
const db=await openDb('g265-escrow-synthetic-primary',1,db=>{
  db.createObjectStore('database');db.createObjectStore('metadata');
});
await new Promise((resolve,reject)=>{
  const tx=db.transaction(['database','metadata'],'readwrite');
  tx.objectStore('database').put(seed.slice().buffer,'primary');
  tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
let queue=Promise.resolve();
const locks={request(_name,_options,callback){
  const next=queue.then(()=>callback({mode:'exclusive'}));
  queue=next.catch(()=>{});return next;
}};
const pair=()=>createSqliteVersionNeutralAtomicPairGate({db,locks,fingerprint:hash});
const makeWriter=(gate=pair())=>createEvaluationSnapshotOptIn({
  pairGate:gate,openSqlite:bytes=>new SQL.Database(bytes)
});
const make=(name,writer=makeWriter())=>createEvaluationPreTransactionEscrowOptIn({
  pairGate:pair(),writer,fingerprint:hash,
  escrow:createDisposableEvaluationEscrowStore({
    indexedDB,name:'g265-evaluation-escrow-disposable-'+name})
});
const input=(pokemonId,evaluationId,rev)=>({
  pokemonId,evaluationId,inputFingerprint:'synthetic:'+evaluationId,
  evaluatedAt:'2026-10-31T00:00:00.000Z',
  expectedCurrentEvaluationId:null,
  expectedGeneration:rev.generation,expectedFingerprint:rev.sha256,
  scores:{intrinsic:1,readiness:2,weekly:3,marginal:4,roi:5}
});
const inspect=async()=>{
  const verified=await pair().readVerified();
  assert.equal(await hash(verified.bytes),verified.sha256);
  const sql=new SQL.Database(verified.bytes);
  try{
    return {generation:verified.generation,sha256:verified.sha256,
      rows:sql.exec('SELECT evaluation_id FROM pokemon_evaluation_snapshot ORDER BY evaluation_id')?.[0]?.values.flat()||[],
      master:sql.exec('SELECT * FROM public_event_master')?.[0]?.values||[]};
  }finally{sql.close();}
};
const initial=await inspect();
const first=make('success'),a=input('SYNTHETIC_A','eval_A',initial);
await first.capture(a);
assert.equal((await first.inspectRecovery()).classification,'NO_DURABLE_DELTA');
const ack=await first.execute(a);
assert.equal(ack.status,'PERSISTED');
assert.equal(first.status().status,'ACKED');
assert.equal((await first.inspectRecovery()).classification,'DURABLE_CHANGED_HOLD');
const after=await inspect();
assert.deepEqual(after.rows,['eval_A']);
assert.deepEqual(after.master,initial.master);
await assert.rejects(first.restore(),e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),after);
console.log('PASS G265_ESCROW_INDEPENDENT_PREWRITE_DURABLE_READBACK_ACK_NO_AUTO_RESTORE');

const duplicate=make('success');
await assert.rejects(duplicate.capture({expectedGeneration:after.generation,
  expectedFingerprint:after.sha256}),e=>e.code==='G265_ESCROW_WRITE_FAILED'
  ||e.code==='G265_ESCROW_WRITE_ABORTED');
assert.equal(duplicate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(await inspect(),after);
console.log('PASS G265_ESCROW_UNRESOLVED_SNAPSHOT_IMMUTABLE_NO_OVERWRITE');

const crash=make('crash-before-write');
await crash.capture({expectedGeneration:after.generation,expectedFingerprint:after.sha256});
const restarted=make('crash-before-write');
const noDelta=await restarted.inspectRecovery();
assert.equal(noDelta.classification,'NO_DURABLE_DELTA');
assert.equal(noDelta.restoreAuthorized,false);
await assert.rejects(restarted.restore(),e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),after);
console.log('PASS G265_ESCROW_TAB_CLOSE_NEW_SESSION_NO_DELTA_RESTORE_REFUSED');

const failed=make('sql-rollback');
const blocked=input('SYNTHETIC_BLOCKED','eval_blocked',after);
await failed.capture(blocked);
await assert.rejects(failed.execute(blocked),e=>String(e.message).includes('synthetic-denial'));
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal((await make('sql-rollback').inspectRecovery()).classification,'NO_DURABLE_DELTA');
assert.deepEqual(await inspect(),after);
console.log('PASS G265_ESCROW_SQLJS_ROLLBACK_NO_DURABLE_DELTA_FAIL_CLOSED');

const ackGate=pair();
const loseAck={write:r=>ackGate.write(r),
  readVerified:()=>{throw Object.assign(new Error('SYNTHETIC_ACK_LOSS'),{code:'SYNTHETIC_ACK_LOSS'});},
  status:()=>ackGate.status()};
const uncertain=make('ack-loss',makeWriter(loseAck));
const b=input('SYNTHETIC_B','eval_B',after);
await uncertain.capture(b);
await assert.rejects(uncertain.execute(b),e=>e.code==='SYNTHETIC_ACK_LOSS');
assert.equal(uncertain.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const afterAckLoss=await inspect();
assert.deepEqual(afterAckLoss.rows,['eval_A','eval_B']);
assert.equal((await make('ack-loss').inspectRecovery()).classification,'DURABLE_CHANGED_HOLD');
await assert.rejects(uncertain.execute(b),e=>e.code==='G265_ESCROW_NOT_ARMED');
await assert.rejects(uncertain.restore(),e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),afterAckLoss);
console.log('PASS G265_ESCROW_ACK_LOSS_POSSIBLY_COMMITTED_NEVER_REPLAY_OR_RESTORE');

const stale=make('stale-revision');
await assert.rejects(stale.capture(a),e=>e.code==='G265_ESCROW_STALE_CAPTURE');
assert.equal(stale.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(await inspect(),afterAckLoss);
console.log('PASS G265_ESCROW_STALE_CAPTURE_NO_ESCROW_NO_DURABLE_DELTA');

const corrupt=make('corrupted');
await corrupt.capture({expectedGeneration:afterAckLoss.generation,
  expectedFingerprint:afterAckLoss.sha256});
const escrowDb=await openDb('g265-evaluation-escrow-disposable-corrupted',1);
await new Promise((resolve,reject)=>{
  const tx=escrowDb.transaction('escrow','readwrite');
  const request=tx.objectStore('escrow').get('pretransaction');
  request.onsuccess=()=>{
    const record=request.result;record.sha256='0'.repeat(64);
    tx.objectStore('escrow').put(record,'pretransaction');
  };
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
escrowDb.close();
await assert.rejects(make('corrupted').inspectRecovery(),
  e=>e.code==='G265_ESCROW_DIGEST_MISMATCH');
assert.deepEqual(await inspect(),afterAckLoss);
console.log('PASS G265_ESCROW_CORRUPT_SNAPSHOT_FAIL_CLOSED_ZERO_WRITES');

await assert.rejects(make('missing').inspectRecovery(),
  e=>e.code==='G265_ESCROW_MISSING_OR_INVALID');
await assert.rejects(make('missing').restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
// A non-throwing writer can still report a rejected/unverified result.
// Do not convert Promise resolution into a false durable success ACK.
for(const result of [undefined,{status:'REJECTED',reason:'SYNTHETIC_REJECTION'},
  {status:'UNVERIFIED_RELOAD_REQUIRED'}]){
  const tag=result?.status||'undefined';
  const name='nonack-'+tag.toLowerCase().replace(/[^a-z0-9_-]/g,'-');
  const session=make(name,{execute:async()=>result});
  const revision=await inspect();
  const attempt=input('SYNTHETIC_A','eval_nonack_'+tag,revision);
  await session.capture(attempt);
  await assert.rejects(session.execute(attempt),
    e=>e.code==='G265_ESCROW_WRITER_ACK_NOT_VERIFIED');
  assert.equal(session.status().status,'UNVERIFIED_RELOAD_REQUIRED');
  await assert.rejects(session.execute(attempt),e=>e.code==='G265_ESCROW_NOT_ARMED');
  const recovery=await make(name).inspectRecovery();
  assert.equal(recovery.classification,'NO_DURABLE_DELTA');
  assert.equal(recovery.restoreAuthorized,false);
  assert.deepEqual(await inspect(),revision);
}
console.log('PASS G265_ESCROW_NON_PERSISTED_RESOLVED_WRITER_NEVER_FALSE_ACK_STICKY');

// Concurrent capture must reserve its single-use session before asynchronous I/O.
// A second call is rejected without reading or writing an escrow; the first
// may still arm cleanly and the player's durable revision remains untouched.
const captureBefore=await inspect();
const captureRevision={expectedGeneration:captureBefore.generation,
  expectedFingerprint:captureBefore.sha256};
let releaseCaptureRead,notifyCaptureRead,captureReads=0,captureWrites=0,captureWriterCalls=0;
const captureReadStarted=new Promise(resolve=>{notifyCaptureRead=resolve;});
const captureReadGate=pair();
const raceEscrow=createDisposableEvaluationEscrowStore({
  indexedDB,name:'g265-evaluation-escrow-disposable-concurrent-capture'});
const raceSession=createEvaluationPreTransactionEscrowOptIn({
  pairGate:{readVerified:async()=>{
    captureReads++;notifyCaptureRead();
    await new Promise(resolve=>{releaseCaptureRead=resolve;});
    return captureReadGate.readVerified();
  }},
  escrow:{
    write:async record=>{captureWrites++;return raceEscrow.write(record);},
    read:()=>raceEscrow.read()
  },
  writer:{execute:async()=>{captureWriterCalls++;throw Error('WRITER_MUST_NOT_EXECUTE');}},
  fingerprint:hash
});
const firstCapturePending=raceSession.capture(captureRevision);
await captureReadStarted;
await assert.rejects(raceSession.capture(captureRevision),
  e=>e.code==='G265_ESCROW_SESSION_NOT_READY');
assert.equal(captureReads,1);
releaseCaptureRead();
const firstCaptureResult=await firstCapturePending;
assert.equal(firstCaptureResult.status,'ESCROW_VERIFIED');
assert.equal(raceSession.status().status,'ARMED');
assert.equal(captureWrites,1);
await assert.rejects(raceSession.capture(captureRevision),
  e=>e.code==='G265_ESCROW_SESSION_NOT_READY');
const savedCapture=await raceEscrow.read();
assert.equal(savedCapture.generation,captureBefore.generation);
assert.equal(savedCapture.sha256,captureBefore.sha256);
assert.equal(captureWriterCalls,0);
assert.deepEqual(await inspect(),captureBefore);
console.log('PASS G265_ESCROW_CONCURRENT_CAPTURE_SINGLE_FLIGHT_NO_POISON_NO_DURABLE_WRITE');

// A legitimate second writer may advance the durable revision while the
// immutable escrow is being persisted. The first capture must never arm a
// stale baseline, even though its escrow write/readback succeeded.
const postCaptureBefore=await inspect();
const postCaptureEscrow=createDisposableEvaluationEscrowStore({
  indexedDB,name:'g265-evaluation-escrow-disposable-postcapture-race'});
let postCaptureCompetingAcks=0,postCaptureWriterCalls=0;
const postCaptureSession=createEvaluationPreTransactionEscrowOptIn({
  pairGate:pair(),fingerprint:hash,
  escrow:{
    write:async record=>{
      await postCaptureEscrow.write(record);
      const competing=await makeWriter().execute(input(
        'SYNTHETIC_BLOCKED','eval_postcapture_race',postCaptureBefore));
      assert.equal(competing.status,'PERSISTED');
      postCaptureCompetingAcks++;
    },
    read:()=>postCaptureEscrow.read()
  },
  writer:{execute:async()=>{postCaptureWriterCalls++;throw Error('STALE_WRITER_MUST_NOT_RUN');}}
});
const postCaptureRevision={expectedGeneration:postCaptureBefore.generation,
  expectedFingerprint:postCaptureBefore.sha256};
await assert.rejects(postCaptureSession.capture(postCaptureRevision),
  e=>e.code==='G265_ESCROW_POST_CAPTURE_DURABLE_CHANGED');
assert.equal(postCaptureSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(postCaptureCompetingAcks,1);
assert.equal(postCaptureWriterCalls,0);
await assert.rejects(postCaptureSession.execute(input(
  'SYNTHETIC_BLOCKED','eval_stale_replay',postCaptureBefore)),
  e=>e.code==='G265_ESCROW_NOT_ARMED');
const postCaptureAfter=await inspect();
assert.equal(postCaptureAfter.generation,postCaptureBefore.generation+1);
assert.deepEqual(postCaptureAfter.rows,[...postCaptureBefore.rows,'eval_postcapture_race'].sort());
assert.deepEqual(postCaptureAfter.master,postCaptureBefore.master);
const postCaptureSaved=await postCaptureEscrow.read();
assert.equal(postCaptureSaved.generation,postCaptureBefore.generation);
assert.equal(postCaptureSaved.sha256,postCaptureBefore.sha256);
assert.equal((await createEvaluationPreTransactionEscrowOptIn({
  pairGate:pair(),escrow:postCaptureEscrow,writer:makeWriter(),fingerprint:hash
}).inspectRecovery()).classification,'DURABLE_CHANGED_HOLD');
assert.deepEqual(await inspect(),postCaptureAfter);
console.log('PASS G265_ESCROW_POST_CAPTURE_NEWER_ACK_NEVER_ARM_STALE_NO_RESTORE');

db.close();
console.log('PASS G265_ESCROW_MISSING_SNAPSHOT_RESTORE_REFUSED');
console.log('HOLD G265_ESCROW_NOT_PRODUCTION_CRASH_RESTORE_ALL_WRITERS_OWNER_ANDROID');
