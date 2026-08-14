import assert from 'node:assert/strict';
import {
  POKEMON_VISUAL_EVIDENCE_SCHEMA,
  PUBLIC_RELATION_MUST_NOT_GENERATE_PLAYER_OBSERVATION,
  evaluateTypeBerryConsistency,
  evaluateIngredientEvidence,
  evaluateSkillTextEvidence,
  evaluatePokemonVisualEvidence,
  assertPokemonVisualEvidenceSafeForApply,
} from '../assets/js/pokemon-visual-evidence-contract.js';
import {
  PUBLIC_INGREDIENT_CANONICAL_NAMES,
  PUBLIC_INGREDIENT_LEGACY_ALIASES,
  inspectIngredientIdentity,
} from '../assets/js/public-ingredient-identity.js';
import {PUBLIC_INGREDIENT_NAMES} from '../assets/js/shared-master-data.js';

const ev=(kind,value,ref='Screenshot.png',confidence=0.99)=>({kind,value,source_image_ref:ref,confidence});

assert.equal(POKEMON_VISUAL_EVIDENCE_SCHEMA,'pokemon-sleep-pokemon-visual-evidence/1.0');
assert.equal(PUBLIC_RELATION_MUST_NOT_GENERATE_PLAYER_OBSERVATION,true);
assert.deepEqual(PUBLIC_INGREDIENT_NAMES,[...PUBLIC_INGREDIENT_CANONICAL_NAMES],'shared ingredient master must equal current canonical identity authority');
assert.ok(PUBLIC_INGREDIENT_NAMES.includes('嫩亮酪梨'));
assert.ok(!PUBLIC_INGREDIENT_NAMES.includes('特選酪梨'));
assert.equal(PUBLIC_INGREDIENT_LEGACY_ALIASES['特選酪梨'],'嫩亮酪梨');

const goodPair=evaluateTypeBerryConsistency({type:ev('TYPE_VISUAL','電'),berry:ev('BERRY_VISUAL','葡萄果')});
assert.equal(goodPair.status,'MATCH');
assert.equal(goodPair.observed_type,'電');
assert.equal(goodPair.observed_berry,'葡萄果');
assert.deepEqual(goodPair.generated_player_values,[]);
assert.equal(goodPair.auto_rewrite_player_observation,false);

const conflictPair=evaluateTypeBerryConsistency({type:ev('TYPE_VISUAL','電'),berry:ev('BERRY_VISUAL','蘋野果')});
assert.equal(conflictPair.status,'CONFLICT');
assert.equal(conflictPair.public_expected_berry,'葡萄果');
assert.deepEqual(conflictPair.generated_player_values,[],'public relation must never rewrite observed berry');
assert.equal(conflictPair.auto_rewrite_player_observation,false);

const typeOnly=evaluateTypeBerryConsistency({type:ev('TYPE_VISUAL','電')});
assert.equal(typeOnly.status,'REVIEW_REQUIRED');
assert.deepEqual(typeOnly.generated_player_values,[],'type may not generate berry');
const berryOnly=evaluateTypeBerryConsistency({berry:ev('BERRY_VISUAL','葡萄果')});
assert.equal(berryOnly.status,'REVIEW_REQUIRED');
assert.deepEqual(berryOnly.generated_player_values,[],'berry may not generate type');

const avocado=inspectIngredientIdentity('嫩亮酪梨');
assert.equal(avocado.status,'MATCH');
assert.equal(avocado.canonical_name,'嫩亮酪梨');
const legacyAvocado=inspectIngredientIdentity('特選酪梨');
assert.equal(legacyAvocado.status,'REVIEW_REQUIRED');
assert.equal(legacyAvocado.canonical_suggestion,'嫩亮酪梨');
assert.equal(legacyAvocado.silent_rewrite_allowed,false);

const ingredientWithoutSpeciesAuthority=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','萌綠玉米'),{species:'飄飄球'});
assert.equal(ingredientWithoutSpeciesAuthority.status,'NOT_CHECKABLE');
assert.equal(ingredientWithoutSpeciesAuthority.reason,'SPECIES_INGREDIENT_PUBLIC_AUTHORITY_MISSING');
assert.deepEqual(ingredientWithoutSpeciesAuthority.generated_player_values,[]);

