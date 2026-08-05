import './v0382-image-byte-snapshot.js';

const ACCESS_MODE='development-open';
const DEVELOPMENT_OPEN=ACCESS_MODE==='development-open';
// Only true diagnostics are admin-gated. Identity review is a normal player data-governance tool.
const DEBUG_LABELS=new Set(['診斷中心']);
let authenticated=DEVELOPMENT_OPEN;
let observer=null;

function isDebugNode(node){
  if(!(node instanceof Element))return false;
  if(node.matches('[data-debug-feature],.debug-only'))return true;
  return node.matches('nav button')&&DEBUG_LABELS.has(node.textContent.trim());
}
function applyGate(root=document){
  const nodes=[];
  if(root instanceof Element&&isDebugNode(root))nodes.push(root);
  root.querySelectorAll?.('[data-debug-feature],.debug-only,nav button').forEach(node=>{if(isDebugNode(node))nodes.push(node);});
  nodes.forEach(node=>{
    node.hidden=!authenticated;
    node.classList.toggle('hidden',!authenticated);
    node.setAttribute('aria-hidden',authenticated?'false':'true');
  });
  document.documentElement.dataset.adminAuthenticated=authenticated?'true':'false';
  document.documentElement.dataset.adminAccessMode=ACCESS_MODE;
}
async function loadDebugModules(){
  if(!authenticated||globalThis.PokemonSleepAdminDebugLoaded)return;
  globalThis.PokemonSleepAdminDebugLoaded=true;
  try{await import('./update-center-live-debug.js');}
  catch(error){console.error('Admin debug module load failed',error);globalThis.PokemonSleepAdminDebugLoaded=false;}
}
function renderAdminPanel(){
  const host=document.getElementById('adminAuthPanel');if(!host)return;
  host.innerHTML='<h3>進階管理模式</h3><p class="notice success">目前為開發模式：診斷與除錯介面已直接開放，不需要管理密碼。寶可夢身份覆核等資料治理功能仍屬一般工具。正式發布前會再切換為密碼保護。</p>';
}
function initialize(){
  applyGate();renderAdminPanel();loadDebugModules();
  observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof Element){applyGate(node);if(node.id==='adminAuthPanel')renderAdminPanel();}})));
  observer.observe(document.documentElement,{subtree:true,childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
globalThis.PokemonSleepAdminAuth=Object.freeze({isAuthenticated:()=>authenticated,isDevelopmentOpen:()=>DEVELOPMENT_OPEN,accessMode:()=>ACCESS_MODE,applyGate,logout:()=>{authenticated=DEVELOPMENT_OPEN;applyGate();renderAdminPanel();}});
