import assert from 'node:assert/strict';
import fs from 'node:fs';

export const PRODUCTION_WORKFLOW_CONSOLIDATION_VERSION='production-workflow-consolidation-2026-08-16-b-p7-successor';

const retiredWorkflows=Object.freeze([
  '.github/workflows/v0414-g7-verified-energy-objective.yml',
  '.github/workflows/v0415-g72-team-supply-mobile-ui.yml',
  '.github/workflows/v0416-g73-production-team-search.yml',
  '.github/workflows/v0417-g74-ai-proposal-intake.yml',
  '.github/workflows/v0418-g75-production-evidence.yml',
  '.github/workflows/v0419-g75a-berry-strength.yml',
  '.github/workflows/v0420-g75b-favorite-berry-multiplier.yml',
  '.github/workflows/v0421-g75c-help-event-split.yml',
  '.github/workflows/v0422-g75d-base-berry-output.yml',
  '.github/workflows/v0423-g75e1-production-modifier.yml',
  '.github/workflows/v0424-g75e2a-nature-numeric-modifier.yml',
  '.github/workflows/v0425-g75e2b-recipe-name-subskill.yml',
  '.github/workflows/v0426-g75e3a-ingredient-rate-reference.yml',
  '.github/workflows/v0426-g75e3a-ingredient-semantic-boundary.yml',
  '.github/workflows/v0427-g75e3b-ingredient-slot-distribution.yml',
  '.github/workflows/v0428-g75e3c-probability-evidence-policy.yml',
  '.github/workflows/v0428-g75e3c2-public-species-form-roster.yml',
  '.github/workflows/v0428-g75e3c4-independent-crosscheck-readiness.yml',
  '.github/workflows/v0428-g75e3c4a-independent-source-admission.yml',
  '.github/workflows/v0428-g75e3c4b-independent-snapshot-intake.yml',
  '.github/workflows/v0428-g75e3c5-source-lineage-review.yml',
  '.github/workflows/v0428-g75e3c6-first-party-observation.yml',
]);

const preservedContracts=Object.freeze([
  'scripts/v0414-g7-verified-energy-objective-contract.mjs',
  'scripts/v0415-g72-team-supply-mobile-ui-contract.mjs',
  'scripts/v0416-g73-production-team-search-contract.mjs',
  'scripts/v0417-g74-ai-proposal-intake-contract.mjs',
  'scripts/v0418-g75-production-evidence-contract.mjs',
  'scripts/v0419-g75a-berry-strength-contract.mjs',
  'scripts/v0420-g75b-favorite-berry-multiplier-contract.mjs',
  'scripts/v0421-g75c-help-event-split-contract.mjs',
  'scripts/v0422-g75d-base-berry-output-contract.mjs',
  'scripts/v0423-production-modifier-contract.mjs',
  'scripts/v0424-nature-numeric-modifier-contract.mjs',
  'scripts/v0425-recipe-name-subskill-contract.mjs',
  'scripts/v04251-recipe-current-authority-lock-contract.mjs',
  'scripts/v0426-g75e3a-species-ingredient-rate-reference-contract.mjs',
  'scripts/v0426-g75e3a-ingredient-semantic-boundary-contract.mjs',
  'scripts/v0427-g75e3b-ingredient-slot-distribution-contract.mjs',
  'scripts/v0428-g75e3c-probability-evidence-policy-contract.mjs',
  'scripts/v0428-g75e3c2-public-species-form-roster-contract.mjs',
  'scripts/v0428-g75e3c4-independent-crosscheck-contract.mjs',
  'scripts/v0428-g75e3c4a-independent-source-admission-contract.mjs',
  'scripts/v0428-g75e3c4b-independent-snapshot-intake-gate.mjs',
  'scripts/v0428-g75e3c5-source-lineage-review-contract.mjs',
  'scripts/v0428-g75e3c6-first-party-observation-contract.mjs',
]);

for(const path of retiredWorkflows)assert.equal(fs.existsSync(path),false,`retired Production workflow still exists: ${path}`);
for(const path of preservedContracts)assert.equal(fs.existsSync(path),true,`Production behavioral contract missing: ${path}`);

const replacement='.github/workflows/production-evidence-regression.yml';
const runnerPath='scripts/ci-production-evidence-regression.mjs';
const predecessorBridge='scripts/v0423-predecessor-contract-runner.mjs';
const recipeAuthority='.github/workflows/recipe-regression.yml';
for(const path of [replacement,runnerPath,predecessorBridge,recipeAuthority])assert.equal(fs.existsSync(path),true,`required preserved path missing: ${path}`);

const runner=fs.readFileSync(runnerPath,'utf8');
const workflow=fs.readFileSync(replacement,'utf8');
const recipeWorkflow=fs.readFileSync(recipeAuthority,'utf8');
for(const path of preservedContracts)assert.ok(runner.includes(path),`Production consolidated runner lost contract: ${path}`);
for(const token of [
  'concurrency:',
  'cancel-in-progress: true',
  "node-version: '22'",
  'node scripts/ci-production-evidence-regression.mjs',
  'node scripts/ci-production-workflow-consolidation-contract.mjs',
])assert.ok(workflow.includes(token),`Production replacement workflow missing: ${token}`);

assert.ok(runner.includes(predecessorBridge),'Production regression lost governed predecessor identity bridge');
assert.ok(!retiredWorkflows.includes(recipeAuthority),'Recipe authority successor must not be retired by Production consolidation');
for(const token of [
  'formula-energy-parity:',
  'node scripts/version-authority-audit.mjs',
  'node scripts/v04221-recipe-formula-authority-audit.mjs',
  'node scripts/v0423-predecessor-contract-runner.mjs scripts/v04221-release-contract.mjs',
])assert.ok(recipeWorkflow.includes(token),`P7 recipe successor lost Production-adjacent recipe authority boundary: ${token}`);

console.log(JSON.stringify({
  status:'PASS',
  gate:'PRODUCTION_WORKFLOW_CONSOLIDATION',
  version:PRODUCTION_WORKFLOW_CONSOLIDATION_VERSION,
  retired_workflow_count:retiredWorkflows.length,
  replacement_workflow_count:1,
  net_workflow_reduction:retiredWorkflows.length-1,
  preserved_behavioral_contract_count:preservedContracts.length,
  behavioral_contracts_removed:0,
  recipe_authority_workflow:'recipe-regression.yml',
  recipe_authority_job:'formula-energy-parity',
  recipe_authority_workflow_retired:false,
  production_numeric_authority_changed:false,
  predecessor_identity_bridge_preserved:true,
},null,2));
