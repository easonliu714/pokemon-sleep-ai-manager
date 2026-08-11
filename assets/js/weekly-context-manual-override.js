import {rows,run,persist,snapshot} from './database.js';
import {localIso} from './time-utils.js';
import {computeWeeklyOverrideRebase,WEEKLY_OVERRIDE_REBASE_VERSION} from './weekly-context-override-rebase.js';

export const WEEKLY_MANUAL_OVERRIDE_SCHEMA='weekly-context-manual-override/1.0';
export const WEEKLY_MANUAL_OVERRIDE_VERSION='weekly-manual-override-2026-08-11-b-data-preservation';
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

// Transaction-bound helper for Weekly Update Package Apply.
// It intentionally does not snapshot/persist by itself: importer.js already owns the
// surrounding Snapshot + BEGIN/COMMIT/ROLLBACK boundary. A new Weekly revision only
// supersedes manual fields that it actually observes; null/missing values carry the
// prior user observation forward to the new revision. Explicit clear_fields and an
// actual camp change remain authoritative invalidation signals.
export function rebaseWeeklyManualOverrideForImport({
  weekStart,
  newImportRevision,
  incomingData={},
  clearFields=[],
  previousCamp=null,
}={}){
  const epoch=String(weekStart||'').trim();
  const revision=String(newImportRevision||'').trim();
  if(!epoch||!revision)return Object.freeze({action:'none',reason:'missing_week_or_revision',rebase_version:WEEKLY_OVERRIDE_REBASE_VERSION,carried_fields:[]});
  const record=readWeeklyManualOverride(epoch);
  if(!record)return Object.freeze({action:'none',reason:'no_manual_override',rebase_version:WEEKLY_OVERRIDE_REBASE_VERSION,carried_fields:[]});
  const now=localIso();
  const result=computeWeeklyOverrideRebase({record,newImportRevision:revision,incomingData,clearFields,previousCamp,updatedAt:now});
  if(result.action==='delete'){
    run('DELETE FROM settings WHERE key=?',[settingKey(epoch)]);
  }else if(result.action==='upsert'&&result.record){
    const next={...result.record,version:WEEKLY_MANUAL_OVERRIDE_VERSION};
    run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES(?,?,?)`,[settingKey(epoch),JSON.stringify(next),now]);
  }
  return Object.freeze({
    action:result.action,
    rebase_version:WEEKLY_OVERRIDE_REBASE_VERSION,
    previous_revision:result.previous_revision||null,
    new_revision:result.new_revision||revision,
    carried_fields:Object.freeze([...(result.carried_fields||[])]),
    superseded_fields:Object.freeze([...(result.superseded_fields||[])]),
    explicit_clear_fields:Object.freeze([...(result.explicit_clear_fields||[])]),
    domain_invalidated_fields:Object.freeze([...(result.domain_invalidated_fields||[])]),
    camp_changed:Boolean(result.camp_changed),
  });
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
