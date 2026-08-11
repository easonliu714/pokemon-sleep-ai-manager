import assert from 'node:assert/strict';
import fs from 'node:fs';

const retiredWorkflows=[
  '.github/workflows/v0485-compact-camp-table.yml',
  '.github/workflows/v0463-weekly-ai-type-repair.yml',
  '.github/workflows/v0462-weekly-json-recipe-recommendation.yml',
  '.github/workflows/v0461-weekly-context-integration.yml',
  '.github/workflows/v0432-goal-profile-team-consistency.yml',
  '.github/workflows/v0431-controlled-selector-live-hotfix.yml',
];
for(const path of retiredWorkflows)assert.equal(fs.existsSync(path),false,`retired workflow still exists: ${path}`);
assert.equal(fs.existsSync('.github/workflows/historical-release-regression.yml'),true);

const contracts=[
  'scripts/v0485-release-contract.mjs',
  'scripts/v0484-release-contract.mjs',
  'scripts/v0483-release-contract.mjs',
  'scripts/v0481-live-followup-contract.mjs',
  'scripts/v0463-release-contract.mjs',
  'scripts/v0463-weekly-ai-type-repair-contract.mjs',
  'scripts/v0462-release-contract.mjs',
  'scripts/v0462-weekly-json-recipe-recommendation-contract.mjs',
  'scripts/v0461-release-contract.mjs',
  'scripts/v0461-weekly-context-integration-contract.mjs',
  'scripts/v046-recipe-discovery-release-contract.mjs',
  'scripts/war2b-recipe-discovery-stockpile-contract.mjs',
  'scripts/v0432-goal-profile-team-consistency-contract.mjs',
  'scripts/v043-r25-team-optimizer-contract.mjs',
  'scripts/v043-r24-controlled-selector-contract.mjs',
  'scripts/v0431-controlled-selector-dom-contract.mjs',
  'scripts/v0431-release-contract.mjs',
];
for(const path of contracts)assert.equal(fs.existsSync(path),true,`historical contract missing: ${path}`);

const runner=fs.readFileSync('scripts/ci-historical-release-regression.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/historical-release-regression.yml','utf8');
assert.ok(runner.includes("HISTORICAL_RELEASE_REGRESSION_VERSION='historical-release-regression-2026-08-11-a'"));
for(const path of contracts)assert.ok(runner.includes(path),`consolidated runner lost contract: ${path}`);
assert.ok(workflow.includes('concurrency:'));
assert.ok(workflow.includes('cancel-in-progress: true'));
assert.ok(workflow.includes('jsdom@26.1.0'),'DOM hotfix regression dependency must remain covered');
assert.ok(workflow.includes('node scripts/ci-historical-release-regression.mjs'));

console.log(JSON.stringify({
  status:'PASS',gate:'CI_WORKFLOW_CONSOLIDATION',
  regression_version:'historical-release-regression-2026-08-11-a',
  retired_workflow_count:retiredWorkflows.length,
  replacement_workflow_count:1,
  net_workflow_reduction:retiredWorkflows.length-1,
  preserved_contract_count:contracts.length,
  behavioral_contracts_removed:0,
},null,2));
