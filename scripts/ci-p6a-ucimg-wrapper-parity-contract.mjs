import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P6A_UCIMG_WRAPPER_PARITY_VERSION='ci-p6a-ucimg-wrapper-parity-2026-08-16-a';

const WORKFLOW_DIR='.github/workflows';
const SUCCESSOR='.github/workflows/uc-img-a.yml';
const PREDECESSORS=Object.freeze([
  'v04133-shared-gemini-transport-diagnostic.yml',
  'v04134-recipe-pot-scenario-contract.yml',
  'v04135-account-capacity-apply-not-null.yml',
  'v04136-pot-manual-authority-alignment.yml',
]);
const read=path=>fs.readFileSync(path,'utf8');

for(const name of PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),true,`P6A parity predecessor missing before side-by-side proof: ${name}`);
}
assert.equal(fs.existsSync(SUCCESSOR),true,'P6A UC.IMG successor missing');

const successor=read(SUCCESSOR);
assert.doesNotMatch(successor,/contents\s*:\s*write/i,'P6A successor must remain read-only');
assert.doesNotMatch(successor,/(?:^|\s)git\s+(?:push|commit)(?:\s|$)/im,'P6A successor must not mutate repository history');
assert.match(successor,/pull_request:/m,'P6A successor must preserve PR coverage');
assert.match(successor,/push:/m,'P6A successor must preserve predecessor push coverage');
assert.ok(successor.includes("- main"),'P6A successor push coverage must include main');
assert.ok(successor.includes("- 'hotfix/**'"),'P6A successor push coverage must preserve hotfix/** from v0.4.13.5/.6 wrappers');
assert.match(successor,/workflow_dispatch:/m,'P6A successor must preserve manual dispatch');

for(const token of [
  "'assets/js/ai-project-pool-runtime.js'",
  "'assets/js/uc-img-gemini-adapter.js'",
  "'assets/js/unified-screenshot-update-center.js'",
  "'assets/js/ai-workflow.js'",
  "'assets/js/public-master-recognition.js'",
  "'assets/js/pot-capacity-authority.js'",
  "'assets/js/importer.js'",
  "'assets/js/schema.js'",
  "'assets/js/weekly-context-ui-bridge.js'",
  "'assets/js/weekly-context-store.js'",
  "'assets/js/weekly-context-manual-override.js'",
  "'scripts/v04133-shared-gemini-transport-diagnostic-contract.mjs'",
  "'scripts/v04134-recipe-pot-scenario-contract.mjs'",
  "'scripts/v04135-account-capacity-apply-not-null-contract.mjs'",
  "'scripts/v04136-pot-manual-authority-alignment-contract.mjs'",
  "'scripts/ci-p6a-ucimg-wrapper-parity-contract.mjs'",
])assert.ok(successor.includes(token),`P6A successor trigger union lost predecessor path: ${token}`);

for(const command of [
  'node scripts/v04133-shared-gemini-transport-diagnostic-contract.mjs',
  'node scripts/uc-img-internal-gemini-contract.mjs',
  'node scripts/v04114-recipe-zh-tw-diagnostic-export-contract.mjs',
  'node scripts/v04134-recipe-pot-scenario-contract.mjs',
  'node scripts/v04135-account-capacity-apply-not-null-contract.mjs',
  'node scripts/v04136-pot-manual-authority-alignment-contract.mjs',
  'node --check assets/js/weekly-context-ui-bridge.js',
  'node scripts/ci-p6a-ucimg-wrapper-parity-contract.mjs',
])assert.ok(successor.includes(command),`P6A successor lost predecessor behavior: ${command}`);

for(const name of PREDECESSORS){
  const predecessor=read(`${WORKFLOW_DIR}/${name}`);
  assert.match(predecessor,/pull_request:/m,`${name} must participate in P6A side-by-side PR parity`);
  assert.ok(predecessor.includes("'scripts/ci-p6a-ucimg-wrapper-parity-contract.mjs'"),`${name} PR trigger must include P6A parity contract`);
  assert.ok(predecessor.includes("'.github/workflows/uc-img-a.yml'"),`${name} PR trigger must include successor workflow changes`);
  assert.doesNotMatch(predecessor,/contents\s*:\s*write/i,`${name} must remain read-only during parity`);
}

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
assert.equal(actual.length,27,'P6A-1 parity stage must not retire workflows before side-by-side proof');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P6A_UCIMG_WRAPPER_PARITY_CONFIGURATION',
  version:CI_P6A_UCIMG_WRAPPER_PARITY_VERSION,
  phase:'P6A_1_SIDE_BY_SIDE_PARITY',
  predecessor_workflows:PREDECESSORS,
  predecessor_count:PREDECESSORS.length,
  successor_workflow:'uc-img-a.yml',
  workflow_count:actual.length,
  trigger_policy:'PRESERVE_OR_WIDEN_UNION_PR_MAIN_HOTFIX_MANUAL',
  permissions:'READ_ONLY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
  retirement_allowed:false,
  retirement_gate:'REQUIRES_FIXED_HEAD_PREDECESSOR_AND_SUCCESSOR_ALL_GREEN_PLUS_POST_MERGE_MAIN_ZERO_FAILURE',
},null,2));
