// G265 thirteenth evaluation snapshot: isolated crash-readable pre-transaction escrow.
// NOT imported by the PWA. This does not restore production/player bytes.
// Existing legacy writers bypass admission: restoration MUST remain fail-closed.
import {sha256SqliteBytes} from './sqlite-cross-tab-write-admission.js';

const fail=code=>Object.assign(new Error(code),{code});
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const generation=value=>Number.isSafeInteger(value)&&value>=0;
const bytes=value=>value instanceof Uint8Array?new Uint8Array(value):
  value instanceof ArrayBuffer?new Uint8Array(value.slice(0)):null;
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

// A dedicated disposable database, not the application's database or metadata stores.
// "add" (not "put") makes an unresolved escrow impossible to overwrite silently.
export function createDisposableEvaluationEscrowStore({indexedDB,name}={}){
  if(!indexedDB||typeof indexedDB.open!=='function'
    ||typeof name!=='string'||!/^g265-evaluation-escrow-disposable-[A-Za-z0-9_-]+$/.test(name))
    throw new TypeError('G265_ESCROW_DISPOSABLE_STORE_REQUIRED');
  const open=()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open(name,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('escrow');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(fail('G265_ESCROW_OPEN_FAILED'));
    request.onblocked=()=>reject(fail('G265_ESCROW_OPEN_BLOCKED'));
  });
  const write=async record=>{
    const db=await open();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('escrow','readwrite');
        tx.objectStore('escrow').add(record,'pretransaction');
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(fail('G265_ESCROW_WRITE_FAILED'));
        tx.onabort=()=>reject(fail('G265_ESCROW_WRITE_ABORTED'));
      });
    }finally{db.close();}
  };
  const read=async()=>{
    const db=await open();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction('escrow','readonly');
        const request=tx.objectStore('escrow').get('pretransaction');
        tx.oncomplete=()=>resolve(request.result??null);
        tx.onerror=()=>reject(fail('G265_ESCROW_READ_FAILED'));
        tx.onabort=()=>reject(fail('G265_ESCROW_READ_ABORTED'));
      });
    }finally{db.close();}
  };
  return Object.freeze({write,read});
}

