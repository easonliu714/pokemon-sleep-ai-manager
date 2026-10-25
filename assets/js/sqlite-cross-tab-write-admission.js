// G265 opt-in cross-tab admission contract; NOT wired to player SQLite.
// No fallback to localStorage/BroadcastChannel or a per-tab mutex. A caller
// must provide a browser Web Locks API and durable-read/write adapters.
// This gate does not protect legacy writers that bypass the lock.
const failure=(code,cause)=>Object.assign(new Error(code),{code,cause});
const validDigest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const bytesOf=value=>{
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  throw failure('SQLITE_CROSS_TAB_INVALID_DURABLE_BYTES');
};
export async function sha256SqliteBytes(value,cryptoApi=globalThis.crypto){
  const bytes=bytesOf(value);
  if(!cryptoApi?.subtle?.digest)throw failure('SQLITE_CROSS_TAB_CRYPTO_UNAVAILABLE');
  // Copy to an independent ArrayBuffer for broad WebCrypto implementations.
  const copy=new Uint8Array(bytes);
  const digest=new Uint8Array(await cryptoApi.subtle.digest('SHA-256',copy));
  return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}

export function createSqliteCrossTabWriteAdmission({
  locks=globalThis.navigator?.locks,
  readDurable,
  fingerprint=sha256SqliteBytes,
  timeoutMs=30000,
  lockName='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'
}={}){
  if(typeof readDurable!=='function'||typeof fingerprint!=='function'
    ||!Number.isFinite(timeoutMs)||timeoutMs<=0
    ||typeof lockName!=='string'||!lockName.trim())
    throw new TypeError('INVALID_SQLITE_CROSS_TAB_ADMISSION_CONFIG');
  let blocked=false,active=false,sequence=0;
  const execute=async({reason,expectedFingerprint,writeUnderLock}={})=>{
    if(blocked)throw failure('SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
    if(active)throw failure('SQLITE_CROSS_TAB_SESSION_ALREADY_ACTIVE');
    if(typeof reason!=='string'||!reason.trim()||!validDigest(expectedFingerprint)
      ||typeof writeUnderLock!=='function')
      throw failure('SQLITE_CROSS_TAB_INVALID_REQUEST');
    if(typeof locks?.request!=='function'){
      blocked=true;
      throw failure('SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
    }
    active=true;
    const ticket=++sequence;
    const controller=new AbortController();
    let acquired=false,settled=false,timer;
    // The Web Lock is held by the request callback until it settles. If our
    // caller times out, the callback must NOT release a still-running write.
    // Sticky HOLD prevents any retry while its outcome is unknown.
    const operation=Promise.resolve().then(()=>locks.request(
      lockName,{mode:'exclusive',signal:controller.signal},async lock=>{
        if(!lock||blocked)throw failure('SQLITE_CROSS_TAB_LOCK_NOT_ACQUIRED');
        acquired=true;
        const latest=bytesOf(await readDurable());
        if(blocked)throw failure('SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
        const observed=await fingerprint(latest);
        if(!validDigest(observed))throw failure('SQLITE_CROSS_TAB_INVALID_FINGERPRINT');
        if(blocked)throw failure('SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
        if(observed!==expectedFingerprint)
          throw failure('SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED');
        // The adapter must mutate, commit and persist only inside this callback.
        const result=await writeUnderLock(Object.freeze({reason,ticket,latestBytes:latest,observedFingerprint:observed}));
        if(blocked)throw failure('SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
        const expectedAfter=await fingerprint(bytesOf(result?.persistedBytes));
        if(!validDigest(expectedAfter))throw failure('SQLITE_CROSS_TAB_INVALID_FINGERPRINT');
        const durableAfter=bytesOf(await readDurable());
        const observedAfter=await fingerprint(durableAfter);
        if(blocked)throw failure('SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
        if(!validDigest(observedAfter)||observedAfter!==expectedAfter)
          throw failure('SQLITE_CROSS_TAB_POST_WRITE_DURABLE_MISMATCH');
        return Object.freeze({status:'PERSISTED',ticket,fingerprint:observedAfter});
      }
    ));
    // Always consume late rejection after a timeout; never create unhandled
    // rejections or permit a second operation on an uncertain page.
    operation.catch(()=>{});
    const timed=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        if(settled)return;
        blocked=true;
        try{controller.abort();}catch{}
        reject(failure(acquired?'SQLITE_CROSS_TAB_HELD_LOCK_TIMEOUT_UNCERTAIN':'SQLITE_CROSS_TAB_LOCK_WAIT_TIMEOUT_UNCERTAIN'));
      },timeoutMs);
    });
    try{
      const result=await Promise.race([operation,timed]);
      settled=true;
      if(!acquired)throw failure('SQLITE_CROSS_TAB_LOCK_CALLBACK_NOT_RUN');
      return result;
    }catch(error){
      blocked=true;
      throw error;
    }finally{
      settled=true;
      clearTimeout(timer);
      active=false;
    }
  };
  return Object.freeze({execute,status:()=>Object.freeze({status:blocked?'UNVERIFIED_RELOAD_REQUIRED':active?'IN_FLIGHT':'READY',sequence})});
}
