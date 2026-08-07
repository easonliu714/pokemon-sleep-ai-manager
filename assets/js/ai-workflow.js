import {AI_OBSERVATION_PROMPT,buildObservationTemplate,normalizeObservationPayload,validateObservationPayload} from './ai-observation.js';

const REQUIRED_ROOT=['schema_version','update_id','generated_at','source','operations'];
const ALLOWED_ENTITIES=new Set(['pokemon','pokemon_ingredients','pokemon_subskills','pokemon_identity_evidence','pokemon_evolution_history','ingredient_inventory','item_inventory','account_capacity','discarded_pokemon','recipes','recipe_ingredients','weekly_plan','weekly_context','weekly_strategy','settings']);
const ALLOWED_ACTIONS=new Set(['insert','update','upsert','archive','discarded','delete']);
const LEVELS={pokemon_ingredients:new Set([1,30,60]),pokemon_subskills:new Set([10,25,50,70,80])};
const LEGACY_SUBSKILL_LEVELS=new Map([[75,70],[100,80]]);
const SCENARIO_ENTITIES=Object.freeze({
  ingredient_inventory_update:new Set(['ingredient_inventory','account_capacity']),
  item_inventory_update:new Set(['item_inventory','account_capacity']),
  recipe_status_update:new Set(['recipes']),
  recipes:new Set(['recipes','recipe_ingredients']),
  ingredients:new Set(['ingredient_inventory','account_capacity']),
  items:new Set(['item_inventory','account_capacity']),
});
const isEmpty=value=>value===null||value===undefined||value==='';
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);

export const AI_PROMPT=AI_OBSERVATION_PROMPT;
export const buildTemplate=buildObservationTemplate;
export {normalizeObservationPayload,validateObservationPayload};

function validNonNegativeInteger(value){return Number.isInteger(value)&&value>=0;}
function validateScenarioValue(operation,label,errors){
  const data=operation.data||{};
  if(operation.entity==='ingredient_inventory'&&hasOwn(data,'quantity')&&!isEmpty(data.quantity)&&!validNonNegativeInteger(data.quantity))errors.push(`${label} ingredient quantity 必須為 0 以上整數`);
  if(operation.entity==='item_inventory'){
    for(const field of ['quantity','safe_reserve'])if(hasOwn(data,field)&&!isEmpty(data[field])&&!validNonNegativeInteger(data[field]))errors.push(`${label} item ${field} 必須為 0 以上整數`);
  }
  if(operation.entity==='recipes'){
    if(hasOwn(data,'unlocked')&&!isEmpty(data.unlocked)&&![true,false,0,1].includes(data.unlocked))errors.push(`${label} recipes unlocked 必須為 true/false 或 0/1`);
    for(const field of ['recipe_level','current_energy'])if(hasOwn(data,field)&&!isEmpty(data[field])&&!validNonNegativeInteger(data[field]))errors.push(`${label} recipes ${field} 必須為 0 以上整數`);
  }
}

function validateUpdatePackage(payload){
  const errors=[],warnings=[],review=[];
  if(!payload||typeof payload!=='object')return {errors:['JSON 根節點必須是物件'],warnings,review,summary:{}};
  for(const key of REQUIRED_ROOT)if(!(key in payload))errors.push(`缺少根欄位：${key}`);
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
    if(operation.entity==='recipes'&&!operation.key?.recipe_id&&!operation.key?.recipe_name)errors.push(`${label} recipes key 至少需要 recipe_id 或 recipe_name`);
    if(operation.review_required===true&&!operation.user_audit?.accepted_current_observation)review.push({index,operation_id:operation.operation_id||label,entity:operation.entity,key:operation.key,evidence:operation.evidence||null});
    for(const [field,value] of Object.entries(operation.data||{})){
      if(isEmpty(value)&&!(operation.clear_fields||[]).includes(field))emptyFieldCount+=1;
      if(value===0)explicitZeroCount+=1;
      if(value===false)explicitFalseCount+=1;
    }
    validateScenarioValue(operation,label,errors);
    const confidence=operation.evidence?.confidence;
    if(confidence!=null&&(typeof confidence!=='number'||confidence<0||confidence>1))errors.push(`${label} confidence 必須介於 0 到 1`);
  });
  payload.operations.forEach((operation,index)=>{if(['pokemon_ingredients','pokemon_subskills'].includes(operation.entity)){const id=operation.key?.pokemon_id;if(id&&!pokemonIds.has(id))warnings.push(`#${index+1} 關聯個體 ${id} 未在同一更新包中出現；將依現有資料庫判定`);}});
  if(emptyFieldCount)warnings.push(`偵測到 ${emptyFieldCount} 個空值欄位；預設不覆蓋資料庫既有非空值。只有 clear_fields 明確列出的欄位才會清空。`);
  const confirmations=Array.isArray(payload.profile_audit_confirmations)?payload.profile_audit_confirmations:[];
  confirmations.forEach((item,index)=>{
    if(item?.status==='user_confirmed_not_visible'&&item.confirmed_by_user!==true)errors.push(`profile_audit_confirmations #${index+1} 尚未由使用者確認`);
  });
  const counts={};for(const operation of payload.operations)counts[operation.entity]=(counts[operation.entity]||0)+1;
  return {errors,warnings,review,summary:{scenario:payload.scenario||'general',operation_count:payload.operations.length,entity_counts:counts,review_required_count:review.length,empty_field_count:emptyFieldCount,explicit_zero_count:explicitZeroCount,explicit_false_count:explicitFalseCount,profile_confirmation_count:confirmations.length,null_overwrite_policy:'preserve_existing_unless_clear_fields'}};
}

export function validateWorkflow(payload){
  if(typeof payload==='string'||payload?.schema_version==='2.0-observation'||Array.isArray(payload?.observations))return validateObservationPayload(payload);
  return validateUpdatePackage(payload);
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
