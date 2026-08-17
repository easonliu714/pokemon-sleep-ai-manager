import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INDEPENDENT_SOURCE_ADMISSION_STATUS,
  INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS,
} from '../assets/js/ingredient-probability-independent-source-admission.js';
import {
  SOURCE_LINEAGE_CLASS,
  currentIngredientProbabilitySourceLineageReview,
} from '../assets/js/ingredient-probability-independent-source-lineage-review.js';
import {currentIngredientProbabilityIndependentSourceReadiness} from '../assets/js/ingredient-probability-independent-source-readiness.js';
import {INDEPENDENT_CROSSCHECK_SOURCE_STATUS} from '../assets/js/ingredient-probability-independent-crosscheck-contract.js';
import {
  INGREDIENT_PROBABILITY_EVIDENCE_CLASS,
  INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT,
  evaluateIngredientProbabilityActivationRow,
} from '../assets/js/ingredient-probability-activation-policy.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const lineage=currentIngredientProbabilitySourceLineageReview();
assert.equal(lineage.review_version,'ingredient-probability-source-lineage-review-v3');
assert.equal(lineage.candidate_count,4);
assert.equal(lineage.reviewed_candidate_count,3);
assert.equal(lineage.review_required_candidate_count,1);
assert.equal(lineage.rejected_candidate_count,3);
assert.equal(lineage.accepted_independent_source_count,0);
assert.equal(lineage.status,'HOLD_REVIEW_REQUIRED_SOURCE_CANDIDATE_PRESENT');
assert.equal(lineage.production_probability_activation_allowed,false);
assert.equal(lineage.safety.model_fit_or_placeholder_counts_as_direct_observation,false);
assert.equal(lineage.safety.current_contributor_identity_proves_numeric_independence,false);

const byId=new Map(lineage.reviews.map(row=>[row.source_id,row]));
const rpFit=byId.get('MATHCORD_RP_FIT_MODEL');
assert.ok(rpFit,'RP-fit discovery candidate must be tracked');
assert.equal(rpFit.lineage_review_status,INDEPENDENT_SOURCE_LINEAGE_REVIEW_STATUS.REVIEW_REQUIRED);
assert.equal(rpFit.lineage_class,SOURCE_LINEAGE_CLASS.INDEPENDENT_LINEAGE_NOT_YET_PROVEN);
assert.equal(rpFit.numeric_evidence_class,INGREDIENT_PROBABILITY_EVIDENCE_CLASS.MODEL_FIT_OR_PLACEHOLDER);
assert.equal(rpFit.direct_help_event_observation_dataset,false);
assert.equal(rpFit.current_revision,'2fbc7fa68066c8a76f47623dabdf801b78544dc6');
assert.equal(rpFit.current_revision_raenonx_authored,true);
assert.equal(rpFit.may_count_as_independent_crosscheck,false);
assert.equal(rpFit.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED);
assert.equal(rpFit.admission_reason,'HUMAN_REVIEWED_LINEAGE_INDEPENDENCE_MISSING');
assert.equal(rpFit.admission_independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED);
assert.equal(rpFit.admission_may_count_as_independent_crosscheck,false);
for(const blocker of [
  'CURRENT_NUMERIC_LINEAGE_INDEPENDENCE_NOT_ESTABLISHED',
  'MODEL_FIT_REVERSE_ENGINEERED_NOT_DIRECT_HELP_EVENT_OBSERVATION',
  'CURRENT_242_SPECIES_FORM_NUMERIC_COVERAGE_NOT_ESTABLISHED',
  'CURRENT_PINNED_MACHINE_READABLE_PROBABILITY_SNAPSHOT_NOT_ADMITTED',
])assert.ok(rpFit.blockers.includes(blocker),`RP-fit blocker missing ${blocker}`);
for(const evidence of [
  'RP_FIT_README:jeancroy/RP-fit:Readme.md:ANALYZES_DATA_FROM_RP_COLLECTION_PROJECT',
  'RP_FIT_CURRENT_HEAD:2fbc7fa68066c8a76f47623dabdf801b78544dc6:AUTHOR_RAENONX:FIXED_RP_MODEL',
  'WIKIWIKI_INGREDIENT_PROBABILITY_VERIFICATION:SP_FORMULA_REVERSE_ENGINEERED_ESTIMATE_WITH_ASSUMPTIONS:MAY_DEVIATE_FROM_ACTUAL_VALUES',
])assert.ok(rpFit.evidence_refs.includes(evidence),`RP-fit evidence missing ${evidence}`);

