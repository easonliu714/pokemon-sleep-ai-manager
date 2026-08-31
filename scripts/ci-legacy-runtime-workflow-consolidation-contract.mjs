import assert from 'node:assert/strict';
import fs from 'node:fs';

export const LEGACY_RUNTIME_WORKFLOW_CONSOLIDATION_VERSION='legacy-runtime-workflow-consolidation-2026-09-01-d-p5-successor-token-refresh';

const retiredWorkflows=Object.freeze([
  '.github/workflows/v03751-version-authority-gate.yml',
  '.github/workflows/v0382-branch-patch.yml',
  '.github/workflows/v0383-release-patch.yml',
  '.github/workflows/v0384-recovery-patch.yml',
  '.github/workflows/v0385-boot-isolation.yml',
  '.github/workflows/v0387-index-authority-sync.yml',
  '.github/workflows/v0387-safe-boot-gate.yml',
  '.github/workflows/v0387-runtime-compatibility-restore.yml',
  '.github/workflows/v03871-bootstrap-finalize-patch.yml',
  '.github/workflows/v0388-zero-sql-rescue-patch.yml',
  '.github/workflows/v0388-zero-sql-rescue-gate.yml',
  '.github/workflows/v0388-version-authority-patch.yml',
  '.github/workflows/v0389-authority-patch.yml',
  '.github/workflows/v0389-rescue-catalog-import-gate.yml',
  '.github/workflows/v0390-release-authority.yml',
  '.github/workflows/v0390-worker-safe-load-gate.yml',
  '.github/workflows/v0391-release-authority-generator.yml',
  '.github/workflows/v0391-worker-lifecycle-gate.yml',
  '.github/workflows/v0392-release-authority-generator.yml',
  '.github/workflows/v0392-new-user-bootstrap-gate.yml',
  '.github/workflows/v03981-confirmation-dryrun-browser.yml',
]);

const preservedBehavioralContracts=Object.freeze([
  'tests/v03751_version_authority_gate.mjs',
  'tests/v0387-safe-boot-contract.test.mjs',
  'tests/v0389-rescue-catalog-import-contract.test.mjs',
  'scripts/v0392-new-user-bootstrap-gate.mjs',
  'scripts/v03981-confirmation-dryrun-browser.mjs',
  'scripts/ci-legacy-runtime-regression.mjs',
]);

const protectedNonRuntimeWorkflows=Object.freeze([
  '.github/workflows/regression-gate.yml',
  '.github/workflows/tech2d-android-import-regression.yml',
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/production-evidence-regression.yml',
  '.github/workflows/g14-safety-regression.yml',
  '.github/workflows/data-boundary-regression.yml',
  '.github/workflows/historical-release-regression.yml',
]);

const p8RetiredSafetyWorkflows=Object.freeze([
  '.github/workflows/g14-backup-truth-restore.yml',
  '.github/workflows/g14-full75-recovery.yml',
  '.github/workflows/g14-data-consistency-multicapture.yml',
  '.github/workflows/g14-public-catalog-renderer-authority.yml',
  '.github/workflows/privacy-guard.yml',
  '.github/workflows/public-pages-empty-profile.yml',
  '.github/workflows/v0481-live-followup.yml',
  '.github/workflows/v0484-touch-first-camp-containment.yml',
]);

const p5RetiredCoreWrappers=Object.freeze([
  '.github/workflows/v0396-general-json-audit.yml',
  '.github/workflows/v0397-profile-completeness.yml',
  '.github/workflows/v0398-update-center-multiscenario.yml',
]);
const p5CoreBehaviorTokens=Object.freeze([
  'tests/test_v0396_general_json_audit_contract.py',
  'tests/test_v0397_profile_completeness_contract.py',
  'tests/test_v0398_update_center_multiscenario_contract.py',
  'node scripts/p5-core-update-center-human-review-successor-contract.mjs',
]);

const registryStaleNoMainFile=Object.freeze([
  '.github/workflows/v0393-release-authority-generator.yml',
  '.github/workflows/v0393-post-migration-startup-gate.yml',
  ...p5RetiredCoreWrappers,
  ...p8RetiredSafetyWorkflows,
]);

