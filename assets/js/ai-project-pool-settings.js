const STORAGE_KEY='pokemon-sleep:ai-project-pool/session';
const DEFAULT_MODEL='gemini-3.6-flash';
const MODELS_ENDPOINT='https://generativelanguage.googleapis.com/v1beta/models?key=';
// Multiline textarea equivalent of type="password": CSS text security preserves comma/newline-separated key input.

function splitKeys(value=''){
  return [...new Set(String(value).split(/[\s,，;；]+/u).map(v=>v.trim()).filter(Boolean))];
}
function maskKey(key){return key.length<10?'••••••':`${key.slice(0,5)}••••••••${key.slice(-4)}`;}
async function fingerprint(key){const data=new TextEncoder().encode(key);const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].slice(0,4).map(v=>v.toString(16).padStart(2,'0')).join('');}
function loadSession(){try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');}catch{return null;}}
function saveSession(data){sessionStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
function clearSession(){sessionStorage.removeItem(STORAGE_KEY);}

async function testKey(key){
  const response=await fetch(`${MODELS_ENDPOINT}${encodeURIComponent(key)}`,{cache:'no-store'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload?.error?.message||`HTTP ${response.status}`);
  const models=(payload.models||[]).filter(model=>(model.supportedGenerationMethods||[]).includes('generateContent')).map(model=>({name:String(model.name||'').replace(/^models\//,''),display_name:model.displayName||model.name||'',methods:model.supportedGenerationMethods||[]}));
  return models;
}

function createPanel(){
  const guide=document.querySelector('#guide .prose');
  if(!guide||document.getElementById('aiProjectPoolSettings'))return;
  const section=document.createElement('section');
  section.id='aiProjectPoolSettings';
  section.innerHTML=`
    <h3>AI API Key 與備援 Project</h3>
    <p>AI 僅用於本機 OCR 信心度不足、無法辨識或使用者主動覆核的圖片。API Key 不會上傳至本專案伺服器或 GitHub；預設只暫存在目前瀏覽器分頁工作階段。</p>
    <ol><li>登入 Google AI Studio。</li><li>建立或選擇 Project，為每個獨立 Project 建立 API Key。</li><li>將多組 Key 貼入下方，可用逗號、全形逗號、空白、換行或分號分隔。</li><li>按「測試 Key 與取得模型」確認可用狀態。</li></ol>
    <label for="aiApiKeysInput"><b>多組 Gemini API Key</b></label>
    <div class="buttons"><button type="button" id="toggleAiKeysBtn">顯示 Key</button><button type="button" id="testAiKeysBtn">測試 Key 與取得模型</button><button type="button" id="clearAiKeysBtn">清除本次暫存</button></div>
    <textarea id="aiApiKeysInput" rows="5" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="AIza...ProjectA，AIza...ProjectB"></textarea>
    <p class="notice">預設暗碼顯示。未勾選任何永久保存選項；關閉分頁後由瀏覽器清除。本功能不會將完整 Key 寫入 Debug Trace、Manifest 或匯出檔。</p>
    <label for="aiModelSelect"><b>辨識模型</b></label>
    <select id="aiModelSelect"><option value="${DEFAULT_MODEL}">${DEFAULT_MODEL}（預設）</option></select>
    <div id="aiKeyTestSummary" class="panel">尚未測試 API Key。</div>`;
  guide.appendChild(section);

  const input=section.querySelector('#aiApiKeysInput');
  const toggle=section.querySelector('#toggleAiKeysBtn');
  const test=section.querySelector('#testAiKeysBtn');
  const clear=section.querySelector('#clearAiKeysBtn');
  const select=section.querySelector('#aiModelSelect');
  const summary=section.querySelector('#aiKeyTestSummary');
  let revealed=false;
  const restore=loadSession();
  if(restore?.keys?.length)input.value=restore.keys.join('\n');
  if(restore?.model)select.value=restore.model;
  const applyMask=()=>{input.style.webkitTextSecurity=revealed?'none':'disc';toggle.textContent=revealed?'隱藏 Key':'顯示 Key';};
  applyMask();
  toggle.addEventListener('click',()=>{revealed=!revealed;applyMask();});
  clear.addEventListener('click',()=>{input.value='';select.innerHTML=`<option value="${DEFAULT_MODEL}">${DEFAULT_MODEL}（預設）</option>`;summary.textContent='已清除目前分頁的 API Key 暫存。';clearSession();revealed=false;applyMask();});
  select.addEventListener('change',()=>saveSession({keys:splitKeys(input.value),model:select.value}));
  input.addEventListener('change',()=>saveSession({keys:splitKeys(input.value),model:select.value||DEFAULT_MODEL}));
  test.addEventListener('click',async()=>{
    const keys=splitKeys(input.value);
    if(!keys.length){summary.textContent='請先輸入至少一組 API Key。';return;}
    test.disabled=true;summary.textContent=`正在測試 ${keys.length} 組 Key…`;
    const rows=[];const allModels=new Map();
    for(let i=0;i<keys.length;i++){
      try{const models=await testKey(keys[i]);models.forEach(model=>allModels.set(model.name,model));rows.push({index:i+1,ok:true,count:models.length,mask:maskKey(keys[i]),fp:await fingerprint(keys[i])});}
      catch(error){rows.push({index:i+1,ok:false,error:error?.message||String(error),mask:maskKey(keys[i]),fp:await fingerprint(keys[i])});}
    }
    const names=[...allModels.keys()].sort();
    select.innerHTML='';
    const preferred=names.includes(DEFAULT_MODEL)?DEFAULT_MODEL:(names.find(name=>/flash/i.test(name))||names[0]||DEFAULT_MODEL);
    for(const name of [...new Set([preferred,...names])]){const option=document.createElement('option');option.value=name;option.textContent=name+(name===preferred?'（預設）':'');select.appendChild(option);}
    select.value=preferred;
    saveSession({keys,model:preferred});
    summary.innerHTML=rows.map(row=>`<div><b>Key ${row.index}</b> ${row.mask} · 指紋 ${row.fp} · ${row.ok?`可用，模型 ${row.count} 個`:`不可用：${String(row.error).replace(/[<>]/g,'')}`}</div>`).join('')+`<p>目前選用模型：<b>${preferred}</b></p>`;
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:ai_project_pool_tested',{detail:{key_count:keys.length,available_count:rows.filter(row=>row.ok).length,model_count:names.length,selected_model:preferred}}));
    test.disabled=false;
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createPanel,{once:true});else createPanel();
export {splitKeys,maskKey,testKey,DEFAULT_MODEL};
