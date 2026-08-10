import assert from 'node:assert/strict';
import {projectPokemonCandidateFeatures,POKEMON_CANDIDATE_FEATURE_VERSION} from '../assets/js/pokemon-candidate-feature-projection.js';
import {scorePokemonCandidateFeatures} from '../assets/js/pokemon-scoring-engine.js';
import {POKEMON_SCORING_RULES} from '../assets/js/pokemon-scoring-rule-registry.js';

const pokemon=[{
  pokemon_id:'fixture_p1',species:'伊布',current_species:'伊布',level:25,specialty:'技能',type:'一般',nature:'勤奮',
  main_skill:'能量填充S',main_skill_level:3,helper_seconds:2500,carry_limit:15,favorite_berry:'柿仔果',status:'active',identity_review_required:0,
}];
const details=[{
  pokemon_id:'fixture_p1',
  ingredients:[
    {unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1},
    {unlock_level:30,ingredient_name:'放鬆可可',quantity:1},
  ],
  subskills:[
    {unlock_level:10,subskill_name:'幫忙速度S',is_unlocked:1},
    {unlock_level:50,subskill_name:'技能機率提升M',is_unlocked:0},
  ],
}];
const goalProfile={goal_profile_id:'fixture_goal',hard_constraints:{
  // Deliberately allow future abilities in strategy projection. Current readiness must
  // still measure only abilities that are actually unlocked at Lv25.
  current_unlocks_only:false,
}};
const features=projectPokemonCandidateFeatures({pokemon,pokemonDetails:details,goalProfile,weeklyContext:{context_id:'fixture_week'}});
const feature=features.candidates[0];

assert.equal(POKEMON_CANDIDATE_FEATURE_VERSION,'pokemon-candidate-features-2026-08-10-c');
assert.equal(feature.unlocked_ingredients.length,2,'strategy projection may include future ingredients when current_unlocks_only=false');
assert.equal(feature.unlocked_subskills.length,2,'strategy projection may include future subskills when current_unlocks_only=false');
assert.equal(feature.known_ingredient_slot_count,2);
assert.equal(feature.known_subskill_slot_count,2);
assert.equal(feature.unlocked_ingredient_slot_count,1);
assert.equal(feature.unlocked_subskill_slot_count,1);
assert.equal(feature.known_unlock_slot_count,4);
assert.equal(feature.unlocked_known_slot_count,2);

const scored=scorePokemonCandidateFeatures(features),candidate=scored.candidates[0];
assert.equal(POKEMON_SCORING_RULES.current_readiness_score.status,'ACTIVE_VERIFIED');
assert.equal(candidate.current_readiness_score,50);
assert.equal(candidate.score_breakdown.current_readiness_score.known_unlock_slots,4);
assert.equal(candidate.score_breakdown.current_readiness_score.unlocked_known_slots,2);
assert.equal(candidate.score_breakdown.current_readiness_score.formula,'100 * unlocked_known_slots / known_unlock_slots');
assert.equal(candidate.score_reasons.includes('CURRENT_READINESS_SCORED_FROM_CONFIRMED_UNLOCK_SLOTS'),true);
for(const dimension of ['intrinsic_score','weekly_fit_score','roster_marginal_value_score','training_roi_score'])assert.equal(candidate[dimension],null,`${dimension} must remain NULL without verified rule evidence`);

const unknownLevel=projectPokemonCandidateFeatures({
  pokemon:[{...pokemon[0],pokemon_id:'fixture_unknown_level',level:null}],
  pokemonDetails:[{...details[0],pokemon_id:'fixture_unknown_level'}],goalProfile,weeklyContext:{context_id:'fixture_week'},
});
const unknownScore=scorePokemonCandidateFeatures(unknownLevel).candidates[0];
assert.equal(unknownScore.current_readiness_score,null,'unknown current level must not produce a readiness guess');

console.log(JSON.stringify({
  status:'PASS',gate:'WAR.2A_CURRENT_READINESS_RUNTIME_BRIDGE',feature_version:POKEMON_CANDIDATE_FEATURE_VERSION,
  current_level:25,known_unlock_slots:4,unlocked_known_slots:2,current_readiness_score:50,
  strategy_future_slots_do_not_fake_current_readiness:true,unknown_level_score:null,
  inactive_dimensions_remain_null:true,player_data_write:false,
},null,2));
