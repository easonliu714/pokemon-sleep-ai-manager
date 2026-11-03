import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RECIPE_ATTEMPT_FEEDBACK_MIGRATION_VERSION,
  RECIPE_ATTEMPT_FEEDBACK_VERSION,
  buildRecipeAttemptFeedbackRecord,
  applyRecipeAttemptFeedback,
  recipeAttemptFeedbackFingerprintRows,
} from '../assets/js/recipe-attempt-feedback.js';
import {sortRecipeStrategyCandidates} from '../assets/js/recipe-strategy-projection.js';
import {projectRecipePortfolioContention} from '../assets/js/recipe-portfolio-contention.js';

const read=path=>fs.readFileSync(path,'utf8');

assert.equal(RECIPE_ATTEMPT_FEEDBACK_VERSION,'recipe-attempt-feedback-2026-10-05-a');
assert.equal(RECIPE_ATTEMPT_FEEDBACK_MIGRATION_VERSION,17,'G6.2 must use migration 17 without touching frozen 15/16');

const record=buildRecipeAttemptFeedbackRecord({
  attempt_id:'fixture-attempt-1',
  recipe_id:'fixture_recipe',
  attempted_at:'2026-10-05T14:00:00Z',
  actual_ingredients:[
    {ingredient_name:'哞哞鮮奶',quantity:5},
    {ingredient_name:'特選蘋果',quantity:3},
    {ingredient_name:'特選蘋果',quantity:2},
  ],
  source:{source_type:'reference_structured_current',source_name:'Fixture Reference',source_ref:'https://example.invalid/fixture'},
  reference_maybe_wrong:true,
  recommendation_paused:true,
  notes:'fixture only',
  created_at:'2026-10-05T14:01:00Z',
});
assert.equal(record.outcome,'DID_NOT_UNLOCK');
assert.deepEqual(record.actual_ingredients,[
  {ingredient_name:'哞哞鮮奶',quantity:5},
  {ingredient_name:'特選蘋果',quantity:5},
]);
assert.equal(record.reference_maybe_wrong,true);
assert.equal(record.recommendation_paused,true);
assert.equal(record.source.source_name,'Fixture Reference');

// Source-bound negative evidence: a mixed valid+invalid attempt previously
// dropped the invalid row and could persist an incomplete ingredient receipt.
// Writer must reject the entire attempt before any SQL/IDB call; legacy
// decodeRecipeAttemptIngredientJson remains tolerant for historical reads.
const malformedWriteInputs=[
  [{ingredient_name:'特選蘋果',quantity:2},{ingredient_name:'',quantity:3}],
  [{ingredient_name:'特選蘋果',quantity:2},{ingredient_name:'哞哞鮮奶',quantity:0}],
  [{ingredient_name:'特選蘋果',quantity:'2'}],
  [{ingredient_name:'特選蘋果',quantity:1.5}],
  [{ingredient_name:'特選蘋果',quantity:Number.NaN}],
  [{ingredient_name:'特選蘋果',quantity:Number.MAX_SAFE_INTEGER+1}],
  [null],
  'not-an-array',
];
for(const actual_ingredients of malformedWriteInputs){
  assert.throws(()=>buildRecipeAttemptFeedbackRecord({...record,actual_ingredients}),
    /recipe_attempt_actual_ingredients_invalid|recipe_attempt_actual_ingredients_required/,
    'invalid actual ingredients must fail atomically, not silently filter');
}
assert.throws(()=>buildRecipeAttemptFeedbackRecord({...record,actual_ingredients:[
  {ingredient_name:'特選蘋果',quantity:Number.MAX_SAFE_INTEGER},
  {ingredient_name:'特選蘋果',quantity:1},
]}),/recipe_attempt_actual_ingredients_overflow/,
  'duplicate normalized ingredient total must remain a safe integer');
