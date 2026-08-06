import {cancelForcedDatabaseLoad,isRescueReadonly} from './database.js';

const BUILD='20260806-v0390-worker-isolated-legacy-sqlite-load';
let active=false;

function ensureButton(){
  let button=document.getElementById('v0390CancelSqliteLoad');
  if(button)return button;
  button=document.createElement('button');
  button.id='v0390CancelSqliteLoad';
  button.textContent='取消載入玩家資料';
  button.hidden=true;
  button.style.cssText='position:fixed;right:12px;bottom:18px;z-index:10000;padding:12px 16px;border-radius:999px;border:0;background:#8d3f3f;color:white;font-weight:700;box-shadow:0 4px 16px #0003';
  button.onclick=()=>{
    cancelForcedDatabaseLoad();
    button.disabled=true;
    button.textContent='正在取消…';
    setTimeout(()=>location.reload(),250);
  };
  document.body.appendChild(button);
  return button;
}

function onProgress(event){
  const stage=event.detail?.stage||'';
  const button=ensureButton();
  active=['LEGACY_DB_WORKER_STARTING','WORKER_STARTING','LEGACY_DB_READING','LEGACY_DB_WORKER_HEARTBEAT','LEGACY_DB_TRANSFER'].includes(stage);
  if(['LEGACY_DB_TRANSFERRED','LEGACY_DB_TOO_LARGE','LEGACY_DB_LOAD_CANCELLED','DATABASE_RESCUE_REQUIRED','DATABASE_READY','APP_READY'].includes(stage))active=false;
  button.hidden=!active;
  if(!active){button.disabled=false;button.textContent='取消載入玩家資料';}
}

function install(){
  ensureButton();
  window.addEventListener('pokemon-sleep:startup-progress',onProgress);
  window.addEventListener('pokemon-sleep:database-ready',()=>{active=false;ensureButton().hidden=true;});
  if(isRescueReadonly())ensureButton().hidden=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
globalThis.PokemonSleepV0390WorkerLoadControl=Object.freeze({build:BUILD});
