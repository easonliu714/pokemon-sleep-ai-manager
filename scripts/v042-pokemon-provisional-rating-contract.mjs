import assert from 'node:assert/strict';
import {
  POKEMON_PROVISIONAL_RATING_RULE_VERSION,POKEMON_PROVISIONAL_RATING_LABELS,
  scorePokemonProvisionalRating,planPokemonRosterProvisionalRegrade,
} from '../assets/js/pokemon-provisional-rating.js';
import {POKEMON_SCORING_RULES,scoringRuleCoverage} from '../assets/js/pokemon-scoring-rule-registry.js';

// No actual player data, persisted SQL, browser storage or network in this contract.
const names=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
const slots=names.map((subskill_name,index)=>({unlock_level:[10,25,50,70,80][index],subskill_name,is_unlocked:1}));
const pokemon={pokemon_id:'fixture-1',pokemon_instance_id:'one',species:'fixture species',
  rating:'D-',level:20,specialty:'樹果',nature:'固執',
  nature_bonus:'幫忙速度',nature_penalty:'食材機率'};
const screenshot={pokemon:{...pokemon},subskills:slots,ingredients:[]};
const before=JSON.stringify(screenshot);
const a=scorePokemonProvisionalRating(screenshot);
assert.equal(a.status,'PROVISIONAL_HEURISTIC');
assert.equal(a.proposed_rating,'S+');
assert.equal(a.heuristic_score,100);
assert.equal(a.current_contribution,30);
assert.equal(a.future_contribution,33);
assert.equal(a.player_data_write,false);
assert.equal(a.overwrite_allowed,false);
assert.deepEqual(a.missing_inputs,[]);
assert.equal(JSON.stringify(screenshot),before,'score mutated an Observation');
assert.equal(pokemon.rating,'D-','scoring overwrote existing player rating');
assert.equal(a.score_breakdown.find(x=>x.unlock_level===50)?.scope,'FUTURE',
  'stale is_unlocked=1 cannot make future subskill CURRENT');

// The box and the screenshot MUST use the same scoring entrypoint and rules.
const box=planPokemonRosterProvisionalRegrade({
  pokemon:[pokemon],
  details:[{pokemon_id:'fixture-1',subskills:slots,ingredients:[]}],
});
assert.equal(box.summary.total,1);
assert.equal(box.summary.eligible,1);
assert.equal(box.summary.changed,1);
assert.equal(box.summary.held,0);
assert.equal(box.proposals[0].previous_rating,'D-');
assert.equal(box.proposals[0].proposed_rating,a.proposed_rating);
assert.equal(box.player_data_write,false);
assert.equal(box.overwrite_allowed,false);
assert.match(box.next_gate,/SNAPSHOT.*ROLLBACK/);

// Every displayed band has one and only one position; all 5 x 3 labels exist.
assert.equal(POKEMON_PROVISIONAL_RATING_LABELS.length,15);
assert.equal(new Set(POKEMON_PROVISIONAL_RATING_LABELS).size,15);
assert.deepEqual(POKEMON_PROVISIONAL_RATING_LABELS,
  ['S+','S','S-','A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-']);
assert.equal(POKEMON_PROVISIONAL_RATING_RULE_VERSION,box.rule_version);

const unknown=scorePokemonProvisionalRating({pokemon:{...pokemon,nature:null},subskills:slots});
assert.equal(unknown.proposed_rating,null);
assert.ok(unknown.missing_inputs.includes('verified_nature'));
const incomplete=scorePokemonProvisionalRating({pokemon,subskills:slots.slice(0,3)});
assert.equal(incomplete.proposed_rating,null);
assert.ok(incomplete.missing_inputs.includes('subskill_level_70'));
const duplicate=scorePokemonProvisionalRating({pokemon,subskills:[...slots,slots[0]]});
assert.equal(duplicate.proposed_rating,null);
assert.ok(duplicate.missing_inputs.includes('duplicate_subskill_level'));
const mismatch=scorePokemonProvisionalRating({pokemon:{...pokemon,nature_bonus:'技能機率'},subskills:slots});
assert.equal(mismatch.proposed_rating,null);
assert.ok(mismatch.reason_codes.includes('nature_bonus_evidence_conflict'));
const conflict=scorePokemonProvisionalRating({pokemon,subskills:slots,evidenceConflicts:['nature']});
assert.equal(conflict.proposed_rating,null);
assert.ok(conflict.reason_codes.includes('observation_field_conflict'));
const identity=scorePokemonProvisionalRating({pokemon:{...pokemon,identity_review_required:1},subskills:slots});
assert.equal(identity.proposed_rating,null);
assert.ok(identity.reason_codes.includes('identity_review_required'));
const missingLevel=scorePokemonProvisionalRating({pokemon:{...pokemon,level:null},subskills:slots});
assert.equal(missingLevel.proposed_rating,null);
assert.ok(missingLevel.missing_inputs.includes('valid_level'));
const skill=scorePokemonProvisionalRating({pokemon:{...pokemon,specialty:'技能',nature:'溫和',
  nature_bonus:'主技能發動機率',nature_penalty:'幫忙速度',main_skill:null},
  subskills:slots});
assert.equal(skill.proposed_rating,null);
assert.ok(skill.missing_inputs.includes('main_skill'));
const food=scorePokemonProvisionalRating({pokemon:{...pokemon,specialty:'食材',nature:'內斂',
  nature_bonus:'食材機率',nature_penalty:'幫忙速度'},subskills:slots});
assert.equal(food.proposed_rating,null);
assert.ok(food.missing_inputs.includes('level_1_ingredient'));
const foodValid=scorePokemonProvisionalRating({pokemon:{...pokemon,specialty:'食材',nature:'內斂',
  nature_bonus:'食材機率',nature_penalty:'幫忙速度'},subskills:slots,
  ingredients:[{unlock_level:1,ingredient_name:'豆豆肉'}]});
assert.equal(foodValid.status,'PROVISIONAL_HEURISTIC');

const held=planPokemonRosterProvisionalRegrade({
  pokemon:[pokemon,{...pokemon,pokemon_id:'fixture-2',nature:null}],
  details:[{pokemon_id:'fixture-1',subskills:slots},{pokemon_id:'fixture-2',subskills:slots}],
});
assert.equal(held.summary.eligible,1);
assert.equal(held.summary.held,1);
assert.equal(held.held[0].previous_rating,'D-');
assert.equal(held.held[0].proposed_rating,null);

// The new heuristic must not silently turn on existing official numeric dimensions.
assert.equal(scoringRuleCoverage().active_numeric_count,1);
assert.equal(POKEMON_SCORING_RULES.intrinsic_score.status,'FEATURE_ONLY');
assert.equal(POKEMON_SCORING_RULES.training_roi_score.status,'DISABLED_NO_EVIDENCE');

console.log(JSON.stringify({gate:'G14_PROVISIONAL_ROLE_FIT_15_BAND_SOURCE_TEST',
  status:'PASS',rule:POKEMON_PROVISIONAL_RATING_RULE_VERSION,
  labels:POKEMON_PROVISIONAL_RATING_LABELS,
  screenshot_box_parity:true,previous_rating_unchanged:true,missing_is_not_zero:true,
  future_is_not_current:true,conflicts_hold:true,read_only:true}));
