export const UC_IMG_SESSION_LIFECYCLE_VERSION='uc-img-session-lifecycle-2026-08-11-a';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').trim();
const nowIso=()=>new Date().toISOString();

// v0.4.11.1: this helper is deliberately storage-free. The UC.IMG session owner decides
// when/where to persist the cleaned session. Screenshot bytes are memory-only, therefore every
// entry reconstructed from persistent JSON is orphan metadata after a genuine page reload.
export function cleanupRestoredUcImgSession(session,{cleanedAt=nowIso()}={}){
  if(!session||typeof session!=='object'||Array.isArray(session))return {changed:false,removed_entry_count:0,staled_scenarios:[],session};
  const entries=Array.isArray(session.entries)?session.entries:[];
  if(!entries.length)return {changed:false,removed_entry_count:0,staled_scenarios:[],session};
  const copy=clone(session),affected=new Set(entries.map(entry=>clean(entry?.scenario_key)).filter(Boolean)),staled=[];
  copy.entries=[];
  copy.scenario_state=copy.scenario_state&&typeof copy.scenario_state==='object'?copy.scenario_state:{};
  for(const scenarioKey of affected){
    const state=copy.scenario_state?.[scenarioKey];
    if(!state?.raw_response||state.last_apply_status==='APPLIED')continue;
    state.response_stale=true;staled.push(scenarioKey);
  }
  copy.updated_at=cleanedAt;
  copy.last_restore_cleanup={cleaned_at:cleanedAt,removed_entry_count:entries.length,staled_scenarios:[...staled]};
  return {changed:true,removed_entry_count:entries.length,staled_scenarios:[...staled],session:copy};
}