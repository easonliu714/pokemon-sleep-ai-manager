import {rows,run,persist,begin,commit,rollback,isDatabaseReady,isRescueReadonly} from './database.js';
import {PUBLIC_RECIPE_PROVENANCE} from './public-recipe-provenance.js';
import {
  buildRecipeAttemptFeedbackRecord,
  decodeRecipeAttemptIngredientJson,
  RECIPE_ATTEMPT_FEEDBACK_VERSION,
} from './recipe-attempt-feedback.js';

const clean=value=>String(value??'').normalize('NFKC').trim();
const nowIso=()=>new Date().toISOString();
// SQL COMMIT and IndexedDB acknowledgment are separate durability boundaries.
// Store only an opaque attempt identifier in this tab for post-reload readback.
const PERSISTENCE_HOLD_KEY='pokemon-sleep-g62-persistence-uncertain-v1';
let pendingPersistenceHold=null;
let recordInFlight=false;
// G6.2: serialize all player-private writes until their IndexedDB result settles.
let playerWriteInFlight=false;
function readPersistenceMarker(){
  try{
    const value=globalThis.sessionStorage?.getItem(PERSISTENCE_HOLD_KEY);
    if(!value)return null;
    const marker=JSON.parse(value);
    if(typeof marker?.recipe_id!=='string')return null;
    if(marker.operation==='PAUSE_TOGGLE')
      return marker.target_paused===0||marker.target_paused===1?marker:null;
    return typeof marker.attempt_id==='string'?marker:null;
  }catch{return null;}
}
function writePersistenceMarker(marker){
  try{globalThis.sessionStorage?.setItem(PERSISTENCE_HOLD_KEY,JSON.stringify(marker));}catch{}
}
function clearPersistenceMarker(){
  try{globalThis.sessionStorage?.removeItem(PERSISTENCE_HOLD_KEY);}catch{}
}
function persistenceUncertainError(marker,cause=null){
  return Object.assign(new Error('PERSISTENCE_UNCERTAIN：SQLite 已提交，但本機持久化結果尚未確認；請重新載入並核對失敗歷程，勿直接重試。'),{
    code:'PERSISTENCE_UNCERTAIN',attempt_id:marker?.attempt_id||null,recipe_id:marker?.recipe_id||null,cause,
  });
}
export function getRecipeAttemptPersistenceStatus(){
  if(pendingPersistenceHold)return Object.freeze({status:'UNVERIFIED',...pendingPersistenceHold});
  if(playerWriteInFlight)return Object.freeze({status:'IN_FLIGHT',operation:'G62_PLAYER_WRITE'});
  const marker=readPersistenceMarker();
  if(!marker)return Object.freeze({status:'CLEAR'});
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze({status:'UNVERIFIED',...marker});
  try{
    // Read back the exact toggle target instead of querying an absent attempt_id.
    const exists=marker.operation==='PAUSE_TOGGLE'
      ?rows('SELECT recommendation_paused FROM recipe_feedback_state WHERE recipe_id=?',[marker.recipe_id])
        .some(row=>Number(row.recommendation_paused)===marker.target_paused)
      :rows('SELECT attempt_id FROM recipe_attempt_feedback WHERE attempt_id=?',[marker.attempt_id]).length===1;
    clearPersistenceMarker();
    return Object.freeze({status:exists?'PERSISTED':'NOT_PERSISTED',...marker,source:'RELOADED_SQLITE_READBACK'});
  }catch{
    return Object.freeze({status:'UNVERIFIED',...marker});
  }
}

function canonicalRecipe(recipeId){
  const id=clean(recipeId);
  if(!id)return null;
  return rows('SELECT recipe_id,recipe_name,category FROM recipe_master WHERE recipe_id=?',[id])[0]||null;
}
function provenanceFor(recipeId){
  return PUBLIC_RECIPE_PROVENANCE.find(row=>row.recipe_id===clean(recipeId)&&row.lifecycle==='ACTIVE')||null;
}
function canonicalIngredientNames(){
  return new Set(rows('SELECT ingredient_name FROM ingredient_master ORDER BY ingredient_name').map(row=>row.ingredient_name));
}
function requireWritableDatabase(){
  if(!isDatabaseReady())throw new Error('recipe_attempt_player_database_not_ready');
  if(isRescueReadonly())throw new Error('recipe_attempt_readonly_rescue_mode');
  if(playerWriteInFlight)throw Object.assign(new Error('recipe_attempt_player_write_in_flight'),{code:'RECIPE_ATTEMPT_WRITE_IN_FLIGHT'});
  const status=getRecipeAttemptPersistenceStatus();
  if(status.status==='UNVERIFIED')throw persistenceUncertainError(status);
}
function eventId(recipeId,attemptedAt){
  const random=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2,10);
  return `recipe-attempt:${clean(recipeId)}:${Date.parse(attemptedAt)||Date.now()}:${random}`;
}

