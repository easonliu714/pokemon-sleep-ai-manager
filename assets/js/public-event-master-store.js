import {
  begin,
  commit,
  isDatabaseReady,
  isRescueReadonly,
  persist,
  rollback,
  rows,
  run,
} from './database.js';
import {
  nextPublicEventBoundary,
  PUBLIC_EVENT_MASTER_SCHEMA,
  resolvePublicEventProjection,
  validatePublicEventManifest,
  validatePublicEventPayload,
} from './public-event-master-contract.js';

export const PUBLIC_EVENT_MASTER_SETTINGS_KEY='public_event_master_version';
export const PUBLIC_EVENT_MASTER_MANIFEST_SETTINGS_KEY='public_event_master_manifest';
export const PUBLIC_EVENT_MASTER_SHA_SETTINGS_KEY='public_event_master_payload_sha256';
export const PUBLIC_EVENT_MASTER_REFRESH_VERSION='public-event-master-refresh-2026-08-17-a';
export const DEFAULT_PUBLIC_EVENT_MANIFEST_URL='./assets/data/public-event-master-manifest.json';

let boundaryTimer=null;
const jsonParse=(value,fallback)=>{try{return JSON.parse(value);}catch{return fallback;}};
const clean=value=>String(value??'').trim();

function settingValue(key){
  try{
    const row=rows('SELECT value_json FROM settings WHERE key=? LIMIT 1',[key])[0];
    return row?.value_json==null?null:JSON.parse(row.value_json);
  }catch{return null;}
}
function writeSetting(key,value){
  run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES(?,?,datetime('now'))`,[key,JSON.stringify(value)]);
}
function cachedVersion(){return clean(settingValue(PUBLIC_EVENT_MASTER_SETTINGS_KEY));}
function payloadUrl(path,manifestUrl){
  const base=globalThis.document?.baseURI||globalThis.location?.href||manifestUrl;
  try{return new URL(path,base).toString();}catch{return path;}
}
async function sha256Hex(text){
  const subtle=globalThis.crypto?.subtle;
  if(!subtle)throw new Error('PUBLIC_EVENT_SHA256_UNAVAILABLE');
  const digest=await subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function fetchText(fetchImpl,url){
  const response=await fetchImpl(url,{cache:'no-store',credentials:'same-origin'});
  if(!response?.ok)throw new Error(`PUBLIC_EVENT_FETCH_FAILED:${response?.status||'NO_RESPONSE'}:${url}`);
  return response.text();
}
function eventRows(){
  return rows(`SELECT event_id,title,locale,region,start_at,end_at,camp_scope_json,effects_json,
    missions_json,rewards_json,limited_mechanics_json,authority_status,source_json,
    field_provenance_json,data_version,updated_at
    FROM public_event_master ORDER BY start_at,event_id`);
}
function phaseRows(){
  return rows(`SELECT event_id,phase_id,title,start_at,end_at,effects_json,mission_period_json,
    authority_status,source_json,data_version,updated_at
    FROM public_event_phase ORDER BY event_id,start_at,phase_id`);
}

export function loadCachedPublicEventPayload(){
  if(!isDatabaseReady()||isRescueReadonly())return null;
  const version=cachedVersion();
  if(!version)return null;
  let events=[];
  try{
    const phasesByEvent=new Map();
    for(const phase of phaseRows()){
      const list=phasesByEvent.get(phase.event_id)||[];
      list.push({
        phase_id:phase.phase_id,title:phase.title||null,start_at:phase.start_at,end_at:phase.end_at,
        effects:jsonParse(phase.effects_json,{}),mission_period:jsonParse(phase.mission_period_json,null),
        authority_status:phase.authority_status,source:jsonParse(phase.source_json,{}),
      });
      phasesByEvent.set(phase.event_id,list);
    }
    events=eventRows().map(event=>({
      event_id:event.event_id,title:event.title,locale:event.locale,region:event.region,
      start_at:event.start_at,end_at:event.end_at,camp_scope:jsonParse(event.camp_scope_json,[]),
      effects:jsonParse(event.effects_json,{}),phases:phasesByEvent.get(event.event_id)||[],
      missions:jsonParse(event.missions_json,[]),rewards:jsonParse(event.rewards_json,[]),
      limited_mechanics:jsonParse(event.limited_mechanics_json,[]),authority_status:event.authority_status,
      source:jsonParse(event.source_json,{}),field_provenance:jsonParse(event.field_provenance_json,{}),
    }));
  }catch{return null;}
  const manifest=settingValue(PUBLIC_EVENT_MASTER_MANIFEST_SETTINGS_KEY)||{};
  return validatePublicEventPayload({
    schema:PUBLIC_EVENT_MASTER_SCHEMA,
    master_version:version,
    locale:manifest.locale||'zh-TW',
    region:manifest.region||'TW',
    generated_at:manifest.generated_at||null,
    events,
  },{expectedVersion:version});
}

export function resolveCachedPublicEventProjection({date=new Date(),camp=null}={}){
  const payload=loadCachedPublicEventPayload();
  if(!payload)return null;
  return resolvePublicEventProjection(payload,{date,camp});
}

function replaceCachedPayload(payload,manifest){
  run('DELETE FROM public_event_phase');
  run('DELETE FROM public_event_master');
  const now=new Date().toISOString();
  for(const event of payload.events){
    run(`INSERT INTO public_event_master(
      event_id,title,locale,region,start_at,end_at,camp_scope_json,effects_json,
      missions_json,rewards_json,limited_mechanics_json,authority_status,source_json,
      field_provenance_json,data_version,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      event.event_id,event.title,event.locale,event.region,event.start_at,event.end_at,
      JSON.stringify(event.camp_scope),JSON.stringify(event.effects),JSON.stringify(event.missions),
      JSON.stringify(event.rewards),JSON.stringify(event.limited_mechanics),event.authority_status,
      JSON.stringify(event.source),JSON.stringify(event.field_provenance),payload.master_version,now,
    ]);
    for(const phase of event.phases){
      run(`INSERT INTO public_event_phase(
        event_id,phase_id,title,start_at,end_at,effects_json,mission_period_json,
        authority_status,source_json,data_version,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[
        event.event_id,phase.phase_id,phase.title,phase.start_at,phase.end_at,JSON.stringify(phase.effects),
        phase.mission_period?JSON.stringify(phase.mission_period):null,phase.authority_status,
        JSON.stringify(phase.source),payload.master_version,now,
      ]);
    }
  }
  writeSetting(PUBLIC_EVENT_MASTER_SETTINGS_KEY,payload.master_version);
  writeSetting(PUBLIC_EVENT_MASTER_MANIFEST_SETTINGS_KEY,manifest);
  writeSetting(PUBLIC_EVENT_MASTER_SHA_SETTINGS_KEY,manifest.payload_sha256);
  writeSetting('public_event_master_refresh_report',{
    refresh_version:PUBLIC_EVENT_MASTER_REFRESH_VERSION,
    master_version:payload.master_version,
    event_count:payload.events.length,
    phase_count:payload.events.reduce((sum,event)=>sum+event.phases.length,0),
    player_rows_modified:false,
    refreshed_at:now,
  });
}

function integrityCheck(payload){
  const integrity=rows('PRAGMA integrity_check')[0]?.integrity_check;
  if(integrity!=='ok')throw new Error(`PUBLIC_EVENT_SQLITE_INTEGRITY_FAILED:${integrity||'UNKNOWN'}`);
  const storedVersion=cachedVersion();
  if(storedVersion!==payload.master_version)throw new Error('PUBLIC_EVENT_VERSION_PERSIST_MISMATCH');
  const eventCount=Number(rows('SELECT COUNT(*) AS count FROM public_event_master')[0]?.count||0);
  const phaseCount=Number(rows('SELECT COUNT(*) AS count FROM public_event_phase')[0]?.count||0);
  const expectedPhases=payload.events.reduce((sum,event)=>sum+event.phases.length,0);
  if(eventCount!==payload.events.length||phaseCount!==expectedPhases)throw new Error('PUBLIC_EVENT_ROW_COUNT_MISMATCH');
  return Object.freeze({integrity_check:'ok',event_count:eventCount,phase_count:phaseCount});
}

function dispatchMasterEvent(type,detail){
  if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function'){
    globalThis.dispatchEvent(new CustomEvent(type,{detail}));
  }
}

export function schedulePublicEventBoundary({date=new Date(),camp=null}={}){
  if(boundaryTimer){clearTimeout(boundaryTimer);boundaryTimer=null;}
  const payload=loadCachedPublicEventPayload();
  if(!payload)return null;
  const boundary=nextPublicEventBoundary(payload,{date,camp});
  const delay=Math.max(250,Math.min(2147480000,boundary.at-Date.now()+250));
  boundaryTimer=setTimeout(()=>{
    boundaryTimer=null;
    const projection=resolveCachedPublicEventProjection({date:new Date(),camp});
    dispatchMasterEvent('pokemon-sleep:public-event-boundary-crossed',{boundary,projection});
    dispatchMasterEvent('pokemon-sleep:data-changed',{entity:'public_event_master',reason:boundary.kind});
    schedulePublicEventBoundary({date:new Date(),camp});
  },delay);
  boundaryTimer?.unref?.();
  return boundary;
}

export async function refreshPublicEventMaster({
  fetchImpl=globalThis.fetch?.bind(globalThis),
  manifestUrl=DEFAULT_PUBLIC_EVENT_MANIFEST_URL,
  date=new Date(),
  camp=null,
}={}){
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze({status:'PLAYER_DATABASE_UNAVAILABLE',updated:false,cached_version:null});
  const beforeVersion=cachedVersion();
  if(typeof fetchImpl!=='function'){
    schedulePublicEventBoundary({date,camp});
    return Object.freeze({status:beforeVersion?'OFFLINE_CACHED':'NO_VERIFIED_CACHE',updated:false,cached_version:beforeVersion||null,error:'FETCH_UNAVAILABLE'});
  }
  try{
    const manifestText=await fetchText(fetchImpl,manifestUrl);
    const manifest=validatePublicEventManifest(JSON.parse(manifestText));
    const beforeSha=clean(settingValue(PUBLIC_EVENT_MASTER_SHA_SETTINGS_KEY)).toLowerCase();
    if(beforeVersion===manifest.master_version&&beforeSha===manifest.payload_sha256){
      const projection=resolveCachedPublicEventProjection({date,camp});
      const boundary=schedulePublicEventBoundary({date,camp});
      return Object.freeze({status:'UNCHANGED',updated:false,cached_version:beforeVersion,manifest,projection,boundary});
    }

    const rawPayload=await fetchText(fetchImpl,payloadUrl(manifest.payload_path,manifestUrl));
    const actualSha=await sha256Hex(rawPayload);
    if(actualSha!==manifest.payload_sha256)throw new Error(`PUBLIC_EVENT_SHA256_MISMATCH:expected=${manifest.payload_sha256}:actual=${actualSha}`);
    const payload=validatePublicEventPayload(JSON.parse(rawPayload),{expectedVersion:manifest.master_version});
    const dryRun=Object.freeze({
      from_version:beforeVersion||null,to_version:payload.master_version,event_count:payload.events.length,
      phase_count:payload.events.reduce((sum,event)=>sum+event.phases.length,0),player_rows_modified:false,
    });

    let transactionOpen=false;
    try{
      begin();transactionOpen=true;
      replaceCachedPayload(payload,manifest);
      commit();transactionOpen=false;
    }catch(error){if(transactionOpen)rollback();throw error;}
    await persist();
    const integrity=integrityCheck(payload);
    const projection=resolveCachedPublicEventProjection({date,camp});
    const boundary=schedulePublicEventBoundary({date,camp});
    const detail=Object.freeze({status:'UPDATED',updated:true,cached_version:payload.master_version,manifest,dry_run:dryRun,integrity,projection,boundary});
    dispatchMasterEvent('pokemon-sleep:public-event-master-updated',detail);
    dispatchMasterEvent('pokemon-sleep:data-changed',{entity:'public_event_master',reason:'manifest_refresh',master_version:payload.master_version});
    return detail;
  }catch(error){
    const cached=loadCachedPublicEventPayload();
    const projection=cached?resolvePublicEventProjection(cached,{date,camp}):null;
    const boundary=cached?schedulePublicEventBoundary({date,camp}):null;
    const detail=Object.freeze({
      status:cached?'OFFLINE_CACHED':'NO_VERIFIED_CACHE',updated:false,cached_version:cached?.master_version||beforeVersion||null,
      error:error?.message||String(error),projection,boundary,
    });
    dispatchMasterEvent('pokemon-sleep:public-event-master-refresh-failed',detail);
    return detail;
  }
}
