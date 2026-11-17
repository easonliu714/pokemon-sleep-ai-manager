// G9R negative-first: prevent the production Recipes HOLD display from drifting
// away from the sole non-ACTIVE evidence register when official evidence changes.
// This contract never promotes a recipe or touches player storage.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NOVEMBER_BANQUET_RECIPE_EVIDENCE as candidates} from '../assets/js/g9r-november-recipe-evidence-hold.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const hold=html.match(/<aside id="novemberBanquetRecipeHold"[^>]*>([\s\S]*?)<\/aside>/)?.[1];
assert.ok(hold,'production Recipes HOLD section must exist');
assert.equal(candidates.length,3);
for(const row of candidates){
  assert.equal(row.active,false);
  assert.equal(row.verification_status,'HOLD_FORMULA_AND_NAME_EVIDENCE');
  assert.ok(hold.includes(String(row.total_ingredients)),`missing official total ${row.total_ingredients}`);
  for(const name of row.ingredient_names)assert.ok(hold.includes(name),`missing ${name}`);
}
// A static duplicate can pass the checks above today and silently drift tomorrow.
// Require the production view to be rendered from the evidence register itself.
assert.match(html,/g9r-november-recipe-hold-ui\.js/,'production page must load source-bound HOLD renderer');
assert.doesNotMatch(hold,/萌綠玉米|暖暖薑|特選蛋/,'production markup must not duplicate evidence identities');
console.log('PASS_G9R_RECIPE_HOLD_SOURCE_BOUND_RENDERER');
