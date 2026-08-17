import {localWeekStart} from './evaluation-week.js';
import {buildUpdatePackageId} from './update-package-contract.js';

export const UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION='uc-img-weekly-platform-authority-2026-08-17-b-semantic-intake';

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
  return `\n\nInternal Gemini 平台時間 Authority（這些欄位不是 OCR／AI 推測值，必須逐字使用）：\n- current_week_start=${clean(authority.week_start)}\n- key.context_id=${clean(authority.context_id)}\n- generated_at=${clean(authority.generated_at)}\n- data.updated_at=${clean(authority.updated_at)}\n- update_id=${clean(authority.update_id)}\n- context_authority=${clean(authority.context_authority)}\nAI 只負責從圖片辨識 camp、dish_category、favorite_berry_1~3、event_name、event_effects、pot_size、base_notes 等可觀測本週事實。不得自行推算或改寫上述平台時間欄位。\n\n重要的 semantic-intake 規則：\n1. 必須逐張檢查本情境全部圖片。只要圖片中能直接看見任何本週語意事實，就必須輸出對應欄位；不得只回傳 week_start / updated_at 等平台時間欄位。\n2. 固定三樹果營地雖可由 Public Camp Berry Master 投影 favorite_berry_1~3，但畫面若能讀到 camp，仍必須輸出 data.camp；不得因樹果是固定公版資料而把整張營地畫面略過。\n3. 活動畫面可見的名稱、期間、營地範圍、料理倍率、主技能／睡眠 EXP／睡意之力等效果都必須依 weekly event contract 寫入已知欄位；無法對應既有欄位的可見效果放 event_effects.unknown_effects 並 review_required=true，不能整段省略。\n4. 若本次圖片確實完全沒有任何可支援的本週語意欄位，才允許省略；有可見內容卻回傳 platform-only weekly operation 視為分析不完整，平台會 fail closed。`;
}
