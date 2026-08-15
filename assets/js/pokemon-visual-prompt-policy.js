import {TYPES,BERRIES,MAIN_SKILLS,SUBSKILLS} from './pokemon-master-options.js';
import {PUBLIC_INGREDIENT_CANONICAL_NAMES} from './public-ingredient-identity.js';
import {POKEMON_VISUAL_EVIDENCE_VERSION} from './pokemon-visual-evidence-contract.js';

export const SCREENSHOT_PROMPT_SAFETY_VERSION='screenshot-prompt-safety-2026-08-15-a';
export const POKEMON_VISUAL_PROMPT_POLICY_VERSION='pokemon-visual-prompt-policy-2026-08-15-a';
export const DIRECT_IMAGE_OBSERVATION_BASIS='DIRECT_IMAGE';

export const POKEMON_VISUAL_RECOGNITION_VOCABULARY=Object.freeze({
  types:Object.freeze([...TYPES]),
  berries:Object.freeze([...BERRIES]),
  ingredients:Object.freeze([...PUBLIC_INGREDIENT_CANONICAL_NAMES]),
  main_skills:Object.freeze([...MAIN_SKILLS]),
  subskills:Object.freeze([...SUBSKILLS]),
});

export const POKEMON_VISUAL_FORBIDDEN_INFERENCE_EDGES=Object.freeze([
  'TYPE_VISUAL->BERRY_VISUAL',
  'BERRY_VISUAL->TYPE_VISUAL',
  'SPECIES->INGREDIENT_VISUAL',
  'INGREDIENT_VISUAL->SPECIES',
  'PUBLIC_CANDIDATES->INGREDIENT_VISUAL',
  'EDITABLE_HEADER_NAME->CANONICAL_SPECIES',
  'UPDATE_OPERATION_VALUE->VISUAL_EVIDENCE',
  'PROFILE_FIELD->VISUAL_EVIDENCE',
  'VISUAL_EVIDENCE->OTHER_VISUAL_EVIDENCE',
  'CONFIDENCE->EVIDENCE_AUTHORITY',
  'MODEL_MEMORY->PLAYER_OBSERVATION',
  'FILENAME->PLAYER_OBSERVATION',
]);

export const POKEMON_VISUAL_PROMPT_POLICY=Object.freeze({
  policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
  screenshot_safety_version:SCREENSHOT_PROMPT_SAFETY_VERSION,
  visual_evidence_contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,
  unknown_policy:'NULL_OR_OMIT',
  public_master_role:'POST_OBSERVATION_CONSISTENCY_CHECK_ONLY',
  vocabulary_role:'SPELLING_ALLOWLIST_AFTER_DIRECT_RECOGNITION_ONLY',
  direct_evidence_basis:DIRECT_IMAGE_OBSERVATION_BASIS,
  inference_used_required_value:false,
  filename_is_evidence:false,
  confidence_is_authority:false,
  fuzzy_auto_match:false,
  editable_header_is_species:false,
  species_candidate_catalog_sent_to_model:false,
  species_ingredient_candidate_map_sent_to_model:false,
  type_berry_relation_map_sent_to_model:false,
  player_write_authority:false,
  forbidden_inference_edges:POKEMON_VISUAL_FORBIDDEN_INFERENCE_EDGES,
});

const list=values=>values.join('、');

export function buildGenericScreenshotAntiHallucinationInstruction({scenario=null}={}){
  return `\n\n【Screenshot Safety Contract ${SCREENSHOT_PROMPT_SAFETY_VERSION}】\n- 你的輸出只有 Observation / Recognition Draft 權限，沒有玩家資料寫入權限。\n- 只能使用本次圖片直接可見內容。檔名、先前對話、模型記憶、遊戲常識、公版候選、其他欄位都不是玩家觀測 Evidence。\n- 看不清楚、沒有顯示、只能靠推論得到的值：填 null、UNMATCHED 或省略，不得為完成 JSON 選一個合理值。\n- confidence 只描述直接辨識信心，不能把推論變成 Evidence。\n- 兩個可見欄位若矛盾，保留各自直接觀測，不要自行修正；一致性由平台判定。\n- 檔名只負責 image_ref 對應，永遠不得推導玩家內容。\n- scenario=${scenario||'unspecified'}。`;
}

