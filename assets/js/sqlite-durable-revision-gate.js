// G265 opt-in durable generation/ABA safety contract. NOT wired to player DB.
// Caller supplies an existing dedicated IDB object store. No schema upgrades.
// A single IDB record atomically couples SQLite bytes, SHA-256 and generation.
import {sha256SqliteBytes} from './sqlite-cross-tab-write-admission.js';
const fail=(code,cause)=>Object.assign(new Error(code),{code,cause});
const isHash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const asBytes=v=>{
  if(v instanceof Uint8Array)return new Uint8Array(v);
  if(v instanceof ArrayBuffer)return new Uint8Array(v.slice(0));
  throw fail('G265_REVISION_INVALID_BYTES');
};
const equalBytes=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const validRecord=r=>r&&Number.isSafeInteger(r.generation)&&r.generation>=0&&isHash(r.sha256);

export function createSqliteDurableRevisionGate({
  db,storeName,recordKey='primary',locks=globalThis.navigator?.locks,
  fingerprint=sha256SqliteBytes,timeoutMs=30000,
  lockName='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'
}={}){
  if(!db||typeof db.transaction!=='function'||typeof storeName!=='string'||!storeName.trim()
    ||typeof recordKey!=='string'||!recordKey.trim()||typeof fingerprint!=='function'
    ||!Number.isFinite(timeoutMs)||timeoutMs<=0||typeof lockName!=='string'||!lockName.trim())
    throw new TypeError('G265_REVISION_INVALID_CONFIG');
  let sticky=false,active=false;
  const readRecord=()=>new Promise((resolve,reject)=>{
    let tx,request;
    try{
      tx=db.transaction(storeName,'readonly');
      request=tx.objectStore(storeName).get(recordKey);
    }catch(e){reject(fail('G265_REVISION_READ_FAILED',e));return;}
    let record;
    request.onerror=()=>reject(fail('G265_REVISION_READ_FAILED',request.error));
    request.onsuccess=()=>{record=request.result;};
    tx.oncomplete=()=>resolve(record);
    tx.onabort=()=>reject(fail('G265_REVISION_READ_ABORTED',tx.error));
    tx.onerror=()=>reject(fail('G265_REVISION_READ_FAILED',tx.error));
  });
  const readVerified=async()=>{
    try{
      if(sticky)throw fail('G265_REVISION_UNVERIFIED_RELOAD_REQUIRED');
      const r=await readRecord();
      if(!validRecord(r))throw fail('G265_REVISION_MISSING_OR_INVALID');
      const bytes=asBytes(r.bytes),hash=await fingerprint(bytes);
      if(!isHash(hash)||hash!==r.sha256)throw fail('G265_REVISION_BYTES_DIGEST_MISMATCH');
      if(sticky)throw fail('G265_REVISION_UNVERIFIED_RELOAD_REQUIRED');
      return Object.freeze({generation:r.generation,sha256:r.sha256,bytes});
    }catch(e){sticky=true;throw e;}
  };
  // No await inside the readwrite transaction: re-check revision, hash and
  // exact bytes before a single atomic record replacement.
  const atomicCommit=({before,nextBytes,nextHash})=>new Promise((resolve,reject)=>{
    let tx,req,done=false;
    const rejectOnce=e=>{if(!done){done=true;reject(e);}};
    try{
      tx=db.transaction(storeName,'readwrite');
      const store=tx.objectStore(storeName);
      tx.oncomplete=()=>{if(!done){done=true;resolve();}};
      tx.onerror=()=>rejectOnce(fail('G265_REVISION_TRANSACTION_FAILED',tx.error));
      tx.onabort=()=>rejectOnce(fail('G265_REVISION_TRANSACTION_ABORTED',tx.error));
      req=store.get(recordKey);
      req.onerror=()=>{try{tx.abort();}catch{};rejectOnce(fail('G265_REVISION_CAS_READ_FAILED',req.error));};
      req.onsuccess=()=>{
        try{
          const current=req.result;
          if(sticky)throw fail('G265_REVISION_UNVERIFIED_RELOAD_REQUIRED');
          if(!validRecord(current)||current.generation!==before.generation
            ||current.sha256!==before.sha256||!equalBytes(asBytes(current.bytes),before.bytes))
            throw fail('G265_REVISION_STALE_CAS_RELOAD_REQUIRED');
          if(before.generation>=Number.MAX_SAFE_INTEGER)
            throw fail('G265_REVISION_GENERATION_EXHAUSTED');
          store.put({generation:before.generation+1,sha256:nextHash,bytes:new Uint8Array(nextBytes)},recordKey);
        }catch(e){try{tx.abort();}catch{};rejectOnce(e);}
      };
    }catch(e){rejectOnce(fail('G265_REVISION_TRANSACTION_FAILED',e));}
  });
  const write=async({reason,expectedGeneration,expectedFingerprint,nextBytes}={})=>{
    if(sticky)throw fail('G265_REVISION_UNVERIFIED_RELOAD_REQUIRED');
    if(active)throw fail('G265_REVISION_SESSION_ALREADY_ACTIVE');
    if(typeof reason!=='string'||!reason.trim()||!Number.isSafeInteger(expectedGeneration)
      ||expectedGeneration<0||!isHash(expectedFingerprint))
      throw fail('G265_REVISION_INVALID_WRITE_REQUEST');
    if(typeof locks?.request!=='function'){
      sticky=true;throw fail('G265_REVISION_WEB_LOCKS_UNAVAILABLE');
    }
    let next;
    try{next=asBytes(nextBytes);}catch(e){sticky=true;throw e;}
    active=true;
    const controller=new AbortController();
    let acquired=false,settled=false,timer;
    const operation=Promise.resolve().then(()=>locks.request(lockName,{mode:'exclusive',signal:controller.signal},async lock=>{
      if(!lock||sticky)throw fail('G265_REVISION_LOCK_NOT_ACQUIRED');
      acquired=true;
      const before=await readVerified();
      if(before.generation!==expectedGeneration||before.sha256!==expectedFingerprint)
        throw fail('G265_REVISION_STALE_GENERATION_RELOAD_REQUIRED');
      const nextHash=await fingerprint(next);
      if(!isHash(nextHash)||sticky)throw fail('G265_REVISION_INVALID_NEXT_DIGEST');
      await atomicCommit({before,nextBytes:next,nextHash});
      if(sticky)throw fail('G265_REVISION_UNVERIFIED_RELOAD_REQUIRED');
      const after=await readVerified();
      if(after.generation!==before.generation+1||after.sha256!==nextHash||!equalBytes(after.bytes,next))
        throw fail('G265_REVISION_POST_WRITE_MISMATCH');
      return Object.freeze({status:'PERSISTED',generation:after.generation,sha256:after.sha256});
    }));
    operation.catch(()=>{});
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        if(settled)return;
        sticky=true;
        try{controller.abort();}catch{}
        reject(fail(acquired?'G265_REVISION_HELD_LOCK_TIMEOUT_UNCERTAIN':'G265_REVISION_LOCK_WAIT_TIMEOUT_UNCERTAIN'));
      },timeoutMs);
    });
    try{
      const result=await Promise.race([operation,timeout]);
      settled=true;
      if(!acquired)throw fail('G265_REVISION_LOCK_CALLBACK_NOT_RUN');
      return result;
    }catch(e){sticky=true;throw e;}
    finally{settled=true;clearTimeout(timer);active=false;}
  };
  return Object.freeze({readVerified,write,status:()=>Object.freeze({status:sticky?'UNVERIFIED_RELOAD_REQUIRED':active?'IN_FLIGHT':'READY'})});
}
