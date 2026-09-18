import {localWeekStart} from './evaluation-week.js';
import {buildUpdatePackageId} from './update-package-contract.js';
import {WEEKLY_EVENT_EFFECT_REGISTRY} from './weekly-event-effect-registry.js';

export const UC_IMG_WEEKLY_PLATFORM_AUTHORITY_VERSION='uc-img-weekly-platform-authority-2026-08-17-d-structured-semantic-schema';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').trim();
const WEEKLY_SEMANTIC_FIELDS=Object.freeze(['camp','dish_category','event_name','event_effects','base_notes']);
const WEEKLY_PROVIDER_BERRY_FIELDS=Object.freeze(['favorite_berry_1','favorite_berry_2','favorite_berry_3']);
const semanticMeaningful=value=>{
  if(value===null||value===undefined||value==='')return false;
  if(Array.isArray(value))return value.length>0;
  if(typeof value==='object')return Object.keys(value).length>0;
  return clean(value)!=='';
};

export function ucImgWeeklySemanticFields(data={}){
  return WEEKLY_SEMANTIC_FIELDS.filter(field=>semanticMeaningful(data?.[field]));
}

export function normalizeUcImgWeeklyProviderPayload(sourcePayload){
  const source=sourcePayload&&typeof sourcePayload==='object'&&!Array.isArray(sourcePayload)?sourcePayload:{};
  const copy=clone(source);
  if(copy.scenario!=='weekly_context_update')return copy;
  if(copy.visual_observation_summary||Array.isArray(copy.visual_observations))return copy;
  const operation=Array.isArray(copy.operations)?copy.operations.find(item=>item?.entity==='weekly_context'):null;
  if(!operation)return copy;
  const guesses=WEEKLY_PROVIDER_BERRY_FIELDS.map((field,index)=>({field,slot:index+1,name:clean(operation.data?.[field])})).filter(item=>item.name);
  if(!guesses.length)return copy;
  const sourceImageRef=clean(operation.evidence?.source_image_ref)||null;
  const confidence=typeof operation.evidence?.confidence==='number'?operation.evidence.confidence:null;
  copy.visual_observation_summary={favorite_berry_icon_count:guesses.length,complete:guesses.length===3};
  copy.visual_observations=guesses.map(item=>({
    observation_type:'favorite_berry_icon',
    slot:item.slot,
    source_image_ref:sourceImageRef,
    status:'CANDIDATE',
    confidence,
    authority:'AI_VISUAL_CANDIDATE_ONLY',
    candidate_name:item.name,
    review_required:true,
  }));
  operation.data={...(operation.data||{})};
  for(const field of WEEKLY_PROVIDER_BERRY_FIELDS)delete operation.data[field];
  operation.review_required=true;
  return copy;
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
  copy.properties.visual_observation_summary={
    type:'object',
    properties:{favorite_berry_icon_count:{type:'integer',minimum:0,maximum:3},complete:{type:'boolean',enum:[true]}},
    required:['favorite_berry_icon_count','complete'],
    additionalProperties:false,
  };
  copy.properties.visual_observations={
    type:'array',maxItems:3,
    items:{
      type:'object',
      properties:{
        observation_type:{type:'string',enum:['favorite_berry_icon']},
        slot:{type:'integer',minimum:1,maximum:3},
        source_image_ref:{type:'string'},
        status:{type:'string',enum:['OBSERVED','CANDIDATE']},
        confidence:{type:'number',minimum:0,maximum:1},
        authority:{type:'string',enum:['AI_VISUAL_OBSERVATION_ONLY','AI_VISUAL_CANDIDATE_ONLY']},
        candidate_name:{type:'string'},
        review_required:{type:'boolean',enum:[true]},
      },
      required:['observation_type','slot','source_image_ref','status','authority','review_required'],
      additionalProperties:false,
    },
  };
  requireField(copy,'generated_at');requireField(copy,'update_id');requireField(copy,'context_authority');
  requireField(copy,'visual_observation_summary');requireField(copy,'visual_observations');
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
    const evidence=operation.properties.evidence;
    if(evidence){
      evidence.properties=evidence.properties||{};
      evidence.properties.field_confidence={
        type:'object',
        properties:{
          week_start:{type:'number',minimum:0,maximum:1},
          camp:{type:'number',minimum:0,maximum:1},
          dish_category:{type:'number',minimum:0,maximum:1},
          event_name:{type:'number',minimum:0,maximum:1},
          base_notes:{type:'number',minimum:0,maximum:1},
        },
        additionalProperties:false,
      };
    }
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
  return `\n\nInternal Gemini 平台時間 Authority（這些欄位不是 OCR／AI 推測值，必須逐字使用）：\n- current_week_start=${clean(authority.week_start)}\n- key.context_id=${clean(authority.context_id)}\n- generated_at=${clean(authority.generated_at)}\n- data.updated_at=${clean(authority.updated_at)}\n- update_id=${clean(authority.update_id)}\n- context_authority=${clean(authority.context_authority)}\nAI 只負責從圖片辨識 camp、dish_category、favorite_berry_1~3、event_name、event_effects、base_notes 等可觀測本週事實。不得自行推算或改寫上述平台時間欄位。基礎鍋子容量不是 Weekly Context semantic field，請勿輸出 data.pot_size。\n\n重要的 semantic-intake 規則：\n1. 必須逐張檢查本情境全部圖片。只要圖片中能直接看見任何本週語意事實，就必須輸出對應欄位；不得只回傳 week_start / updated_at 等平台時間欄位。\n2. 固定三樹果營地雖可由 Public Camp Berry Master 投影 favorite_berry_1~3，但畫面若能讀到 camp，仍必須輸出 data.camp；不得因樹果是固定公版資料而把整張營地畫面略過。\n3. 紅色／粉紅色活動公告畫面屬於高價值文字 Evidence。即使活動正式標題沒有完整出現在截圖中，也必須逐條讀取可見的期間、適用營地、料理倍率、漂亮成功倍率、主技能發動機率、睡眠 EXP、睡意之力、貪吃狀態、特殊相遇等效果；event_name 看不清楚時可以省略，但 event_effects 不得整段省略。\n4. 能唯一對應現有 Weekly Event Registry 的效果寫入對應欄位；無法無歧義對應的可見效果逐字放入 event_effects.unknown_effects，每筆至少保留 source_text 與可用的 source_image_ref，並將 operation.review_required=true。禁止為了避免 review 而省略公告文字。\n5. 有可見內容卻回傳 platform-only weekly operation 視為分析不完整，平台會 fail closed 並要求重新分析。\n6. Internal Gemini 不得直接輸出 data.favorite_berry_1~3。每個可見喜好樹果 icon 必須放在 root visual_observations，AI 最多只能標記 OBSERVED / CANDIDATE；不得自行輸出 VERIFIED。\n7. visual_observation_summary 與 visual_observations 是本情境 structured-output 必填；即使樹果名稱無法確認，也必須保留 slot 與 source_image_ref，不得靜默省略。`;
}
