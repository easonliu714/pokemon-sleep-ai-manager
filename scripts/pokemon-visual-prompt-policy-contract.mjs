import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SCREENSHOT_PROMPT_SAFETY_VERSION,
  POKEMON_VISUAL_PROMPT_POLICY_VERSION,
  POKEMON_VISUAL_PROMPT_POLICY,
  POKEMON_VISUAL_RECOGNITION_VOCABULARY,
  POKEMON_VISUAL_FORBIDDEN_INFERENCE_EDGES,
  buildGenericScreenshotAntiHallucinationInstruction,
  appendScreenshotPromptSafety,
  buildPokemonVisualPromptPublicResourcePack,
} from '../assets/js/pokemon-visual-prompt-policy.js';
import {
  AI_OBSERVATION_PROMPT,
  buildObservationTemplate,
  validateObservationPayload,
} from '../assets/js/ai-observation.js';
import {buildObservationFromScreenshotGroup} from '../assets/js/screenshot-observation-bridge.js';
import {POKEMON_VISUAL_EVIDENCE_VERSION,evaluateIngredientEvidence,evaluateTypeBerryConsistency} from '../assets/js/pokemon-visual-evidence-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';

const direct=(kind,value,ref='image-001',confidence=0.99,unlockLevel=null)=>({
  kind,value,source_image_ref:ref,confidence,observation_basis:'DIRECT_IMAGE',inference_used:false,
  ...(unlockLevel==null?{}:{unlock_level:unlockLevel}),
});

assert.equal(SCREENSHOT_PROMPT_SAFETY_VERSION,'screenshot-prompt-safety-2026-08-15-b-partial-visibility');
assert.equal(POKEMON_VISUAL_PROMPT_POLICY_VERSION,'pokemon-visual-prompt-policy-2026-08-15-b-partial-visibility');
assert.equal(POKEMON_VISUAL_EVIDENCE_VERSION,'pokemon-visual-evidence-2026-08-15-c-direct-image-basis');
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.public_master_role,'POST_OBSERVATION_CONSISTENCY_CHECK_ONLY');
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.vocabulary_role,'SPELLING_ALLOWLIST_AFTER_DIRECT_RECOGNITION_ONLY');
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.editable_header_is_species,false);
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.editable_header_is_nickname,false);
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.section_heading_is_profile_value,false);
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.partial_visibility_policy,'NULL_AND_MARK_UNREADABLE');
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.species_ingredient_candidate_map_sent_to_model,false);
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.type_berry_relation_map_sent_to_model,false);
assert.equal(POKEMON_VISUAL_PROMPT_POLICY.player_write_authority,false);
for(const edge of [
  'TYPE_VISUAL->BERRY_VISUAL',
  'BERRY_VISUAL->TYPE_VISUAL',
  'PUBLIC_CANDIDATES->INGREDIENT_VISUAL',
  'EDITABLE_HEADER_NAME->CANONICAL_SPECIES',
  'EDITABLE_HEADER_NAME->NICKNAME',
  'PARTIAL_TEXT_FRAGMENT->COMPLETE_FIELD_VALUE',
  'PARTIAL_DURATION->HELPER_SECONDS',
  'SECTION_HEADING->PROFILE_VALUE',
  'FILENAME->PLAYER_OBSERVATION',
])assert.ok(POKEMON_VISUAL_FORBIDDEN_INFERENCE_EDGES.includes(edge));

assert.equal(POKEMON_VISUAL_RECOGNITION_VOCABULARY.types.length,18);
assert.equal(POKEMON_VISUAL_RECOGNITION_VOCABULARY.berries.length,18);
assert.equal(POKEMON_VISUAL_RECOGNITION_VOCABULARY.ingredients.length,19);
assert.ok(POKEMON_VISUAL_RECOGNITION_VOCABULARY.ingredients.includes('嫩亮酪梨'));
assert.equal(POKEMON_VISUAL_RECOGNITION_VOCABULARY.ingredients.includes('特選酪梨'),false);
assert.ok(POKEMON_VISUAL_RECOGNITION_VOCABULARY.subskills.includes('技能機率提升M'));
assert.ok(POKEMON_VISUAL_RECOGNITION_VOCABULARY.subskills.includes('技能等級提升M'));

