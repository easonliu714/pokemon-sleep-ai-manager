import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P8_SAFETY_BOUNDARY_PARITY_VERSION='ci-p8-safety-boundary-parity-2026-08-16-a';

const WORKFLOW_DIR='.github/workflows';
const G14_SUCCESSOR='.github/workflows/g14-safety-regression.yml';
const DATA_SUCCESSOR='.github/workflows/data-boundary-regression.yml';
const HISTORICAL_SUCCESSOR='.github/workflows/historical-release-regression.yml';
const HISTORICAL_RUNNER='scripts/ci-historical-release-regression.mjs';
const SYNTAX_WORKFLOW='.github/workflows/js-syntax-check.yml';
const PREDECESSORS=Object.freeze([
  'g14-backup-truth-restore.yml',
  'g14-data-consistency-multicapture.yml',
  'g14-full75-recovery.yml',
  'g14-public-catalog-renderer-authority.yml',
  'privacy-guard.yml',
  'public-pages-empty-profile.yml',
  'v0481-live-followup.yml',
  'v0484-touch-first-camp-containment.yml',
]);
const read=path=>fs.readFileSync(path,'utf8');

for(const name of PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),true,`P8 parity predecessor missing before side-by-side proof: ${name}`);
}
for(const successor of [G14_SUCCESSOR,DATA_SUCCESSOR,HISTORICAL_SUCCESSOR]){
  assert.equal(fs.existsSync(successor),true,`P8 successor missing: ${successor}`);
}

const g14=read(G14_SUCCESSOR);
assert.doesNotMatch(g14,/contents\s*:\s*write/i,'G14 successor must remain read-only');
assert.match(g14,/pull_request:/m,'G14 successor must preserve all-PR coverage');
assert.match(g14,/push:/m,'G14 successor must preserve push coverage');
assert.ok(g14.includes('- main'),'G14 successor must include main push');
assert.ok(g14.includes("- 'feat/**'"),'G14 successor must deliberately widen legacy feat/v0377a branch coverage to feat/**');
for(const job of ['backup-truth-restore:','data-consistency-multicapture:','full75-recovery:','public-catalog-authority:']){
  assert.ok(g14.includes(job),`G14 successor lost independent job: ${job}`);
}
for(const token of [
  'python tests/test_g14_backup_truth_restore.py',
  'node --check assets/js/backup-truth-restore.js',
  'node --check assets/js/data-consistency-multicapture.js',
  "['capture groups',/activeGroupId/]",
  'grep -q "total: 821" assets/js/full75-recovery-contract.js',
  'grep -q "review_required" assets/js/full75-recovery-engine.js',
  'python tests/test_g14_public_catalog_renderer_authority.py',
  'node --check assets/js/public-catalog-workbench.js',
])assert.ok(g14.includes(token),`G14 successor lost predecessor behavior: ${token}`);

const data=read(DATA_SUCCESSOR);
assert.doesNotMatch(data,/contents\s*:\s*write/i,'data-boundary successor must remain read-only');
assert.match(data,/pull_request:/m,'data-boundary successor must preserve PR coverage');
assert.match(data,/push:/m,'data-boundary successor must preserve push coverage');
for(const job of ['private-data-guard:','empty-player-public-pages:']){
  assert.ok(data.includes(job),`data-boundary successor lost independent job: ${job}`);
}
for(const token of [
  'fetch-depth: 0',
  'Reject private account artifacts',
  'pokemon_sleep_full\\.json$',
  'Verify public/private data separation',
  "'player tables untouched': 'player_tables_untouched:true' in defaults",
  "'runtime uses controlled recipe sync'",
  'Public profile privacy contract failed',
])assert.ok(data.includes(token),`data-boundary successor lost predecessor behavior: ${token}`);

