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
// Independent G6.2 regression: the personal legacy badge surface must use
// the same verified pause/suspect feedback as the reference badge surface.
const personalRecipes=recipes.map(r=>({...r,unlocked:1}));
const personalRows=personalRecipes.map(r=>({
  cells:[{innerHTML:''},{textContent:'—'},{textContent:r.recipe_name}],
  classList:{toggle(name,enabled){assert.equal(name,'weekly-recommended');this.recommended=enabled;}},
}));
const personalTable={dataset:{},querySelectorAll:selector=>{assert.equal(selector,'tbody tr');return personalRows;}};
let personalEnabled=false;
const document={
  readyState:'loading',
  getElementById:id=>id==='referenceRecipeTable'?table:id==='personalRecipeAnalysisTable'&&personalEnabled?personalTable:null,
  addEventListener:(name,fn)=>documentEvents.set(name,fn),
};
let feedbackRows=[],feedbackReadFails=false,inventoryReadFails=false,inventoryRows=inventory,masterIngredients=ingredients;
let rescueReadonly=false,databaseReady=true,sqlReads=0,persistenceStatus='CLEAR';
const ctx={
  document,console:{warn:msg=>warnings.push(msg)},
  rows:sql=>{
    sqlReads++;
    if(sql.startsWith('SELECT ingredient_name,quantity FROM ingredient_inventory')){if(inventoryReadFails)throw Error('synthetic inventory read failure');return inventoryRows;}
    if(sql.startsWith('SELECT recipe_name,unlocked,notes FROM recipes'))return [];
    if(sql.startsWith('SELECT * FROM recipes WHERE unlocked=1'))return personalRecipes.filter(r=>r.unlocked===1);
    if(sql.startsWith('SELECT * FROM recipe_ingredients ORDER BY'))return ingredients;
    if(sql.startsWith('SELECT * FROM recipe_master ORDER BY'))return recipes;
    if(sql.startsWith('SELECT * FROM recipe_master_ingredients ORDER BY'))return masterIngredients;
    throw Error('unexpected SQL: '+sql);
  },
  isDatabaseReady:()=>databaseReady,isRescueReadonly:()=>rescueReadonly,
  currentEffectiveWeeklyContext:()=>({dish_category:'咖哩／濃湯',week_start:'2026-11-02',player_weekly_authority_source:'SYNTHETIC'}),
  normalizeDishCategory,analyzeIngredientGaps,weeklyRecipeRecommendationNames,
  listRecipeAttemptFeedbackSummaries:()=>{if(feedbackReadFails)throw Error('synthetic feedback read failure');return feedbackRows;},
  getRecipeAttemptPersistenceStatus:()=>({status:persistenceStatus}),
  setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},
  addEventListener:(name,fn)=>events.set(name,fn),
};
ctx.globalThis=ctx;
vm.runInNewContext(bridge,ctx,{filename:'assets/js/current-week-recipe-recommendation-bridge.js',timeout:3000});
const recommended=()=>tableRows.filter(r=>r.cells[0].innerHTML==='<b>推薦</b>').map(r=>r.cells[2].textContent);
const personalRecommended=()=>personalRows.filter(r=>r.cells[0].innerHTML==='<b>推薦</b>').map(r=>r.cells[2].textContent);
ctx.apply();
assert.deepEqual(recommended(),['測試料理1','測試料理2','測試料理3'],
  'baseline real bridge recommends by shortage');
// Independent G6.2 source-bound risk: unified recipe-state saves emit 'recipes'.
// Without that listener, an already visible personal badge stays recommended
// after the recipe is marked locked/unavailable until unrelated navigation.
const recipeWorkbenchSource=readFileSync(new URL('../assets/js/recipe-unified-player-workbench.js',import.meta.url),'utf8');
assert.match(recipeWorkbenchSource,/entity:'recipes',operation:'manual_upsert'/,
  'actual recipe state save must emit the tested recipes entity');
personalEnabled=true;
ctx.apply();
assert.deepEqual(personalRecommended(),['測試料理1','測試料理2','測試料理3'],
  'personal baseline must be actionable before recipe state changes');
personalRecipes[0].unlocked=0;
const scheduledBeforeRecipe=scheduled.length;
events.get('pokemon-sleep:data-changed')({detail:{entity:'recipes',operation:'manual_upsert',recipe_id:'fixture-1'}});
assert.equal(scheduled.length,scheduledBeforeRecipe+1,
  'recipe state change must enqueue recomputation of legacy personal badges');
scheduled.shift()();
assert.deepEqual(personalRecommended(),['測試料理2','測試料理3','測試料理4'],
  'locked recipe must lose its stale personal recommendation after recipe-state save');
