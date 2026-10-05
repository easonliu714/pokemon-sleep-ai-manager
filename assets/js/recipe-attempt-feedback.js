export const RECIPE_ATTEMPT_FEEDBACK_VERSION='recipe-attempt-feedback-2026-10-05-a';
export const RECIPE_ATTEMPT_FEEDBACK_MIGRATION_VERSION=17;
export const RECIPE_ATTEMPT_OUTCOME=Object.freeze({
  DID_NOT_UNLOCK:'DID_NOT_UNLOCK',
});

const clean=value=>String(value??'').normalize('NFKC').trim();
const hasOwn=(value,key)=>Object.prototype.hasOwnProperty.call(value||{},key);
const nonNegativeInteger=value=>Number.isInteger(Number(value))&&Number(value)>=0;
const positiveInteger=value=>Number.isInteger(Number(value))&&Number(value)>0;
const safeJson=value=>{try{return JSON.parse(value);}catch{return null;}};

export function normalizeRecipeAttemptIngredients(input=[]){
  const byName=new Map();
  for(const item of input||[]){
    const ingredient_name=clean(item?.ingredient_name);
    const quantity=Number(item?.quantity);
    if(!ingredient_name||!positiveInteger(quantity))continue;
    byName.set(ingredient_name,(byName.get(ingredient_name)||0)+quantity);
  }
  return Object.freeze([...byName.entries()]
    .sort(([a],[b])=>a.localeCompare(b,'zh-Hant'))
    .map(([ingredient_name,quantity])=>Object.freeze({ingredient_name,quantity})));
}

export function normalizeRecipeAttemptSource(input={}){
  const source_type=clean(input?.source_type)||'PLAYER_REPORTED_REFERENCE';
  const source_name=clean(input?.source_name)||null;
  const source_ref=clean(input?.source_ref)||null;
  return Object.freeze({source_type,source_name,source_ref});
}

export function buildRecipeAttemptFeedbackRecord({
  attempt_id,
  recipe_id,
  attempted_at,
  actual_ingredients=[],
  source={},
  reference_maybe_wrong=false,
  recommendation_paused=true,
  notes='',
  created_at,
}={}){
  const id=clean(attempt_id),recipeId=clean(recipe_id),attemptedAt=clean(attempted_at),createdAt=clean(created_at)||attemptedAt;
  if(!id)throw new Error('recipe_attempt_id_required');
  if(!recipeId)throw new Error('recipe_attempt_recipe_id_required');
  const attemptedMs=Date.parse(attemptedAt);
  if(!Number.isFinite(attemptedMs))throw new Error('recipe_attempt_time_invalid');
  const ingredients=normalizeRecipeAttemptIngredients(actual_ingredients);
  if(!ingredients.length)throw new Error('recipe_attempt_actual_ingredients_required');
  return Object.freeze({
    attempt_id:id,
    recipe_id:recipeId,
    attempted_at:new Date(attemptedMs).toISOString(),
    outcome:RECIPE_ATTEMPT_OUTCOME.DID_NOT_UNLOCK,
    actual_ingredients:ingredients,
    source:normalizeRecipeAttemptSource(source),
    reference_maybe_wrong:Boolean(reference_maybe_wrong),
    recommendation_paused:Boolean(recommendation_paused),
    notes:clean(notes)||null,
    created_at:Number.isFinite(Date.parse(createdAt))?new Date(Date.parse(createdAt)).toISOString():new Date(attemptedMs).toISOString(),
  });
}

function normalizeFeedbackRow(row={}){
  return Object.freeze({
    recipe_id:clean(row.recipe_id),
    attempt_count:nonNegativeInteger(row.attempt_count)?Number(row.attempt_count):0,
    last_failure_at:clean(row.last_failure_at)||null,
    recommendation_paused:Number(row.recommendation_paused||0)===1||row.recommendation_paused===true,
    reference_maybe_wrong:Number(row.reference_maybe_wrong||0)===1||row.reference_maybe_wrong===true,
    last_attempt_id:clean(row.last_attempt_id)||null,
    source_type:clean(row.source_type)||null,
    source_name:clean(row.source_name)||null,
    source_ref:clean(row.source_ref)||null,
    updated_at:clean(row.updated_at)||null,
  });
}

export function applyRecipeAttemptFeedback(candidates=[],feedbackRows=[]){
  const feedbackMap=new Map((feedbackRows||[]).map(row=>{
    const normalized=normalizeFeedbackRow(row);
    return [normalized.recipe_id,normalized];
  }).filter(([id])=>id));
  return (candidates||[]).map(candidate=>{
    const feedback=feedbackMap.get(clean(candidate?.recipe_id))||normalizeFeedbackRow({recipe_id:candidate?.recipe_id});
    return Object.freeze({
      ...candidate,
      recommendation_paused:feedback.recommendation_paused,
      attempt_feedback_count:feedback.attempt_count,
      last_attempt_failed_at:feedback.last_failure_at,
      reference_maybe_wrong:feedback.reference_maybe_wrong,
      recommendation_feedback:Object.freeze({
        advisory_only:true,
        canonical_status_unchanged:true,
        ...feedback,
      }),
    });
  });
}

export function recipeAttemptFeedbackFingerprintRows(feedbackRows=[]){
  return (feedbackRows||[]).map(normalizeFeedbackRow)
    .filter(row=>row.recipe_id)
    .sort((a,b)=>a.recipe_id.localeCompare(b.recipe_id))
    .map(row=>[
      row.recipe_id,
      row.attempt_count,
      row.last_failure_at,
      row.recommendation_paused,
      row.reference_maybe_wrong,
      row.last_attempt_id,
      row.source_type,
      row.source_name,
      row.source_ref,
      row.updated_at,
    ]);
}

export function decodeRecipeAttemptIngredientJson(value){
  const parsed=Array.isArray(value)?value:safeJson(value);
  return normalizeRecipeAttemptIngredients(Array.isArray(parsed)?parsed:[]);
}

export function applyRecipeAttemptFeedbackSchema(db){
  db.run(`CREATE TABLE IF NOT EXISTS recipe_attempt_feedback(
    attempt_id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    attempted_at TEXT NOT NULL,
    outcome TEXT NOT NULL,
    actual_ingredients_json TEXT NOT NULL DEFAULT '[]',
    source_type TEXT NOT NULL,
    source_name TEXT,
    source_ref TEXT,
    reference_maybe_wrong INTEGER NOT NULL DEFAULT 0,
    recommendation_paused_after_attempt INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_recipe_attempt_feedback_recipe_time ON recipe_attempt_feedback(recipe_id,attempted_at,attempt_id)');
  db.run(`CREATE TABLE IF NOT EXISTS recipe_feedback_state(
    recipe_id TEXT PRIMARY KEY,
    recommendation_paused INTEGER NOT NULL DEFAULT 0,
    reference_maybe_wrong INTEGER NOT NULL DEFAULT 0,
    last_attempt_id TEXT,
    updated_at TEXT NOT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_recipe_feedback_state_paused ON recipe_feedback_state(recommendation_paused,updated_at)');
}

export function applyRecipeAttemptFeedbackSchemaMigration(db){
  applyRecipeAttemptFeedbackSchema(db);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at)
    VALUES(${RECIPE_ATTEMPT_FEEDBACK_MIGRATION_VERSION},datetime('now'))`);
  return Object.freeze({migration_version:RECIPE_ATTEMPT_FEEDBACK_MIGRATION_VERSION});
}
