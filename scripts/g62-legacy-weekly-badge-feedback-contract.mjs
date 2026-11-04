import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {analyzeIngredientGaps} from '../assets/js/ingredient-gap-engine.js';
import {normalizeDishCategory} from '../assets/js/weekly-context-normalization.js';
import {weeklyRecipeRecommendationNames} from '../assets/js/recipe-weekly-feedback-recommendation.js';

// G6.2: execute the real legacy badge bridge in an isolated VM with synthetic
// catalog and feedback. No player SQLite, IDB, network, public Master or writer.
const recipes=Array.from({length:5},(_,i)=>({
  recipe_id:'fixture-'+(i+1),recipe_name:'測試料理'+(i+1),
  category:'咖哩／濃湯',unlocked:0,notes:'',
}));
const ingredients=recipes.map((r,i)=>({recipe_id:r.recipe_id,ingredient_name:'測試食材'+(i+1),quantity:i+1}));
const inventory=recipes.map((r,i)=>({ingredient_name:'測試食材'+(i+1),quantity:0}));
const analyzed=analyzeIngredientGaps({recipes,recipeIngredients:ingredients,inventory});
const names=feedback=>[...weeklyRecipeRecommendationNames(analyzed,'咖哩、濃湯',feedback)];
assert.deepEqual(names([]),['測試料理1','測試料理2','測試料理3']);
const feedback=[
  {recipe_id:'fixture-1',recommendation_paused:1,reference_maybe_wrong:0},
  {recipe_id:'fixture-2',recommendation_paused:0,reference_maybe_wrong:1},
];
assert.deepEqual(names(feedback),['測試料理3','測試料理4','測試料理5'],
  'paused and suspect references must backfill safe candidates');
assert.deepEqual(names([{recipe_id:'fixture-1',recommendation_paused:2,reference_maybe_wrong:'UNKNOWN'}]),
  ['測試料理2','測試料理3','測試料理4'],'malformed persisted flags fail closed');
assert.deepEqual(names(recipes.map(r=>({recipe_id:r.recipe_id,recommendation_paused:1}))),[],
  'all-paused must yield zero misleading badges');
assert.deepEqual(names([]).length,3);
assert.deepEqual([...weeklyRecipeRecommendationNames(analyzed,'沙拉',[])],[],
  'category authority cannot leak badges across meals');
assert.deepEqual([...weeklyRecipeRecommendationNames(analyzed,'',[])],[]);

const bridgeRaw=readFileSync(new URL('../assets/js/current-week-recipe-recommendation-bridge.js',import.meta.url),'utf8');
const bridge=bridgeRaw.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
assert.doesNotMatch(bridge,/^import /m,'bridge fixture must execute actual source');
const events=new Map(),documentEvents=new Map(),scheduled=[],warnings=[];
const tableRows=recipes.map(r=>({
  cells:[{innerHTML:''},{textContent:'—'},{textContent:r.recipe_name}],
  classList:{toggle(name,enabled){assert.equal(name,'weekly-recommended');this.recommended=enabled;}},
}));
const table={dataset:{},querySelectorAll:selector=>{assert.equal(selector,'tbody tr');return tableRows;}};
const document={
  readyState:'loading',
  getElementById:id=>id==='referenceRecipeTable'?table:null,
  addEventListener:(name,fn)=>documentEvents.set(name,fn),
};
let feedbackRows=[],feedbackReadFails=false,inventoryReadFails=false,inventoryRows=inventory,masterIngredients=ingredients;
const ctx={
  document,console:{warn:msg=>warnings.push(msg)},
  rows:sql=>{
    if(sql.startsWith('SELECT ingredient_name,quantity FROM ingredient_inventory')){if(inventoryReadFails)throw Error('synthetic inventory read failure');return inventoryRows;}
    if(sql.startsWith('SELECT recipe_name,unlocked,notes FROM recipes'))return [];
    if(sql.startsWith('SELECT * FROM recipe_master ORDER BY'))return recipes;
    if(sql.startsWith('SELECT * FROM recipe_master_ingredients ORDER BY'))return masterIngredients;
    throw Error('unexpected SQL: '+sql);
  },
  isDatabaseReady:()=>true,isRescueReadonly:()=>false,
  currentEffectiveWeeklyContext:()=>({dish_category:'咖哩／濃湯',week_start:'2026-11-02',player_weekly_authority_source:'SYNTHETIC'}),
  normalizeDishCategory,analyzeIngredientGaps,weeklyRecipeRecommendationNames,
  listRecipeAttemptFeedbackSummaries:()=>{if(feedbackReadFails)throw Error('synthetic feedback read failure');return feedbackRows;},
  setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},
  addEventListener:(name,fn)=>events.set(name,fn),
};
ctx.globalThis=ctx;
vm.runInNewContext(bridge,ctx,{filename:'assets/js/current-week-recipe-recommendation-bridge.js',timeout:3000});
const recommended=()=>tableRows.filter(r=>r.cells[0].innerHTML==='<b>推薦</b>').map(r=>r.cells[2].textContent);
ctx.apply();
assert.deepEqual(recommended(),['測試料理1','測試料理2','測試料理3'],
  'baseline real bridge recommends by shortage');
