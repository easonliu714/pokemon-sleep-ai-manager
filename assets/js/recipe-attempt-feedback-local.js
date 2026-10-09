import {rows,run,persist,begin,commit,rollback,isDatabaseReady,isRescueReadonly} from './database.js';
import {PUBLIC_RECIPE_PROVENANCE} from './public-recipe-provenance.js';
import {
  buildRecipeAttemptFeedbackRecord,
  decodeRecipeAttemptIngredientJson,
  RECIPE_ATTEMPT_FEEDBACK_VERSION,
} from './recipe-attempt-feedback.js';

const clean=value=>String(value??'').normalize('NFKC').trim();
const nowIso=()=>new Date().toISOString();

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
  await persist();
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:recipe-attempt-feedback-changed',{detail:{
    recipe_id:record.recipe_id,attempt_id:record.attempt_id,recommendation_paused:record.recommendation_paused,
    version:RECIPE_ATTEMPT_FEEDBACK_VERSION,
  }}));
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'recipe_attempt_feedback',recipe_id:record.recipe_id}}));
  return Object.freeze({...record,recipe_name:recipe.recipe_name,shared_master_write:false});
}

export async function setRecipeRecommendationPaused(recipeId,paused){
  requireWritableDatabase();
  const recipe=canonicalRecipe(recipeId);
  if(!recipe)throw new Error('recipe_feedback_canonical_recipe_required');
  const updatedAt=nowIso();
  run(`INSERT INTO recipe_feedback_state(recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at)
    VALUES(?,?,0,NULL,?)
    ON CONFLICT(recipe_id) DO UPDATE SET recommendation_paused=excluded.recommendation_paused,updated_at=excluded.updated_at`,[
    recipe.recipe_id,paused?1:0,updatedAt,
  ]);
  await persist();
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:recipe-attempt-feedback-changed',{detail:{
    recipe_id:recipe.recipe_id,recommendation_paused:Boolean(paused),version:RECIPE_ATTEMPT_FEEDBACK_VERSION,
  }}));
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'recipe_feedback_state',recipe_id:recipe.recipe_id}}));
  return Object.freeze({recipe_id:recipe.recipe_id,recipe_name:recipe.recipe_name,recommendation_paused:Boolean(paused),updated_at:updatedAt,shared_master_write:false});
}
