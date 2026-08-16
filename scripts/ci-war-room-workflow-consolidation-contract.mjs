import assert from 'node:assert/strict';
import fs from 'node:fs';

export const WAR_ROOM_WORKFLOW_CONSOLIDATION_VERSION='war-room-workflow-consolidation-2026-08-16-b-p8-successor-aware';
const retired=Object.freeze([
  '.github/workflows/war1c-evaluation-snapshot-lifecycle.yml',
  '.github/workflows/war2a-current-readiness-runtime-bridge.yml',
  '.github/workflows/war2b-recipe-discovery-stockpile.yml',
  '.github/workflows/war3a-candy-inventory.yml',
  '.github/workflows/war3b-typed-event-effect-registry.yml',
  '.github/workflows/war3c-external-strategy-analysis-pack.yml',
]);
const contracts=Object.freeze([
  'scripts/war1c-evaluation-snapshot-lifecycle-contract.mjs','scripts/v044-evaluation-snapshot-lifecycle-release-contract.mjs','scripts/v042-pokemon-candidate-feature-contract.mjs','scripts/v042-pokemon-scoring-engine-contract.mjs','scripts/war2a-current-readiness-runtime-bridge-contract.mjs','scripts/v045-current-readiness-runtime-release-contract.mjs','scripts/g7-recipe-portfolio-contention-contract.mjs','scripts/war2b-recipe-discovery-stockpile-contract.mjs','scripts/v046-recipe-discovery-release-contract.mjs','scripts/v047-release-contract.mjs','scripts/v0463-release-contract.mjs','scripts/v0463-weekly-ai-type-repair-contract.mjs','scripts/war3a-candy-inventory-contract.mjs','scripts/v048-release-contract.mjs','scripts/war3b-typed-event-effect-registry-contract.mjs','scripts/v0491-release-contract.mjs','scripts/v049-release-contract.mjs','scripts/war3c-external-strategy-analysis-pack-contract.mjs','scripts/v0485-release-contract.mjs','scripts/v0484-release-contract.mjs','scripts/v0483-release-contract.mjs','scripts/v0481-live-followup-contract.mjs'
]);
const p8RetiredSafetyPredecessors=Object.freeze([
  '.github/workflows/g14-backup-truth-restore.yml',
  '.github/workflows/g14-full75-recovery.yml',
  '.github/workflows/g14-data-consistency-multicapture.yml',
  '.github/workflows/g14-public-catalog-renderer-authority.yml',
  '.github/workflows/privacy-guard.yml',
  '.github/workflows/public-pages-empty-profile.yml',
  '.github/workflows/v0481-live-followup.yml',
  '.github/workflows/v0484-touch-first-camp-containment.yml',
]);
const protectedCurrentSafetyBoundaries=Object.freeze([
  '.github/workflows/g14-safety-regression.yml',
  '.github/workflows/data-boundary-regression.yml',
  '.github/workflows/historical-release-regression.yml',
  '.github/workflows/regression-gate.yml',
  '.github/workflows/tech2d-android-import-regression.yml',
  '.github/workflows/deploy-pages.yml',
]);
for(const path of retired)assert.equal(fs.existsSync(path),false,`retired War Room workflow still exists: ${path}`);
for(const path of contracts)assert.equal(fs.existsSync(path),true,`War Room contract missing: ${path}`);
for(const path of p8RetiredSafetyPredecessors)assert.equal(fs.existsSync(path),false,`P8-retired safety predecessor reappeared: ${path}`);
for(const path of protectedCurrentSafetyBoundaries)assert.equal(fs.existsSync(path),true,`P8 current safety boundary missing: ${path}`);
const runnerPath='scripts/ci-war-room-regression.mjs',workflowPath='.github/workflows/war-room-regression.yml';assert.equal(fs.existsSync(runnerPath),true);assert.equal(fs.existsSync(workflowPath),true);
const runner=fs.readFileSync(runnerPath,'utf8'),workflow=fs.readFileSync(workflowPath,'utf8');for(const path of contracts)assert.ok(runner.includes(path),`War Room runner lost contract: ${path}`);
for(const token of ['concurrency:','cancel-in-progress: true','contents: read','node scripts/ci-war-room-regression.mjs','node scripts/ci-war-room-workflow-consolidation-contract.mjs'])assert.ok(workflow.includes(token),`War Room replacement missing: ${token}`);
const g14=fs.readFileSync('.github/workflows/g14-safety-regression.yml','utf8');
for(const job of ['backup-truth-restore:','data-consistency-multicapture:','full75-recovery:','public-catalog-authority:'])assert.ok(g14.includes(job),`P8 G14 successor lost independent job: ${job}`);
const data=fs.readFileSync('.github/workflows/data-boundary-regression.yml','utf8');
for(const job of ['private-data-guard:','empty-player-public-pages:'])assert.ok(data.includes(job),`P8 data-boundary successor lost independent job: ${job}`);
const historical=fs.readFileSync('.github/workflows/historical-release-regression.yml','utf8');
for(const token of ['scripts/v0481-live-followup-contract.mjs','scripts/v0484-release-contract.mjs'])assert.ok(historical.includes(token),`P8 historical successor lost v0.4.8 behavior: ${token}`);
console.log(JSON.stringify({status:'PASS',gate:'WAR_ROOM_WORKFLOW_CONSOLIDATION',version:WAR_ROOM_WORKFLOW_CONSOLIDATION_VERSION,retired_workflow_count:retired.length,replacement_workflow_count:1,net_workflow_reduction:retired.length-1,preserved_behavioral_contract_count:contracts.length,behavioral_contracts_removed:0,p8_retired_safety_predecessor_count:p8RetiredSafetyPredecessors.length,p8_successor_boundaries_verified:true,g14_predecessor_workflows_retired:true,g14_successor_preserved:true},null,2));
