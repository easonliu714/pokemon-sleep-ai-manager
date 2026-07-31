import assert from 'node:assert/strict';
import {analyzeIngredientGaps,sortGapResults} from '../assets/js/ingredient-gap-engine.js';

const results=analyzeIngredientGaps({
  recipes:[
    {recipe_id:'r1',recipe_name:'可嘗試料理',unlocked:0,base_energy:1000},
    {recipe_id:'r2',recipe_name:'接近料理',unlocked:0,base_energy:2000},
    {recipe_id:'r3',recipe_name:'已開啟料理',unlocked:1,base_energy:3000},
  ],
  recipeIngredients:[
    {recipe_id:'r1',ingredient_name:'A',quantity:5},
    {recipe_id:'r2',ingredient_name:'A',quantity:10},
    {recipe_id:'r2',ingredient_name:'B',quantity:5},
    {recipe_id:'r3',ingredient_name:'A',quantity:1},
  ],
  inventory:[
    {ingredient_name:'A',quantity:7},
    {ingredient_name:'B',quantity:2},
  ],
});

const ready=results.find(item=>item.recipe_id==='r1');
assert.equal(ready.status,'ready');
assert.equal(ready.can_attempt,true);
assert.equal(ready.total_shortage,0);

const near=results.find(item=>item.recipe_id==='r2');
assert.equal(near.status,'near');
assert.equal(near.total_shortage,6);
assert.deepEqual(near.requirements.map(item=>[item.ingredient_name,item.required,item.owned,item.shortage]),[
  ['A',10,7,3],['B',5,2,3],
]);

const unlocked=results.find(item=>item.recipe_id==='r3');
assert.equal(unlocked.status,'unlocked');
assert.equal(unlocked.can_attempt,false);

assert.equal(sortGapResults(results,'shortage')[0].recipe_id,'r1');
assert.equal(sortGapResults(results,'energy')[0].recipe_id,'r3');
assert.equal(sortGapResults(results,'missing_kinds')[0].recipe_id,'r1');

console.log('PASS ingredient gap engine: exact shortage, status classification, unlocked exclusion flag, deterministic sorting');
