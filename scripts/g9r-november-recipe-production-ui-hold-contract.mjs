// G9R: source-bound, read-only visibility gate. A pending formula must never enter ACTIVE recipes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-current-authority.js';
import {NOVEMBER_BANQUET_RECIPE_EVIDENCE} from '../assets/js/g9r-november-recipe-evidence-hold.js';
const html=readFileSync('index.html','utf8');
const section=html.match(/<section id="recipes" class="view">([\s\S]*?)<\/section>/)?.[1];
assert.ok(section,'production recipe page must exist');
assert.match(section,/id="novemberBanquetRecipeHold"/,'production recipe page must visibly identify pending recipes');
for(const row of NOVEMBER_BANQUET_RECIPE_EVIDENCE){
  assert.ok(section.includes(String(row.total_ingredients)),`missing official total ${row.total_ingredients}`);
  for(const ingredient of row.ingredient_names)assert.ok(section.includes(ingredient),`missing ingredient ${ingredient}`);
}
assert.match(section,/尚待核實/);
assert.match(section,/非正式食譜/);
assert.equal(PUBLIC_RECIPE_MASTER.length,78,'pending recipes must not enter ACTIVE authority');
assert.equal(NOVEMBER_BANQUET_RECIPE_EVIDENCE.every(row=>row.active===false),true);
assert.equal(html.includes('id="novemberBanquetRecipeHold"'),true);
console.log('PASS_G9R_NOVEMBER_RECIPE_PRODUCTION_UI_HOLD_78_ACTIVE_UNCHANGED');
