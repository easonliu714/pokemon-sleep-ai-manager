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
      const outcome=await writer.execute(input);
      // A resolved Promise is not a durable ACK: only the opt-in writer's
      // independently read-back PERSISTED result may advance this session.
      if(!outcome||outcome.status!=='PERSISTED')
        throw fail('G265_ESCROW_WRITER_ACK_NOT_VERIFIED');
      state='ACKED';
      return outcome;
    }catch(error){state='UNVERIFIED_RELOAD_REQUIRED';throw error;}
  }
  async function inspectRecovery(){
    // A fresh session may inspect an escrow after tab close/crash. No writes occur.
    const saved=await verifiedRecord(await escrow.read());
    const current=await verifiedRecord(await pairGate.readVerified());
    const unchanged=current.generation===saved.generation
      &&current.sha256===saved.sha256&&equal(current.bytes,saved.bytes);
    return Object.freeze({
      classification:unchanged?'NO_DURABLE_DELTA':'DURABLE_CHANGED_HOLD',
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
