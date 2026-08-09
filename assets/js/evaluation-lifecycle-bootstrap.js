import {isDatabaseReady} from './database.js';
import {nextLocalWeekBoundary} from './evaluation-week.js';
import {refreshEvaluationLifecycle,EVALUATION_LIFECYCLE_VERSION} from './evaluation-lifecycle.js';

let installed=false,scheduled=false,running=false,boundaryTimer=null;
let pendingAll=false;
const pendingIds=new Set(),pendingReasons=new Set();

function publicState(result){
  return Object.freeze({
    lifecycle_version:result?.lifecycle_version||EVALUATION_LIFECYCLE_VERSION,
    status:result?.status||'UNKNOWN',reason:result?.reason||null,week_epoch:result?.week_epoch||null,
    context_id:result?.context_id||null,goal_profile_id:result?.goal_profile_id||null,
    target_count:Number(result?.target_count||0),refresh_count:Number(result?.refresh_count||0),reused_count:Number(result?.reused_count||0),stale_count:Number(result?.stale_count||0),
    created:Number(result?.created||0),reused:Number(result?.reused||0),staled:Number(result?.staled||0),skipped:Number(result?.skipped||0),
    refresh_required:Boolean(result?.refresh_required),write_performed:Boolean(result?.write_performed),snapshot_created:Boolean(result?.snapshot_created),
    player_rows_modified:false,
  });
}
function emit(result){
  const state=publicState(result);
  globalThis.PokemonSleepEvaluationLifecycleState=state;
  window.dispatchEvent(new CustomEvent('pokemon-sleep:evaluation-lifecycle-state',{detail:state}));
}
function scheduleDrain(){
  if(scheduled)return;scheduled=true;
  queueMicrotask(()=>{scheduled=false;void drain();});
}
export function requestEvaluationLifecycle({reason='runtime_event',pokemonIds=null}={}){
  if(Array.isArray(pokemonIds)&&pokemonIds.length){for(const id of pokemonIds)if(id!==null&&id!==undefined&&String(id))pendingIds.add(String(id));}
  else pendingAll=true;
  pendingReasons.add(String(reason||'runtime_event'));
  scheduleDrain();
}
async function drain(){
  if(running||!isDatabaseReady())return;
  running=true;
  const all=pendingAll,ids=all?null:[...pendingIds],reason=[...pendingReasons].sort().join('+')||'runtime_event';
  pendingAll=false;pendingIds.clear();pendingReasons.clear();
  try{emit(await refreshEvaluationLifecycle({reason,pokemonIds:ids}));}
  catch(error){emit({lifecycle_version:EVALUATION_LIFECYCLE_VERSION,status:'ERROR',reason,write_performed:false,snapshot_created:false,player_rows_modified:false,error_code:error?.name||'Error'});}
  finally{running=false;if(pendingAll||pendingIds.size||pendingReasons.size)scheduleDrain();}
}
function scheduleWeekBoundary(){
  if(boundaryTimer!==null)clearTimeout(boundaryTimer);
  const now=new Date(),next=nextLocalWeekBoundary(now),delay=Math.max(1000,next.getTime()-now.getTime()+1000);
  boundaryTimer=setTimeout(()=>{
    requestEvaluationLifecycle({reason:'local_week_epoch_boundary'});
    scheduleWeekBoundary();
  },Math.min(delay,2147483647));
}
function install(){
  if(installed||typeof window==='undefined')return;installed=true;
  window.addEventListener('pokemon-sleep:database-ready',()=>requestEvaluationLifecycle({reason:'database_ready'}));
  window.addEventListener('pokemon-sleep:strategy-goal-profile-changed',()=>requestEvaluationLifecycle({reason:'goal_profile_changed'}));
  window.addEventListener('pokemon-sleep:pokemon-evaluation-input-changed',event=>requestEvaluationLifecycle({reason:event.detail?.reason||'pokemon_input_changed',pokemonIds:event.detail?.pokemon_ids||null}));
  document.addEventListener('pokemon-sleep-data-refreshed',()=>requestEvaluationLifecycle({reason:'data_refreshed_preflight'}));
  scheduleWeekBoundary();
  if(isDatabaseReady())requestEvaluationLifecycle({reason:'bootstrap_database_already_ready'});
}
install();
