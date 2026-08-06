import './version-authority.js';
import {debugTrace} from './debug-trace-manager.js';

const authority=globalThis.PokemonSleepVersionAuthority;
const STAGE_KEY='pokemon_sleep_last_startup_stage_v1';
const RELOAD_KEY=`pokemon_sleep_version_reload_${authority.app_build}`;
let lastStage=null;
let lastStageAt=performance.now();
let heartbeatAt=performance.now();
let watchdogTimer=null;

function recordStage(detail={}){
  lastStage=detail.stage||'UNKNOWN';
  lastStageAt=performance.now();
  try{sessionStorage.setItem(STAGE_KEY,JSON.stringify({stage:lastStage,at:new Date().toISOString(),build:authority.app_build,detail}));}catch{}
  debugTrace.record('startup','startup_stage',{status:detail.status||'completed',details:{...detail,authority}});
}

addEventListener('pokemon-sleep:startup-progress',event=>recordStage(event.detail||{}));

function startHeartbeat(){
  const beat=()=>{heartbeatAt=performance.now();requestAnimationFrame(beat);};
  requestAnimationFrame(beat);
  watchdogTimer=setInterval(()=>{
    const now=performance.now();
    const blockedFor=Math.round(now-heartbeatAt);
    const stageAge=Math.round(now-lastStageAt);
    if(blockedFor<4000)return;
    const warning=document.getElementById('storageWarning');
    if(warning){
      warning.textContent=`啟動階段 ${lastStage||'unknown'} 已阻塞約 ${Math.round(blockedFor/1000)} 秒。系統已停止自動重試；請保留本機資料並匯出診斷 JSON。`;
      warning.classList.remove('hidden');
    }
    debugTrace.record('startup','main_thread_block_detected',{status:'warning',details:{stage:lastStage,blocked_ms:blockedFor,stage_age_ms:stageAge,authority}});
  },2000);
}
startHeartbeat();
addEventListener('pagehide',()=>clearInterval(watchdogTimer),{once:true});

export async function enforceLiveVersionHandoff(){
  if(!('serviceWorker' in navigator))return {supported:false};
  const registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
  await registration.update().catch(()=>{});
  const active=registration.active;
  const controller=navigator.serviceWorker.controller;
  debugTrace.record('service_worker','version_handoff_checked',{status:'completed',details:{authority,active:Boolean(active),controlled:Boolean(controller)}});
  if(!controller&&active){
    const alreadyReloaded=sessionStorage.getItem(RELOAD_KEY)==='1';
    if(!alreadyReloaded){sessionStorage.setItem(RELOAD_KEY,'1');location.reload();return {reloading:true};}
  }
  return {supported:true,controlled:Boolean(controller)};
}

export function getLastStartupStage(){
  try{return JSON.parse(sessionStorage.getItem(STAGE_KEY)||'null');}catch{return null;}
}
