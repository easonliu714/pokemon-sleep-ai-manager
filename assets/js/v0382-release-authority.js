const APP_VERSION='v0.3.86';
const APP_BUILD='20260805-v0386-startup-progress-fail-open';
const STARTED_AT=Date.now();
const SESSION_ID=`boot_${new Date().toISOString().replace(/\D/g,'').slice(0,14)}_${Math.random().toString(16).slice(2,8)}`;
const events=[];
let currentStage='BOOTSTRAP_START';
let currentMessage='正在啟動網頁核心模組';
let currentStatus='running';
let lastProgressAt=Date.now();
let heartbeatTimer=null;
let degradedTimer=null;

function record(event,details={},status='completed',error=null){
  globalThis.UpdateCenterLiveDebug?.record?.(event,details);
  globalThis.DebugTrace?.record?.('release_authority',event,{status,details,error});
}

function ensureTicker(){
  let root=document.getElementById('startupProgressTicker');
  if(root)return root;
  const style=document.createElement('style');
  style.textContent=`
    #startupProgressTicker{position:relative;z-index:30;background:#155f48;color:#fff;border-top:1px solid rgba(255,255,255,.18);font-size:13px}
    #startupProgressTicker .startup-line{display:flex;align-items:center;gap:8px;min-height:34px;padding:6px 12px;overflow:hidden}
    #startupProgressTicker .startup-heartbeat{width:9px;height:9px;border-radius:50%;background:#8ff0b5;box-shadow:0 0 0 0 rgba(143,240,181,.7);animation:startupPulse 1s infinite}
    #startupProgressTicker[data-status="warning"] .startup-heartbeat{background:#ffd66b}
    #startupProgressTicker[data-status="failed"] .startup-heartbeat{background:#ff8b86;animation:none}
    #startupProgressTicker .startup-message{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
    #startupProgressTicker .startup-actions{display:flex;gap:6px;flex-shrink:0}
    #startupProgressTicker button{font-size:12px;padding:4px 8px;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.3)}
    #startupProgressDetails{background:#fff;color:#17372d;padding:10px 12px;max-height:42vh;overflow:auto;border-bottom:1px solid #c9ddd5}
    #startupProgressDetails.hidden{display:none}
    #startupProgressDetails pre{white-space:pre-wrap;font-size:11px;margin:0}
    @keyframes startupPulse{0%{box-shadow:0 0 0 0 rgba(143,240,181,.65)}70%{box-shadow:0 0 0 7px rgba(143,240,181,0)}100%{box-shadow:0 0 0 0 rgba(143,240,181,0)}}
  `;
  document.head.appendChild(style);
  root=document.createElement('section');
  root.id='startupProgressTicker';
  root.dataset.status='running';
  root.innerHTML=`<div class="startup-line"><span class="startup-heartbeat" aria-hidden="true"></span><span id="startupProgressMessage" class="startup-message">正在啟動網頁核心模組</span><span id="startupProgressElapsed">0.0 秒</span><div class="startup-actions"><button id="startupProgressToggle" type="button">展開</button></div></div><div id="startupProgressDetails" class="hidden"><div class="startup-actions"><button id="startupRetryBtn" type="button">重試資料庫</button><button id="startupReadonlyBtn" type="button">唯讀模式</button><button id="startupTraceDownloadBtn" type="button">下載啟動紀錄</button></div><pre id="startupProgressLog"></pre></div>`;
  const header=document.querySelector('header');
  if(header)header.insertAdjacentElement('afterend',root);else document.body.prepend(root);
  document.getElementById('startupProgressToggle').onclick=()=>document.getElementById('startupProgressDetails').classList.toggle('hidden');
  document.getElementById('startupRetryBtn').onclick=()=>location.reload();
  document.getElementById('startupReadonlyBtn').onclick=()=>enterReadonlyMode('使用者手動切換唯讀模式');
  document.getElementById('startupTraceDownloadBtn').onclick=downloadStartupTrace;
  bindFailOpenNavigation();
  return root;
}

function bindFailOpenNavigation(){
  document.querySelectorAll('nav button').forEach(button=>{
    if(button.dataset.startupFallbackBound==='1')return;
    button.dataset.startupFallbackBound='1';
    button.addEventListener('click',()=>{
      if(document.documentElement.dataset.databaseReady==='true')return;
      document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id===button.dataset.view));
      document.querySelectorAll('nav button').forEach(item=>item.classList.toggle('active',item===button));
    });
  });
}

function render(){
  const root=ensureTicker();
  root.dataset.status=currentStatus;
  const elapsed=(Date.now()-STARTED_AT)/1000;
  const stale=(Date.now()-lastProgressAt)/1000;
  const suffix=stale>=3&&currentStatus==='running'?`｜心跳持續，階段 ${stale.toFixed(1)} 秒未變更`:'';
  document.getElementById('startupProgressMessage').textContent=`${currentStatus==='completed'?'✓':currentStatus==='failed'?'✕':currentStatus==='warning'?'⚠':'●'} ${currentMessage}${suffix}`;
  document.getElementById('startupProgressElapsed').textContent=`${elapsed.toFixed(1)} 秒`;
  const log=document.getElementById('startupProgressLog');
  if(log)log.textContent=events.map(item=>`${item.time}  ${item.status.padEnd(9)} ${item.stage}  ${item.message}${item.error?`\n  ${item.error}`:''}`).join('\n');
}

