// G265 same-page FIFO plus bounded legacy direct-run fail-closed containment.
// Other direct SQL.js entrypoints, cross-tab writers and Android UAT remain HOLD.
import {snapshot,begin,commit,rollback,persist} from './database.js';
import {createSqliteWriteSessionCoordinator} from './sqlite-write-session-coordinator.js';
import {beginSqliteWriteWindow,withSqliteCoordinatedMutation} from './sqlite-direct-write-window-guard.js';
const guarded=fn=>()=>withSqliteCoordinatedMutation(fn);
const sharedWriteSession=createSqliteWriteSessionCoordinator({
  snapshot,begin:guarded(begin),commit:guarded(commit),rollback:guarded(rollback),persist,timeoutMs:30000
});
export function runSqliteWriteSession({reason,mutate}={}){
  if(typeof reason!=='string'||!reason.trim()||typeof mutate!=='function')
    return sharedWriteSession.execute({reason,mutate});
  // The guard wrapper is synchronous: reject async callbacks before wrapping them.
  if(mutate.constructor?.name==='AsyncFunction')
    return Promise.reject(Object.assign(new Error('SQLITE_WRITE_SESSION_ASYNC_MUTATION_FORBIDDEN'),{code:'SQLITE_WRITE_SESSION_ASYNC_MUTATION_FORBIDDEN'}));
  let close;
  try{close=beginSqliteWriteWindow();}
  catch(error){return Promise.reject(error);}
  const pending=sharedWriteSession.execute({reason,mutate:()=>withSqliteCoordinatedMutation(mutate)});
  return pending.then(
    value=>{close();return value;},
    error=>{close({uncertainOutcome:sharedWriteSession.status().status==='UNVERIFIED_RELOAD_REQUIRED'});throw error;}
  );
}
export function getSqliteWriteSessionStatus(){return sharedWriteSession.status();}
