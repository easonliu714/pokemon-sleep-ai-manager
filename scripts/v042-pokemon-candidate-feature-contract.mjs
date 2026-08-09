import {
  projectPokemonCandidateFeatures,POKEMON_CANDIDATE_FEATURE_VERSION,
} from '../assets/js/pokemon-candidate-feature-projection.js';
import {
  POKEMON_SCORING_RULES,scoringRuleCoverage,POKEMON_SCORING_RULE_REGISTRY_VERSION,
} from '../assets/js/pokemon-scoring-rule-registry.js';
import {normalizeStrategyGoalProfile} from '../assets/js/strategy-goal-contract.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const pokemon=[
  {pokemon_id:'p1',species:'伊布',current_species:'伊布',level:25,sp:1000,specialty:'技能',type:'一般',nature:'勤奮',main_skill:'能量填充S',main_skill_level:3,helper_seconds:2500,carry_limit:15,favorite_berry:'柿仔果',status:'active',identity_confidence:.99,identity_review_required:0},
  {pokemon_id:'p2',species:'皮卡丘',current_species:'皮卡丘',level:12,sp:800,specialty:'樹果',type:'電',nature:'怕寂寞',main_skill:'能量填充S',main_skill_level:2,helper_seconds:2200,carry_limit:12,favorite_berry:'葡萄果',status:'active',identity_confidence:.95,identity_review_required:0},
  {pokemon_id:'p3',species:'傑尼龜',current_species:'傑尼龜',level:30,sp:700,specialty:'食材',type:'水',nature:'',main_skill:'食材獲取S',main_skill_level:2,helper_seconds:3000,carry_limit:14,favorite_berry:'橙橙果',status:'active',identity_confidence:.7,identity_review_required:1},
];
const details=[
  {pokemon_id:'p1',ingredients:[{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1},{unlock_level:30,ingredient_name:'放鬆可可',quantity:1}],subskills:[{unlock_level:10,subskill_name:'幫忙速度S',is_unlocked:1},{unlock_level:50,subskill_name:'技能機率提升M',is_unlocked:0}]},
  {pokemon_id:'p2',ingredients:[{unlock_level:1,ingredient_name:'特選蘋果',quantity:1}],subskills:[{unlock_level:10,subskill_name:'樹果數量S',is_unlocked:1}]},
  {pokemon_id:'p3',ingredients:[{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:2},{unlock_level:30,ingredient_name:'放鬆可可',quantity:2}],subskills:[]},
];
const weeklyContext={context_id:'week1',camp:'萌綠之島',dish_category:'甜點／飲料',favorite_berry_1:'葡萄果',favorite_berry_2:'橙橙果',favorite_berry_3:'桃桃果',pot_size:57};
const recipeStrategyProjection={input_fingerprint:'recipe_strategy:abc',candidates:[{recipe_id:'r1',requirements:[{ingredient_name:'特選蘋果',strategy_shortage:10},{ingredient_name:'哞哞鮮奶',strategy_shortage:5},{ingredient_name:'放鬆可可',strategy_shortage:5}]}]};
const goalProfile={goal_profile_id:'g1',...normalizeStrategyGoalProfile({primary_goal:'unlock_recipes',hard_constraints:{must_include_pokemon:['伊布'],must_include_role:['技能'],exclude_pokemon:['皮卡丘'],current_unlocks_only:true,no_untrained_candidates:true,minimum_candidate_level:20,require_complete_profile_fields:true}})};
const targets=[{target_id:'t1',species:'伊布',target_type:'進化目標',status:'active'},{target_id:'t2',species:'傑尼龜',target_type:'食材補強',status:'active'}];
const run=(p=pokemon,d=details,profile=goalProfile)=>projectPokemonCandidateFeatures({pokemon:p,pokemonDetails:d,weeklyContext,goalProfile:profile,recipeStrategyProjection,collectionTargets:targets,masterVersions:{pokemon:'v1',recipe:'v1'}});
const result=run();
const get=id=>result.candidates.find(row=>row.pokemon_id===id);

