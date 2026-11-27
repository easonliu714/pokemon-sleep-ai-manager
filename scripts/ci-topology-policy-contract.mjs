import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const CI_TOPOLOGY_POLICY_VERSION='ci-topology-policy-2026-09-10-g121e-independent-boundary';
const WORKFLOW_DIR='.github/workflows';
const G121E_BOUNDARY_DOC='docs/G12_1E_CI_BOUNDARY.md';

const APPROVED_MAIN_WORKFLOWS=Object.freeze([
  'data-boundary-regression.yml',
  'deploy-pages.yml',
  'g121e-evolution-ui-regression.yml',
  'g14-safety-regression.yml',
  'historical-release-regression.yml',
  'js-syntax-check.yml',
  'legacy-runtime-regression.yml',
  'production-evidence-regression.yml',
  'recipe-regression.yml',
  'regression-gate.yml',
  'screenshot-pipeline-regression.yml',
  'tech2d-android-import-regression.yml',
  'war-room-regression.yml',
]);

const PROTECTED_INDEPENDENT_WORKFLOWS=Object.freeze([
  'regression-gate.yml',
  'js-syntax-check.yml',
  'tech2d-android-import-regression.yml',
  'deploy-pages.yml',
  'data-boundary-regression.yml',
  'historical-release-regression.yml',
  'production-evidence-regression.yml',
  'legacy-runtime-regression.yml',
  'screenshot-pipeline-regression.yml',
  'recipe-regression.yml',
  'war-room-regression.yml',
  'g14-safety-regression.yml',
  'g121e-evolution-ui-regression.yml',
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
  'v042-recipe-authority-audit.yml',
  'v04221-recipe-formula-authority-audit.yml',
  'v043-r21-recipe-zh-tw-evidence-audit.yml',
  'v043-release-integration.yml',
  'g14-backup-truth-restore.yml',
  'g14-data-consistency-multicapture.yml',
  'g14-full75-recovery.yml',
  'g14-public-catalog-renderer-authority.yml',
  'privacy-guard.yml',
  'public-pages-empty-profile.yml',
  'v0481-live-followup.yml',
  'v0484-touch-first-camp-containment.yml',
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
  'scripts/ci-p8-safety-boundary-parity-contract.mjs',
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
assert.equal(fs.existsSync(G121E_BOUNDARY_DOC),true,'G12.1E independent workflow requires explicit boundary documentation');
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

// G265 #907: the protected check may never pass on a failed/cancelled/skipped
// isolated native matrix. The unchanged native script must execute on every
// event; moving it out of the shared runner is not permission to omit it.
const nativeJobMarker='\n  g265-native-isolated-reproduction:\n';
const nativeJobOffset=regressionWorkflow.indexOf(nativeJobMarker);
assert.ok(nativeJobOffset>0,'mandatory G265 native isolation job missing');
const requiredJob=regressionWorkflow.slice(regressionWorkflow.indexOf('\n  regression-gate:\n'),nativeJobOffset);
const nativeJob=regressionWorkflow.slice(nativeJobOffset);
assert.match(requiredJob,/\n    needs: g265-native-isolated-reproduction\n    if: \$\{\{ always\(\) \}\}\n/,'protected regression-gate must run and fail closed on every matrix outcome');
assert.doesNotMatch(nativeJob,/\n    if:/,'mandatory native matrix may not be restricted to a PR branch or event');
assert.doesNotMatch(nativeJob,/continue-on-error:\s*true/,'mandatory native matrix failures must not be suppressed');
assert.match(nativeJob,/scenario: \[weekly-alone, collection-then-weekly\]/,'both real native scenarios required');
assert.match(nativeJob,/run_native scripts\/g265-collection-production-native-durable\.mjs collection/);
assert.match(nativeJob,/run_native scripts\/g265-weekly-context-production-native-durable\.mjs weekly/);
assert.match(nativeJob,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/,'checkout exact event authority');
assert.match(requiredJob,/G265_NATIVE_RESULT: \$\{\{ needs\.g265-native-isolated-reproduction\.result \}\}/);
const nativeResultGuard=requiredJob.match(/- name: Require G265 native isolation matrix success\n[ ]+env:\n[ ]+G265_NATIVE_RESULT:[^\n]+\n[ ]+run: \|\n((?:          [^\n]*\n)+)/);
assert.ok(nativeResultGuard,'required native matrix result guard missing');
const guardShell=nativeResultGuard[1].replace(/^ {10}/gm,'');
for(const [result,expected] of [['success',0],['failure',1],['cancelled',1],['skipped',1],['',1]]){
  const probe=spawnSync('bash',['-e','-c',guardShell],{encoding:'utf8',env:{...process.env,G265_NATIVE_RESULT:result}});
  if(probe.error)throw probe.error;
  assert.equal(probe.status,expected,'G265 protected dependency guard did not fail closed for '+JSON.stringify(result));
}
console.log('PASS G265_NATIVE_REQUIRED_MATRIX_FAIL_CLOSED_SUCCESS_FAILURE_CANCELLED_SKIPPED_MISSING');

// Regression against a second renderer dispatch after successful initialization.
// The boot fact is the actual production return value, not a hard-coded flag;
// all original durable, writer, stale and fresh-reader assertions stay required.
for(const [file,property] of [
  ['scripts/g265-collection-production-native-durable.mjs','__g265Boot'],
  ['scripts/g265-weekly-context-production-native-durable.mjs','__boot'],
]){
  const fixture=fs.readFileSync(file,'utf8');
  assert.match(fixture,/const bootReceipts=new WeakMap\(\)/);
  assert.ok(fixture.includes('return window.'+property+';')||fixture.includes('return {boot:window.'+property+',refreshed};'),'actual boot return missing: '+file);
  assert.ok(fixture.includes('bootReceipts.set(page,Object.freeze(receipt));')||fixture.includes('bootReceipts.set(page,Object.freeze(receipt.boot));'),'page-bound receipt missing: '+file);
  assert.ok(fixture.includes('[writer,stale].map(p=>bootReceipts.get(p))'),'both contender boot receipts required: '+file);
  assert.doesNotMatch(fixture,/evaluate\(\(\)=>window\.__(?:g265Boot|boot)\)/,'duplicate renderer boot dispatch: '+file);
  assert.match(fixture,/assert\.ok\((?:contenderBoots|boots)\.every\(b=>b\.boot_persist_skipped\)/,'boot mutation assertion must remain: '+file);
}
console.log('PASS G265_NATIVE_BOOT_RECEIPT_NO_DUPLICATE_RENDERER_DISPATCH');

// Seed refresh must complete in the original real production boot invocation;
// never substitute a fabricated UPDATED/UNCHANGED or explicitly refresh contenders.
const weeklySeedFixture=fs.readFileSync('scripts/g265-weekly-context-production-native-durable.mjs','utf8');
assert.match(weeklySeedFixture,/async function tab\(\{seedRefresh=false\}=\{\}\)/);
assert.match(weeklySeedFixture,/if\(seedRefresh\)\{\s*console\.log\('G265_WEEKLY_SEED_REFRESH_IMPORT_BEGIN'\);\s*const m=await import\('\/assets\/js\/public-event-master-bootstrap\.js'\);[\s\S]*?refreshed=await m\.refreshPublicEventMasterForCurrentWeek\(\);/);
assert.match(weeklySeedFixture,/return \{boot:window\.__boot,refreshed\};\s*\},\{seedRefresh\}\)/);
assert.match(weeklySeedFixture,/const seed=await tab\(\{seedRefresh:true\}\);\s*const boot=bootReceipts\.get\(seed\);\s*const refreshed=seedRefreshReceipts\.get\(seed\);/);
assert.doesNotMatch(weeklySeedFixture,/const refreshed=await seed\.evaluate/);
assert.match(weeklySeedFixture,/assert\.ok\(\['UPDATED','UNCHANGED'\]\.includes\(refreshed\.status\)/);
assert.match(weeklySeedFixture,/const writer=await tab\(\),stale=await tab\(\)/);
console.log('PASS G265_WEEKLY_SEED_REFRESH_ORIGINAL_BOOT_RECEIPT');

// Require full Chromium without shell fallback/retry; preserve launch evidence.
for(const file of ['scripts/g265-weekly-context-production-native-durable.mjs','scripts/g265-collection-production-native-durable.mjs']){
  const fixture=fs.readFileSync(file,'utf8');
  assert.match(fixture,/chromium\.launch\(\{channel:'chromium',headless:true,args:\['--no-sandbox'\]\}\)/,'full Chromium channel required: '+file);
  assert.equal((fixture.match(/chromium\.launch\(/g)||[]).length,1,'exactly one launch per fixture: '+file);
  assert.match(fixture,/G265_NATIVE_BROWSER_RUNTIME/,'browser runtime evidence required: '+file);
}
assert.match(nativeJob,/DEBUG: pw:browser/,'capture actual browser executable in matrix logs');
console.log('PASS G265_NATIVE_FULL_CHROMIUM_RUNTIME_CONTRACT');

// Probe is diagnostic only: both original SQL reads, original deadlines and
// native matrix remain mandatory. Execute its deterministic behavior contract.
assert.match(weeklySeedFixture,/observePendingOperation\(\(\)=>page\.evaluate/);
for(const marker of ['ENTER','ROWS_ACK','PUBLIC_ACK','RETURN','NODE_ACK'])
  assert.ok(weeklySeedFixture.includes('G265_WEEKLY_LOADED_PHASE_'+marker));
assert.match(weeklySeedFixture,/session\.send\('Runtime\.evaluate',\{expression:'1\+1'/);
assert.match(weeklySeedFixture,/const loaded=window\.__db\.rows\('SELECT context_id,week_start,base_notes FROM weekly_context ORDER BY context_id'\)/);
assert.match(weeklySeedFixture,/const publicEvents=window\.__db\.rows\('SELECT COUNT\(\*\) AS n FROM public_event_master'\)/);
assert.match(nativeJob,/timeout --signal=TERM --kill-after=10s 120s node/);
replayTopologyContract('scripts/g265-pending-operation-probe-contract.mjs');





assert.equal(fs.existsSync('docs/CI_TOPOLOGY_POLICY.md'),true,'CI topology policy documentation missing');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_TOPOLOGY_POLICY',
  version:CI_TOPOLOGY_POLICY_VERSION,
  main_workflow_file_count:actualWorkflowFiles.length,
  approved_main_workflow_file_count:APPROVED_MAIN_WORKFLOWS.length,
  target_band:'11-14',
  target_band_met:actualWorkflowFiles.length>=11&&actualWorkflowFiles.length<=14,
  version_specific_workflow_count:actualVersionSpecific.length,
  protected_independent_workflow_count:PROTECTED_INDEPENDENT_WORKFLOWS.length,
  retired_wrapper_contracts_replayed:TOPOLOGY_CONTRACTS.length,
  p5_retired_wrapper_count:6,
  p6a_retired_wrapper_count:4,
  p6a_retirement_complete:true,
  p6b_retired_domain_workflow_count:3,
  p6b_retirement_complete:true,
  p7_retired_wrapper_count:4,
  p7_retirement_complete:true,
  p8_retired_workflow_count:8,
  p8_retirement_complete:true,
  p8_js_syntax_retirement_decision:'RETAIN_INDEPENDENT_ISSUES_WRITE_AND_EXHAUSTIVE_ASSETS_JS_BOUNDARY',
  g121e_independent_boundary_approved:true,
  g121e_boundary_document:G121E_BOUNDARY_DOC,
  registry_stale_no_main_file_count:REGISTRY_STALE_NO_MAIN_FILE.length,
  actions_registry_is_authoritative:false,
  main_tree_is_topology_authority:true,
  new_standalone_version_workflow_policy:'DENY_BY_DEFAULT_REQUIRE_EXPLICIT_POLICY_AMENDMENT_AND_INDEPENDENT_BOUNDARY_JUSTIFICATION',
  repository_release_mutator_workflows_allowed:false,
  behavioral_contracts_removed:0,
},null,2));