assert.equal(buildRecipeAttemptFeedbackRecord({...record,actual_ingredients:[
  {ingredient_name:'特選蘋果',quantity:2},{ingredient_name:'特選蘋果',quantity:3},
]}).actual_ingredients[0].quantity,5,'valid duplicate ingredients still aggregate');
console.log('PASS G62_WRITE_INGREDIENT_RECEIPT_FAIL_CLOSED_PARTIAL_INVALID_OVERFLOW');

const baseCandidates=[
  {recipe_id:'paused',recipe_name:'暫停料理',candidate_status:'UNLOCK_CANDIDATE_READY',hard_constraint_status:'PASS',unlocked:false,player_record_exists:true,base_energy:999,requirements:[{ingredient_name:'特選蘋果',required:2}]},
  {recipe_id:'active',recipe_name:'可推薦料理',candidate_status:'UNLOCK_CANDIDATE_READY',hard_constraint_status:'PASS',unlocked:false,player_record_exists:true,base_energy:100,requirements:[{ingredient_name:'特選蘋果',required:2}]},
];
const overlaid=applyRecipeAttemptFeedback(baseCandidates,[
  {recipe_id:'paused',attempt_count:1,last_failure_at:'2026-10-05T14:00:00Z',recommendation_paused:1,reference_maybe_wrong:1,last_attempt_id:'fixture-attempt-1'},
]);
const paused=overlaid.find(row=>row.recipe_id==='paused');
assert.equal(paused.candidate_status,'UNLOCK_CANDIDATE_READY','feedback must not rewrite canonical readiness');
assert.equal(paused.hard_constraint_status,'PASS','feedback must not invent a hard constraint failure');
assert.equal(paused.recommendation_paused,true);
assert.equal(paused.recommendation_feedback.advisory_only,true);

// Independent G6.2 persisted-read regression: the SQLite schema has no
// CHECK(0,1) on feedback flags. Malformed nonzero/unknown values must not
// silently turn a paused/suspect recipe into a top recommendation.
const corruptFlags=applyRecipeAttemptFeedback(baseCandidates,[{
  recipe_id:'paused',attempt_count:1,recommendation_paused:2,reference_maybe_wrong:'CORRUPT',
}]);
const corruptRow=corruptFlags.find(row=>row.recipe_id==='paused');
assert.equal(corruptRow.recommendation_paused,true,'invalid pause flag must fail closed');
assert.equal(corruptRow.reference_maybe_wrong,true,'invalid review flag must fail closed');
assert.equal(sortRecipeStrategyCandidates(corruptFlags,'unlock_recipes')[0].recipe_id,'active');
const corruptPlan=projectRecipePortfolioContention({
  recipeStrategy:{input_fingerprint:'g62-corrupt-readonly',candidates:corruptFlags},
  inventory:[{ingredient_name:'特選蘋果',quantity:10}],objective:'unlock_recipes',maxMeals:1,
});
assert.equal(corruptPlan.summary.paused_feedback_count,1);
assert.equal(corruptPlan.alternatives[0].steps[0].recipe_id,'active');
const corruptUnpaused=applyRecipeAttemptFeedback(baseCandidates,[{
  recipe_id:'paused',recommendation_paused:0,reference_maybe_wrong:-1,
}]);
assert.equal(corruptUnpaused.find(row=>row.recipe_id==='paused').recommendation_paused,false);
assert.equal(corruptUnpaused.find(row=>row.recipe_id==='paused').reference_maybe_wrong,true);
assert.equal(sortRecipeStrategyCandidates(corruptUnpaused,'unlock_recipes')[0].recipe_id,'active',
  'invalid review flag cannot promote a high-energy suspect recipe');
const validZero=applyRecipeAttemptFeedback(baseCandidates,[{
  recipe_id:'paused',recommendation_paused:'0',reference_maybe_wrong:'0',
}]);
assert.equal(validZero.find(row=>row.recipe_id==='paused').recommendation_paused,false);
assert.equal(validZero.find(row=>row.recipe_id==='paused').reference_maybe_wrong,false);
assert.equal(applyRecipeAttemptFeedback(baseCandidates,[])[0].recommendation_paused,false,
  'missing feedback is not a malformed persisted flag');
