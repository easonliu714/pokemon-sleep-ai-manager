// G265 same-page FIFO plus bounded legacy direct-run fail-closed containment.
// Other direct SQL.js entrypoints, cross-tab writers and Android UAT remain HOLD.
import {snapshot,begin,commit,rollback,persist} from './database.js';
import {createSqliteWriteSessionCoordinator} from './sqlite-write-session-coordinator.js';
import {beginSqliteExclusiveWriteWindow,withSqliteCoordinatedMutation} from './sqlite-direct-write-window-guard.js';
import {withPrimarySqliteMutationLock} from './storage.js';
const guarded=fn=>()=>withSqliteCoordinatedMutation(fn);
const sharedWriteSession=createSqliteWriteSessionCoordinator({
  // The exclusive session guards direct SQL and also the synchronous ENTRY to
  // database.persist(), which reserves its own bare-persist window before await.
  // Keep the exact native lease passed by the coordinator through the IDB ACK.
  snapshot,begin:guarded(begin),commit:guarded(commit),rollback:guarded(rollback),
  persist:options=>withSqliteCoordinatedMutation(()=>persist(options)),
  admit:withPrimarySqliteMutationLock,timeoutMs:30000
});
export function runSqliteWriteSession({reason,mutate}={}){
  if(typeof reason!=='string'||!reason.trim()||typeof mutate!=='function')
    return sharedWriteSession.execute({reason,mutate});
  // The guard wrapper is synchronous: reject async callbacks before wrapping them.
  if(mutate.constructor?.name==='AsyncFunction')
    return Promise.reject(Object.assign(new Error('SQLITE_WRITE_SESSION_ASYNC_MUTATION_FORBIDDEN'),{code:'SQLITE_WRITE_SESSION_ASYNC_MUTATION_FORBIDDEN'}));
  let close;
  try{close=beginSqliteExclusiveWriteWindow();}
  catch(error){return Promise.reject(error);}
  const pending=sharedWriteSession.execute({reason,mutate:()=>withSqliteCoordinatedMutation(mutate)});
  return pending.then(
    value=>{close();return value;},
    error=>{close({uncertainOutcome:sharedWriteSession.status().status==='UNVERIFIED_RELOAD_REQUIRED'});throw error;}
  );
}
export function getSqliteWriteSessionStatus(){return sharedWriteSession.status();}
