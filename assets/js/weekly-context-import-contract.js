import {localWeekStart} from './evaluation-week.js';
import {normalizeDishCategory,parseWeeklyEventEffects,serializeWeeklyEventEffects,validateWeeklyEventEffects} from './weekly-context-normalization.js';
import {WEEKLY_EVENT_EFFECT_KEYS,normalizeUnknownWeeklyEffects} from './weekly-event-effect-registry.js';

export const WEEKLY_CONTEXT_IMPORT_CONTRACT_VERSION='weekly-context-import-contract-2026-08-10-b';
export const WEEKLY_CONTEXT_AUTHORITY='UPDATE_CENTER_JSON';
export const WEEKLY_EVENT_ALLOWED_KEYS=Object.freeze([...WEEKLY_EVENT_EFFECT_KEYS]);
const EVENT_KEYS=new Set(WEEKLY_EVENT_ALLOWED_KEYS);
const dateKey=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const iso=value=>{try{return Boolean(value)&&Number.isFinite(new Date(value).getTime());}catch{return false;}};
const clone=value=>JSON.parse(JSON.stringify(value));
const reviewAccepted=operation=>operation?.user_audit?.accepted_current_observation===true||operation?.review_resolution==='accepted_current_observation';

export function isWeeklyContextPayload(payload){
  if(payload?.scenario==='weekly_context_update')return true;
  const operations=Array.isArray(payload?.operations)?payload.operations:[];
  return operations.some(operation=>operation?.entity==='weekly_context');
}

export function weeklyContextOperation(payload){
  const operations=Array.isArray(payload?.operations)?payload.operations:[];
  return operations.find(operation=>operation?.entity==='weekly_context')||operations[0]||null;
}

export function normalizeWeeklyContextImportPayload(payload,{forStorage=false,repairLegacy=true}={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!isWeeklyContextPayload(payload))return Object.freeze({payload,repairs:Object.freeze([])});
  const normalized=clone(payload),repairs=[];
  const operation=weeklyContextOperation(normalized);
  if(repairLegacy&&normalized.scenario==='weekly_context_update'&&!normalized.context_authority){
    normalized.context_authority=WEEKLY_CONTEXT_AUTHORITY;
    repairs.push('LEGACY_CONTEXT_AUTHORITY_DEFAULTED');
  }
  if(operation?.data&&typeof operation.data==='object'){
    const data=operation.data;
    const weekStart=String(data.week_start||'').trim();
    if(weekStart&&operation.key&&String(operation.key.context_id||'')!==`weekly_context_${weekStart}_import`&&repairLegacy){
      operation.key.context_id=`weekly_context_${weekStart}_import`;
      repairs.push('LEGACY_CONTEXT_ID_CANONICALIZED');
    }
    if(data.dish_category!==null&&data.dish_category!==undefined&&data.dish_category!==''){
      const canonical=normalizeDishCategory(data.dish_category);
      if(canonical!==data.dish_category)repairs.push('DISH_CATEGORY_CANONICALIZED');
      data.dish_category=canonical;
    }
    if(repairLegacy&&data.event_effects!==null&&data.event_effects!==undefined&&data.event_effects!==''){
      const originalEffects=data.event_effects;
      const effects=parseWeeklyEventEffects(originalEffects);
      if(typeof effects.meal_category_forced==='string'){
        const forcedCategory=normalizeDishCategory(effects.meal_category_forced);
        const dishCategory=normalizeDishCategory(data.dish_category);
        if(dishCategory&&forcedCategory===dishCategory){
          effects.meal_category_forced=true;
          data.event_effects=typeof originalEffects==='string'?JSON.stringify(effects):effects;
          repairs.push('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE');
        }
      }
    }
    if(forStorage&&data.event_effects!==null&&data.event_effects!==undefined&&data.event_effects!==''){
      const serialized=serializeWeeklyEventEffects(data.event_effects);
      if(serialized!==null){
        if(typeof data.event_effects==='object')repairs.push('EVENT_EFFECTS_OBJECT_SERIALIZED_FOR_SQLITE');
        data.event_effects=serialized;
      }
    }
  }
  return Object.freeze({payload:normalized,repairs:Object.freeze([...new Set(repairs)])});
}

export function prepareWeeklyContextPayloadForImporter(payload){
  const normalized=normalizeWeeklyContextImportPayload(payload,{forStorage:true,repairLegacy:true});
  if(!normalized.payload||normalized.payload===payload&&normalized.repairs.length===0)return normalized;
  for(const key of Object.keys(payload))delete payload[key];
  Object.assign(payload,normalized.payload);
  return Object.freeze({payload,repairs:normalized.repairs});
}

