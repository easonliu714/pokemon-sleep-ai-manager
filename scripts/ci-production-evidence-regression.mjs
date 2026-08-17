import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

export const PRODUCTION_EVIDENCE_REGRESSION_VERSION='production-evidence-regression-2026-08-17-l-e3c7c4-discovery-register';
const PREDECESSOR_BRIDGE='scripts/v0423-predecessor-contract-runner.mjs';
const V04275_PRODUCTION_BRIDGE='scripts/v04275-production-contract-runner.mjs';

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
  'scripts/v0428-g75e3c7c1-sufficiency-evidence-pack-contract.mjs',
  'scripts/v0428-g75e3c7c2-independent-source-lineage-reconciliation-contract.mjs',
  'scripts/v0428-g75e3c7c3-independent-candidate-discovery-contract.mjs',
  'scripts/v0428-g75e3c7c4-independent-candidate-discovery-register-contract.mjs',
]);

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
  'assets/js/ingredient-probability-independent-source-readiness.js',
  'assets/js/ingredient-probability-independent-snapshot-contract.js',
  'assets/js/ingredient-probability-independent-source-lineage-review.js',
  'assets/js/ingredient-probability-independent-candidate-discovery-register.js',
  'assets/js/ingredient-probability-first-party-observation-contract.js',
  'assets/js/ingredient-probability-first-party-observation-update.js',
  'assets/js/ingredient-probability-first-party-observation-ui.js',
  'assets/js/ingredient-probability-statistical-readiness.js',
  'assets/js/ingredient-probability-sufficiency-evidence-pack.js',
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
const sourceAdmissionSource=fs.readFileSync('assets/js/ingredient-probability-independent-source-admission.js','utf8');
assert.ok(sourceAdmissionSource.includes('fork_or_mirror_of_primary_numeric_lineage'),'E3C-7C2 generic primary-fork rejection missing');
assert.ok(sourceAdmissionSource.includes('repository_or_domain_difference_proves_independence:false'),'E3C-7C2 must not infer independence from repository/domain difference');
const sourceLineageSource=fs.readFileSync('assets/js/ingredient-probability-independent-source-lineage-review.js','utf8');
assert.ok(sourceLineageSource.includes("source_id:'SLEEPAPI_GITHUB_FORK'"),'E3C-7C2 SleepAPI fork review missing');
assert.ok(sourceLineageSource.includes('PARENT=nerolis-lab/nerolis-lab'),'E3C-7C2 SleepAPI fork parent evidence missing');
assert.ok(sourceLineageSource.includes("source_id:'MATHCORD_RP_FIT_MODEL'"),'E3C-7C3 RP-fit discovery candidate missing');
assert.ok(sourceLineageSource.includes('MODEL_FIT_OR_PLACEHOLDER'),'E3C-7C3 RP-fit evidence class must stay model-fit');
assert.ok(sourceLineageSource.includes('2fbc7fa68066c8a76f47623dabdf801b78544dc6'),'E3C-7C3 pinned RP-fit current revision evidence missing');
assert.ok(sourceLineageSource.includes('MODEL_FIT_REVERSE_ENGINEERED_NOT_DIRECT_HELP_EVENT_OBSERVATION'),'E3C-7C3 direct-observation blocker missing');
const independentReadinessSource=fs.readFileSync('assets/js/ingredient-probability-independent-source-readiness.js','utf8');
assert.ok(independentReadinessSource.includes('currentIngredientProbabilitySourceLineageReview'),'E3C-7C2 readiness must derive from reviewed lineage authority');
assert.ok(independentReadinessSource.includes('lineage_review_reconciled:true'),'E3C-7C2 readiness reconciliation marker missing');
assert.ok(independentReadinessSource.includes('stale_pre_lineage_review_candidate_status_allowed:false'),'E3C-7C2 stale pre-review statuses must be forbidden');
assert.ok(independentReadinessSource.includes('model_fit_candidate_auto_accepted:false'),'E3C-7C3 model-fit discovery candidate must not auto-admit');
assert.ok(independentReadinessSource.includes('RESOLVE_REVIEW_REQUIRED_SOURCE_CANDIDATE_OR_FIND_NEW_CANDIDATE'),'E3C-7C3 review-required next action missing');
const discoveryRegisterSource=fs.readFileSync('assets/js/ingredient-probability-independent-candidate-discovery-register.js','utf8');
assert.ok(discoveryRegisterSource.includes('currentIngredientProbabilitySourceLineageReview'),'E3C-7C4 discovery register must derive governed candidates from lineage review');
assert.ok(discoveryRegisterSource.includes('discovery_lead_counts_as_admitted_source:false'),'E3C-7C4 discovery leads must not count as admitted sources');
assert.ok(discoveryRegisterSource.includes('HISTORICAL_DATASET_LOCATION_NOT_RESOLVED'),'E3C-7C4 unresolved recorded-data lead blocker missing');
assert.ok(discoveryRegisterSource.includes('INGREDIENT_PROBABILITY_IS_INPUT_NOT_MEASURED_OUTPUT'),'E3C-7C4 Helper Whistle non-rate-measurement blocker missing');
assert.ok(discoveryRegisterSource.includes('RESOLVE_OPEN_RECORDED_DATA_LEAD_OR_FIND_NEW_DIRECT_OBSERVATION_SOURCE'),'E3C-7C4 next action missing');
const strategyLocalSource=fs.readFileSync('assets/js/strategy-context-local.js','utf8');
assert.ok(strategyLocalSource.includes('ingredient_probability_statistical_readiness:readiness'),'E3C-7B readiness must be attached to local Production Evidence snapshot');
assert.ok(strategyLocalSource.includes('ingredient_probability_sufficiency_evidence_pack:sufficiencyPack'),'E3C-7C1 sufficiency pack must be attached to local Production Evidence snapshot');
const productionUiSource=fs.readFileSync('assets/js/production-evidence-ui.js','utf8');
assert.ok(productionUiSource.includes('Readiness ≠ Production Activation'),'E3C-7B UI must distinguish readiness from activation');
assert.ok(productionUiSource.includes('目前尚未核准統計充分性門檻'),'E3C-7B UI must state that production sufficiency thresholds are not governed yet');
const sufficiencySource=fs.readFileSync('assets/js/ingredient-probability-sufficiency-evidence-pack.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(sufficiencySource.includes(forbidden),false,`E3C-7C1 pack contains forbidden authority/write path: ${forbidden}`);
assert.ok(sufficiencySource.includes('threshold_candidate_values'));
assert.ok(sufficiencySource.includes('threshold_recommendation_authority:false'));
assert.ok(sufficiencySource.includes('source_keys_included:false'));
assert.ok(sufficiencySource.includes('raw_observations_included:false'));

run('git',['diff','--exit-code'],{label:'repository mutation guard'});
console.log(JSON.stringify({status:'PASS',gate:'PRODUCTION_EVIDENCE_REGRESSION',version:PRODUCTION_EVIDENCE_REGRESSION_VERSION,behavioral_contract_count:PRODUCTION_BEHAVIORAL_CONTRACTS.length,identity_bridged_contract_count:IDENTITY_BRIDGED_CONTRACTS.size,v04275_production_successor_bridge:true,runtime_syntax_count:PRODUCTION_RUNTIME_FILES.length,recipe_authority_workflow_retired:false,production_authority_mutated:false,behavioral_contracts_removed:0,runtime_network_authority_added:false,first_party_observation_capture_persistent_local_only:true,first_party_observation_activation_authority:false,e3c7_statistical_readiness_audit:true,e3c7_local_readiness_ui:true,e3c7_sufficiency_evidence_pack:true,e3c7_independent_source_lineage_reconciliation:true,e3c7_sleepapi_primary_fork_rejected:true,e3c7_stale_source_readiness_status_allowed:false,e3c7_candidate_discovery_audit:true,e3c7_rp_fit_model_candidate_review_required:true,e3c7_model_fit_candidate_auto_accepted:false,e3c7_candidate_discovery_register:true,e3c7_unresolved_recorded_data_lead_is_not_admitted:true,e3c7_helper_whistle_validation_is_not_rate_measurement:true,e3c7_governed_thresholds_defined:false,e3c7_threshold_recommendation_authority:false,e3c7_activation_authority:false},null,2));
