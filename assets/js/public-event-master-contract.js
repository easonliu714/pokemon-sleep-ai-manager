import {
  WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
  projectWeeklyEventEffects,
  validateWeeklyEventEffectsByRegistry,
} from './weekly-event-effect-registry.js';

export const PUBLIC_EVENT_MANIFEST_SCHEMA='pokemon-sleep-public-event-manifest/1.0';
export const PUBLIC_EVENT_MASTER_SCHEMA='pokemon-sleep-public-event-master/1.0';
export const PUBLIC_EVENT_AUTHORITY_VERSION='public-event-authority-2026-08-17-a';
export const PUBLIC_EVENT_TIME_ZONE='Asia/Taipei';

const text=value=>String(value??'').normalize('NFKC').trim();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const dateMs=value=>{const ms=Date.parse(String(value||''));return Number.isFinite(ms)?ms:null;};
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);

function assert(condition,message){if(!condition)throw new Error(message);}
function asObject(value,label){assert(value&&typeof value==='object'&&!Array.isArray(value),`${label} 必須為物件`);return value;}
function asArray(value,label){assert(Array.isArray(value),`${label} 必須為陣列`);return value;}
function requiredText(value,label){const out=text(value);assert(out,`${label} 不可為空`);return out;}
function normalizedScope(value){
  const source=Array.isArray(value)?value:[value];
  const out=[...new Set(source.map(text).filter(Boolean))];
  assert(out.length>0,'public event camp_scope 至少需要一個值');
  return out;
}
function normalizeAuthorityStatus(value){
  const status=text(value)||'REVIEW_REQUIRED';
  assert(['VERIFIED','PARTIAL_VERIFIED','REVIEW_REQUIRED'].includes(status),`public event authority_status 不支援：${status}`);
  return status;
}
function normalizeSource(value,label){
  const source=asObject(value||{},label);
  const sourceType=requiredText(source.source_type,label+'.source_type');
  const sourceName=requiredText(source.source_name,label+'.source_name');
  const sourceRef=requiredText(source.source_ref,label+'.source_ref');
  return Object.freeze({
    source_type:sourceType,
    source_name:sourceName,
    source_ref:sourceRef,
    verified_at:text(source.verified_at)||null,
    note:text(source.note)||null,
  });
}
function normalizeEffects(value,label){
  const effects=value==null?{}:asObject(value,label);
  const issues=validateWeeklyEventEffectsByRegistry(effects);
  assert(!issues.length,`${label}: ${issues[0]}`);
  return stable(effects);
}
function normalizePhase(raw,eventStart,eventEnd,eventId,index){
  const phase=asObject(raw,`events.${eventId}.phases[${index}]`);
  const phaseId=requiredText(phase.phase_id,`events.${eventId}.phases[${index}].phase_id`);
  const startAt=requiredText(phase.start_at,`events.${eventId}.phases.${phaseId}.start_at`);
  const endAt=requiredText(phase.end_at,`events.${eventId}.phases.${phaseId}.end_at`);
  const start=dateMs(startAt),end=dateMs(endAt);
  assert(start!==null&&end!==null&&start<end,`public event phase ${eventId}/${phaseId} 時間範圍無效`);
  assert(start>=eventStart&&end<=eventEnd,`public event phase ${eventId}/${phaseId} 必須落在活動期間內`);
  return Object.freeze({
    phase_id:phaseId,
    title:text(phase.title)||null,
    start_at:startAt,
    end_at:endAt,
    effects:Object.freeze(normalizeEffects(phase.effects,`events.${eventId}.phases.${phaseId}.effects`)),
    mission_period:phase.mission_period&&typeof phase.mission_period==='object'&&!Array.isArray(phase.mission_period)?Object.freeze(stable(phase.mission_period)):null,
    authority_status:normalizeAuthorityStatus(phase.authority_status),
    source:normalizeSource(phase.source||raw.source||{},`events.${eventId}.phases.${phaseId}.source`),
  });
}
function normalizeEvent(raw,index){
  const event=asObject(raw,`events[${index}]`);
  const eventId=requiredText(event.event_id,`events[${index}].event_id`);
  const title=requiredText(event.title,`events.${eventId}.title`);
  const startAt=requiredText(event.start_at,`events.${eventId}.start_at`);
  const endAt=requiredText(event.end_at,`events.${eventId}.end_at`);
  const start=dateMs(startAt),end=dateMs(endAt);
  assert(start!==null&&end!==null&&start<end,`public event ${eventId} 時間範圍無效`);
  const phases=(event.phases||[]).map((phase,phaseIndex)=>normalizePhase(phase,start,end,eventId,phaseIndex));
  const phaseIds=new Set();
  let previousEnd=null;
  for(const phase of [...phases].sort((a,b)=>dateMs(a.start_at)-dateMs(b.start_at))){
    assert(!phaseIds.has(phase.phase_id),`public event ${eventId} phase_id 重複：${phase.phase_id}`);
    phaseIds.add(phase.phase_id);
    const phaseStart=dateMs(phase.start_at),phaseEnd=dateMs(phase.end_at);
    assert(previousEnd===null||phaseStart>=previousEnd,`public event ${eventId} phases 不可重疊`);
    previousEnd=phaseEnd;
  }
  return Object.freeze({
    event_id:eventId,
    title,
    locale:text(event.locale)||'zh-TW',
    region:text(event.region)||'GLOBAL',
    start_at:startAt,
    end_at:endAt,
    camp_scope:Object.freeze(normalizedScope(event.camp_scope||['*'])),
    effects:Object.freeze(normalizeEffects(event.effects,`events.${eventId}.effects`)),
    phases:Object.freeze(phases),
    missions:Object.freeze(Array.isArray(event.missions)?stable(event.missions):[]),
    rewards:Object.freeze(Array.isArray(event.rewards)?stable(event.rewards):[]),
    limited_mechanics:Object.freeze(Array.isArray(event.limited_mechanics)?stable(event.limited_mechanics):[]),
    authority_status:normalizeAuthorityStatus(event.authority_status),
    source:normalizeSource(event.source,`events.${eventId}.source`),
    field_provenance:Object.freeze(event.field_provenance&&typeof event.field_provenance==='object'&&!Array.isArray(event.field_provenance)?stable(event.field_provenance):{}),
  });
}