export function appendScreenshotPromptSafety(prompt,{scenario=null}={}){
  const source=String(prompt??'');
  if(source.includes(SCREENSHOT_PROMPT_SAFETY_VERSION))return source;
  return `${source}${buildGenericScreenshotAntiHallucinationInstruction({scenario})}`;
}

export function buildPokemonVisualPromptPolicyInstruction(){
  const v=POKEMON_VISUAL_RECOGNITION_VOCABULARY;
  return `${buildGenericScreenshotAntiHallucinationInstruction({scenario:'pokemon_profile_update'})}\n\n【Pokémon Visual Direct-Evidence Contract ${POKEMON_VISUAL_PROMPT_POLICY_VERSION}】\n1. 每筆 visual_evidence 必須真的從指定圖片直接辨識：observation_basis 固定 DIRECT_IMAGE，inference_used 固定 false；做不到就 null／省略。\n2. TYPE_VISUAL 只看屬性 icon；BERRY_VISUAL 只看樹果 icon，禁止互相推導。即使兩者看似違反遊戲規則，也照圖片各自輸出。\n3. INGREDIENT_VISUAL 只看指定 Lv1/Lv30/Lv60 食材 icon；禁止用物種、專長、其他槽位或公版候選補答案。\n4. MAIN_SKILL_TEXT / SUBSKILL_TEXT 只看文字；「技能機率提升M」與「技能等級提升M」必須逐字區分。\n5. 可編輯頁首名稱（例如旁有鉛筆／編輯圖示）只能記到 profile.header_name_text，不是 canonical species Evidence。只有另有明確非可編輯物種標籤時才能填 profile.species，並設 species_observation_basis=DIRECT_NON_EDITABLE_SPECIES_LABEL；否則 species=null。\n6. 下列字彙只是在圖片已足夠辨識後的拼字 allowlist，不是候選推理表。無法唯一判定就留空：\nType：${list(v.types)}\nBerry：${list(v.berries)}\nIngredient：${list(v.ingredients)}\nMain Skill：${list(v.main_skills)}\nSubskill：${list(v.subskills)}\n7. 模型不取得 Type↔Berry 關係表、Species↔Ingredient 候選表或 source_key catalog；這些只屬平台事後 consistency layer。\n8. 紅色圖示不能只靠顏色判定。特選蘋果與好眠番茄必須依圖示形狀／細節直接區分；解析度不足時該槽 evidence=null。\n9. legacy 名稱或疑似 OCR 正名不得在 direct evidence 靜默改寫；不確定 current canonical identity 就留空給平台 REVIEW_REQUIRED。\n10. 禁止推論邊：${POKEMON_VISUAL_FORBIDDEN_INFERENCE_EDGES.join('；')}。\n11. prompt_policy_version 固定 ${POKEMON_VISUAL_PROMPT_POLICY_VERSION}；visual_evidence.contract_version 固定 ${POKEMON_VISUAL_EVIDENCE_VERSION}。`;
}

export function buildPokemonVisualPromptPublicResourcePack(){
  return Object.freeze({
    schema:'pokemon-sleep-pokemon-visual-prompt-resource-pack/1.0',
    prompt_policy_version:POKEMON_VISUAL_PROMPT_POLICY_VERSION,
    screenshot_safety_version:SCREENSHOT_PROMPT_SAFETY_VERSION,
    visual_evidence_contract_version:POKEMON_VISUAL_EVIDENCE_VERSION,
    vocabulary:POKEMON_VISUAL_RECOGNITION_VOCABULARY,
    forbidden_inference_edges:POKEMON_VISUAL_FORBIDDEN_INFERENCE_EDGES,
    excluded_from_model_context:Object.freeze(['TYPE_BERRY_RELATION_MAP','SPECIES_INGREDIENT_CANDIDATE_MAP','SPECIES_SOURCE_KEY_CATALOG','PLAYER_SQLITE_ROWS','PRIVATE_POKEMON_ROWS','INGREDIENT_PERCENTAGE']),
    player_data_included:false,
    write_authority:false,
  });
}