const readiness=currentIngredientProbabilityIndependentSourceReadiness();
assert.equal(readiness.readiness_version,'ingredient-probability-independent-source-readiness-v3');
assert.equal(readiness.lineage_review_version,lineage.review_version);
assert.equal(readiness.lineage_review_reconciled,true);
assert.equal(readiness.candidate_count,4);
assert.equal(readiness.reviewed_candidate_count,3);
assert.equal(readiness.rejected_source_count,3);
assert.equal(readiness.review_required_source_count,1);
assert.equal(readiness.accepted_source_count,0);
assert.equal(readiness.status,'HOLD_REVIEW_REQUIRED_SOURCE_CANDIDATE_PRESENT');
assert.equal(readiness.next_action,'RESOLVE_REVIEW_REQUIRED_SOURCE_CANDIDATE_OR_FIND_NEW_CANDIDATE');
assert.equal(readiness.production_probability_activation_allowed,false);
assert.equal(readiness.production_active_dimensions,'4/7');
assert.equal(readiness.safety.model_fit_candidate_auto_accepted,false);
assert.equal(readiness.safety.current_contributor_identity_proves_numeric_independence,false);

const readyById=new Map(readiness.candidates.map(row=>[row.source_id,row]));
const rpReady=readyById.get('MATHCORD_RP_FIT_MODEL');
assert.ok(rpReady);
assert.equal(rpReady.source_class,'COMMUNITY_SOURCE_REQUIRES_LINEAGE_REVIEW');
assert.equal(rpReady.numeric_evidence_class,INGREDIENT_PROBABILITY_EVIDENCE_CLASS.MODEL_FIT_OR_PLACEHOLDER);
assert.equal(rpReady.direct_help_event_observation_dataset,false);
assert.equal(rpReady.current_revision,'2fbc7fa68066c8a76f47623dabdf801b78544dc6');
assert.equal(rpReady.independence_status,INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED);
assert.equal(rpReady.admission_status,INDEPENDENT_SOURCE_ADMISSION_STATUS.REVIEW_REQUIRED);
assert.equal(rpReady.machine_snapshot_status,'NOT_PINNED_OR_NOT_ADMISSION_READY');
assert.equal(rpReady.may_count_as_independent_crosscheck,false);
for(const blocker of [
  'CURRENT_NUMERIC_LINEAGE_INDEPENDENCE_NOT_ESTABLISHED',
  'MODEL_FIT_REVERSE_ENGINEERED_NOT_DIRECT_HELP_EVENT_OBSERVATION',
  'CURRENT_242_SPECIES_FORM_NUMERIC_COVERAGE_NOT_ESTABLISHED',
  'CURRENT_PINNED_MACHINE_READABLE_PROBABILITY_SNAPSHOT_NOT_ADMITTED',
  'HUMAN_REVIEWED_LINEAGE_INDEPENDENCE_NOT_COMPLETE',
])assert.ok(rpReady.blockers.includes(blocker),`readiness RP-fit blocker missing ${blocker}`);

const modelFitActivation=evaluateIngredientProbabilityActivationRow({
  source_key:'BULBASAUR',
  base_ingredient_probability:0.257,
  source_commit:INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT,
  source_path:'fixture://model-fit',
  canonical_species_form_id:'neroli:bulbasaur',
  evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.MODEL_FIT_OR_PLACEHOLDER,
  independent_current_crosscheck_count:1,
  unresolved_numeric_conflict:false,
});
assert.equal(modelFitActivation.status,'REVIEW_REQUIRED');
assert.equal(modelFitActivation.reason,'NUMERIC_EVIDENCE_CLASS_NOT_ACCEPTED');
assert.equal(modelFitActivation.eligible_for_numeric_activation,false);

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

for(const file of [
  'assets/js/ingredient-probability-independent-source-lineage-review.js',
  'assets/js/ingredient-probability-independent-source-readiness.js',
]){
  const source=fs.readFileSync(file,'utf8');
  for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden runtime/write path ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C7C3_INDEPENDENT_CANDIDATE_DISCOVERY',
  candidate_count:lineage.candidate_count,
  reviewed_terminal_candidates:lineage.reviewed_candidate_count,
  rejected_candidates:lineage.rejected_candidate_count,
  review_required_candidates:lineage.review_required_candidate_count,
  accepted_independent_sources:lineage.accepted_independent_source_count,
  rp_fit_status:rpFit.admission_status,
  rp_fit_numeric_evidence_class:rpFit.numeric_evidence_class,
  rp_fit_direct_help_event_observation:false,
  rp_fit_counts_as_independent_crosscheck:false,
  model_fit_activation_eligible:false,
  next_action:readiness.next_action,
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
  runtime_network_fetch:false,
  sqlite_write:false,
  ai_numeric_authority:false,
},null,2));
