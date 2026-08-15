import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  POKEMON_VISUAL_EVIDENCE_SCHEMA,
  POKEMON_VISUAL_EVIDENCE_VERSION,
  PUBLIC_RELATION_MUST_NOT_GENERATE_PLAYER_OBSERVATION,
  evaluateTypeBerryConsistency,
  evaluateIngredientEvidence,
  evaluateSkillTextEvidence,
  evaluatePokemonVisualEvidence,
  assertPokemonVisualEvidenceSafeForApply,
} from '../assets/js/pokemon-visual-evidence-contract.js';
import {POKEMON_VISUAL_PROMPT_POLICY_VERSION} from '../assets/js/pokemon-visual-prompt-policy.js';
import {PUBLIC_INGREDIENT_CANONICAL_NAMES,PUBLIC_INGREDIENT_LEGACY_ALIASES,inspectIngredientIdentity} from '../assets/js/public-ingredient-identity.js';
import {PUBLIC_INGREDIENT_NAMES} from '../assets/js/shared-master-data.js';
import {resolvePublicSpeciesFormSourceKeys} from '../assets/js/public-species-form-zh-tw-identity-resolver.js';
import {validateObservationPayload} from '../assets/js/ai-observation.js';
import {buildObservationPayloadFromScreenshotGroups} from '../assets/js/screenshot-observation-bridge.js';
import {buildPokemonVisualEvidenceManifest,evaluatePokemonVisualUpdatePackage,assertPokemonVisualUpdatePackageSafe} from '../assets/js/pokemon-visual-update-preflight.js';

const ev=(kind,value,ref='Screenshot.png',confidence=0.99,unlockLevel=null)=>({
  kind,value,source_image_ref:ref,confidence,observation_basis:'DIRECT_IMAGE',inference_used:false,
  ...(unlockLevel==null?{}:{unlock_level:unlockLevel}),
});

assert.equal(POKEMON_VISUAL_EVIDENCE_SCHEMA,'pokemon-sleep-pokemon-visual-evidence/1.0');
assert.equal(POKEMON_VISUAL_EVIDENCE_VERSION,'pokemon-visual-evidence-2026-08-15-c-direct-image-basis');
assert.equal(PUBLIC_RELATION_MUST_NOT_GENERATE_PLAYER_OBSERVATION,true);
assert.deepEqual(PUBLIC_INGREDIENT_NAMES,[...PUBLIC_INGREDIENT_CANONICAL_NAMES]);
assert.ok(PUBLIC_INGREDIENT_NAMES.includes('嫩亮酪梨'));
assert.ok(!PUBLIC_INGREDIENT_NAMES.includes('特選酪梨'));
assert.equal(PUBLIC_INGREDIENT_LEGACY_ALIASES['特選酪梨'],'嫩亮酪梨');

const missingBasis=ev('TYPE_VISUAL','電');delete missingBasis.observation_basis;
const inferredType=ev('TYPE_VISUAL','電');inferredType.inference_used=true;
assert.equal(evaluateTypeBerryConsistency({type:missingBasis,berry:ev('BERRY_VISUAL','葡萄果')}).status,'REVIEW_REQUIRED');
assert.equal(evaluateTypeBerryConsistency({type:inferredType,berry:ev('BERRY_VISUAL','葡萄果')}).status,'REVIEW_REQUIRED');

const goodPair=evaluateTypeBerryConsistency({type:ev('TYPE_VISUAL','電'),berry:ev('BERRY_VISUAL','葡萄果')});
assert.equal(goodPair.status,'MATCH');
assert.deepEqual(goodPair.generated_player_values,[]);
const conflictPair=evaluateTypeBerryConsistency({type:ev('TYPE_VISUAL','電'),berry:ev('BERRY_VISUAL','蘋野果')});
assert.equal(conflictPair.status,'CONFLICT');
assert.equal(conflictPair.public_expected_berry,'葡萄果');
assert.equal(conflictPair.auto_rewrite_player_observation,false);
assert.equal(evaluateTypeBerryConsistency({type:ev('TYPE_VISUAL','電')}).status,'REVIEW_REQUIRED');
assert.equal(evaluateTypeBerryConsistency({berry:ev('BERRY_VISUAL','葡萄果')}).status,'REVIEW_REQUIRED');