const resourcePack=buildPokemonVisualPromptPublicResourcePack();
assert.equal(resourcePack.player_data_included,false);
assert.equal(resourcePack.write_authority,false);
const modelVocabularyJson=JSON.stringify(resourcePack.vocabulary);
for(const forbidden of ['pokemon_instance_id','safe_reserve','ingredientPercentage','berry_name_by_type'])assert.equal(modelVocabularyJson.includes(forbidden),false,`model vocabulary leaked ${forbidden}`);
for(const excluded of ['TYPE_BERRY_RELATION_MAP','SPECIES_INGREDIENT_CANDIDATE_MAP','SPECIES_SOURCE_KEY_CATALOG','PLAYER_SQLITE_ROWS','INGREDIENT_PERCENTAGE'])assert.ok(resourcePack.excluded_from_model_context.includes(excluded));

assert.ok(AI_OBSERVATION_PROMPT.includes(POKEMON_VISUAL_PROMPT_POLICY_VERSION));
assert.ok(AI_OBSERVATION_PROMPT.includes(SCREENSHOT_PROMPT_SAFETY_VERSION));
assert.ok(AI_OBSERVATION_PROMPT.includes('observation_basis'));
assert.ok(AI_OBSERVATION_PROMPT.includes('inference_used'));
assert.ok(AI_OBSERVATION_PROMPT.includes('特選蘋果與好眠番茄'));
assert.ok(AI_OBSERVATION_PROMPT.includes('profile.header_name_text'));
assert.ok(AI_OBSERVATION_PROMPT.includes('可編輯頁首名稱'));
assert.ok(AI_OBSERVATION_PROMPT.includes('12分54秒'));
assert.ok(AI_OBSERVATION_PROMPT.includes('區段標題'));

const generic=buildGenericScreenshotAntiHallucinationInstruction({scenario:'ingredient_inventory_update'});
const appended=appendScreenshotPromptSafety('BASE',{scenario:'ingredient_inventory_update'});
assert.ok(appended.includes(SCREENSHOT_PROMPT_SAFETY_VERSION));
assert.equal(appendScreenshotPromptSafety(appended,{scenario:'ingredient_inventory_update'}),appended,'safety append must be idempotent');
assert.ok(generic.includes('檔名'));
assert.ok(generic.includes('confidence'));
assert.ok(generic.includes('浮動卡片'));
assert.ok(generic.includes('12分54秒'));
assert.ok(generic.includes('774'));

const template=buildObservationTemplate();
assert.equal(template.prompt_policy_version,POKEMON_VISUAL_PROMPT_POLICY_VERSION);
assert.deepEqual(template.observations[0].subskills.map(row=>row.unlock_level),[10,25,50,70,80]);
assert.equal(template.observations[0].profile.header_name_text,null);
assert.equal(template.observations[0].profile.species_observation_basis,null);
assert.equal(template.observations[0].visual_evidence.prompt_policy_version,POKEMON_VISUAL_PROMPT_POLICY_VERSION);

const baseObservation={
  incoming_ref:'fixture-001',requested_action:'resolve_on_import',identity:{},
  profile:{species:null,header_name_text:'火暴獸',species_observation_basis:null},ingredients:[],subskills:[],audit_candidates:[],
  evidence:{source_image_refs:['image-001'],field_confidence:{},unreadable_fields:[],field_conflicts:{},notes:null},
  visual_evidence:{contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,public_relation_may_generate_player_observation:false,
    type:direct('TYPE_VISUAL','火'),berry:direct('BERRY_VISUAL','蘋野果'),ingredients:[],main_skill:null,subskills:[]},
};
let validation=validateObservationPayload({schema_version:'2.0-observation',prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,observations:[baseObservation]});
assert.deepEqual(validation.errors,[]);
assert.equal(validation.summary.editable_header_is_species,false);
assert.equal(validation.payload.observations[0].profile.species,null);

