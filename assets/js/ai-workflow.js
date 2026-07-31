import {AI_OBSERVATION_PROMPT,buildObservationTemplate,normalizeObservationPayload,validateObservationPayload} from './ai-observation.js';

const REQUIRED_ROOT=['schema_version','update_id','generated_at','source','operations'];
const ALLOWED_ENTITIES=new Set(['pokemon','pokemon_ingredients','pokemon_subskills','pokemon_identity_evidence','pokemon_evolution_history','ingredient_inventory','item_inventory','account_capacity','discarded_pokemon','recipes','recipe_ingredients','weekly_plan','weekly_context','weekly_strategy','settings']);
const ALLOWED_ACTIONS=new Set(['insert','update','upsert','archive','discarded','delete']);
const LEVELS={pokemon_ingredients:new Set([1,30,60]),pokemon_subskills:new Set([10,25,50,70,80])};
const LEGACY_SUBSKILL_LEVELS=new Map([[75,70],[100,80]]);

export const AI_PROMPT=AI_OBSERVATION_PROMPT;
export const buildTemplate=buildObservationTemplate;
export {normalizeObservationPayload,validateObservationPayload};

function validateUpdatePackage(payload){
  const errors=[],warnings=[],review=[];
  if(!payload||typeof payload!=='object')return {errors:['JSON 根節點必須是物件'],warnings,review,summary:{}};
  for(const key of REQUIRED_ROOT)if(!(key in payload))errors.push(`缺少根欄位：${key}`);
  if(!Array.isArray(payload.operations)){errors.push('operations 必須是陣列');return {errors,warnings,review,summary:{}};}
  const ids=new Set(),pokemonIds=new Set();
  payload.operations.forEach((operation,index)=>{
    const label=`#${index+1}`;
    if(!ALLOWED_ENTITIES.has(operation.entity))errors.push(`${label} 不支援 entity：${operation.entity}`);
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
    if(operation.review_required===true)review.push({index,operation_id:operation.operation_id||label,entity:operation.entity,key:operation.key,evidence:operation.evidence||null});
    const confidence=operation.evidence?.confidence;
    if(confidence!=null&&(typeof confidence!=='number'||confidence<0||confidence>1))errors.push(`${label} confidence 必須介於 0 到 1`);
  });
  payload.operations.forEach((operation,index)=>{if(['pokemon_ingredients','pokemon_subskills'].includes(operation.entity)){const id=operation.key?.pokemon_id;if(id&&!pokemonIds.has(id))warnings.push(`#${index+1} 關聯個體 ${id} 未在同一更新包中出現；將依現有資料庫判定`);}});
  const counts={};for(const operation of payload.operations)counts[operation.entity]=(counts[operation.entity]||0)+1;
  return {errors,warnings,review,summary:{operation_count:payload.operations.length,entity_counts:counts,review_required_count:review.length}};
}

export function validateWorkflow(payload){
  if(typeof payload==='string'||payload?.schema_version==='2.0-observation'||Array.isArray(payload?.observations))return validateObservationPayload(payload);
  return validateUpdatePackage(payload);
}

export function approveReviewed(payload){
  if(payload?.schema_version==='2.0-observation')return payload;
  return {...payload,operations:payload.operations.map(operation=>({...operation,review_required:false}))};
}