assert.equal(inspectIngredientIdentity('嫩亮酪梨').status,'MATCH');
const legacyAvocado=inspectIngredientIdentity('特選酪梨');
assert.equal(legacyAvocado.status,'REVIEW_REQUIRED');
assert.equal(legacyAvocado.canonical_suggestion,'嫩亮酪梨');
assert.equal(legacyAvocado.silent_rewrite_allowed,false);
const drifloonCorn=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','萌綠玉米','ability.png',0.99,1),{species:'飄飄球'});
assert.equal(drifloonCorn.status,'MATCH');
assert.deepEqual(drifloonCorn.allowed_candidates,['萌綠玉米']);
const noIngredientBasis=ev('INGREDIENT_VISUAL','萌綠玉米','ability.png',0.99,1);delete noIngredientBasis.observation_basis;
assert.equal(evaluateIngredientEvidence(noIngredientBasis,{species:'飄飄球'}).status,'REVIEW_REQUIRED');
const drifloonMissingLevel=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','萌綠玉米'),{species:'飄飄球'});
assert.equal(drifloonMissingLevel.status,'REVIEW_REQUIRED');
assert.equal(drifloonMissingLevel.reason,'INGREDIENT_SLOT_LEVEL_INVALID');
const unknownSpecies=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','萌綠玉米','ability.png',0.99,1),{species:'不存在寶可夢'});
assert.equal(unknownSpecies.status,'REVIEW_REQUIRED');
assert.equal(unknownSpecies.reason,'SPECIES_DISPLAY_NAME_NOT_IN_EXACT_PUBLIC_IDENTITY');
const dratiniOil=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','純粹油','ability.png',0.99,60),{species:'迷你龍'});
assert.equal(dratiniOil.status,'MATCH');
assert.deepEqual(dratiniOil.allowed_candidates,['火辣香草','萌綠玉米','純粹油']);
const dratiniAvocado=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','嫩亮酪梨','ability.png',0.99,60),{species:'迷你龍'});
assert.equal(dratiniAvocado.status,'CONFLICT');
const noibatApple=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','特選蘋果','ability.png',0.99,60),{species:'嗡蝠'});
assert.equal(noibatApple.status,'MATCH');
const noibatTomato=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','好眠番茄','ability.png',0.99,60),{species:'嗡蝠'});
assert.equal(noibatTomato.status,'CONFLICT');
const pumpkin=evaluateIngredientEvidence(ev('INGREDIENT_VISUAL','窩心洋芋','ability.png',0.99,60),{species:'南瓜精'});
assert.equal(pumpkin.status,'MATCH');
assert.equal(resolvePublicSpeciesFormSourceKeys('南瓜精').source_keys.length,4);
assert.deepEqual(pumpkin.allowed_candidates,['沉甸甸南瓜','萌綠大豆','窩心洋芋']);

assert.equal(evaluateSkillTextEvidence(ev('MAIN_SKILL_TEXT','活力填充S'),'MAIN_SKILL_TEXT').status,'MATCH');
assert.equal(evaluateSkillTextEvidence(ev('MAIN_SKILL_TEXT','活力填充'),'MAIN_SKILL_TEXT').status,'REVIEW_REQUIRED');
assert.equal(evaluateSkillTextEvidence(ev('SUBSKILL_TEXT','技能機率提升M'),'SUBSKILL_TEXT').status,'MATCH');
assert.equal(evaluateSkillTextEvidence(ev('SUBSKILL_TEXT','技能等級提升M'),'SUBSKILL_TEXT').status,'MATCH');

const fullMatch=evaluatePokemonVisualEvidence({
  species:'飄飄球',type:ev('TYPE_VISUAL','幽靈','ability.png'),berry:ev('BERRY_VISUAL','墨莓果','ability.png'),
  ingredients:[ev('INGREDIENT_VISUAL','萌綠玉米','ability.png',0.99,1)],main_skill:ev('MAIN_SKILL_TEXT','活力填充S','ability.png'),
  subskills:[ev('SUBSKILL_TEXT','技能機率提升M','subskills.png',0.99,50)],
});
assert.equal(fullMatch.status,'MATCH');
assert.equal(fullMatch.safe_for_sqlite_apply,true);
assert.deepEqual(fullMatch.generated_player_values,[]);
assert.equal(assertPokemonVisualEvidenceSafeForApply(fullMatch),true);

const blocked=evaluatePokemonVisualEvidence({species:'電龍',type:ev('TYPE_VISUAL','電'),berry:ev('BERRY_VISUAL','蘋野果')});
assert.equal(blocked.status,'CONFLICT');
assert.equal(blocked.safe_for_sqlite_apply,false);
assert.throws(()=>assertPokemonVisualEvidenceSafeForApply(blocked),/POKEMON_VISUAL_EVIDENCE_BLOCKED:CONFLICT/);

