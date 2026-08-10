import {rows,run,persist,snapshot} from './database.js';
import {localIso} from './time-utils.js';

export const WEEKLY_MANUAL_OVERRIDE_SCHEMA='weekly-context-manual-override/1.0';
export const WEEKLY_MANUAL_OVERRIDE_VERSION='weekly-manual-override-2026-08-10-a';
export const WEEKLY_MANUAL_OVERRIDE_FIELDS=Object.freeze([
  'camp','dish_category','pot_size','favorite_berry_1','favorite_berry_2','favorite_berry_3','event_name','event_effects','base_notes',
]);

const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const settingKey=weekStart=>`weekly_context_manual_override:${String(weekStart||'').trim()}`;
const cleanFields=input=>{
  const output={};
  for(const field of WEEKLY_MANUAL_OVERRIDE_FIELDS)if(own(input,field))output[field]=input[field];
  return output;
};

export function weeklyManualOverrideKey(weekStart){return settingKey(weekStart);}

export function readWeeklyManualOverride(weekStart){
  const epoch=String(weekStart||'').trim();if(!epoch)return null;
  try{
    const row=rows('SELECT value_json,updated_at FROM settings WHERE key=?',[settingKey(epoch)])[0];
    if(!row?.value_json)return null;
    const parsed=JSON.parse(row.value_json);
    if(parsed?.schema!==WEEKLY_MANUAL_OVERRIDE_SCHEMA||parsed?.week_start!==epoch||typeof parsed?.fields!=='object'||Array.isArray(parsed.fields))return null;
    return Object.freeze({...parsed,fields:Object.freeze(cleanFields(parsed.fields)),setting_updated_at:row.updated_at||null});
  }catch{return null;}
}

export function resolveWeeklyManualOverride(weekStart,importRevision=''){
  const record=readWeeklyManualOverride(weekStart);
  if(!record)return Object.freeze({record:null,active:false,stale:false,fields:Object.freeze({})});
  const expected=String(importRevision||'');
  const based=String(record.based_on_import_revision||'');
  const active=expected!==''&&based===expected;
  return Object.freeze({record,active,stale:!active,fields:active?record.fields:Object.freeze({})});
}

export async function saveWeeklyManualOverride({weekStart,basedOnImportRevision,fields}={}){
  const epoch=String(weekStart||'').trim();
  const revision=String(basedOnImportRevision||'').trim();
  if(!epoch)throw new Error('缺少本週 week_start');
  if(!revision)throw new Error('目前沒有可綁定的 Weekly JSON revision；無 JSON 時請使用人工 fallback');
  const sanitized=cleanFields(fields||{});
  if(!Object.keys(sanitized).length)throw new Error('沒有需要儲存的人工覆寫欄位');
  const now=localIso();
  const record={schema:WEEKLY_MANUAL_OVERRIDE_SCHEMA,version:WEEKLY_MANUAL_OVERRIDE_VERSION,week_start:epoch,based_on_import_revision:revision,fields:sanitized,updated_at:now};
  await snapshot('manual:weekly-context-override');
  run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES(?,?,?)`,[settingKey(epoch),JSON.stringify(record),now]);
  await persist();
  return Object.freeze(record);
}

export async function clearWeeklyManualOverride(weekStart){
  const epoch=String(weekStart||'').trim();if(!epoch)return false;
  if(!readWeeklyManualOverride(epoch))return false;
  await snapshot('manual:weekly-context-override-clear');
  run('DELETE FROM settings WHERE key=?',[settingKey(epoch)]);
  await persist();
  return true;
}
