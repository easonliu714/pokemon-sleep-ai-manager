import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

export const PRODUCTION_EVIDENCE_REGRESSION_VERSION='production-evidence-regression-2026-08-17-h-e3c7b-local-readiness-ui';
const PREDECESSOR_BRIDGE='scripts/v0423-predecessor-contract-runner.mjs';
const V04275_PRODUCTION_BRIDGE='scripts/v04275-production-contract-runner.mjs';

// Production/G7 behavioral lineage only. Recipe v0.4.22.1 keeps its own
// Recipe Authority workflow and is intentionally not retired by P1.
export const PRODUCTION_BEHAVIORAL_CONTRACTS=Object.freeze([
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
  'scripts/v0428-g75e3c6b-first-party-observation-update-contract.mjs',
  'scripts/v0428-g75e3c7-statistical-readiness-contract.mjs',
  'scripts/v0428-g75e3c7b-local-readiness-ui-contract.mjs',
]);

// v0.4.16–v0.4.22 validate historical release identities but are designed to
// tolerate governed runtime successors. Replay them through the existing
// v0.4.27.x -> v0.4.22.1 identity bridge instead of mutating historical allowlists.
const IDENTITY_BRIDGED_CONTRACTS=new Set([
  'scripts/v0416-g73-production-team-search-contract.mjs',
  'scripts/v0417-g74-ai-proposal-intake-contract.mjs',
  'scripts/v0418-g75-production-evidence-contract.mjs',
  'scripts/v0419-g75a-berry-strength-contract.mjs',
  'scripts/v0420-g75b-favorite-berry-multiplier-contract.mjs',
  'scripts/v0421-g75c-help-event-split-contract.mjs',
  'scripts/v0422-g75d-base-berry-output-contract.mjs',
]);

const PRODUCTION_RUNTIME_FILES=Object.freeze([
  'assets/js/recipe-portfolio-contention.js',
  'assets/js/team-supply-readiness.js',
  'assets/js/bounded-team-search.js',
  'assets/js/strategy-optimization-ai-contract.js',
  'assets/js/strategy-context-local.js',
  'assets/js/production-authority-registry.js',
  'assets/js/production-evidence-registry.js',
  'assets/js/production-evidence-ui.js',
  'assets/js/ingredient-production-evidence-contract.js',
  'assets/js/ingredient-slot-distribution-contract.js',
  'assets/js/ingredient-probability-activation-policy.js',
  'assets/js/ingredient-probability-independent-crosscheck-contract.js',
  'assets/js/ingredient-probability-independent-source-admission.js',
  'assets/js/ingredient-probability-independent-snapshot-contract.js',
  'assets/js/ingredient-probability-independent-source-lineage-review.js',
  'assets/js/ingredient-probability-first-party-observation-contract.js',
  'assets/js/ingredient-probability-first-party-observation-update.js',
  'assets/js/ingredient-probability-first-party-observation-ui.js',
  'assets/js/ingredient-probability-statistical-readiness.js',
  'assets/js/public-species-ingredient-rate-reference.js',
  'assets/js/public-berry-strength-master.js',
  'assets/js/favorite-berry-multiplier-contract.js',
  'assets/js/help-event-split-contract.js',
  'assets/js/base-berry-output-contract.js',
  'assets/js/pokemon-master-options.js',
]);