export function recipeAttemptDefaultSource(recipeId){
  const provenance=provenanceFor(recipeId);
  if(!provenance)return Object.freeze({
    source_type:'PLAYER_REPORTED_REFERENCE',
    source_name:null,
    source_ref:null,
    provenance_status:'MISSING',
  });
  return Object.freeze({
    source_type:provenance.formula_source_type||'PUBLIC_RECIPE_PROVENANCE',
    source_name:provenance.formula_source_name||null,
    source_ref:provenance.formula_source_ref||null,
    provenance_status:provenance.overall_status||null,
    provenance_version:provenance.provenance_version||null,
  });
}

export function listRecipeAttemptFeedbackSummaries(){
  if(!isDatabaseReady()||isRescueReadonly())return [];
  return rows(`SELECT
      s.recipe_id,
      s.recommendation_paused,
      s.reference_maybe_wrong,
      s.last_attempt_id,
      s.updated_at,
      COUNT(a.attempt_id) AS attempt_count,
      MAX(a.attempted_at) AS last_failure_at,
      latest.source_type,
      latest.source_name,
      latest.source_ref
    FROM recipe_feedback_state s
    LEFT JOIN recipe_attempt_feedback a ON a.recipe_id=s.recipe_id
    LEFT JOIN recipe_attempt_feedback latest ON latest.attempt_id=s.last_attempt_id
    GROUP BY s.recipe_id,s.recommendation_paused,s.reference_maybe_wrong,s.last_attempt_id,s.updated_at,
      latest.source_type,latest.source_name,latest.source_ref
    ORDER BY s.recipe_id`);
}

export function listRecipeAttemptFeedbackHistory(limit=20){
  if(!isDatabaseReady()||isRescueReadonly())return [];
  const safeLimit=Math.max(1,Math.min(100,Number(limit)||20));
  return rows(`SELECT
      a.attempt_id,a.recipe_id,m.recipe_name,a.attempted_at,a.outcome,a.actual_ingredients_json,
      a.source_type,a.source_name,a.source_ref,a.reference_maybe_wrong,a.recommendation_paused_after_attempt,
      a.notes,a.created_at,
      COALESCE(s.recommendation_paused,0) AS recommendation_paused,
      COALESCE(s.reference_maybe_wrong,0) AS current_reference_maybe_wrong
    FROM recipe_attempt_feedback a
    JOIN recipe_master m ON m.recipe_id=a.recipe_id
    LEFT JOIN recipe_feedback_state s ON s.recipe_id=a.recipe_id
    ORDER BY a.attempted_at DESC,a.attempt_id DESC
    LIMIT ${safeLimit}`).map(row=>({
      ...row,
      actual_ingredients:decodeRecipeAttemptIngredientJson(row.actual_ingredients_json),
    }));
}

