import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectTeamSupplyReadiness,TEAM_SUPPLY_RATE_STATUS} from '../assets/js/team-supply-readiness.js';
import {buildRecipeUnifiedWorkbenchProjection,RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION} from '../assets/js/recipe-unified-player-workbench.js';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-canonical-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.equal(appVersion,'v0.4.15');
assert.equal(appBuild,'20260812-v0415-g72-team-supply-mobile-ui');
assert.equal(cacheName,'pokemon-sleep-ai-v0.4.15-v0415-g72-team-supply-mobile-ui');
assert.ok(version.includes("// app_version: 'v0.4.14'"));

const member=(pokemon_id,species,ingredients,helper_seconds=3000)=>({pokemon_id,species,level:30,helper_seconds,unlocked_ingredients:ingredients.map(([ingredient_name,quantity])=>({unlock_level:1,ingredient_name,quantity}))});
const features={input_fingerprint:'features:fixture',candidates:[
  member('p1','蘋果獸',[['特選蘋果',2]],2500),
  member('p2','蜂蜜獸',[['甜甜蜜',2]],2800),
  member('p3','油獸',[['純粹油',2]],3000),
  member('p4','豆獸',[['萌綠大豆',2]],3100),
  member('p5','草獸',[['火辣香草',2]],3200),
]};
const team={input_fingerprint:'team-result:fixture',primary:{team_id:'team_draft:fixture',team_status:'READY',slots:features.candidates.map((row,index)=>({slot_index:index,pokemon_id:row.pokemon_id,species:row.species,level:row.level}))}};
const recipe=(recipe_id,recipe_name,requirements,failed_constraints=['ingredient_availability'])=>({
  recipe_id,recipe_name,candidate_status:'BLOCKED_INGREDIENT_SHORTAGE',hard_constraint_status:'FAIL',failed_constraints,total_strategy_shortage:requirements.reduce((sum,row)=>sum+row[1],0),
  requirements:requirements.map(([ingredient_name,strategy_shortage])=>({ingredient_name,strategy_shortage,raw_shortage:strategy_shortage,safe_reserve:0})),
});
const strategy={input_fingerprint:'recipe:fixture',candidates:[
  recipe('r_all','全部可補',[['特選蘋果',3],['甜甜蜜',4]]),
  recipe('r_partial','部分可補',[['特選蘋果',2],['哞哞鮮奶',5]]),
  recipe('r_none','完全無來源',[['哞哞鮮奶',4]]),
  recipe('r_pot','另有鍋子限制',[['甜甜蜜',2]],['ingredient_availability','pot_capacity_limit']),
]};
const supply=projectTeamSupplyReadiness({recipeStrategy:strategy,teamOptimization:team,candidateFeatures:features});
assert.equal(supply.projection_status,'READY');
assert.equal(supply.team_member_count,5);
assert.equal(supply.production_rate_status,'NOT_YET_VERIFIED');
assert.equal(TEAM_SUPPLY_RATE_STATUS,'NOT_YET_VERIFIED');
assert.equal(supply.ingredient_per_hour_authority,false);
assert.equal(supply.replenishment_eta_authority,false);
assert.equal(supply.inventory_virtualization,false);
assert.equal(supply.inventory_ready_promotion,false);
assert.equal(supply.recipes.find(row=>row.recipe_id==='r_all').supply_status,'TEAM_CAPABILITY_COVERED_UNQUANTIFIED');
assert.equal(supply.recipes.find(row=>row.recipe_id==='r_partial').supply_status,'PARTIAL_TEAM_COVERAGE');
assert.equal(supply.recipes.find(row=>row.recipe_id==='r_none').supply_status,'NO_TEAM_SOURCE');
assert.deepEqual(supply.recipes.find(row=>row.recipe_id==='r_pot').other_blockers,['pot_capacity_limit']);
assert.equal(supply.recipes.find(row=>row.recipe_id==='r_all').shortages[0].ingredient_per_hour,null);
assert.equal(supply.recipes.find(row=>row.recipe_id==='r_all').shortages[0].replenishment_eta,null);
const supplyAgain=projectTeamSupplyReadiness({recipeStrategy:strategy,teamOptimization:team,candidateFeatures:features});
assert.equal(supplyAgain.input_fingerprint,supply.input_fingerprint,'same inputs must produce same Team Supply fingerprint');
const helperChanged={...features,candidates:features.candidates.map(row=>row.pokemon_id==='p1'?{...row,helper_seconds:2400}:row)};
assert.notEqual(projectTeamSupplyReadiness({recipeStrategy:strategy,teamOptimization:team,candidateFeatures:helperChanged}).input_fingerprint,supply.input_fingerprint,'observed helper_seconds may be fingerprint evidence even though no rate is derived');