personalRecipes[0].unlocked=1;
ctx.apply();
assert.deepEqual(personalRecommended(),['測試料理1','測試料理2','測試料理3'],
  'verified recipe state recovery must restore only eligible badges');
personalEnabled=false;

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
// The old personal branch called weeklyRecipeRecommendationNames without
// feedbackRows, silently re-badging recipes 1/2 despite explicit player HOLD.
personalEnabled=true;
ctx.apply();
assert.deepEqual(personalRecommended(),['測試料理3','測試料理4','測試料理5'],
  'personal weekly badges must honor paused and suspect recipe IDs');
assert.equal(personalTable.dataset.weeklyRecommendationStatus,'VERIFIED_READ');
feedbackReadFails=true;
ctx.apply();
assert.deepEqual(recommended(),[],'unavailable feedback authority must withhold reference badges');
assert.deepEqual(personalRecommended(),[],'unavailable feedback authority must also withhold personal badges');
assert.equal(personalTable.dataset.weeklyRecommendationStatus,'HOLD_FEEDBACK_READ_FAILED');
personalEnabled=false;
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
// Independent rescue transition: the same DOM previously displayed verified
// badges, then player DB authority became unavailable. No SQLite read is safe.
const readsBeforeRescue=sqlReads;
rescueReadonly=true;
ctx.apply();
assert.deepEqual(recommended(),[],'rescue readonly must clear previously actionable badges');
assert.equal(table.dataset.weeklyRecommendationStatus,'HOLD_PLAYER_DATABASE_UNAVAILABLE');
assert.equal(sqlReads,readsBeforeRescue,'rescue mode must not query player SQLite');
rescueReadonly=false;
ctx.apply();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],'verified rescue recovery restores safe badges');
const readsBeforeDbLoss=sqlReads;
databaseReady=false;
ctx.apply();
assert.deepEqual(recommended(),[],'DB unavailable must not retain previously verified badges');
assert.equal(table.dataset.weeklyRecommendationStatus,'HOLD_PLAYER_DATABASE_UNAVAILABLE');
assert.equal(sqlReads,readsBeforeDbLoss,'DB unavailable must not query player SQLite');
databaseReady=true;
ctx.apply();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],'verified DB recovery restores safe badges');
assert.equal(table.dataset.weeklyRecommendationStatus,'VERIFIED_READ');
// Independent post-COMMIT/IDB-ACK-loss risk: the writer emits only a
// persistence-uncertain event, NOT data-changed. Legacy badges must be cleared
// synchronously and must not reappear on unrelated later refreshes.
const feedbackWriter=readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
assert.match(feedbackWriter,/pokemon-sleep:recipe-attempt-persistence-uncertain/);
assert.ok(events.has('pokemon-sleep:recipe-attempt-persistence-uncertain'),
  'legacy bridge must subscribe to the actual writer uncertainty event');
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5']);
const readsBeforeUncertain=sqlReads;
persistenceStatus='UNVERIFIED';
events.get('pokemon-sleep:recipe-attempt-persistence-uncertain')({detail:{code:'PERSISTENCE_UNCERTAIN'}});
assert.deepEqual(recommended(),[],'uncertain post-COMMIT feedback must immediately clear old badges');
assert.equal(table.dataset.weeklyRecommendationStatus,'HOLD_FEEDBACK_PERSISTENCE_UNCERTAIN');
assert.equal(sqlReads,readsBeforeUncertain,'uncertain feedback must not read player SQLite');
const beforeRefresh=scheduled.length;
events.get('pokemon-sleep:data-changed')({detail:{entity:'ingredient_inventory'}});
assert.equal(scheduled.length,beforeRefresh+1);
scheduled.at(-1)();
assert.deepEqual(recommended(),[],'unrelated refresh cannot re-admit uncertain feedback');
persistenceStatus='IN_FLIGHT';ctx.apply();
assert.deepEqual(recommended(),[],'in-flight feedback writes must not admit badges');
persistenceStatus='PERSISTED';ctx.apply();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],
  'verified post-reload persistence readback can restore feedback-filtered advice');
persistenceStatus='NOT_PERSISTED';ctx.apply();
assert.deepEqual(recommended(),['測試料理3','測試料理4','測試料理5'],
  'verified post-reload non-persistence readback can restore prior safe advice');
persistenceStatus='CLEAR';

console.log('PASS G62_LEGACY_WEEKLY_BADGE_FEEDBACK_SOURCE_BOUND_VM personal-and-reference-pause-suspect-shared-feedback-fail-closed/paused/suspect/malformed/backfill/recipe-state-change/inventory-change/inventory-read-failure/invalid-stock/invalid-recipe-requirements/partial-requirements/rescue-readonly/db-unavailable/recovery');
console.log('HOLD G62_ANDROID_OWNER_UAT_NOT_VERIFIED');
