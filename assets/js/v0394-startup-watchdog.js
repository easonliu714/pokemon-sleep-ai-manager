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
// A live 2s timer proves JS can run even when Chromium throttles visible-page RAF.
// Only a delayed timer AND missing RAF indicate a main-thread scheduling gap.
let lastIntervalTickAt=performance.now();
// A resumed RAF can run before an overdue interval and erase the RAF gap.
// Preserve that evidence only until the independently delayed timer checks it.
let pendingRafFirstGapMs=0;
let watchdogTimer=null;
let heartbeatGeneration=0;
let warningActive=false;
let recoveryStableFrames=0;
let stallSnapshot=null;
let lastWarningText='';
let pageHydrationHideTimer=null;
let visibilityGraceUntil=performance.now()+1200;
// G295: a timer may observe a visibility transition even if the event was missed.
let lastObservedVisibility=document.visibilityState;
const PAGE_LABELS=Object.freeze({updates:'更新中心',knowledge:'資料百科',items:'道具',ingredients:'食材',recipes:'食譜',backup:'備份還原',pokemon:'寶可夢',guide:'使用說明',diagnostics:'診斷中心'});
const activeView=()=>document.querySelector('.view.active')?.id||'';
function renderPageHydrationProgress(detail={}){
  const badge=document.getElementById('pageLoadStatus');if(!badge)return;
  const page=String(detail.page||'').trim(),state=String(detail.state||'loading').trim();
  const label=detail.label||PAGE_LABELS[page]||page||'分頁';
  const message=detail.message||`${label}：${state==='ready'?'載入完成':'本機資料載入中…'}`;
  const visiblePage=activeView();
  if(page&&visiblePage&&page!==visiblePage){
    recordStage({stage:`PAGE_HYDRATION_${page||'UNKNOWN'}_${state.toUpperCase()}`,message,status:state==='failed'?'failed':state==='ready'?'completed':'running',details:{page,state,source:'page-hydration-watchdog',offscreen:true,active_page:visiblePage}});
    return;
  }
  clearTimeout(pageHydrationHideTimer);
  badge.textContent=message;badge.classList.remove('hidden','ok','pending','error');
  badge.classList.add(state==='failed'?'error':state==='ready'?'ok':'pending');
  badge.dataset.page=page;badge.dataset.pageHydrationState=state;
  recordStage({stage:`PAGE_HYDRATION_${page||'UNKNOWN'}_${state.toUpperCase()}`,message,status:state==='failed'?'failed':state==='ready'?'completed':'running',details:{page,state,source:'page-hydration-watchdog'}});
  if(state==='ready')pageHydrationHideTimer=setTimeout(()=>badge.classList.add('hidden'),1800);
}

function recordStage(detail={}){
  lastStage=detail.stage||'UNKNOWN';
  lastStageAt=performance.now();
  try{sessionStorage.setItem(STAGE_KEY,JSON.stringify({stage:lastStage,at:new Date().toISOString(),build:authority.app_build,detail}));}catch{}
  debugTrace.record('startup','startup_stage',{status:detail.status||'completed',details:{...detail,authority}});
}
addEventListener('pokemon-sleep:startup-progress',event=>recordStage(event.detail||{}));
addEventListener('pokemon-sleep:page-hydration-progress',event=>renderPageHydrationProgress(event.detail||{}));

