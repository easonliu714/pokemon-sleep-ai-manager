import {localWeekStart} from './evaluation-week.js';
import {validateWeeklyEventEffects} from './weekly-context-normalization.js';

export const WEEKLY_CONTEXT_IMPORT_CONTRACT_VERSION='weekly-context-import-contract-2026-08-10-a';
export const WEEKLY_CONTEXT_AUTHORITY='UPDATE_CENTER_JSON';
export const WEEKLY_EVENT_ALLOWED_KEYS=Object.freeze([
  'recipe_final_energy_multiplier','extra_tasty_multiplier','sunday_extra_tasty_multiplier','sunday_pot_multiplier','new_recipe_count','event_start','event_end',
]);
const EVENT_KEYS=new Set(WEEKLY_EVENT_ALLOWED_KEYS);
const dateKey=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const iso=value=>{try{return Boolean(value)&&Number.isFinite(new Date(value).getTime());}catch{return false;}};

export function isWeeklyContextPayload(payload){
  if(payload?.scenario==='weekly_context_update')return true;
  const operations=Array.isArray(payload?.operations)?payload.operations:[];
  return operations.some(operation=>operation?.entity==='weekly_context');
}

export function weeklyContextOperation(payload){
  const operations=Array.isArray(payload?.operations)?payload.operations:[];
  return operations.find(operation=>operation?.entity==='weekly_context')||operations[0]||null;
}

export function validateWeeklyContextImportPayload(payload,{now=new Date(),requireCurrentWeek=true}={}){
  const issues=[];
  if(!isWeeklyContextPayload(payload))return Object.freeze({ok:false,issues:Object.freeze(['payload 不是 weekly_context_update']),operation:null,week_start:null,current_week_start:localWeekStart(now)});
  const operation=weeklyContextOperation(payload);
  if(payload?.scenario!=='weekly_context_update')issues.push('scenario 必須為 weekly_context_update');
  if(payload?.context_authority!==WEEKLY_CONTEXT_AUTHORITY)issues.push(`context_authority 必須為 ${WEEKLY_CONTEXT_AUTHORITY}`);
  if(!Array.isArray(payload?.operations)||payload.operations.length!==1)issues.push('operations 必須只有 1 筆 weekly_context upsert');
  if(!operation){issues.push('缺少 weekly_context operation');return Object.freeze({ok:false,issues:Object.freeze(issues),operation:null,week_start:null,current_week_start:localWeekStart(now)});}
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
  if(!iso(payload?.generated_at))issues.push('generated_at 必須為有效 ISO 日期時間');
  if(!iso(data.updated_at))issues.push('data.updated_at 必須為有效 ISO 日期時間');
  if(data.event_effects!==null&&data.event_effects!==undefined&&typeof data.event_effects!=='string')issues.push('event_effects 必須是 JSON 字串，不可直接放 object');
  if(typeof data.event_effects==='string'){
    let effects=null;
    try{effects=JSON.parse(data.event_effects||'{}');}catch{issues.push('event_effects 不是有效 JSON 字串');}
    if(effects!==null){
      if(!effects||typeof effects!=='object'||Array.isArray(effects))issues.push('event_effects JSON 字串內容必須是 object');
      else{
        for(const key of Object.keys(effects))if(!EVENT_KEYS.has(key))issues.push(`event_effects 不支援欄位：${key}`);
        try{validateWeeklyEventEffects(data.event_effects);}catch(error){issues.push(error?.message||String(error));}
        for(const key of ['event_start','event_end'])if(effects[key]!=null&&effects[key]!==''&&!dateKey(effects[key]))issues.push(`event_effects.${key} 必須為 YYYY-MM-DD`);
      }
    }
  }
  const berries=['favorite_berry_1','favorite_berry_2','favorite_berry_3'].map(key=>data[key]).filter(value=>value!==null&&value!==undefined&&String(value).trim()!=='').map(value=>String(value).trim());
  if(berries.length!==0&&berries.length!==3)issues.push('動態／隨機營地的 favorite_berry_1~3 必須全部三欄一起提供，或全部省略');
  if(new Set(berries).size!==berries.length)issues.push('favorite_berry_1~3 不可重複');
  return Object.freeze({
    ok:issues.length===0,
    issues:Object.freeze([...new Set(issues)]),
    operation,
    week_start:weekStart||null,
    current_week_start:currentEpoch,
    authority:payload?.context_authority||null,
  });
}