// G6.2 independent inventory invalidation: manual ingredient saves emit
// ingredient_inventory, but legacy badges must refresh without navigating away.
// A stock increase for recipe 5 changes the top-three shortlist from 1/2/3 to 5/1/2.
const catalogSource=readFileSync(new URL('../assets/js/public-catalog-workbench.js',import.meta.url),'utf8');
assert.match(catalogSource,/entity:'ingredient_inventory',operation:'manual_upsert'/,'actual manual ingredient save emits this entity');
assert.ok(events.has('pokemon-sleep:data-changed'),'inventory change listener must be registered');
const scheduledBeforeInventory=scheduled.length;
inventory[4].quantity=5;
events.get('pokemon-sleep:data-changed')({detail:{entity:'ingredient_inventory',operation:'manual_upsert'}});
assert.equal(scheduled.length,scheduledBeforeInventory+1,'ingredient_inventory mutation must enqueue badge recomputation');
scheduled.shift()();
assert.deepEqual([...weeklyRecipeRecommendationNames(analyzeIngredientGaps({recipes,recipeIngredients:ingredients,inventory}),'咖哩、濃湯',[])],['測試料理5','測試料理1','測試料理2'],'ranking must prioritize newly stocked recipe 5');
assert.deepEqual(recommended(),['測試料理1','測試料理2','測試料理5'],'legacy DOM preserves source row order while changing membership');
inventory[4].quantity=0;
ctx.apply();
assert.deepEqual(recommended(),['測試料理1','測試料理2','測試料理3'],'reverted stock restores original recommendations');
const scheduledBeforeUnrelated=scheduled.length;
events.get('pokemon-sleep:data-changed')({detail:{entity:'item_inventory'}});
assert.equal(scheduled.length,scheduledBeforeUnrelated,'unrelated item inventory should not trigger a recipe badge refresh');
feedbackRows=feedback;
assert.ok(events.has('pokemon-sleep:data-changed'),'feedback change listener must be registered');
events.get('pokemon-sleep:data-changed')({detail:{entity:'recipe_feedback_state'}});
assert.ok(scheduled.length,'feedback event must schedule a badge refresh');
scheduled.shift()();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],
  'actual legacy table must not re-badge paused/suspect recipes');
feedbackReadFails=true;
ctx.apply();
assert.deepEqual(recommended(),[],'unavailable feedback authority must withhold reference badges');
assert.ok(warnings.length>0,'fail-closed read must leave an explicit diagnostic');
// Independent G6.2 read-side gap: an inventory query failure used to throw
// after previously rendered badges, leaving stale actionable recommendations.
feedbackReadFails=false;
ctx.apply();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],'recovery establishes previously visible recommendations');
inventoryReadFails=true;
ctx.apply();
assert.deepEqual(recommended(),[],'failed stock query must clear stale badges rather than throw');
assert.equal(table.dataset.weeklyRecommendationStatus,'HOLD_SOURCE_READ_FAILED');
inventoryReadFails=false;
inventoryRows=[...inventory,{ingredient_name:'測試未知',quantity:null}];
ctx.apply();
assert.deepEqual(recommended(),[],'NULL inventory quantity must not silently become zero stock');
inventoryRows=[...inventory,{ingredient_name:'測試未知',quantity:false}];
ctx.apply();
assert.deepEqual(recommended(),[],'boolean inventory quantity must not become zero stock');
inventoryRows=[...inventory,{ingredient_name:'測試未知',quantity:1.5}];
ctx.apply();
assert.deepEqual(recommended(),[],'fractional stock must not become verified integer stock');
inventoryRows=inventory;
ctx.apply();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],'verified inventory recovery re-admits safe feedback-filtered badges');
assert.equal(table.dataset.weeklyRecommendationStatus,'VERIFIED_READ');
assert.ok(warnings.some(msg=>msg.includes('source authority unavailable')),'inventory HOLD needs explicit diagnostic');
// Independent source-bound regression: incomplete or coercible recipe-master
// requirements must never become zero-demand actionable legacy badges.
const verifiedMasterIngredients=masterIngredients;
masterIngredients=ingredients.map((r,i)=>i===0?{...r,quantity:null}:r);
ctx.apply();
assert.deepEqual(recommended(),[],'NULL recipe requirement must withhold all legacy badges');
assert.equal(table.dataset.weeklyRecommendationStatus,'HOLD_SOURCE_READ_FAILED');
masterIngredients=ingredients.map((r,i)=>i===0?{...r,quantity:false}:r);
ctx.apply();
assert.deepEqual(recommended(),[],'boolean recipe requirement must not coerce to zero');
masterIngredients=ingredients.map((r,i)=>i===0?{...r,quantity:0}:r);
ctx.apply();
assert.deepEqual(recommended(),[],'zero recipe requirement is unverified demand');
masterIngredients=ingredients.map((r,i)=>i===0?{...r,quantity:1.5}:r);
ctx.apply();
assert.deepEqual(recommended(),[],'fractional recipe requirement is unverified demand');
masterIngredients=ingredients.slice(1);
ctx.apply();
assert.deepEqual(recommended(),[],'partial recipe ingredient query must not fabricate ready recipes');
masterIngredients=ingredients.map((r,i)=>i===0?{...r,quantity:'1'}:r);
ctx.apply();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],'canonical integer requirement string remains valid');
masterIngredients=verifiedMasterIngredients;
ctx.apply();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],'verified requirement recovery restores feedback-filtered badges');
assert.equal(table.dataset.weeklyRecommendationStatus,'VERIFIED_READ');
assert.equal(table.dataset.weeklyContextAuthority,'SYNTHETIC');
console.log('PASS G62_LEGACY_WEEKLY_BADGE_FEEDBACK_SOURCE_BOUND_VM paused/suspect/malformed/backfill/inventory-change/inventory-read-failure/invalid-stock/invalid-recipe-requirements/partial-requirements/recovery');
console.log('HOLD G62_ANDROID_OWNER_UAT_NOT_VERIFIED');
