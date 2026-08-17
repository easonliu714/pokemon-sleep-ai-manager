import {localWeekStart} from './evaluation-week.js';
import {buildUpdatePackageId} from './update-package-contract.js';
import {WEEKLY_EVENT_EFFECT_REGISTRY} from './weekly-event-effect-registry.js';

export const UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION='uc-img-weekly-platform-authority-2026-08-17-d-structured-semantic-schema';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').trim();
const WEEKLY_SEMANTIC_FIELDS=Object.freeze(['camp','dish_category','favorite_berry_1','favorite_berry_2','favorite_berry_3','event_name','event_effects','base_notes']);
const semanticMeaningful=value=>{
  if(value===null||value===undefined||value==='')return false;
  if(Array.isArray(value))return value.length>0;
  if(typeof value==='object')return Object.keys(value).length>0;
  return clean(value)!=='';
};

export function ucImgWeeklySemanticFields(data={}){
  return WEEKLY_SEMANTIC_FIELDS.filter(field=>semanticMeaningful(data?.[field]));
}

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

function eventEffectProperty(definition){
  switch(definition.value_type){
    case 'string':case 'datetime':return {type:'string'};
    case 'boolean':return {type:'boolean'};
    case 'number':return {type:'number',...(definition.exclusive_minimum!=null?{exclusiveMinimum:definition.exclusive_minimum}:{})};
    case 'integer':return {type:'integer',...(definition.minimum!=null?{minimum:definition.minimum}:{})};
    case 'string_array':return {type:'array',items:{type:'string'}};
    case 'unknown_effect_array':return {
      type:'array',
      items:{
        type:'object',
        properties:{source_text:{type:'string'},source_image_ref:{type:'string'}},
        required:['source_text'],
        additionalProperties:false,
      },
    };
    default:return {type:'string'};
  }
}

export function buildUcImgWeeklyEventEffectsJsonSchema(){
  return {
    type:'object',
    properties:Object.fromEntries(WEEKLY_EVENT_EFFECT_REGISTRY.map(definition=>[definition.effect_key,eventEffectProperty(definition)])),
    additionalProperties:false,
  };
}

export function buildUcImgWeeklySemanticDataProperties(){
  return {
    camp:{type:'string'},
    dish_category:{type:'string',enum:['咖哩／濃湯','沙拉','甜點／飲料']},
    favorite_berry_1:{type:'string'},
    favorite_berry_2:{type:'string'},
    favorite_berry_3:{type:'string'},
    event_name:{type:'string'},
    event_effects:buildUcImgWeeklyEventEffectsJsonSchema(),
    base_notes:{type:'string'},
  };
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
    operation.properties.data=operation.properties.data||{type:'object',properties:{}};
    operation.properties.data.properties={
      ...(operation.properties.data.properties||{}),
      ...buildUcImgWeeklySemanticDataProperties(),
      week_start:{type:'string',enum:[authority.week_start]},
      updated_at:{type:'string',enum:[authority.updated_at]},
    };
    operation.properties.data.additionalProperties=false;
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
    const semanticFields=ucImgWeeklySemanticFields(operation.data);
    if(!semanticFields.length){
      const error=new Error('UC_IMG_WEEKLY_SEMANTIC_INTAKE_EMPTY');
      error.code='UC_IMG_WEEKLY_SEMANTIC_INTAKE_EMPTY';
      error.details={scenario:'weekly_context_update',reason:'platform_only_payload',required_any_of:[...WEEKLY_SEMANTIC_FIELDS]};
      throw error;
    }
  }
  return copy;
}

export function buildUcImgWeeklyPlatformPromptInstruction(authority){
  return `\n\nInternal Gemini 平台時間 Authority（這些欄位不是 OCR／AI 推測值，必須逐字使用）：\n- current_week_start=${clean(authority.week_start)}\n- key.context_id=${clean(authority.context_id)}\n- generated_at=${clean(authority.generated_at)}\n- data.updated_at=${clean(authority.updated_at)}\n- update_id=${clean(authority.update_id)}\n- context_authority=${clean(authority.context_authority)}\nAI 只負責從圖片辨識 camp、dish_category、favorite_berry_1~3、event_name、event_effects、base_notes 等可觀測本週事實。不得自行推算或改寫上述平台時間欄位。基礎鍋子容量不是 Weekly Context semantic field，請勿輸出 data.pot_size。\n\n重要的 semantic-intake 規則：\n1. 必須逐張檢查本情境全部圖片。只要圖片中能直接看見任何本週語意事實，就必須輸出對應欄位；不得只回傳 week_start / updated_at 等平台時間欄位。\n2. 固定三樹果營地雖可由 Public Camp Berry Master 投影 favorite_berry_1~3，但畫面若能讀到 camp，仍必須輸出 data.camp；不得因樹果是固定公版資料而把整張營地畫面略過。\n3. 紅色／粉紅色活動公告畫面屬於高價值文字 Evidence。即使活動正式標題沒有完整出現在截圖中，也必須逐條讀取可見的期間、適用營地、料理倍率、漂亮成功倍率、主技能發動機率、睡眠 EXP、睡意之力、貪吃狀態、特殊相遇等效果；event_name 看不清楚時可以省略，但 event_effects 不得整段省略。\n4. 能唯一對應現有 Weekly Event Registry 的效果寫入對應欄位；無法無歧義對應的可見效果逐字放入 event_effects.unknown_effects，每筆至少保留 source_text 與可用的 source_image_ref，並將 operation.review_required=true。禁止為了避免 review 而省略公告文字。\n5. 有可見內容卻回傳 platform-only weekly operation 視為分析不完整，平台會 fail closed 並要求重新分析。`;
}
