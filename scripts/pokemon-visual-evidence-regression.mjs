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
import {
  PUBLIC_INGREDIENT_CANONICAL_NAMES,
  PUBLIC_INGREDIENT_LEGACY_ALIASES,
  inspectIngredientIdentity,
} from '../assets/js/public-ingredient-identity.js';
import {PUBLIC_INGREDIENT_NAMES} from '../assets/js/shared-master-data.js';
import {validateObservationPayload} from '../assets/js/ai-observation.js';
import {buildObservationPayloadFromScreenshotGroups} from '../assets/js/screenshot-observation-bridge.js';
import {
  buildPokemonVisualEvidenceManifest,
  evaluatePokemonVisualUpdateManifest,
  evaluatePokemonVisualUpdatePackage,
  assertPokemonVisualUpdatePackageSafe,
} from '../assets/js/pokemon-visual-update-preflight.js';

const ev=(kind,value,ref='Screenshot.png',confidence=0.99,unlockLevel=null)=>({kind,value,source_image_ref:ref,confidence,...(unlockLevel==null?{}:{unlock_level:unlockLevel})});

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
  ingredients:[ev('INGREDIENT_VISUAL','萌綠玉米','ability.png',0.99,1)],
  main_skill:ev('MAIN_SKILL_TEXT','活力填充S','ability.png'),
  subskills:[ev('SUBSKILL_TEXT','技能機率提升M','subskills.png',0.99,50)],
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

// Observation schema: direct evidence is separately supplied and never synthesized from profile values.
const observation={
  incoming_ref:'electric-001',requested_action:'resolve_on_import',
  identity:{},
  profile:{species:'電龍',type:'電',favorite_berry:'葡萄果',main_skill:'能量填充M'},
  ingredients:[],subskills:[{unlock_level:10,subskill_name:'技能機率提升S'}],audit_candidates:[],
  evidence:{source_image_refs:['ability.png','subskills.png'],field_confidence:{},unreadable_fields:[],notes:null},
  visual_evidence:{
    contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,public_relation_may_generate_player_observation:false,
    type:ev('TYPE_VISUAL','電','ability.png'),berry:ev('BERRY_VISUAL','葡萄果','ability.png'),ingredients:[],
    main_skill:ev('MAIN_SKILL_TEXT','能量填充M','ability.png'),
    subskills:[ev('SUBSKILL_TEXT','技能機率提升S','subskills.png',0.99,10)],
  },
};
const observationValidation=validateObservationPayload({schema_version:'2.0-observation',source:'ai_screenshot_observation',observations:[observation]});
assert.deepEqual(observationValidation.errors,[]);
assert.equal(observationValidation.summary.visual_evidence_observation_count,1);
assert.equal(observationValidation.summary.public_relation_generates_player_observation,false);

const bridge=buildObservationPayloadFromScreenshotGroups([
  {group_key:'electric-001',header:{name:'電龍',level:30,sp:1000},images:[{path:'ability.png'},{path:'subskills.png'}]},
],{'electric-001':{aiObservation:observation}});
assert.deepEqual(bridge.errors,[]);
assert.equal(bridge.pokemon_visual_evidence_required,true);
assert.equal(bridge.pokemon_visual_evidence_manifest.observations.length,1);
assert.equal(bridge.visual_preflight.status,'MATCH');
assert.equal(bridge.visual_preflight.safe_for_sqlite_apply,true);
assert.deepEqual(bridge.visual_preflight.generated_player_values,[]);

const manifestRow={
  observation_ref:'pkm_ampharos',pokemon_id:'pkm_ampharos',species:'電龍',
  type:ev('TYPE_VISUAL','電','ability.png'),berry:ev('BERRY_VISUAL','葡萄果','ability.png'),ingredients:[],
  main_skill:ev('MAIN_SKILL_TEXT','能量填充M','ability.png'),
  subskills:[ev('SUBSKILL_TEXT','技能機率提升S','subskills.png',0.99,10)],
};
const manifest=buildPokemonVisualEvidenceManifest([manifestRow]);
const matchingPackage={
  schema_version:'1.1',update_id:'VISUAL-MATCH',generated_at:'2026-08-15T00:00:00+08:00',source:'test',pokemon_visual_evidence_required:true,
  pokemon_visual_evidence_manifest:manifest,
  operations:[
    {entity:'pokemon',action:'upsert',key:{pokemon_id:'pkm_ampharos'},data:{type:'電',favorite_berry:'葡萄果',main_skill:'能量填充M'}},
    {entity:'pokemon_subskills',action:'upsert',key:{pokemon_id:'pkm_ampharos',unlock_level:10},data:{subskill_name:'技能機率提升S'}},
  ],
};
const matchingPreflight=evaluatePokemonVisualUpdatePackage(matchingPackage);
assert.equal(matchingPreflight.status,'MATCH');
assert.equal(matchingPreflight.safe_for_sqlite_apply,true);
assert.deepEqual(matchingPreflight.binding_conflicts,[]);
assert.equal(assertPokemonVisualUpdatePackageSafe(matchingPackage).status,'MATCH');

