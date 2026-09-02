import './version-authority.js';
import './confirmation-first-render-authority-v042732.js';
import './per-image-runtime-context-v042733.js';
import './revision-bound-target-context-v042734.js';
import {debugTrace} from './debug-trace-manager.js';

const authority=globalThis.PokemonSleepVersionAuthority;
const STAGE_KEY='pokemon_sleep_last_startup_stage_v1';
const RELOAD_KEY=`pokemon_sleep_version_reload_${authority.app_build}`;
const STARTUP_BLOCK_WARN_MS=4000;
const RECOVERY_STABLE_FRAMES=30;
const WATCHDOG_MARKER='startup-heartbeat-watchdog';
let lastStage=null;
let lastStageAt=performance.now();
let heartbeatAt=performance.now();
let watchdogTimer=null;
let warningActive=false;
let recoveryStableFrames=0;
let stallSnapshot=null;
let lastWarningText='';

function recordStage(detail={}){
  lastStage=detail.stage||'UNKNOWN';
  lastStageAt=performance.now();
  try{sessionStorage.setItem(STAGE_KEY,JSON.stringify({stage:lastStage,at:new Date().toISOString(),build:authority.app_build,detail}));}catch{}
  debugTrace.record('startup','startup_stage',{status:detail.status||'completed',details:{...detail,authority}});
}
addEventListener('pokemon-sleep:startup-progress',event=>recordStage(event.detail||{}));

export function formatStartupHeartbeatWarning({checkpoint='unknown',blocked_ms=0}={}){
  const seconds=Math.max(0,Math.round(Number(blocked_ms||0)/1000));
  return `主執行緒 heartbeat 已停滯約 ${seconds} 秒；最後 startup checkpoint：${checkpoint||'unknown'}（僅表示最後記錄位置，不代表阻塞原因）。系統不會因慢啟動自動切換唯讀；請保留本機資料並匯出診斷 JSON。`;
}
function showHeartbeatWarning({blockedFor,stageAge}){
  warningActive=true;recoveryStableFrames=0;
  const snapshot={checkpoint:lastStage||'unknown',blocked_ms:blockedFor,stage_age_ms:stageAge,detected_at:new Date().toISOString()};
  if(!stallSnapshot)stallSnapshot=snapshot;else if(blockedFor>Number(stallSnapshot.blocked_ms||0))stallSnapshot={...stallSnapshot,blocked_ms:blockedFor,stage_age_ms:stageAge};
  const warning=document.getElementById('storageWarning');
  lastWarningText=formatStartupHeartbeatWarning({checkpoint:snapshot.checkpoint,blocked_ms:blockedFor});
  if(warning){warning.textContent=lastWarningText;warning.dataset.startupWatchdogWarning=WATCHDOG_MARKER;warning.classList.remove('hidden');}
  debugTrace.record('startup','main_thread_block_detected',{status:'warning',details:{last_checkpoint:snapshot.checkpoint,checkpoint_is_causal:false,blocked_ms:blockedFor,stage_age_ms:stageAge,authority,authority_switch:false}});
}
function clearRecoveredHeartbeatWarning(){
  if(!warningActive)return false;
  const snapshot=stallSnapshot;warningActive=false;recoveryStableFrames=0;stallSnapshot=null;
  const warning=document.getElementById('storageWarning');
  if(warning?.dataset?.startupWatchdogWarning===WATCHDOG_MARKER){if(warning.textContent===lastWarningText){warning.classList.add('hidden');warning.textContent='';}delete warning.dataset.startupWatchdogWarning;}
  debugTrace.record('startup','main_thread_block_recovered',{status:'completed',details:{last_checkpoint:snapshot?.checkpoint||lastStage||'unknown',checkpoint_is_causal:false,max_blocked_ms:Number(snapshot?.blocked_ms||0),warning_cleared:true,authority_switch:false,authority}});
  lastWarningText='';return true;
}
function startHeartbeat(){
  const beat=()=>{const now=performance.now(),gap=now-heartbeatAt;heartbeatAt=now;if(warningActive){recoveryStableFrames=gap<1000?recoveryStableFrames+1:0;if(recoveryStableFrames>=RECOVERY_STABLE_FRAMES)clearRecoveredHeartbeatWarning();}requestAnimationFrame(beat);};
  requestAnimationFrame(beat);
  watchdogTimer=setInterval(()=>{const now=performance.now();const blockedFor=Math.round(now-heartbeatAt);const stageAge=Math.round(now-lastStageAt);if(blockedFor<STARTUP_BLOCK_WARN_MS)return;showHeartbeatWarning({blockedFor,stageAge});},2000);
}
startHeartbeat();
addEventListener('pagehide',()=>clearInterval(watchdogTimer),{once:true});

function scheduleBackgroundServiceWorkerUpdate(registration){
  if(!registration||typeof registration.update!=='function')return;
  const run=async()=>{
    const started=performance.now();
    debugTrace.record('service_worker','version_handoff_update_background_started',{status:'started',details:{authority}});
    try{await registration.update();debugTrace.record('service_worker','version_handoff_update_background_completed',{status:'completed',details:{authority,elapsed_ms:Math.round(performance.now()-started)}});}catch(error){debugTrace.record('service_worker','version_handoff_update_background_failed',{status:'warning',details:{authority,elapsed_ms:Math.round(performance.now()-started)},error});}
  };
  if(typeof requestIdleCallback==='function')requestIdleCallback(()=>void run(),{timeout:3000});else setTimeout(()=>void run(),0);
}

export async function enforceLiveVersionHandoff(){
  if(!('serviceWorker' in navigator))return {supported:false};
  let registration=null;
  try{registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});}catch(error){debugTrace.record('service_worker','version_handoff_registration_failed',{status:'blocked',details:{authority},error});return {supported:true,registered:false,controlled:Boolean(navigator.serviceWorker.controller)};}
  const active=registration?.active||null;
  const controller=navigator.serviceWorker.controller;
  debugTrace.record('service_worker','version_handoff_checked',{status:'completed',details:{authority,registered:Boolean(registration),active:Boolean(active),controlled:Boolean(controller),update_on_critical_path:false}});
  if(!controller&&active){const alreadyReloaded=sessionStorage.getItem(RELOAD_KEY)==='1';if(!alreadyReloaded){sessionStorage.setItem(RELOAD_KEY,'1');location.reload();return {reloading:true};}}
  scheduleBackgroundServiceWorkerUpdate(registration);
  return {supported:true,registered:Boolean(registration),controlled:Boolean(controller),update_on_critical_path:false};
}
export function getLastStartupStage(){try{return JSON.parse(sessionStorage.getItem(STAGE_KEY)||'null');}catch{return null;}}
export function getStartupWatchdogState(){return {last_checkpoint:lastStage,warning_active:warningActive,recovery_stable_frames:recoveryStableFrames,stall_snapshot:stallSnapshot?{...stallSnapshot}:null};}
