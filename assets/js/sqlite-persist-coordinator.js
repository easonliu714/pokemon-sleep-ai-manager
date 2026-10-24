// G265 shared SQLite byte-persistence coordination contract.
// Pure, unimported until all runtime database writers are audited and wired.
// A failed or timed-out save has unknown durable outcome: reload is required.
const uncertainError=(cause)=>Object.assign(new Error('SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED'),{code:'SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED',cause});
export function createSqlitePersistCoordinator({capture,save,timeoutMs=30000}={}){
  if(typeof capture!=='function'||typeof save!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0)
    throw new TypeError('INVALID_SQLITE_PERSIST_COORDINATOR');
  let tail=Promise.resolve(),uncertain=false,sequence=0;
  const persist=()=>{
    const ticket=++sequence;
    const operation=tail.then(async()=>{
      if(uncertain)throw uncertainError();
      // Capture only after earlier IndexedDB save has completed, not at enqueue.
      const bytes=capture();
      let timer;
      try{
        await Promise.race([
          Promise.resolve().then(()=>save(bytes)),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('SQLITE_PERSIST_TIMEOUT')),timeoutMs);timer?.unref?.();})
        ]);
      }catch(cause){
        // A timed-out save may still complete later; never issue another write
        // in this session until a full reload and durable readback.
        uncertain=true;
        throw uncertainError(cause);
      }finally{clearTimeout(timer);}
      return Object.freeze({status:'PERSISTED',ticket,byte_length:bytes?.byteLength??null});
    });
    tail=operation.catch(()=>{});
    return operation;
  };
  return Object.freeze({persist,status:()=>Object.freeze({status:uncertain?'UNVERIFIED_RELOAD_REQUIRED':'READY',sequence})});
}
