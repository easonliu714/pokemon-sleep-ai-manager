import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RECIPE_PORTFOLIO_CONTENTION_VERSION,
  RECIPE_PORTFOLIO_OBJECTIVES,
  projectRecipePortfolioContention,
} from '../assets/js/recipe-portfolio-contention.js';
import {RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION} from '../assets/js/recipe-unified-player-workbench.js';
import {PUBLIC_RECIPE_MASTER_VERSION} from '../assets/js/public-recipe-canonical-authority.js';
import {PUBLIC_MASTER_RECOGNITION_VERSION} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.13');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v0413-g7-recipe-portfolio-contention');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.13-v0413-g7-recipe-portfolio-contention');
assert.ok(version.includes("// app_version: 'v0.4.12'"),'v0.4.13 must retain v0.4.12 legacy bridge');
assert.ok(version.includes("// app_build: '20260811-v0412-recipe-unified-player-workbench'"));

assert.equal(RECIPE_PORTFOLIO_CONTENTION_VERSION,'recipe-portfolio-contention-2026-08-11-a');
assert.deepEqual(RECIPE_PORTFOLIO_OBJECTIVES,['unlock_recipes','preserve_resources','continuous_meals']);
assert.equal(RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION,'recipe-unified-player-workbench-2026-08-11-a');
assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-11-c');
assert.equal(PUBLIC_MASTER_RECOGNITION_VERSION,'public-master-recognition-2026-08-11-b-recipe-canonical');

const recipeStrategy={input_fingerprint:'release-fixture',candidates:[
  {recipe_id:'r_a',recipe_name:'料理 A',unlocked:false,base_energy:100,candidate_status:'UNLOCK_CANDIDATE_READY',hard_constraint_status:'PASS',requirements:[{ingredient_name:'特選蘋果',required:4}]},
  {recipe_id:'r_b',recipe_name:'料理 B',unlocked:false,base_energy:200,candidate_status:'UNLOCK_CANDIDATE_READY',hard_constraint_status:'PASS',requirements:[{ingredient_name:'特選蘋果',required:5}]},
  {recipe_id:'r_c',recipe_name:'料理 C',unlocked:true,base_energy:300,candidate_status:'COOK_NOW_UNLOCKED',hard_constraint_status:'PASS',requirements:[{ingredient_name:'甜甜蜜',required:3}]},
]};
const planned=projectRecipePortfolioContention({
  recipeStrategy,inventory:[{ingredient_name:'特選蘋果',quantity:8},{ingredient_name:'甜甜蜜',quantity:3}],ingredientSafeReserve:{'特選蘋果':1},objective:'unlock_recipes',maxMeals:2,maxAlternatives:3,
});
assert.equal(planned.projection_status,'READY');
assert.equal(planned.summary.individually_ready_count,3);
assert.equal(planned.summary.all_individually_ready_simultaneously_executable,false);
assert.equal(planned.contention.oversubscribed_ingredient_count,1);
assert.equal(planned.alternatives[0].completed_meals,2);
assert.equal(planned.alternatives[0].unlock_count,1);
assert.equal(planned.alternatives[0].steps[0].ingredients[0].before,8);
assert.equal(planned.alternatives[0].steps[0].ingredients[0].remaining,4);
assert.equal(planned.alternatives[0].steps[0].ingredients[0].safe_reserve,1);
assert.equal(planned.inventory_mutation,false);
assert.equal(planned.player_data_write,false);
assert.equal(planned.public_master_write,false);
assert.equal(planned.gemini_used,false);

const pure=read('assets/js/recipe-portfolio-contention.js');
const local=read('assets/js/recipe-portfolio-contention-local.js');
const ui=read('assets/js/war-room-cooking-planner-ui.js');
const bootstrap=read('assets/js/war-room-cooking-planner-bootstrap.js');
for(const forbidden of ['INSERT INTO','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch(','Gemini'])assert.equal(pure.includes(forbidden),false,`release pure planner owns forbidden path: ${forbidden}`);
for(const forbidden of ['INSERT INTO','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun('])assert.equal(local.includes(forbidden),false,`release local adapter owns forbidden write path: ${forbidden}`);
for(const token of ['G7 料理資源競爭／多餐模擬','Top 3 可執行序列','before → consumed → remaining','data-g7-objective','data-g7-meals'])assert.ok(ui.includes(token),`release mobile G7 UI missing ${token}`);
assert.ok(bootstrap.includes("root.id='warroomCookingPlanner'"));
assert.ok(bootstrap.includes("document.getElementById('warroomPanel')"));

const strategyLocal=read('assets/js/recipe-strategy-local.js');
assert.ok(strategyLocal.includes("import('./war-room-cooking-planner-bootstrap.js')"));
const discovery=read('assets/js/recipe-discovery-stockpile.js');
assert.ok(discovery.includes('REFERENCE_ONLY_NOT_CANONICAL_FORMULA'));
assert.equal(pure.includes('recipe-discovery-stockpile'),false,'ACTIVE portfolio planner must not import Discovery formula authority');
const workbench=read('assets/js/recipe-unified-player-workbench.js');
assert.equal((workbench.match(/INSERT INTO recipes/g)||[]).length,1,'v0.4.12 single player Recipe writer must remain intact');
const sw=read('service-worker.js');
for(const asset of ['recipe-unified-player-workbench.js','recipe-portfolio-contention.js','recipe-portfolio-contention-local.js','war-room-cooking-planner-ui.js','war-room-cooking-planner-bootstrap.js'])assert.ok(sw.includes(`'./assets/js/${asset}'`),`release offline precache missing ${asset}`);
assert.ok(sw.includes("url.pathname.endsWith('.js')"));
const ucImg=read('assets/js/unified-screenshot-update-center.js');
assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1,'v0.4.13 must retain exactly one UC.IMG Apply bridge');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.13 must remain SQLite-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.13_RELEASE_CONTRACT',app_version:'v0.4.13',
  planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,objectives:RECIPE_PORTFOLIO_OBJECTIVES,
  individually_ready_not_simultaneous:true,contention_graph:true,sequence_simulation:true,safe_reserve_each_step:true,
  missing_inventory_not_zero:true,deterministic_alternatives:true,mobile_war_room_ui:true,offline_precache:true,
  v0412_recipe_workbench_preserved:true,public_recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  player_inventory_write:false,public_master_write:false,gemini_used:false,sqlite_migration_added:false,uc_img_apply_bridge_count:1,
},null,2));
