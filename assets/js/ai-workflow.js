import {AI_OBSERVATION_PROMPT,buildObservationTemplate,normalizeObservationPayload,validateObservationPayload} from './ai-observation.js';
import {isWeeklyContextPayload,prepareWeeklyContextPayloadForImporter,validateWeeklyContextImportPayload} from './weekly-context-import-contract.js';
import {UPDATE_PACKAGE_REQUIRED_ROOT,legacyUpdatePackageEnvelopeGuidance} from './update-package-contract.js';
import {
  FIRST_PARTY_OBSERVATION_UPDATE_ENTITY,
  FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO,
  validateFirstPartyIngredientObservationUpdatePackage,
  validateFirstPartyIngredientObservationUpdateOperation,
} from './ingredient-probability-first-party-observation-update.js';

const ALLOWED_ENTITIES=new Set(['pokemon','pokemon_ingredients','pokemon_subskills','pokemon_identity_evidence','pokemon_evolution_history','ingredient_inventory','item_inventory','candy_inventory','account_capacity','discarded_pokemon','recipes','recipe_ingredients','weekly_plan','weekly_context','weekly_strategy','settings','ingredient_probability_observations']);
const ALLOWED_ACTIONS=new Set(['insert','update','upsert','archive','discarded','delete']);
const LEVELS={pokemon_ingredients:new Set([1,30,60]),pokemon_subskills:new Set([10,25,50,70,80])};
const LEGACY_SUBSKILL_LEVELS=new Map([[75,70],[100,80]]);
const SCENARIO_ENTITIES=Object.freeze({
  ingredient_inventory_update:new Set(['ingredient_inventory','account_capacity']),
  item_inventory_update:new Set(['item_inventory','account_capacity']),
  candy_inventory_update:new Set(['candy_inventory']),
  recipe_status_update:new Set(['recipes','account_capacity']),
  weekly_context_update:new Set(['weekly_context']),
  [FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO]:new Set([FIRST_PARTY_OBSERVATION_UPDATE_ENTITY]),
  recipes:new Set(['recipes','recipe_ingredients']),
  ingredients:new Set(['ingredient_inventory','account_capacity']),
  items:new Set(['item_inventory','account_capacity']),
  candies:new Set(['candy_inventory']),
});
const isEmpty=value=>value===null||value===undefined||value==='';
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const WEEKLY_REPAIR_LABELS=Object.freeze({
  LEGACY_CONTEXT_AUTHORITY_DEFAULTED:'舊版 Weekly JSON：已補上 context_authority=UPDATE_CENTER_JSON。',
  LEGACY_CONTEXT_ID_CANONICALIZED:'舊版 Weekly JSON：context_id 已轉成目前週期 canonical import ID。',
  DISH_CATEGORY_CANONICALIZED:'料理類型已轉成平台 canonical 名稱（例如 咖哩、濃湯 → 咖哩／濃湯）。',
  EVENT_EFFECTS_OBJECT_SERIALIZED_FOR_SQLITE:'event_effects object 已在匯入層安全序列化；SQLite 仍維持 TEXT，不需 migration。',
  MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE:'活動強制料理類型欄位已由同一 operation 的料理名稱安全修復為 boolean true。',
});

export const AI_PROMPT=AI_OBSERVATION_PROMPT;
export const buildTemplate=buildObservationTemplate;
export {normalizeObservationPayload,validateObservationPayload};
export {UPDATE_PACKAGE_REQUIRED_ROOT};

function validNonNegativeInteger(value){return Number.isInteger(value)&&value>=0;}
function validateScenarioValue(operation,label,errors,warnings){
  const data=operation.data||{};
  if(operation.entity===FIRST_PARTY_OBSERVATION_UPDATE_ENTITY){
    const validation=validateFirstPartyIngredientObservationUpdateOperation(operation);
    errors.push(...validation.errors.map(message=>`${label} ${message}`));
    warnings.push(...validation.warnings.map(message=>`${label} ${message}`));
  }
  if(operation.entity==='ingredient_inventory'&&hasOwn(data,'quantity')&&!isEmpty(data.quantity)&&!validNonNegativeInteger(data.quantity))errors.push(`${label} ingredient quantity 必須為 0 以上整數`);
  if(['item_inventory','candy_inventory'].includes(operation.entity)){
    for(const field of ['quantity','safe_reserve'])if(hasOwn(data,field)&&!isEmpty(data[field])&&!validNonNegativeInteger(data[field]))errors.push(`${label} ${operation.entity==='candy_inventory'?'candy':'item'} ${field} 必須為 0 以上整數`);
  }
  if(operation.entity==='recipes'){
    if(hasOwn(data,'unlocked')&&!isEmpty(data.unlocked)&&![true,false,0,1].includes(data.unlocked))errors.push(`${label} recipes unlocked 必須為 true/false 或 0/1`);
    for(const field of ['recipe_level','current_energy'])if(hasOwn(data,field)&&!isEmpty(data[field])&&!validNonNegativeInteger(data[field]))errors.push(`${label} recipes ${field} 必須為 0 以上整數`);
  }
}