function progress(stage,message,status='running',details={},error=null){
  currentStage=stage;
  currentMessage=message;
  currentStatus=status;
  lastProgressAt=Date.now();
  events.push({time:new Date().toLocaleTimeString('zh-TW',{hour12:false,fractionalSecondDigits:3}),timestamp:new Date().toISOString(),elapsed_ms:Date.now()-STARTED_AT,stage,message,status,details,error:error?.stack||error?.message||error||null});
  render();
  record('startup_progress',{session_id:SESSION_ID,stage,message,elapsed_ms:Date.now()-STARTED_AT,...details},status,error);
}

function enterReadonlyMode(reason){
  document.documentElement.dataset.readonlyMode='true';
  document.documentElement.dataset.databaseReady='false';
  progress('DEGRADED_READONLY',`資料庫尚未就緒｜已進入唯讀模式：${reason}`,'warning',{reason});
  const status=document.getElementById('dbStatus');
  if(status){status.textContent='唯讀模式';status.className='badge pending';}
  bindFailOpenNavigation();
}

function downloadStartupTrace(){
  const payload={session_id:SESSION_ID,app_version:APP_VERSION,app_build:APP_BUILD,started_at:new Date(STARTED_AT).toISOString(),exported_at:new Date().toISOString(),current_stage:currentStage,status:currentStatus,elapsed_ms:Date.now()-STARTED_AT,user_agent:navigator.userAgent,location:location.href,events};
  const href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=href;a.download=`pokemon_sleep_startup_trace_${SESSION_ID}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}

function enforceRuntimeAuthority(){
  document.documentElement.dataset.appVersion=APP_VERSION;
  document.documentElement.dataset.appBuild=APP_BUILD;
  const badge=document.getElementById('appVersion');
  if(badge){badge.textContent=`版本 ${APP_VERSION}`;badge.dataset.versionAuthority='v0386-startup-progress';badge.title=`Pokémon Sleep AI Manager ${APP_VERSION} / ${APP_BUILD}`;}
  globalThis.PokemonSleepRuntimeVersion=Object.freeze({app_version:APP_VERSION,app_build:APP_BUILD});
}

async function registerServiceWorker(){
  progress('SERVICE_WORKER_CHECK','正在檢查離線快取與 Service Worker');
  if(!('serviceWorker' in navigator)){progress('SERVICE_WORKER_UNSUPPORTED','瀏覽器不支援 Service Worker，改用線上模式','warning');return null;}
  const url=new URL('../../service-worker-v0386.js',import.meta.url);
  try{
    const scope=new URL('../../',import.meta.url).pathname;
    const registration=await navigator.serviceWorker.register(url,{scope,updateViaCache:'none'});
    if(typeof registration?.update==='function')await registration.update();
    progress('SERVICE_WORKER_READY','離線快取檢查完成','running',{scope:registration?.scope||scope});
    return registration||null;
  }catch(error){progress('SERVICE_WORKER_FAILED',`Service Worker 失敗：${error?.message||error}`,'warning',{},error);return null;}
}

ensureTicker();
progress('BOOTSTRAP_START','正在啟動網頁核心模組');
enforceRuntimeAuthority();
heartbeatTimer=setInterval(render,1000);
degradedTimer=setTimeout(()=>{
  if(document.documentElement.dataset.databaseReady!=='true')enterReadonlyMode('啟動超過 8 秒，背景初始化仍在進行');
},8000);

globalThis.addEventListener('pokemon-sleep:startup-progress',event=>{
  const detail=event.detail||{};
  progress(detail.stage||'UNKNOWN',detail.message||detail.stage||'處理中',detail.status||'running',detail.details||{},detail.error||null);
});
globalThis.addEventListener('pokemon-sleep:database-ready',event=>{
  document.documentElement.dataset.databaseReady='true';
  clearTimeout(degradedTimer);
  progress('DATABASE_READY','SQLite 已就緒，正在完成畫面資料載入','running',event.detail||{});
});
globalThis.addEventListener('pokemon-sleep:app-ready',event=>{
  document.documentElement.dataset.databaseReady='true';
  clearTimeout(degradedTimer);
  progress('APP_READY','系統已就緒','completed',event.detail||{});
  const status=document.getElementById('dbStatus');if(status){status.textContent='SQLite 已就緒';status.className='badge';}
  setTimeout(()=>{const root=document.getElementById('startupProgressTicker');if(root)root.style.opacity='.88';},5000);
});
globalThis.addEventListener('error',event=>progress('RUNTIME_ERROR',event.message||'JavaScript 執行錯誤','failed',{},event.error||event.message));
globalThis.addEventListener('unhandledrejection',event=>progress('UNHANDLED_REJECTION',event.reason?.message||String(event.reason||'Promise 執行失敗'),'failed',{},event.reason));

const registrationPromise=registerServiceWorker();
globalThis.PokemonSleepStartupProgress=Object.freeze({app_version:APP_VERSION,app_build:APP_BUILD,session_id:SESSION_ID,progress,enterReadonlyMode,downloadStartupTrace,registrationPromise});
record('v0386_startup_progress_ready',{app_version:APP_VERSION,build:APP_BUILD,session_id:SESSION_ID});

export {APP_VERSION,APP_BUILD,enforceRuntimeAuthority,registerServiceWorker,progress,enterReadonlyMode,downloadStartupTrace};
