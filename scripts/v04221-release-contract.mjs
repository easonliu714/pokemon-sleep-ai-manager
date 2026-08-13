import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_FORMULA_AUDIT,
  PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  PUBLIC_RECIPE_FORMULA_MUTATION_POLICY,
  PUBLIC_RECIPE_FORMULA_OVERRIDES,
} from '../assets/js/public-recipe-canonical-authority.js';
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

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-13-a');
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,'public-recipe-formula-audit-2026-08-13-a');
assert.equal(PUBLIC_RECIPE_PROVENANCE_VERSION,'public-recipe-provenance-2026-08-13-a');
assert.equal(PUBLIC_RECIPE_MASTER.length,78);
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT.audited_recipe_count,78);
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT.status,'FULL_CATALOG_REFERENCE_CROSSCHECKED');
assert.equal(PUBLIC_RECIPE_FORMULA_MUTATION_POLICY.ai_may_mutate_formula,false);
assert.equal(PUBLIC_RECIPE_FORMULA_MUTATION_POLICY.manual_review_required,true);
assert.equal(PUBLIC_RECIPE_FORMULA_OVERRIDES.length,0);

const parent=PUBLIC_RECIPE_MASTER.find(row=>row.recipe_id==='curry_parent_child');
assert.ok(parent);
const parentFormula=Object.fromEntries(parent.ingredients.map(row=>[row.ingredient_name,Number(row.quantity)]));
assert.deepEqual(parentFormula,{'特選蘋果':11,'特選蛋':8,'甜甜蜜':12,'窩心洋芋':4});
assert.equal(Object.hasOwn(parentFormula,'好眠番茄'),false);

const coverage=recipeProvenanceCoverage();
assert.equal(coverage.active_recipe_count,78);
assert.equal(coverage.formula_audit_version,PUBLIC_RECIPE_FORMULA_AUDIT_VERSION);

const worker=read('service-worker.js');
assert.ok(worker.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(worker.includes('cache_name:CACHE'));
assert.ok(worker.includes("'./assets/js/public-recipe-canonical-authority.js'"));
assert.ok(worker.includes("'./assets/js/public-recipe-provenance.js'"));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04221_RELEASE_AUTHORITY',
  app_version:authority.app_version,
  app_build:authority.app_build,
  cache_name:authority.cache_name,
  predecessor:'v0.4.22',
  recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  formula_audit_version:PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  provenance_version:PUBLIC_RECIPE_PROVENANCE_VERSION,
  audited_recipe_count:PUBLIC_RECIPE_MASTER.length,
  runtime_formula_override_count:PUBLIC_RECIPE_FORMULA_OVERRIDES.length,
  ai_formula_mutation_allowed:PUBLIC_RECIPE_FORMULA_MUTATION_POLICY.ai_may_mutate_formula,
},null,2));
