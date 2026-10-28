// G265 second exact legacy writer: Weekly Manual Override save, source-only opt-in.
// Never imported by production. No live player database, schema or migration change.
import {createSqliteFreshDurableTransactionAdapter} from './sqlite-fresh-durable-transaction-adapter.js';

const SCHEMA='weekly-context-manual-override/1.0';
const VERSION='weekly-manual-override-2026-08-11-b-data-preservation';
const FIELDS=Object.freeze([
  'camp','dish_category','pot_size','favorite_berry_1','favorite_berry_2','favorite_berry_3','event_name','event_effects','base_notes'
]);
const fail=code=>Object.assign(new Error(code),{code});
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const validUtc=value=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const validWeek=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(Date.parse(value+'T00:00:00.000Z'))
  &&new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;

function admittedFields(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw fail('G265_WEEKLY_OVERRIDE_FIELDS_REQUIRED');
  const result={};
  for(const field of FIELDS){
    if(!own(input,field))continue;
    const value=input[field];
    if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')
      throw fail('G265_WEEKLY_OVERRIDE_NON_JSON_FIELD');
    let serialized;
    try{serialized=JSON.stringify(value);}catch{throw fail('G265_WEEKLY_OVERRIDE_NON_JSON_FIELD');}
    if(serialized===undefined)throw fail('G265_WEEKLY_OVERRIDE_NON_JSON_FIELD');
    result[field]=JSON.parse(serialized);
  }
  if(!Object.keys(result).length)throw fail('G265_WEEKLY_OVERRIDE_FIELDS_REQUIRED');
  return result;
}

export function createWeeklyManualOverrideOptIn({pairGate,openSqlite}={}){
  const transaction=createSqliteFreshDurableTransactionAdapter({pairGate,openSqlite});
  async function execute({weekStart,basedOnImportRevision,fields,updatedAt,expectedGeneration,expectedFingerprint}={}){
    const week=typeof weekStart==='string'?weekStart.trim():'';
    const revision=typeof basedOnImportRevision==='string'?basedOnImportRevision.trim():'';
    if(!validWeek(week))throw fail('G265_WEEKLY_OVERRIDE_WEEK_REQUIRED');
    if(!revision)throw fail('G265_WEEKLY_OVERRIDE_REVISION_REQUIRED');
    if(!validUtc(updatedAt))throw fail('G265_WEEKLY_OVERRIDE_TIMESTAMP_REQUIRED');
    const sanitized=admittedFields(fields);
    const record={schema:SCHEMA,version:VERSION,week_start:week,
      based_on_import_revision:revision,fields:sanitized,updated_at:updatedAt};
    const key='weekly_context_manual_override:'+week;
    return transaction.execute({
      reason:'g265:optin:weekly-manual-override:'+week,
      expectedGeneration,expectedFingerprint,
      mutate:sql=>{
        // Mirrors saveWeeklyManualOverride() without touching the production writer.
        // The adapter owns fresh-durable reload, BEGIN/COMMIT/ROLLBACK and atomic CAS.
        sql.run('INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES(?,?,?)',
          [key,JSON.stringify(record),updatedAt]);
      }
    });
  }
  return Object.freeze({execute,status:transaction.status});
}
