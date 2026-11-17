import assert from 'node:assert/strict';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-current-authority.js';
import {NOVEMBER_BANQUET_RECIPE_EVIDENCE,assessNovemberBanquetRecipePromotion} from '../assets/js/g9r-november-recipe-evidence-hold.js';
assert.equal(PUBLIC_RECIPE_MASTER.length,78,'existing ACTIVE recipes must remain 78');
assert.equal(NOVEMBER_BANQUET_RECIPE_EVIDENCE.length,3);
assert.deepEqual(NOVEMBER_BANQUET_RECIPE_EVIDENCE.map(r=>r.total_ingredients),[39,121,91]);
for(const candidate of NOVEMBER_BANQUET_RECIPE_EVIDENCE){
  assert.equal(candidate.active,false);
  assert.equal(candidate.canonical_recipe_name_zh_tw,null);
  assert.equal(candidate.ingredient_quantities,null);
  assert.equal(candidate.level1_base_energy,null);
  assert.equal(candidate.verification_status,'HOLD_FORMULA_AND_NAME_EVIDENCE');
  assert(Object.isFrozen(candidate));
  assert(Object.isFrozen(candidate.ingredient_names));
  assert(candidate.ingredient_names.includes('一口堅果'));
  assert.equal(assessNovemberBanquetRecipePromotion(candidate).status,'HOLD');
  assert.equal(assessNovemberBanquetRecipePromotion(candidate,{in_game_screenshot:'x',structured_reference_crosscheck:'x',canonical_recipe_name_zh_tw:'x',ingredient_quantities:[1],level1_base_energy:1}).reason,'MANUAL_AUTHORITY_REVIEW_REQUIRED');
}
assert.equal(assessNovemberBanquetRecipePromotion({}).reason,'UNRECOGNIZED_CANDIDATE');
console.log('PASS_G9R_NOVEMBER_RECIPE_NONACTIVE_EVIDENCE_HOLD_78_UNCHANGED');
