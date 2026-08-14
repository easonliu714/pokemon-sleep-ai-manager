import assert from 'node:assert/strict';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildProductionEvidenceSnapshot} from '../assets/js/production-evidence-registry.js';
import {currentSpeciesIngredientRateReference,resolveReferenceSpeciesIngredientRate} from '../assets/js/public-species-ingredient-rate-reference.js';
import {composeIngredientProbabilityReference,resolveIngredientProbabilityReferenceProjection} from '../assets/js/ingredient-probability-reference-contract.js';

const ref=currentSpeciesIngredientRateReference();
assert.equal(ref.status,'REFERENCE_ONLY_COMMUNITY_DERIVED');
assert.equal(ref.complete_catalog,false);
assert.equal(ref.eligible_for_numeric_activation,false);
assert.equal(ref.policy.hidden_game_rate_officially_published,false);
assert.equal(ref.policy.infer_from_specialty,false);
assert.equal(ref.policy.runtime_network_fetch,false);

const bulba=resolveReferenceSpeciesIngredientRate({species:'妙蛙種子',type:'草',specialty:'食材'});
assert.equal(bulba.status,'REFERENCE_IDENTIFIED');
assert.equal(bulba.row.base_ingredient_probability,0.257);
assert.equal(bulba.eligible_for_numeric_activation,false);
const vulpixAmbiguous=resolveReferenceSpeciesIngredientRate({species:'六尾'});
assert.equal(vulpixAmbiguous.status,'REVIEW_REQUIRED');
assert.equal(vulpixAmbiguous.reason,'AMBIGUOUS_FORM_TYPE_REQUIRED');
assert.equal(resolveReferenceSpeciesIngredientRate({species:'六尾',type:'火'}).row.base_ingredient_probability,0.168);
assert.equal(resolveReferenceSpeciesIngredientRate({species:'六尾',type:'冰'}).row.base_ingredient_probability,0.23);
const unknown=resolveReferenceSpeciesIngredientRate({species:'不存在物種',type:'火',specialty:'食材'});
assert.equal(unknown.status,'NOT_RESOLVED');
assert.equal(unknown.reason,'SPECIES_NOT_IN_REFERENCE_SNAPSHOT');

const sm=composeIngredientProbabilityReference({base_probability:0.2,nature_multiplier:1,subskill_probability_multipliers:[1.18,1.36]});
assert.equal(sm.ok,true);
assert.ok(Math.abs(sm.subskill_multiplier-1.54)<1e-12,'Ingredient Finder S+M must be additive bonus components, not 1.18×1.36');
assert.ok(Math.abs(sm.effective_probability-0.308)<1e-12);
assert.ok(Math.abs(sm.berry_result_probability-0.692)<1e-12);
const natureAndSm=composeIngredientProbabilityReference({base_probability:0.257,nature_multiplier:1.2,subskill_probability_multipliers:[1.18,1.36]});
assert.ok(Math.abs(natureAndSm.effective_probability-0.474936)<1e-12);

const projected=resolveIngredientProbabilityReferenceProjection({
  species:'妙蛙種子',type:'草',specialty:'食材',nature:'慢吞吞',nature_bonus:'食材機率',nature_penalty:'活力回復量',
  unlocked_subskills:[{subskill_name:'食材機率提升S',unlock_level:10},{subskill_name:'食材機率提升M',unlock_level:25}],
});
assert.equal(projected.status,'REFERENCE_PROJECTION_ONLY');
assert.equal(projected.production_authority_status,'NOT_YET_VERIFIED');
assert.equal(projected.eligible_for_numeric_activation,false);
assert.equal(projected.numeric_activation,false);
assert.ok(Math.abs(projected.subskill_multiplier-1.54)<1e-12);
assert.ok(Math.abs(projected.effective_probability-0.474936)<1e-12);
const conflict=resolveIngredientProbabilityReferenceProjection({species:'妙蛙種子',type:'草',nature:'慢吞吞',nature_bonus:'幫忙速度',nature_penalty:'活力回復量',unlocked_subskills:[]});
assert.equal(conflict.status,'REVIEW_REQUIRED');
assert.equal(conflict.reason,'MODIFIER_PROFILE_REVIEW_REQUIRED');
assert.equal(conflict.effective_probability,null);

const registry=currentProductionAuthorityRegistry();
const numeric=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
assert.equal(numeric.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED').length,3);
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

const evidence=buildProductionEvidenceSnapshot({candidateFeatures:{candidates:[
  {species:'妙蛙種子',type:'草',level:30,specialty:'食材',helper_seconds:4400,nature:'勤奮',unlocked_subskills:[],unlocked_ingredients:[]},
  {species:'六尾',type:'火',level:30,specialty:'樹果',helper_seconds:4700,nature:'勤奮',unlocked_subskills:[],unlocked_ingredients:[]},
  {species:'六尾',type:'冰',level:30,specialty:'樹果',helper_seconds:5600,nature:'勤奮',unlocked_subskills:[],unlocked_ingredients:[]},
  {species:'不存在物種',type:'火',level:30,specialty:'食材',helper_seconds:4000,nature:'勤奮',unlocked_subskills:[],unlocked_ingredients:[]},
]},weeklyContext:{favorite_berry_1:'蘋野果',favorite_berry_2:'金枕果',favorite_berry_3:'莓莓果'},productionRegistry:registry});
assert.equal(evidence.schema,'pokemon-sleep-production-evidence-snapshot/1.4');
assert.equal(evidence.summary.numeric_dimension_count,7);
assert.equal(evidence.summary.active_numeric_dimension_count,3);
assert.equal(evidence.summary.blocked_numeric_dimension_count,4);
assert.equal(evidence.summary.species_base_ingredient_rate_reference_resolved_candidate_count,3);
const referenceRow=evidence.rules.find(row=>row.dimension==='species_base_ingredient_rate_reference');
assert.equal(referenceRow.coverage.observed_count,3);
assert.equal(referenceRow.runtime_numeric_activation,false);
assert.ok(referenceRow.blocking_reasons.includes('REFERENCE_ONLY_NOT_ACTIVATION_AUTHORITY'));
const ingredientRow=evidence.rules.find(row=>row.dimension==='ingredient_probability_per_help');
assert.equal(ingredientRow.runtime_numeric_activation,false);
assert.equal(ingredientRow.coverage.observed_count,0);
assert.deepEqual(ingredientRow.blocking_reasons,['SPECIES_BASE_INGREDIENT_RATE_ACTIVATION_MASTER_NOT_ACCEPTED']);
assert.equal(evidence.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(evidence.safety.sqlite_write,false);
assert.equal(evidence.safety.runtime_network_fetch,false);
assert.equal(evidence.safety.ai_numeric_authority,false);

console.log(JSON.stringify({status:'PASS',gate:'V0426_G75E3A_SPECIES_INGREDIENT_RATE_REFERENCE_BOUNDARY',reference_version:ref.version,reference_row_count:ref.row_count,form_safe_vulpix:true,ingredient_finder_s_plus_m:1.54,numeric_dimensions_active:'3/7',ingredient_probability_authority:registry.rules.ingredient_probability_per_help.status,overall_numeric_model_status:registry.numeric_rate_model_status,reference_values_activate_model:false,missing_is_zero:false,runtime_network_fetch:false,ai_numeric_authority:false},null,2));