const fingerprint=recipeAttemptFeedbackFingerprintRows([{
  recipe_id:'paused',recommendation_paused:2,reference_maybe_wrong:'CORRUPT',
}]);
assert.deepEqual(fingerprint[0].slice(0,5),['paused',0,null,true,true],
  'fingerprint must reflect conservative normalized flags');
console.log('PASS G62_MALFORMED_PERSISTED_FEEDBACK_FLAGS_FAIL_CLOSED_READSIDE');

const sorted=sortRecipeStrategyCandidates(overlaid,'unlock_recipes');
assert.equal(sorted[0].recipe_id,'active','paused recipe must not remain highest recommendation');

const plan=projectRecipePortfolioContention({
  recipeStrategy:{input_fingerprint:'g62-fixture',candidates:overlaid},
  inventory:[{ingredient_name:'特選蘋果',quantity:10}],
  objective:'unlock_recipes',
  maxMeals:1,
  maxAlternatives:3,
});
assert.equal(plan.projection_status,'READY');
assert.equal(plan.summary.individually_ready_count,2,'readiness truth must retain paused candidate');
assert.equal(plan.summary.recommendation_candidate_count,1);
assert.equal(plan.summary.paused_feedback_count,1);
assert.equal(plan.alternatives[0].steps[0].recipe_id,'active','paused recipe must be suppressed from executable recommendation plans');
assert.equal(plan.suppressed_by_feedback[0].recipe_id,'paused');
assert.equal(plan.public_master_write,false);
assert.equal(plan.player_data_write,false);

const resumed=applyRecipeAttemptFeedback(baseCandidates,[
  {recipe_id:'paused',attempt_count:1,last_failure_at:'2026-10-05T14:00:00Z',recommendation_paused:0,reference_maybe_wrong:1,last_attempt_id:'fixture-attempt-1'},
]);
const resumedPlan=projectRecipePortfolioContention({
  recipeStrategy:{input_fingerprint:'g62-fixture-resumed',candidates:resumed},
  inventory:[{ingredient_name:'特選蘋果',quantity:10}],
  objective:'maximize_verified_energy',
  maxMeals:1,
});
assert.equal(resumedPlan.summary.paused_feedback_count,0);
// Unpausing a suspect reference restores fallback eligibility, NOT first priority.
assert.equal(sortRecipeStrategyCandidates(resumed,'unlock_recipes')[0].recipe_id,'active',
  'strategy must rank an equally ready unflagged recipe before suspect high energy');
assert.equal(resumedPlan.alternatives[0].steps[0].recipe_id,'active',
  'portfolio must not prioritize suspect high energy over unflagged executable alternative');
assert.equal(resumedPlan.alternatives[0].suspect_reference_step_count,0);
const suspectFallback=resumedPlan.alternatives.find(item=>item.steps[0].recipe_id==='paused');
assert.ok(suspectFallback,'explicitly unpaused suspect recipe must remain a fallback plan');
assert.equal(suspectFallback.suspect_reference_step_count,1);
assert.equal(suspectFallback.steps[0].reference_maybe_wrong,true);
assert.ok(suspectFallback.warnings.includes('PLAYER_MARKED_REFERENCE_REVIEW_REQUIRED'));
const onlySuspect=applyRecipeAttemptFeedback(baseCandidates,[
  {recipe_id:'paused',recommendation_paused:0,reference_maybe_wrong:1,attempt_count:1},
  {recipe_id:'active',recommendation_paused:0,reference_maybe_wrong:1,attempt_count:1},
]);
const onlySuspectPlan=projectRecipePortfolioContention({
  recipeStrategy:{input_fingerprint:'g62-all-suspect-fixture',candidates:onlySuspect},
  inventory:[{ingredient_name:'特選蘋果',quantity:10}],objective:'maximize_verified_energy',maxMeals:1,
});
assert.equal(onlySuspectPlan.alternatives[0].steps[0].recipe_id,'paused',
  'all-suspect pool may still offer an explicitly warned fallback');
