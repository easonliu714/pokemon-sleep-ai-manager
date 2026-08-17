import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS,
  INDEPENDENT_SOURCE_ADMISSION_STATUS,
  currentIndependentIngredientProbabilitySourceAdmissionContract,
  evaluateIndependentIngredientProbabilitySourceAdmission,
} from '../assets/js/ingredient-probability-independent-source-admission.js';
import {INDEPENDENT_CROSSCHECK_SOURCE_STATUS} from '../assets/js/ingredient-probability-independent-crosscheck-contract.js';
import {currentIngredientProbabilityIndependentSourceReadiness} from '../assets/js/ingredient-probability-independent-source-readiness.js';
import {currentPublicSpeciesFormRoster} from '../assets/js/public-pokemon-species-form-roster.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const contract=currentIndependentIngredientProbabilitySourceAdmissionContract();
assert.equal(contract.schema,'pokemon-sleep-ingredient-probability-independent-source-admission/1.0');
assert.equal(contract.automatic_source_acceptance,false);
assert.equal(contract.human_lineage_review_required,true);
assert.equal(contract.activation_authority_granted,false);
for(const key of ['self_asserted_independence_sufficient','same_primary_lineage_counts_as_independent','partial_coverage_implies_complete','exact_match_implies_activation','ai_generated_numeric_source_allowed','runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority'])assert.equal(contract.safety[key],false,`unsafe admission contract flag ${key}`);

const base={
  source_id:'fixture-independent-source',
  derived_from_neroli_primary:false,
  mirror_of_neroli_primary:false,
  ai_generated_numeric_source:false,
  untraceable_summary:false,
  lineage_review_status:INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.HUMAN_REVIEWED_ACCEPTED,
  lineage_evidence_refs:['fixture://lineage-evidence-1'],
  snapshot_hash_algorithm:'sha256',
  snapshot_hash:'0123456789abcdef',
  snapshot_scope_date:'2026-08-14',
  source_version:'fixture-v1',
  parser_version:'fixture-parser-v1',
  mapped_row_count:100,
  roster_row_count:242,
  form_safe_mapping_audit_passed:true,
  published_numeric_precision_preserved:true,
  partial_coverage_reported_explicitly:true,
};
const ready=evaluateIndependentIngredientProbabilitySourceAdmission(base);
assert.equal(ready.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.ADMISSION_READY_FOR_CROSSCHECK);
assert.equal(ready.independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_ACCEPTED);
assert.equal(ready.may_count_as_independent_crosscheck,true);
assert.equal(ready.mapped_row_count,100);
assert.equal(ready.roster_row_count,242);
assert.equal(ready.coverage_ratio,100/242);
assert.equal(ready.complete_coverage,false);
assert.equal(ready.activation_authority_granted,false);
const complete=evaluateIndependentIngredientProbabilitySourceAdmission({...base,mapped_row_count:242});
assert.equal(complete.complete_coverage,true);
assert.equal(complete.activation_authority_granted,false,'complete independent source coverage still cannot self-activate Production');

const derived=evaluateIndependentIngredientProbabilitySourceAdmission({...base,derived_from_neroli_primary:true});
assert.equal(derived.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
assert.equal(derived.independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.DERIVED_OR_MIRROR_OF_PRIMARY);
assert.equal(derived.may_count_as_independent_crosscheck,false);
const mirror=evaluateIndependentIngredientProbabilitySourceAdmission({...base,mirror_of_neroli_primary:true});
assert.equal(mirror.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE);
const ai=evaluateIndependentIngredientProbabilitySourceAdmission({...base,ai_generated_numeric_source:true});
assert.equal(ai.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_AI_OR_UNTRACEABLE);
assert.equal(ai.independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.AI_OR_UNTRACEABLE_SUMMARY);
const untraceable=evaluateIndependentIngredientProbabilitySourceAdmission({...base,untraceable_summary:true});
assert.equal(untraceable.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_AI_OR_UNTRACEABLE);

const reviewCases=[
  [{...base,lineage_review_status:INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.NOT_REVIEWED},'HUMAN_REVIEWED_LINEAGE_INDEPENDENCE_MISSING'],
  [{...base,lineage_evidence_refs:[]},'LINEAGE_EVIDENCE_REFS_MISSING'],
  [{...base,snapshot_hash:''},'PINNED_SNAPSHOT_HASH_MISSING'],
  [{...base,snapshot_scope_date:'',snapshot_release_id:''},'SNAPSHOT_SCOPE_MISSING'],
  [{...base,source_version:'',source_revision:''},'SOURCE_VERSION_OR_REVISION_MISSING'],
  [{...base,parser_version:''},'PARSER_VERSION_MISSING'],
  [{...base,mapped_row_count:243},'MAPPED_OR_ROSTER_ROW_COUNT_INVALID'],
  [{...base,mapped_row_count:-1},'MAPPED_OR_ROSTER_ROW_COUNT_INVALID'],
  [{...base,form_safe_mapping_audit_passed:false},'FORM_SAFE_MAPPING_AUDIT_NOT_PASSED'],
  [{...base,published_numeric_precision_preserved:false},'PUBLISHED_NUMERIC_PRECISION_NOT_PRESERVED'],
  [{...base,partial_coverage_reported_explicitly:false},'PARTIAL_COVERAGE_REPORTING_CONTRACT_MISSING'],
];
for(const [fixture,reason] of reviewCases){
  const result=evaluateIndependentIngredientProbabilitySourceAdmission(fixture);
  assert.equal(result.status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED);
  assert.equal(result.reason,reason);
  assert.equal(result.independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED);
  assert.equal(result.may_count_as_independent_crosscheck,false);
}

const readiness=currentIngredientProbabilityIndependentSourceReadiness();
assert.equal(readiness.accepted_source_count,0,'admission evaluator fixture must not alter current source readiness');
assert.ok([
  'HOLD_NO_ACCEPTED_INDEPENDENT_NUMERIC_SOURCE',
  'HOLD_REVIEW_REQUIRED_SOURCE_CANDIDATE_PRESENT',
].includes(readiness.status),'E3C-4A predecessor must remain HOLD while accepted independent source count is zero');
const roster=currentPublicSpeciesFormRoster();
assert.equal(roster.row_count,242);
assert.equal(roster.activation_coverage_denominator_ready,true);
const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=read('assets/js/ingredient-probability-independent-source-admission.js');
for(const forbidden of ['fetch(', 'raw.githubusercontent.com', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ingredient_inventory', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`independent source admission owns forbidden runtime/write path: ${forbidden}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0428_G75E3C4A_INDEPENDENT_SOURCE_ADMISSION',current_accepted_sources:readiness.accepted_source_count,
  current_source_readiness:readiness.status,successor_hold_reason_refinement_supported:true,human_lineage_review_required:true,self_asserted_independence_sufficient:false,
  partial_fixture_coverage:'100/242',complete_fixture_coverage:'242/242',complete_coverage_grants_activation:false,
  primary_mirror_rejected:true,ai_numeric_source_rejected:true,production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));
