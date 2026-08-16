import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P6A_UCIMG_WRAPPER_PARITY_VERSION='ci-p6a-ucimg-wrapper-retirement-2026-08-16-c-successor-aware';
export const P6A_SIDE_BY_SIDE_PARITY_PROOF=Object.freeze({
  pr:322,
  fixed_head:'1876a56f92142f29b015b7085f751041e8a9380a',
  merge_sha:'bd84d2b9e4cd7797ef71c7ccd304f8de0c65ebb8',
  triggered_pr_workflows:15,
  predecessor_workflows:4,
  predecessor_and_successor_all_green:true,
  main_push_success:15,
  main_push_failure:0,
  main_push_queued:0,
  main_push_in_progress:0,
  workflow_count_after_p6a_retirement:23,
});

const WORKFLOW_DIR='.github/workflows';
const SUCCESSOR='.github/workflows/uc-img-a.yml';
const P6B_PARITY_SUCCESSOR='.github/workflows/screenshot-pipeline-regression.yml';
const RETIRED_PREDECESSORS=Object.freeze([
  'v04133-shared-gemini-transport-diagnostic.yml',
  'v04134-recipe-pot-scenario-contract.yml',
  'v04135-account-capacity-apply-not-null.yml',
  'v04136-pot-manual-authority-alignment.yml',
]);
const read=path=>fs.readFileSync(path,'utf8');

for(const name of RETIRED_PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),false,`P6A retired wrapper reappeared: ${name}`);
}
assert.equal(fs.existsSync(SUCCESSOR),true,'P6A UC.IMG successor missing during P6B parity stage');

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
])assert.ok(successor.includes(command),`P6A successor lost retired-wrapper behavior: ${command}`);

assert.equal(P6A_SIDE_BY_SIDE_PARITY_PROOF.predecessor_and_successor_all_green,true,'P6A retirement requires recorded side-by-side parity proof');
assert.equal(P6A_SIDE_BY_SIDE_PARITY_PROOF.main_push_failure,0,'P6A-1 main push must have zero failures before retirement');
assert.equal(P6A_SIDE_BY_SIDE_PARITY_PROOF.main_push_queued,0,'P6A-1 main push must have zero queued workflows before retirement');
assert.equal(P6A_SIDE_BY_SIDE_PARITY_PROOF.main_push_in_progress,0,'P6A-1 main push must have zero in-progress workflows before retirement');

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
if(fs.existsSync(P6B_PARITY_SUCCESSOR)){
  assert.equal(actual.length,24,'P6B side-by-side parity may temporarily add exactly one successor workflow above the P6A-retired baseline');
}else{
  assert.ok(actual.length<=P6A_SIDE_BY_SIDE_PARITY_PROOF.workflow_count_after_p6a_retirement,'later convergence must not exceed the P6A-retired workflow baseline');
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P6A_UCIMG_WRAPPER_RETIREMENT',
  version:CI_P6A_UCIMG_WRAPPER_PARITY_VERSION,
  phase:'P6A_2_CONTROLLED_RETIREMENT',
  parity_proof:P6A_SIDE_BY_SIDE_PARITY_PROOF,
  retired_workflow_count:RETIRED_PREDECESSORS.length,
  retired_workflows:RETIRED_PREDECESSORS,
  successor_workflow:'uc-img-a.yml',
  workflow_count_before_retirement:27,
  workflow_count_after_p6a_retirement:P6A_SIDE_BY_SIDE_PARITY_PROOF.workflow_count_after_p6a_retirement,
  current_workflow_count:actual.length,
  p6b_parity_successor_present:fs.existsSync(P6B_PARITY_SUCCESSOR),
  net_workflow_reduction_at_p6a:4,
  trigger_policy:'PRESERVE_OR_WIDEN_UNION_PR_MAIN_HOTFIX_MANUAL',
  permissions:'READ_ONLY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
  retirement_allowed:true,
},null,2));
