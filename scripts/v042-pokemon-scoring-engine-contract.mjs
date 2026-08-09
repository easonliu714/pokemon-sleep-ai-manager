import {scorePokemonCandidateFeatures,POKEMON_SCORING_ENGINE_VERSION} from '../assets/js/pokemon-scoring-engine.js';
import {POKEMON_SCORING_RULES,scoringRuleCoverage} from '../assets/js/pokemon-scoring-rule-registry.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const feature=(id,knownIngredients,knownSubskills,unlockedIngredients,unlockedSubskills,hard='PASS')=>({
  pokemon_id:id,species:id,hard_constraint_status:hard,failed_constraints:[],review_constraints:[],rank_eligible:hard!=='FAIL',
  known_ingredient_slot_count:knownIngredients,known_subskill_slot_count:knownSubskills,
  unlocked_ingredient_slot_count:unlockedIngredients,unlocked_subskill_slot_count:unlockedSubskills,
  known_unlock_slot_count:knownIngredients+knownSubskills,unlocked_known_slot_count:unlockedIngredients+unlockedSubskills,
  favorite_berry_match:false,weekly_ingredient_overlap:[],weekly_ingredient_demand_coverage:null,
});
const projection={input_fingerprint:'pokemon_features:fixture',candidates:[
  feature('ready_3_of_8',3,5,1,2,'PASS'),
  feature('ready_8_of_8',3,5,3,5,'PASS'),
  feature('review_4_of_8',3,5,2,2,'REVIEW'),
  feature('fail_8_of_8',3,5,3,5,'FAIL'),
  feature('unknown_slots',0,0,0,0,'PASS'),
]};
const result=scorePokemonCandidateFeatures(projection);
const get=id=>result.candidates.find(row=>row.pokemon_id===id);

assert(POKEMON_SCORING_ENGINE_VERSION==='pokemon-scoring-engine-2026-08-09-a','scoring_engine_version');
assert(scoringRuleCoverage().active_numeric_count===1,'active_numeric_rule_count');
assert(result.active_numeric_dimensions.length===1&&result.active_numeric_dimensions[0]==='current_readiness_score','active_numeric_dimension');
assert(get('ready_3_of_8').current_readiness_score===37.5,'readiness_3_of_8');
assert(get('ready_8_of_8').current_readiness_score===100,'readiness_8_of_8');
assert(get('review_4_of_8').current_readiness_score===50,'readiness_4_of_8');
assert(get('fail_8_of_8').current_readiness_score===100,'failed_candidate_score_can_exist_for_explanation');
assert(!result.ranked_candidates.some(row=>row.pokemon_id==='fail_8_of_8'),'hard_fail_candidate_entered_ranked_set');
assert(result.ranked_candidates[0].pokemon_id==='ready_8_of_8','pass_100_not_ranked_first');
assert(result.ranked_candidates.findIndex(row=>row.pokemon_id==='review_4_of_8')>result.ranked_candidates.findIndex(row=>row.pokemon_id==='ready_3_of_8'),'review_candidate_ranked_before_pass');
assert(get('unknown_slots').current_readiness_score===null,'unknown_slots_guessed_score');
assert(get('unknown_slots').missing_score_inputs.includes('known_unlock_slots'),'unknown_slots_missing_input');
for(const dimension of ['intrinsic_score','weekly_fit_score','roster_marginal_value_score','training_roi_score']){
  assert(get('ready_8_of_8')[dimension]===null,`inactive_dimension_generated_score:${dimension}`);
}
const breakdown=get('ready_3_of_8').score_breakdown.current_readiness_score;
assert(breakdown.rule_id==='CURRENT_UNLOCK_READINESS_V1','readiness_rule_id');
assert(breakdown.formula==='100 * unlocked_known_slots / known_unlock_slots','readiness_formula');
assert(breakdown.source_refs.includes('docs/WAR_ROOM_SCORING_RULES_V1.md'),'readiness_source_ref');
assert(breakdown.known_unlock_slots===8&&breakdown.unlocked_known_slots===3,'readiness_breakdown_counts');
assert(get('ready_3_of_8').numeric_score_count===1,'numeric_score_count');
assert(get('ready_3_of_8').score_reasons.includes('CURRENT_READINESS_SCORED_FROM_CONFIRMED_UNLOCK_SLOTS'),'readiness_reason_missing');

// Weekly context features may change independently, but this v1 score only uses unlock maturity.
const weeklyVariant={input_fingerprint:'pokemon_features:weekly-change',candidates:[{...feature('same_unlocks',3,5,1,2,'PASS'),favorite_berry_match:true,weekly_ingredient_demand_coverage:0.8}]};
assert(scorePokemonCandidateFeatures(weeklyVariant).candidates[0].current_readiness_score===37.5,'weekly_feature_changed_unlock_readiness');

assert(POKEMON_SCORING_RULES.intrinsic_score.status==='FEATURE_ONLY','intrinsic_rule_should_remain_feature_only');
assert(POKEMON_SCORING_RULES.weekly_fit_score.status==='FEATURE_ONLY','weekly_fit_rule_should_remain_feature_only');
assert(POKEMON_SCORING_RULES.roster_marginal_value_score.status==='DISABLED_NO_EVIDENCE','roster_rule_should_remain_disabled');
assert(POKEMON_SCORING_RULES.training_roi_score.status==='DISABLED_NO_EVIDENCE','training_roi_rule_should_remain_disabled');

console.log(JSON.stringify({
  status:'PASS',schema:'pokemon-sleep-scoring-engine-contract/1.0',engine_version:POKEMON_SCORING_ENGINE_VERSION,
  active_numeric_dimensions:['current_readiness_score'],current_unlock_readiness_examples:{'3/8':37.5,'4/8':50,'8/8':100},
  hard_fail_excluded_from_rank:true,review_ranked_after_pass:true,unknown_slots_score:null,inactive_scores_null:true,
  weekly_context_does_not_change_unlock_readiness_formula:true,player_data_write:false,
},null,2));