const mismatchPackage=structuredClone(matchingPackage);
mismatchPackage.update_id='VISUAL-MISMATCH';
mismatchPackage.operations[0].data.favorite_berry='蘋野果';
const mismatchPreflight=evaluatePokemonVisualUpdatePackage(mismatchPackage);
assert.equal(mismatchPreflight.status,'CONFLICT');
assert.ok(mismatchPreflight.binding_conflicts.some(value=>value.includes('DIRECT_EVIDENCE_OPERATION_MISMATCH:pkm_ampharos:favorite_berry')));
assert.throws(()=>assertPokemonVisualUpdatePackageSafe(mismatchPackage),/POKEMON_VISUAL_UPDATE_PREFLIGHT_BLOCKED:CONFLICT/);

const ingredientManifest=buildPokemonVisualEvidenceManifest([{
  observation_ref:'pkm_drifloon',pokemon_id:'pkm_drifloon',species:'飄飄球',
  type:ev('TYPE_VISUAL','幽靈','ability.png'),berry:ev('BERRY_VISUAL','墨莓果','ability.png'),
  ingredients:[ev('INGREDIENT_VISUAL','萌綠玉米','ability.png',0.99,1)],
  main_skill:ev('MAIN_SKILL_TEXT','活力填充S','ability.png'),subskills:[],
}]);
const ingredientPackage={schema_version:'1.1',update_id:'VISUAL-INGREDIENT',generated_at:'2026-08-15T00:00:00+08:00',source:'test',pokemon_visual_evidence_required:true,pokemon_visual_evidence_manifest:ingredientManifest,operations:[
  {entity:'pokemon',action:'upsert',key:{pokemon_id:'pkm_drifloon'},data:{type:'幽靈',favorite_berry:'墨莓果',main_skill:'活力填充S'}},
  {entity:'pokemon_ingredients',action:'upsert',key:{pokemon_id:'pkm_drifloon',unlock_level:1},data:{ingredient_name:'萌綠玉米'}},
]};
const ingredientPackagePreflight=evaluatePokemonVisualUpdatePackage(ingredientPackage);
assert.equal(ingredientPackagePreflight.status,'REVIEW_REQUIRED','species ingredient public authority is intentionally missing');
assert.equal(ingredientPackagePreflight.safe_for_sqlite_apply,false);
assert.throws(()=>assertPokemonVisualUpdatePackageSafe(ingredientPackage),/POKEMON_VISUAL_UPDATE_PREFLIGHT_BLOCKED:REVIEW_REQUIRED/);

const legacyPackage={schema_version:'1.1',update_id:'LEGACY',generated_at:'2026-08-15T00:00:00+08:00',operations:[]};
const legacyPreflight=evaluatePokemonVisualUpdatePackage(legacyPackage);
assert.equal(legacyPreflight.status,'LEGACY_NOT_DECLARED');
assert.equal(legacyPreflight.legacy_compatible,true);
assert.doesNotThrow(()=>assertPokemonVisualUpdatePackageSafe(legacyPackage));

const reAuditWithoutManifest={schema_version:'1.1',update_id:'REAUDIT',generated_at:'2026-08-15T00:00:00+08:00',operations:[],reaudit_contract:{contract:'pokemon-75-source-screenshot-reaudit/1.0'}};
const reAuditPreflight=evaluatePokemonVisualUpdatePackage(reAuditWithoutManifest);
assert.equal(reAuditPreflight.status,'REVIEW_REQUIRED');
assert.equal(reAuditPreflight.reason,'REQUIRED_VISUAL_EVIDENCE_MANIFEST_MISSING');
assert.throws(()=>assertPokemonVisualUpdatePackageSafe(reAuditWithoutManifest),/REQUIRED_VISUAL_EVIDENCE_MANIFEST_MISSING/);

const importerSource=fs.readFileSync('assets/js/importer.js','utf8');
assert.ok(importerSource.includes("import {assertPokemonVisualUpdatePackageSafe} from './pokemon-visual-update-preflight.js'"));
assert.ok(importerSource.includes('const visualPreflight=assertPokemonVisualUpdatePackageSafe(payload);'));
assert.ok(importerSource.indexOf('const visualPreflight=assertPokemonVisualUpdatePackageSafe(payload);')<importerSource.indexOf("SELECT COUNT(*) FROM import_batches"),'visual preflight must run before Update Package dry-run planning');
assert.ok(importerSource.includes('pokemon_visual_preflight:preview.visual_preflight'));

console.log(JSON.stringify({
  status:'PASS',
  gate:'POKEMON_VISUAL_EVIDENCE_CONSISTENCY_AND_UPDATE_PREFLIGHT',
  schema:POKEMON_VISUAL_EVIDENCE_SCHEMA,
  public_relation_generates_player_observation:false,
  type_berry_independent_observation:true,
  type_berry_conflict_fail_closed:true,
  ingredient_current_canonical:'嫩亮酪梨',
  legacy_avocado_requires_review:true,
  species_ingredient_missing_authority:'NOT_CHECKABLE_BLOCKS_NEW_SCREENSHOT_APPLY',
  finite_skill_vocabulary_exact:true,
  screenshot_bridge_manifest:true,
  operation_binding_required:true,
  legacy_update_package_compatible:true,
  reaudit_manifest_required:true,
  safe_sqlite_apply_requires_match:true,
},null,2));
