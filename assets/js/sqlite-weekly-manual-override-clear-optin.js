// G265 third exact legacy write operation: clearWeeklyManualOverride().
// Source-only opt-in. Never imported by production; no player DB is opened.
// Admission requires an existing row: missing-key semantics are intentionally
// fail-closed pending a separate no-op/readback contract.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const validWeek=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(Date.parse(value+'T00:00:00.000Z'))
  &&new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;

export function createWeeklyManualOverrideClearOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  async function execute({weekStart,expectedGeneration,expectedFingerprint}={}){
    if(!validWeek(weekStart))throw fail('G265_WEEKLY_CLEAR_INVALID_WEEK');
    const key='weekly_context_manual_override:'+weekStart;
    return transaction.execute({
      reason:'g265:optin:weekly-manual-override-clear:'+weekStart,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        // Exact legacy DELETE; guard missing row to avoid false durable ACK.
        const found=sql.exec('SELECT key FROM settings WHERE key=? LIMIT 1',[key]);
        if(!found?.[0]?.values?.length)throw fail('G265_WEEKLY_CLEAR_MISSING_ROW_HOLD');
        sql.run('DELETE FROM settings WHERE key=?',[key]);
      }
    });
  }
  return Object.freeze({execute,status:transaction.status});
}


// G265 missing-key legacy false no-op: read-only, cooperative lock-held probe.
// This is deliberately NOT an alternate DELETE. Present rows require execute()
// with a new CAS check; legacy writers can still bypass Web Locks in production.
export function createWeeklyManualOverrideClearNoopProbe({
  pairGate,openSqlite,locks=globalThis.navigator?.locks,
  lockName='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write',timeoutMs=30000
}={}){
  if(typeof pairGate?.readVerified!=='function'||typeof openSqlite!=='function'
    ||typeof lockName!=='string'||!lockName.trim()
    ||!Number.isFinite(timeoutMs)||timeoutMs<=0)
    throw new TypeError('G265_WEEKLY_CLEAR_PROBE_INVALID_CONFIG');
  let sticky=false,active=false;
  async function inspect({weekStart,expectedGeneration,expectedFingerprint}={}){
    if(sticky)throw fail('G265_WEEKLY_CLEAR_PROBE_UNVERIFIED_RELOAD_REQUIRED');
    if(active)throw fail('G265_WEEKLY_CLEAR_PROBE_ALREADY_ACTIVE');
    if(!validWeek(weekStart))throw fail('G265_WEEKLY_CLEAR_INVALID_WEEK');
    if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0
      ||typeof expectedFingerprint!=='string'||!/^[0-9a-f]{64}$/.test(expectedFingerprint))
      throw fail('G265_WEEKLY_CLEAR_PROBE_INVALID_REVISION');
    if(typeof locks?.request!=='function'){
      sticky=true;throw fail('G265_WEEKLY_CLEAR_PROBE_WEB_LOCKS_UNAVAILABLE');
    }
    active=true;
    const controller=new AbortController();
    let timer,settled=false,acquired=false;
    const operation=Promise.resolve().then(()=>locks.request(lockName,
      {mode:'exclusive',signal:controller.signal},async lock=>{
        if(!lock||sticky)throw fail('G265_WEEKLY_CLEAR_PROBE_LOCK_NOT_ACQUIRED');
        acquired=true;
        // Verify the durable bytes and revision *inside* the exclusive lock.
        const current=await pairGate.readVerified();
        // Timeout may fire while durable read is pending: never open SQLite after abort.
        if(sticky||controller.signal.aborted)
          throw fail('G265_WEEKLY_CLEAR_PROBE_TIMEOUT_ABORTED_BEFORE_SQL');
        if(current.generation!==expectedGeneration||current.sha256!==expectedFingerprint)
          throw fail('G265_WEEKLY_CLEAR_PROBE_STALE_RELOAD_REQUIRED');
        const connection=openSqlite(new Uint8Array(current.bytes));
        if(connection&&typeof connection.then==='function')
          throw fail('G265_WEEKLY_CLEAR_PROBE_ASYNC_OPEN_FORBIDDEN');
        if(!connection||typeof connection.run!=='function'
          ||typeof connection.exec!=='function'||typeof connection.close!=='function')
          throw fail('G265_WEEKLY_CLEAR_PROBE_INVALID_CONNECTION');
        try{
          // SQLite query_only prohibits accidental mutations by the probe.
          connection.run('PRAGMA query_only=ON');
          const rows=connection.exec('SELECT key FROM settings WHERE key=? LIMIT 1',
            ['weekly_context_manual_override:'+weekStart]);
          const present=Boolean(rows?.[0]?.values?.length);
          return Object.freeze({status:present?'PRESENT_REQUIRES_CAS_WRITE':'ABSENT_NOOP',
            legacyResult:present?null:false,generation:current.generation,sha256:current.sha256});
        }finally{connection.close();}
      }));
    operation.catch(()=>{});
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        if(settled)return;
        sticky=true;
        try{controller.abort();}catch{}
        reject(fail(acquired?'G265_WEEKLY_CLEAR_PROBE_HELD_LOCK_TIMEOUT':
          'G265_WEEKLY_CLEAR_PROBE_LOCK_WAIT_TIMEOUT'));
      },timeoutMs);
    });
    try{
      const result=await Promise.race([operation,timeout]);
      settled=true;
      if(!acquired)throw fail('G265_WEEKLY_CLEAR_PROBE_LOCK_CALLBACK_NOT_RUN');
      return result;
    }catch(error){sticky=true;throw error;}
    finally{settled=true;clearTimeout(timer);active=false;}
  }
  return Object.freeze({inspect,status:()=>Object.freeze({
    status:sticky?'UNVERIFIED_RELOAD_REQUIRED':active?'IN_FLIGHT':'READY'
  })});
}