const unlockedIds=new Set(PUBLIC_RECIPE_MASTER.slice(0,7).map(row=>row.recipe_id));
const catalog=PUBLIC_RECIPE_MASTER.map(row=>({...row,unlocked:unlockedIds.has(row.recipe_id)?1:0,recipe_level:null,current_energy:null}));
const verifiedWeek={week_start:'2026-08-10',dish_category:'咖哩／濃湯',pot_size:60,authority_source:'UPDATE_CENTER_JSON',authority_update_id:'UPD-V0415-FIXTURE',strategy_event_effects:{sunday_pot_multiplier:2}};
const recipeProjection=buildRecipeUnifiedWorkbenchProjection({catalogRows:catalog,inventory:[],week:verifiedWeek});
assert.equal(recipeProjection.total_count,PUBLIC_RECIPE_MASTER.length);
assert.equal(recipeProjection.unlocked_count,7);
assert.equal(recipeProjection.locked_count,PUBLIC_RECIPE_MASTER.length-7);
assert.equal(recipeProjection.partition_complete,true);
assert.equal(recipeProjection.category_partition_complete,true);
assert.equal(Object.values(recipeProjection.category_statistics).reduce((sum,row)=>sum+row.total,0),PUBLIC_RECIPE_MASTER.length);
for(const category of ['咖哩／濃湯','沙拉','甜點／飲料']){
  const row=recipeProjection.category_statistics[category];assert.ok(row);assert.equal(row.unlocked+row.locked,row.total);
}
assert.equal(recipeProjection.base_pot_capacity,60);
assert.equal(recipeProjection.verified_pot_multiplier,2);
assert.equal(recipeProjection.verified_boosted_pot_capacity,120);
assert.equal(recipeProjection.pot_bonus_status,'ACTIVE_VERIFIED');
const unverifiedBonus=buildRecipeUnifiedWorkbenchProjection({catalogRows:catalog,inventory:[],week:{...verifiedWeek,strategy_event_effects:{},sunday_pot_multiplier:99}});
assert.equal(unverifiedBonus.verified_pot_multiplier,null,'raw/non-deterministic pot multiplier must not be promoted into summary calculation');
assert.equal(unverifiedBonus.verified_boosted_pot_capacity,null);

const workbench=read('assets/js/recipe-unified-player-workbench.js');
for(const token of ['recipe-summary-grid','基礎鍋子','已驗證加成鍋子','category_statistics','verified_boosted_pot_capacity'])assert.ok(workbench.includes(token),`recipe summary token missing: ${token}`);
assert.ok(RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION.includes('summary-cards'));
const polish=read('assets/js/v0415-ui-polish.js');
for(const token of ['#diagnostics .cards strong','overflow-wrap:anywhere','word-break:break-word','.recipe-summary-grid','.g72-team-supply','@media(max-width:700px)'])assert.ok(polish.includes(token),`mobile containment token missing: ${token}`);
const cookingUi=read('assets/js/war-room-cooking-planner-ui.js');
for(const token of ['G7.2 隊伍補貨覆蓋','NOT_YET_VERIFIED','不會把未來產能灌入實體庫存','team_supply','Top 3 可執行序列'])assert.ok(cookingUi.includes(token),`G7.2 UI token missing: ${token}`);
const local=read('assets/js/recipe-portfolio-contention-local.js');
for(const token of ["from './team-supply-readiness.js'","buildLocalPokemonCandidateScoring()",'optimizeTeam({scoringProjection:scoring,goalProfile,maxAlternatives:0})','team_supply:teamSupply'])assert.ok(local.includes(token),`G7.2 local adapter token missing: ${token}`);
const pure=read('assets/js/team-supply-readiness.js');
for(const forbidden of ['INSERT INTO','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch(','Gemini'])assert.equal(pure.includes(forbidden),false,`Team Supply pure projection owns forbidden path: ${forbidden}`);
const sw=read('service-worker.js');
for(const asset of ['./assets/js/team-supply-readiness.js','./assets/js/v0415-ui-polish.js'])assert.ok(sw.includes(`'${asset}'`),`first-offline precache missing ${asset}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0415_G72_TEAM_SUPPLY_MOBILE_UI',app_version:appVersion,
  team_supply:{team_members:supply.team_member_count,covered_recipe_count:supply.summary.team_capability_covered_recipe_count,partial_recipe_count:supply.summary.partial_team_coverage_recipe_count,no_source_recipe_count:supply.summary.no_team_source_recipe_count,production_rate_status:supply.production_rate_status,inventory_virtualization:false},
  recipe_summary:{total:recipeProjection.total_count,unlocked:recipeProjection.unlocked_count,locked:recipeProjection.locked_count,base_pot:recipeProjection.base_pot_capacity,verified_boosted_pot:recipeProjection.verified_boosted_pot_capacity,category_partition_complete:recipeProjection.category_partition_complete},
  diagnostics_mobile_wrap:true,first_offline_modules_precached:true,player_write:false,gemini_rate_authority:false,
},null,2));