function detectNonExecutableFileKind(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return null;
  const looksLikeManifest=Array.isArray(payload.files)&&hasOwn(payload,'target_runtime')&&hasOwn(payload,'safety')&&!hasOwn(payload,'operations');
  if(!looksLikeManifest)return null;
  return {
    file_kind:'package_manifest',
    message:`此檔案為更新包清單（Package Manifest），不是可執行更新 JSON。請改選 files 清單中的實際更新檔（共 ${payload.files.length} 個）。`,
  };
}

function validateUpdatePackage(payload){
  const errors=[],warnings=[],review=[];
  if(!payload||typeof payload!=='object')return {errors:['JSON 根節點必須是物件'],warnings,review,summary:{}};
  const nonExecutable=detectNonExecutableFileKind(payload);
  if(nonExecutable){
    return {
      errors:[nonExecutable.message],
      warnings,
      review,
      summary:{
        file_kind:nonExecutable.file_kind,
        non_executable_manifest:true,
        operation_count:0,
        entity_counts:{},
        review_required_count:0,
        empty_field_count:0,
        explicit_zero_count:0,
        explicit_false_count:0,
        profile_confirmation_count:0,
        null_overwrite_policy:'not_applicable',
      },
    };
  }
  for(const key of UPDATE_PACKAGE_REQUIRED_ROOT)if(!(key in payload))errors.push(`缺少根欄位：${key}`);
  const legacyGuidance=legacyUpdatePackageEnvelopeGuidance(payload);if(legacyGuidance)errors.push(legacyGuidance);
  if(!Array.isArray(payload.operations)){errors.push('operations 必須是陣列');return {errors,warnings,review,summary:{}};}
  if(payload.profile_audit_confirmations!=null&&!Array.isArray(payload.profile_audit_confirmations))errors.push('profile_audit_confirmations 必須是陣列');
  const scenarioContract=SCENARIO_ENTITIES[payload.scenario]||null;
  const ids=new Set(),pokemonIds=new Set();
  let emptyFieldCount=0,explicitZeroCount=0,explicitFalseCount=0;
  payload.operations.forEach((operation,index)=>{
    const label=`#${index+1}`;
    if(!ALLOWED_ENTITIES.has(operation.entity))errors.push(`${label} 不支援 entity：${operation.entity}`);
    if(scenarioContract&&!scenarioContract.has(operation.entity))errors.push(`${label} entity ${operation.entity} 不屬於 scenario=${payload.scenario}`);
    if(!ALLOWED_ACTIONS.has(operation.action))errors.push(`${label} 不支援 action：${operation.action}`);
    if(operation.action==='delete')errors.push(`${label} 禁止 delete`);
    if(operation.entity==='candy_inventory'&&operation.action!=='upsert')errors.push(`${label} candy_inventory 只允許 upsert`);
    if(!operation.key||typeof operation.key!=='object')errors.push(`${label} 缺少 key`);
    if(!operation.data||typeof operation.data!=='object')errors.push(`${label} 缺少 data`);
    if(operation.operation_id){if(ids.has(operation.operation_id))errors.push(`${label} operation_id 重複：${operation.operation_id}`);ids.add(operation.operation_id);}else warnings.push(`${label} 缺少 operation_id`);
    if(operation.entity==='pokemon'&&operation.key?.pokemon_id)pokemonIds.add(operation.key.pokemon_id);
    if(operation.entity==='pokemon_subskills'&&LEGACY_SUBSKILL_LEVELS.has(Number(operation.key?.unlock_level))){const previous=Number(operation.key.unlock_level);operation.key.unlock_level=LEGACY_SUBSKILL_LEVELS.get(previous);warnings.push(`${label} pokemon_subskills unlock_level ${previous} 已相容轉換為 ${operation.key.unlock_level}`);}
    if(LEVELS[operation.entity]&&!LEVELS[operation.entity].has(Number(operation.key?.unlock_level)))errors.push(`${label} ${operation.entity} unlock_level 不合法`);
    if(['pokemon_ingredients','pokemon_subskills'].includes(operation.entity)&&!operation.key?.pokemon_id)errors.push(`${label} 關聯資料缺少 pokemon_id`);
    if(operation.entity==='pokemon_identity_evidence'&&!operation.key?.evidence_id)errors.push(`${label} identity evidence 缺少 evidence_id`);
    if(operation.entity==='pokemon_evolution_history'&&!operation.key?.evolution_id)errors.push(`${label} evolution history 缺少 evolution_id`);
    if(['pokemon_identity_evidence','pokemon_evolution_history'].includes(operation.entity)&&!operation.data?.pokemon_instance_id)errors.push(`${label} ${operation.entity} 缺少 pokemon_instance_id`);
    if(operation.entity==='ingredient_inventory'&&(typeof operation.key?.ingredient_name!=='string'||!operation.key.ingredient_name.trim()))errors.push(`${label} ingredient_inventory key 缺少 ingredient_name；不得使用 AI 自造 ingredient_id／英文 slug`);
    if(operation.entity==='recipes'&&!operation.key?.recipe_id&&!operation.key?.recipe_name)errors.push(`${label} recipes key 至少需要 recipe_id 或 recipe_name`);
    if(operation.entity==='candy_inventory'&&!operation.key?.candy_id&&!operation.key?.candy_name)errors.push(`${label} candy_inventory key 至少需要 candy_id 或 candy_name`);
    if(operation.review_required===true&&!operation.user_audit?.accepted_current_observation)review.push({index,operation_id:operation.operation_id||label,entity:operation.entity,key:operation.key,evidence:operation.evidence||null});
    for(const [field,value] of Object.entries(operation.data||{})){
      if(isEmpty(value)&&!(operation.clear_fields||[]).includes(field))emptyFieldCount+=1;
      if(value===0)explicitZeroCount+=1;
      if(value===false)explicitFalseCount+=1;
    }
    validateScenarioValue(operation,label,errors,warnings);
    const confidence=operation.evidence?.confidence;
    if(confidence!=null&&(typeof confidence!=='number'||confidence<0||confidence>1))errors.push(`${label} confidence 必須介於 0 到 1`);
  });
  const hasFirstPartyObservation=payload.operations.some(operation=>operation?.entity===FIRST_PARTY_OBSERVATION_UPDATE_ENTITY);
  if(hasFirstPartyObservation||payload.scenario===FIRST_PARTY_OBSERVATION_UPDATE_SCENARIO){
    const validation=validateFirstPartyIngredientObservationUpdatePackage(payload);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
  }
  payload.operations.forEach((operation,index)=>{if(['pokemon_ingredients','pokemon_subskills'].includes(operation.entity)){const id=operation.key?.pokemon_id;if(id&&!pokemonIds.has(id))warnings.push(`#${index+1} 關聯個體 ${id} 未在同一更新包中出現；將依現有資料庫判定`);}});
  if(emptyFieldCount)warnings.push(`偵測到 ${emptyFieldCount} 個空值欄位；預設不覆蓋資料庫既有非空值。只有 clear_fields 明確列出的欄位才會清空。`);
  const confirmations=Array.isArray(payload.profile_audit_confirmations)?payload.profile_audit_confirmations:[];
  confirmations.forEach((item,index)=>{
    if(item?.status==='user_confirmed_not_visible'&&item.confirmed_by_user!==true)errors.push(`profile_audit_confirmations #${index+1} 尚未由使用者確認`);
  });
  const counts={};for(const operation of payload.operations)counts[operation.entity]=(counts[operation.entity]||0)+1;
  return {errors:[...new Set(errors)],warnings:[...new Set(warnings)],review,summary:{scenario:payload.scenario||'general',operation_count:payload.operations.length,entity_counts:counts,review_required_count:review.length,empty_field_count:emptyFieldCount,explicit_zero_count:explicitZeroCount,explicit_false_count:explicitFalseCount,profile_confirmation_count:confirmations.length,null_overwrite_policy:'preserve_existing_unless_clear_fields'}};
}

