import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FIRST_PARTY_OBSERVATION_STATUS} from '../assets/js/ingredient-probability-first-party-observation-contract.js';
import {
  INGREDIENT_PROBABILITY_READINESS_STATUS,
  INGREDIENT_PROBABILITY_REFERENCE_STATUS,
  currentIngredientProbabilityStatisticalReadinessPolicy,
  pearsonBinomialHeterogeneity,
  auditIngredientProbabilityStatisticalReadiness,
} from '../assets/js/ingredient-probability-statistical-readiness.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const row=(sourceKey,canonicalId,ingredient,total)=>({
  source_key:sourceKey,
  canonical_species_form_id:canonicalId,
  status:FIRST_PARTY_OBSERVATION_STATUS.ACCEPTED_RAW_OBSERVATION,
  eligible_for_statistical_aggregation:true,
  ingredient_help_event_count:ingredient,
  total_help_event_count:total,
  statistical_semantics:'BERNOULLI_HELP_EVENT_SPLIT_OBSERVATION',
});
const reference=(sourceKey,p)=>({
  source_key:sourceKey,
  reference_probability:p,
  reference_status:INGREDIENT_PROBABILITY_REFERENCE_STATUS.ACCEPTED_INDEPENDENT_REFERENCE,
  reference_version:'TEST_FIXTURE_ONLY',
});
const governedFixturePolicy={
  policy_authority_status:'ACCEPTED_GOVERNED_POLICY',
  minimum_observation_count:2,
  minimum_total_help_events:40,
  maximum_wilson_95_width:0.4,
  maximum_i2:0.2,
  maximum_reference_absolute_delta:0.02,
  required_reference_status:INGREDIENT_PROBABILITY_REFERENCE_STATUS.ACCEPTED_INDEPENDENT_REFERENCE,
};

const currentPolicy=currentIngredientProbabilityStatisticalReadinessPolicy();
assert.equal(currentPolicy.policy_authority_status,'NOT_YET_DEFINED');
for(const field of ['minimum_observation_count','minimum_total_help_events','maximum_wilson_95_width','maximum_i2','maximum_reference_absolute_delta'])assert.equal(currentPolicy[field],null,`production policy must not invent ${field}`);
assert.equal(currentPolicy.activation_authority_granted,false);
assert.equal(currentPolicy.production_active_dimensions,'4/7');

const stable=[
  row('BULBASAUR','neroli:bulbasaur',10,30),
  row('BULBASAUR','neroli:bulbasaur',5,15),
];
const currentAudit=auditIngredientProbabilityStatisticalReadiness({observations:stable,reference_rows:[reference('BULBASAUR',1/3)]});
assert.equal(currentAudit.status,INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED);
assert.equal(currentAudit.groups[0].observed_fraction,1/3);
assert.equal(currentAudit.groups[0].heterogeneity.i2,0);
assert.equal(currentAudit.ready_group_count,0);
assert.equal(currentAudit.activation_authority_granted,false);
assert.equal(currentAudit.production_promotion_allowed,false);
assert.deepEqual(currentAudit.promoted_subset_scope.source_keys,[]);

const governedAudit=auditIngredientProbabilityStatisticalReadiness({observations:stable,reference_rows:[reference('BULBASAUR',1/3)],policy:governedFixturePolicy});
assert.equal(governedAudit.status,INGREDIENT_PROBABILITY_READINESS_STATUS.READY_FOR_EXPLICIT_PROMOTION_REVIEW);
assert.equal(governedAudit.ready_group_count,1);
assert.equal(governedAudit.groups[0].ready_for_explicit_promotion_review,true);
assert.equal(governedAudit.groups[0].reference.absolute_delta,0);
assert.ok(governedAudit.groups[0].wilson_95.width<governedFixturePolicy.maximum_wilson_95_width);
assert.deepEqual(governedAudit.promoted_subset_scope.source_keys,['BULBASAUR']);
assert.equal(governedAudit.activation_authority_granted,false,'readiness must never self-activate Production');
assert.equal(governedAudit.runtime_numeric_activation,false);
assert.equal(governedAudit.production_promotion_allowed,false);

const insufficient=auditIngredientProbabilityStatisticalReadiness({observations:[stable[0]],reference_rows:[reference('BULBASAUR',1/3)],policy:governedFixturePolicy});
assert.equal(insufficient.status,INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_INSUFFICIENT_EVIDENCE);
assert.ok(insufficient.groups[0].holds.includes('MINIMUM_OBSERVATION_COUNT_NOT_MET'));
assert.ok(insufficient.groups[0].holds.includes('MINIMUM_TOTAL_HELP_EVENTS_NOT_MET'));

