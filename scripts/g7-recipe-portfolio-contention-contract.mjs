import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RECIPE_PORTFOLIO_CONTENTION_VERSION,
  RECIPE_PORTFOLIO_OBJECTIVES,
  buildRecipeContentionGraph,
  projectRecipePortfolioContention,
} from '../assets/js/recipe-portfolio-contention.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionTuple=value=>{const match=String(value||'').match(/^v(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/);return match?match.slice(1).map(part=>Number(part||0)):null;};
const versionAtLeast=(value,minimum)=>{const a=versionTuple(value),b=versionTuple(minimum);if(!a||!b)return false;for(let i=0;i<4;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return true;};
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.ok(appVersion==='v0.4.12'||versionAtLeast(appVersion,'v0.4.13'),`unexpected G7.1 release authority: ${appVersion}`);
if(appVersion==='v0.4.12'){
  assert.equal(appBuild,'20260811-v0412-recipe-unified-player-workbench','G7.1 behavior-first stage must keep v0.4.12 Release Authority');
}else if(appVersion==='v0.4.13'){
  assert.equal(appBuild,'20260811-v0413-g7-recipe-portfolio-contention');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.13-v0413-g7-recipe-portfolio-contention');
  assert.ok(version.includes("// app_version: 'v0.4.12'"),'v0.4.13 must retain v0.4.12 legacy bridge');
  assert.ok(version.includes("// app_build: '20260811-v0412-recipe-unified-player-workbench'"));
}else if(appVersion==='v0.4.13.1'){
  assert.equal(appBuild,'20260811-v04131-data-preservation-hotfix');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.13.1-v04131-data-preservation-hotfix');
  assert.ok(version.includes("// app_version: 'v0.4.13'"),'v0.4.13.1 must retain G7.1 predecessor bridge');
  assert.ok(version.includes("// app_build: '20260811-v0413-g7-recipe-portfolio-contention'"));
}else if(appVersion==='v0.4.13.2'){
  assert.equal(appBuild,'20260812-v04132-pot-authority-recipe78');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.13.2-v04132-pot-authority-recipe78');
  assert.ok(version.includes("// app_version: 'v0.4.13.1'"),'v0.4.13.2 must retain data-preservation predecessor bridge');
  assert.ok(version.includes("// app_version: 'v0.4.13'"),'v0.4.13.2 must retain G7 predecessor bridge');
}else{
  assert.ok(version.includes("// app_version: 'v0.4.13'"),'G7 successor must retain v0.4.13 lineage bridge');
  assert.ok(version.includes("// app_build: '20260811-v0413-g7-recipe-portfolio-contention'"));
}
assert.ok([
  'recipe-portfolio-contention-2026-08-11-a',
  'recipe-portfolio-contention-2026-08-12-b-verified-energy',
].includes(RECIPE_PORTFOLIO_CONTENTION_VERSION),`unexpected G7 portfolio engine successor: ${RECIPE_PORTFOLIO_CONTENTION_VERSION}`);
assert.deepEqual(RECIPE_PORTFOLIO_OBJECTIVES.slice(0,3),['unlock_recipes','preserve_resources','continuous_meals'],'G7 successor must preserve predecessor objective order/semantics');
if(RECIPE_PORTFOLIO_CONTENTION_VERSION==='recipe-portfolio-contention-2026-08-12-b-verified-energy')assert.ok(RECIPE_PORTFOLIO_OBJECTIVES.includes('maximize_verified_energy'),'verified-energy successor must extend, not replace, predecessor objectives');

function candidate(id,{name=id,unlocked=false,energy=100,requirements=[]}={}){
  return {
    recipe_id:id,recipe_name:name,unlocked,base_energy:energy,
    candidate_status:unlocked?'COOK_NOW_UNLOCKED':'UNLOCK_CANDIDATE_READY',hard_constraint_status:'PASS',pot_fit:true,
    requirements:requirements.map(([ingredient_name,required])=>({ingredient_name,required,owned:999,safe_reserve:0,usable:999,raw_shortage:0,strategy_shortage:0,reserve_blocked:0})),
  };
}
function strategy(candidates,fingerprint='fixture'){return {input_fingerprint:fingerprint,candidates};}

const fixtureA=[
  candidate('a_unlock',{name:'A 解鎖料理',requirements:[['特選蘋果',4]]}),
  candidate('b_unlock',{name:'B 解鎖料理',requirements:[['特選蘋果',5]]}),
  candidate('c_cook',{name:'C 已解鎖料理',unlocked:true,requirements:[['甜甜蜜',3]]}),
];
const inventoryA=[{ingredient_name:'特選蘋果',quantity:8},{ingredient_name:'甜甜蜜',quantity:3}];
const reserveA={'特選蘋果':1};
const graphA=buildRecipeContentionGraph({candidates:fixtureA,inventory:inventoryA,ingredientSafeReserve:reserveA});
assert.equal(graphA.eligible_recipe_count,3);
assert.equal(graphA.contention_edge_count,1);
assert.equal(graphA.oversubscribed_ingredient_count,1);
assert.equal(graphA.all_individually_ready_simultaneously_executable,false,'READY individually must not imply simultaneous executability');
const apple=graphA.ingredients.find(row=>row.ingredient_name==='特選蘋果');
assert.equal(apple.usable,7);assert.equal(apple.aggregate_demand,9);assert.equal(apple.aggregate_over_subscription,2);
const unlockPlan=projectRecipePortfolioContention({recipeStrategy:strategy(fixtureA,'A'),inventory:inventoryA,ingredientSafeReserve:reserveA,objective:'unlock_recipes',maxMeals:2,maxAlternatives:3});
assert.equal(unlockPlan.projection_status,'READY');
assert.equal(unlockPlan.summary.individually_ready_count,3);
assert.equal(unlockPlan.summary.all_individually_ready_simultaneously_executable,false);
assert.equal(unlockPlan.alternatives[0].completed_meals,2);
assert.equal(unlockPlan.alternatives[0].unlock_count,1);
assert.equal(unlockPlan.alternatives[0].steps[0].recipe_id,'a_unlock');
assert.ok(unlockPlan.alternatives[0].steps[0].newly_blocked_recipe_ids.includes('b_unlock'));
assert.deepEqual(unlockPlan.alternatives[0].steps[0].ingredients[0],{
  ingredient_name:'特選蘋果',before:8,consumed:4,remaining:4,safe_reserve:1,usable_after:3,buffer_state:'LOW_BUFFER',
});
assert.equal(unlockPlan.player_data_write,false);assert.equal(unlockPlan.inventory_mutation,false);assert.equal(unlockPlan.public_master_write,false);assert.equal(unlockPlan.gemini_used,false);

const fixtureB=[candidate('milk_cook',{name:'牛奶料理',unlocked:true,requirements:[['哞哞鮮奶',4]]})];
const reserveBlocked=projectRecipePortfolioContention({recipeStrategy:strategy(fixtureB,'B'),inventory:[{ingredient_name:'哞哞鮮奶',quantity:5}],ingredientSafeReserve:{'哞哞鮮奶':2},objective:'continuous_meals',maxMeals:2});
assert.equal(reserveBlocked.summary.individually_ready_count,1);
assert.equal(reserveBlocked.alternatives.length,0,'simulation must not consume below Safe Reserve');
const noRows=projectRecipePortfolioContention({recipeStrategy:strategy(fixtureB,'B-empty'),inventory:[],ingredientSafeReserve:{},objective:'continuous_meals'});
assert.equal(noRows.projection_status,'INVENTORY_NOT_OBSERVED');
assert.equal(noRows.context.inventory_semantics,'NO_ROWS_EXPORTED_NOT_ZERO_CONFIRMED','empty inventory collection must not be silently treated as verified zero');

const fixtureC=[
  candidate('a_apple',{name:'蘋果料理 A',unlocked:true,requirements:[['特選蘋果',3]]}),
  candidate('b_apple',{name:'蘋果料理 B',unlocked:true,requirements:[['特選蘋果',3]]}),
  candidate('c_honey',{name:'蜂蜜料理 C',unlocked:true,requirements:[['甜甜蜜',3]]}),
];
const inventoryC=[{ingredient_name:'特選蘋果',quantity:5},{ingredient_name:'甜甜蜜',quantity:3}];
const preserve=projectRecipePortfolioContention({recipeStrategy:strategy(fixtureC,'C'),inventory:inventoryC,objective:'preserve_resources',maxMeals:1,maxAlternatives:3});
const continuous=projectRecipePortfolioContention({recipeStrategy:strategy(fixtureC,'C'),inventory:inventoryC,objective:'continuous_meals',maxMeals:1,maxAlternatives:3});
assert.equal(preserve.alternatives[0].steps[0].recipe_id,'a_apple','preserve_resources should prefer low-buffer over fully exhausting a resource when meal count is equal');
assert.equal(continuous.alternatives[0].steps[0].recipe_id,'c_honey','continuous_meals should preserve the largest next-executable set');
assert.equal(continuous.alternatives[0].next_executable_count,2);
assert.equal(preserve.alternatives[0].next_executable_count,1);
const continuousAgain=projectRecipePortfolioContention({recipeStrategy:strategy(fixtureC,'C'),inventory:inventoryC,objective:'continuous_meals',maxMeals:1,maxAlternatives:3});
assert.equal(continuousAgain.input_fingerprint,continuous.input_fingerprint);
assert.deepEqual(continuousAgain.alternatives.map(row=>row.sequence_key),continuous.alternatives.map(row=>row.sequence_key),'same inputs must reproduce identical sequence ranking');

const pure=read('assets/js/recipe-portfolio-contention.js');
for(const forbidden of ['INSERT INTO','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch(','Gemini'])assert.equal(pure.includes(forbidden),false,`pure G7 planner owns forbidden path: ${forbidden}`);
const local=read('assets/js/recipe-portfolio-contention-local.js');
assert.ok(local.includes("SELECT ingredient_name,quantity FROM ingredient_inventory"));
for(const forbidden of ['INSERT INTO','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun('])assert.equal(local.includes(forbidden),false,`G7 local adapter owns forbidden write path: ${forbidden}`);
const ui=read('assets/js/war-room-cooking-planner-ui.js');
for(const token of ['Top 3 可執行序列','before','data-g7-objective','data-g7-meals','missing 不會在 G7 中自動轉成已確認 0'])assert.ok(ui.includes(token),`G7 mobile UI marker missing: ${token}`);
const strategyLocal=read('assets/js/recipe-strategy-local.js');
assert.ok(strategyLocal.includes("import('./war-room-cooking-planner-bootstrap.js')"));
const discovery=read('assets/js/recipe-discovery-stockpile.js');
assert.equal(pure.includes('recipe-discovery-stockpile'),false,'ACTIVE recipe portfolio planner must remain isolated from non-canonical Discovery formulas');
assert.ok(discovery.includes('REFERENCE_ONLY_NOT_CANONICAL_FORMULA'),'Discovery safety boundary must remain explicit');
const sw=read('service-worker.js');
for(const asset of ['recipe-portfolio-contention.js','recipe-portfolio-contention-local.js','war-room-cooking-planner-ui.js','war-room-cooking-planner-bootstrap.js'])assert.ok(sw.includes(asset),`G7 offline precache missing ${asset}`);
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('recipe-portfolio-contention'),false,'G7.1 must not own a SQLite migration');
assert.ok(migrations.includes('applyIngredientProbabilityObservationMigration'),'later E3C-6B local evidence migration may coexist without changing G7.1 migration ownership');

console.log(JSON.stringify({
  status:'PASS',gate:'G7_1_RECIPE_PORTFOLIO_RESOURCE_CONTENTION_EXTENSION_AWARE',app_version:appVersion,release_promoted:versionAtLeast(appVersion,'v0.4.13'),
  planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,objectives:RECIPE_PORTFOLIO_OBJECTIVES,
  fixture_a:{ready:unlockPlan.summary.individually_ready_count,contention_edges:graphA.contention_edge_count,oversubscribed:graphA.oversubscribed_ingredient_count,simultaneous:false,top_sequence:unlockPlan.alternatives[0].sequence_key},
  fixture_b:{safe_reserve_enforced:true,empty_collection_zero_assumed:false},
  fixture_c:{preserve_top:preserve.alternatives[0].sequence_key,continuous_top:continuous.alternatives[0].sequence_key,deterministic:true},
  player_inventory_write:false,public_master_write:false,gemini_used:false,sqlite_migration_added:false,offline_precache:true,
},null,2));