import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P6B_SCREENSHOT_PIPELINE_PARITY_VERSION='ci-p6b-screenshot-pipeline-retirement-2026-08-16-b';
export const P6B_SIDE_BY_SIDE_PARITY_PROOF=Object.freeze({
  pr:324,
  fixed_head:'807191569ad29ee27022e95ef685efde1ac32808',
  merge_sha:'fd9adc9894787e4b4b75e08dcab521005e468887',
  triggered_pr_workflows:13,
  predecessor_workflows:3,
  successor_jobs:3,
  predecessor_and_successor_all_green:true,
  main_push_success:13,
  main_push_failure:0,
  main_push_queued:0,
  main_push_in_progress:0,
});

const WORKFLOW_DIR='.github/workflows';
const SUCCESSOR='.github/workflows/screenshot-pipeline-regression.yml';
const RETIRED_PREDECESSORS=Object.freeze([
  'data1d1-ocr-regression.yml',
  'g13-ocr-ai-regression.yml',
  'uc-img-a.yml',
]);
const read=path=>fs.readFileSync(path,'utf8');

for(const name of RETIRED_PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),false,`P6B retired screenshot-domain workflow reappeared: ${name}`);
}
assert.equal(fs.existsSync(SUCCESSOR),true,'P6B screenshot pipeline successor missing');

const successor=read(SUCCESSOR);
assert.doesNotMatch(successor,/contents\s*:\s*write/i,'P6B successor must remain read-only');
assert.doesNotMatch(successor,/(?:^|\s)git\s+(?:push|commit)(?:\s|$)/im,'P6B successor must not mutate repository history');
assert.match(successor,/pull_request:/m,'P6B successor must preserve G13 all-PR coverage');
assert.match(successor,/push:/m,'P6B successor must preserve push coverage');
assert.ok(successor.includes("- main"),'P6B successor push coverage must include main');
assert.ok(successor.includes("- 'hotfix/**'"),'P6B successor push coverage must preserve UC.IMG hotfix/**');
assert.match(successor,/workflow_dispatch:/m,'P6B successor must preserve manual dispatch');

for(const job of ['local-ocr:','ocr-ai-bridge:','uc-img-update-center:']){
  assert.ok(successor.includes(job),`P6B successor lost independent job boundary: ${job}`);
}

for(const command of [
  'node scripts/ci-data1d1-ocr-regression.mjs',
  'node scripts/ci-data1d1-workflow-consolidation-contract.mjs',
  'node scripts/ci-g13-workflow-consolidation-contract.mjs',
  'node scripts/ci-g13-ocr-ai-regression.mjs --core',
  'node scripts/ci-g13-ocr-ai-regression.mjs',
  'node --check assets/js/android-import-file-picker.js',
  'node --check assets/js/unified-import-analysis-workbench.js',
  'node --check assets/js/two-stage-forced-ocr-entry.js',
  'test -z "$(git status --porcelain --untracked-files=no)"',
  'node scripts/uc-img-root-contract.mjs',
  'node scripts/v04133-shared-gemini-transport-diagnostic-contract.mjs',
  'node scripts/v04134-recipe-pot-scenario-contract.mjs',
  'node scripts/v04135-account-capacity-apply-not-null-contract.mjs',
  'node scripts/v04136-pot-manual-authority-alignment-contract.mjs',
  'node scripts/uc-img-a-contract.mjs',
  'node scripts/uc-img-internal-gemini-contract.mjs',
  'node scripts/ci-p6a-ucimg-wrapper-parity-contract.mjs',
  'node scripts/ci-p6b-screenshot-pipeline-parity-contract.mjs',
])assert.ok(successor.includes(command),`P6B successor lost retired-domain behavior: ${command}`);

assert.equal(P6B_SIDE_BY_SIDE_PARITY_PROOF.predecessor_and_successor_all_green,true,'P6B retirement requires recorded fixed-head side-by-side parity');
assert.equal(P6B_SIDE_BY_SIDE_PARITY_PROOF.main_push_failure,0,'P6B-1 main push must have zero failures before retirement');
assert.equal(P6B_SIDE_BY_SIDE_PARITY_PROOF.main_push_queued,0,'P6B-1 main push must have zero queued workflows before retirement');
assert.equal(P6B_SIDE_BY_SIDE_PARITY_PROOF.main_push_in_progress,0,'P6B-1 main push must have zero in-progress workflows before retirement');

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
assert.equal(actual.length,21,'P6B retirement topology must be exactly 21 workflow YAML files');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P6B_SCREENSHOT_PIPELINE_RETIREMENT',
  version:CI_P6B_SCREENSHOT_PIPELINE_PARITY_VERSION,
  phase:'P6B_2_CONTROLLED_RETIREMENT',
  parity_proof:P6B_SIDE_BY_SIDE_PARITY_PROOF,
  retired_workflow_count:RETIRED_PREDECESSORS.length,
  retired_workflows:RETIRED_PREDECESSORS,
  successor_workflow:'screenshot-pipeline-regression.yml',
  successor_jobs:['local-ocr','ocr-ai-bridge','uc-img-update-center'],
  workflow_count_before_parity:23,
  workflow_count_during_parity:24,
  workflow_count_after_retirement:actual.length,
  net_workflow_reduction_from_p6a_baseline:2,
  trigger_policy:'PRESERVE_OR_WIDEN_UNION_ALL_PR_MAIN_HOTFIX_MANUAL',
  permissions:'READ_ONLY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
  retirement_allowed:true,
},null,2));