const observation={
  incoming_ref:'electric-001',requested_action:'resolve_on_import',identity:{target_pokemon_instance_id:'instance-ampharos'},
  profile:{species:'電龍',species_observation_basis:'PLATFORM_PROVIDED_CONTEXT',header_name_text:'我的電龍',type:'電',favorite_berry:'葡萄果',main_skill:'能量填充M'},
  ingredients:[],subskills:[{unlock_level:10,subskill_name:'技能機率提升S'}],audit_candidates:[],
  evidence:{source_image_refs:['ability.png','subskills.png'],field_confidence:{},unreadable_fields:[],notes:null},
  visual_evidence:{contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,public_relation_may_generate_player_observation:false,
    type:ev('TYPE_VISUAL','電','ability.png'),berry:ev('BERRY_VISUAL','葡萄果','ability.png'),ingredients:[],
    main_skill:ev('MAIN_SKILL_TEXT','能量填充M','ability.png'),subskills:[ev('SUBSKILL_TEXT','技能機率提升S','subskills.png',0.99,10)]},
};
const observationValidation=validateObservationPayload({schema_version:'2.0-observation',prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,source:'ai_screenshot_observation',observations:[observation]});
assert.deepEqual(observationValidation.errors,[]);
assert.equal(observationValidation.summary.direct_image_basis_required,true);
assert.equal(observationValidation.summary.inference_allowed_for_direct_evidence,false);

const bridge=buildObservationPayloadFromScreenshotGroups([
  {group_key:'electric-001',header:{name:'我的電龍',level:30,sp:1000},canonical_species:'電龍',target_pokemon_instance_id:'instance-ampharos',images:[{path:'ability.png'},{path:'subskills.png'}]},
],{'electric-001':{aiObservation:observation}});
assert.deepEqual(bridge.errors,[]);
assert.equal(bridge.payload.observations[0].profile.header_name_text,'我的電龍');
assert.equal(bridge.payload.observations[0].profile.species,'電龍');
assert.equal(bridge.pokemon_visual_evidence_required,true);
assert.equal(bridge.visual_preflight.status,'MATCH');

const headerOnly=buildObservationPayloadFromScreenshotGroups([{group_key:'header-only',header:{name:'火暴獸',level:55,sp:2000},images:[{path:'ability.png'}]}],{});
assert.equal(headerOnly.payload.observations[0].profile.header_name_text,'火暴獸');
assert.equal(headerOnly.payload.observations[0].profile.species,null);

const manifest=buildPokemonVisualEvidenceManifest([{
  observation_ref:'pkm_ampharos',pokemon_id:'pkm_ampharos',species:'電龍',type:ev('TYPE_VISUAL','電','ability.png'),berry:ev('BERRY_VISUAL','葡萄果','ability.png'),ingredients:[],
  main_skill:ev('MAIN_SKILL_TEXT','能量填充M','ability.png'),subskills:[ev('SUBSKILL_TEXT','技能機率提升S','subskills.png',0.99,10)],
}]);
const matchingPackage={schema_version:'1.1',update_id:'VISUAL-MATCH',generated_at:'2026-08-15T00:00:00+08:00',source:'test',pokemon_visual_evidence_required:true,pokemon_visual_evidence_manifest:manifest,operations:[
  {entity:'pokemon',action:'upsert',key:{pokemon_id:'pkm_ampharos'},data:{type:'電',favorite_berry:'葡萄果',main_skill:'能量填充M'}},
  {entity:'pokemon_subskills',action:'upsert',key:{pokemon_id:'pkm_ampharos',unlock_level:10},data:{subskill_name:'技能機率提升S'}},
]};
assert.equal(assertPokemonVisualUpdatePackageSafe(matchingPackage).status,'MATCH');
const mismatchPackage=structuredClone(matchingPackage);mismatchPackage.update_id='VISUAL-MISMATCH';mismatchPackage.operations[0].data.favorite_berry='蘋野果';
const mismatchPreflight=evaluatePokemonVisualUpdatePackage(mismatchPackage);
assert.equal(mismatchPreflight.status,'CONFLICT');
assert.ok(mismatchPreflight.binding_conflicts.some(value=>value.includes('DIRECT_EVIDENCE_OPERATION_MISMATCH:pkm_ampharos:favorite_berry')));

