import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INDEPENDENT_CROSSCHECK_SOURCE_STATUS,
  INDEPENDENT_CROSSCHECK_RESULT,
  canonicalPublishedDecimal,
  compareIndependentIngredientProbability,
  buildIndependentIngredientProbabilityCrosscheckAudit,
} from '../assets/js/ingredient-probability-independent-crosscheck-contract.js';
import {
  INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_CANDIDATES,
  INGREDIENT_PROBABILITY_DISALLOWED_INDEPENDENT_SOURCES,
  currentIngredientProbabilityIndependentSourceReadiness,
} from '../assets/js/ingredient-probability-independent-source-readiness.js';
import {INDEPENDENT_SOURCE_ADMISSION_STATUS} from '../assets/js/ingredient-probability-independent-source-admission.js';
import {currentPublicSpeciesFormRoster} from '../assets/js/public-pokemon-species-form-roster.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {currentIngredientProbabilityActivationPolicy} from '../assets/js/ingredient-probability-activation-policy.js';

const read=path=>fs.readFileSync(path,'utf8');
const readiness=currentIngredientProbabilityIndependentSourceReadiness();
assert.equal(readiness.schema,'pokemon-sleep-ingredient-probability-independent-source-readiness/1.0');
assert.ok([
  'HOLD_NO_ACCEPTED_INDEPENDENT_NUMERIC_SOURCE',
  'HOLD_REVIEW_REQUIRED_SOURCE_CANDIDATE_PRESENT',
].includes(readiness.status),'E3C-4 predecessor must remain HOLD while accepted independent source count is zero');
assert.equal(readiness.accepted_source_count,0);
assert.equal(readiness.production_probability_activation_allowed,false);
assert.ok(readiness.candidates.length>=2,'E3C-4 predecessor candidate set must retain at least RaenonX and Verification Wiki');
const byId=new Map(INGREDIENT_PROBABILITY_INDEPENDENT_SOURCE_CANDIDATES.map(row=>[row.source_id,row]));
assert.ok(byId.has('RAENONX_PRODUCTION_RATES'));
assert.ok(byId.has('POKEMON_SLEEP_VERIFICATION_WIKI'));
for(const candidate of readiness.candidates){
  assert.equal(candidate.may_count_as_independent_crosscheck,false,'no current candidate may count as an accepted independent crosscheck');
  const legacyUnreviewed=candidate.independence_status===INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED;
  const successorRejected=candidate.independence_status===INDEPENDENT_CROSSCHECK_SOURCE_STATUS.DERIVED_OR_MIRROR_OF_PRIMARY&&candidate.admission_status===INDEPENDENT_SOURCE_ADMISSION_STATUS.REJECTED_PRIMARY_LINEAGE;
  assert.equal(legacyUnreviewed||successorRejected,true,`unexpected independent-source candidate state for ${candidate.source_id}`);
  if(legacyUnreviewed){
    assert.ok(['NOT_PINNED','NOT_PINNED_OR_NOT_ADMISSION_READY'].includes(candidate.machine_snapshot_status));
    assert.ok(candidate.blockers.length>=1);
  }else{
    assert.equal(candidate.machine_snapshot_status,'NOT_APPLICABLE_REJECTED_LINEAGE');
    assert.ok(candidate.blockers.length>=1);
  }
}
const disallowed=new Map(INGREDIENT_PROBABILITY_DISALLOWED_INDEPENDENT_SOURCES.map(row=>[row.source_class,row.reason]));
assert.equal(disallowed.get('NEROLI_PRIMARY_OR_MIRROR'),'SAME_PRIMARY_LINEAGE_CANNOT_CROSSCHECK_ITSELF');
assert.equal(disallowed.get('REFORMATTED_NEROLI_DATA'),'FORMAT_TRANSFORMATION_DOES_NOT_CREATE_SOURCE_INDEPENDENCE');
assert.equal(disallowed.get('AI_SUMMARY_OR_GENERATED_TABLE'),'UNTRACEABLE_AI_OUTPUT_CANNOT_BE_NUMERIC_EVIDENCE');
assert.equal(disallowed.get('SPECIALTY_INFERENCE'),'SPECIES_BASE_RATE_MAY_NOT_BE_INFERRED_FROM_SPECIALTY');
if(disallowed.has('NEROLI_GITHUB_FORK_OR_LEGACY_SLEEPAPI_COPY'))assert.equal(disallowed.get('NEROLI_GITHUB_FORK_OR_LEGACY_SLEEPAPI_COPY'),'REPOSITORY_FORK_DOES_NOT_CREATE_SOURCE_INDEPENDENCE');
for(const key of ['same_primary_lineage_counts_as_independent','partial_coverage_implies_complete','missing_crosscheck_may_be_ai_filled','tolerance_may_be_invented','runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority'])assert.equal(readiness.safety[key],false,`unsafe readiness flag ${key}`);

assert.equal(canonicalPublishedDecimal('25.700'),'25.7');
assert.equal(canonicalPublishedDecimal('+25.7'),'25.7');
assert.equal(canonicalPublishedDecimal('20'),'20');
assert.equal(canonicalPublishedDecimal('.5'),'0.5');
assert.equal(canonicalPublishedDecimal('25.7%'),null);
assert.equal(canonicalPublishedDecimal('about 25.7'),null);