function annotationSafe(value){return String(value??'').replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');}
function run(command,args,{label=command,env=process.env}={}){
  const result=spawnSync(command,args,{encoding:'utf8',env});
  if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
  if(result.error){console.error(`::error title=${annotationSafe(label)}::${annotationSafe(result.error.message)}`);throw result.error;}
  if(result.status!==0){const detail=[result.stderr,result.stdout].filter(Boolean).join('\n').trim()||`exit ${result.status}`;console.error(`::error title=${annotationSafe(label)}::${annotationSafe(detail)}`);throw new Error(`${label} failed with exit ${result.status}`);}
}

for(const path of [PREDECESSOR_BRIDGE,V04275_PRODUCTION_BRIDGE,...PRODUCTION_RUNTIME_FILES,...PRODUCTION_BEHAVIORAL_CONTRACTS]){
  assert.equal(fs.existsSync(path),true,`Production regression dependency missing: ${path}`);
  run(process.execPath,['--check',path],{label:`syntax:${path}`});
}

for(const path of PRODUCTION_BEHAVIORAL_CONTRACTS){
  if(IDENTITY_BRIDGED_CONTRACTS.has(path))run(process.execPath,[PREDECESSOR_BRIDGE,path],{label:`bridged-contract:${path}`});
  else run(process.execPath,[V04275_PRODUCTION_BRIDGE,path],{label:`v04275-production-bridge:${path}`});
}

const slotSource=fs.readFileSync('assets/js/ingredient-slot-distribution-contract.js','utf8');
for(const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(slotSource.includes(forbidden),false,`ingredient-slot contract contains forbidden path: ${forbidden}`);
const observationSource=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-contract.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB'])assert.equal(observationSource.includes(forbidden),false,`first-party observation contract contains forbidden path: ${forbidden}`);
const observationUpdateSource=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-update.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage'])assert.equal(observationUpdateSource.includes(forbidden),false,`first-party observation update adapter contains forbidden remote/storage side channel: ${forbidden}`);
assert.ok(observationUpdateSource.includes("sample_sufficiency_for_activation:'NOT_DEFINED'"),'E3C-6B must not invent a sufficiency threshold');
assert.ok(observationUpdateSource.includes("activation_authority_granted:false"),'E3C-6B aggregate must not activate Ingredient Probability');
const readinessSource=fs.readFileSync('assets/js/ingredient-probability-statistical-readiness.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(readinessSource.includes(forbidden),false,`E3C-7 readiness contains forbidden authority path: ${forbidden}`);
assert.ok(readinessSource.includes("policy_authority_status:'NOT_YET_DEFINED'"),'E3C-7 current policy must remain undefined until governed thresholds are accepted');
assert.ok(readinessSource.includes('threshold_invented:false'),'E3C-7 must declare that no threshold is invented');
assert.ok(readinessSource.includes('activation_authority_granted:false'),'E3C-7 readiness must not self-activate Ingredient Probability');
assert.ok(readinessSource.includes("production_active_dimensions:'4/7'"),'E3C-7 must preserve Production 4/7 while readiness only is implemented');
const strategyLocalSource=fs.readFileSync('assets/js/strategy-context-local.js','utf8');
assert.ok(strategyLocalSource.includes('ingredient_probability_statistical_readiness:buildLocalIngredientProbabilityStatisticalReadiness()'),'E3C-7B readiness must be attached to local Production Evidence snapshot');
const productionUiSource=fs.readFileSync('assets/js/production-evidence-ui.js','utf8');
assert.ok(productionUiSource.includes('Readiness ≠ Production Activation'),'E3C-7B UI must distinguish readiness from activation');
assert.ok(productionUiSource.includes('目前尚未核准統計充分性門檻'),'E3C-7B UI must state that production sufficiency thresholds are not governed yet');

run('git',['diff','--exit-code'],{label:'repository mutation guard'});
console.log(JSON.stringify({status:'PASS',gate:'PRODUCTION_EVIDENCE_REGRESSION',version:PRODUCTION_EVIDENCE_REGRESSION_VERSION,behavioral_contract_count:PRODUCTION_BEHAVIORAL_CONTRACTS.length,identity_bridged_contract_count:IDENTITY_BRIDGED_CONTRACTS.size,v04275_production_successor_bridge:true,runtime_syntax_count:PRODUCTION_RUNTIME_FILES.length,recipe_authority_workflow_retired:false,production_authority_mutated:false,behavioral_contracts_removed:0,runtime_network_authority_added:false,first_party_observation_capture_persistent_local_only:true,first_party_observation_activation_authority:false,e3c7_statistical_readiness_audit:true,e3c7_local_readiness_ui:true,e3c7_governed_thresholds_defined:false,e3c7_activation_authority:false},null,2));
