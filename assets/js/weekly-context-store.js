import {rows} from './database.js';
import {localWeekStart} from './evaluation-week.js';
import {normalizeWeeklyContext,parseWeeklyEventEffects} from './weekly-context-normalization.js';
import {resolveCampFavoriteBerries} from './public-camp-berry-master.js';
import {resolveWeeklyManualOverride} from './weekly-context-manual-override.js';
import {resolveBasePotCapacity} from './pot-capacity-authority.js';

export const WEEKLY_CONTEXT_STORE_VERSION='weekly-context-store-2026-08-12-e-pot-capacity-projection';

const meaningful=value=>value!==null&&value!==undefined&&value!=='';
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const CORE_FIELDS=['camp','dish_category','event_name','base_notes'];
const BERRY_FIELDS=['favorite_berry_1','favorite_berry_2','favorite_berry_3'];

function accountPotCapacity(){
  try{
    const row=rows("SELECT total_capacity FROM account_capacity WHERE capacity_key='pot' LIMIT 1")[0];
    return row?.total_capacity??null;
  }catch{return null;}
}
function importAuthorityByContextId(){
  const map=new Map();
  let audit=[];
  try{
    audit=rows("SELECT ic.key_json,ib.update_id,ib.imported_at,ib.result_json FROM import_changes ic JOIN import_batches ib ON ib.update_id=ic.update_id WHERE ic.entity='weekly_context' AND ic.status='applied' ORDER BY ib.imported_at DESC,ic.id DESC");
  }catch{return map;}
  for(const item of audit){
    let key={},result={};
    try{key=JSON.parse(item.key_json||'{}');}catch{}
    try{result=JSON.parse(item.result_json||'{}');}catch{}
    if(result?.scenario!=='weekly_context_update')continue;
    const id=String(key?.context_id||'').trim();if(!id||map.has(id))continue;
    map.set(id,{update_id:item.update_id||null,imported_at:item.imported_at||null});
  }
  return map;
}
function classifyRows(epoch){
  const data=rows('SELECT * FROM weekly_context WHERE week_start=? ORDER BY updated_at DESC,context_id DESC',[epoch]);
  const importedById=importAuthorityByContextId();
  const imported=[],manual=[];
  for(const row of data){
    const audit=importedById.get(String(row.context_id||''));
    if(audit||String(row.context_id||'').endsWith('_import'))imported.push({...row,__authority:audit||{update_id:null,imported_at:row.updated_at||null}});
    else manual.push(row);
  }
  imported.sort((a,b)=>String(b.__authority?.imported_at||b.updated_at||'').localeCompare(String(a.__authority?.imported_at||a.updated_at||''))||String(b.context_id||'').localeCompare(String(a.context_id||'')));
  return {imported:imported[0]||null,manual:manual[0]||null,all:data};
}
function importRevision(imported){
  if(!imported)return '';
  return String(imported.__authority?.update_id||imported.__authority?.imported_at||imported.updated_at||'').trim();
}
function mergedEffects(primary,manual,manualOverride,fieldSources){
  if(manualOverride.active&&own(manualOverride.fields,'event_effects')){
    const overridden=parseWeeklyEventEffects(manualOverride.fields.event_effects);
    fieldSources.event_effects='MANUAL_OVERRIDE';
    for(const key of Object.keys(overridden))fieldSources[`event_effects.${key}`]='MANUAL_OVERRIDE';
    return Object.keys(overridden).length?JSON.stringify(overridden):null;
  }
  const fallback=parseWeeklyEventEffects(manual?.event_effects),incoming=parseWeeklyEventEffects(primary?.event_effects),merged={...fallback};
  if(meaningful(primary?.event_effects))fieldSources.event_effects='UPDATE_CENTER_JSON';
  else if(meaningful(manual?.event_effects))fieldSources.event_effects='MANUAL_FALLBACK';
  for(const [key,value] of Object.entries(incoming))if(meaningful(value)||value===0||value===false)merged[key]=value;
  for(const key of new Set([...Object.keys(fallback),...Object.keys(incoming)])){
    if(meaningful(incoming[key])||incoming[key]===0||incoming[key]===false)fieldSources[`event_effects.${key}`]='UPDATE_CENTER_JSON';
    else if(meaningful(fallback[key])||fallback[key]===0||fallback[key]===false)fieldSources[`event_effects.${key}`]='MANUAL_FALLBACK';
  }
  return Object.keys(merged).length?JSON.stringify(merged):null;
}
function legacyWeeklyPot(imported,manual,manualOverride){
  if(manualOverride.active&&own(manualOverride.fields,'pot_size'))return manualOverride.fields.pot_size;
  if(imported&&(meaningful(imported.pot_size)||imported.pot_size===0))return imported.pot_size;
  if(manual&&(meaningful(manual.pot_size)||manual.pot_size===0))return manual.pot_size;
  return null;
}
function compose(epoch,{imported,manual}){
  if(!imported&&!manual)return null;
  const revision=importRevision(imported);
  const manualOverride=resolveWeeklyManualOverride(epoch,revision);
  const overrideFields=manualOverride.fields||{};
  const fieldSources={},row={week_start:epoch};
  for(const field of [...CORE_FIELDS,...BERRY_FIELDS]){
    if(manualOverride.active&&own(overrideFields,field)){
      row[field]=overrideFields[field];fieldSources[field]='MANUAL_OVERRIDE';
    }else if(imported&&(meaningful(imported[field])||imported[field]===0||imported[field]===false)){
      row[field]=imported[field];fieldSources[field]='UPDATE_CENTER_JSON';
    }else if(manual&&(meaningful(manual[field])||manual[field]===0||manual[field]===false)){
      row[field]=manual[field];fieldSources[field]='MANUAL_FALLBACK';
    }else row[field]=null;
  }
  // Base pot capacity is account-level player state. Weekly rows are compatibility-only fallback.
  const potAuthority=resolveBasePotCapacity({accountCapacity:accountPotCapacity(),legacyWeeklyPot:legacyWeeklyPot(imported,manual,manualOverride)});
  row.pot_size=potAuthority.pot_size;
  if(potAuthority.pot_size!==null)fieldSources.pot_size=potAuthority.source;
  // A user changing camp must never inherit a previous camp's dynamic berry trio.
  // Fixed camps are re-projected below by Public Camp Master; random/EX camps
  // require a fresh explicit trio in the same manual override when desired.
  if(manualOverride.active&&own(overrideFields,'camp')){
    for(const field of BERRY_FIELDS)if(!own(overrideFields,field)){row[field]=null;fieldSources[field]='MANUAL_OVERRIDE';}
  }
  row.event_effects=mergedEffects(imported,manual,manualOverride,fieldSources);
  row.context_id=imported?.context_id||manual?.context_id||null;
  row.updated_at=manualOverride.active?(manualOverride.record?.updated_at||imported?.updated_at||manual?.updated_at||null):(imported?.updated_at||manual?.updated_at||null);
  const normalized=normalizeWeeklyContext(row);
  const berry=resolveCampFavoriteBerries(normalized.camp,[normalized.favorite_berry_1,normalized.favorite_berry_2,normalized.favorite_berry_3]);
  const berries=[...berry.berries];
  if(berry.policy==='FIXED_3')for(const field of BERRY_FIELDS)fieldSources[field]='PUBLIC_CAMP_MASTER';
  const manualFallbackFields=Object.entries(fieldSources).filter(([,source])=>source==='MANUAL_FALLBACK'||source==='LEGACY_WEEKLY_POT_FALLBACK').map(([field])=>field).sort();
  const manualOverrideFields=Object.entries(fieldSources).filter(([,source])=>source==='MANUAL_OVERRIDE').map(([field])=>field).filter(field=>!field.startsWith('event_effects.')).sort();
  const authoritySource=manualOverrideFields.length?'MANUAL_OVERRIDE':imported?'UPDATE_CENTER_JSON':'MANUAL_FALLBACK';
  return Object.freeze({
    ...normalized,
    favorite_berry_1:berries[0]||null,
    favorite_berry_2:berries[1]||null,
    favorite_berry_3:berries[2]||null,
    favorite_berries:Object.freeze(berries),
    berry_policy:berry.policy,
    berry_locked:berry.locked,
    berry_source:berry.source,
    pot_capacity_authority:potAuthority.source,
    pot_capacity_legacy_fallback:potAuthority.is_legacy_fallback,
    context_status:'CURRENT_WEEK_READY',
    authority_source:authoritySource,
    authority_context_id:imported?.context_id||manual?.context_id||null,
    authority_update_id:imported?.__authority?.update_id||null,
    authority_imported_at:imported?.__authority?.imported_at||null,
    authority_revision:revision||null,
    manual_context_id:manual?.context_id||null,
    manual_fallback_fields:Object.freeze(manualFallbackFields),
    manual_override_active:manualOverride.active,
    manual_override_stale:manualOverride.stale,
    manual_override_fields:Object.freeze(manualOverrideFields),
    manual_override_setting_key:manualOverride.record?`weekly_context_manual_override:${epoch}`:null,
    manual_override_based_on_revision:manualOverride.record?.based_on_import_revision||null,
    field_sources:Object.freeze({...fieldSources}),
  });
}