assert.ok(onlySuspectPlan.alternatives[0].warnings.includes('PLAYER_MARKED_REFERENCE_REVIEW_REQUIRED'));
const reviewOnly=[{...resumed.find(row=>row.recipe_id==='active'),candidate_status:'REVIEW_PROVENANCE',hard_constraint_status:'REVIEW'},
  resumed.find(row=>row.recipe_id==='paused')];
assert.equal(sortRecipeStrategyCandidates(reviewOnly,'unlock_recipes')[0].recipe_id,'paused',
  'unverified unflagged candidate cannot outrank an executable suspect fallback');

const schema=read('assets/js/schema.js');
const migrations=read('assets/js/migrations.js');
const local=read('assets/js/recipe-attempt-feedback-local.js');
const ui=read('assets/js/recipe-attempt-feedback-ui.js');
const sw=read('service-worker.js');
const version=read('assets/js/version-authority.js');

for(const token of ['CREATE TABLE IF NOT EXISTS recipe_attempt_feedback','CREATE TABLE IF NOT EXISTS recipe_feedback_state'])assert.ok(schema.includes(token),`G6.2 schema missing ${token}`);
assert.ok(migrations.includes('RECIPE_ATTEMPT_FEEDBACK_MIGRATION_VERSION'),'migration lifecycle missing G6.2 authority');
assert.ok(migrations.includes('applyRecipeAttemptFeedbackSchemaMigration'),'migration lifecycle missing G6.2 apply');
for(const token of ['INSERT INTO recipe_attempt_feedback','INSERT INTO recipe_feedback_state','recipe_master WHERE recipe_id=?','ingredient_master'])assert.ok(local.includes(token),`G6.2 local store missing ${token}`);
for(const forbidden of ['INSERT INTO recipe_master','UPDATE recipe_master','DELETE FROM recipe_master','INSERT INTO recipe_master_ingredients','UPDATE recipe_master_ingredients','DELETE FROM recipe_master_ingredients'])assert.equal(local.includes(forbidden),false,`player feedback crossed Public Recipe Master boundary: ${forbidden}`);
for(const token of ['本次嘗試未開啟','參考配方可能錯誤','暫停推薦此配方','不會修改 Public Recipe Master','查證提示'])assert.ok(ui.includes(token),`G6.2 UI marker missing: ${token}`);
for(const asset of ['recipe-attempt-feedback.js','recipe-attempt-feedback-local.js','recipe-attempt-feedback-ui.js'])assert.ok(sw.includes(asset),`G6.2 offline precache missing ${asset}`);
assert.ok(version.includes("app_version: 'v0.4.27.55.3.3.19'"),'G6.2 release authority must be .19');
assert.ok(version.includes("// app_version: 'v0.4.27.55.3.3.18'"),'G6.2 successor must retain exact .18 predecessor marker');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G6_2_RECIPE_ATTEMPT_FEEDBACK',
  version:RECIPE_ATTEMPT_FEEDBACK_VERSION,
  migration_version:RECIPE_ATTEMPT_FEEDBACK_MIGRATION_VERSION,
  failed_attempt_recorded:true,
  actual_ingredient_combination_recorded:true,
  source_recorded:true,
  reference_maybe_wrong_supported:true,
  recommendation_pause_supported:true,
  paused_recipe_suppressed_from_recommendations:true,
  resume_restores_recommendation:true,
  canonical_readiness_mutated:false,
  public_recipe_master_write:false,
  local_history_only:true,
  offline_precache:true,
},null,2));
