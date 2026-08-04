const CONFIG_KEY='pokemon-sleep-local-admin-auth/1.0';
const SESSION_KEY='pokemon-sleep-local-admin-session/1.0';
const ITERATIONS=210000;
// Only true diagnostics are admin-gated. Identity review is a normal player data-governance tool.
const DEBUG_LABELS=new Set(['診斷中心']);
let authenticated=sessionStorage.getItem(SESSION_KEY)==='authenticated';
let observer=null;

const encode=(bytes)=>btoa(String.fromCharCode(...bytes));
const decode=(value)=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
async function derive(password,salt,iterations=ITERATIONS){
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,256);
  return new Uint8Array(bits);
}
function loadConfig(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'null');}catch{return null;}}
function sameBytes(left,right){if(left.length!==right.length)return false;let diff=0;for(let i=0;i<left.length;i+=1)diff|=left[i]^right[i];return diff===0;}
function isDebugNode(node){
  if(!(node instanceof Element))return false;
  if(node.matches('[data-debug-feature],.debug-only'))return true;
  if(node.matches('nav button')&&DEBUG_LABELS.has(node.textContent.trim()))return true;
  return false;
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
}
async function loadDebugModules(){
  if(!authenticated||globalThis.PokemonSleepAdminDebugLoaded)return;
  globalThis.PokemonSleepAdminDebugLoaded=true;
  try{await import('./update-center-live-debug.js');}
  catch(error){console.error('Admin debug module load failed',error);globalThis.PokemonSleepAdminDebugLoaded=false;}
}
function statusMessage(text,type='notice'){
  const host=document.getElementById('adminAuthStatus');if(!host)return;
  host.textContent=text;host.className=type;
}
function renderAdminPanel(){
  const host=document.getElementById('adminAuthPanel');if(!host)return;
  const config=loadConfig();
  if(authenticated){
    host.innerHTML='<h3>進階管理模式</h3><p class="notice success">本分頁工作階段已登入。診斷與除錯介面已開放；關閉分頁後會自動登出。</p><div class="buttons"><button id="adminLogoutBtn" type="button">登出管理模式</button></div><p id="adminAuthStatus" class="notice"></p>';
    host.querySelector('#adminLogoutBtn').onclick=()=>{sessionStorage.removeItem(SESSION_KEY);authenticated=false;applyGate();renderAdminPanel();};
    return;
  }
  host.innerHTML=`<h3>進階管理模式</h3><p class="notice">管理密碼只在此裝置保存不可逆雜湊，不會寫入備份 JSON、GitHub 或除錯紀錄。登入只維持目前分頁工作階段。寶可夢身份覆核等一般工具不需要管理登入。</p>
  <form id="adminAuthForm" class="edit-grid">
    <label class="edit-field"><span>${config?'管理密碼':'建立管理密碼'}</span><input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
    ${config?'':'<label class="edit-field"><span>再次確認</span><input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label>'}
    <button type="submit">${config?'登入管理模式':'建立密碼並登入'}</button>
  </form><p id="adminAuthStatus" class="notice"></p>`;
  host.querySelector('#adminAuthForm').onsubmit=async(event)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);const password=String(form.get('password')||'');
    if(password.length<8){statusMessage('密碼至少需要 8 個字元。','notice error');return;}
    const existing=loadConfig();
    if(!existing){
      if(password!==String(form.get('confirm')||'')){statusMessage('兩次輸入的密碼不同。','notice error');return;}
      const salt=crypto.getRandomValues(new Uint8Array(16));const hash=await derive(password,salt);
      localStorage.setItem(CONFIG_KEY,JSON.stringify({schema:'local-admin-auth/1.0',algorithm:'PBKDF2-SHA-256',iterations:ITERATIONS,salt:encode(salt),password_hash:encode(hash),updated_at:new Date().toISOString()}));
    }else{
      const hash=await derive(password,decode(existing.salt),Number(existing.iterations)||ITERATIONS);
      if(!sameBytes(hash,decode(existing.password_hash))){statusMessage('管理密碼錯誤。','notice error');return;}
    }
    sessionStorage.setItem(SESSION_KEY,'authenticated');authenticated=true;applyGate();renderAdminPanel();await loadDebugModules();
  };
}
function initialize(){
  applyGate();renderAdminPanel();if(authenticated)loadDebugModules();
  observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof Element){applyGate(node);if(node.id==='adminAuthPanel')renderAdminPanel();}})));
  observer.observe(document.documentElement,{subtree:true,childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
globalThis.PokemonSleepAdminAuth=Object.freeze({isAuthenticated:()=>authenticated,applyGate,logout:()=>{sessionStorage.removeItem(SESSION_KEY);authenticated=false;applyGate();renderAdminPanel();}});