const missingBasis=structuredClone(baseObservation);delete missingBasis.visual_evidence.type.observation_basis;
validation=validateObservationPayload({schema_version:'2.0-observation',prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,observations:[missingBasis]});
assert.ok(validation.errors.some(message=>message.includes('observation_basis=DIRECT_IMAGE')));
const inferred=structuredClone(baseObservation);inferred.visual_evidence.type.inference_used=true;
validation=validateObservationPayload({schema_version:'2.0-observation',prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,observations:[inferred]});
assert.ok(validation.errors.some(message=>message.includes('inference_used 必須為 false')));
const headerAsSpecies=structuredClone(baseObservation);headerAsSpecies.profile.species='火暴獸';headerAsSpecies.profile.species_observation_basis=null;
validation=validateObservationPayload({schema_version:'2.0-observation',prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,observations:[headerAsSpecies]});
assert.ok(validation.errors.some(message=>message.includes('可編輯頁首名稱不能當 species Evidence')));

const grouped=buildObservationFromScreenshotGroup({group_key:'header-only',header:{name:'火暴獸',level:55,sp:2000},images:[{path:'image-001'}]});
assert.equal(grouped.profile.header_name_text,'火暴獸');
assert.equal(grouped.profile.species,null,'editable/grouping header must never fallback to canonical species');
const platformGrouped=buildObservationFromScreenshotGroup({group_key:'platform-species',header:{name:'我的火爆獸'},canonical_species:'火爆獸',target_pokemon_instance_id:'instance-001',images:[{path:'image-001'}]});
assert.equal(platformGrouped.profile.header_name_text,'我的火爆獸');
assert.equal(platformGrouped.profile.species,'火爆獸');
assert.equal(platformGrouped.profile.species_observation_basis,'PLATFORM_PROVIDED_CONTEXT');

// Android LIVE regression: one complete Piplup screenshot observed 4374s/berry specialty,
// while an occluded screenshot exposed only the trailing 12m54s and was misread as 774s/ingredient specialty.
// Cross-image scalar merging must fail closed instead of last-writer-wins.
const piplupA=structuredClone(baseObservation);
piplupA.incoming_ref='piplup-a';
piplupA.profile={...piplupA.profile,header_name_text:'波加曼',helper_seconds:4374,specialty:'樹果'};
piplupA.evidence={...piplupA.evidence,source_image_refs:['piplup-full.png'],field_confidence:{helper_seconds:1,specialty:1}};
piplupA.visual_evidence.type=direct('TYPE_VISUAL','水','piplup-full.png');
piplupA.visual_evidence.berry=direct('BERRY_VISUAL','橙橙果','piplup-full.png');
const piplupB=structuredClone(piplupA);
piplupB.incoming_ref='piplup-b';
piplupB.profile={...piplupB.profile,helper_seconds:774,specialty:'食材'};
piplupB.evidence={...piplupB.evidence,source_image_refs:['piplup-occluded.png'],field_confidence:{helper_seconds:0.95,specialty:0.95}};
piplupB.visual_evidence.type={...piplupB.visual_evidence.type,source_image_ref:'piplup-occluded.png'};
piplupB.visual_evidence.berry={...piplupB.visual_evidence.berry,source_image_ref:'piplup-occluded.png'};
const mergedPiplup=buildObservationFromScreenshotGroup(
  {group_key:'piplup-live-regression',header:{name:'波加曼',level:15,sp:617},images:[{path:'piplup-full.png'},{path:'piplup-occluded.png'}]},
  {ocrObservation:piplupA,aiObservation:piplupB},
);
assert.equal(mergedPiplup.profile.helper_seconds,null,'conflicting helper seconds must remain unresolved');
assert.equal(mergedPiplup.profile.specialty,null,'section-heading-derived conflicting specialty must remain unresolved');
assert.deepEqual(new Set(mergedPiplup.evidence.field_conflicts.helper_seconds.values),new Set([4374,774]));
assert.deepEqual(new Set(mergedPiplup.evidence.field_conflicts.specialty.values),new Set(['樹果','食材']));
assert.equal(mergedPiplup.evidence.field_conflicts.helper_seconds.resolution_required,true);

