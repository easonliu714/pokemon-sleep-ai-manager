import fs from 'node:fs';
import assert from 'node:assert/strict';

const dedup=fs.readFileSync('assets/js/identity-dedup.js','utf8');
const recipeGuard=fs.readFileSync('assets/js/recipe-render-guard.js','utf8');
const shared=fs.readFileSync('assets/js/shared-knowledge-ui.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

assert.match(dedup,/exact canonical\/private duplicate/);
assert.match(dedup,/unique strong identity replaces weak placeholder/);
assert.match(dedup,/matches\.length!==1/);
assert.match(dedup,/identity_review_required\|\|0\)===1/);
assert.match(dedup,/identity_confidence\|\|0\)>=0\.95/);
assert.match(dedup,/snapshot\(`identity-merge-v2:/);
assert.match(dedup,/begin\(\)/);
assert.match(dedup,/commit\(\)/);
assert.match(dedup,/rollback\(\)/);
assert.match(dedup,/MERGEABLE_FIELDS/);
assert.match(dedup,/main_skill_level/);
assert.match(dedup,/helper_seconds/);
assert.match(dedup,/carry_limit/);
assert.match(dedup,/INSERT OR IGNORE INTO pokemon_ingredients/);
assert.match(dedup,/INSERT OR IGNORE INTO pokemon_subskills/);
assert.match(dedup,/UPDATE pokemon_history SET pokemon_id/);
assert.match(dedup,/UPDATE pokemon_identity_evidence SET pokemon_instance_id/);
assert.match(dedup,/UPDATE pokemon_evolution_history SET pokemon_instance_id/);
assert.match(dedup,/identity_review_required=0/);
assert.match(dedup,/automatic_duplicate_convergence_v2/);
assert.match(dedup,/SYSTEM-IDENTITY-MERGE-v0\.3\.26/);
assert.match(dedup,/status='archived'/);

assert.match(recipeGuard,/MutationObserver/);
assert.match(recipeGuard,/headers\.length===3/);
assert.match(recipeGuard,/headers\[2\]==='已開啟'/);
assert.match(recipeGuard,/renderSharedKnowledge\(true\)/);
assert.match(shared,/renderSharedKnowledge\(force=false\)/);
assert.match(shared,/if\(!force&&signature===lastSignature\)return/);

assert.match(bootstrap,/APP_VERSION = 'v0\.3\.26'/);
assert.match(bootstrap,/20260731-identity-merge-v2/);
assert.match(bootstrap,/'identity-dedup\.js'/);
assert.match(bootstrap,/'recipe-render-guard\.js'/);
assert.match(sw,/pokemon-sleep-ai-v0\.3\.26-identity-merge-v2/);
assert.match(sw,/identity-dedup\.js/);
assert.match(sw,/recipe-render-guard\.js/);

console.log('PASS transactional identity merge v2 and recipe render guard regression');
