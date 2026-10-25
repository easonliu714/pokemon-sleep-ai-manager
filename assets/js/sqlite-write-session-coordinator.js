// G265: opt-in, same-page write-session contract. No existing writer is migrated.
// A session owns snapshot -> synchronous SQL transaction -> IndexedDB persistence.
// Never confuse serialized byte persistence with all-writer or multi-tab isolation.
const sessionError=(code,cause)=>Object.assign(new Error(code),{code,cause});
const uncertain=(cause)=>sessionError('SQLITE_WRITE_SESSION_UNVERIFIED_RELOAD_REQUIRED',cause);
const isThenable=value=>value!==null&&(typeof value==='object'||typeof value==='function')&&typeof value.then==='function';
export function createSqliteWriteSessionCoordinator({snapshot,begin,commit,rollback,persist,timeoutMs=30000}={}){
  if([snapshot,begin,commit,rollback,persist].some(fn=>typeof fn!=='function')
      ||!Number.isFinite(timeoutMs)||timeoutMs<=0)
    throw new TypeError('INVALID_SQLITE_WRITE_SESSION_COORDINATOR');
  let tail=Promise.resolve(),blocked=false,sequence=0,active=false;
  const awaitBounded=async(promise,phase)=>{
    let timer;
    try{
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(sessionError('SQLITE_WRITE_SESSION_'+phase+'_TIMEOUT')),timeoutMs);})
      ]);
    }finally{clearTimeout(timer);}
  };
  const execute=({reason,mutate}={})=>{
    if(typeof reason!=='string'||!reason.trim()||typeof mutate!=='function')
      return Promise.reject(sessionError('INVALID_SQLITE_WRITE_SESSION_REQUEST'));
    const ticket=++sequence;
    const operation=tail.then(async()=>{
      if(blocked)throw uncertain();
      active=true;
      try{
        // Snapshot MUST finish before SQL BEGIN. Timeout is uncertain because
        // the underlying async snapshot can still finish later.
        try{await awaitBounded(Promise.resolve().then(()=>snapshot(reason)),'SNAPSHOT');}
        catch(cause){if(cause?.code==='SQLITE_WRITE_SESSION_SNAPSHOT_TIMEOUT')blocked=true;throw cause;}
        if(blocked)throw uncertain();
        try{begin();}catch(cause){blocked=true;throw uncertain(cause);}
        let commitAttempted=false;
        try{
          // SQL mutation must be synchronous on the single SQL.js connection.
          // Async callbacks can resume after rollback, so reject them up front.
          if(mutate.constructor?.name==='AsyncFunction')
            throw sessionError('SQLITE_WRITE_SESSION_ASYNC_MUTATION_FORBIDDEN');
          const value=mutate();
          if(isThenable(value)){
            blocked=true;
            throw sessionError('SQLITE_WRITE_SESSION_THENABLE_MUTATION_UNSAFE');
          }
          commitAttempted=true;
          commit();
        }catch(cause){
          try{rollback();}catch(rollbackError){blocked=true;throw uncertain(rollbackError);}
          // Commit may have succeeded before throwing: never retry blindly.
          if(cause?.code==='SQLITE_WRITE_SESSION_THENABLE_MUTATION_UNSAFE')throw uncertain(cause);
          if(commitAttempted){blocked=true;throw uncertain(cause);}
          throw cause;
        }
        try{await awaitBounded(Promise.resolve().then(()=>persist()),'PERSIST');}
        catch(cause){blocked=true;throw uncertain(cause);}
        return Object.freeze({status:'PERSISTED',ticket,reason});
      }finally{active=false;}
    });
    tail=operation.catch(()=>{});
    return operation;
  };
  return Object.freeze({execute,status:()=>Object.freeze({status:blocked?'UNVERIFIED_RELOAD_REQUIRED':active?'IN_FLIGHT':'READY',sequence})});
}
