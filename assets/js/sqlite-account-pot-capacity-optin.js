// G265 seventh exact legacy account pot writer: isolated opt-in CAS only.
// Never imported by production; original weekly-context-ui-bridge writer unchanged.
// Requires native Web Lock, latest durable SQLite reload, sync SQL.js transaction,
// atomic generation/SHA pair CAS, logical row readback and fail-closed uncertainty.
// This is NOT all-writer containment, crash snapshot, or player DB admission.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const validCapacity=n=>Number.isSafeInteger(n)&&n>0;
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const SOURCES=new Set(['MANUAL_WEEKLY_CONTEXT_UI','WEEKLY_CONTEXT_LEGACY_PROMOTION']);
const rows=(sql,query,params=[])=>sql.exec(query,params)?.[0]?.values||[];

export function createAccountPotCapacityOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  let sticky=false;
  const status=()=>sticky?Object.freeze({status:'UNVERIFIED_RELOAD_REQUIRED'}):transaction.status();
  async function execute({
    capacity,source,updatedAt,expectedPreviousCapacity,
    expectedGeneration,expectedFingerprint
  }={}){
    if(sticky)throw fail('G265_ACCOUNT_POT_UNVERIFIED_RELOAD_REQUIRED');
    if(!validCapacity(capacity)||!(expectedPreviousCapacity===null
      ||validCapacity(expectedPreviousCapacity)))
      throw fail('G265_ACCOUNT_POT_CAPACITY_INVALID');
    if(!SOURCES.has(source)||!utc(updatedAt))
      throw fail('G265_ACCOUNT_POT_PROVENANCE_INVALID');
    let previousUsedCount=null;
    const outcome=await transaction.execute({
      reason:'g265:optin:account-pot-capacity',
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        const prior=rows(sql,'SELECT total_capacity,used_count FROM account_capacity WHERE capacity_key=?',['pot']);
        if(prior.length>1||((prior.length===0?null:prior[0][0])!==expectedPreviousCapacity))
          throw fail('G265_ACCOUNT_POT_PREVIOUS_CAPACITY_CHANGED');
        previousUsedCount=prior.length?prior[0][1]:null;
        sql.run("INSERT INTO account_capacity(capacity_key,total_capacity,used_count,updated_at,source) VALUES('pot',?,NULL,?,?) ON CONFLICT(capacity_key) DO UPDATE SET total_capacity=excluded.total_capacity,updated_at=excluded.updated_at,source=excluded.source",
          [capacity,updatedAt,source]);
      }
    });
    // Reopen independently verified persisted bytes; ACK alone is insufficient.
    try{
      const verified=await pairGate.readVerified();
      if(verified.generation!==outcome.generation||verified.sha256!==outcome.sha256)
        throw fail('G265_ACCOUNT_POT_POST_ACK_REVISION_MISMATCH');
      const sql=openSqlite(new Uint8Array(verified.bytes));
      try{
        const row=rows(sql,'SELECT total_capacity,used_count,updated_at,source FROM account_capacity WHERE capacity_key=?',['pot']);
        if(row.length!==1||row[0][0]!==capacity||row[0][1]!==previousUsedCount
          ||row[0][2]!==updatedAt||row[0][3]!==source)
          throw fail('G265_ACCOUNT_POT_POST_ACK_ROW_MISMATCH');
      }finally{sql.close();}
    }catch(error){sticky=true;throw error;}
    return Object.freeze({...outcome,capacity,source});
  }
  return Object.freeze({execute,status});
}
