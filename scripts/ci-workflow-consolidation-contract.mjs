import assert from 'node:assert/strict';
import fs from 'node:fs';

export const HISTORICAL_RELEASE_CONSOLIDATION_BASELINE='historical-release-regression-2026-08-11-a';

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
const versionMatch=runner.match(/HISTORICAL_RELEASE_REGRESSION_VERSION='([^']+)'/);
assert.ok(versionMatch,'historical regression version declaration missing');
assert.match(versionMatch[1],/^historical-release-regression-\d{4}-\d{2}-\d{2}-[a-z](?:-[a-z0-9-]+)?$/,'historical regression successor version family invalid');
for(const path of contracts)assert.ok(runner.includes(path),`consolidated runner lost predecessor contract: ${path}`);
assert.ok(workflow.includes('concurrency:'));
assert.ok(workflow.includes('cancel-in-progress: true'));
assert.ok(workflow.includes('jsdom@26.1.0'),'DOM hotfix regression dependency must remain covered');
assert.ok(workflow.includes('node scripts/ci-historical-release-regression.mjs'));
assert.doesNotMatch(workflow,/contents\s*:\s*write/i,'historical regression must remain read-only');
assert.doesNotMatch(workflow,/(?:^|\s)git\s+(?:push|commit)(?:\s|$)/im,'historical regression must not mutate repository history');

console.log(JSON.stringify({
  status:'PASS',gate:'CI_WORKFLOW_CONSOLIDATION',
  baseline_regression_version:HISTORICAL_RELEASE_CONSOLIDATION_BASELINE,
  current_regression_version:versionMatch[1],
  successor_version_allowed:true,
  retired_workflow_count:retiredWorkflows.length,
  replacement_workflow_count:1,
  net_workflow_reduction:retiredWorkflows.length-1,
  preserved_contract_count:contracts.length,
  behavioral_contracts_removed:0,
},null,2));
