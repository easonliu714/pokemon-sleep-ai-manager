import {spawnSync} from 'node:child_process';

export const HISTORICAL_RELEASE_REGRESSION_VERSION='historical-release-regression-2026-08-11-a';

export const HISTORICAL_RELEASE_CONTRACTS=Object.freeze([
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
]);

function runContract(path){
  const result=spawnSync(process.execPath,[path],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`historical_contract_failed:${path}:exit_${result.status}`);
}

for(const path of HISTORICAL_RELEASE_CONTRACTS)runContract(path);

console.log(JSON.stringify({
  status:'PASS',
  gate:'HISTORICAL_RELEASE_REGRESSION',
  version:HISTORICAL_RELEASE_REGRESSION_VERSION,
  contract_count:HISTORICAL_RELEASE_CONTRACTS.length,
  contracts:HISTORICAL_RELEASE_CONTRACTS,
  workflow_wrappers_replaced:6,
  behavioral_contracts_removed:0,
},null,2));
