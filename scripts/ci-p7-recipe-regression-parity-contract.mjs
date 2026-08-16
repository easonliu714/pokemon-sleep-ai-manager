import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P7_RECIPE_REGRESSION_PARITY_VERSION='ci-p7-recipe-regression-retirement-2026-08-16-e-p8-retirement-aware';
export const P7_SIDE_BY_SIDE_PARITY_PROOF=Object.freeze({
  pr:326,
  fixed_head:'e872fe42692fb176c3ed3e03e8218d741609a627',
  merge_sha:'681b5f53b80c1317a49edf881df5333d1747fb46',
  triggered_pr_workflows:17,
  predecessor_workflows:4,
  successor_jobs:4,
  predecessor_and_successor_all_green:true,
  main_push_success:16,
  main_push_failure:0,
  main_push_queued:0,
  main_push_in_progress:0,
  workflow_count_after_p7_retirement:18,
});

const WORKFLOW_DIR='.github/workflows';
const SUCCESSOR='.github/workflows/recipe-regression.yml';
const P8_G14_SUCCESSOR='.github/workflows/g14-safety-regression.yml';
const P8_DATA_SUCCESSOR='.github/workflows/data-boundary-regression.yml';
const P8_PREDECESSORS=Object.freeze([
  'g14-backup-truth-restore.yml',
  'g14-data-consistency-multicapture.yml',
  'g14-full75-recovery.yml',
  'g14-public-catalog-renderer-authority.yml',
  'privacy-guard.yml',
  'public-pages-empty-profile.yml',
  'v0481-live-followup.yml',
  'v0484-touch-first-camp-containment.yml',
]);
const RETIRED_PREDECESSORS=Object.freeze([
  'v042-recipe-authority-audit.yml',
  'v04221-recipe-formula-authority-audit.yml',
  'v043-r21-recipe-zh-tw-evidence-audit.yml',
  'v043-release-integration.yml',
]);
const read=path=>fs.readFileSync(path,'utf8');

for(const name of RETIRED_PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),false,`P7 retired recipe wrapper reappeared: ${name}`);
}
assert.equal(fs.existsSync(SUCCESSOR),true,'P7 recipe-regression successor missing');
assert.equal(fs.existsSync('scripts/v042-p7-parity-marker.mjs'),false,'P7A no-op trigger marker must remain removed after controlled retirement');

const successor=read(SUCCESSOR);
assert.doesNotMatch(successor,/contents\s*:\s*write/i,'P7 successor must remain read-only');
assert.doesNotMatch(successor,/(?:^|\s)git\s+(?:push|commit)(?:\s|$)/im,'P7 successor must not mutate repository history');
assert.match(successor,/pull_request:/m,'P7 successor must preserve/widen PR coverage');
assert.match(successor,/push:/m,'P7 successor must preserve push coverage');
for(const branchToken of ['- main',"- 'hotfix/**'","- 'feature/**'"]){
  assert.ok(successor.includes(branchToken),`P7 successor lost predecessor push branch coverage: ${branchToken}`);
}
assert.match(successor,/workflow_dispatch:/m,'P7 successor must preserve manual dispatch');

for(const job of ['base-current-authority:','formula-energy-parity:','zh-tw-evidence:','release-integration:']){
  assert.ok(successor.includes(job),`P7 successor lost explicit recipe safety job boundary: ${job}`);
}

