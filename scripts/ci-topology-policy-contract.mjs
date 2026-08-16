import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const CI_TOPOLOGY_POLICY_VERSION='ci-topology-policy-2026-08-16-e-p7a-parity';
const WORKFLOW_DIR='.github/workflows';

const APPROVED_MAIN_WORKFLOWS=Object.freeze([
  'deploy-pages.yml',
  'g14-backup-truth-restore.yml',
  'g14-data-consistency-multicapture.yml',
  'g14-full75-recovery.yml',
  'g14-public-catalog-renderer-authority.yml',
  'historical-release-regression.yml',
  'js-syntax-check.yml',
  'legacy-runtime-regression.yml',
  'privacy-guard.yml',
  'production-evidence-regression.yml',
  'public-pages-empty-profile.yml',
  'recipe-regression.yml',
  'regression-gate.yml',
  'screenshot-pipeline-regression.yml',
  'tech2d-android-import-regression.yml',
  'v042-recipe-authority-audit.yml',
  'v04221-recipe-formula-authority-audit.yml',
  'v043-r21-recipe-zh-tw-evidence-audit.yml',
  'v043-release-integration.yml',
  'v0481-live-followup.yml',
  'v0484-touch-first-camp-containment.yml',
  'war-room-regression.yml',
]);

const PROTECTED_INDEPENDENT_WORKFLOWS=Object.freeze([
  'regression-gate.yml',
  'js-syntax-check.yml',
  'privacy-guard.yml',
  'tech2d-android-import-regression.yml',
  'deploy-pages.yml',
  'public-pages-empty-profile.yml',
  'historical-release-regression.yml',
  'production-evidence-regression.yml',
  'legacy-runtime-regression.yml',
  'screenshot-pipeline-regression.yml',
  'recipe-regression.yml',
  'war-room-regression.yml',
  'g14-backup-truth-restore.yml',
  'g14-data-consistency-multicapture.yml',
  'g14-full75-recovery.yml',
  'g14-public-catalog-renderer-authority.yml',
]);

const GRANDFATHERED_VERSION_SPECIFIC_WORKFLOWS=Object.freeze(
  APPROVED_MAIN_WORKFLOWS.filter(name=>/^v\d/i.test(name)),
);

const REGISTRY_STALE_NO_MAIN_FILE=Object.freeze([
  'v0393-release-authority-generator.yml',
  'v0393-post-migration-startup-gate.yml',
  'debug-trace-manager-regression.yml',
  'v0396-general-json-audit.yml',
  'v0397-profile-completeness.yml',
  'v0398-update-center-multiscenario.yml',
  'v0399-human-readable-diff-review.yml',
  'data-evo1-observed-evolution-coverage.yml',
  'v04133-shared-gemini-transport-diagnostic.yml',
  'v04134-recipe-pot-scenario-contract.yml',
  'v04135-account-capacity-apply-not-null.yml',
  'v04136-pot-manual-authority-alignment.yml',
  'data1d1-ocr-regression.yml',
  'g13-ocr-ai-regression.yml',
  'uc-img-a.yml',
]);

const TOPOLOGY_CONTRACTS=Object.freeze([
  'scripts/ci-workflow-consolidation-contract.mjs',
  'scripts/ci-g13-workflow-consolidation-contract.mjs',
  'scripts/ci-production-workflow-consolidation-contract.mjs',
  'scripts/ci-legacy-runtime-workflow-consolidation-contract.mjs',
  'scripts/ci-data1d1-workflow-consolidation-contract.mjs',
  'scripts/ci-war-room-workflow-consolidation-contract.mjs',
  'scripts/ci-p5-wrapper-parity-contract.mjs',
  'scripts/ci-p6a-ucimg-wrapper-parity-contract.mjs',
  'scripts/ci-p6b-screenshot-pipeline-parity-contract.mjs',
  'scripts/ci-p7-recipe-regression-parity-contract.mjs',
]);

function annotationSafe(value){
  return String(value??'').replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
}

