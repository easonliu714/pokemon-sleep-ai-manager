import assert from 'node:assert/strict';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_LEVEL1_ENERGY_AUTHORITY,
} from '../assets/js/public-recipe-canonical-authority.js';
import {
  RECIPE_LEVEL_MAX,
  RECIPE_LEVEL_BONUS_PERCENT,
  calculateRecipeEnergyById,
  buildRecipeLevelEnergyTable,
} from '../assets/js/recipe-level-energy-contract.js';

assert.equal(PUBLIC_RECIPE_MASTER.length,78,'canonical recipe count');
assert.equal(PUBLIC_RECIPE_LEVEL1_ENERGY_AUTHORITY.length,78,'Lv.1 energy authority count');
assert.equal(RECIPE_LEVEL_MAX,70,'official recipe level cap');
assert.equal(RECIPE_LEVEL_BONUS_PERCENT.length,70,'level bonus table coverage');
assert.equal(RECIPE_LEVEL_BONUS_PERCENT[0],0,'Lv.1 bonus');
assert.equal(RECIPE_LEVEL_BONUS_PERCENT[69],258,'Lv.70 bonus');

for(const recipe of PUBLIC_RECIPE_MASTER){
  assert.ok(Number.isInteger(recipe.level1_energy)&&recipe.level1_energy>0,`${recipe.recipe_id} level1 energy`);
  assert.equal(recipe.base_energy,recipe.level1_energy,`${recipe.recipe_id} base/Lv1 semantic parity`);
  const table=buildRecipeLevelEnergyTable(recipe.recipe_id);
  assert.equal(table.length,70,`${recipe.recipe_id} 70-level table`);
  assert.equal(table[0].energy,recipe.level1_energy,`${recipe.recipe_id} Lv1 table parity`);
}

// Current in-game screenshot parity samples.
assert.equal(calculateRecipeEnergyById('curry_parent_child',25),6649,'親子愛咖哩 Lv25');
assert.equal(calculateRecipeEnergyById('recipe_curry_015',20),2902,'入口即化蛋捲咖哩 Lv20 half-even boundary');
assert.equal(calculateRecipeEnergyById('curry_apple',11),890,'特選蘋果咖哩 Lv11');
assert.equal(calculateRecipeEnergyById('recipe_curry_014',16),2486,'日照炸肉排咖哩 Lv16');

console.log(JSON.stringify({
  status:'PASS',
  recipe_count:PUBLIC_RECIPE_MASTER.length,
  level_max:RECIPE_LEVEL_MAX,
  level_bonus_rows:RECIPE_LEVEL_BONUS_PERCENT.length,
  screenshot_parity_samples:4,
}));
