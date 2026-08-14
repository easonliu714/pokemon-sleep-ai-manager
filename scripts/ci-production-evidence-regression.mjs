import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

export const PRODUCTION_EVIDENCE_REGRESSION_VERSION='production-evidence-regression-2026-08-14-a';

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
  'tests/v04221_recipe_level_energy_gate.mjs',
  'scripts/v04221-recipe-formula-authority-audit.mjs',
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

const PRODUCTION_RUNTIME_FILES=Object.freeze([
  'assets/js/recipe-portfolio-contention.js',
  'assets/js/team-supply-readiness.js',
  'assets/js/bounded-team-search.js',
  'assets/js/strategy-optimization-ai-contract.js',
  'assets/js/production-authority-registry.js',
  'assets/js/production-evidence-registry.js',
  'assets/js/ingredient-production-evidence-contract.js',
  'assets/js/ingredient-slot-distribution-contract.js',
  'assets/js/ingredient-probability-activation-policy.js',
  'assets/js/ingredient-probability-independent-crosscheck-contract.js',
  'assets/js/ingredient-probability-independent-source-admission.js',
  'assets/js/ingredient-probability-independent-snapshot-contract.js',
  'assets/js/ingredient-probability-independent-source-lineage-review.js',
  'assets/js/ingredient-probability-first-party-observation-contract.js',
  'assets/js/public-species-ingredient-rate-reference.js',
  'assets/js/public-berry-strength-master.js',
  'assets/js/favorite-berry-multiplier-contract.js',
  'assets/js/help-event-split-contract.js',
  'assets/js/base-berry-output-contract.js',
  'assets/js/pokemon-master-options.js',
]);

function run(command,args,{label=command,env=process.env}={}){
  const result=spawnSync(command,args,{stdio:'inherit',env});
  if(result.error)throw result.error;
  assert.equal(result.status,0,`${label} failed with exit ${result.status}`);
}

for(const path of [...PRODUCTION_RUNTIME_FILES,...PRODUCTION_BEHAVIORAL_CONTRACTS]){
  assert.equal(fs.existsSync(path),true,`Production regression dependency missing: ${path}`);
  run(process.execPath,['--check',path],{label:`syntax:${path}`});
}

for(const path of PRODUCTION_BEHAVIORAL_CONTRACTS){
  run(process.execPath,[path],{label:`contract:${path}`});
}

const slotSource=fs.readFileSync('assets/js/ingredient-slot-distribution-contract.js','utf8');
for(const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun(']){
  assert.equal(slotSource.includes(forbidden),false,`ingredient-slot contract contains forbidden path: ${forbidden}`);
}

const observationSource=fs.readFileSync('assets/js/ingredient-probability-first-party-observation-contract.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB']){
  assert.equal(observationSource.includes(forbidden),false,`first-party observation contract contains forbidden path: ${forbidden}`);
}

run('git',['diff','--exit-code'],{label:'repository mutation guard'});

console.log(JSON.stringify({
  status:'PASS',
  gate:'PRODUCTION_EVIDENCE_REGRESSION',
  version:PRODUCTION_EVIDENCE_REGRESSION_VERSION,
  behavioral_contract_count:PRODUCTION_BEHAVIORAL_CONTRACTS.length,
  runtime_syntax_count:PRODUCTION_RUNTIME_FILES.length,
  production_authority_mutated:false,
  behavioral_contracts_removed:0,
  runtime_network_authority_added:false,
},null,2));
