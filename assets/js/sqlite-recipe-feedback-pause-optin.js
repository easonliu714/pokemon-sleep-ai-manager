// G265 exact legacy-writer admission candidate: G6.2 pause toggle only.
// Source-only opt-in; never imported by the production application.
// Native lock, fresh durable SQL.js, atomic CAS and readback are delegated to
// the existing isolated transaction adapter. No live player DB is opened.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const fail=code=>Object.assign(new Error(code),{code});
const canonicalId=value=>typeof value==='string'?value.normalize('NFKC').trim():'';

export function createRecipeFeedbackPauseOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  async function execute({recipeId,paused,updatedAt,expectedGeneration,expectedFingerprint}={}){
    const id=canonicalId(recipeId);
    if(!id)throw fail('G265_RECIPE_PAUSE_RECIPE_ID_REQUIRED');
    if(typeof paused!=='boolean')throw fail('G265_RECIPE_PAUSE_BOOLEAN_REQUIRED');
    if(typeof updatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt)
      ||Number.isNaN(Date.parse(updatedAt))||new Date(updatedAt).toISOString()!==updatedAt)
      throw fail('G265_RECIPE_PAUSE_TIMESTAMP_REQUIRED');
    return transaction.execute({
      reason:'g265:optin:recipe-feedback-pause:'+id,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        const recipe=sql.exec('SELECT recipe_id FROM recipe_master WHERE recipe_id=? LIMIT 1',[id]);
        if(!recipe?.[0]?.values?.length)throw fail('G265_RECIPE_PAUSE_UNKNOWN_RECIPE');
        // Mirrors legacy G6.2 UPSERT. On conflict, retain warning and
        // last-attempt columns; only pause and timestamp are modified.
        sql.run('INSERT INTO recipe_feedback_state(recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at) VALUES(?,?,0,NULL,?) ON CONFLICT(recipe_id) DO UPDATE SET recommendation_paused=excluded.recommendation_paused,updated_at=excluded.updated_at',
          [id,paused?1:0,updatedAt]);
      }
    });
  }
  return Object.freeze({execute,status:transaction.status});
}