function replayTopologyContract(contract){
  assert.equal(fs.existsSync(contract),true,`topology contract missing: ${contract}`);
  const result=spawnSync(process.execPath,[contract],{encoding:'utf8',env:process.env});
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  if(result.error)throw result.error;
  if(result.status!==0){
    const detail=[result.stderr,result.stdout].filter(Boolean).join('\n').trim()||`exit ${result.status}`;
    console.error(`::error title=${annotationSafe(`Topology replay ${contract}`)}::${annotationSafe(detail)}`);
    throw new Error(`topology_contract_failed:${contract}:exit_${result.status}`);
  }
}

assert.equal(fs.existsSync(WORKFLOW_DIR),true,'workflow directory missing');
const actualWorkflowFiles=fs.readdirSync(WORKFLOW_DIR).filter(name=>/\.ya?ml$/i.test(name)).sort();
const approvedWorkflowFiles=[...APPROVED_MAIN_WORKFLOWS].sort();
assert.deepEqual(actualWorkflowFiles,approvedWorkflowFiles,'main workflow topology changed: new standalone workflows require explicit CI topology policy review; retired workflows must not silently reappear');

for(const name of PROTECTED_INDEPENDENT_WORKFLOWS)assert.ok(actualWorkflowFiles.includes(name),`protected independent workflow missing: ${name}`);
for(const name of REGISTRY_STALE_NO_MAIN_FILE)assert.equal(actualWorkflowFiles.includes(name),false,`Actions-registry stale workflow reappeared on main: ${name}`);

for(const name of actualWorkflowFiles){
  const source=fs.readFileSync(path.join(WORKFLOW_DIR,name),'utf8');
  assert.doesNotMatch(source,/contents\s*:\s*write/i,`${name} requests forbidden contents:write`);
  assert.doesNotMatch(source,/(?:^|\s)git\s+push(?:\s|$)/im,`${name} contains forbidden git push`);
  assert.doesNotMatch(source,/(?:^|\s)git\s+commit(?:\s|$)/im,`${name} contains forbidden git commit`);
  assert.doesNotMatch(source,/(?:fix|feature|hotfix)\/v\d/i,`${name} listens to a stale version implementation branch`);
}

const actualVersionSpecific=actualWorkflowFiles.filter(name=>/^v\d/i.test(name)).sort();
const grandfathered=[...GRANDFATHERED_VERSION_SPECIFIC_WORKFLOWS].sort();
assert.deepEqual(actualVersionSpecific,grandfathered,'new version-specific standalone workflow detected; add behavior to an existing consolidated/domain runner by default, or explicitly amend CI topology policy with a documented independent safety-boundary justification');

for(const contract of TOPOLOGY_CONTRACTS)replayTopologyContract(contract);

const regressionWorkflow=fs.readFileSync(path.join(WORKFLOW_DIR,'regression-gate.yml'),'utf8');
assert.ok(regressionWorkflow.includes('node scripts/ci-topology-policy-contract.mjs'),'Frontend Regression no longer enforces CI topology policy');
assert.equal(fs.existsSync('docs/CI_TOPOLOGY_POLICY.md'),true,'CI topology policy documentation missing');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_TOPOLOGY_POLICY',
  version:CI_TOPOLOGY_POLICY_VERSION,
  main_workflow_file_count:actualWorkflowFiles.length,
  approved_main_workflow_file_count:APPROVED_MAIN_WORKFLOWS.length,
  version_specific_workflow_count:actualVersionSpecific.length,
  protected_independent_workflow_count:PROTECTED_INDEPENDENT_WORKFLOWS.length,
  retired_wrapper_contracts_replayed:TOPOLOGY_CONTRACTS.length,
  p5_retired_wrapper_count:6,
  p6a_retired_wrapper_count:4,
  p6a_retirement_complete:true,
  p6b_retired_domain_workflow_count:3,
  p6b_retirement_complete:true,
  p7_parity_predecessor_count:4,
  p7_parity_successor_count:1,
  p7_retirement_allowed:false,
  registry_stale_no_main_file_count:REGISTRY_STALE_NO_MAIN_FILE.length,
  actions_registry_is_authoritative:false,
  main_tree_is_topology_authority:true,
  new_standalone_version_workflow_policy:'DENY_BY_DEFAULT_REQUIRE_EXPLICIT_POLICY_AMENDMENT_AND_INDEPENDENT_BOUNDARY_JUSTIFICATION',
  repository_release_mutator_workflows_allowed:false,
  behavioral_contracts_removed:0,
},null,2));