import {
  projectRecipeStrategy,
  RECIPE_STRATEGY_ENGINE_VERSION,
} from '../assets/js/recipe-strategy-projection.js';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-master.js';
import {PUBLIC_RECIPE_MASTER as CURRENT_PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-current-authority.js';
import {
  PUBLIC_RECIPE_PROVENANCE,
  PUBLIC_RECIPE_PROVENANCE_VERSION,
  PUBLIC_RECIPE_UPCOMING_EVIDENCE,
} from '../assets/js/public-recipe-provenance.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const byName=name=>{
  const row=PUBLIC_RECIPE_MASTER.find(item=>item.recipe_name===name);
  assert(row,`missing_fixture_recipe:${name}`);
  return row;
};
const relations=recipes=>recipes.flatMap(recipe=>recipe.ingredients.map(item=>({
  recipe_id:recipe.recipe_id,
  ingredient_name:item.ingredient_name,
  quantity:item.quantity,
})));
const states=(recipes,unlocked=false)=>recipes.map(recipe=>({
  recipe_id:recipe.recipe_id,
  unlocked:unlocked?1:0,
  player_record_exists:1,
  player_recipe_id:`player:${recipe.recipe_id}`,
}));
const get=(result,name)=>{
  const row=result.candidates.find(item=>item.recipe_name===name);
  assert(row,`candidate_missing:${name}`);
  return row;
};
const run=overrides=>projectRecipeStrategy({
  recipes:[byName('特選蘋果咖哩')],
  recipeIngredients:relations([byName('特選蘋果咖哩')]),
  recipeStates:states([byName('特選蘋果咖哩')],false),
  inventory:[{ingredient_name:'特選蘋果',quantity:7}],
  provenance:PUBLIC_RECIPE_PROVENANCE,
  ingredientSafeReserve:{},
  potSize:20,
  requireVerifiedMaster:true,
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
  ...overrides,
});

assert(RECIPE_STRATEGY_ENGINE_VERSION==='recipe-strategy-2026-08-09-a','unexpected_engine_version');

