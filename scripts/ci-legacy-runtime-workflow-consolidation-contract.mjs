import assert from 'node:assert/strict';
import fs from 'node:fs';

export const LEGACY_RUNTIME_WORKFLOW_CONSOLIDATION_VERSION='legacy-runtime-workflow-consolidation-2026-08-14-a';

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

// These workflows are outside P2. Their presence is a hard guard against a
// version-number-only cleanup accidentally deleting data/Update Center safety gates.
const protectedNonRuntimeWorkflows=Object.freeze([
  '.github/workflows/v0396-general-json-audit.yml',
  '.github/workflows/v0397-profile-completeness.yml',
  '.github/workflows/v0398-update-center-multiscenario.yml',
  '.github/workflows/privacy-guard.yml',
  '.github/workflows/regression-gate.yml',
  '.github/workflows/tech2d-android-import-regression.yml',
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/g14-backup-truth-restore.yml',
  '.github/workflows/g14-full75-recovery.yml',
  '.github/workflows/g14-data-consistency-multicapture.yml',
  '.github/workflows/g14-public-catalog-renderer-authority.yml',
  '.github/workflows/production-evidence-regression.yml',
]);

// GitHub Actions may continue to display workflow identities whose YAML has
// already disappeared from main. They are registry history, not files to re-create.
const registryStaleNoMainFile=Object.freeze([
  '.github/workflows/v0393-release-authority-generator.yml',
  '.github/workflows/v0393-post-migration-startup-gate.yml',
]);

for(const path of retiredWorkflows)assert.equal(fs.existsSync(path),false,`retired legacy runtime workflow still exists: ${path}`);
for(const path of preservedBehavioralContracts)assert.equal(fs.existsSync(path),true,`legacy runtime behavioral contract missing: ${path}`);
for(const path of protectedNonRuntimeWorkflows)assert.equal(fs.existsSync(path),true,`P2 deleted protected non-runtime workflow: ${path}`);
for(const path of registryStaleNoMainFile)assert.equal(fs.existsSync(path),false,`registry-stale workflow unexpectedly reappeared on main: ${path}`);

const replacementPath='.github/workflows/legacy-runtime-regression.yml';
assert.equal(fs.existsSync(replacementPath),true,'Legacy Runtime Regression workflow missing');
const replacement=fs.readFileSync(replacementPath,'utf8');
const runner=fs.readFileSync('scripts/ci-legacy-runtime-regression.mjs','utf8');
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

// Old release mutators intentionally are not replayed. Current Version Authority
// is read/validated only; CI topology cleanup must never rotate old releases.
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
  registry_stale_no_main_file_count:registryStaleNoMainFile.length,
},null,2));
