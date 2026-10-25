// G265 bounded same-page fail-closed guard for legacy database.run() writers.
// This is NOT a multi-tab lock, an all-writer queue, or durable Android evidence.
const guardError=code=>Object.assign(new Error(code),{code});
let activeWindows=0,privilegedDepth=0,uncertain=false;
export function beginSqliteWriteWindow(){
  if(uncertain)throw guardError('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  activeWindows++;
  let closed=false;
  return function endSqliteWriteWindow({uncertainOutcome=false}={}){
    if(closed)return;
    closed=true;
    if(uncertainOutcome)uncertain=true;
    activeWindows=Math.max(0,activeWindows-1);
  };
}
export function withSqliteCoordinatedMutation(fn){
  if(typeof fn!=='function')throw new TypeError('SQLITE_COORDINATED_MUTATION_CALLBACK_REQUIRED');
  privilegedDepth++;
  try{return fn();}finally{privilegedDepth--;}
}
export function assertSqliteDirectWriteAllowed(){
  if(uncertain)throw guardError('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  if(activeWindows>0&&privilegedDepth===0)
    throw guardError('SQLITE_LEGACY_DIRECT_WRITE_BLOCKED_DURING_SESSION');
}
export function getSqliteDirectWriteGuardStatus(){
  return Object.freeze({status:uncertain?'UNVERIFIED_RELOAD_REQUIRED':activeWindows>0?'IN_FLIGHT':'READY',active_windows:activeWindows});
}