export function currentWeeklyContext({date=new Date()}={}){
  const epoch=localWeekStart(date),classified=classifyRows(epoch),resolved=compose(epoch,classified);
  if(resolved)return resolved;
  const potAuthority=resolveBasePotCapacity({accountCapacity:accountPotCapacity(),legacyWeeklyPot:null});
  return Object.freeze({
    context_id:null,week_start:epoch,camp:null,dish_category:null,event_name:null,pot_size:potAuthority.pot_size,
    favorite_berry_1:null,favorite_berry_2:null,favorite_berry_3:null,event_effects:null,base_notes:null,updated_at:null,
    context_status:'CURRENT_WEEK_MISSING',authority_source:'MISSING',authority_context_id:null,authority_update_id:null,authority_imported_at:null,authority_revision:null,
    pot_capacity_authority:potAuthority.source,pot_capacity_legacy_fallback:false,
    berry_policy:'UNKNOWN',berry_source:'MISSING_PLAYER_WEEK_OBSERVATION',favorite_berries:Object.freeze([]),manual_fallback_fields:Object.freeze([]),
    manual_override_active:false,manual_override_stale:false,manual_override_fields:Object.freeze([]),manual_override_setting_key:null,manual_override_based_on_revision:null,
    field_sources:Object.freeze(potAuthority.pot_size!==null?{pot_size:potAuthority.source}:{}),
  });
}

export function weeklyContextForEpoch(weekStart){
  const epoch=String(weekStart??'').trim();if(!epoch)return null;
  const resolved=compose(epoch,classifyRows(epoch));
  return resolved?Object.freeze({...resolved,context_status:'READY'}):null;
}