const historical=read(HISTORICAL_SUCCESSOR);
const historicalRunner=read(HISTORICAL_RUNNER);
assert.doesNotMatch(historical,/contents\s*:\s*write/i,'historical successor must remain read-only');
for(const pathToken of [
  "'assets/js/weekly-context-*.js'",
  "'assets/js/camp-berry-knowledge-ui.js'",
  "'assets/js/public-pokemon-knowledge-master.js'",
  "'assets/js/public-pokemon-knowledge-coverage.js'",
  "'scripts/v04*.mjs'",
  "'scripts/ci-p8-safety-boundary-parity-contract.mjs'",
])assert.ok(historical.includes(pathToken),`historical successor trigger union lost v0.4.8 path: ${pathToken}`);
for(const contract of [
  'scripts/v0485-release-contract.mjs',
  'scripts/v0484-release-contract.mjs',
  'scripts/v0483-release-contract.mjs',
  'scripts/v0481-release-contract.mjs',
  'scripts/v0481-live-followup-contract.mjs',
  'scripts/v048-release-contract.mjs',
  'scripts/war3b-typed-event-effect-registry-contract.mjs',
  'scripts/war3a-candy-inventory-contract.mjs',
  'scripts/v0463-weekly-ai-type-repair-contract.mjs',
  'scripts/v0461-weekly-context-integration-contract.mjs',
  'scripts/v0461-release-contract.mjs',
])assert.ok(historicalRunner.includes(contract),`historical successor lost v0.4.8 predecessor behavior: ${contract}`);
for(const syntaxToken of [
  'node --check assets/js/version-authority.js',
  'node --check assets/js/weekly-context-manual-override.js',
  'node --check assets/js/weekly-context-store.js',
  'node --check assets/js/weekly-context-ui-bridge.js',
  'node --check assets/js/camp-berry-knowledge-ui.js',
  'node --check scripts/v0481-live-followup-contract.mjs',
  'node --check scripts/v0481-release-contract.mjs',
  'node --check scripts/v048-release-contract.mjs',
  'node --check scripts/v0484-release-contract.mjs',
  'node --check scripts/v0483-release-contract.mjs',
])assert.ok(historical.includes(syntaxToken),`historical successor lost wrapper syntax behavior: ${syntaxToken}`);

// P8 explicitly evaluates standalone all-assets JS syntax but does not retire it:
// it owns issues:write failure-notification behavior and exhaustive assets/js coverage,
// which is a distinct boundary from read-only domain runners.
assert.equal(fs.existsSync(SYNTAX_WORKFLOW),true,'P8 must retain standalone JS syntax boundary');
const syntax=read(SYNTAX_WORKFLOW);
assert.ok(syntax.includes('issues: write'),'standalone syntax failure-notification boundary missing');
assert.ok(syntax.includes("find assets/js -type f -name '*.js'"),'standalone syntax exhaustive assets/js coverage missing');
assert.ok(syntax.includes('Create syntax failure issue'),'standalone syntax failure issue behavior missing');

assert.ok(read('scripts/v0481-live-followup-contract.mjs').includes('P8A parity trigger'),'v0481/v0484 fixed-head parity trigger marker missing');

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
assert.equal(actual.length,20,'P8A parity stage must keep 18 predecessors/current workflows plus exactly two new safety successors');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P8_SAFETY_BOUNDARY_PARITY_CONFIGURATION',
  version:CI_P8_SAFETY_BOUNDARY_PARITY_VERSION,
  phase:'P8A_SIDE_BY_SIDE_PARITY',
  predecessor_workflows:PREDECESSORS,
  predecessor_count:PREDECESSORS.length,
  new_successor_workflows:['g14-safety-regression.yml','data-boundary-regression.yml'],
  existing_successor_for_v048:['historical-release-regression.yml'],
  workflow_count_before_parity:18,
  workflow_count_during_parity:actual.length,
  expected_post_retirement_count:12,
  js_syntax_retirement_evaluated:true,
  js_syntax_retirement_decision:'RETAIN_INDEPENDENT_ISSUES_WRITE_AND_EXHAUSTIVE_ASSETS_JS_BOUNDARY',
  trigger_policy:'PRESERVE_OR_WIDEN_UNION',
  permissions:'READ_ONLY_EXCEPT_EXISTING_SYNTAX_ISSUE_NOTIFICATION_BOUNDARY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
  retirement_allowed:false,
  retirement_gate:'REQUIRES_FIXED_HEAD_EIGHT_PREDECESSORS_PLUS_SUCCESSORS_ALL_GREEN_AND_POST_MERGE_MAIN_ZERO_FAILURE',
},null,2));
