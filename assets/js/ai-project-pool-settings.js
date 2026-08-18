import {saveEncryptedProjectPool,loadEncryptedProjectPool,clearEncryptedProjectPool,hasEncryptedProjectPool} from './ai-key-vault.js';
import {normalizeProjectPool} from './ai-project-pool-runtime.js';

// Compatibility/security contract: multiline textarea provides type="password" equivalent through webkitTextSecurity.
const STORAGE_KEY='pokemon-sleep:ai-project-pool/session';
const DEFAULT_MODEL='gemini-3.6-flash';
const MODELS_ENDPOINT='https://generativelanguage.googleapis.com/v1beta/models?key=';
const MODEL_DISCOVERY_TIMEOUT_MS=15000;
function splitKeys(value=''){return [...new Set(String(value).split(/[\s,，;；]+/u).map(v=>v.trim()).filter(Boolean))];}
function maskKey(key){return key.length<10?'••••••':`${key.slice(0,5)}••••••••${key.slice(-4)}`;}
async function fingerprint(key){const data=new TextEncoder().encode(key);const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].slice(0,4).map(v=>v.toString(16).padStart(2,'0')).join('');}
function loadSession(){try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');}catch{return null;}}
function saveSession(data){sessionStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
function clearSession(){sessionStorage.removeItem(STORAGE_KEY);}
function timeoutError(label,timeoutMs){const error=new Error(`${label}_TIMEOUT_${timeoutMs}MS`);error.name='TimeoutError';error.code='AI_MODEL_DISCOVERY_TIMEOUT';return error;}
async function fetchWithTimeout(url,options={},timeoutMs=MODEL_DISCOVERY_TIMEOUT_MS){
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timer=null;
  const request=fetch(url,{...options,...(controller?{signal:controller.signal}:{})});
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{try{controller?.abort();}catch{}reject(timeoutError('GEMINI_MODELS',timeoutMs));},timeoutMs);});
  try{return await Promise.race([request,timeout]);}finally{if(timer)clearTimeout(timer);}
}
async function testKey(key){const response=await fetchWithTimeout(`${MODELS_ENDPOINT}${encodeURIComponent(key)}`,{cache:'no-store'},MODEL_DISCOVERY_TIMEOUT_MS);const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.error?.message||`HTTP ${response.status}`);return (payload.models||[]).filter(model=>(model.supportedGenerationMethods||[]).includes('generateContent')).map(model=>({name:String(model.name||'').replace(/^models\//,''),display_name:model.displayName||model.name||'',methods:model.supportedGenerationMethods||[]}));}
async function buildProjects(keys){const projects=[];for(let i=0;i<keys.length;i++)projects.push({alias:`Project ${String.fromCharCode(65+i)}`,key:keys[i],fingerprint:await fingerprint(keys[i]),priority:i+1,enabled:true,cooldown_until:null,last_used_at:null,last_error_class:null});return normalizeProjectPool(projects);}
function publishPool(data){globalThis.PokemonSleepAiProjectPool=data;globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai-project-pool-updated',{detail:{projects:data.projects,model:data.model,persistent:data.persistent}}));}
function ensureModelOption(select,model,{pending=false}={}){const value=String(model||'').trim()||DEFAULT_MODEL;if([...select.options].some(option=>option.value===value))return value;const option=document.createElement('option');option.value=value;option.textContent=value+(pending?'（待自動驗證）':'');select.appendChild(option);return value;}
function chooseModel(names=[],requestedModel=''){const requested=String(requestedModel||'').trim();if(requested&&names.includes(requested))return requested;if(names.includes(DEFAULT_MODEL))return DEFAULT_MODEL;return names.find(name=>/gemini/i.test(name)&&/flash/i.test(name))||names[0]||requested||DEFAULT_MODEL;}
function replaceModelOptions(select,names=[],selectedModel=''){const chosen=chooseModel(names,selectedModel);select.innerHTML='';for(const name of [...new Set([chosen,...names].filter(Boolean))]){const option=document.createElement('option');option.value=name;option.textContent=name+(name===chosen?'（預設）':'');select.appendChild(option);}select.value=chosen;return chosen;}

async function createPanel(){
  const guide=document.querySelector('#guide .prose');if(!guide||document.getElementById('aiProjectPoolSettings'))return;
  const section=document.createElement('section');section.id='aiProjectPoolSettings';section.innerHTML=`<h3>AI API Key 與備援 Project</h3><p>API Key 預設只保留於本分頁。勾選「在此裝置加密保存」後，使用 Web Crypto AES-GCM 與同源 IndexedDB 保存，可跨 PWA 更新保留。</p><label for="aiApiKeysInput"><b>多組 Gemini API Key</b></label><div class="buttons"><button type="button" id="toggleAiKeysBtn">顯示 Key</button><button type="button" id="testAiKeysBtn">測試 Key 與取得模型</button><button type="button" id="clearSessionAiKeysBtn">清除工作階段 Key</button><button type="button" id="clearDeviceAiKeysBtn">清除此裝置保存的 Key</button></div><textarea id="aiApiKeysInput" rows="5" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="AIza...ProjectA，AIza...ProjectB"></textarea><label><input type="checkbox" id="persistAiKeys"> 在此裝置加密保存 API Key</label><p class="notice">完整 Key 不會寫入 Debug Trace、Manifest、Service Worker、備份或匯出檔。清除網站資料仍會刪除裝置保存內容。</p><label for="aiModelSelect"><b>辨識模型</b></label><select id="aiModelSelect"><option value="${DEFAULT_MODEL}">${DEFAULT_MODEL}（預設）</option></select><div id="aiKeyTestSummary" class="panel">尚未測試 API Key。</div>`;guide.appendChild(section);
  const input=section.querySelector('#aiApiKeysInput'),toggle=section.querySelector('#toggleAiKeysBtn'),test=section.querySelector('#testAiKeysBtn'),clearSessionBtn=section.querySelector('#clearSessionAiKeysBtn'),clearDeviceBtn=section.querySelector('#clearDeviceAiKeysBtn'),persist=section.querySelector('#persistAiKeys'),select=section.querySelector('#aiModelSelect'),summary=section.querySelector('#aiKeyTestSummary');let revealed=false;
  let restore=loadSession();if(!restore&&await hasEncryptedProjectPool()){try{restore=await loadEncryptedProjectPool();persist.checked=true;summary.textContent=`已從此裝置安全儲存區恢復 ${restore?.projects?.length||0} 組 Project Key；模型將自動驗證。`;}catch{summary.textContent='裝置保存的 Key 無法解密，請重新輸入。';}}
  if(restore?.projects?.length)input.value=restore.projects.map(project=>project.key).join('\n');else if(restore?.keys?.length)input.value=restore.keys.join('\n');
  const restoredModel=String(restore?.model||DEFAULT_MODEL).trim()||DEFAULT_MODEL;ensureModelOption(select,restoredModel,{pending:restoredModel!==DEFAULT_MODEL});select.value=restoredModel||DEFAULT_MODEL;
  const applyMask=()=>{input.style.webkitTextSecurity=revealed?'none':'disc';toggle.textContent=revealed?'隱藏 Key':'顯示 Key';};applyMask();
  const persistCurrent=async()=>{const projects=await buildProjects(splitKeys(input.value));const model=String(select.value||DEFAULT_MODEL).trim()||DEFAULT_MODEL;ensureModelOption(select,model);select.value=model;const data={schema:'pokemon-sleep-ai-project-pool/1.0',projects,model,persistent:persist.checked};saveSession(data);if(persist.checked)await saveEncryptedProjectPool(data);publishPool(data);return data;};
  const discoverModels=async({automatic=false}={})=>{
    const keys=splitKeys(input.value);if(!keys.length){if(!automatic)summary.textContent='請先輸入至少一組 API Key。';return null;}
    const requested=String(select.value||restore?.model||DEFAULT_MODEL).trim()||DEFAULT_MODEL;
    if(!automatic){test.disabled=true;summary.textContent=`正在測試 ${keys.length} 組 Key…`;}
    else summary.textContent=`已恢復 ${keys.length} 組 Project Key；正在背景驗證模型…`;
    const settled=await Promise.all(keys.map(async(key,index)=>{try{const models=await testKey(key);return {index:index+1,ok:true,models,count:models.length,mask:maskKey(key),fp:await fingerprint(key)};}catch(error){return {index:index+1,ok:false,error:error?.message||String(error),models:[],mask:maskKey(key),fp:await fingerprint(key)};}}));
    const allModels=new Map();for(const row of settled)for(const model of row.models)allModels.set(model.name,model);
    const names=[...allModels.keys()].sort();
    if(names.length){const selected=replaceModelOptions(select,names,requested);const data=await persistCurrent();summary.innerHTML=settled.map(row=>`<div><b>Key ${row.index}</b> ${row.mask} · 指紋 ${row.fp} · ${row.ok?`可用，模型 ${row.count} 個`:`不可用：${String(row.error).replace(/[<>]/g,'')}`}</div>`).join('')+`<p>${requested!==selected?`原模型 <b>${requested}</b> 已失效／不可用，已自動切換。 `:''}目前選用模型：<b>${selected}</b>；保存模式：<b>${data.persistent?'裝置加密保存':'工作階段'}</b></p>`;globalThis.DebugTrace?.record?.('ai_project_pool','ai_project_pool_tested',{status:'completed',details:{automatic,key_count:keys.length,available_count:settled.filter(row=>row.ok).length,model_count:names.length,selected_model:selected,persistent:data.persistent,fingerprints:settled.map(row=>row.fp)}});if(!automatic)test.disabled=false;return data;}
    ensureModelOption(select,requested,{pending:true});select.value=requested||DEFAULT_MODEL;const data=await persistCurrent();summary.textContent=`模型自動驗證未取得可用結果；目前保留 ${data.model}，實際辨識仍會先做 capability preflight 並在失效時切換 Project／Model。`;if(!automatic)test.disabled=false;return data;
  };
  toggle.addEventListener('click',()=>{revealed=!revealed;applyMask();});
  clearSessionBtn.addEventListener('click',()=>{clearSession();summary.textContent='已清除工作階段 Key；裝置加密保存內容未刪除。';});
  clearDeviceBtn.addEventListener('click',async()=>{await clearEncryptedProjectPool();persist.checked=false;summary.textContent='已清除此裝置保存的 Key。';});
  input.addEventListener('change',persistCurrent);select.addEventListener('change',persistCurrent);persist.addEventListener('change',async()=>{if(persist.checked)await persistCurrent();else await clearEncryptedProjectPool();});
  test.addEventListener('click',()=>discoverModels({automatic:false}));
  if(restore?.projects?.length){const restored={...restore,model:String(select.value||DEFAULT_MODEL).trim()||DEFAULT_MODEL,persistent:Boolean(persist.checked||restore.persistent)};publishPool(restored);setTimeout(()=>{discoverModels({automatic:true}).catch(()=>{});},0);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createPanel,{once:true});else createPanel();
export {splitKeys,maskKey,testKey,DEFAULT_MODEL,buildProjects,MODEL_DISCOVERY_TIMEOUT_MS,chooseModel};
