// G265 source-only opt-in bridge: verified durable bytes -> synchronous SQL.js
// transaction -> atomic revision pair. Never imported by the production app.
// This is not a migration, player data writer, snapshot system, or cross-tab
// guarantee while legacy raw-byte persistence callers can bypass admission.
const failure=(code,cause)=>Object.assign(new Error(code),{code,cause});
const thenable=value=>value!==null&&(typeof value==='object'||typeof value==='function')
  &&typeof value.then==='function';

export function createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite}={}){
  if(!pairGate||typeof pairGate.write!=='function'||typeof pairGate.readVerified!=='function'
    ||typeof openSqlite!=='function')
    throw new TypeError('G265_SQLJS_INVALID_ADAPTER');
  const execute=async({reason,expectedGeneration,expectedFingerprint,mutate}={})=>{
    if(typeof mutate!=='function')
      throw failure('G265_SQLJS_MUTATION_CALLBACK_REQUIRED');
    if(mutate.constructor?.name==='AsyncFunction')
      throw failure('G265_SQLJS_ASYNC_MUTATION_FORBIDDEN');
    return pairGate.write({reason,expectedGeneration,expectedFingerprint,
      buildNextBytes:before=>{
        // Pair gate owns the actual native Web Lock, latest durable pair
        // verification, CAS, post-write readback and sticky uncertain state.
        // Do not copy or mutate the current live application's SQL.js object.
        const opened=openSqlite(new Uint8Array(before.bytes));
        if(thenable(opened))throw failure('G265_SQLJS_ASYNC_OPEN_FORBIDDEN');
        if(!opened||typeof opened.run!=='function'
          ||typeof opened.export!=='function'||typeof opened.close!=='function')
          throw failure('G265_SQLJS_INVALID_CONNECTION');
        let txOpen=false;
        try{
          opened.run('BEGIN IMMEDIATE');
          txOpen=true;
          const result=mutate(opened,Object.freeze({
            generation:before.generation,sha256:before.sha256
          }));
          if(thenable(result))throw failure('G265_SQLJS_ASYNC_MUTATION_FORBIDDEN');
          opened.run('COMMIT');
          txOpen=false;
          return opened.export();
        }catch(error){
          if(txOpen){
            try{opened.run('ROLLBACK');}
            catch(rollbackError){
              throw failure('G265_SQLJS_ROLLBACK_UNVERIFIED',rollbackError);
            }
          }
          throw error;
        }finally{
          opened.close();
        }
      }});
  };
  return Object.freeze({execute,status:()=>pairGate.status()});
}
