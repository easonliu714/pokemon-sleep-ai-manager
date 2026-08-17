import assert from 'node:assert/strict';
import fs from 'node:fs';
import {empiricalQuantile,summarizeEmpiricalDistribution,buildIngredientProbabilitySufficiencyEvidencePack} from '../assets/js/ingredient-probability-sufficiency-evidence-pack.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

assert.equal(empiricalQuantile([1,2,3,4],0.25),1.75);
assert.equal(empiricalQuantile([1,2,3,4],0.5),2.5);
assert.equal(empiricalQuantile([1,2,3,4],0.75),3.25);
assert.equal(empiricalQuantile([],0.5),null);
assert.equal(empiricalQuantile([1],0.5),1);
assert.equal(empiricalQuantile([1,2],-0.1),null);
const summary=summarizeEmpiricalDistribution([4,1,3,2]);
assert.deepEqual({count:summary.count,min:summary.min,q1:summary.q1,median:summary.median,q3:summary.q3,max:summary.max,mean:summary.mean},{count:4,min:1,q1:1.75,median:2.5,q3:3.25,max:4,mean:2.5});

const readiness={
  contract_id:'ingredient-probability-statistical-readiness-2026-08-17-a',
  contract_version:'ingredient-probability-statistical-readiness-v1',
  status:'HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED',
  policy:{policy_authority_status:'NOT_YET_DEFINED',thresholds_defined:false},
  accepted_observation_count:9,
  rejected_observation_count:2,
  ready_group_count:0,
  hold_group_count:3,
  review_required_group_count:1,
  groups:[
    {source_key:'BULBASAUR',canonical_species_form_id:'neroli:bulbasaur',observation_count:2,total_help_event_count:45,wilson_95:{width:0.2657},heterogeneity:{i2:0},reference:null,status:'HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED',blockers:[],holds:['GOVERNED_SUFFICIENCY_THRESHOLDS_NOT_DEFINED']},
    {source_key:'CHARMANDER',canonical_species_form_id:'neroli:charmander',observation_count:3,total_help_event_count:80,wilson_95:{width:0.19},heterogeneity:{i2:0.12},reference:{accepted_for_comparison:true,absolute_delta:0.006},status:'HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED',blockers:[],holds:['GOVERNED_SUFFICIENCY_THRESHOLDS_NOT_DEFINED']},
    {source_key:'SQUIRTLE',canonical_species_form_id:'neroli:squirtle',observation_count:4,total_help_event_count:120,wilson_95:{width:0.15},heterogeneity:{i2:0.3},reference:{accepted_for_comparison:true,absolute_delta:0.011},status:'REVIEW_REQUIRED',blockers:['CROSS_OBSERVATION_HETEROGENEITY_EXCEEDS_POLICY'],holds:[]},
    {source_key:'PIKACHU',canonical_species_form_id:'neroli:pikachu',observation_count:1,total_help_event_count:20,wilson_95:{width:0.36},heterogeneity:{i2:0},reference:null,status:'HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED',blockers:[],holds:['ACCEPTED_INDEPENDENT_REFERENCE_NOT_AVAILABLE']},
  ],
};
const pack=buildIngredientProbabilitySufficiencyEvidencePack(readiness,{generatedAt:'2026-08-17T17:00:00+08:00'});
assert.equal(pack.schema,'pokemon-sleep-ingredient-probability-sufficiency-evidence-pack/1.0');
assert.equal(pack.readiness_status,'HOLD_GOVERNED_THRESHOLDS_NOT_DEFINED');
assert.equal(pack.policy_authority_status,'NOT_YET_DEFINED');
assert.equal(pack.governed_thresholds_defined,false);
assert.equal(pack.evidence_counts.accepted_observations,9);
assert.equal(pack.evidence_counts.statistical_groups,4);
assert.equal(pack.evidence_counts.groups_with_wilson_95,4);
assert.equal(pack.evidence_counts.groups_with_computable_i2,4);
assert.equal(pack.evidence_counts.groups_with_accepted_reference,2);
assert.equal(pack.empirical_distributions.observation_count.median,2.5);
assert.equal(pack.empirical_distributions.total_help_event_count.median,62.5);
assert.equal(pack.empirical_distributions.independent_reference_absolute_delta.count,2);
assert.equal(pack.empirical_distributions.independent_reference_absolute_delta.median,0.0085);
assert.equal(pack.blocker_counts.CROSS_OBSERVATION_HETEROGENEITY_EXCEEDS_POLICY,1);
assert.equal(pack.hold_reason_counts.GOVERNED_SUFFICIENCY_THRESHOLDS_NOT_DEFINED,2);
for(const value of Object.values(pack.threshold_candidate_values))assert.equal(value,null,'E3C-7C1 must not manufacture threshold candidates');
assert.equal(pack.threshold_proposal_status,'EVIDENCE_ONLY_NO_GOVERNED_THRESHOLD_PROPOSAL');
assert.equal(pack.threshold_recommendation_authority,false);
assert.equal(pack.promotion_authority_granted,false);
assert.equal(pack.activation_authority_granted,false);
assert.equal(pack.production_active_dimensions,'4/7');
assert.equal(pack.privacy.raw_observations_included,false);
assert.equal(pack.privacy.source_keys_included,false);
assert.equal(pack.privacy.canonical_species_form_ids_included,false);
const serialized=JSON.stringify(pack);
for(const forbidden of ['BULBASAUR','CHARMANDER','SQUIRTLE','PIKACHU','neroli:bulbasaur','neroli:charmander'])assert.equal(serialized.includes(forbidden),false,`deidentified evidence pack leaked group identity ${forbidden}`);

const empty=buildIngredientProbabilitySufficiencyEvidencePack({status:'HOLD_NO_ACCEPTED_OBSERVATIONS',policy:{policy_authority_status:'NOT_YET_DEFINED',thresholds_defined:false},groups:[]});
assert.equal(empty.evidence_counts.statistical_groups,0);
assert.equal(empty.empirical_distributions.observation_count.count,0);
assert.equal(empty.threshold_recommendation_authority,false);

const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const source=fs.readFileSync('assets/js/ingredient-probability-sufficiency-evidence-pack.js','utf8');
for(const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`E3C-7C1 pack owns forbidden authority/write path ${forbidden}`);
assert.ok(source.includes('threshold_invented:false'));
assert.ok(source.includes('empirical_quantile_used_as_threshold:false'));
assert.ok(source.includes("production_active_dimensions:'4/7'"));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0428_G75E3C7C1_SUFFICIENCY_EVIDENCE_PACK',
  quantile_method:pack.empirical_distributions.observation_count.quantile_method,
  deidentified_distribution_dimensions:Object.keys(pack.empirical_distributions),
  raw_observations_exported:false,
  source_keys_exported:false,
  threshold_candidates_generated:false,
  threshold_recommendation_authority:false,
  independent_reference_groups:pack.evidence_counts.groups_with_accepted_reference,
  production_numeric_activation:'4/7',
  ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  activation_authority_granted:false,
  runtime_network_fetch:false,
  sqlite_write:false,
  ai_numeric_authority:false,
},null,2));
