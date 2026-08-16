import assert from 'node:assert/strict';
import fs from 'node:fs';

export const CI_P7_RECIPE_REGRESSION_PARITY_VERSION='ci-p7-recipe-regression-parity-2026-08-16-b';

const WORKFLOW_DIR='.github/workflows';
const SUCCESSOR='.github/workflows/recipe-regression.yml';
const PREDECESSORS=Object.freeze([
  'v042-recipe-authority-audit.yml',
  'v04221-recipe-formula-authority-audit.yml',
  'v043-r21-recipe-zh-tw-evidence-audit.yml',
  'v043-release-integration.yml',
]);
const read=path=>fs.readFileSync(path,'utf8');

for(const name of PREDECESSORS){
  assert.equal(fs.existsSync(`${WORKFLOW_DIR}/${name}`),true,`P7 parity predecessor missing before side-by-side proof: ${name}`);
  assert.doesNotMatch(read(`${WORKFLOW_DIR}/${name}`),/contents\s*:\s*write/i,`${name} must remain read-only during P7 parity`);
}
assert.equal(fs.existsSync(SUCCESSOR),true,'P7 recipe-regression successor missing');

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
  assert.ok(successor.includes(job),`P7 successor must keep explicit recipe safety job boundary: ${job}`);
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
])assert.ok(successor.includes(command),`P7 successor lost predecessor behavior: ${command}`);

// Fixed-head trigger proof. We avoid semantic changes to historical wrappers:
// v042/release are triggered by a dedicated v042-* marker; formula wrapper is
// explicitly widened to the successor/parity files; zh-TW evidence is triggered
// by a comment-only change to its already-governed R2.6 contract.
assert.equal(fs.existsSync('scripts/v042-p7-parity-marker.mjs'),true,'P7 v042 parity marker missing');
const v042=read(`${WORKFLOW_DIR}/v042-recipe-authority-audit.yml`);
const formula=read(`${WORKFLOW_DIR}/v04221-recipe-formula-authority-audit.yml`);
const zhTw=read(`${WORKFLOW_DIR}/v043-r21-recipe-zh-tw-evidence-audit.yml`);
const release=read(`${WORKFLOW_DIR}/v043-release-integration.yml`);
assert.ok(v042.includes("'scripts/v042-*.mjs'"),'v042 wrapper must include parity marker glob');
assert.ok(release.includes("'scripts/v042-*.mjs'"),'v043 release wrapper must include parity marker glob');
assert.ok(formula.includes("'scripts/ci-p7-recipe-regression-parity-contract.mjs'"),'formula wrapper PR trigger must include P7 parity contract');
assert.ok(formula.includes("'.github/workflows/recipe-regression.yml'"),'formula wrapper PR trigger must include recipe successor');
assert.ok(zhTw.includes("'scripts/v043-r26-team-ux-contract.mjs'"),'zh-TW wrapper must govern R2.6 parity trigger path');
assert.ok(read('scripts/v043-r26-team-ux-contract.mjs').includes('P7A parity trigger'),'R2.6 comment-only parity trigger marker missing');

const actual=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name));
assert.equal(actual.length,22,'P7A parity stage must keep 21 current workflows plus one recipe successor');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P7_RECIPE_REGRESSION_PARITY_CONFIGURATION',
  version:CI_P7_RECIPE_REGRESSION_PARITY_VERSION,
  phase:'P7A_SIDE_BY_SIDE_PARITY',
  predecessor_workflows:PREDECESSORS,
  predecessor_count:PREDECESSORS.length,
  successor_workflow:'recipe-regression.yml',
  successor_jobs:['base-current-authority','formula-energy-parity','zh-tw-evidence','release-integration'],
  workflow_count_before_parity:21,
  workflow_count_during_parity:actual.length,
  fixed_head_predecessor_trigger_strategy:'V042_GLOB_MARKER_PLUS_FORMULA_WORKFLOW_WIDENING_PLUS_R26_COMMENT_ONLY_TRIGGER',
  trigger_policy:'PRESERVE_OR_WIDEN_UNION_ALL_PR_MAIN_HOTFIX_FEATURE_MANUAL',
  permissions:'READ_ONLY',
  repository_mutation:false,
  behavioral_contracts_removed:0,
  production_numeric_authority_changed:false,
  retirement_allowed:false,
  retirement_gate:'REQUIRES_FIXED_HEAD_ALL_FOUR_PREDECESSORS_AND_SUCCESSOR_ALL_GREEN_PLUS_POST_MERGE_MAIN_ZERO_FAILURE',
},null,2));
