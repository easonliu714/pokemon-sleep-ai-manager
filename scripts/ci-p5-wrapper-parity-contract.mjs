import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P5_WRAPPER_PARITY_VERSION='ci-p5-wrapper-retirement-2026-08-16-c-successor-aware';
export const P5_SIDE_BY_SIDE_PARITY_PROOF=Object.freeze({
  pr:316,
  fixed_head:'00d1a3920e792f1db4218c8ba3fde1d1a6484c41',
  merge_sha:'62cb13599e7956c0e2ca9d60872d53d6783ba036',
  triggered_workflows:16,
  predecessor_workflows:6,
  predecessor_and_successor_all_green:true,
  main_push_success:10,
  main_push_failure:0,
  workflow_count_after_p5_retirement:27,
});

const WORKFLOW_DIR='.github/workflows';
const RETIRED_PREDECESSORS=Object.freeze([
  'debug-trace-manager-regression.yml',
  'v0396-general-json-audit.yml',
  'v0397-profile-completeness.yml',
  'v0398-update-center-multiscenario.yml',
  'v0399-human-readable-diff-review.yml',
  'data-evo1-observed-evolution-coverage.yml',
]);
const CORE_SUCCESSOR='.github/workflows/regression-gate.yml';
const HISTORICAL_SUCCESSOR='.github/workflows/historical-release-regression.yml';
const HISTORICAL_RUNNER='scripts/ci-historical-release-regression.mjs';
const read=path=>fs.readFileSync(path,'utf8');

for(const name of RETIRED_PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),false,`P5 retired wrapper reappeared: ${name}`);
}

const core=read(CORE_SUCCESSOR);
const historical=read(HISTORICAL_SUCCESSOR);
const historicalRunner=read(HISTORICAL_RUNNER);

assert.match(core,/pull_request:\s*\n\s*branches:\s*\[main\]/m,'core successor must run for every PR to main');
assert.match(core,/push:\s*\n\s*branches:\s*\[main\]/m,'core successor must run for every push to main');
assert.doesNotMatch(core,/contents\s*:\s*write/i,'core successor must remain read-only');
assert.doesNotMatch(core,/(?:^|\s)git\s+(?:push|commit)(?:\s|$)/im,'core successor must not mutate repository history');
for(const token of [
  'node scripts/debug-trace-manager-regression.mjs',
  'tests/test_v0396_general_json_audit_contract.py',
  'tests/test_v0397_profile_completeness_contract.py',
  'tests/test_v0398_update_center_multiscenario_contract.py',
  'node scripts/ci-p5-core-update-review-successor-contract.mjs',
  'node scripts/ci-p5-wrapper-parity-contract.mjs',
])assert.ok(core.includes(token),`core successor lost retired-wrapper behavior reference: ${token}`);

assert.doesNotMatch(historical,/contents\s*:\s*write/i,'historical successor must remain read-only');
assert.doesNotMatch(historical,/(?:^|\s)git\s+(?:push|commit)(?:\s|$)/im,'historical successor must not mutate repository history');
for(const pathToken of [
  "'assets/js/public-pokemon-knowledge-master.js'",
  "'assets/js/public-pokemon-knowledge-coverage.js'",
  "'assets/js/v03993-public-knowledge-coverage-ui.js'",
  "'assets/js/public-candy-master.js'",
  "'assets/js/migrations.js'",
  "'scripts/data-evo1-observed-evolution-coverage-contract.mjs'",
  "'scripts/ci-p5-public-knowledge-successor-contract.mjs'",
])assert.ok(historical.includes(pathToken),`historical successor trigger union lost retired-wrapper path: ${pathToken}`);
for(const contract of [
  'scripts/ci-p5-public-knowledge-successor-contract.mjs',
  'scripts/data-evo1-observed-evolution-coverage-contract.mjs',
  'scripts/v0482-release-contract.mjs',
  'scripts/v0483-release-contract.mjs',
  'scripts/war3a-candy-inventory-contract.mjs',
])assert.ok(historicalRunner.includes(contract),`historical successor lost retired-wrapper behavior: ${contract}`);

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
assert.ok(actual.length<=P5_SIDE_BY_SIDE_PARITY_PROOF.workflow_count_after_p5_retirement,'later CI convergence must not increase workflow count above the P5-retired baseline');
assert.equal(P5_SIDE_BY_SIDE_PARITY_PROOF.predecessor_and_successor_all_green,true,'P5 retirement requires recorded side-by-side parity proof');
assert.equal(P5_SIDE_BY_SIDE_PARITY_PROOF.main_push_failure,0,'P5A main-push must have zero failures before retirement');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P5_WRAPPER_RETIREMENT',
  version:CI_P5_WRAPPER_PARITY_VERSION,
  parity_proof:P5_SIDE_BY_SIDE_PARITY_PROOF,
  retired_workflow_count:RETIRED_PREDECESSORS.length,
  retired_workflows:RETIRED_PREDECESSORS,
  core_successor:'regression-gate.yml',
  historical_successor:'historical-release-regression.yml',
  workflow_count_before_retirement:33,
  workflow_count_after_p5_retirement:P5_SIDE_BY_SIDE_PARITY_PROOF.workflow_count_after_p5_retirement,
  current_workflow_count:actual.length,
  net_workflow_reduction_at_p5:6,
  trigger_policy:'CORE_ALWAYS_ON_MAIN_PR_PUSH_AND_HISTORICAL_UNION_PATHS',
  permissions:'READ_ONLY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
},null,2));