const unlockReady=run({});
assert(get(unlockReady,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_READY','unlock_ready_status');
assert(get(unlockReady,'特選蘋果咖哩').hard_constraint_status==='PASS','unlock_ready_hard_status');
assert(get(unlockReady,'特選蘋果咖哩').total_strategy_shortage===0,'unlock_ready_shortage');
assert(get(unlockReady,'特選蘋果咖哩').pot_fit===true,'unlock_ready_pot');

// G6.2 negative-first: a local recipe-master formula can drift while the
// advertised master version stays unchanged (stale/corrupt read-side SQLite).
// Distinct ingredient identities and provenance must invalidate a strategy
// evidence fingerprint even when the candidate recipe ID is unchanged.
const formulaDrift=run({recipeIngredients:[{
  recipe_id:byName('特選蘋果咖哩').recipe_id,
  ingredient_name:'豆製肉',quantity:7,
}]});
assert(get(formulaDrift,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_NEAR',
  'strategy_formula_drift_control_must_change_readiness');
assert(formulaDrift.input_fingerprint!==unlockReady.input_fingerprint,
  'strategy_formula_drift_must_invalidate_fingerprint');

// G6.2 independent canonical-source parity negative: a same-total local
// recipe_master_ingredients substitution is still internally self-consistent,
// but the static VERIFIED provenance belongs to the immutable public formula.
// The local read-side must HOLD instead of advising a different ingredient.
const canonicalApple=CURRENT_PUBLIC_RECIPE_MASTER.find(row=>row.recipe_id===byName('特選蘋果咖哩').recipe_id);
assert(canonicalApple&&canonicalApple.ingredients.length===1,'canonical_parity_fixture_required');
const canonicalInput={
  recipes:[canonicalApple],
  recipeIngredients:relations([canonicalApple]),
  recipeStates:states([canonicalApple],false),
  inventory:[{ingredient_name:'特選蘋果',quantity:7},{ingredient_name:'豆製肉',quantity:7}],
  provenance:PUBLIC_RECIPE_PROVENANCE,
  authoritativeRecipes:CURRENT_PUBLIC_RECIPE_MASTER,
  potSize:20,requireVerifiedMaster:true,
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
};
const canonicalNormal=projectRecipeStrategy(canonicalInput);
assert(canonicalNormal.candidates[0].candidate_status==='UNLOCK_CANDIDATE_READY',
  'strategy_canonical_formula_positive_control');

// G6.2 independent immutable energy authority: local SQLite recipe_master
// can retain a verified formula but drift in base_energy. Energy is the final
// tie-breaker for actionable recipe recommendations, so unverified local
// energy must not inherit the canonical formula's trusted provenance.
assert(Number.isSafeInteger(canonicalApple.base_energy)&&canonicalApple.base_energy>0,
  'strategy_canonical_energy_fixture_requires_verified_value');
const canonicalEnergyDrift=projectRecipeStrategy({
  ...canonicalInput,
  recipes:[{...canonicalApple,base_energy:canonicalApple.base_energy+100000}],
});
assert(canonicalEnergyDrift.candidates[0].candidate_status==='REVIEW_MISSING_INPUT',
  'strategy_canonical_energy_drift_must_hold');
assert(canonicalEnergyDrift.candidates[0].hard_constraint_status==='REVIEW',
  'strategy_canonical_energy_drift_must_not_be_actionable');
assert(canonicalEnergyDrift.candidates[0].missing_inputs.includes('recipe_master_authority'),
  'strategy_canonical_energy_drift_authority_reason');
assert(canonicalEnergyDrift.input_fingerprint!==canonicalNormal.input_fingerprint,
  'strategy_canonical_energy_drift_fingerprint_must_change');

// G6.2 independent canonical-authority fingerprint regression: the immutable
// authority itself may change without a version bump while local SQLite stays
// byte-for-byte unchanged. #823 rejects the now-stale local energy as REVIEW,
// but the evidence fingerprint must also change across that source drift.
const changedCanonicalEnergy=projectRecipeStrategy({
  ...canonicalInput,
  authoritativeRecipes:CURRENT_PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id===canonicalApple.recipe_id
    ?{...row,base_energy:row.base_energy+1}:row),
});
assert(changedCanonicalEnergy.candidates[0].candidate_status==='REVIEW_MISSING_INPUT',
  'strategy_canonical_authority_energy_drift_control_must_hold');
assert(changedCanonicalEnergy.candidates[0].missing_inputs.includes('recipe_master_authority'),
  'strategy_canonical_authority_energy_drift_reason');
assert(changedCanonicalEnergy.input_fingerprint!==canonicalNormal.input_fingerprint,
  'strategy_canonical_authority_energy_drift_must_invalidate_fingerprint');


const canonicalSubstituted=projectRecipeStrategy({...canonicalInput,recipeIngredients:[{
  recipe_id:canonicalApple.recipe_id,ingredient_name:'豆製肉',quantity:7,
}]});
assert(canonicalSubstituted.candidates[0].candidate_status==='REVIEW_MISSING_INPUT',
  'strategy_canonical_formula_substitution_must_hold');
assert(canonicalSubstituted.candidates[0].missing_inputs.includes('recipe_master_authority'),
  'strategy_canonical_formula_substitution_reason_missing');
assert(canonicalSubstituted.input_fingerprint!==canonicalNormal.input_fingerprint,
  'strategy_canonical_formula_drift_fingerprint_must_change');

// G6.2 negative-first: a malformed local recipe_master.total_ingredients
// (SQLite REAL) is already REVIEW, but its truncated display pot_required
// must not alias the verified integer formula's evidence fingerprint.
// The immutable canonical authority and declared master version are identical.
const fractionalCanonicalTotal=projectRecipeStrategy({
  ...canonicalInput,
  recipes:[{...canonicalApple,total_ingredients:7.5}],
});
assert(fractionalCanonicalTotal.candidates[0].candidate_status==='REVIEW_MISSING_INPUT',
  'strategy_fractional_master_total_control_must_hold');
assert(fractionalCanonicalTotal.candidates[0].missing_inputs.includes('recipe_master_authority'),
  'strategy_fractional_master_total_authority_reason');
assert(fractionalCanonicalTotal.input_fingerprint!==canonicalNormal.input_fingerprint,
  'strategy_fractional_master_total_must_invalidate_fingerprint');
const secondFractionalTotal=projectRecipeStrategy({
  ...canonicalInput,
  recipes:[{...canonicalApple,total_ingredients:7.25}],
});
assert(secondFractionalTotal.candidates[0].candidate_status==='REVIEW_MISSING_INPUT',
  'strategy_second_fractional_total_control_must_hold');
assert(secondFractionalTotal.input_fingerprint!==fractionalCanonicalTotal.input_fingerprint,
  'strategy_distinct_fractional_master_totals_must_not_alias');


// G6.2 independent strategy consumer: incomplete formula rows must not
// masquerade as an executable UNLOCK_CANDIDATE_READY recommendation.
// The legacy weekly badges have a separate guard; this is the strategy path.
const missingAllRequirements=run({recipeIngredients:[]});
assert(get(missingAllRequirements,'特選蘋果咖哩').candidate_status==='REVIEW_MISSING_INPUT','strategy_missing_all_recipe_ingredients_must_hold');
assert(get(missingAllRequirements,'特選蘋果咖哩').hard_constraint_status==='REVIEW','strategy_missing_all_recipe_ingredients_must_not_pass');
const partialRecipe=byName('忍者咖哩');
const partialIngredients=relations([partialRecipe]);
assert(partialIngredients.length>1,'fixture_requires_multi_ingredient_recipe');
const partialDemand=run({
  recipes:[partialRecipe],
  recipeIngredients:partialIngredients.slice(1),
  inventory:partialIngredients.map(item=>({ingredient_name:item.ingredient_name,quantity:999})),
  potSize:100,
});
assert(get(partialDemand,'忍者咖哩').candidate_status==='REVIEW_MISSING_INPUT','strategy_partial_recipe_ingredient_demand_must_hold');
assert(get(partialDemand,'忍者咖哩').missing_inputs.includes('recipe_ingredient_requirements'),'strategy_partial_demand_must_explain_hold');
// G6.2 independent strategy consumer: the recipe ingredient table has no
// canonical-name FK. A noncanonical ingredient with matching quantity/total
// must never be actionable, even when a synthetic inventory row covers it.
// This is NOT the legacy weekly badge consumer already guarded in #808.
const unknownDemand=run({
  recipeIngredients:[{
    recipe_id:byName('特選蘋果咖哩').recipe_id,
    ingredient_name:'UNKNOWN_SYNTHETIC_INGREDIENT',
    quantity:7,
  }],
  inventory:[{ingredient_name:'UNKNOWN_SYNTHETIC_INGREDIENT',quantity:7}],
});
assert(get(unknownDemand,'特選蘋果咖哩').candidate_status==='REVIEW_MISSING_INPUT','strategy_unknown_ingredient_identity_must_hold');
assert(get(unknownDemand,'特選蘋果咖哩').hard_constraint_status==='REVIEW','strategy_unknown_ingredient_identity_must_not_pass');
assert(get(unknownDemand,'特選蘋果咖哩').missing_inputs.includes('recipe_ingredient_requirements'),'strategy_unknown_ingredient_identity_reason_missing');

const missingTotal=run({recipes:[{...byName('特選蘋果咖哩'),total_ingredients:null}]});
assert(get(missingTotal,'特選蘋果咖哩').candidate_status==='REVIEW_MISSING_INPUT','strategy_unknown_recipe_total_must_hold');

// G6.2 negative-first: SQLite INTEGER affinity does not prevent a malformed
// fractional recipe_master_ingredients row. Truncating 1.5 to 1 can make an
// otherwise matching trusted total look executable. This is distinct from
// the legacy weekly badge fixture and fractional observed stock protection.
for(const malformedDemand of [1.5,'1.5']){
  const recipe=byName('特選蘋果咖哩');
  const invalidDemand=run({
    recipes:[{...recipe,total_ingredients:1}],
    recipeIngredients:[{recipe_id:recipe.recipe_id,ingredient_name:'特選蘋果',quantity:malformedDemand}],
  });
  assert(get(invalidDemand,'特選蘋果咖哩').candidate_status==='REVIEW_MISSING_INPUT',
    'strategy_fractional_recipe_demand_must_hold');
  assert(get(invalidDemand,'特選蘋果咖哩').hard_constraint_status==='REVIEW',
    'strategy_fractional_recipe_demand_must_not_pass');
  assert(get(invalidDemand,'特選蘋果咖哩').missing_inputs.includes('recipe_ingredient_requirements'),
    'strategy_fractional_recipe_demand_reason_missing');
}
const integerTextDemand=run({
  recipeIngredients:[{recipe_id:byName('特選蘋果咖哩').recipe_id,ingredient_name:'特選蘋果',quantity:'7'}],
});
assert(get(integerTextDemand,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_READY',
  'strategy_canonical_integer_text_recipe_demand_remains_compatible');


// G6.2 independent strategy read-side negative: SQLite has dynamic typing, so a
// malformed REAL/text stock quantity may be observed despite INTEGER affinity.
// Truncating 7.5 to 7 must not certify an actionable cooking recommendation.
for(const invalidQuantity of [7.5,'7.5']){
  const invalidStock=run({inventory:[{ingredient_name:'特選蘋果',quantity:invalidQuantity}]});
  assert(get(invalidStock,'特選蘋果咖哩').candidate_status==='REVIEW_MISSING_INPUT',
    'strategy_fractional_stock_must_hold');
  assert(get(invalidStock,'特選蘋果咖哩').hard_constraint_status==='REVIEW',
    'strategy_fractional_stock_must_not_pass');
  assert(get(invalidStock,'特選蘋果咖哩').missing_inputs.includes('ingredient_inventory'),
    'strategy_fractional_stock_reason_missing');
}
const unrelatedInvalidStock=run({inventory:[
  {ingredient_name:'特選蘋果',quantity:7},
  {ingredient_name:'豆製肉',quantity:1.5},
]});
assert(get(unrelatedInvalidStock,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_READY',
  'strategy_unrelated_invalid_stock_must_not_suppress_verified_recipe');
const sqliteIntegerTextStock=run({inventory:[{ingredient_name:'特選蘋果',quantity:'7'}]});
assert(get(sqliteIntegerTextStock,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_READY',
  'strategy_integer_text_stock_remains_compatible');

// G6.2 independent player-unlock read-side authority: SQLite INTEGER affinity
// does not constrain legacy/corrupt values to 0/1. The unified workbench
// already rejects noncanonical flags; strategy must not recommend an unlock
// when a present player's unlock flag is invalid (2/-1/TEXT).
for(const invalidUnlock of [2,-1,'INVALID_UNLOCK']){
  const invalid=run({recipeStates:[{
    recipe_id:byName('特選蘋果咖哩').recipe_id,
    unlocked:invalidUnlock,player_record_exists:1,
    player_recipe_id:'player:invalid-unlock',
  }]});
  const row=get(invalid,'特選蘋果咖哩');
  assert(row.candidate_status==='REVIEW_MISSING_INPUT','strategy_invalid_player_unlock_must_hold');
  assert(row.hard_constraint_status==='REVIEW','strategy_invalid_player_unlock_must_not_pass');
  assert(row.missing_inputs.includes('recipe_unlock_state'),'strategy_invalid_player_unlock_reason_missing');
  const canonicalLocked=run({recipeStates:[{
    recipe_id:byName('特選蘋果咖哩').recipe_id,
    unlocked:0,player_record_exists:1,
    player_recipe_id:'player:invalid-unlock',
  }]});
  assert(invalid.input_fingerprint!==canonicalLocked.input_fingerprint,
    'strategy_invalid_unlock_must_not_alias_canonical_locked_fingerprint');
}
const canonicalTextUnlock=run({recipeStates:[{
  recipe_id:byName('特選蘋果咖哩').recipe_id,
  unlocked:'1',player_record_exists:1,player_recipe_id:'player:canonical-text',
}]});
assert(get(canonicalTextUnlock,'特選蘋果咖哩').candidate_status==='COOK_NOW_UNLOCKED',
  'strategy_canonical_text_unlock_remains_compatible');

const cookNow=run({recipeStates:states([byName('特選蘋果咖哩')],true)});
assert(get(cookNow,'特選蘋果咖哩').candidate_status==='COOK_NOW_UNLOCKED','cook_now_status');
assert(get(cookNow,'特選蘋果咖哩').hard_constraint_status==='PASS','cook_now_hard_status');

const near=run({inventory:[{ingredient_name:'特選蘋果',quantity:3}]});
assert(get(near,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_NEAR','near_unlock_status');
assert(get(near,'特選蘋果咖哩').total_raw_shortage===4,'near_raw_shortage');
assert(get(near,'特選蘋果咖哩').hard_constraint_status==='FAIL','near_hard_status');

const reserve=run({ingredientSafeReserve:{'特選蘋果':2}});
const reserveRow=get(reserve,'特選蘋果咖哩');
assert(reserveRow.candidate_status==='BLOCKED_SAFE_RESERVE','reserve_status');
assert(reserveRow.total_raw_shortage===0,'reserve_raw_shortage_should_be_zero');
assert(reserveRow.total_strategy_shortage===2,'reserve_strategy_shortage');
assert(reserveRow.requirements[0].owned===7&&reserveRow.requirements[0].usable===5,'reserve_owned_usable');
assert(reserveRow.failed_constraints.includes('ingredient_safe_reserve'),'reserve_failed_constraint');

// G6.2 distinct persisted goal-policy authority: an invalid safe reserve
// must not be truncated/clamped to zero and silently certify a cookable recipe.
// This is independent of observed stock (#812) and recipe demand (#813).
for(const invalidReserve of [0.5,'0.5',-1]){
  const invalid=run({ingredientSafeReserve:{'特選蘋果':invalidReserve}});
  const row=get(invalid,'特選蘋果咖哩');
  assert(row.candidate_status==='REVIEW_MISSING_INPUT','strategy_invalid_safe_reserve_must_hold');
  assert(row.hard_constraint_status==='REVIEW','strategy_invalid_safe_reserve_must_not_pass');
  assert(row.missing_inputs.includes('ingredient_safe_reserve'),'strategy_invalid_safe_reserve_reason_missing');
}
const unrelatedReserve=run({ingredientSafeReserve:{'特選蘋果':0,'豆製肉':0.5}});
assert(get(unrelatedReserve,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_READY',
  'unrelated invalid reserve must not suppress a verified recipe');

// G6.2 independent pot-capacity read-side authority: a malformed weekly
// capacity (REAL/TEXT fractional or negative) must not be rounded into an
// actionable seven-ingredient recipe. This is distinct from recipe demand,
// observed stock, safe reserve and unlock-state admission.
for(const invalidPot of [7.5,'7.5',-7,'INVALID_POT']){
  const invalid=run({potSize:invalidPot});
  const row=get(invalid,'特選蘋果咖哩');
  assert(row.candidate_status==='REVIEW_MISSING_INPUT','strategy_invalid_pot_capacity_must_hold');
  assert(row.hard_constraint_status==='REVIEW','strategy_invalid_pot_capacity_must_not_pass');
  assert(row.missing_inputs.includes('pot_size'),'strategy_invalid_pot_capacity_reason_missing');
}
const canonicalTextPot=run({potSize:'7'});
assert(get(canonicalTextPot,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_READY',
  'strategy_canonical_text_pot_capacity_remains_compatible');

const potBlocked=run({potSize:5});
assert(get(potBlocked,'特選蘋果咖哩').candidate_status==='BLOCKED_POT_CAPACITY','pot_blocked_status');
assert(get(potBlocked,'特選蘋果咖哩').failed_constraints.includes('pot_capacity_limit'),'pot_constraint_missing');

const potUnknown=run({potSize:null});
assert(get(potUnknown,'特選蘋果咖哩').candidate_status==='REVIEW_MISSING_INPUT','pot_unknown_status');
assert(get(potUnknown,'特選蘋果咖哩').pot_fit===null,'pot_unknown_fit');
assert(get(potUnknown,'特選蘋果咖哩').missing_inputs.includes('pot_size'),'pot_missing_input_not_reported');

const farRecipe=byName('忍者咖哩');
const far=projectRecipeStrategy({
  recipes:[farRecipe],
  recipeIngredients:relations([farRecipe]),
  recipeStates:states([farRecipe],false),
  inventory:[],
  provenance:PUBLIC_RECIPE_PROVENANCE,
  potSize:100,
  requireVerifiedMaster:true,
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
});
assert(get(far,'忍者咖哩').candidate_status==='BLOCKED_INGREDIENT_SHORTAGE','far_shortage_status');
assert(get(far,'忍者咖哩').total_raw_shortage===50,'far_shortage_total');

const unverifiedProvenance=PUBLIC_RECIPE_PROVENANCE.map(row=>row.recipe_id===byName('特選蘋果咖哩').recipe_id?{
  ...row,formula_evidence:'REVIEW_REQUIRED',overall_status:'REVIEW_REQUIRED',
}:row);
const provenanceReview=run({provenance:unverifiedProvenance});
assert(get(provenanceReview,'特選蘋果咖哩').candidate_status==='REVIEW_PROVENANCE','provenance_review_status');
assert(get(provenanceReview,'特選蘋果咖哩').failed_constraints.includes('require_verified_master'),'provenance_constraint_missing');
assert(provenanceReview.input_fingerprint!==unlockReady.input_fingerprint,
  'strategy_provenance_drift_must_invalidate_fingerprint');

const active=byName('特選蘋果咖哩');
const fakeUpcoming={
  recipe_id:'fixture_upcoming_recipe',category:'咖哩／濃湯',recipe_name:'UPCOMING FIXTURE',base_energy:null,total_ingredients:1,
  ingredients:[{ingredient_name:'特選蘋果',quantity:1}],
};
const upcomingProvenance={
  recipe_id:fakeUpcoming.recipe_id,recipe_name_zh_tw:null,category:'咖哩／濃湯',lifecycle:'UPCOMING_REFERENCE_DISCOVERED',
  formula_evidence:'REFERENCE_VERIFIED_PRE_RELEASE',overall_status:'UPCOMING_REFERENCE_DISCOVERED',
};
const upcomingExcluded=projectRecipeStrategy({
  recipes:[active,fakeUpcoming],
  recipeIngredients:relations([active,fakeUpcoming]),
  recipeStates:states([active,fakeUpcoming],false),
  inventory:[{ingredient_name:'特選蘋果',quantity:99}],
  provenance:[...PUBLIC_RECIPE_PROVENANCE,upcomingProvenance],
  potSize:100,
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
});
assert(upcomingExcluded.candidates.length===1,'upcoming_entered_candidate_list');
assert(upcomingExcluded.excluded.non_active_provenance.includes(fakeUpcoming.recipe_id),'upcoming_exclusion_not_reported');
assert(!upcomingExcluded.candidates.some(row=>row.recipe_name==='UPCOMING FIXTURE'),'upcoming_runtime_leak');
assert(PUBLIC_RECIPE_UPCOMING_EVIDENCE.length===2,'real_upcoming_evidence_fixture_changed');

// G6.2 negative-first: stockpile ranking must not promote a formula-unknown
// REVIEW candidate above a verified near-ready recipe merely because the
// missing formula misleadingly produces zero computed shortage. This is a
// distinct no-waste ranking guard, not the sort-mode fingerprint fix.
const stockpileReview=projectRecipeStrategy({
  recipes:[byName('特選蘋果咖哩'),byName('忍者咖哩')],
  recipeIngredients:relations([byName('特選蘋果咖哩')]),
  recipeStates:states([byName('特選蘋果咖哩'),byName('忍者咖哩')],false),
  inventory:[{ingredient_name:'特選蘋果',quantity:3}],
  provenance:PUBLIC_RECIPE_PROVENANCE,
  potSize:100,
  requireVerifiedMaster:true,
  sortMode:'ingredient_stockpile',
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
});
assert(get(stockpileReview,'忍者咖哩').candidate_status==='REVIEW_MISSING_INPUT',
  'stockpile_review_control_missing_formula');
assert(get(stockpileReview,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_NEAR',
  'stockpile_review_control_verified_near');
assert(stockpileReview.candidates[0].recipe_name==='特選蘋果咖哩',
  'strategy_review_must_not_lead_stockpile');

// G6.2 independent no-waste negative: a player-marked suspect formula that is
// merely READY-to-unlock must not outrank a verified, unflagged COOK_NOW recipe.
// Existing equal-status feedback tests do not cover this cross-status priority.
const suspectApple=byName('特選蘋果咖哩');
const trustedNinja=byName('忍者咖哩');
const suspectCrossStatus=projectRecipeStrategy({
  recipes:[suspectApple,trustedNinja],
  recipeIngredients:relations([suspectApple,trustedNinja]),
  recipeStates:[
    {recipe_id:suspectApple.recipe_id,unlocked:0,player_record_exists:1},
    {recipe_id:trustedNinja.recipe_id,unlocked:1,player_record_exists:1},
  ],
  inventory:relations([suspectApple,trustedNinja]).map(item=>({ingredient_name:item.ingredient_name,quantity:999})),
  provenance:PUBLIC_RECIPE_PROVENANCE,
  recipeFeedback:[{recipe_id:suspectApple.recipe_id,recommendation_paused:0,reference_maybe_wrong:1}],
  potSize:100,
  requireVerifiedMaster:true,
  sortMode:'unlock_recipes',
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
});
assert(get(suspectCrossStatus,'特選蘋果咖哩').candidate_status==='UNLOCK_CANDIDATE_READY',
  'suspect_cross_status_control_ready');
assert(get(suspectCrossStatus,'忍者咖哩').candidate_status==='COOK_NOW_UNLOCKED',
  'suspect_cross_status_control_cook_now');
assert(suspectCrossStatus.candidates[0].recipe_id===trustedNinja.recipe_id,
  'strategy_suspect_cross_status_must_not_lead');

const orderA=projectRecipeStrategy({
  recipes:[byName('忍者咖哩'),byName('特選蘋果咖哩')],
  recipeIngredients:relations([byName('忍者咖哩'),byName('特選蘋果咖哩')]),
  recipeStates:states([byName('忍者咖哩'),byName('特選蘋果咖哩')],false),
  inventory:[{ingredient_name:'特選蘋果',quantity:7},{ingredient_name:'萌綠大豆',quantity:24},{ingredient_name:'豆製肉',quantity:9},{ingredient_name:'粗枝大蔥',quantity:12},{ingredient_name:'品鮮蘑菇',quantity:5}],
  provenance:PUBLIC_RECIPE_PROVENANCE,
  ingredientSafeReserve:{'豆製肉':1,'特選蘋果':0},
  potSize:100,
  requireVerifiedMaster:true,
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
});
const orderB=projectRecipeStrategy({
  recipes:[byName('特選蘋果咖哩'),byName('忍者咖哩')],
  recipeIngredients:[...relations([byName('特選蘋果咖哩'),byName('忍者咖哩')])].reverse(),
  recipeStates:[...states([byName('特選蘋果咖哩'),byName('忍者咖哩')],false)].reverse(),
  inventory:[{ingredient_name:'品鮮蘑菇',quantity:5},{ingredient_name:'粗枝大蔥',quantity:12},{ingredient_name:'豆製肉',quantity:9},{ingredient_name:'萌綠大豆',quantity:24},{ingredient_name:'特選蘋果',quantity:7}],
  provenance:[...PUBLIC_RECIPE_PROVENANCE].reverse(),
  ingredientSafeReserve:{'特選蘋果':0,'豆製肉':1},
  potSize:100,
  requireVerifiedMaster:true,
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
});
assert(orderA.input_fingerprint===orderB.input_fingerprint,'fingerprint_depends_on_input_order');
assert(JSON.stringify(orderA.candidates)===JSON.stringify(orderB.candidates),'projection_depends_on_input_order');

// G6.2 negative-first: a change in ranking policy must invalidate strategy
// evidence even when recipe, inventory and provenance bytes are unchanged.
// Stockpile sorting can put a pot-blocked zero-shortage recipe ahead of a
// near-ready recipe; unlock sorting does the opposite.
const modeInput={
  recipes:[byName('特選蘋果咖哩'),byName('忍者咖哩')],
  recipeIngredients:relations([byName('特選蘋果咖哩'),byName('忍者咖哩')]),
  recipeStates:states([byName('特選蘋果咖哩'),byName('忍者咖哩')],false),
  inventory:[{ingredient_name:'特選蘋果',quantity:3},
    ...relations([byName('忍者咖哩')]).map(item=>({ingredient_name:item.ingredient_name,quantity:999}))],
  provenance:PUBLIC_RECIPE_PROVENANCE,
  potSize:20,
  requireVerifiedMaster:true,
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,
  provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
};
const unlockMode=projectRecipeStrategy({...modeInput,sortMode:'unlock_recipes'});
const stockpileMode=projectRecipeStrategy({...modeInput,sortMode:'ingredient_stockpile'});
assert(unlockMode.candidates[0].candidate_status==='UNLOCK_CANDIDATE_NEAR',
  'strategy_sort_mode_unlock_control');
assert(stockpileMode.candidates[0].candidate_status==='BLOCKED_POT_CAPACITY',
  'strategy_sort_mode_stockpile_control');
assert(unlockMode.input_fingerprint!==stockpileMode.input_fingerprint,
  'strategy_sort_mode_drift_must_invalidate_fingerprint');

const categoryFilter=projectRecipeStrategy({
  recipes:[byName('忍者咖哩'),byName('特選蘋果沙拉')],
  recipeIngredients:relations([byName('忍者咖哩'),byName('特選蘋果沙拉')]),
  recipeStates:states([byName('忍者咖哩'),byName('特選蘋果沙拉')],false),
  inventory:[],provenance:PUBLIC_RECIPE_PROVENANCE,potSize:100,dishCategory:'沙拉',
  masterVersion:PUBLIC_RECIPE_MASTER_VERSION,provenanceVersion:PUBLIC_RECIPE_PROVENANCE_VERSION,
});
assert(categoryFilter.candidates.length===1&&categoryFilter.candidates[0].category==='沙拉','dish_category_filter');

console.log(JSON.stringify({
  status:'PASS',
  schema:'pokemon-sleep-recipe-strategy-projection-contract/1.0',
  engine_version:RECIPE_STRATEGY_ENGINE_VERSION,
  verified_statuses:[
    'COOK_NOW_UNLOCKED','UNLOCK_CANDIDATE_READY','UNLOCK_CANDIDATE_NEAR',
    'BLOCKED_SAFE_RESERVE','BLOCKED_INGREDIENT_SHORTAGE','BLOCKED_POT_CAPACITY',
    'REVIEW_MISSING_INPUT','REVIEW_PROVENANCE',
  ],
  deterministic_order_invariant:true,
  upcoming_runtime_candidates:0,
  safe_reserve_distinguished_from_raw_shortage:true,
  player_data_write:false,
},null,2));
