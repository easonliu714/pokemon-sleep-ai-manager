import {isDatabaseReady,isRescueReadonly} from './database.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {refreshPublicEventMaster,schedulePublicEventBoundary} from './public-event-master-store.js';

export const PUBLIC_EVENT_MASTER_BOOTSTRAP_VERSION='public-event-master-bootstrap-2026-08-17-a';

let refreshPromise=null;
let lastRefreshScheduledAt=0;
export const PUBLIC_EVENT_FOREGROUND_REFRESH_MIN_GAP_MS=60000;
function playerCamp(){try{return currentWeeklyContext()?.camp||null;}catch{return null;}}
function emitWeeklyRefresh(reason,detail={}){
  const payload={entity:'weekly_context',authority:'PUBLIC_EVENT_MASTER',reason,...detail};
  if(typeof document!=='undefined'&&typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed',{detail:payload}));
  if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:payload}));
}
export async function refreshPublicEventMasterForCurrentWeek(){
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
    if(!isDatabaseReady()||isRescueReadonly())return {status:'PLAYER_DATABASE_UNAVAILABLE',updated:false};
    const result=await refreshPublicEventMaster({camp:playerCamp()});
    emitWeeklyRefresh('public_event_master_refresh',{status:result.status,master_version:result.cached_version||null});
    return result;
  })().finally(()=>{refreshPromise=null;});
  return refreshPromise;
}
function scheduleRefresh(){
  if(!isDatabaseReady()||isRescueReadonly())return;
  const now=Date.now();
  if(now-lastRefreshScheduledAt<PUBLIC_EVENT_FOREGROUND_REFRESH_MIN_GAP_MS)return;
  lastRefreshScheduledAt=now;
  setTimeout(()=>refreshPublicEventMasterForCurrentWeek().catch(error=>console.warn('Public Event Master refresh failed',error)),0);
}
function install(){
  globalThis.addEventListener?.('pokemon-sleep:database-ready',scheduleRefresh);
  globalThis.addEventListener?.('pokemon-sleep:public-event-boundary-crossed',event=>{
    emitWeeklyRefresh('public_event_boundary',event.detail||{});
    scheduleRefresh(); // refresh the manifest after event rollover; no application release required
  });
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{
    if(event.detail?.entity==='weekly_context')schedulePublicEventBoundary({camp:playerCamp()});
  });
  // Visibility resume fetches the network-fresh SHA manifest; no user action is needed.
  if(typeof document!=='undefined')document.addEventListener?.('visibilitychange',()=>{
    if(!document.hidden)scheduleRefresh();
  });
  globalThis.addEventListener?.('pageshow',scheduleRefresh);
  if(isDatabaseReady()&&!isRescueReadonly())scheduleRefresh();
}
install();