const missingReference=auditIngredientProbabilityStatisticalReadiness({observations:stable,reference_rows:[],policy:governedFixturePolicy});
assert.equal(missingReference.status,INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_REFERENCE_CROSSCHECK_NOT_READY);
assert.ok(missingReference.groups[0].holds.includes('ACCEPTED_INDEPENDENT_REFERENCE_NOT_AVAILABLE'));

const heteroRows=[row('BULBASAUR','neroli:bulbasaur',5,50),row('BULBASAUR','neroli:bulbasaur',45,50)];
const heterogeneity=pearsonBinomialHeterogeneity(heteroRows.map(item=>({...item,accepted:true})));
assert.ok(heterogeneity.i2>0.9);
const heteroAudit=auditIngredientProbabilityStatisticalReadiness({observations:heteroRows,reference_rows:[reference('BULBASAUR',0.5)],policy:governedFixturePolicy});
assert.equal(heteroAudit.status,INGREDIENT_PROBABILITY_READINESS_STATUS.REVIEW_REQUIRED);
assert.ok(heteroAudit.groups[0].blockers.includes('CROSS_OBSERVATION_HETEROGENEITY_EXCEEDS_POLICY'));

const referenceConflict=auditIngredientProbabilityStatisticalReadiness({observations:stable,reference_rows:[reference('BULBASAUR',0.5)],policy:governedFixturePolicy});
assert.equal(referenceConflict.status,INGREDIENT_PROBABILITY_READINESS_STATUS.REVIEW_REQUIRED);
assert.ok(referenceConflict.groups[0].blockers.includes('INDEPENDENT_REFERENCE_DISAGREEMENT_EXCEEDS_POLICY'));

const scopeConflict=auditIngredientProbabilityStatisticalReadiness({
  observations:[stable[0],row('BULBASAUR','neroli:wrong-form',5,15)],
  reference_rows:[reference('BULBASAUR',1/3)],
  policy:governedFixturePolicy,
});
assert.equal(scopeConflict.status,INGREDIENT_PROBABILITY_READINESS_STATUS.REVIEW_REQUIRED);
assert.equal(scopeConflict.group_count,2);
assert.ok(scopeConflict.groups.every(group=>group.blockers.includes('SOURCE_KEY_HAS_MULTIPLE_CANONICAL_SCOPES')));

const invalidCounts=auditIngredientProbabilityStatisticalReadiness({observations:[row('BULBASAUR','neroli:bulbasaur',31,30)],reference_rows:[reference('BULBASAUR',1/3)],policy:governedFixturePolicy});
assert.equal(invalidCounts.status,INGREDIENT_PROBABILITY_READINESS_STATUS.HOLD_NO_ACCEPTED_OBSERVATIONS);
assert.equal(invalidCounts.accepted_observation_count,0);
assert.equal(invalidCounts.rejected_observation_count,1);
assert.equal(invalidCounts.rejected_reason_counts.INVALID_BINOMIAL_COUNTS,1);

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=fs.readFileSync('assets/js/ingredient-probability-statistical-readiness.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`E3C-7 readiness owns forbidden path: ${forbidden}`);
assert.ok(source.includes("policy_authority_status:'NOT_YET_DEFINED'"));
assert.ok(source.includes('threshold_invented:false'));
assert.ok(source.includes('activation_authority_granted:false'));
assert.ok(source.includes("production_active_dimensions:'4/7'"));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C7_INGREDIENT_PROBABILITY_STATISTICAL_READINESS',
  current_policy_status:currentPolicy.policy_authority_status,
  current_policy_thresholds_defined:false,
  current_runtime_status:currentAudit.status,
  synthetic_governed_policy_fixture_only:{
    ready_status:governedAudit.status,
    insufficient_status:insufficient.status,
    missing_reference_status:missingReference.status,
    heterogeneity_review:heteroAudit.status,
    reference_conflict_review:referenceConflict.status,
    scope_conflict_review:scopeConflict.status,
  },
  statistical_methods:['WILSON_95','PEARSON_BINOMIAL_HETEROGENEITY_APPROX','ABSOLUTE_REFERENCE_DELTA'],
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
  runtime_network_fetch:false,
  sqlite_write:false,
  ai_numeric_authority:false,
},null,2));
