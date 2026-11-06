// G265 bounded same-page fail-closed guard for legacy database.run() writers.
// This is NOT a multi-tab lock, an all-writer queue, or durable Android evidence.
const guardError=code=>Object.assign(new Error(code),{code});
let activeWindows=0,activeBarePersists=0,privilegedDepth=0,uncertain=false;
export function beginSqliteWriteWindow(){
  if(uncertain)throw guardError('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  if(activeBarePersists>0)throw guardError('SQLITE_DIRECT_WRITE_BLOCKED_DURING_PERSIST');
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
// Bare persist is not an opt-in mutation session. Keep its pending raw-byte save
// from admitting even privileged direct SQL writes until every queued save settles.
export function beginSqliteBarePersistWindow(){
  if(uncertain)throw guardError('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  activeBarePersists++;
  let closed=false;
  return function endSqliteBarePersistWindow(){
    if(closed)return;
    closed=true;
    activeBarePersists=Math.max(0,activeBarePersists-1);
  };
}
// A bare database.persist() can lose its IDB ACK without an opt-in write window.
// Keep all same-page direct SQL mutations fail-closed until reload/readback.
export function markSqliteDurabilityUncertain(){uncertain=true;}
export function assertSqliteDirectWriteAllowed(){
  if(uncertain)throw guardError('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  if(activeBarePersists>0)throw guardError('SQLITE_DIRECT_WRITE_BLOCKED_DURING_PERSIST');
  if(activeWindows>0&&privilegedDepth===0)
    throw guardError('SQLITE_LEGACY_DIRECT_WRITE_BLOCKED_DURING_SESSION');
}
export function getSqliteDirectWriteGuardStatus(){
  return Object.freeze({status:uncertain?'UNVERIFIED_RELOAD_REQUIRED':(activeWindows>0||activeBarePersists>0)?'IN_FLIGHT':'READY',active_windows:activeWindows,active_bare_persists:activeBarePersists});
}
