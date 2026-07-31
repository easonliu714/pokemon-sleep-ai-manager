import fs from 'node:fs';
import assert from 'node:assert/strict';

const dedup=fs.readFileSync('assets/js/identity-dedup.js','utf8');
const recipeGuard=fs.readFileSync('assets/js/recipe-render-guard.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

assert.match(dedup,/exact canonical\/private duplicate/);
assert.match(dedup,/unique strong identity replaces weak placeholder/);
assert.match(dedup,/matches\.length!==1/);
assert.match(dedup,/identity_review_required\|\|0\)===1/);
assert.match(dedup,/identity_confidence\|\|0\)>=0\.95/);
assert.match(dedup,/snapshot\(`identity-dedup:/);
assert.match(dedup,/status='archived'/);
assert.match(dedup,/automatic_duplicate_convergence/);
assert.match(dedup,/INSERT OR IGNORE INTO pokemon_ingredients/);
assert.match(dedup,/INSERT OR IGNORE INTO pokemon_subskills/);

assert.match(recipeGuard,/MutationObserver/);
assert.match(recipeGuard,/headers\.length===3/);
assert.match(recipeGuard,/headers\[2\]==='已開啟'/);
assert.match(recipeGuard,/renderSharedKnowledge\(\)/);

assert.match(bootstrap,/APP_VERSION = 'v0\.3\.24'/);
assert.match(bootstrap,/'identity-dedup\.js'/);
assert.match(bootstrap,/'recipe-render-guard\.js'/);
assert.match(sw,/pokemon-sleep-ai-v0\.3\.24-identity-dedup-recipe-guard/);
assert.match(sw,/identity-dedup\.js/);
assert.match(sw,/recipe-render-guard\.js/);

console.log('PASS identity dedup and recipe render guard regression');
