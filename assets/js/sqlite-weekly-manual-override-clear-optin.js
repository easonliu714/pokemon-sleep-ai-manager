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