const sameA=structuredClone(piplupA),sameB=structuredClone(piplupA);
sameB.evidence={...sameB.evidence,source_image_refs:['piplup-second-full.png']};
const mergedSame=buildObservationFromScreenshotGroup(
  {group_key:'piplup-same',header:{name:'波加曼',level:15,sp:617},images:[{path:'piplup-full.png'},{path:'piplup-second-full.png'}]},
  {ocrObservation:sameA,aiObservation:sameB},
);
assert.equal(mergedSame.profile.helper_seconds,4374);
assert.equal(mergedSame.profile.specialty,'樹果');
assert.equal(Object.keys(mergedSame.evidence.field_conflicts||{}).length,0);

assert.equal(evaluateTypeBerryConsistency({type:direct('TYPE_VISUAL','電'),berry:direct('BERRY_VISUAL','蘋野果')}).status,'CONFLICT');
const noBasisIngredient=direct('INGREDIENT_VISUAL','特選蘋果','image-001',0.99,60);delete noBasisIngredient.observation_basis;
assert.equal(evaluateIngredientEvidence(noBasisIngredient,{species:'嗡蝠'}).status,'REVIEW_REQUIRED');
const validApple=evaluateIngredientEvidence(direct('INGREDIENT_VISUAL','特選蘋果','image-001',0.99,60),{species:'嗡蝠'});
assert.equal(validApple.status,'MATCH');
const wrongTomato=evaluateIngredientEvidence(direct('INGREDIENT_VISUAL','好眠番茄','image-001',0.99,60),{species:'嗡蝠'});
assert.equal(wrongTomato.status,'CONFLICT');

const externalPrompt=fs.readFileSync('prompts/pokemon-screenshot-to-json.md','utf8');
for(const token of [POKEMON_VISUAL_PROMPT_POLICY_VERSION,POKEMON_VISUAL_EVIDENCE_VERSION,'observation_basis','inference_used','profile.header_name_text','特選蘋果','好眠番茄','Lv30 / Lv60','Partial visibility','12分54秒','helper_seconds=null','區段標題'])assert.ok(externalPrompt.includes(token),`external prompt missing ${token}`);
for(const legacy of ['每隻寶可夢必須有穩定 pokemon_id','action 預設使用 upsert','Lv10、25、50、75、100','"schema_version": "1.1"'])assert.equal(externalPrompt.includes(legacy),false,`legacy external prompt rule survived: ${legacy}`);

const adapterSource=fs.readFileSync('assets/js/uc-img-gemini-adapter.js','utf8');
assert.ok(adapterSource.includes("appendScreenshotPromptSafety(scenarioPrompt"));
assert.ok(adapterSource.includes('SCREENSHOT_PROMPT_SAFETY_VERSION'));
assert.ok(adapterSource.includes('prompt_safety_version'));

const registry=currentProductionAuthorityRegistry();
const productionDimensions=['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_probability_per_help','ingredient_slot_distribution','main_skill_trigger_probability','main_skill_effect_value'];
assert.deepEqual(productionDimensions.filter(name=>registry.rules[name]?.status==='ACTIVE_VERIFIED'),['berry_output_per_help','berry_energy_per_berry','favorite_berry_multiplier','ingredient_slot_distribution']);
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');

console.log(JSON.stringify({status:'PASS',gate:'POKEMON_VISUAL_PROMPT_HALLUCINATION_HARDENING',screenshot_safety_version:SCREENSHOT_PROMPT_SAFETY_VERSION,pokemon_prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,visual_evidence_version:POKEMON_VISUAL_EVIDENCE_VERSION,internal_external_policy_parity:true,direct_image_basis_required:true,inference_forbidden:true,editable_header_species_fallback:false,editable_header_nickname_fallback:false,partial_visibility_fail_closed:true,scalar_conflict_last_writer_wins:false,section_heading_profile_inference:false,apple_tomato_adversarial_fixture:true,stable_id_ai_authority:false,default_upsert_ai_authority:false,public_relation_map_sent_to_model:false,species_candidate_map_sent_to_model:false,production_active:'4/7'},null,2));
