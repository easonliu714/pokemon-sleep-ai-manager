import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_FORMULA_AUDIT,
  PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  PUBLIC_RECIPE_LEVEL1_ENERGY_AUDIT,
  PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION,
  PUBLIC_RECIPE_LEVEL1_ENERGY_AUTHORITY,
  PUBLIC_RECIPE_FORMULA_MUTATION_POLICY,
  PUBLIC_RECIPE_FORMULA_OVERRIDES,
} from '../assets/js/public-recipe-canonical-authority.js';
import {
  RECIPE_LEVEL_MAX,
  RECIPE_LEVEL_BONUS_PERCENT,
  calculateRecipeEnergyById,
} from '../assets/js/recipe-level-energy-contract.js';
import {PUBLIC_RECIPE_PROVENANCE_VERSION,recipeProvenanceCoverage} from '../assets/js/public-recipe-provenance.js';

const read=path=>fs.readFileSync(path,'utf8');
const authoritySource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;
vm.runInNewContext(authoritySource,sandbox,{filename:'assets/js/version-authority.js'});
const authority=sandbox.PokemonSleepVersionAuthority;

assert.deepEqual(JSON.parse(JSON.stringify(authority)),{
  app_version:'v0.4.22.1',
  app_build:'20260813-v04221-recipe-formula-authority-audit',
  cache_name:'pokemon-sleep-ai-v0.4.22.1-v04221-recipe-formula-authority-audit',
  schema:'pokemon-sleep-version-authority/1.0',
});
assert.ok(authoritySource.includes("// app_version: 'v0.4.22'"),'v0.4.22 predecessor bridge missing');
assert.ok(authoritySource.includes("// app_build: '20260813-v0422-g75d-base-berry-output'"),'v0.4.22 predecessor build bridge missing');

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-13-b');
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,'public-recipe-formula-audit-2026-08-13-a');
assert.equal(PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION,'public-recipe-level1-energy-2026-08-13-a');
assert.equal(PUBLIC_RECIPE_PROVENANCE_VERSION,'public-recipe-provenance-2026-08-13-a');
assert.equal(PUBLIC_RECIPE_MASTER.length,78);
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT.audited_recipe_count,78);
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT.status,'FULL_CATALOG_REFERENCE_CROSSCHECKED');
assert.equal(PUBLIC_RECIPE_LEVEL1_ENERGY_AUDIT.audited_recipe_count,78);
assert.equal(PUBLIC_RECIPE_LEVEL1_ENERGY_AUDIT.status,'FULL_CATALOG_LEVEL1_ENERGY_VERIFIED');
assert.equal(PUBLIC_RECIPE_LEVEL1_ENERGY_AUTHORITY.length,78);
assert.equal(RECIPE_LEVEL_MAX,70);
assert.equal(RECIPE_LEVEL_BONUS_PERCENT.length,70);
assert.equal(PUBLIC_RECIPE_FORMULA_MUTATION_POLICY.ai_may_mutate_formula,false);
assert.equal(PUBLIC_RECIPE_FORMULA_MUTATION_POLICY.manual_review_required,true);
assert.equal(PUBLIC_RECIPE_FORMULA_OVERRIDES.length,0);

for(const recipe of PUBLIC_RECIPE_MASTER){
  assert.ok(Number.isInteger(recipe.level1_energy)&&recipe.level1_energy>0,`Lv1 energy missing: ${recipe.recipe_id}`);
  assert.equal(Number(recipe.base_energy),Number(recipe.level1_energy),`base/Lv1 energy mismatch: ${recipe.recipe_id}`);
}

const parent=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_id==='curry_parent_child');
assert.ok(parent);
const parentFormula=Object.fromEntries(parent.ingredients.map(row=>[row.ingredient_name,Number(row.quantity)]));
assert.deepEqual(parentFormula,{'特選蘋果':11,'特選蛋':8,'甜甜蜜':12,'窩心洋芋':4});
assert.equal(Object.hasOwn(parentFormula,'好眠番茄'),false);
assert.equal(calculateRecipeEnergyById('curry_parent_child',25),6649);
assert.equal(calculateRecipeEnergyById('recipe_curry_015',20),2902);

const coverage=recipeProvenanceCoverage();
assert.equal(coverage.active_recipe_count,78);
assert.equal(coverage.formula_audit_version,PUBLIC_RECIPE_FORMULA_AUDIT_VERSION);

const worker=read('service-worker.js');
assert.ok(worker.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(worker.includes('cache_name:CACHE'));
assert.ok(worker.includes("'./assets/js/public-recipe-canonical-authority.js'"));
assert.ok(worker.includes("'./assets/js/public-recipe-provenance.js'"));
const catalog=read('assets/js/public-catalog-workbench.js');
assert.ok(catalog.includes("import './recipe-level-energy-autofill.js'"),'recipe level energy UI bootstrap missing');
const autofill=read('assets/js/recipe-level-energy-autofill.js');
assert.ok(autofill.includes('calculateRecipeEnergyById'),'recipe level energy autofill calculator missing');
assert.ok(autofill.includes(".canonical-recipe-level"),'recipe level field binding missing');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04221_RELEASE_AUTHORITY',
  app_version:authority.app_version,
  app_build:authority.app_build,
  cache_name:authority.cache_name,
  predecessor:'v0.4.22',
  recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  formula_audit_version:PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  level1_energy_version:PUBLIC_RECIPE_LEVEL1_ENERGY_VERSION,
  provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  audited_recipe_count:PUBLIC_RECIPE_MASTER.length,
  recipe_level_max:RECIPE_LEVEL_MAX,
  runtime_formula_override_count:PUBLIC_RECIPE_FORMULA_OVERRIDES.length,
  ai_formula_mutation_allowed:PUBLIC_RECIPE_FORMULA_MUTATION_POLICY.ai_may_mutate_formula,
},null,2));