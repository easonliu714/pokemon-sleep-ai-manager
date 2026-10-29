// G265 fourth exact legacy operation: recordRecipeAttemptFailure() isolated opt-in.
// NEVER imported by the production app. Caller supplies an immutable attempt ID
// and an expected durable revision; no player database, migration or shared master writes.
// Atomic pair gate owns Web Lock, fresh durable reload, CAS, readback and sticky HOLD.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';
import {buildRecipeAttemptFeedbackRecord} from './recipe-attempt-feedback.js';
import {PUBLIC_RECIPE_PROVENANCE} from './public-recipe-provenance.js';

const fail=code=>Object.assign(new Error(code),{code});
const clean=value=>typeof value==='string'?value.normalize('NFKC').trim():'';
const utc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const found=(sql,params=[])=>Boolean(sql?.[0]?.values?.length);

export function createRecipeAttemptFailureOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  async function execute({
    attemptId,recipeId,attemptedAt,createdAt,actualIngredients,
    referenceMaybeWrong=false,recommendationPaused=true,notes='',
    expectedGeneration,expectedFingerprint
  }={}){
    const id=clean(attemptId),recipe=clean(recipeId);
    if(!id||!recipe)throw fail('G265_ATTEMPT_ID_AND_RECIPE_REQUIRED');
    if(!utc(attemptedAt)||!utc(createdAt))throw fail('G265_ATTEMPT_EXACT_UTC_REQUIRED');
    if(typeof referenceMaybeWrong!=='boolean'||typeof recommendationPaused!=='boolean')
      throw fail('G265_ATTEMPT_BOOLEAN_REQUIRED');
    if(typeof notes!=='string'||notes.length>2000)throw fail('G265_ATTEMPT_NOTES_INVALID');
    if(!Array.isArray(actualIngredients)||!actualIngredients.length
      ||actualIngredients.some(item=>!item||!clean(item.ingredient_name)
        ||!Number.isSafeInteger(item.quantity)||item.quantity<=0))
      throw fail('G265_ATTEMPT_INGREDIENTS_INVALID');
    // The public recipe provenance is immutable authority; never accept a caller
    // supplied source label that could impersonate an official reference.
    const provenance=PUBLIC_RECIPE_PROVENANCE.find(row=>
      row.recipe_id===recipe&&row.lifecycle==='ACTIVE');
    if(!provenance)throw fail('G265_ATTEMPT_ACTIVE_PROVENANCE_REQUIRED');
    const record=buildRecipeAttemptFeedbackRecord({
      attempt_id:id,recipe_id:recipe,attempted_at:attemptedAt,
      actual_ingredients:actualIngredients,
      source:{
        source_type:provenance.formula_source_type||'PUBLIC_RECIPE_PROVENANCE',
        source_name:provenance.formula_source_name||null,
        source_ref:provenance.formula_source_ref||null,
      },
      reference_maybe_wrong:referenceMaybeWrong,
      recommendation_paused:recommendationPaused,notes,created_at:createdAt,
    });
    return transaction.execute({
      reason:'g265:optin:recipe-attempt-failure:'+recipe,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        const canonical=sql.exec('SELECT recipe_id FROM recipe_master WHERE recipe_id=? LIMIT 1',[recipe]);
        if(!found(canonical))throw fail('G265_ATTEMPT_UNKNOWN_CANONICAL_RECIPE');
        const ingredients=sql.exec('SELECT ingredient_name FROM ingredient_master');
        const allowed=new Set((ingredients?.[0]?.values||[]).map(row=>row[0]));
        if(record.actual_ingredients.some(row=>!allowed.has(row.ingredient_name)))
          throw fail('G265_ATTEMPT_UNKNOWN_CANONICAL_INGREDIENT');
        if(found(sql.exec('SELECT attempt_id FROM recipe_attempt_feedback WHERE attempt_id=? LIMIT 1',[id])))
          throw fail('G265_ATTEMPT_DUPLICATE_REPLAY_FORBIDDEN');
        // Mirror both statements of the actual G6.2 legacy writer in one
        // synchronous SQL.js transaction, never export an intermediate state.
        sql.run(`INSERT INTO recipe_attempt_feedback(
          attempt_id,recipe_id,attempted_at,outcome,actual_ingredients_json,
          source_type,source_name,source_ref,reference_maybe_wrong,
          recommendation_paused_after_attempt,notes,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[
          record.attempt_id,record.recipe_id,record.attempted_at,record.outcome,
          JSON.stringify(record.actual_ingredients),record.source.source_type,
          record.source.source_name,record.source.source_ref,
          record.reference_maybe_wrong?1:0,record.recommendation_paused?1:0,
          record.notes,record.created_at
        ]);
        sql.run(`INSERT INTO recipe_feedback_state(
          recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at
        ) VALUES(?,?,?,?,?)
        ON CONFLICT(recipe_id) DO UPDATE SET
          recommendation_paused=excluded.recommendation_paused,
          reference_maybe_wrong=excluded.reference_maybe_wrong,
          last_attempt_id=excluded.last_attempt_id,
          updated_at=excluded.updated_at`,[
          record.recipe_id,record.recommendation_paused?1:0,
          record.reference_maybe_wrong?1:0,record.attempt_id,record.created_at
        ]);
      }
    });
  }
  return Object.freeze({execute,status:transaction.status});
}
