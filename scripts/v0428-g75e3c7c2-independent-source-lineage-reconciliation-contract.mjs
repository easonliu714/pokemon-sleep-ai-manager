import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INDEPENDENT_SOURCE_ADMISSION_STATUS,
  INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS,
  evaluateIndependentIngredientProbabilitySourceAdmission,
  currentIndependentIngredientProbabilitySourceAdmissionContract,
} from '../assets/js/ingredient-probability-independent-source-admission.js';
import {
  SOURCE_LINEAGE_CLASS,
  currentIngredientProbabilitySourceLineageReview,
} from '../assets/js/ingredient-probability-independent-source-lineage-review.js';
import {currentIngredientProbabilityIndependentSourceReadiness} from '../assets/js/ingredient-probability-independent-source-readiness.js';
import {INDEPENDENT_CROSSCHECK_SOURCE_STATUS} from '../assets/js/ingredient-probability-independent-crosscheck-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const lineage=currentIngredientProbabilitySourceLineageReview();
assert.ok(['ingredient-probability-source-lineage-review-v2','ingredient-probability-source-lineage-review-v3'].includes(lineage.review_version));
assert.ok((lineage.candidate_count??lineage.reviewed_candidate_count)>=3,'C2 successor must retain at least the three reconciled candidates');
assert.ok(lineage.reviewed_candidate_count>=3);
assert.equal(lineage.rejected_candidate_count,3,'C2 three known overlapping/forked candidates must remain rejected');
assert.equal(lineage.accepted_independent_source_count,0);
assert.ok(['HOLD_NEED_NEW_INDEPENDENT_SOURCE_CANDIDATE','HOLD_REVIEW_REQUIRED_SOURCE_CANDIDATE_PRESENT'].includes(lineage.status));
assert.equal(lineage.production_probability_activation_allowed,false);
assert.equal(lineage.safety.primary_repository_fork_counts_as_independent,false);
assert.equal(lineage.safety.repository_or_domain_difference_proves_independence,false);

const byId=new Map(lineage.reviews.map(row=>[row.source_id,row]));
for(const sourceId of ['RAENONX_PRODUCTION_RATES','POKEMON_SLEEP_VERIFICATION_WIKI','SLEEPAPI_GITHUB_FORK'])assert.ok(byId.has(sourceId),`review candidate missing ${sourceId}`);