const ingredientMatch=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','萌綠玉米'),{
  species:'飄飄球',speciesIngredientCandidates:['萌綠玉米','純粹油','窩心洋芋'],
});
assert.equal(ingredientMatch.status,'MATCH');
const ingredientConflict=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','嫩亮酪梨'),{
  species:'飄飄球',speciesIngredientCandidates:['萌綠玉米','純粹油','窩心洋芋'],
});
assert.equal(ingredientConflict.status,'CONFLICT');
assert.equal(ingredientConflict.auto_rewrite_player_observation,false);

assert.equal(evaluateSkillTextEvidence(ev('MAIN_SKILL_TEXT','活力填充S'),'MAIN_SKILL_TEXT').status,'MATCH');
assert.equal(evaluateSkillTextEvidence(ev('MAIN_SKILL_TEXT','活力填充'),'MAIN_SKILL_TEXT').status,'REVIEW_REQUIRED');
assert.equal(evaluateSkillTextEvidence(ev('SUBSKILL_TEXT','技能機率提升M'),'SUBSKILL_TEXT').status,'MATCH');
assert.equal(evaluateSkillTextEvidence(ev('SUBSKILL_TEXT','技能等級提升M'),'SUBSKILL_TEXT').status,'MATCH');
assert.notEqual('技能機率提升M','技能等級提升M');

const fullMatch=evaluatePokemonVisualEvidence({
  species:'飄飄球',
  type:ev('TYPE_VISUAL','幽靈','ability.png'),
  berry:ev('BERRY_VISUAL','墨莓果','ability.png'),
  ingredients:[ev('INGREDIENT_VISUAL','萌綠玉米','ability.png')],
  main_skill:ev('MAIN_SKILL_TEXT','活力填充S','ability.png'),
  subskills:[ev('SUBSKILL_TEXT','技能機率提升M','subskills.png')],
},{speciesIngredientCandidates:()=>['萌綠玉米','純粹油','窩心洋芋']});
assert.equal(fullMatch.status,'MATCH');
assert.equal(fullMatch.safe_for_sqlite_apply,true);
assert.deepEqual(fullMatch.generated_player_values,[]);
assert.equal(assertPokemonVisualEvidenceSafeForApply(fullMatch),true);

const blocked=evaluatePokemonVisualEvidence({
  species:'電龍',
  type:ev('TYPE_VISUAL','電'),
  berry:ev('BERRY_VISUAL','蘋野果'),
},{speciesIngredientCandidates:[]});
assert.equal(blocked.status,'CONFLICT');
assert.equal(blocked.safe_for_sqlite_apply,false);
assert.throws(()=>assertPokemonVisualEvidenceSafeForApply(blocked),/POKEMON_VISUAL_EVIDENCE_BLOCKED:CONFLICT/);

const legacyIngredientBlocked=evaluatePokemonVisualEvidence({
  species:'老翁龍',
  type:ev('TYPE_VISUAL','龍'),
  berry:ev('BERRY_VISUAL','番荔果'),
  ingredients:[ev('INGREDIENT_VISUAL','特選酪梨')],
},{speciesIngredientCandidates:['萌綠大豆','萌綠玉米','嫩亮酪梨']});
assert.equal(legacyIngredientBlocked.status,'REVIEW_REQUIRED');
assert.equal(legacyIngredientBlocked.safe_for_sqlite_apply,false);
assert.ok(legacyIngredientBlocked.checks.some(row=>row.canonical_suggestion==='嫩亮酪梨'));

console.log(JSON.stringify({
  status:'PASS',
  gate:'POKEMON_VISUAL_EVIDENCE_CONSISTENCY',
  schema:POKEMON_VISUAL_EVIDENCE_SCHEMA,
  public_relation_generates_player_observation:false,
  type_berry_independent_observation:true,
  type_berry_conflict_fail_closed:true,
  ingredient_current_canonical:'嫩亮酪梨',
  legacy_avocado_requires_review:true,
  species_ingredient_missing_authority:'NOT_CHECKABLE',
  finite_skill_vocabulary_exact:true,
  safe_sqlite_apply_requires_match:true,
},null,2));