const primary={source_key:'BULBASAUR',ingredient_percentage:'25.7'};
const acceptedIndependent={source_key:'BULBASAUR',ingredient_percentage:'25.700',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_ACCEPTED};
const exact=compareIndependentIngredientProbability({primary,independent:acceptedIndependent});
assert.equal(exact.status,INDEPENDENT_CROSSCHECK_RESULT.EXACT_MATCH);
assert.equal(exact.crosscheck_accepted,true);
assert.equal(exact.activation_authority_granted,false,'one exact crosscheck must never grant runtime authority');
assert.equal(exact.comparison_policy,'EXACT_NORMALIZED_PUBLISHED_DECIMAL');
const conflict=compareIndependentIngredientProbability({primary,independent:{...acceptedIndependent,ingredient_percentage:'25.8'}});
assert.equal(conflict.status,INDEPENDENT_CROSSCHECK_RESULT.NUMERIC_CONFLICT);
assert.equal(conflict.crosscheck_accepted,false);
const unaccepted=compareIndependentIngredientProbability({primary,independent:{...acceptedIndependent,independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED}});
assert.equal(unaccepted.status,INDEPENDENT_CROSSCHECK_RESULT.INDEPENDENCE_NOT_ACCEPTED);
assert.equal(compareIndependentIngredientProbability({primary,independent:null}).status,INDEPENDENT_CROSSCHECK_RESULT.INDEPENDENT_VALUE_MISSING);
assert.equal(compareIndependentIngredientProbability({primary:null,independent:acceptedIndependent}).status,INDEPENDENT_CROSSCHECK_RESULT.PRIMARY_VALUE_MISSING);

const rosterKeys=['BULBASAUR','IVYSAUR','VENUSAUR','MEW'];
const primaryRows=[
  {source_key:'BULBASAUR',ingredient_percentage:'25.7'},
  {source_key:'IVYSAUR',ingredient_percentage:'25.5'},
  {source_key:'VENUSAUR',ingredient_percentage:'26.6'},
  {source_key:'MEW',ingredient_percentage:'20'},
];
const independentRows=[
  {source_key:'BULBASAUR',ingredient_percentage:'25.70'},
  {source_key:'IVYSAUR',ingredient_percentage:'25.4'},
  {source_key:'MEW',ingredient_percentage:'20'},
];
const partial=buildIndependentIngredientProbabilityCrosscheckAudit({
  rosterKeys,primaryRows,independentRows,
  independentSource:{source_id:'fixture-independent',source_version:'fixture-v1',source_ref:'fixture://independent',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_ACCEPTED},
});
assert.equal(partial.roster_count,4);
assert.equal(partial.primary_row_count,4);
assert.equal(partial.independent_row_count,3);
assert.equal(partial.exact_match_count,2);
assert.equal(partial.numeric_conflict_count,1);
assert.equal(partial.missing_count,1);
assert.equal(partial.independence_not_accepted_count,0);
assert.equal(partial.crosscheck_complete,false);
assert.equal(partial.activation_authority_granted,false);
assert.equal(partial.tolerance,null);
assert.equal(partial.comparison_policy,'EXACT_NORMALIZED_PUBLISHED_DECIMAL');
assert.equal(partial.rows.find(row=>row.source_key==='IVYSAUR').status,'NUMERIC_CONFLICT');
assert.equal(partial.rows.find(row=>row.source_key==='VENUSAUR').status,'INDEPENDENT_VALUE_MISSING');
for(const key of ['tolerance_invented','partial_coverage_implies_complete','exact_match_implies_activation','runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority'])assert.equal(partial.safety[key],false,`unsafe audit flag ${key}`);

const rejected=buildIndependentIngredientProbabilityCrosscheckAudit({
  rosterKeys:['BULBASAUR'],primaryRows:[primary],independentRows:[acceptedIndependent],
  independentSource:{source_id:'unproven',independence_status:INDEPENDENT_CROSSCHECK_SOURCE_STATUS.INDEPENDENCE_NOT_YET_ESTABLISHED},
});
assert.equal(rejected.exact_match_count,0);
assert.equal(rejected.independence_not_accepted_count,1);
assert.equal(rejected.crosscheck_complete,false);

const roster=currentPublicSpeciesFormRoster();
assert.equal(roster.row_count,242);
assert.equal(roster.activation_coverage_denominator_ready,true);
const policy=currentIngredientProbabilityActivationPolicy();
assert.equal(policy.activation_status,'POLICY_DEFINED_ACTIVATION_STILL_BLOCKED');
const registry=currentProductionAuthorityRegistry();
assert.deepEqual(registry.active_verified_dimensions,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

for(const file of ['assets/js/ingredient-probability-independent-crosscheck-contract.js','assets/js/ingredient-probability-independent-source-readiness.js']){
  const source=read(file);
  for(const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ingredient_inventory', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden path ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',gate:'V0428_G75E3C4_INDEPENDENT_CROSSCHECK_READINESS',accepted_independent_sources:readiness.accepted_source_count,
  independent_source_status:readiness.status,current_candidate_count:readiness.candidates.length,successor_lineage_reconciliation_supported:true,successor_hold_reason_refinement_supported:true,
  comparison_policy:'EXACT_NORMALIZED_PUBLISHED_DECIMAL',numeric_tolerance:null,
  partial_crosscheck_fixture:{exact:partial.exact_match_count,conflict:partial.numeric_conflict_count,missing:partial.missing_count},
  public_roster_count:roster.row_count,production_numeric_activation:'4/7',ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  overall_numeric_model_status:registry.numeric_rate_model_status,partial_coverage_implies_complete:false,exact_match_implies_activation:false,
  runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));
