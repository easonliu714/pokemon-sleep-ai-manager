import {rows,run,persist,snapshot} from './database.js';

export const WEEKLY_ACTIVITY_BONUS_VERSION='weekly-manual-activity-bonus-2026-10-11-a';
export const WEEKLY_ACTIVITY_BONUS_SCHEMA='pokemon-sleep-weekly-manual-activity-bonus/1.0';
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x||{},k);
const keyFor=week=>`weekly_activity_bonus:${String(week||'').trim()}`;
const multiplierKeys=['pot_multiplier','sleep_exp_multiplier','candy_use_exp_multiplier'];
const optionalMultiplier=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<1||n>10)throw new Error('活動倍率必須介於 1 到 10，或留空表示未確認');
  return n;
};
export function normalizeWeeklyActivityBonusInput(value={}){
  const data={};
  for(const key of multiplierKeys)data[key]=optionalMultiplier(value?.[key]);
  const raw=value?.observed_pot_capacity;
  if(raw===null||raw===undefined||raw==='')data.observed_pot_capacity=null;
  else {
    const n=Number(raw);
    if(!Number.isInteger(n)||n<1||n>10000)throw new Error('遊戲實際鍋子容量必須為 1 至 10000 的整數');
    data.observed_pot_capacity=n;
  }
  return Object.freeze(data);
}
export function readWeeklyManualActivityBonus(weekStart){
  if(!String(weekStart||'').trim())return null;
  try{
    const raw=rows('SELECT value_json FROM settings WHERE key=?',[keyFor(weekStart)])[0]?.value_json;
    const payload=raw?JSON.parse(raw):null;
    if(payload?.schema!==WEEKLY_ACTIVITY_BONUS_SCHEMA||payload?.week_start!==weekStart)return null;
    return Object.freeze({...payload,values:normalizeWeeklyActivityBonusInput(payload.values)});
  }catch{return null;}
}
export async function saveWeeklyManualActivityBonus({weekStart,values}={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart||'')))throw new Error('必須綁定有效的本週開始日期');
  const normalized=normalizeWeeklyActivityBonusInput(values);
  const payload={schema:WEEKLY_ACTIVITY_BONUS_SCHEMA,version:WEEKLY_ACTIVITY_BONUS_VERSION,
    week_start:weekStart,source:'PLAYER_EXPLICIT_MANUAL_WEEKLY_OBSERVATION',values:normalized,updated_at:new Date().toISOString()};
  await snapshot('manual:weekly-activity-bonus');
  run('INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES(?,?,?)',[keyFor(weekStart),JSON.stringify(payload),payload.updated_at]);
  await persist();
  return Object.freeze(payload);
}
export function projectWeeklyManualActivityBonus({basePotSize=null,record=null}={}){
  const values=normalizeWeeklyActivityBonusInput(record?.values||{});
  const base=basePotSize==null?null:Number(basePotSize);
  const validBase=Number.isInteger(base)&&base>0?base:null;
  const exactObserved=values.observed_pot_capacity;
  const factor=values.pot_multiplier;
  const rawPot=validBase!==null&&factor!==null?validBase*factor:null;
  // Never invent the game's integer rounding rule for fractional pot products.
  const exactProduct=rawPot!==null&&Number.isSafeInteger(rawPot)&&rawPot>0?rawPot:null;
  const effective=exactObserved??exactProduct??validBase;
  const status=exactObserved!==null?'MANUAL_OBSERVED_EXACT':
    factor===null?'NO_MANUAL_POT_BONUS':
    validBase===null?'REVIEW_BASE_CAPACITY_UNKNOWN':
    exactProduct===null?'REVIEW_FRACTIONAL_CAPACITY_ROUNDING':'MANUAL_MULTIPLIER_INTEGER_EXACT';
  return Object.freeze({
    source:record?.source==='PLAYER_EXPLICIT_MANUAL_WEEKLY_OBSERVATION'?'PLAYER_EXPLICIT_MANUAL_WEEKLY_OBSERVATION':'NONE',
    pot_multiplier:factor,sleep_exp_multiplier:values.sleep_exp_multiplier,
    candy_use_exp_multiplier:values.candy_use_exp_multiplier,
    observed_pot_capacity:exactObserved,base_pot_capacity:validBase,
    effective_pot_capacity:effective,pot_capacity_status:status,
    sleep_exp_calculation_status:'DISPLAY_ONLY_UNVERIFIED',
    candy_use_exp_calculation_status:'DISPLAY_ONLY_UNVERIFIED',
    public_event_master_write:false,account_base_pot_write:false,
  });
}
