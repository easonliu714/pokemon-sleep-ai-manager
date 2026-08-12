import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_RECIPE_DISCOVERY,activeCanonicalDiscoveryRows} from '../assets/js/public-recipe-discovery-master.js';
import {projectRecipeDiscoveryStockpile} from '../assets/js/recipe-discovery-stockpile.js';
import {normalizeWeeklyContext} from '../assets/js/weekly-context-normalization.js';
import {buildScenarioTemplate} from '../assets/js/prompt-catalog.js';

assert.equal(PUBLIC_RECIPE_DISCOVERY.length,2);
const promoted=activeCanonicalDiscoveryRows();
const promotionActive=promoted.length===2;
assert.ok([0,2].includes(promoted.length),'Discovery lifecycle must be either historical pending pair or fully promoted pair');
if(promotionActive){
  for(const row of PUBLIC_RECIPE_DISCOVERY){
    assert.equal(row.active_canonical,true);
    assert.equal(row.lifecycle,'PROMOTED_TO_CANONICAL_ACTIVE');
    assert.ok(row.canonical_recipe_id&&row.canonical_name_zh_tw);
    assert.equal(row.quantity_assignment_status,'EXACT_CURRENT_GAME_FORMULA_CONFIRMED');
    assert.ok(Array.isArray(row.canonical_formula)&&row.canonical_formula.length===4);
    assert.equal(row.planning_policy,'CANONICAL_RECIPE_MASTER');
  }
}else{
  for(const row of PUBLIC_RECIPE_DISCOVERY){
    assert.equal(row.canonical_recipe_id,null);assert.equal(row.canonical_name_zh_tw,null);assert.equal(row.canonical_formula,null);assert.equal(row.active_canonical,false);
    assert.match(row.lifecycle,/DISCOVERY_CANDIDATE/);assert.equal(row.quantity_assignment_status,'UNKNOWN_UNORDERED_SIGNATURE');
    assert.ok(Array.isArray(row.reference_ingredient_set)&&row.reference_ingredient_set.length===4);assert.ok(Array.isArray(row.observed_quantity_signature)&&row.observed_quantity_signature.length===4);
    assert.equal(row.max_observed_quantity,Math.max(...row.observed_quantity_signature));assert.equal('planning_formula' in row,false);
  }
}

