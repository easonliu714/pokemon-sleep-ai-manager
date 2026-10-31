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
    captureReads++;
    // Only the initial read is intentionally delayed; the new post-escrow
    // revalidation read must complete rather than waiting on a second latch.
    if(captureReads===1){
      notifyCaptureRead();
      await new Promise(resolve=>{releaseCaptureRead=resolve;});
    }
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
assert.equal(captureReads,2); // Initial read + post-escrow revision revalidation.
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

// A recovery reader can observe an old verified durable pair just before
// another legitimate writer ACKs. A second independent read must catch the
// revision change and never classify the snapshot as safe/no-delta.
const recoveryBefore=await inspect();
const recoverySession=make('recovery-read-race');
await recoverySession.capture({expectedGeneration:recoveryBefore.generation,
  expectedFingerprint:recoveryBefore.sha256});
let recoveryReads=0,recoveryCompetingAcks=0,recoveryWriterCalls=0;
const recoveryObserver=createEvaluationPreTransactionEscrowOptIn({
  pairGate:{readVerified:async()=>{
    const observed=await pair().readVerified();
    recoveryReads++;
    if(recoveryReads===1){
      const competing=await makeWriter().execute({
        ...input('SYNTHETIC_B','eval_recovery_race',recoveryBefore),
        expectedCurrentEvaluationId:'eval_B'
      });
      assert.equal(competing.status,'PERSISTED');
      recoveryCompetingAcks++;
    }
    return observed;
  }},
  escrow:createDisposableEvaluationEscrowStore({
    indexedDB,name:'g265-evaluation-escrow-disposable-recovery-read-race'
  }),
  writer:{execute:async()=>{recoveryWriterCalls++;throw Error('RECOVERY_MUST_NOT_WRITE');}},
  fingerprint:hash
});
const racedRecovery=await recoveryObserver.inspectRecovery();
const recoveryAfter=await inspect();
assert.equal(recoveryReads,2);
assert.equal(recoveryCompetingAcks,1);
assert.equal(recoveryWriterCalls,0);
assert.equal(racedRecovery.observationStable,false);
assert.equal(racedRecovery.classification,'DURABLE_CHANGED_HOLD');
assert.equal(racedRecovery.restoreAuthorized,false);
assert.equal(racedRecovery.snapshotGeneration,recoveryBefore.generation);
assert.equal(racedRecovery.currentGeneration,recoveryBefore.generation+1);
assert.deepEqual(recoveryAfter.rows,[...recoveryBefore.rows,'eval_recovery_race'].sort());
assert.deepEqual(recoveryAfter.master,recoveryBefore.master);
await assert.rejects(recoveryObserver.restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),recoveryAfter);
console.log('PASS G265_ESCROW_RECOVERY_INTERLEAVED_NEWER_ACK_TWO_READS_HOLD_NO_RESTORE');

// An untrusted/defective opt-in writer can claim PERSISTED without making
// any durable change. The escrow must independently read back the CAS pair
// instead of treating the writer's returned status as a successful ACK.
const forgedBefore=await inspect();
const forgedSession=make('forged-persisted-no-write',{
  execute:async()=>({status:'PERSISTED',generation:forgedBefore.generation+1,
    sha256:'1'.repeat(64)})
});
const forgedInput=input('SYNTHETIC_A','eval_forged_no_write',forgedBefore);
await forgedSession.capture(forgedInput);
await assert.rejects(forgedSession.execute(forgedInput),
  e=>e.code==='G265_ESCROW_POST_ACK_DURABLE_MISMATCH');