export function formatStartupHeartbeatWarning({checkpoint='unknown',blocked_ms=0}={}){
  const seconds=Math.max(0,Math.round(Number(blocked_ms||0)/1000));
  return `主執行緒 heartbeat 已停滯約 ${seconds} 秒；最後 startup checkpoint：${checkpoint||'unknown'}（僅表示最後記錄位置，不代表阻塞原因）。系統不會因慢啟動自動切換唯讀；請保留本機資料並匯出診斷 JSON。`;
}
function showHeartbeatWarning({blockedFor,stageAge}){
  // One continuous stall is one diagnostic episode until stable RAF recovery.
  // Delayed interval callbacks may extend the maximum without a second alert.
  const firstDetection=!warningActive;
  warningActive=true;recoveryStableFrames=0;
  const snapshot={checkpoint:lastStage||'unknown',blocked_ms:blockedFor,stage_age_ms:stageAge,detected_at:new Date().toISOString()};
  if(!stallSnapshot)stallSnapshot=snapshot;else if(blockedFor>Number(stallSnapshot.blocked_ms||0))stallSnapshot={...stallSnapshot,blocked_ms:blockedFor,stage_age_ms:stageAge};
  const warning=document.getElementById('storageWarning');
  const previousWatchdogText=lastWarningText;
  lastWarningText=formatStartupHeartbeatWarning({checkpoint:stallSnapshot.checkpoint,blocked_ms:stallSnapshot.blocked_ms});
  if(warning){
    // G295: a foreground stall must not erase an already-visible storage/data
    // warning owned by another subsystem. Keep diagnostic evidence regardless.
    const watchdogOwnsVisible=warning.dataset.startupWatchdogWarning===WATCHDOG_MARKER&&warning.textContent===previousWatchdogText;
    const foreignVisible=!warning.classList.contains('hidden')&&!watchdogOwnsVisible;
    if(!foreignVisible){
      warning.textContent=lastWarningText;
      warning.dataset.startupWatchdogWarning=WATCHDOG_MARKER;
      warning.classList.remove('hidden');
    }else if(firstDetection){
      debugTrace.record('startup','main_thread_watchdog_external_warning_preserved',{status:'warning',details:{last_checkpoint:snapshot.checkpoint,display_owned:false,authority}});
    }
  }
  if(firstDetection)debugTrace.record('startup','main_thread_block_detected',{status:'warning',details:{last_checkpoint:snapshot.checkpoint,checkpoint_is_causal:false,blocked_ms:blockedFor,stage_age_ms:stageAge,authority,authority_switch:false,automatic_retry_restarted:false}});
}
// Lifecycle resets cancel an unverified stall episode; only stable RAF frames
// prove recovery. Keep these diagnostics distinct without touching player state.
function clearRecoveredHeartbeatWarning({interruptedBy=null}={}){
  if(!warningActive)return false;
  const snapshot=stallSnapshot;warningActive=false;recoveryStableFrames=0;stallSnapshot=null;
  const warning=document.getElementById('storageWarning');
  let warningCleared=false;
  if(warning?.dataset?.startupWatchdogWarning===WATCHDOG_MARKER){
    if(warning.textContent===lastWarningText){
      warning.classList.add('hidden');warning.textContent='';warningCleared=true;
    }
    delete warning.dataset.startupWatchdogWarning;
  }
  debugTrace.record('startup',interruptedBy?'main_thread_watchdog_lifecycle_interrupted':'main_thread_block_recovered',{status:'completed',details:{last_checkpoint:snapshot?.checkpoint||lastStage||'unknown',checkpoint_is_causal:false,max_blocked_ms:Number(snapshot?.blocked_ms||0),warning_cleared:warningCleared,...(interruptedBy?{reason:interruptedBy}:{}),authority_switch:false,automatic_retry_restarted:false,authority}});
  // Return the actual DOM ownership outcome: a foreign storage warning stays visible.
  // The visibility-reset trace must not claim that the watchdog cleared it.
  lastWarningText='';return warningCleared;
}
function resetHeartbeatForVisibility(reason){
  const now=performance.now();
  lastObservedVisibility=document.visibilityState;
  heartbeatAt=now;
  lastIntervalTickAt=now;
  pendingRafFirstGapMs=0;
  recoveryStableFrames=0;
  visibilityGraceUntil=now+1200;
  const warningCleared=warningActive?clearRecoveredHeartbeatWarning({interruptedBy:reason}):false;
  debugTrace.record('startup','main_thread_watchdog_visibility_reset',{status:'completed',details:{reason,visibility:document.visibilityState,warning_cleared:warningCleared,grace_ms:1200,authority}});
}
function startHeartbeat(){
  if(watchdogTimer!==null)return;
  lastIntervalTickAt=performance.now();
  const generation=++heartbeatGeneration;
  // A missed visibilitychange can leave RAF running briefly after backgrounding.
  // Hidden RAF frames are NOT proof of foreground main-thread recovery.
  const beat=()=>{
    if(generation!==heartbeatGeneration)return;
    const now=performance.now(),observedVisibility=document.visibilityState;
    if(observedVisibility!=='visible'){
      if(lastObservedVisibility==='visible')resetHeartbeatForVisibility('raf-observed-background');
      lastObservedVisibility=observedVisibility;
      heartbeatAt=now;
      requestAnimationFrame(beat);
      return;
    }
    if(lastObservedVisibility!=='visible'){
      resetHeartbeatForVisibility('raf-observed-foreground');
      requestAnimationFrame(beat);
      return;
    }
    const gap=now-heartbeatAt;
    // RAF may be the first callback after a real foreground scheduling stall.
    // Do not let it erase a delayed RAF gap before the timer independently
    // verifies that it too missed its scheduled execution window.
    if(gap>=STARTUP_BLOCK_WARN_MS&&now-lastIntervalTickAt>=STARTUP_BLOCK_WARN_MS)
      pendingRafFirstGapMs=Math.max(pendingRafFirstGapMs,gap);
    heartbeatAt=now;
    if(warningActive){
      recoveryStableFrames=gap<1000?recoveryStableFrames+1:0;
      if(recoveryStableFrames>=RECOVERY_STABLE_FRAMES)clearRecoveredHeartbeatWarning();
    }
    requestAnimationFrame(beat);
  };
  requestAnimationFrame(beat);
  watchdogTimer=setInterval(()=>{
    const now=performance.now();
    const timerGap=now-lastIntervalTickAt;
    lastIntervalTickAt=now;
    // An observed hidden timer tick is independent evidence of backgrounding,
    // even when Chromium omitted visibilitychange. Never treat its later gap
    // as a verified foreground main-thread stall.
    const observedVisibility=document.visibilityState;
    if(observedVisibility!=='visible'){
      if(lastObservedVisibility==='visible')resetHeartbeatForVisibility('timer-observed-background');
      lastObservedVisibility=observedVisibility;
      heartbeatAt=now;
      return;
    }
    if(lastObservedVisibility!=='visible'){
      resetHeartbeatForVisibility('timer-observed-foreground');
      return;
    }
    if(now<visibilityGraceUntil){heartbeatAt=now;pendingRafFirstGapMs=0;return;}
    const blockedFor=Math.round(Math.max(now-heartbeatAt,pendingRafFirstGapMs)),stageAge=Math.round(now-lastStageAt);
    pendingRafFirstGapMs=0;
    // RAF can pause independently of the main thread (occlusion/power saving).
    // A regularly executing timer is positive responsiveness evidence; a genuine
    // long scheduling gap remains detectable after the normal lifecycle grace.
    if(blockedFor<STARTUP_BLOCK_WARN_MS||timerGap<STARTUP_BLOCK_WARN_MS)return;
    showHeartbeatWarning({blockedFor,stageAge});
  },2000);
}
startHeartbeat();
document.addEventListener('visibilitychange',()=>resetHeartbeatForVisibility(document.visibilityState==='visible'?'foreground-resume':'background-pause'));
// Chromium Page Lifecycle can freeze/resume a PWA without a paired visibilitychange,
// pageshow or focus event. A suspended timer gap must never be reported as a
// foreground main-thread stall; the existing 1200ms grace and detector remain.
document.addEventListener('freeze',()=>resetHeartbeatForVisibility('page-freeze'));
document.addEventListener('resume',()=>resetHeartbeatForVisibility('page-resume'));
document.querySelector('nav')?.addEventListener('click',event=>{
  const targetPage=event.target?.closest?.('button[data-view]')?.dataset?.view;
  const badge=document.getElementById('pageLoadStatus');
  if(targetPage&&badge?.dataset?.page&&badge.dataset.page!==targetPage){
    clearTimeout(pageHydrationHideTimer);
    badge.classList.add('hidden');
    debugTrace.record('startup','page_hydration_badge_stale_cleared',{status:'completed',details:{from_page:badge.dataset.page,to_page:targetPage,authority}});
  }
});
// G295: BFCache restores need a fresh timer/RAF generation; focus and native-dialog
// returns reset only the watchdog clock, never player state or application results.
addEventListener('pagehide',()=>{
  // G295: pagehide may suspend into BFCache without visibilitychange. Cancel
  // a foreground stall immediately; a suspended page is not RAF-recovered.
  resetHeartbeatForVisibility('pagehide-suspend');
  clearInterval(watchdogTimer);
  watchdogTimer=null;
  heartbeatGeneration++;
});
addEventListener('pageshow',()=>{
  resetHeartbeatForVisibility('pageshow-resume');
  startHeartbeat();
});
addEventListener('focus',()=>{
  if(document.visibilityState==='visible')resetHeartbeatForVisibility('focus-resume');
});
for(const name of ['alert','confirm','prompt']){
  const native=globalThis[name];
  if(typeof native!=='function')continue;
  const guarded=function(...args){
    try{return Reflect.apply(native,globalThis,args);}
    finally{resetHeartbeatForVisibility('native-dialog-return:'+name);}
  };
  try{globalThis[name]=guarded;}catch{
    debugTrace.record('startup','main_thread_watchdog_dialog_guard_unavailable',{status:'warning',details:{name,authority}});
  }
}

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
