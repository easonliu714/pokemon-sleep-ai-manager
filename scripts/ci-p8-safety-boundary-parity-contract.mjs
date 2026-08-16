import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P8_SAFETY_BOUNDARY_PARITY_VERSION='ci-p8-safety-boundary-retirement-2026-08-16-b';
export const P8_SIDE_BY_SIDE_PARITY_PROOF=Object.freeze({
  pr:328,
  fixed_head:'9e000d2a989e67c0e644018641c07bc1406b810c',
  merge_sha:'5282362e895fdf62e43f84bb5038db02693cd8a8',
  triggered_pr_workflows:16,
  predecessor_workflows:8,
  new_successor_workflows:2,
  existing_successor_workflows:1,
  predecessor_and_successor_all_green:true,
  main_push_success:14,
  main_push_failure:0,
  main_push_queued:0,
  main_push_in_progress:0,
  main_push_cancelled:0,
});

const WORKFLOW_DIR='.github/workflows';
const G14_SUCCESSOR='.github/workflows/g14-safety-regression.yml';
const DATA_SUCCESSOR='.github/workflows/data-boundary-regression.yml';
const HISTORICAL_SUCCESSOR='.github/workflows/historical-release-regression.yml';
const HISTORICAL_RUNNER='scripts/ci-historical-release-regression.mjs';
const SYNTAX_WORKFLOW='.github/workflows/js-syntax-check.yml';
const RETIRED_PREDECESSORS=Object.freeze([
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

for(const name of RETIRED_PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),false,`P8 retired workflow reappeared: ${name}`);
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

assert.equal(fs.existsSync(SYNTAX_WORKFLOW),true,'P8 must retain standalone JS syntax boundary');
const syntax=read(SYNTAX_WORKFLOW);
assert.ok(syntax.includes('issues: write'),'standalone syntax failure-notification boundary missing');
assert.ok(syntax.includes("find assets/js -type f -name '*.js'"),'standalone syntax exhaustive assets/js coverage missing');
assert.ok(syntax.includes('Create syntax failure issue'),'standalone syntax failure issue behavior missing');
assert.equal(read('scripts/v0481-live-followup-contract.mjs').includes('P8A parity trigger'),false,'temporary P8A parity trigger comment must be removed after retirement');

assert.equal(P8_SIDE_BY_SIDE_PARITY_PROOF.predecessor_and_successor_all_green,true,'P8 retirement requires recorded fixed-head side-by-side parity');
assert.equal(P8_SIDE_BY_SIDE_PARITY_PROOF.main_push_failure,0,'P8A main push must have zero failures before retirement');
assert.equal(P8_SIDE_BY_SIDE_PARITY_PROOF.main_push_queued,0,'P8A main push must have zero queued workflows before retirement');
assert.equal(P8_SIDE_BY_SIDE_PARITY_PROOF.main_push_in_progress,0,'P8A main push must have zero in-progress workflows before retirement');
assert.equal(P8_SIDE_BY_SIDE_PARITY_PROOF.main_push_cancelled,0,'P8A main push must have zero cancelled workflows before retirement');

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
assert.equal(actual.length,12,'P8 retirement topology must be exactly 12 workflow YAML files');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P8_SAFETY_BOUNDARY_RETIREMENT',
  version:CI_P8_SAFETY_BOUNDARY_PARITY_VERSION,
  phase:'P8B_CONTROLLED_RETIREMENT',
  parity_proof:P8_SIDE_BY_SIDE_PARITY_PROOF,
  retired_workflow_count:RETIRED_PREDECESSORS.length,
  retired_workflows:RETIRED_PREDECESSORS,
  successor_workflows:['g14-safety-regression.yml','data-boundary-regression.yml','historical-release-regression.yml'],
  workflow_count_before_parity:18,
  workflow_count_during_parity:20,
  workflow_count_after_retirement:actual.length,
  net_workflow_reduction_from_p7_baseline:6,
  target_band:'11-14',
  target_band_met:true,
  js_syntax_retirement_evaluated:true,
  js_syntax_retirement_decision:'RETAIN_INDEPENDENT_ISSUES_WRITE_AND_EXHAUSTIVE_ASSETS_JS_BOUNDARY',
  trigger_policy:'PRESERVE_OR_WIDEN_UNION',
  permissions:'READ_ONLY_EXCEPT_EXISTING_SYNTAX_ISSUE_NOTIFICATION_BOUNDARY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
  retirement_allowed:true,
},null,2));
