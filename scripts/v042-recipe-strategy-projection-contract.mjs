import {
  projectRecipeStrategy,
  RECIPE_STRATEGY_ENGINE_VERSION,
} from '../assets/js/recipe-strategy-projection.js';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
} from '../assets/js/public-recipe-master.js';
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