for(const path of retiredWorkflows)assert.equal(fs.existsSync(path),false,`retired legacy runtime workflow still exists: ${path}`);
for(const path of preservedBehavioralContracts)assert.equal(fs.existsSync(path),true,`legacy runtime behavioral contract missing: ${path}`);
for(const path of protectedNonRuntimeWorkflows)assert.equal(fs.existsSync(path),true,`P2/P5/P8 deleted protected successor boundary: ${path}`);
for(const path of p8RetiredSafetyWorkflows)assert.equal(fs.existsSync(path),false,`P8-retired safety predecessor reappeared: ${path}`);
for(const path of p5RetiredCoreWrappers)assert.equal(fs.existsSync(path),false,`P5-retired core wrapper reappeared: ${path}`);
for(const path of registryStaleNoMainFile)assert.equal(fs.existsSync(path),false,`registry-stale workflow unexpectedly reappeared on main: ${path}`);

const replacementPath='.github/workflows/legacy-runtime-regression.yml';
assert.equal(fs.existsSync(replacementPath),true,'Legacy Runtime Regression workflow missing');
const replacement=fs.readFileSync(replacementPath,'utf8');
const runner=fs.readFileSync('scripts/ci-legacy-runtime-regression.mjs','utf8');
const coreSuccessor=fs.readFileSync('.github/workflows/regression-gate.yml','utf8');
const g14Successor=fs.readFileSync('.github/workflows/g14-safety-regression.yml','utf8');
const dataSuccessor=fs.readFileSync('.github/workflows/data-boundary-regression.yml','utf8');
const historicalSuccessor=fs.readFileSync('.github/workflows/historical-release-regression.yml','utf8');
for(const token of [
  'concurrency:',
  'cancel-in-progress: true',
  'contents: read',
  "node-version: '22'",
  'node scripts/ci-legacy-runtime-regression.mjs',
  'node scripts/ci-legacy-runtime-workflow-consolidation-contract.mjs',
  'node scripts/v03981-confirmation-dryrun-browser.mjs',
])assert.ok(replacement.includes(token),`Legacy Runtime replacement workflow missing: ${token}`);

for(const path of preservedBehavioralContracts.filter(path=>path!=='scripts/v03981-confirmation-dryrun-browser.mjs')){
  assert.ok(runner.includes(path)||path==='scripts/ci-legacy-runtime-regression.mjs',`Legacy Runtime runner lost behavioral contract: ${path}`);
}
assert.ok(replacement.includes('scripts/v03981-confirmation-dryrun-browser.mjs'),'Legacy Runtime replacement lost Chromium confirmation contract');
for(const token of p5CoreBehaviorTokens)assert.ok(coreSuccessor.includes(token),`P5 core successor lost P2-protected behavior: ${token}`);
for(const job of ['backup-truth-restore:','data-consistency-multicapture:','full75-recovery:','public-catalog-authority:'])assert.ok(g14Successor.includes(job),`P8 G14 successor lost safety job: ${job}`);
for(const job of ['private-data-guard:','empty-player-public-pages:'])assert.ok(dataSuccessor.includes(job),`P8 data-boundary successor lost safety job: ${job}`);
for(const token of ['scripts/v0481-live-followup-contract.mjs','scripts/v0484-release-contract.mjs'])assert.ok(historicalSuccessor.includes(token),`P8 historical successor lost v0.4.8 behavior reference: ${token}`);

for(const token of ['git push','contents: write','create-or-update-file-contents']){
  assert.equal(replacement.includes(token),false,`Legacy Runtime replacement contains forbidden release mutator token: ${token}`);
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'LEGACY_RUNTIME_WORKFLOW_CONSOLIDATION',
  version:LEGACY_RUNTIME_WORKFLOW_CONSOLIDATION_VERSION,
  retired_workflow_count:retiredWorkflows.length,
  replacement_workflow_count:1,
  net_workflow_reduction:retiredWorkflows.length-1,
  preserved_behavioral_contract_count:preservedBehavioralContracts.length,
  behavioral_contracts_removed:0,
  obsolete_release_mutators_replayed:0,
  protected_nonruntime_workflow_count:protectedNonRuntimeWorkflows.length,
  p5_transferred_core_wrapper_count:p5RetiredCoreWrappers.length,
  p5_core_successor_behavior_count:p5CoreBehaviorTokens.length,
  p8_retired_safety_workflow_count:p8RetiredSafetyWorkflows.length,
  p8_successor_boundaries_verified:true,
  registry_stale_no_main_file_count:registryStaleNoMainFile.length,
},null,2));