assert(['pokemon-candidate-features-2026-08-09-a','pokemon-candidate-features-2026-08-09-b'].includes(POKEMON_CANDIDATE_FEATURE_VERSION),`feature_version:${POKEMON_CANDIDATE_FEATURE_VERSION}`);
assert(result.candidates.length===3,'candidate_count');
assert(result.numeric_scores_generated===false&&result.score_activation_status==='FEATURE_ONLY','feature_projection_generated_scores');
assert(get('p1').mandatory_candidate===true,'must_include_not_marked_mandatory');
assert(get('p1').hard_constraint_status==='PASS','mandatory_candidate_wrong_hard_status');
if(POKEMON_CANDIDATE_FEATURE_VERSION.endsWith('-b'))assert(get('p1').must_include_match_source==='UNIQUE_LEGACY_SPECIES','unique_legacy_species_match_source_missing');
assert(get('p2').hard_constraint_status==='FAIL','excluded_or_low_level_candidate_not_failed');
assert(get('p2').failed_constraints.includes('exclude_pokemon'),'exclude_constraint_missing');
assert(get('p2').failed_constraints.includes('minimum_candidate_level'),'minimum_level_constraint_missing');
assert(get('p3').hard_constraint_status==='REVIEW','incomplete_or_identity_review_not_review');
assert(get('p3').review_constraints.includes('identity_review_required'),'identity_review_reason_missing');
assert(get('p1').matches_required_role===true,'required_role_match_missing');
assert(get('p2').matches_required_role===false,'nonmatching_role_not_projected');
assert(get('p2').favorite_berry_match===true&&get('p1').favorite_berry_match===false,'favorite_berry_match');
assert(get('p1').unlocked_ingredients.length===1,'future_ingredient_unlocked_early');
assert(get('p3').unlocked_ingredients.length===2,'level30_ingredient_not_unlocked');
assert(get('p2').weekly_ingredient_overlap.includes('特選蘋果'),'ingredient_demand_overlap_missing');
assert(get('p2').weekly_ingredient_demand_covered===10,'ingredient_demand_coverage_amount');
assert(get('p1').collection_target_types.includes('進化目標'),'collection_target_feature_missing');
// Team-level requirements are projected as features, not used to fail every non-matching individual.
assert(!get('p2').failed_constraints.includes('must_include_role'),'team_level_role_wrongly_applied_as_individual_fail');
assert(!get('p3').failed_constraints.includes('must_include_pokemon'),'team_level_must_include_wrongly_applied_as_individual_fail');

const reversed=run([...pokemon].reverse(),[...details].reverse());
assert(reversed.input_fingerprint===result.input_fingerprint,'feature_fingerprint_order_dependent');
assert(JSON.stringify(reversed.candidates)===JSON.stringify(result.candidates),'candidate_features_order_dependent');

let ambiguousLegacySpeciesSafe=true;
if(POKEMON_CANDIDATE_FEATURE_VERSION.endsWith('-b')){
  const duplicate={...pokemon[0],pokemon_id:'p4',pokemon_instance_id:'instance_p4',sp:990};
  const duplicateDetail={pokemon_id:'p4',ingredients:[{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1}],subskills:[{unlock_level:10,subskill_name:'幫忙速度S',is_unlocked:1}]};
  const ambiguous=run([...pokemon,duplicate],[...details,duplicateDetail]);
  const eeveeRows=ambiguous.candidates.filter(row=>row.species==='伊布');
  ambiguousLegacySpeciesSafe=eeveeRows.length===2
    && eeveeRows.every(row=>row.mandatory_candidate===false)
    && eeveeRows.every(row=>row.must_include_match_source==='AMBIGUOUS_LEGACY_SPECIES')
    && eeveeRows.every(row=>row.hard_constraint_status==='REVIEW')
    && eeveeRows.every(row=>row.review_constraints.includes('ambiguous_legacy_must_include_species'));
  assert(ambiguousLegacySpeciesSafe,'ambiguous_legacy_species_must_not_mark_all_instances_mandatory');
}

const coverage=scoringRuleCoverage();
assert(POKEMON_SCORING_RULE_REGISTRY_VERSION==='pokemon-scoring-rules-2026-08-09-b','scoring_registry_version');
assert(coverage.dimension_count===5,'scoring_dimension_count');
assert(coverage.active_numeric_count===1,'verified_readiness_rule_not_activated');
assert(POKEMON_SCORING_RULES.current_readiness_score.status==='ACTIVE_VERIFIED','readiness_rule_status');
assert(POKEMON_SCORING_RULES.current_readiness_score.formula==='100 * unlocked_known_slots / known_unlock_slots','readiness_formula_missing');
assert(POKEMON_SCORING_RULES.current_readiness_score.source_refs.includes('docs/WAR_ROOM_SCORING_RULES_V1.md'),'readiness_governance_source_missing');
for(const dimension of ['intrinsic_score','weekly_fit_score','roster_marginal_value_score','training_roi_score']){
  const rule=POKEMON_SCORING_RULES[dimension];
  assert(['FEATURE_ONLY','DISABLED_NO_EVIDENCE'].includes(rule.status),`unexpected_rule_status:${dimension}`);
  assert(rule.formula===null,`unverified_formula_present:${dimension}`);
  assert(rule.source_refs.length===0,`unverified_source_claim:${dimension}`);
}

console.log(JSON.stringify({
  status:'PASS',schema:'pokemon-sleep-candidate-feature-contract/1.2',feature_version:POKEMON_CANDIDATE_FEATURE_VERSION,
  historical_minimum_feature_version:'pokemon-candidate-features-2026-08-09-a',candidate_count:3,
  rank_eligible_count:result.summary.rank_eligible_count,feature_order_invariant:true,numeric_scores_generated:false,
  active_numeric_scoring_rules:1,team_level_constraints_not_misapplied:true,current_unlock_thresholds_respected:true,
  favorite_berry_and_recipe_demand_features:true,ambiguous_legacy_species_safe:ambiguousLegacySpeciesSafe,player_data_write:false,
},null,2));
