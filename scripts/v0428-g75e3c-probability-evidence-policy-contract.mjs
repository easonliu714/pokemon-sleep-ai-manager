import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INGREDIENT_PROBABILITY_ACTIVATION_POLICY_ID,
  INGREDIENT_PROBABILITY_ACTIVATION_POLICY_VERSION,
  INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT,
  INGREDIENT_PROBABILITY_EVIDENCE_CLASS,
  INGREDIENT_PROBABILITY_KNOWN_SOURCE_EXCLUSIONS,
  currentIngredientProbabilityActivationPolicy,
  evaluateIngredientProbabilityActivationRow,
  evaluateIngredientProbabilityActivationMaster,
} from '../assets/js/ingredient-probability-activation-policy.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {currentSpeciesIngredientRateReference} from '../assets/js/public-species-ingredient-rate-reference.js';

const read=path=>fs.readFileSync(path,'utf8');
const policy=currentIngredientProbabilityActivationPolicy();
assert.equal(policy.schema,'pokemon-sleep-ingredient-probability-activation-policy/1.0');
assert.equal(policy.policy_id,INGREDIENT_PROBABILITY_ACTIVATION_POLICY_ID);
assert.equal(policy.policy_version,INGREDIENT_PROBABILITY_ACTIVATION_POLICY_VERSION);
assert.equal(policy.pinned_source_commit,INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT);
assert.equal(policy.activation_status,'POLICY_DEFINED_ACTIVATION_STILL_BLOCKED');
assert.equal(policy.complete_catalog_required,true);
assert.equal(policy.unresolved_conflict_count_required,0);
assert.equal(policy.independent_current_crosscheck_required_per_activation_row,true);
for(const key of ['missing_is_zero','infer_from_specialty','runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority'])assert.equal(policy.safety[key],false,`unsafe policy flag ${key}`);
for(const required of [
  'VERSIONED_LOCAL_ACTIVATION_MASTER','COMPLETE_CURRENT_SPECIES_FORM_COVERAGE','EXPLICIT_SOURCE_COMMIT_AND_PATH_PER_ROW',
  'FORM_SAFE_CANONICAL_IDENTITY_PER_ROW','NO_SOURCE_DECLARED_SUSPICIOUS_OR_MODEL_FIT_VALUES',
  'INDEPENDENT_CURRENT_CROSSCHECK_PER_ACTIVATION_ROW_OR_EXPLICIT_REVIEW_HOLD','DISCREPANCY_REPORT_ZERO_UNRESOLVED_ACTIVATION_CONFLICTS',
  'NATURE_AND_SUBSKILL_COMPOSITION_ORDER_CONTRACT_ACCEPTED','UNKNOWN_OR_AMBIGUOUS_FORM_FAILS_CLOSED','NO_RUNTIME_NETWORK_FETCH','NO_PLAYER_OR_SQLITE_WRITE','NO_AI_NUMERIC_AUTHORITY',
])assert.ok(policy.requirements.includes(required),`activation requirement missing: ${required}`);

assert.equal(INGREDIENT_PROBABILITY_KNOWN_SOURCE_EXCLUSIONS.length>=1,true);
const mew=INGREDIENT_PROBABILITY_KNOWN_SOURCE_EXCLUSIONS.find(row=>row.source_key==='MEW');
assert.ok(mew,'Mew source-declared suspicious row must be explicitly excluded');
assert.equal(mew.pokedex_number,151);
assert.equal(mew.source_commit,INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT);
assert.equal(mew.source_path,'common/src/types/pokemon/all-pokemon.ts');
assert.equal(mew.field,'ingredientPercentage');
assert.equal(mew.evidence_class,INGREDIENT_PROBABILITY_EVIDENCE_CLASS.SOURCE_DECLARED_SUSPICIOUS);
assert.equal(mew.eligible_for_numeric_activation,false);
assert.equal(mew.requires_independent_replacement_evidence,true);

const mewResult=evaluateIngredientProbabilityActivationRow({
  source_key:'MEW',base_ingredient_probability:0.2,source_commit:INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT,
  source_path:'common/src/types/pokemon/all-pokemon.ts',canonical_species_form_id:'mew',
  evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.COMMUNITY_RESEARCH_DERIVED,independent_current_crosscheck_count:99,
});
assert.equal(mewResult.status,'EXCLUDED_FROM_ACTIVATION');
assert.equal(mewResult.eligible_for_numeric_activation,false);
assert.equal(mewResult.evidence_class,INGREDIENT_PROBABILITY_EVIDENCE_CLASS.SOURCE_DECLARED_SUSPICIOUS,'known source exclusion must override caller-provided evidence class');