const ingredientManifest=buildPokemonVisualEvidenceManifest([{
  observation_ref:'pkm_drifloon',pokemon_id:'pkm_drifloon',species:'飄飄球',type:ev('TYPE_VISUAL','幽靈','ability.png'),berry:ev('BERRY_VISUAL','墨莓果','ability.png'),
  ingredients:[ev('INGREDIENT_VISUAL','萌綠玉米','ability.png',0.99,1)],main_skill:ev('MAIN_SKILL_TEXT','活力填充S','ability.png'),subskills:[],
}]);
const ingredientPackage={schema_version:'1.1',update_id:'VISUAL-INGREDIENT',generated_at:'2026-08-15T00:00:00+08:00',source:'test',pokemon_visual_evidence_required:true,pokemon_visual_evidence_manifest:ingredientManifest,operations:[
  {entity:'pokemon',action:'upsert',key:{pokemon_id:'pkm_drifloon'},data:{type:'幽靈',favorite_berry:'墨莓果',main_skill:'活力填充S'}},
  {entity:'pokemon_ingredients',action:'upsert',key:{pokemon_id:'pkm_drifloon',unlock_level:1},data:{ingredient_name:'萌綠玉米'}},
]};
assert.equal(evaluatePokemonVisualUpdatePackage(ingredientPackage).status,'MATCH');
const ingredientMismatch=structuredClone(ingredientPackage);ingredientMismatch.update_id='VISUAL-INGREDIENT-CONFLICT';ingredientMismatch.pokemon_visual_evidence_manifest=buildPokemonVisualEvidenceManifest([{...ingredientManifest.observations[0],ingredients:[ev('INGREDIENT_VISUAL','嫩亮酪梨','ability.png',0.99,1)]}]);ingredientMismatch.operations[1].data.ingredient_name='嫩亮酪梨';
assert.equal(evaluatePokemonVisualUpdatePackage(ingredientMismatch).status,'CONFLICT');

const legacyPackage={schema_version:'1.1',update_id:'LEGACY',generated_at:'2026-08-15T00:00:00+08:00',operations:[]};
assert.equal(evaluatePokemonVisualUpdatePackage(legacyPackage).status,'LEGACY_NOT_DECLARED');
assert.doesNotThrow(()=>assertPokemonVisualUpdatePackageSafe(legacyPackage));
const reAuditWithoutManifest={schema_version:'1.1',update_id:'REAUDIT',generated_at:'2026-08-15T00:00:00+08:00',operations:[],reaudit_contract:{contract:'pokemon-75-source-screenshot-reaudit/1.0'}};
const reAuditPreflight=evaluatePokemonVisualUpdatePackage(reAuditWithoutManifest);
assert.equal(reAuditPreflight.status,'REVIEW_REQUIRED');
assert.equal(reAuditPreflight.reason,'REQUIRED_VISUAL_EVIDENCE_MANIFEST_MISSING');

const importerSource=fs.readFileSync('assets/js/importer.js','utf8');
assert.ok(importerSource.includes("import {assertPokemonVisualUpdatePackageSafe} from './pokemon-visual-update-preflight.js'"));
assert.ok(importerSource.includes('const visualPreflight=assertPokemonVisualUpdatePackageSafe(payload);'));
assert.ok(importerSource.indexOf('const visualPreflight=assertPokemonVisualUpdatePackageSafe(payload);')<importerSource.indexOf("SELECT COUNT(*) FROM import_batches"));

console.log(JSON.stringify({status:'PASS',gate:'POKEMON_VISUAL_EVIDENCE_C_DIRECT_IMAGE_AND_UPDATE_PREFLIGHT',schema:POKEMON_VISUAL_EVIDENCE_SCHEMA,contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,direct_image_basis_required:true,inference_forbidden:true,confidence_is_not_authority:true,public_relation_generates_player_observation:false,type_berry_independent_observation:true,ingredient_current_canonical:'嫩亮酪梨',apple_tomato_adversarial_fixture:true,species_ingredient_public_authority:'ACTIVE_EXACT_SLOT_SPECIFIC_CONSISTENCY_ONLY',editable_header_species_fallback:false,finite_skill_vocabulary_exact:true,screenshot_bridge_manifest:true,operation_binding_required:true,legacy_update_package_compatible:true,reaudit_manifest_required:true,safe_sqlite_apply_requires_match:true},null,2));
