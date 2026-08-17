import {isDatabaseReady,isRescueReadonly} from './database.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {refreshPublicEventMaster,schedulePublicEventBoundary} from './public-event-master-store.js';

export const PUBLIC_EVENT_MASTER_BOOTSTRAP_VERSION='public-event-master-bootstrap-2026-08-17-a';

let refreshPromise=null;
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
function scheduleRefresh(){setTimeout(()=>refreshPublicEventMasterForCurrentWeek().catch(error=>console.warn('Public Event Master refresh failed',error)),0);}
function install(){
  globalThis.addEventListener?.('pokemon-sleep:database-ready',scheduleRefresh);
  globalThis.addEventListener?.('pokemon-sleep:public-event-boundary-crossed',event=>{
    emitWeeklyRefresh('public_event_boundary',event.detail||{});
  });
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{
    if(event.detail?.entity==='weekly_context')schedulePublicEventBoundary({camp:playerCamp()});
  });
  if(isDatabaseReady()&&!isRescueReadonly())scheduleRefresh();
}
install();