export function validatePublicEventManifest(input){
  const manifest=asObject(input,'public event manifest');
  assert(manifest.schema===PUBLIC_EVENT_MANIFEST_SCHEMA,`public event manifest schema 必須為 ${PUBLIC_EVENT_MANIFEST_SCHEMA}`);
  const version=requiredText(manifest.master_version,'public event manifest master_version');
  const path=requiredText(manifest.payload_path,'public event manifest payload_path');
  assert(!/^https?:\/\//i.test(path)&&!path.startsWith('//'),'public event manifest payload_path 必須為同源相對路徑');
  const sha=requiredText(manifest.payload_sha256,'public event manifest payload_sha256').toLowerCase();
  assert(/^[a-f0-9]{64}$/.test(sha),'public event manifest payload_sha256 必須為 64 位十六進位 SHA-256');
  return Object.freeze({
    schema:PUBLIC_EVENT_MANIFEST_SCHEMA,
    master_version:version,
    payload_path:path,
    payload_sha256:sha,
    locale:text(manifest.locale)||'zh-TW',
    region:text(manifest.region)||'TW',
    generated_at:text(manifest.generated_at)||null,
    authority_version:text(manifest.authority_version)||PUBLIC_EVENT_AUTHORITY_VERSION,
  });
}

export function validatePublicEventPayload(input,{expectedVersion=null}={}){
  const payload=asObject(input,'public event payload');
  assert(payload.schema===PUBLIC_EVENT_MASTER_SCHEMA,`public event payload schema 必須為 ${PUBLIC_EVENT_MASTER_SCHEMA}`);
  const masterVersion=requiredText(payload.master_version,'public event payload master_version');
  if(expectedVersion)assert(masterVersion===expectedVersion,`public event payload master_version=${masterVersion} 與 manifest=${expectedVersion} 不一致`);
  const events=asArray(payload.events,'public event payload events').map(normalizeEvent);
  const eventIds=new Set();
  for(const event of events){assert(!eventIds.has(event.event_id),`public event event_id 重複：${event.event_id}`);eventIds.add(event.event_id);}
  return Object.freeze({
    schema:PUBLIC_EVENT_MASTER_SCHEMA,
    master_version:masterVersion,
    locale:text(payload.locale)||'zh-TW',
    region:text(payload.region)||'TW',
    generated_at:text(payload.generated_at)||null,
    registry_version:text(payload.registry_version)||WEEKLY_EVENT_EFFECT_REGISTRY_VERSION,
    events:Object.freeze(events),
  });
}

function campMatches(scope,camp){
  const target=text(camp);
  return scope.includes('*')||scope.includes('ALL')||Boolean(target&&scope.includes(target));
}
function activeAt(startAt,endAt,nowMs){
  const start=dateMs(startAt),end=dateMs(endAt);
  return start!==null&&end!==null&&nowMs>=start&&nowMs<end;
}
function phaseFor(event,nowMs){
  return event.phases.find(phase=>activeAt(phase.start_at,phase.end_at,nowMs))||null;
}
function scalarConflictValue(value){
  if(value===null||['string','number','boolean'].includes(typeof value))return value;
  if(Array.isArray(value)&&value.every(item=>item===null||['string','number','boolean'].includes(typeof item)))return value;
  return JSON.stringify(stable(value));
}

export function resolvePublicEventProjection(payloadInput,{date=new Date(),camp=null}={}){
  const payload=payloadInput?.schema===PUBLIC_EVENT_MASTER_SCHEMA&&Array.isArray(payloadInput.events)?payloadInput:validatePublicEventPayload(payloadInput);
  const nowMs=date instanceof Date?date.getTime():dateMs(date);
  assert(Number.isFinite(nowMs),'public event resolver date 無效');
  const active=[];
  for(const event of payload.events){
    if(!activeAt(event.start_at,event.end_at,nowMs)||!campMatches(event.camp_scope,camp))continue;
    const phase=phaseFor(event,nowMs);
    active.push(Object.freeze({event,phase,effects:Object.freeze(stable({...event.effects,...(phase?.effects||{})}))}));
  }
  const merged={},effectOwner=new Map(),conflictedKeys=new Set(),conflicts=[],unknown=[];
  for(const item of active){
    for(const [key,value] of Object.entries(item.effects||{})){
      if(key==='unknown_effects'){
        if(Array.isArray(value))unknown.push(...value);
        continue;
      }
      if(conflictedKeys.has(key))continue;
      if(!own(merged,key)){
        merged[key]=value;effectOwner.set(key,item.event.event_id);continue;
      }
      if(JSON.stringify(stable(merged[key]))===JSON.stringify(stable(value)))continue;
      conflicts.push(Object.freeze({effect_key:key,event_ids:Object.freeze([effectOwner.get(key),item.event.event_id]),values:Object.freeze([scalarConflictValue(merged[key]),scalarConflictValue(value)])}));
      delete merged[key];
      effectOwner.delete(key);
      conflictedKeys.add(key);
    }
  }
  for(const conflict of conflicts)unknown.push({
    source_text:`PUBLIC_EVENT_EFFECT_CONFLICT:${conflict.effect_key}:${conflict.event_ids.join('|')}`,
    observed_value:conflict.values,
  });
  if(unknown.length)merged.unknown_effects=unknown;
  const projected=projectWeeklyEventEffects(merged);
  const authorityStatus=conflicts.length||active.some(item=>item.event.authority_status==='REVIEW_REQUIRED'||item.phase?.authority_status==='REVIEW_REQUIRED')
    ?'REVIEW_REQUIRED'
    :active.some(item=>item.event.authority_status==='PARTIAL_VERIFIED'||item.phase?.authority_status==='PARTIAL_VERIFIED')?'PARTIAL_VERIFIED':'VERIFIED';
  return Object.freeze({
    schema:'pokemon-sleep-active-public-event-projection/1.0',
    master_version:payload.master_version,
    authority_version:PUBLIC_EVENT_AUTHORITY_VERSION,
    resolved_at:new Date(nowMs).toISOString(),
    time_zone:PUBLIC_EVENT_TIME_ZONE,
    camp:text(camp)||null,
    active_event_count:active.length,
    active_events:Object.freeze(active.map(item=>Object.freeze({
      event_id:item.event.event_id,title:item.event.title,start_at:item.event.start_at,end_at:item.event.end_at,
      phase_id:item.phase?.phase_id||null,phase_title:item.phase?.title||null,phase_start_at:item.phase?.start_at||null,phase_end_at:item.phase?.end_at||null,
      authority_status:item.event.authority_status,phase_authority_status:item.phase?.authority_status||null,source:item.event.source,field_provenance:item.event.field_provenance,
    }))),
    event_name:active.map(item=>item.event.title).join(' + ')||null,
    event_effects:Object.freeze(stable(merged)),
    event_effects_serialized:Object.keys(merged).length?JSON.stringify(stable(merged)):null,
    event_effect_registry_version:projected.registry_version,
    event_effect_states:projected.states,
    strategy_event_effects:projected.deterministic_effects,
    feature_only_event_effects:projected.feature_only_effects,
    review_event_effects:projected.review_effects,
    event_effect_strategy_fingerprint:projected.strategy_effect_fingerprint,
    event_effect_review_required:Boolean(projected.has_review_required||authorityStatus==='REVIEW_REQUIRED'),
    event_authority_status:authorityStatus,
    effect_conflicts:Object.freeze(conflicts),
    provenance:'PUBLIC_EVENT_MASTER',
  });
}

function nextTaipeiFourAm(afterMs){
  const taipeiMs=afterMs+8*60*60*1000;
  const local=new Date(taipeiMs);
  let boundary=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),4,0,0,0)-8*60*60*1000;
  if(boundary<=afterMs)boundary+=24*60*60*1000;
  return boundary;
}