export function validateWeeklyContextImportPayload(payload,{now=new Date(),requireCurrentWeek=true,repairLegacy=true}={}){
  const normalized=normalizeWeeklyContextImportPayload(payload,{forStorage:false,repairLegacy});
  const candidate=normalized.payload;
  const issues=[];
  if(!isWeeklyContextPayload(candidate))return Object.freeze({ok:false,issues:Object.freeze(['payload 不是 weekly_context_update']),warnings:normalized.repairs,operation:null,week_start:null,current_week_start:localWeekStart(now)});
  const operation=weeklyContextOperation(candidate);
  if(candidate?.scenario!=='weekly_context_update')issues.push('scenario 必須為 weekly_context_update');
  if(candidate?.context_authority!==WEEKLY_CONTEXT_AUTHORITY)issues.push(`context_authority 必須為 ${WEEKLY_CONTEXT_AUTHORITY}`);
  if(!Array.isArray(candidate?.operations)||candidate.operations.length!==1)issues.push('operations 必須只有 1 筆 weekly_context upsert');
  if(!operation){issues.push('缺少 weekly_context operation');return Object.freeze({ok:false,issues:Object.freeze(issues),warnings:normalized.repairs,operation:null,week_start:null,current_week_start:localWeekStart(now)});}
  const data=operation.data||{},weekStart=String(data.week_start||'').trim();
  if(operation.entity!=='weekly_context'||operation.action!=='upsert')issues.push('operation 必須為 entity=weekly_context、action=upsert');
  const currentEpoch=localWeekStart(now);
  if(!dateKey(weekStart))issues.push('data.week_start 必須為當週星期一 YYYY-MM-DD');
  else{
    const parsed=new Date(`${weekStart}T12:00:00`);
    if(localWeekStart(parsed)!==weekStart)issues.push('data.week_start 必須是星期一');
    if(requireCurrentWeek&&weekStart!==currentEpoch)issues.push(`此匯入只接受目前週期 ${currentEpoch}；不可使用上週／未來週 JSON`);
  }
  if(weekStart&&String(operation.key?.context_id||'')!==`weekly_context_${weekStart}_import`)issues.push(`key.context_id 必須為 weekly_context_${weekStart}_import`);
  if(!iso(candidate?.generated_at))issues.push('generated_at 必須為有效 ISO 日期時間');
  if(!iso(data.updated_at))issues.push('data.updated_at 必須為有效 ISO 日期時間');
  if(data.dish_category){
    const category=normalizeDishCategory(data.dish_category);
    if(!['咖哩／濃湯','沙拉','甜點／飲料'].includes(category))issues.push(`dish_category 不支援：${data.dish_category}`);
  }
  if(data.event_effects!==null&&data.event_effects!==undefined&&data.event_effects!==''&&typeof data.event_effects!=='string'&&(typeof data.event_effects!=='object'||Array.isArray(data.event_effects)))issues.push('event_effects 必須是 JSON object 或可解析的 JSON 字串');
  const effects=parseWeeklyEventEffects(data.event_effects);
  if(data.event_effects!==null&&data.event_effects!==undefined&&data.event_effects!==''&&!Object.keys(effects).length&&typeof data.event_effects==='string')issues.push('event_effects 不是有效 JSON 字串');
  if(Object.keys(effects).length){
    if('legacy_text' in effects)issues.push('event_effects 不是有效結構化 JSON');
    for(const key of Object.keys(effects))if(!EVENT_KEYS.has(key))issues.push(`event_effects 不支援欄位：${key}；未知活動效果請放入 unknown_effects[] 保留原文`);
    try{validateWeeklyEventEffects(effects);}catch(error){issues.push(error?.message||String(error));}
    let unknown=[];
    try{unknown=normalizeUnknownWeeklyEffects(effects.unknown_effects);}catch(error){issues.push(error?.message||String(error));}
    if(unknown.length&&operation.review_required!==true&&!reviewAccepted(operation))issues.push('event_effects.unknown_effects 含尚未建立規則的活動效果；必須 review_required=true 並由使用者確認後才能套用');
  }
  const berries=['favorite_berry_1','favorite_berry_2','favorite_berry_3'].map(key=>data[key]).filter(value=>value!==null&&value!==undefined&&String(value).trim()!=='').map(value=>String(value).trim());
  if(berries.length!==0&&berries.length!==3)issues.push('動態／隨機營地的 favorite_berry_1~3 必須全部三欄一起提供，或全部省略');
  if(new Set(berries).size!==berries.length)issues.push('favorite_berry_1~3 不可重複');
  return Object.freeze({
    ok:issues.length===0,
    issues:Object.freeze([...new Set(issues)]),
    warnings:normalized.repairs,
    operation,
    normalized_payload:candidate,
    week_start:weekStart||null,
    current_week_start:currentEpoch,
    authority:candidate?.context_authority||null,
  });
}
