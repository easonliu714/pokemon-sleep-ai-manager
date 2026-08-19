import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_RECIPE_DISCOVERY,activeCanonicalDiscoveryRows} from '../assets/js/public-recipe-discovery-master.js';
import {projectRecipeDiscoveryStockpile} from '../assets/js/recipe-discovery-stockpile.js';
import {buildScenarioTemplate} from '../assets/js/prompt-catalog.js';

const read=path=>fs.readFileSync(path,'utf8');
const semver=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(value,floor)=>{const a=semver(value),b=semver(floor);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false;}return true;};
const version=read('assets/js/version-authority.js');const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(atLeast(appVersion,'v0.4.6'),'v0.4.6 behavior must remain available in later releases');
if(appVersion==='v0.4.6'){assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v046-recipe-discovery-stockpile-team-planner');assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.6-v046-recipe-discovery-stockpile-team-planner');}

assert.equal(PUBLIC_RECIPE_DISCOVERY.length,2);
const promoted=activeCanonicalDiscoveryRows(),promotionActive=promoted.length===2;
assert.ok([0,2].includes(promoted.length),'the paired Discovery activation must transition atomically');
for(const row of PUBLIC_RECIPE_DISCOVERY){
  if(promotionActive){
    assert.equal(row.active_canonical,true);assert.equal(row.lifecycle,'PROMOTED_TO_CANONICAL_ACTIVE');assert.ok(row.canonical_name_zh_tw);assert.ok(row.canonical_formula);assert.equal(row.quantity_assignment_status,'EXACT_CURRENT_GAME_FORMULA_CONFIRMED');
  }else{
    assert.equal(row.active_canonical,false);assert.equal(row.canonical_name_zh_tw,null);assert.equal(row.canonical_formula,null);assert.equal(row.quantity_assignment_status,'UNKNOWN_UNORDERED_SIGNATURE');assert.equal('planning_formula' in row,false,'unverified quantity-to-ingredient mapping must not appear before activation');
  }
}

const weekly=buildScenarioTemplate('weekly');assert.equal(weekly.scenario,'weekly_context_update');assert.equal(weekly.operations[0].entity,'weekly_context');assert.ok(weekly.operations[0].data.updated_at);
const prompt=read('assets/js/prompt-catalog.js');for(const token of ['玩家當週狀態，不是公版 Master','weekly_context_update','recipe_final_energy_multiplier'])assert.ok(prompt.includes(token));

const result=projectRecipeDiscoveryStockpile({inventory:[],weeklyContext:{context_id:'release_week',week_start:'2026-08-10',camp:'測試營地',dish_category:'咖哩／濃湯',pot_size:57,event_name:'測試活動',event_effects:JSON.stringify({recipe_final_energy_multiplier:1.5,sunday_pot_multiplier:2})},goalProfile:{goal_profile_id:'release_goal',hard_constraints:{}},scoringProjection:{feature_fingerprint:'release',candidates:[
  {pokemon_id:'p1',species:'甲',level:30,specialty:'食材',hard_constraint_status:'PASS',favorite_berry_match:false,current_readiness_score:50,profile_completeness:{ratio:1},unlocked_ingredients:[{ingredient_name:'暖暖薑'}],failed_constraints:[],review_constraints:[]},
  {pokemon_id:'p2',species:'乙',level:30,specialty:'食材',hard_constraint_status:'PASS',favorite_berry_match:false,current_readiness_score:50,profile_completeness:{ratio:1},unlocked_ingredients:[{ingredient_name:'火辣香草'}],failed_constraints:[],review_constraints:[]},
  {pokemon_id:'p3',species:'丙',level:30,specialty:'食材',hard_constraint_status:'PASS',favorite_berry_match:false,current_readiness_score:50,profile_completeness:{ratio:1},unlocked_ingredients:[{ingredient_name:'品鮮蘑菇'}],failed_constraints:[],review_constraints:[]},
  {pokemon_id:'p4',species:'丁',level:30,specialty:'食材',hard_constraint_status:'PASS',favorite_berry_match:false,current_readiness_score:50,profile_completeness:{ratio:1},unlocked_ingredients:[{ingredient_name:'豆製肉'}],failed_constraints:[],review_constraints:[]},
  {pokemon_id:'p5',species:'戊',level:30,specialty:'食材',hard_constraint_status:'PASS',favorite_berry_match:false,current_readiness_score:50,profile_completeness:{ratio:1},unlocked_ingredients:[{ingredient_name:'萌綠大豆'},{ingredient_name:'純粹油'}],failed_constraints:[],review_constraints:[]},
]}});
if(promotionActive){
  assert.equal(result.summary.recipe_candidate_count,0);assert.equal(result.summary.total_target,0);assert.deepEqual(result.discovery_candidates,[]);assert.deepEqual(result.stockpile,[]);
}else{
  assert.equal(result.summary.total_target,236);assert.equal(result.summary.target_semantics,'CONSERVATIVE_DISCOVERY_UPPER_BOUND');assert.equal(result.weekly_context.recipe_final_energy_multiplier,1.5);assert.equal(result.team.primary.team_status,'READY');assert.equal(result.team.primary.slots.length,5);
}
assert.equal(result.production_rate_model,'NOT_YET_VERIFIED');assert.equal(result.player_data_write,false);assert.equal(result.gemini_used,false);assert.equal(result.canonical_recipe_state_write,false);

const canonical=read('assets/js/public-recipe-canonical-authority.js');assert.equal(canonical.includes("from './public-recipe-discovery-master.js'"),false,'canonical authority must not depend on mutable Discovery runtime');
const local=read('assets/js/recipe-discovery-stockpile-local.js');for(const token of ['currentWeeklyContext','ingredient_inventory','buildLocalPokemonCandidateScoring'])assert.ok(local.includes(token));
const recipeLocal=read('assets/js/recipe-strategy-local.js');assert.ok(recipeLocal.includes("war-room-recipe-discovery-bootstrap.js"));
const sw=read('service-worker.js');assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));assert.ok(sw.includes("url.pathname.endsWith('.js')"));assert.ok(sw.includes('caches.match(event.request)')||sw.includes('caches.match(request,{ignoreSearch:true})'),'historical cache fallback semantics must remain; query-safe successor is allowed');
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('recipe-discovery-stockpile'),false,'v0.4.6 behavior must remain migration-free');
for(const deterministic of [read('assets/js/recipe-discovery-stockpile.js'),read('assets/js/weekly-context-normalization.js')])for(const forbidden of ['Gemini','fetch(','persist(','run('])assert.equal(deterministic.includes(forbidden),false,`deterministic v0.4.6 layer contains forbidden token: ${forbidden}`);

console.log(JSON.stringify({status:'PASS',gate:'V0.4.6_RECIPE_DISCOVERY_RELEASE_SUCCESSOR_AWARE',app_version:appVersion,discovery_evidence_rows:2,promoted_to_canonical:promotionActive,canonical_active_discovery_rows:promoted.length,planning_candidates:result.summary.recipe_candidate_count,total_stockpile_target:result.summary.total_target,target_semantics:promotionActive?'CANONICAL_RECIPE_MASTER':result.summary.target_semantics,weekly_context_player_json:true,recipe_energy_multiplier_supported:true,team_size:promotionActive?0:5,schema_migration_added:false,player_data_write:false,gemini_used:false},null,2));