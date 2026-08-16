import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P6B_SCREENSHOT_PIPELINE_PARITY_VERSION='ci-p6b-screenshot-pipeline-parity-2026-08-16-a';

const WORKFLOW_DIR='.github/workflows';
const SUCCESSOR='.github/workflows/screenshot-pipeline-regression.yml';
const PREDECESSORS=Object.freeze([
  'data1d1-ocr-regression.yml',
  'g13-ocr-ai-regression.yml',
  'uc-img-a.yml',
]);
const read=path=>fs.readFileSync(path,'utf8');

for(const name of PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),true,`P6B parity predecessor missing before side-by-side proof: ${name}`);
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
  assert.ok(successor.includes(job),`P6B successor must keep independent job boundary: ${job}`);
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
])assert.ok(successor.includes(command),`P6B successor lost predecessor behavior: ${command}`);

const data1d1=read(`${WORKFLOW_DIR}/data1d1-ocr-regression.yml`);
assert.ok(data1d1.includes("'scripts/ci-p6b-screenshot-pipeline-parity-contract.mjs'"),'DATA.1D.1 PR trigger must include P6B parity contract');
assert.ok(data1d1.includes("'.github/workflows/screenshot-pipeline-regression.yml'"),'DATA.1D.1 PR trigger must include P6B successor workflow');
const ucimg=read(`${WORKFLOW_DIR}/uc-img-a.yml`);
assert.ok(ucimg.includes("'scripts/ci-p6b-screenshot-pipeline-parity-contract.mjs'"),'UC.IMG PR trigger must include P6B parity contract');
assert.ok(ucimg.includes("'.github/workflows/screenshot-pipeline-regression.yml'"),'UC.IMG PR trigger must include P6B successor workflow');
const g13=read(`${WORKFLOW_DIR}/g13-ocr-ai-regression.yml`);
assert.match(g13,/pull_request:\s*\n/m,'G13 predecessor must continue all-PR coverage during P6B parity');

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
assert.equal(actual.length,24,'P6B-1 parity stage must keep 23 predecessors/current workflows plus one successor');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P6B_SCREENSHOT_PIPELINE_PARITY_CONFIGURATION',
  version:CI_P6B_SCREENSHOT_PIPELINE_PARITY_VERSION,
  phase:'P6B_1_SIDE_BY_SIDE_PARITY',
  predecessor_workflows:PREDECESSORS,
  predecessor_count:PREDECESSORS.length,
  successor_workflow:'screenshot-pipeline-regression.yml',
  successor_jobs:['local-ocr','ocr-ai-bridge','uc-img-update-center'],
  workflow_count_before_parity:23,
  workflow_count_during_parity:actual.length,
  trigger_policy:'PRESERVE_OR_WIDEN_UNION_ALL_PR_MAIN_HOTFIX_MANUAL',
  permissions:'READ_ONLY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
  retirement_allowed:false,
  retirement_gate:'REQUIRES_FIXED_HEAD_ALL_THREE_PREDECESSORS_AND_SUCCESSOR_ALL_GREEN_PLUS_POST_MERGE_MAIN_ZERO_FAILURE',
},null,2));