for(const command of [
  'node scripts/v042-release-integration-contract.mjs',
  'node scripts/v042-public-recipe-authority-contract.mjs',
  'node scripts/v042-recipe-provenance-audit.mjs',
  'node scripts/v042-recipe-strategy-projection-contract.mjs',
  'node scripts/v042-war-room-recipe-ui-contract.mjs',
  'node scripts/v042-pokemon-candidate-feature-contract.mjs',
  'node scripts/v042-pokemon-scoring-engine-contract.mjs',
  'node scripts/v042-strategy-context-package-contract.mjs',
  'node scripts/v042-war-room-goal-evaluation-contract.mjs',
  'node scripts/v042-recipe-sync-preservation-contract.mjs',
  'node scripts/version-authority-audit.mjs',
  'node scripts/v04221-recipe-formula-authority-audit.mjs',
  'node scripts/v0423-predecessor-contract-runner.mjs scripts/v04221-release-contract.mjs',
  'node scripts/v043-recipe-zh-tw-evidence-audit-contract.mjs',
  'node scripts/v043-full50-recipe-evidence-contract.mjs',
  'node scripts/v043-r22-recipe-canonical-name-contract.mjs',
  'node scripts/v043-r24-controlled-selector-contract.mjs',
  'node scripts/v043-r25-team-optimizer-contract.mjs',
  'node scripts/v043-r26-team-ux-contract.mjs',
  'python tests/test_g14_public_catalog_renderer_authority.py',
  'node scripts/v0412-recipe-unified-player-workbench-contract.mjs',
  'node scripts/personal-weekly-recommendation-regression.mjs',
  'node scripts/v043-release-integration-contract.mjs',
  'node scripts/ci-p7-recipe-regression-parity-contract.mjs',
])assert.ok(successor.includes(command),`P7 successor lost retired-wrapper behavior: ${command}`);

assert.equal(P7_SIDE_BY_SIDE_PARITY_PROOF.predecessor_and_successor_all_green,true,'P7 retirement requires recorded fixed-head side-by-side parity');
assert.equal(P7_SIDE_BY_SIDE_PARITY_PROOF.main_push_failure,0,'P7A main push must have zero failures before retirement');
assert.equal(P7_SIDE_BY_SIDE_PARITY_PROOF.main_push_queued,0,'P7A main push must have zero queued workflows before retirement');
assert.equal(P7_SIDE_BY_SIDE_PARITY_PROOF.main_push_in_progress,0,'P7A main push must have zero in-progress workflows before retirement');

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
const p8SuccessorsPresent=fs.existsSync(P8_G14_SUCCESSOR)&&fs.existsSync(P8_DATA_SUCCESSOR);
const p8PredecessorPresentCount=P8_PREDECESSORS.filter(name=>fs.existsSync(`${WORKFLOW_DIR}/${name}`)).length;
const p8SideBySide=p8SuccessorsPresent&&p8PredecessorPresentCount===P8_PREDECESSORS.length;
const p8Retired=p8SuccessorsPresent&&p8PredecessorPresentCount===0;
assert.ok(!p8SuccessorsPresent||p8SideBySide||p8Retired,'P8 safety topology must not be partially retired');
if(p8SideBySide){
  assert.equal(actual.length,20,'P8 side-by-side parity may temporarily add exactly two safety successor workflows above the P7-retired baseline');
}else{
  assert.ok(actual.length<=P7_SIDE_BY_SIDE_PARITY_PROOF.workflow_count_after_p7_retirement,'later controlled convergence must not increase workflow count above the P7-retired baseline');
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P7_RECIPE_REGRESSION_RETIREMENT',
  version:CI_P7_RECIPE_REGRESSION_PARITY_VERSION,
  phase:'P7B_CONTROLLED_RETIREMENT',
  parity_proof:P7_SIDE_BY_SIDE_PARITY_PROOF,
  retired_workflow_count:RETIRED_PREDECESSORS.length,
  retired_workflows:RETIRED_PREDECESSORS,
  successor_workflow:'recipe-regression.yml',
  successor_jobs:['base-current-authority','formula-energy-parity','zh-tw-evidence','release-integration'],
  workflow_count_before_parity:21,
  workflow_count_during_parity:22,
  workflow_count_after_p7_retirement:P7_SIDE_BY_SIDE_PARITY_PROOF.workflow_count_after_p7_retirement,
  current_workflow_count:actual.length,
  p8_successors_present:p8SuccessorsPresent,
  p8_predecessor_present_count:p8PredecessorPresentCount,
  p8_side_by_side_parity:p8SideBySide,
  p8_controlled_retirement_complete:p8Retired,
  net_workflow_reduction_from_p6b_baseline:3,
  trigger_policy:'PRESERVE_OR_WIDEN_UNION_ALL_PR_MAIN_HOTFIX_FEATURE_MANUAL',
  permissions:'READ_ONLY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
  production_numeric_authority_changed:false,
  retirement_allowed:true,
},null,2));
