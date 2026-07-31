import fs from 'node:fs';
import assert from 'node:assert/strict';

const dedup=fs.readFileSync('assets/js/identity-dedup.js','utf8');
const evidence=fs.readFileSync('assets/js/identity-evidence-builder.js','utf8');
const recipeGuard=fs.readFileSync('assets/js/recipe-render-guard.js','utf8');
const shared=fs.readFileSync('assets/js/shared-knowledge-ui.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

assert.match(dedup,/snapshot\(`identity-merge-v2:/);
assert.match(dedup,/begin\(\)/);
assert.match(dedup,/commit\(\)/);
assert.match(dedup,/rollback\(\)/);
assert.match(dedup,/INSERT OR IGNORE INTO pokemon_ingredients/);
assert.match(dedup,/INSERT OR IGNORE INTO pokemon_subskills/);
assert.match(dedup,/status='archived'/);

assert.match(evidence,/buildAbilitySignature/);
assert.match(evidence,/\[1,30,60\]\.every/);
assert.match(evidence,/\[10,25,50,70,80\]\.every/);
assert.match(evidence,/counts\.get\(item\.fingerprint\)===1/);
assert.match(evidence,/identity_confidence=0\.96/);
assert.match(evidence,/identity_review_required=0/);
assert.match(evidence,/ability_fingerprint/);
assert.match(evidence,/SYSTEM-IDENTITY-EVIDENCE-BUILDER-v0\.3\.27/);
assert.match(evidence,/snapshot\(`identity-evidence-builder:/);
assert.match(evidence,/begin\(\)/);
assert.match(evidence,/commit\(\)/);
assert.match(evidence,/rollback\(\)/);
assert.doesNotMatch(evidence,/registered_at=\?/,'builder must not invent registered_at');

assert.match(recipeGuard,/MutationObserver/);
assert.match(recipeGuard,/renderSharedKnowledge\(true\)/);
assert.match(shared,/renderSharedKnowledge\(force=false\)/);

assert.match(bootstrap,/APP_VERSION = 'v0\.3\.27'/);
assert.match(bootstrap,/20260731-identity-evidence-builder1/);
assert.match(bootstrap,/'identity-evidence-builder\.js'/);
assert.match(sw,/pokemon-sleep-ai-v0\.3\.27-identity-evidence-builder/);
assert.match(sw,/identity-evidence-builder\.js/);

console.log('PASS identity merge, evidence builder, and recipe render guard regression');