assert.equal(forgedSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(forgedSession.execute(forgedInput),
  e=>e.code==='G265_ESCROW_NOT_ARMED');
assert.deepEqual(await inspect(),forgedBefore);
const forgedRecovery=await make('forged-persisted-no-write').inspectRecovery();
assert.equal(forgedRecovery.classification,'NO_DURABLE_DELTA');
assert.equal(forgedRecovery.restoreAuthorized,false);
console.log('PASS G265_ESCROW_FORGED_PERSISTED_NO_DURABLE_WRITE_NEVER_ACK');

// A real atomic CAS can succeed while the writer returns a mismatched ACK
// digest. Preserve the committed newer row, but fail closed and never restore
// or replay based on an unverified response.
const mismatchedBefore=await inspect();
const realMismatchedWriter=makeWriter();
const mismatchedSession=make('persisted-wrong-ack-digest',{
  execute:async request=>{
    const persisted=await realMismatchedWriter.execute(request);
    assert.equal(persisted.status,'PERSISTED');
    return {...persisted,sha256:'0'.repeat(64)};
  }
});
const mismatchedInput={...input('SYNTHETIC_A','eval_escrow_ack_mismatch',mismatchedBefore),
  expectedCurrentEvaluationId:'eval_A'};
await mismatchedSession.capture(mismatchedInput);
await assert.rejects(mismatchedSession.execute(mismatchedInput),
  e=>e.code==='G265_ESCROW_POST_ACK_DURABLE_MISMATCH');
assert.equal(mismatchedSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const mismatchedAfter=await inspect();
assert.equal(mismatchedAfter.generation,mismatchedBefore.generation+1);
assert.deepEqual(mismatchedAfter.rows,
  [...mismatchedBefore.rows,'eval_escrow_ack_mismatch'].sort());
assert.deepEqual(mismatchedAfter.master,mismatchedBefore.master);
const mismatchedRecovery=await make('persisted-wrong-ack-digest').inspectRecovery();
assert.equal(mismatchedRecovery.classification,'DURABLE_CHANGED_HOLD');
assert.equal(mismatchedRecovery.restoreAuthorized,false);
await assert.rejects(mismatchedSession.execute(mismatchedInput),
  e=>e.code==='G265_ESCROW_NOT_ARMED');
await assert.rejects(mismatchedSession.restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),mismatchedAfter);
console.log('PASS G265_ESCROW_COMMITTED_WITH_MISMATCHED_ACK_FAIL_CLOSED_NO_REPLAY');

// Snapshot read stability: two durable observations can be identical while a
// separate IDB actor replaces a digest-valid escrow snapshot in between.
const snapshotBefore=await inspect();
const snapshotName='recovery-snapshot-stability';
await make(snapshotName).capture({expectedGeneration:snapshotBefore.generation,
  expectedFingerprint:snapshotBefore.sha256});
const snapshotStore=createDisposableEvaluationEscrowStore({
  indexedDB,name:'g265-evaluation-escrow-disposable-'+snapshotName});
let snapshotReads=0,snapshotWriterCalls=0;
const snapshotObserver=createEvaluationPreTransactionEscrowOptIn({
  pairGate:pair(),fingerprint:hash,
  escrow:{write:async()=>{throw Error('RECOVERY_ESCROW_MUST_NOT_WRITE');},
    read:async()=>{
      snapshotReads++;
      return snapshotReads===1?await snapshotStore.read():
        {generation:0,sha256:seedHash,requestDigest:null,bytes:seed.slice().buffer};
    }},
  writer:{execute:async()=>{snapshotWriterCalls++;throw Error('RECOVERY_MUST_NOT_WRITE');}}
});
const changedSnapshot=await snapshotObserver.inspectRecovery();
assert.equal(snapshotReads,2);
assert.equal(changedSnapshot.observationStable,true);
assert.equal(changedSnapshot.snapshotStable,false);
assert.equal(changedSnapshot.classification,'DURABLE_CHANGED_HOLD');
assert.equal(changedSnapshot.restoreAuthorized,false);
assert.equal(snapshotWriterCalls,0);
await assert.rejects(snapshotObserver.restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),snapshotBefore);
const stableSnapshot=await make(snapshotName).inspectRecovery();
assert.equal(stableSnapshot.snapshotStable,true);
assert.equal(stableSnapshot.classification,'NO_DURABLE_DELTA');
console.log('PASS G265_ESCROW_RECOVERY_SNAPSHOT_SECOND_READ_CHANGED_HOLD_NO_RESTORE');

// Any failure in the second snapshot or durable read must reject and leave
// the persistent revision untouched, with restore still forbidden.
let escrowFailReads=0;
const escrowFail=createEvaluationPreTransactionEscrowOptIn({
  pairGate:pair(),fingerprint:hash,
  escrow:{write:async()=>{throw Error('RECOVERY_ESCROW_MUST_NOT_WRITE');},
    read:async()=>{
      if(++escrowFailReads===2)
        throw Object.assign(Error('SYNTHETIC_ESCROW_SECOND_READ_FAILED'),
          {code:'SYNTHETIC_ESCROW_SECOND_READ_FAILED'});
      return snapshotStore.read();
    }},
  writer:{execute:async()=>{throw Error('RECOVERY_MUST_NOT_WRITE');}}
});
await assert.rejects(escrowFail.inspectRecovery(),
  e=>e.code==='SYNTHETIC_ESCROW_SECOND_READ_FAILED');