export function createEvaluationPreTransactionEscrowOptIn({
  pairGate,escrow,writer,fingerprint=sha256SqliteBytes
}={}){
  if(typeof pairGate?.readVerified!=='function'||typeof escrow?.write!=='function'
    ||typeof escrow?.read!=='function'||typeof writer?.execute!=='function'
    ||typeof fingerprint!=='function')
    throw new TypeError('G265_ESCROW_INVALID_ADAPTER');
  let state='READY',baseline=null;
  const verifiedRecord=async record=>{
    if(!record||!generation(record.generation)||!digest(record.sha256))
      throw fail('G265_ESCROW_MISSING_OR_INVALID');
    const copy=bytes(record.bytes);
    if(!copy||copy.byteLength===0||await fingerprint(copy)!==record.sha256)
      throw fail('G265_ESCROW_DIGEST_MISMATCH');
    return {generation:record.generation,sha256:record.sha256,bytes:copy};
  };
  async function capture({expectedGeneration,expectedFingerprint}={}){
    if(state!=='READY')throw fail('G265_ESCROW_SESSION_NOT_READY');
    if(!generation(expectedGeneration)||!digest(expectedFingerprint))
      throw fail('G265_ESCROW_INVALID_EXPECTED_REVISION');
    // Reserve the session before the first await: two simultaneous captures
    // must never race to persist the same immutable escrow or poison an armed session.
    state='CAPTURING';
    try{
      const current=await verifiedRecord(await pairGate.readVerified());
      if(current.generation!==expectedGeneration||current.sha256!==expectedFingerprint)
        throw fail('G265_ESCROW_STALE_CAPTURE');
      await escrow.write({generation:current.generation,sha256:current.sha256,
        bytes:current.bytes.slice().buffer});
      const persisted=await verifiedRecord(await escrow.read());
      if(persisted.generation!==current.generation||persisted.sha256!==current.sha256
        ||!equal(persisted.bytes,current.bytes))
        throw fail('G265_ESCROW_READBACK_MISMATCH');
      // Escrow persistence is asynchronous: a separate acknowledged writer may
      // advance the durable pair while the immutable snapshot is being saved.
      // Revalidate before arming; the downstream CAS still protects later races.
      const latest=await verifiedRecord(await pairGate.readVerified());
      if(latest.generation!==current.generation||latest.sha256!==current.sha256
        ||!equal(latest.bytes,current.bytes))
        throw fail('G265_ESCROW_POST_CAPTURE_DURABLE_CHANGED');
      baseline={generation:current.generation,sha256:current.sha256};
      state='ARMED';
      return Object.freeze({...baseline,status:'ESCROW_VERIFIED'});
    }catch(error){state='UNVERIFIED_RELOAD_REQUIRED';throw error;}
  }
  async function execute(input){
    if(state!=='ARMED')throw fail('G265_ESCROW_NOT_ARMED');
    if(!input||input.expectedGeneration!==baseline.generation
      ||input.expectedFingerprint!==baseline.sha256)
      throw fail('G265_ESCROW_WRITE_REVISION_MISMATCH');
    state='IN_FLIGHT';
    try{
      // The immutable pre-transaction escrow is a required safety prerequisite.
      // Another IndexedDB actor may remove/replace it after capture but before
      // execution; fail closed before invoking any writer (advisory, not an
      // atomic guarantee against later mutation by unadmitted legacy writers).
      const armedSnapshot=await verifiedRecord(await escrow.read());
      if(armedSnapshot.generation!==baseline.generation
        ||armedSnapshot.sha256!==baseline.sha256)
        throw fail('G265_ESCROW_EXECUTE_SNAPSHOT_CHANGED');
      const outcome=await writer.execute(input);
      // A resolved Promise (even a claimed PERSISTED result) is not a durable
      // ACK. Require a well-formed successor revision and independently verify
      // the actual persisted pair before acknowledging this escrow session.
      if(!outcome||outcome.status!=='PERSISTED'
        ||!generation(outcome.generation)||!digest(outcome.sha256)
        ||outcome.generation!==baseline.generation+1
        ||outcome.sha256===baseline.sha256)
        throw fail('G265_ESCROW_WRITER_ACK_NOT_VERIFIED');
      const confirmed=await verifiedRecord(await pairGate.readVerified());
      if(confirmed.generation!==outcome.generation
        ||confirmed.sha256!==outcome.sha256)
        throw fail('G265_ESCROW_POST_ACK_DURABLE_MISMATCH');
      state='ACKED';
      return outcome;
    }catch(error){state='UNVERIFIED_RELOAD_REQUIRED';throw error;}
  }
  async function inspectRecovery(){
    // A fresh session may inspect an escrow after tab close/crash. No writes occur.
    const saved=await verifiedRecord(await escrow.read());
    // Recovery is read-only, not lock-protected. A legitimate writer may ACK
    // between durable observations; never report a stable zero-delta result
    // from a single possibly stale read.
    const first=await verifiedRecord(await pairGate.readVerified());
    const current=await verifiedRecord(await pairGate.readVerified());
    // An external IDB actor can change even a digest-valid snapshot while
    // durable observations are in flight. Re-read before classifying no delta.
    // This is advisory, not an atomic recovery or restore authorization.
    const savedAgain=await verifiedRecord(await escrow.read());
    const snapshotStable=saved.generation===savedAgain.generation
      &&saved.sha256===savedAgain.sha256&&equal(saved.bytes,savedAgain.bytes);
    const observationStable=first.generation===current.generation
      &&first.sha256===current.sha256&&equal(first.bytes,current.bytes);
    const unchanged=current.generation===saved.generation
      &&current.sha256===saved.sha256&&equal(current.bytes,saved.bytes);
    return Object.freeze({
      classification:observationStable&&snapshotStable&&unchanged?'NO_DURABLE_DELTA':'DURABLE_CHANGED_HOLD',
      observationStable,snapshotStable,
      snapshotGeneration:saved.generation,currentGeneration:current.generation,
      snapshotSha256:saved.sha256,currentSha256:current.sha256,
      restoreAuthorized:false
    });
  }
  async function restore(){
    // A Web Lock alone cannot exclude the 23 unadmitted legacy direct writers.
    // No automatic restore or overwrite of a possibly acknowledged newer revision.
    throw fail('G265_ESCROW_RESTORE_BLOCKED_ALL_WRITERS_UNADMITTED');
  }
  return Object.freeze({capture,execute,inspectRecovery,restore,
    status:()=>Object.freeze({status:state})});
}