const weeklyContext={context_id:'week_fixture',week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',event_name:'夏日嘉年華2026',pot_size:57,favorite_berry_1:'橙橙果',favorite_berry_2:'莓莓果',favorite_berry_3:'靛莓果',event_effects:JSON.stringify({recipe_final_energy_multiplier:1.5,extra_tasty_multiplier:3,sunday_extra_tasty_multiplier:4.5,sunday_pot_multiplier:2,new_recipe_count:2})};
const normalized=normalizeWeeklyContext(weeklyContext);assert.equal(normalized.recipe_final_energy_multiplier,1.5);assert.equal(normalized.sunday_pot_multiplier,2);
const make=(id,species,ingredients,{mandatory=false,favorite=false,readiness=50,level=30,specialty='食材'}={})=>({pokemon_id:id,species,level,specialty,hard_constraint_status:'PASS',mandatory_candidate:mandatory,favorite_berry_match:favorite,current_readiness_score:readiness,profile_completeness:{ratio:1},unlocked_ingredients:ingredients.map(ingredient_name=>({ingredient_name,unlock_level:1,quantity:1})),failed_constraints:[],review_constraints:[]});
const candidates=[make('p1','甲',['暖暖薑'],{mandatory:true,readiness:70}),make('p2','乙',['火辣香草'],{readiness:60}),make('p3','丙',['品鮮蘑菇'],{readiness:55}),make('p4','丁',['豆製肉'],{readiness:50}),make('p5','戊',['萌綠大豆','純粹油'],{readiness:45}),make('p6','己',['哞哞鮮奶'],{favorite:true,readiness:100})];
const scoringProjection={feature_fingerprint:'fixture',candidates};
const goalProfile={goal_profile_id:'goal_fixture',hard_constraints:{must_include_pokemon:['p1'],exclude_pokemon:[],must_include_role:[],max_same_species:5}};
const result=projectRecipeDiscoveryStockpile({inventory:[],scoringProjection,goalProfile,weeklyContext,maxAlternatives:1});
if(promotionActive){
  assert.equal(result.summary.recipe_candidate_count,0,'promoted canonical recipes must retire unknown Discovery planning rows');
  assert.equal(result.summary.total_target,0);assert.equal(result.summary.total_deficit,0);assert.deepEqual(result.discovery_candidates,[]);assert.deepEqual(result.stockpile,[]);
}else{
  assert.equal(result.summary.total_target,236);assert.equal(result.summary.total_deficit,236);assert.equal(result.summary.target_semantics,'CONSERVATIVE_DISCOVERY_UPPER_BOUND');
  assert.equal(result.weekly_context.camp,'萌綠之島');assert.equal(result.weekly_context.recipe_final_energy_multiplier,1.5);
  assert.equal(result.discovery_candidates[0].sunday_pot_capacity,114);assert.equal(result.discovery_candidates[0].sunday_pot_fit,true);assert.equal(result.discovery_candidates[1].sunday_pot_capacity,114);assert.equal(result.discovery_candidates[1].sunday_pot_fit,true);assert.equal(result.discovery_candidates[1].sunday_pot_buffer,2);
  assert.equal(result.discovery_candidates[0].quantity_assignment_status,'UNKNOWN_UNORDERED_SIGNATURE');assert.equal(result.discovery_candidates[0].conservative_upper_bound_per_reference_ingredient,20);assert.equal(result.discovery_candidates[1].conservative_upper_bound_per_reference_ingredient,39);
  const target=Object.fromEntries(result.stockpile.map(row=>[row.ingredient_name,row.target]));assert.deepEqual(target,{'暖暖薑':59,'火辣香草':59,'品鮮蘑菇':39,'豆製肉':39,'純粹油':20,'萌綠大豆':20});
  assert.equal(result.team.primary.team_status,'READY');const selected=new Set(result.team.primary.slots.map(row=>row.pokemon_id));for(const id of ['p1','p2','p3','p4','p5'])assert.ok(selected.has(id));assert.equal(selected.has('p6'),false);
}
assert.equal(result.production_rate_model,'NOT_YET_VERIFIED');assert.equal(result.estimated_ingredient_per_hour,null);assert.equal(result.estimated_weekly_energy,null);assert.equal(result.player_data_write,false);assert.equal(result.gemini_used,false);assert.equal(result.canonical_recipe_state_write,false);

const weeklyTemplate=buildScenarioTemplate('weekly');assert.equal(weeklyTemplate.scenario,'weekly_context_update');assert.equal(weeklyTemplate.operations[0].entity,'weekly_context');assert.ok(weeklyTemplate.operations[0].data.updated_at);assert.doesNotThrow(()=>new Date(weeklyTemplate.operations[0].data.updated_at).toISOString());
const prompt=fs.readFileSync('assets/js/prompt-catalog.js','utf8');for(const token of ['weekly_context_update','weekly_context','recipe_final_energy_multiplier','玩家當週狀態，不是公版 Master','固定三樹果營地','萌綠之島一般模式與 EX 動態營地'])assert.ok(prompt.includes(token));
const local=fs.readFileSync('assets/js/recipe-discovery-stockpile-local.js','utf8');for(const token of ['currentWeeklyContext','ingredient_inventory','buildLocalPokemonCandidateScoring'])assert.ok(local.includes(token));
const bootstrap=fs.readFileSync('assets/js/recipe-strategy-local.js','utf8');assert.ok(bootstrap.includes("war-room-recipe-discovery-bootstrap.js"));

console.log(JSON.stringify({status:'PASS',gate:'WAR.2B_RECIPE_DISCOVERY_STOCKPILE_SUCCESSOR_AWARE',discovery_rows:2,promoted_to_canonical:promotionActive,active_canonical_discovery_rows:promoted.length,planning_candidates:result.summary.recipe_candidate_count,total_stockpile_target:result.summary.total_target,sunday_pot_capacity:promotionActive?null:114,recipe_energy_multiplier:1.5,quantity_assignment:promotionActive?'CANONICAL_RECIPE_MASTER':'UNKNOWN_UNORDERED_SIGNATURE',production_rate_model:result.production_rate_model,player_data_write:false,gemini_used:false},null,2));