const readyFixture={
  source_key:'BULBASAUR',base_ingredient_probability:0.257,source_commit:INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT,
  source_path:'common/src/types/pokemon/ingredient-pokemon.ts',canonical_species_form_id:'pokedex:1|form:default|type:草',form_identity_ambiguous:false,
  evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.COMMUNITY_RESEARCH_DERIVED,independent_current_crosscheck_count:1,unresolved_numeric_conflict:false,
};
assert.deepEqual(evaluateIngredientProbabilityActivationRow(readyFixture),{
  status:'ACTIVATION_ROW_EVIDENCE_READY',reason:null,eligible_for_numeric_activation:true,evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.COMMUNITY_RESEARCH_DERIVED,
});
assert.equal(evaluateIngredientProbabilityActivationRow({...readyFixture,independent_current_crosscheck_count:0}).reason,'INDEPENDENT_CURRENT_CROSSCHECK_MISSING');
assert.equal(evaluateIngredientProbabilityActivationRow({...readyFixture,form_identity_ambiguous:true}).reason,'FORM_IDENTITY_AMBIGUOUS');
assert.equal(evaluateIngredientProbabilityActivationRow({...readyFixture,canonical_species_form_id:''}).reason,'FORM_SAFE_CANONICAL_IDENTITY_MISSING');
assert.equal(evaluateIngredientProbabilityActivationRow({...readyFixture,source_commit:'moving-main'}).reason,'SOURCE_COMMIT_NOT_PINNED');
assert.equal(evaluateIngredientProbabilityActivationRow({...readyFixture,base_ingredient_probability:null}).reason,'INVALID_OR_MISSING_BASE_PROBABILITY');
assert.equal(evaluateIngredientProbabilityActivationRow({...readyFixture,evidence_class:INGREDIENT_PROBABILITY_EVIDENCE_CLASS.MODEL_FIT_OR_PLACEHOLDER}).reason,'NUMERIC_EVIDENCE_CLASS_NOT_ACCEPTED');
assert.equal(evaluateIngredientProbabilityActivationRow({...readyFixture,unresolved_numeric_conflict:true}).reason,'UNRESOLVED_NUMERIC_EVIDENCE_CONFLICT');

const incomplete=evaluateIngredientProbabilityActivationMaster({rows:[readyFixture],expected_current_species_form_count:2});
assert.equal(incomplete.ready_row_count,1);
assert.equal(incomplete.complete_current_species_form_coverage,false);
assert.equal(incomplete.activation_decision,'HOLD_ACTIVATION_MASTER_INCOMPLETE_OR_UNRESOLVED');
const containsExcluded=evaluateIngredientProbabilityActivationMaster({rows:[readyFixture,{...readyFixture,source_key:'MEW',canonical_species_form_id:'mew'}],expected_current_species_form_count:2});
assert.equal(containsExcluded.ready_row_count,1);
assert.equal(containsExcluded.excluded_row_count,1);
assert.equal(containsExcluded.complete_current_species_form_coverage,false);
assert.equal(containsExcluded.activation_decision,'HOLD_ACTIVATION_MASTER_INCOMPLETE_OR_UNRESOLVED');
const readyMaster=evaluateIngredientProbabilityActivationMaster({rows:[readyFixture,{...readyFixture,source_key:'IVYSAUR',canonical_species_form_id:'pokedex:2|form:default|type:草'}],expected_current_species_form_count:2});
assert.equal(readyMaster.ready_row_count,2);
assert.equal(readyMaster.review_required_row_count,0);
assert.equal(readyMaster.excluded_row_count,0);
assert.equal(readyMaster.complete_current_species_form_coverage,true);
assert.equal(readyMaster.activation_decision,'READY_FOR_EXPLICIT_AUTHORITY_PROMOTION');
for(const key of ['missing_is_zero','infer_from_specialty','source_declared_suspicious_values_activate','model_fit_or_placeholder_values_activate','runtime_network_fetch','player_data_write','sqlite_write','ai_numeric_authority'])assert.equal(readyMaster.safety[key],false);

const registry=currentProductionAuthorityRegistry();
const numeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
const active=numeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED');
assert.deepEqual(active,['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.rule_version,null);
assert.equal(registry.rules.ingredient_probability_per_help.runtime_numeric_activation,false);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
const reference=currentSpeciesIngredientRateReference();
assert.equal(reference.status,'REFERENCE_ONLY_COMMUNITY_DERIVED');
assert.equal(reference.complete_catalog,false);
assert.equal(reference.eligible_for_numeric_activation,false);

const source=read('assets/js/ingredient-probability-activation-policy.js');
for(const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'INSERT INTO', 'UPDATE ingredient_inventory', 'DELETE FROM', 'applyPayload(', 'dryRun('])assert.equal(source.includes(forbidden),false,`probability activation policy owns forbidden path: ${forbidden}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0428_G75E3C_PROBABILITY_ACTIVATION_EVIDENCE_POLICY',policy_id:INGREDIENT_PROBABILITY_ACTIVATION_POLICY_ID,
  pinned_source_commit:INGREDIENT_PROBABILITY_PINNED_SOURCE_COMMIT,known_source_exclusion_count:INGREDIENT_PROBABILITY_KNOWN_SOURCE_EXCLUSIONS.length,
  mew_source_declared_suspicious_excluded:true,complete_master_requires_all_rows_ready:true,independent_current_crosscheck_required:true,
  active_numeric_dimensions:active,production_numeric_activation:'4/7',ingredient_probability_status:registry.rules.ingredient_probability_per_help.status,
  species_reference_status:reference.status,overall_numeric_model_status:registry.numeric_rate_model_status,missing_is_zero:false,runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));