assert.equal(escrowFailReads,2);
await assert.rejects(escrowFail.restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
let durableFailReads=0;
const durableFail=createEvaluationPreTransactionEscrowOptIn({
  pairGate:{readVerified:async()=>{
    if(++durableFailReads===2)
      throw Object.assign(Error('SYNTHETIC_DURABLE_SECOND_READ_FAILED'),
        {code:'SYNTHETIC_DURABLE_SECOND_READ_FAILED'});
    return pair().readVerified();
  }},
  escrow:snapshotStore,fingerprint:hash,
  writer:{execute:async()=>{throw Error('RECOVERY_MUST_NOT_WRITE');}}
});
await assert.rejects(durableFail.inspectRecovery(),
  e=>e.code==='SYNTHETIC_DURABLE_SECOND_READ_FAILED');
assert.equal(durableFailReads,2);
await assert.rejects(durableFail.restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),snapshotBefore);
console.log('PASS G265_ESCROW_RECOVERY_READ_FAILURE_FAIL_CLOSED_ZERO_WRITES');

// An escrow may be externally replaced or removed after a successful capture.
// A write must never start when its crash-readable pre-transaction evidence is
// no longer present and byte-digest-valid for the captured baseline.
const preflightBefore=await inspect();
for(const mutation of ['replace','delete']){
  const name='execute-preflight-'+mutation;
  const store=createDisposableEvaluationEscrowStore({
    indexedDB,name:'g265-evaluation-escrow-disposable-'+name});
  let preflightWriterCalls=0;
  const session=createEvaluationPreTransactionEscrowOptIn({
    pairGate:pair(),escrow:store,fingerprint:hash,
    writer:{execute:async()=>{
      preflightWriterCalls++;
      throw Error('ESCROW_PREFLIGHT_MUST_NOT_INVOKE_WRITER');
    }}
  });
  const before=await inspect();
  const attempt=input('SYNTHETIC_A','eval_preflight_'+mutation,before);
  await session.capture(attempt);
  const escrowConnection=await openDb('g265-evaluation-escrow-disposable-'+name,1);
  await new Promise((resolve,reject)=>{
    const tx=escrowConnection.transaction('escrow','readwrite');
    const objects=tx.objectStore('escrow');
    if(mutation==='replace')
      objects.put({generation:0,sha256:seedHash,requestDigest:null,
        bytes:seed.slice().buffer},'pretransaction');
    else objects.delete('pretransaction');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  escrowConnection.close();
  await assert.rejects(session.execute(attempt),e=>e.code===(mutation==='replace'
    ?'G265_ESCROW_EXECUTE_SNAPSHOT_CHANGED':'G265_ESCROW_MISSING_OR_INVALID'));
  assert.equal(preflightWriterCalls,0);
  assert.equal(session.status().status,'UNVERIFIED_RELOAD_REQUIRED');
  await assert.rejects(session.execute(attempt),e=>e.code==='G265_ESCROW_NOT_ARMED');
  if(mutation==='replace'){
    const recovery=await make(name).inspectRecovery();
    assert.equal(recovery.classification,'DURABLE_CHANGED_HOLD');
    assert.equal(recovery.restoreAuthorized,false);
  }else{
    await assert.rejects(make(name).inspectRecovery(),
      e=>e.code==='G265_ESCROW_MISSING_OR_INVALID');
  }
  await assert.rejects(session.restore(),
    e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
  assert.deepEqual(await inspect(),before);
}
assert.deepEqual(await inspect(),preflightBefore);
console.log('PASS G265_ESCROW_EXECUTE_REPLACED_OR_MISSING_SNAPSHOT_NO_WRITER_NO_ACK');

// An acknowledged second writer can advance the durable pair after capture,
// before the opt-in writer starts. Execute preflight must reject the stale
// baseline without invoking a second writer or undoing the acknowledged row.
const executeDurableBefore=await inspect();
const executeDurableStore=createDisposableEvaluationEscrowStore({
  indexedDB,name:'g265-evaluation-escrow-disposable-execute-durable-race'});
let executeDurableReads=0,executeDurableCompetingAcks=0,executeDurableWriterCalls=0;
const executeDurableSession=createEvaluationPreTransactionEscrowOptIn({
  fingerprint:hash,
  pairGate:{readVerified:async()=>{
    executeDurableReads++;
    if(executeDurableReads===3){
      // SYNTHETIC_BLOCKED already has the earlier post-capture evaluation;
      // a valid competing ACK must name that current evaluation revision.
      const competing=await makeWriter().execute({
        ...input('SYNTHETIC_BLOCKED','eval_execute_durable_race',executeDurableBefore),
        expectedCurrentEvaluationId:'eval_postcapture_race'
      });
      assert.equal(competing.status,'PERSISTED');
      executeDurableCompetingAcks++;
    }
    return pair().readVerified();
  }},
  escrow:executeDurableStore,
  writer:{execute:async()=>{
    executeDurableWriterCalls++;
    throw Error('STALE_EXECUTE_WRITER_MUST_NOT_RUN');
  }}
});
const executeDurableAttempt=input('SYNTHETIC_A',
  'eval_execute_stale_writer',executeDurableBefore);
await executeDurableSession.capture(executeDurableAttempt);
await assert.rejects(executeDurableSession.execute(executeDurableAttempt),
  e=>e.code==='G265_ESCROW_EXECUTE_DURABLE_CHANGED');
assert.equal(executeDurableReads,3);
assert.equal(executeDurableCompetingAcks,1);
assert.equal(executeDurableWriterCalls,0);
assert.equal(executeDurableSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(executeDurableSession.execute(executeDurableAttempt),
  e=>e.code==='G265_ESCROW_NOT_ARMED');
const executeDurableAfter=await inspect();
assert.equal(executeDurableAfter.generation,executeDurableBefore.generation+1);
assert.deepEqual(executeDurableAfter.rows,
  [...executeDurableBefore.rows,'eval_execute_durable_race'].sort());
assert.deepEqual(executeDurableAfter.master,executeDurableBefore.master);
const executeDurableRecovery=await make('execute-durable-race').inspectRecovery();
assert.equal(executeDurableRecovery.classification,'DURABLE_CHANGED_HOLD');
assert.equal(executeDurableRecovery.restoreAuthorized,false);
await assert.rejects(executeDurableSession.restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),executeDurableAfter);
console.log('PASS G265_ESCROW_EXECUTE_NEWER_DURABLE_ACK_REJECTS_STALE_ZERO_WRITER');

// A failed execute-time durable read, or failed escrow preflight read, must
// stick to unverified without a writer call, false ACK, replay or restore.
for(const failKind of ['durable','escrow']){
  const name='execute-read-failure-'+failKind;
  const stored=createDisposableEvaluationEscrowStore({
    indexedDB,name:'g265-evaluation-escrow-disposable-'+name});
  let durableReads=0,escrowReads=0,writerCalls=0;
  const before=await inspect();
  const session=createEvaluationPreTransactionEscrowOptIn({
    fingerprint:hash,
    pairGate:{readVerified:async()=>{
      if(++durableReads===3&&failKind==='durable')
        throw Object.assign(Error('SYNTHETIC_EXECUTE_DURABLE_READ_FAILED'),
          {code:'SYNTHETIC_EXECUTE_DURABLE_READ_FAILED'});
      return pair().readVerified();
    }},
    escrow:{write:record=>stored.write(record),read:async()=>{
      if(++escrowReads===2&&failKind==='escrow')
        throw Object.assign(Error('SYNTHETIC_EXECUTE_ESCROW_READ_FAILED'),
          {code:'SYNTHETIC_EXECUTE_ESCROW_READ_FAILED'});
      return stored.read();
    }},
    writer:{execute:async()=>{writerCalls++;throw Error('READ_FAILED_WRITER_MUST_NOT_RUN');}}
  });
  const attempt=input('SYNTHETIC_A','eval_execute_failed_'+failKind,before);
  await session.capture(attempt);
  await assert.rejects(session.execute(attempt),e=>e.code===
    (failKind==='durable'?'SYNTHETIC_EXECUTE_DURABLE_READ_FAILED':
      'SYNTHETIC_EXECUTE_ESCROW_READ_FAILED'));
  assert.equal(writerCalls,0);
  assert.equal(session.status().status,'UNVERIFIED_RELOAD_REQUIRED');
  await assert.rejects(session.execute(attempt),e=>e.code==='G265_ESCROW_NOT_ARMED');
  const recovery=await make(name).inspectRecovery();
  assert.equal(recovery.classification,'NO_DURABLE_DELTA');
  assert.equal(recovery.restoreAuthorized,false);
  await assert.rejects(session.restore(),
    e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
  assert.deepEqual(await inspect(),before);
}
console.log('PASS G265_ESCROW_EXECUTE_PREFLIGHT_READ_FAILURES_STICKY_ZERO_WRITES');

// A request with the wrong revision must consume the armed session, not permit
// a later corrected request to reuse an escrow captured for another attempt.
// This is an isolated negative: no SQL.js writer or durable revision may change.
const mismatchBefore=await inspect();
const mismatchName='execute-revision-mismatch-sticky';
let mismatchWriterCalls=0;
const mismatchSession=make(mismatchName,{execute:async()=>{
  mismatchWriterCalls++;
  throw Error('MISMATCHED_REVISION_MUST_NOT_INVOKE_WRITER');
}});
const mismatchAttempt=input('SYNTHETIC_A','eval_mismatched_revision',mismatchBefore);
await mismatchSession.capture(mismatchAttempt);
await assert.rejects(mismatchSession.execute({
  ...mismatchAttempt,expectedGeneration:mismatchBefore.generation+1
}),e=>e.code==='G265_ESCROW_WRITE_REVISION_MISMATCH');
assert.equal(mismatchSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(mismatchSession.execute(mismatchAttempt),
  e=>e.code==='G265_ESCROW_NOT_ARMED');
assert.equal(mismatchWriterCalls,0);
const mismatchRecovery=await make(mismatchName).inspectRecovery();
assert.equal(mismatchRecovery.classification,'NO_DURABLE_DELTA');
assert.equal(mismatchRecovery.restoreAuthorized,false);
await assert.rejects(mismatchSession.restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
assert.deepEqual(await inspect(),mismatchBefore);
console.log('PASS G265_ESCROW_EXECUTE_REVISION_MISMATCH_STICKY_NO_RETRY_ZERO_WRITES');

// Same Generation/SHA must not authorize a different transaction payload.
// Each mismatch consumes the one-use session, never invokes the writer, and
// cannot alter the synthetic durable pair or permit a crash restore.
const identityBefore=await inspect();
const identityAttempt=input('SYNTHETIC_A','eval_identity_bound',identityBefore);
const mutations=[
  ['pokemon-id',v=>({...v,pokemonId:'SYNTHETIC_B'})],
  ['evaluation-id',v=>({...v,evaluationId:'eval_identity_swapped'})],
  ['input-fingerprint',v=>({...v,inputFingerprint:'synthetic:swapped'})],
  ['current-evaluation',v=>({...v,expectedCurrentEvaluationId:'eval_A'})],
  ['nested-scores',v=>({...v,scores:{...v.scores,roi:999}})],
  ['evaluated-at',v=>({...v,evaluatedAt:'2026-11-01T00:00:00.000Z'})],
  ['extra-field',v=>({...v,goalProfileId:'synthetic-other-goal'})]
];
for(const [tag,mutate] of mutations){
  let calls=0;
  const name='request-identity-'+tag;
  const session=make(name,{execute:async()=>{calls++;throw Error('WRITER_MUST_NOT_RUN');}});
  await session.capture(identityAttempt);
  await assert.rejects(session.execute(mutate(identityAttempt)),
    e=>e.code==='G265_ESCROW_EXECUTE_REQUEST_MISMATCH');
  assert.equal(session.status().status,'UNVERIFIED_RELOAD_REQUIRED');
  await assert.rejects(session.execute(identityAttempt),e=>e.code==='G265_ESCROW_NOT_ARMED');
  assert.equal(calls,0);
  const recovery=await make(name).inspectRecovery();
  assert.equal(recovery.classification,'NO_DURABLE_DELTA');
  assert.equal(recovery.restoreAuthorized,false);
  await assert.rejects(session.restore(),
    e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
  assert.deepEqual(await inspect(),identityBefore);
}
console.log('PASS G265_ESCROW_FULL_REQUEST_IDENTITY_SWAP_STICKY_ZERO_WRITES');

// Revision-only crash snapshots have no bound transaction identity; even a
// correctly versioned full request cannot turn them into writer authorization.
let unboundCalls=0;
const unboundName='request-identity-unbound';
const unboundSession=make(unboundName,{execute:async()=>{unboundCalls++;}});
await unboundSession.capture({expectedGeneration:identityBefore.generation,
  expectedFingerprint:identityBefore.sha256});
await assert.rejects(unboundSession.execute(identityAttempt),
  e=>e.code==='G265_ESCROW_EXECUTE_REQUEST_UNBOUND');
assert.equal(unboundSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(unboundCalls,0);
assert.deepEqual(await inspect(),identityBefore);
console.log('PASS G265_ESCROW_REVISION_ONLY_CAPTURE_CANNOT_EXECUTE');

// The writer receives a detached canonical copy, not a mutable caller object.
// A caller changing nested scores during awaited escrow/durable preflight
// cannot redirect the transaction after the identity comparison.
const detachedBefore=await inspect();
let receivedRequest=null,detachedCalls=0;
const detachedSession=make('request-identity-detached',{
  execute:async request=>{
    detachedCalls++;receivedRequest=request;
    throw Object.assign(new Error('SYNTHETIC_DETACHED_REJECTION'),
      {code:'SYNTHETIC_DETACHED_REJECTION'});
  }
});
const detachedAttempt=input('SYNTHETIC_A','eval_detached',detachedBefore);
await detachedSession.capture(detachedAttempt);
const detachedPending=detachedSession.execute(detachedAttempt);
detachedAttempt.evaluationId='eval_mutated_after_execute';
detachedAttempt.scores.roi=999;
await assert.rejects(detachedPending,e=>e.code==='SYNTHETIC_DETACHED_REJECTION');
assert.equal(detachedCalls,1);
assert.equal(receivedRequest.evaluationId,'eval_detached');
assert.equal(receivedRequest.scores.roi,5);
assert.equal(detachedSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(await inspect(),detachedBefore);
console.log('PASS G265_ESCROW_WRITER_RECEIVES_DETACHED_BOUND_REQUEST');

// A persisted escrow must bind its full canonical request by digest only.
// A second IndexedDB actor replacing just that digest with the same valid
// SQLite Generation/SHA/bytes cannot authorize a different transaction.
const digestBefore=await inspect();
const digestAttempt=input('SYNTHETIC_A','eval_digest_bound',digestBefore);
const digestName='request-digest-substitution';
const digestStore=createDisposableEvaluationEscrowStore({
  indexedDB,name:'g265-evaluation-escrow-disposable-'+digestName});
let digestWriterCalls=0;
const digestSession=createEvaluationPreTransactionEscrowOptIn({
  pairGate:pair(),escrow:digestStore,fingerprint:hash,
  writer:{execute:async()=>{digestWriterCalls++;throw Error('DIGEST_WRITER_MUST_NOT_RUN');}}
});
await digestSession.capture(digestAttempt);
const digestSaved=await digestStore.read();
assert.match(digestSaved.requestDigest,/^[0-9a-f]{64}$/);
assert.equal(Object.hasOwn(digestSaved,'pokemonId'),false);
assert.equal(Object.hasOwn(digestSaved,'evaluationId'),false);
assert.equal(Object.hasOwn(digestSaved,'scores'),false);
const forgedRequestDigest='0'.repeat(64);
assert.notEqual(digestSaved.requestDigest,forgedRequestDigest);
const digestDb=await openDb('g265-evaluation-escrow-disposable-'+digestName,1);
await new Promise((resolve,reject)=>{
  const tx=digestDb.transaction('escrow','readwrite');
  tx.objectStore('escrow').put({...digestSaved,requestDigest:forgedRequestDigest},
    'pretransaction');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
digestDb.close();
await assert.rejects(digestSession.execute(digestAttempt),
  e=>e.code==='G265_ESCROW_EXECUTE_REQUEST_DIGEST_CHANGED');
assert.equal(digestSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(digestSession.execute(digestAttempt),
  e=>e.code==='G265_ESCROW_NOT_ARMED');
assert.equal(digestWriterCalls,0);
assert.deepEqual(await inspect(),digestBefore);
// A fresh reader has no trusted copy of the original request: stable bytes
// may classify NO_DURABLE_DELTA, but never authorize replay or restore.
const digestRecovery=await make(digestName).inspectRecovery();
assert.equal(digestRecovery.classification,'NO_DURABLE_DELTA');
assert.equal(digestRecovery.restoreAuthorized,false);
await assert.rejects(digestSession.restore(),
  e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
console.log('PASS G265_ESCROW_PERSISTED_REQUEST_DIGEST_SUBSTITUTION_STICKY_ZERO_WRITES');

// A digest-valid but different record returned immediately after escrow write
// must fail before arming the session. A digest change between two independent
// recovery observations also cannot be called a stable no-delta snapshot.
const digestReadbackStore=createDisposableEvaluationEscrowStore({
  indexedDB,name:'g265-evaluation-escrow-disposable-request-digest-readback'});
let digestReadbackWriterCalls=0;
const digestReadbackSession=createEvaluationPreTransactionEscrowOptIn({
  pairGate:pair(),fingerprint:hash,
  escrow:{write:record=>digestReadbackStore.write(record),
    read:async()=>({...await digestReadbackStore.read(),requestDigest:forgedRequestDigest})},
  writer:{execute:async()=>{digestReadbackWriterCalls++;}}
});
await assert.rejects(digestReadbackSession.capture(input(
  'SYNTHETIC_A','eval_digest_readback',digestBefore)),
  e=>e.code==='G265_ESCROW_READBACK_MISMATCH');
assert.equal(digestReadbackSession.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(digestReadbackWriterCalls,0);
const digestRecoveryStore=createDisposableEvaluationEscrowStore({
  indexedDB,name:'g265-evaluation-escrow-disposable-request-digest-recovery'});
await make('request-digest-recovery').capture(digestAttempt);
let digestRecoveryReads=0;
const digestRecoveryObserver=createEvaluationPreTransactionEscrowOptIn({
  pairGate:pair(),fingerprint:hash,
  escrow:{write:async()=>{throw Error('RECOVERY_MUST_NOT_WRITE');},
    read:async()=>{
      digestRecoveryReads++;
      const record=await digestRecoveryStore.read();
      return digestRecoveryReads===1?record:
        {...record,requestDigest:forgedRequestDigest};
    }},
  writer:{execute:async()=>{throw Error('RECOVERY_MUST_NOT_WRITE');}}
});
const digestChangedRecovery=await digestRecoveryObserver.inspectRecovery();
assert.equal(digestRecoveryReads,2);
assert.equal(digestChangedRecovery.snapshotStable,false);
assert.equal(digestChangedRecovery.classification,'DURABLE_CHANGED_HOLD');
assert.equal(digestChangedRecovery.restoreAuthorized,false);
assert.deepEqual(await inspect(),digestBefore);
console.log('PASS G265_ESCROW_REQUEST_DIGEST_READBACK_AND_RECOVERY_MUTATION_HOLD');

// Canonical JSON identity must not omit hidden or symbol-owned fields.
 // A different request with invisible metadata could otherwise share the
 // same digest; reject before writing escrow and reject execute irreversibly.
const noncanonicalBefore=await inspect();
const noncanonicalBase=input('SYNTHETIC_A','eval_noncanonical',noncanonicalBefore);
const hidden=(object,key,value)=>Object.defineProperty({...object},key,{value});
const noncanonicalMutations=[
  ['hidden-root',v=>hidden(v,'hiddenNonce','secret')],
  ['symbol-root',v=>({...v,[Symbol('secret')]:1})],
  ['hidden-nested',v=>({...v,scores:hidden(v.scores,'hiddenScore',999)})],
  ['symbol-nested',v=>({...v,scores:{...v.scores,[Symbol('secret')]:999}})]
];
for(const [tag,mutate] of noncanonicalMutations){
  const name='noncanonical-capture-'+tag;
  let calls=0;
  const session=make(name,{execute:async()=>{calls++;}});
  await assert.rejects(session.capture(mutate(noncanonicalBase)),
    e=>e.code==='G265_ESCROW_INVALID_BOUND_REQUEST');
  assert.equal(session.status().status,'READY');
  assert.equal(calls,0);
  await assert.rejects(make(name).inspectRecovery(),
    e=>e.code==='G265_ESCROW_MISSING_OR_INVALID');
  assert.deepEqual(await inspect(),noncanonicalBefore);
}
const invalidRevisionOnly=make('revision-only-extra-field');
await assert.rejects(invalidRevisionOnly.capture({
  expectedGeneration:noncanonicalBefore.generation,
  expectedFingerprint:noncanonicalBefore.sha256,unexpectedPayload:'ignored-before'
}),e=>e.code==='G265_ESCROW_INVALID_BOUND_REQUEST');
assert.equal(invalidRevisionOnly.status().status,'READY');
await assert.rejects(make('revision-only-extra-field').inspectRecovery(),
  e=>e.code==='G265_ESCROW_MISSING_OR_INVALID');
console.log('PASS G265_ESCROW_NONCANONICAL_CAPTURE_FIELDS_NO_ESCROW_NO_WRITER');

let hiddenExecuteCalls=0;
const hiddenExecuteName='noncanonical-execute-hidden-nested';
const hiddenExecute=make(hiddenExecuteName,{execute:async()=>{hiddenExecuteCalls++;}});
await hiddenExecute.capture(noncanonicalBase);
await assert.rejects(hiddenExecute.execute({
  ...noncanonicalBase,scores:hidden(noncanonicalBase.scores,'hiddenScore',888)
}),e=>e.code==='G265_ESCROW_INVALID_BOUND_REQUEST');
assert.equal(hiddenExecute.status().status,'UNVERIFIED_RELOAD_REQUIRED');
await assert.rejects(hiddenExecute.execute(noncanonicalBase),
  e=>e.code==='G265_ESCROW_NOT_ARMED');
assert.equal(hiddenExecuteCalls,0);
assert.equal((await make(hiddenExecuteName).inspectRecovery()).restoreAuthorized,false);
assert.deepEqual(await inspect(),noncanonicalBefore);
console.log('PASS G265_ESCROW_NONCANONICAL_EXECUTE_STICKY_ZERO_WRITES');

// Malformed persisted request digests must never be treated as executable
// authority, even with an otherwise valid SQLite generation/SHA/byte snapshot.
for(const [tag,alter] of [
  ['missing',record=>{const {requestDigest,...rest}=record;return rest;}],
  ['null',record=>({...record,requestDigest:null})],
  ['uppercase',record=>({...record,requestDigest:record.requestDigest.toUpperCase()})]
]){
  const name='malformed-request-digest-'+tag;
  const store=createDisposableEvaluationEscrowStore({
    indexedDB,name:'g265-evaluation-escrow-disposable-'+name});
  let calls=0;
  const session=createEvaluationPreTransactionEscrowOptIn({
    pairGate:pair(),escrow:store,fingerprint:hash,
    writer:{execute:async()=>{calls++;}}
  });
  await session.capture(noncanonicalBase);
  const saved=await store.read();
  const idb=await openDb('g265-evaluation-escrow-disposable-'+name,1);
  await new Promise((resolve,reject)=>{
    const tx=idb.transaction('escrow','readwrite');
    tx.objectStore('escrow').put(alter(saved),'pretransaction');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  idb.close();
  await assert.rejects(session.execute(noncanonicalBase),
    e=>tag==='null'?e.code==='G265_ESCROW_EXECUTE_REQUEST_DIGEST_CHANGED':
      e.code==='G265_ESCROW_MISSING_OR_INVALID');
  assert.equal(session.status().status,'UNVERIFIED_RELOAD_REQUIRED');
  await assert.rejects(session.execute(noncanonicalBase),
    e=>e.code==='G265_ESCROW_NOT_ARMED');
  assert.equal(calls,0);
  assert.deepEqual(await inspect(),noncanonicalBefore);
  await assert.rejects(session.restore(),
    e=>e.code==='G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
}
console.log('PASS G265_ESCROW_MALFORMED_PERSISTED_REQUEST_DIGEST_NO_WRITER_NO_ACK');

// Normal verified PERSISTED success remains covered by the earlier
// G265_ESCROW_INDEPENDENT_PREWRITE_DURABLE_READBACK_ACK_NO_AUTO_RESTORE gate.
db.close();
console.log('PASS G265_ESCROW_MISSING_SNAPSHOT_RESTORE_REFUSED');
console.log('HOLD G265_ESCROW_NOT_PRODUCTION_CRASH_RESTORE_ALL_WRITERS_OWNER_ANDROID');
