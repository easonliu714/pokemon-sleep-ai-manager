import {localWeekStart} from './evaluation-week.js';
import {buildUpdatePackageId} from './update-package-contract.js';

export const UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION='uc-img-weekly-platform-authority-2026-08-11-a';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').trim();

export function buildUcImgWeeklyPlatformAuthority(now=new Date()){
  const point=now instanceof Date?new Date(now.getTime()):new Date(now);
  if(!Number.isFinite(point.getTime()))throw new Error('weekly_platform_authority_invalid_now');
  const generatedAt=point.toISOString();
  const weekStart=localWeekStart(point);
  return Object.freeze({
    authority_version:UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION,
    week_start:weekStart,
    context_id:`weekly_context_${weekStart}_import`,
    generated_at:generatedAt,
    updated_at:generatedAt,
    update_id:buildUpdatePackageId(generatedAt,'AI'),
    context_authority:'UPDATE_CENTER_JSON',
  });
}

function requireField(schema,key){
  schema.required=[...new Set([...(schema.required||[]),key])];
}

export function constrainUcImgWeeklyJsonSchema(schema,authority){
  const copy=clone(schema||{});
  copy.properties=copy.properties||{};
  copy.properties.generated_at={type:'string',enum:[authority.generated_at]};
  copy.properties.update_id={type:'string',enum:[authority.update_id]};
  copy.properties.context_authority={type:'string',enum:[authority.context_authority]};
  requireField(copy,'generated_at');requireField(copy,'update_id');requireField(copy,'context_authority');
  const operation=copy.properties?.operations?.items;
  if(operation){
    operation.properties=operation.properties||{};
    operation.properties.key=operation.properties.key||{type:'object',properties:{},additionalProperties:false};
    operation.properties.key.properties=operation.properties.key.properties||{};
    operation.properties.key.properties.context_id={type:'string',enum:[authority.context_id]};
    requireField(operation.properties.key,'context_id');
    operation.properties.data=operation.properties.data||{type:'object',additionalProperties:true};
    operation.properties.data.properties=operation.properties.data.properties||{};
    operation.properties.data.properties.week_start={type:'string',enum:[authority.week_start]};
    operation.properties.data.properties.updated_at={type:'string',enum:[authority.updated_at]};
    requireField(operation.properties.data,'week_start');requireField(operation.properties.data,'updated_at');
  }
  return copy;
}

export function applyUcImgWeeklyPlatformAuthority(payload,authority){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return payload;
  const copy=clone(payload);
  copy.generated_at=authority.generated_at;
  copy.update_id=authority.update_id;
  copy.context_authority=authority.context_authority;
  const operations=Array.isArray(copy.operations)?copy.operations:[];
  const operation=operations.find(item=>item?.entity==='weekly_context')||null;
  if(operation){
    operation.key={...(operation.key||{}),context_id:authority.context_id};
    operation.data={...(operation.data||{}),week_start:authority.week_start,updated_at:authority.updated_at};
  }
  return copy;
}

export function buildUcImgWeeklyPlatformPromptInstruction(authority){
  return `\n\nInternal Gemini 平台時間 Authority（這些欄位不是 OCR／AI 推測值，必須逐字使用）：\n- current_week_start=${clean(authority.week_start)}\n- key.context_id=${clean(authority.context_id)}\n- generated_at=${clean(authority.generated_at)}\n- data.updated_at=${clean(authority.updated_at)}\n- update_id=${clean(authority.update_id)}\n- context_authority=${clean(authority.context_authority)}\nAI 只負責從圖片辨識 camp、dish_category、favorite_berry_1~3、event_name、event_effects、pot_size、base_notes 等可觀測本週事實。不得自行推算或改寫上述平台時間欄位。`;
}