export function validateWorkflow(payload){
  if(typeof payload==='string'||payload?.schema_version==='2.0-observation'||Array.isArray(payload?.observations))return validateObservationPayload(payload);
  let weeklyPreparation=null;
  if(isWeeklyContextPayload(payload))weeklyPreparation=prepareWeeklyContextPayloadForImporter(payload);
  const result=validateUpdatePackage(payload);
  if(isWeeklyContextPayload(payload)){
    const weekly=validateWeeklyContextImportPayload(payload,{repairLegacy:false});
    result.errors.push(...weekly.issues);
    for(const repair of weeklyPreparation?.repairs||[])result.warnings.push(WEEKLY_REPAIR_LABELS[repair]||`Weekly JSON 相容正規化：${repair}`);
    result.summary.weekly_context_contract=weekly.ok?'PASS':'FAIL';
    result.summary.weekly_context_authority=weekly.authority||null;
    result.summary.weekly_context_week_start=weekly.week_start||null;
    result.summary.weekly_context_repairs=[...(weeklyPreparation?.repairs||[])];
    result.errors=[...new Set(result.errors)];
    result.warnings=[...new Set(result.warnings)];
  }
  return result;
}

export function approveReviewed(payload){
  if(payload?.schema_version==='2.0-observation')return payload;
  const reviewedAt=new Date().toISOString();
  return {
    ...payload,
    operations:payload.operations.map(operation=>operation.review_required===true?{
      ...operation,
      review_required:false,
      review_resolution:operation.review_resolution||'accepted_current_observation',
      user_audit:{...(operation.user_audit||{}),accepted_current_observation:true,confirmed_at:reviewedAt,confirmation_scope:'current_import_only'},
    }:operation),
  };
}