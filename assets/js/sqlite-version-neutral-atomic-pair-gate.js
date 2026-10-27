// G265 opt-in version-neutral atomic pair. NOT wired to player storage.
// Requires existing database+metadata stores and pre-existing revision.
// Never upgrades IndexedDB, bootstraps revision, or changes legacy writers.
import {sha256SqliteBytes} from './sqlite-cross-tab-write-admission.js';

const failure=(code,cause)=>Object.assign(new Error(code),{code,cause});
const validHash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const copyBytes=value=>{
  if(value instanceof Uint8Array)return new Uint8Array(value);
  if(value instanceof ArrayBuffer)return new Uint8Array(value.slice(0));
  throw failure('G265_PAIR_INVALID_BYTES');
};
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const validRevision=r=>r&&Number.isSafeInteger(r.generation)&&r.generation>=0&&validHash(r.sha256);

export function createSqliteVersionNeutralAtomicPairGate({
  db,locks=globalThis.navigator?.locks,fingerprint=sha256SqliteBytes,
  timeoutMs=30000,lockName='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'
}={}){
  if(!db||typeof db.transaction!=='function'||!db.objectStoreNames?.contains('database')
    ||!db.objectStoreNames?.contains('metadata')||typeof fingerprint!=='function'
    ||!Number.isFinite(timeoutMs)||timeoutMs<=0||typeof lockName!=='string'||!lockName.trim())
    throw new TypeError('G265_PAIR_INVALID_CONFIG');
  let sticky=false,active=false;
  const readPair=()=>new Promise((resolve,reject)=>{
    let tx,rawRequest,revisionRequest;
    try{
      tx=db.transaction(['database','metadata'],'readonly');
      rawRequest=tx.objectStore('database').get('primary');
      revisionRequest=tx.objectStore('metadata').get('revision:primary');
    }catch(error){reject(failure('G265_PAIR_READ_FAILED',error));return;}
    tx.oncomplete=()=>resolve({raw:rawRequest.result,revision:revisionRequest.result});
    tx.onerror=()=>reject(failure('G265_PAIR_READ_FAILED',tx.error));
    tx.onabort=()=>reject(failure('G265_PAIR_READ_ABORTED',tx.error));
  });
  const readVerified=async()=>{
    if(sticky)throw failure('G265_PAIR_UNVERIFIED_RELOAD_REQUIRED');
    try{
      const {raw,revision}=await readPair();
      if(!(raw instanceof ArrayBuffer)||!validRevision(revision))
        throw failure('G265_PAIR_MISSING_OR_INVALID');
      const bytes=copyBytes(raw),digest=await fingerprint(bytes);
      if(!validHash(digest)||digest!==revision.sha256)
        throw failure('G265_PAIR_DIGEST_MISMATCH');
      if(sticky)throw failure('G265_PAIR_UNVERIFIED_RELOAD_REQUIRED');
      return Object.freeze({generation:revision.generation,sha256:digest,bytes});
    }catch(error){sticky=true;throw error;}
  };
  // IDB readwrite transaction is synchronous from request callbacks.
  // No await occurs between reading the CAS pair and writing all three keys.
  const commitPair=({before,next,nextHash})=>new Promise((resolve,reject)=>{
    let tx,rawRequest,revisionRequest,rawReady=false,revisionReady=false;
    let code=null,settled=false,staged=false;
    const rejectOnce=error=>{if(!settled){settled=true;reject(error);}};
    const abort=reason=>{code=reason;try{tx.abort();}catch{};};
    const stage=()=>{
      if(!rawReady||!revisionReady||staged||code)return;
      staged=true;
      try{
        const raw=rawRequest.result,revision=revisionRequest.result;
        if(sticky)throw failure('G265_PAIR_UNVERIFIED_RELOAD_REQUIRED');
        if(!(raw instanceof ArrayBuffer)||!validRevision(revision)
          ||revision.generation!==before.generation||revision.sha256!==before.sha256
          ||!equal(new Uint8Array(raw),before.bytes))
          throw failure('G265_PAIR_STALE_CAS');
        if(revision.generation===Number.MAX_SAFE_INTEGER)
          throw failure('G265_PAIR_GENERATION_EXHAUSTED');
        tx.objectStore('database').put(next.slice().buffer,'primary');
        const meta=tx.objectStore('metadata');
        meta.put({generation:revision.generation+1,sha256:nextHash},'revision:primary');
        meta.put({byte_length:next.byteLength,updated_at:new Date().toISOString(),
          format:'sqlite-arraybuffer',safe_boot_version:2},'primary');
      }catch(error){abort(error.code||'G265_PAIR_TRANSACTION_STAGE_FAILED');}
    };
    try{
      tx=db.transaction(['database','metadata'],'readwrite');
      rawRequest=tx.objectStore('database').get('primary');
      revisionRequest=tx.objectStore('metadata').get('revision:primary');
      rawRequest.onsuccess=()=>{rawReady=true;stage();};
      revisionRequest.onsuccess=()=>{revisionReady=true;stage();};
      rawRequest.onerror=()=>abort('G265_PAIR_CAS_READ_FAILED');
      revisionRequest.onerror=()=>abort('G265_PAIR_CAS_READ_FAILED');
      tx.oncomplete=()=>{if(!settled){settled=true;resolve();}};
      tx.onerror=()=>rejectOnce(failure(code||'G265_PAIR_TRANSACTION_FAILED',tx.error));
      tx.onabort=()=>rejectOnce(failure(code||'G265_PAIR_TRANSACTION_ABORTED',tx.error));
    }catch(error){rejectOnce(failure('G265_PAIR_TRANSACTION_FAILED',error));}
  });
  const write=async({reason,expectedGeneration,expectedFingerprint,nextBytes,buildNextBytes}={})=>{
    if(sticky)throw failure('G265_PAIR_UNVERIFIED_RELOAD_REQUIRED');
    if(active)throw failure('G265_PAIR_SESSION_ALREADY_ACTIVE');
    if(typeof reason!=='string'||!reason.trim()||!Number.isSafeInteger(expectedGeneration)
      ||expectedGeneration<0||!validHash(expectedFingerprint))
      throw failure('G265_PAIR_INVALID_WRITE_REQUEST');
    if(typeof locks?.request!=='function'){
      sticky=true;throw failure('G265_PAIR_WEB_LOCKS_UNAVAILABLE');
    }
    // Opt-in only: the builder must run synchronously INSIDE the acquired lock,
    // after comparing the latest durable pair. Existing nextBytes callers remain unchanged.
    const fromDurable=typeof buildNextBytes==='function';
    if(fromDurable===(nextBytes!==undefined))
      throw failure('G265_PAIR_INVALID_WRITE_REQUEST');
    if(fromDurable&&buildNextBytes.constructor?.name==='AsyncFunction')
      throw failure('G265_PAIR_ASYNC_BUILDER_FORBIDDEN');
    let next;
    try{if(!fromDurable)next=copyBytes(nextBytes);}catch(error){sticky=true;throw error;}
    active=true;
    const controller=new AbortController();
    let acquired=false,settled=false,timer;
    const operation=Promise.resolve().then(()=>locks.request(lockName,
      {mode:'exclusive',signal:controller.signal},async lock=>{
        if(!lock||sticky)throw failure('G265_PAIR_LOCK_NOT_ACQUIRED');
        acquired=true;
        const before=await readVerified();
        if(before.generation!==expectedGeneration||before.sha256!==expectedFingerprint)
          throw failure('G265_PAIR_STALE_RELOAD_REQUIRED');
        if(fromDurable){
          // Pass a defensive copy: a failed builder must not corrupt the verified CAS baseline.
          const built=buildNextBytes(Object.freeze({
            generation:before.generation,sha256:before.sha256,bytes:copyBytes(before.bytes)
          }));
          if(built!==null&&(typeof built==='object'||typeof built==='function')
            &&typeof built.then==='function')throw failure('G265_PAIR_ASYNC_BUILDER_FORBIDDEN');
          next=copyBytes(built);
        }
        const nextHash=await fingerprint(next);
        if(!validHash(nextHash)||sticky)throw failure('G265_PAIR_INVALID_NEXT_DIGEST');
        await commitPair({before,next,nextHash});
        if(sticky)throw failure('G265_PAIR_UNVERIFIED_RELOAD_REQUIRED');
        const after=await readVerified();
        if(after.generation!==before.generation+1||after.sha256!==nextHash
          ||!equal(after.bytes,next))throw failure('G265_PAIR_POST_WRITE_MISMATCH');
        return Object.freeze({status:'PERSISTED',generation:after.generation,sha256:after.sha256});
      }));
    operation.catch(()=>{});
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        if(settled)return;
        sticky=true;
        try{controller.abort();}catch{}
        reject(failure(acquired?'G265_PAIR_HELD_LOCK_TIMEOUT_UNCERTAIN':
          'G265_PAIR_LOCK_WAIT_TIMEOUT_UNCERTAIN'));
      },timeoutMs);
    });
    try{
      const result=await Promise.race([operation,timeout]);
      settled=true;
      if(!acquired)throw failure('G265_PAIR_LOCK_CALLBACK_NOT_RUN');
      return result;
    }catch(error){sticky=true;throw error;}
    finally{settled=true;clearTimeout(timer);active=false;}
  };
  return Object.freeze({readVerified,write,status:()=>Object.freeze({
    status:sticky?'UNVERIFIED_RELOAD_REQUIRED':active?'IN_FLIGHT':'READY'
  })});
}