export async function recordRecipeAttemptFailure({
  recipe_id,
  attempted_at=nowIso(),
  actual_ingredients=[],
  source={},
  reference_maybe_wrong=false,
  recommendation_paused=true,
  notes='',
}={}){
  requireWritableDatabase();
  const recipe=canonicalRecipe(recipe_id);
  if(!recipe)throw new Error('recipe_attempt_canonical_recipe_required');
  const provenance=provenanceFor(recipe.recipe_id);
  if(!provenance)throw new Error('recipe_attempt_active_public_master_provenance_required');

  const defaults=recipeAttemptDefaultSource(recipe.recipe_id);
  const effectiveSource={
    source_type:clean(source?.source_type)||defaults.source_type,
    source_name:clean(source?.source_name)||defaults.source_name,
    source_ref:clean(source?.source_ref)||defaults.source_ref,
  };
  const record=buildRecipeAttemptFeedbackRecord({
    attempt_id:eventId(recipe.recipe_id,attempted_at),
    recipe_id:recipe.recipe_id,
    attempted_at,
    actual_ingredients,
    source:effectiveSource,
    reference_maybe_wrong,
    recommendation_paused,
    notes,
    created_at:nowIso(),
  });
  const ingredientAuthority=canonicalIngredientNames();
  const unknown=record.actual_ingredients.filter(row=>!ingredientAuthority.has(row.ingredient_name));
  if(unknown.length)throw new Error(`recipe_attempt_unknown_ingredient:${unknown.map(row=>row.ingredient_name).join(',')}`);

  if(recordInFlight)throw Object.assign(new Error('recipe_attempt_save_in_flight'),{code:'RECIPE_ATTEMPT_SAVE_IN_FLIGHT'});
  recordInFlight=true;
  playerWriteInFlight=true;
  try{
    begin();
    try{
      run(`INSERT INTO recipe_attempt_feedback(
      attempt_id,recipe_id,attempted_at,outcome,actual_ingredients_json,
      source_type,source_name,source_ref,reference_maybe_wrong,recommendation_paused_after_attempt,notes,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[
      record.attempt_id,record.recipe_id,record.attempted_at,record.outcome,JSON.stringify(record.actual_ingredients),
      record.source.source_type,record.source.source_name,record.source.source_ref,
      record.reference_maybe_wrong?1:0,record.recommendation_paused?1:0,record.notes,record.created_at,
    ]);
    run(`INSERT INTO recipe_feedback_state(recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at)
      VALUES(?,?,?,?,?)
      ON CONFLICT(recipe_id) DO UPDATE SET
        recommendation_paused=excluded.recommendation_paused,
        reference_maybe_wrong=excluded.reference_maybe_wrong,
        last_attempt_id=excluded.last_attempt_id,
        updated_at=excluded.updated_at`,[
      record.recipe_id,record.recommendation_paused?1:0,record.reference_maybe_wrong?1:0,record.attempt_id,record.created_at,
    ]);
    commit();
    }catch(error){
      rollback();
      throw error;
    }
    try{
      await persist();
    }catch(error){
      // A committed SQL row may already be durable, even when IDB rejects or times out.
      pendingPersistenceHold={attempt_id:record.attempt_id,recipe_id:record.recipe_id};
      writePersistenceMarker(pendingPersistenceHold);
      try{globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:recipe-attempt-persistence-uncertain',{detail:{
        code:'PERSISTENCE_UNCERTAIN',attempt_id:record.attempt_id,recipe_id:record.recipe_id,
        recovery:'RELOAD_AND_READBACK',shared_master_write:false,
      }}));}catch{}
      throw persistenceUncertainError(pendingPersistenceHold,error);
    }
    // Listener failures cannot convert an already durable write into a retryable error.
    try{
      globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:recipe-attempt-feedback-changed',{detail:{
        recipe_id:record.recipe_id,attempt_id:record.attempt_id,recommendation_paused:record.recommendation_paused,
        version:RECIPE_ATTEMPT_FEEDBACK_VERSION,
      }}));
      globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'recipe_attempt_feedback',recipe_id:record.recipe_id}}));
    }catch{}
    return Object.freeze({...record,recipe_name:recipe.recipe_name,shared_master_write:false});
  }finally{
    recordInFlight=false;
    playerWriteInFlight=false;
  }
}

// G6.2: share the attempt-write single-flight guard and fail closed after an ambiguous toggle.
export async function setRecipeRecommendationPaused(recipeId,paused){
  requireWritableDatabase();
  const recipe=canonicalRecipe(recipeId);
  if(!recipe)throw new Error('recipe_feedback_canonical_recipe_required');
  const updatedAt=nowIso();
  const marker={operation:'PAUSE_TOGGLE',recipe_id:recipe.recipe_id,target_paused:paused?1:0};
  playerWriteInFlight=true;
  try{
    run(`INSERT INTO recipe_feedback_state(recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at)
    VALUES(?,?,0,NULL,?)
    ON CONFLICT(recipe_id) DO UPDATE SET recommendation_paused=excluded.recommendation_paused,updated_at=excluded.updated_at`,[
      recipe.recipe_id,paused?1:0,updatedAt,
    ]);
    try{
      await persist();
    }catch(error){
      pendingPersistenceHold=marker;
      writePersistenceMarker(marker);
      try{globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:recipe-attempt-persistence-uncertain',{detail:{
        code:'PERSISTENCE_UNCERTAIN',operation:'PAUSE_TOGGLE',recipe_id:recipe.recipe_id,
        recovery:'RELOAD_AND_READBACK',shared_master_write:false,
      }}));}catch{}
      throw persistenceUncertainError(marker,error);
    }
    // Post-durability observer failures must never invite a blind retry.
    try{
      globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:recipe-attempt-feedback-changed',{detail:{
        recipe_id:recipe.recipe_id,recommendation_paused:Boolean(paused),version:RECIPE_ATTEMPT_FEEDBACK_VERSION,
      }}));
      globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'recipe_feedback_state',recipe_id:recipe.recipe_id}}));
    }catch{}
    return Object.freeze({recipe_id:recipe.recipe_id,recipe_name:recipe.recipe_name,recommendation_paused:Boolean(paused),updated_at:updatedAt,shared_master_write:false});
  }finally{
    playerWriteInFlight=false;
  }
}