const sleepApi=byId.get('SLEEPAPI_GITHUB_FORK');
assert.equal(sleepApi.lineage_review_status,INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_REJECTED);
assert.equal(sleepApi.lineage_class,SOURCE_LINEAGE_CLASS.FORK_OR_MIRROR_OF_PRIMARY_NUMERIC_LINEAGE);
assert.equal(sleepApi.fork_or_mirror_of_primary_numeric_lineage,true);
assert.equal(sleepApi.mirror_of_neroli_primary,true);
assert.equal(sleepApi.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
assert.equal(sleepApi.admission_reason,'PRIMARY_LINEAGE_OR_MIRROR_CANNOT_BE_INDEPENDENT');
assert.equal(sleepApi.admission_independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.DERIVED_OR_MIRROR_OF_PRIMARY);
assert.equal(sleepApi.admission_may_count_as_independent_crosscheck,false);
assert.ok(sleepApi.evidence_refs.some(ref=>ref.includes('extraBottle/SleepAPI:FORK=true:PARENT=nerolis-lab/nerolis-lab')),'GitHub parent/fork lineage evidence missing');
assert.ok(sleepApi.evidence_refs.some(ref=>ref.includes('sleepapi.net')),'legacy SleepAPI identity evidence missing');

const raenonx=byId.get('RAENONX_PRODUCTION_RATES');
assert.equal(raenonx.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
assert.equal(raenonx.admission_independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.DERIVED_OR_MIRROR_OF_PRIMARY);
assert.ok(raenonx.evidence_refs.some(ref=>ref.includes('63b0a17e2e92fc9e5d4be03c695e5896be8a0f25')));
assert.ok(raenonx.evidence_refs.some(ref=>ref.includes('2bc560a50f78f7c5c6d115f1d529ead1505cb588')),'current 2026 RaenonX-backed Neroli commit evidence missing');

const wiki=byId.get('POKEMON_SLEEP_VERIFICATION_WIKI');
assert.equal(wiki.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
assert.equal(wiki.admission_independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.DERIVED_OR_MIRROR_OF_PRIMARY);

const readiness=currentIngredientProbabilityIndependentSourceReadiness();
assert.ok(['ingredient-probability-independent-source-readiness-v2','ingredient-probability-independent-source-readiness-v3'].includes(readiness.readiness_version));
assert.equal(readiness.lineage_review_reconciled,true);
assert.equal(readiness.lineage_review_version,lineage.review_version);
assert.equal(readiness.reviewed_candidate_count,3,'the three C2 candidates must remain terminally reviewed');
assert.equal(readiness.rejected_source_count,3);
assert.ok(readiness.review_required_source_count>=0);
assert.equal(readiness.accepted_source_count,0);
assert.ok(['HOLD_NO_ACCEPTED_INDEPENDENT_NUMERIC_SOURCE','HOLD_REVIEW_REQUIRED_SOURCE_CANDIDATE_PRESENT'].includes(readiness.status));
assert.ok(['FIND_GENUINELY_INDEPENDENT_NUMERIC_SOURCE_CANDIDATE','RESOLVE_REVIEW_REQUIRED_SOURCE_CANDIDATE_OR_FIND_NEW_CANDIDATE'].includes(readiness.next_action));
assert.equal(readiness.production_probability_activation_allowed,false);
assert.equal(readiness.production_active_dimensions,'4/7');
assert.equal(readiness.safety.stale_pre_lineage_review_candidate_status_allowed,false);
assert.equal(readiness.safety.primary_repository_fork_counts_as_independent,false);
assert.equal(readiness.safety.repository_or_domain_difference_proves_independence,false);

const readinessById=new Map(readiness.candidates.map(row=>[row.source_id,row]));
for(const sourceId of ['RAENONX_PRODUCTION_RATES','POKEMON_SLEEP_VERIFICATION_WIKI','SLEEPAPI_GITHUB_FORK']){
  const row=readinessById.get(sourceId);
  assert.ok(row,`readiness candidate missing ${sourceId}`);
  assert.equal(row.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
  assert.equal(row.independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.DERIVED_OR_MIRROR_OF_PRIMARY);
  assert.equal(row.machine_snapshot_status,'NOT_APPLICABLE_REJECTED_LINEAGE');
  assert.equal(row.may_count_as_independent_crosscheck,false);
  assert.notEqual(row.independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED,'human-rejected lineage must not remain stale NOT_YET_ESTABLISHED');
}

const admissionContract=currentIndependentIngredientProbabilitySourceAdmissionContract();
assert.equal(admissionContract.contract_version,'ingredient-probability-independent-source-admission-v2');
assert.equal(admissionContract.safety.repository_or_domain_difference_proves_independence,false);
assert.equal(admissionContract.safety.primary_repository_fork_counts_as_independent,false);
const genericFork=evaluateIndependentIngredientProbabilitySourceAdmission({
  source_id:'different-domain-fork-fixture',
  fork_or_mirror_of_primary_numeric_lineage:true,
  lineage_review_status:INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_ACCEPTED,
  lineage_evidence_refs:['fixture://fork-lineage'],
  snapshot_hash_algorithm:'sha256',snapshot_hash:'abc',snapshot_scope_date:'2026-08-17',source_version:'v1',parser_version:'v1',mapped_row_count:1,roster_row_count:242,form_safe_mapping_audit_passed:true,published_numeric_precision_preserved:true,partial_coverage_reported_explicitly:true,
});
assert.equal(genericFork.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
assert.equal(genericFork.reason,'PRIMARY_LINEAGE_OR_MIRROR_CANNOT_BE_INDEPENDENT');
assert.equal(genericFork.may_count_as_independent_crosscheck,false);

const differentDomainOnly=evaluateIndependentIngredientProbabilitySourceAdmission({source_id:'different-domain-only'});
assert.equal(differentDomainOnly.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED);
assert.equal(differentDomainOnly.reason,'HUMAN_REVIEWED_LINEAGE_INDEPENDENCE_MISSING');
assert.equal(differentDomainOnly.may_count_as_independent_crosscheck,false);

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

for(const file of [
  'assets/js/ingredient-probability-independent-source-admission.js',
  'assets/js/ingredient-probability-independent-source-lineage-review.js',
  'assets/js/ingredient-probability-independent-source-readiness.js',
]){
  const source=fs.readFileSync(file,'utf8');
  for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden runtime/write path ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C7C2_INDEPENDENT_SOURCE_LINEAGE_RECONCILIATION',
  reviewed_candidates:lineage.reviewed_candidate_count,
  rejected_candidates:lineage.rejected_candidate_count,
  successor_review_required_candidates:lineage.review_required_candidate_count??readiness.review_required_source_count,
  accepted_independent_sources:lineage.accepted_independent_source_count,
  sleepapi_lineage:sleepApi.lineage_class,
  sleepapi_admission:sleepApi.admission_status,
  readiness_reconciled:true,
  stale_not_yet_established_rejections:0,
  next_action:readiness.next_action,
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
  runtime_network_fetch:false,
  sqlite_write:false,
  ai_numeric_authority:false,
},null,2));