export function nextPublicEventBoundary(payloadInput,{date=new Date(),camp=null}={}){
  const payload=payloadInput?.schema===PUBLIC_EVENT_MASTER_SCHEMA&&Array.isArray(payloadInput.events)?payloadInput:validatePublicEventPayload(payloadInput);
  const nowMs=date instanceof Date?date.getTime():dateMs(date);
  assert(Number.isFinite(nowMs),'public event boundary date 無效');
  const candidates=[{kind:'GAME_DAY_04',at:nextTaipeiFourAm(nowMs),event_id:null,phase_id:null}];
  for(const event of payload.events){
    if(!campMatches(event.camp_scope,camp))continue;
    for(const [kind,value] of [['EVENT_START',event.start_at],['EVENT_END',event.end_at]]){
      const at=dateMs(value);if(at>nowMs)candidates.push({kind,at,event_id:event.event_id,phase_id:null});
    }
    for(const phase of event.phases){
      for(const [kind,value] of [['PHASE_START',phase.start_at],['PHASE_END',phase.end_at]]){
        const at=dateMs(value);if(at>nowMs)candidates.push({kind,at,event_id:event.event_id,phase_id:phase.phase_id});
      }
    }
  }
  candidates.sort((a,b)=>a.at-b.at||a.kind.localeCompare(b.kind));
  const next=candidates[0];
  return Object.freeze({...next,at_iso:new Date(next.at).toISOString()});
}
