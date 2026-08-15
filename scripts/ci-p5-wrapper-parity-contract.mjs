import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P5_WRAPPER_PARITY_VERSION='ci-p5-wrapper-parity-2026-08-15-a';

const WORKFLOW_DIR='.github/workflows';
const PREDECESSORS=Object.freeze([
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

for(const name of PREDECESSORS)assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),true,`P5 parity phase requires predecessor wrapper to remain present: ${name}`);

const core=read(CORE_SUCCESSOR);
const historical=read(HISTORICAL_SUCCESSOR);
const historicalRunner=read(HISTORICAL_RUNNER);

// Core successor deliberately widens trigger coverage: every main PR/push runs it.
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
])assert.ok(core.includes(token),`core successor missing predecessor behavior reference: ${token}`);

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
])assert.ok(historical.includes(pathToken),`historical successor trigger union missing: ${pathToken}`);
for(const contract of [
  'scripts/ci-p5-public-knowledge-successor-contract.mjs',
  'scripts/data-evo1-observed-evolution-coverage-contract.mjs',
  'scripts/v0482-release-contract.mjs',
  'scripts/v0483-release-contract.mjs',
  'scripts/war3a-candy-inventory-contract.mjs',
])assert.ok(historicalRunner.includes(contract),`historical successor runner missing predecessor behavior: ${contract}`);

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
assert.equal(actual.length,33,'P5 parity phase must not retire wrappers before side-by-side CI passes');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P5_WRAPPER_SIDE_BY_SIDE_PARITY',
  version:CI_P5_WRAPPER_PARITY_VERSION,
  predecessor_workflow_count:PREDECESSORS.length,
  predecessor_workflows:PREDECESSORS,
  core_successor:'regression-gate.yml',
  historical_successor:'historical-release-regression.yml',
  workflow_count_before_retirement:actual.length,
  trigger_policy:'CORE_ALWAYS_ON_MAIN_PR_PUSH_AND_HISTORICAL_UNION_PATHS',
  permissions:'READ_ONLY',
  repository_mutation:false,
  side_by_side_parity_ready:true,
},null,2));
