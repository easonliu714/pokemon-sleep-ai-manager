import {dryRun,applyPayload} from './importer.js';
import {analyzeUcImgScenarioWithGemini} from './uc-img-gemini-adapter.js';
import {snapshotUcImgPickerFile} from './uc-img-image-runtime.js';
import {
  CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
  CANDY_QUANTITY_PENDING_REASON,
  applyCandyGovernedRecognitionResolution,
  buildCandyQuantityGovernedRecognitionPrompt,
  buildPublicMasterCatalogSnapshot,
  compileCandyQuantityGovernedRecognitionToUpdatePackage,
  isPublicMasterRecognitionPayload,
} from './candy-quantity-confirmation-authority.js';

export const CANDY_QUANTITY_SCREENSHOT_UI_VERSION='candy-quantity-screenshot-ui-2026-08-31-a';

const cfg=Object.freeze({
  key:'candies',
  scenario:'candy_inventory_update',
  label:'糖果庫存',
  entities:['candy_inventory'],
});
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clean=value=>String(value??'').trim();
const clone=value=>JSON.parse(JSON.stringify(value));
const nowIso=()=>new Date().toISOString();
const token=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

function extractJson(input){
  const source=clean(input),fenced=source.match(/```(?:json)?\s*([\s\S]*?)```/i),body=clean(fenced?.[1]||source);
  const start=body.indexOf('{'),end=body.lastIndexOf('}');
  if(start<0||end<start)throw new Error('找不到 JSON 物件');
  return JSON.parse(body.slice(start,end+1));
}

async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
}

function mount(){
  const host=document.getElementById('updateCenterDynamicContent');
  if(!host||document.getElementById('candyQuantityScreenshotB5'))return false;
  const state={
    session_id:`candy-b5-${token()}`,
    entries:[],
    files:new Map(),
    raw:'',
    result:null,
    preview:null,
    busy:false,
    provider:null,
  };
  const section=document.createElement('section');
  section.id='candyQuantityScreenshotB5';
  section.className='panel';
  section.dataset.quantityAuthority=CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION;
  host.prepend(section);

  const refs=()=>state.entries.map(item=>item.image_ref);
  const imageMap=()=>state.entries.map(item=>({image_ref:item.image_ref,file_name:item.file_name}));
  const prompt=()=>buildCandyQuantityGovernedRecognitionPrompt('candies',{sessionId:state.session_id,coverage:'PARTIAL',imageMap:imageMap()});
  const snapshot=()=>buildPublicMasterCatalogSnapshot('candies');

  function parse(){
    state.preview=null;
    try{
      const raw=extractJson(state.raw);
      if(!isPublicMasterRecognitionPayload(raw))throw new Error('請貼入 candy_inventory_update Public Master Recognition JSON');
      state.result=compileCandyQuantityGovernedRecognitionToUpdatePackage(raw,'candies',{allowedImageRefs:refs()});
    }catch(error){state.result={ok:false,errors:[error.message],warnings:[],unresolved:[],update_package:null,summary:{}};}
    render();
  }

  function updateRaw(mutator){
    try{
      const raw=extractJson(state.raw);
      state.raw=JSON.stringify(mutator(raw),null,2);
      parse();
    }catch(error){alert(`覆核失敗：${error.message}`);}
  }

  function confirmQuantity(item){
    const quantity=item?.observed_data?.quantity;
    const name=item?.canonical_name||item?.observed_text||'此糖果';
    if(!Number.isInteger(quantity)||quantity<0)return alert('此候選沒有可確認的 0 以上整數 quantity。');
    if(!confirm(`AI／OCR 候選：${name} = ${quantity}\n\n請查看 Pokémon Sleep 目前畫面，確認「目前庫存」確實是 ${quantity}。\n\n這不是自動同步；只有你按確定後才會進 Dry-Run。`))return;
    updateRaw(raw=>applyCandyGovernedRecognitionResolution(raw,'candies',item.observation_id,'CONFIRM_QUANTITY'));
  }

  function resolveIdentity(item,displayName){
    if(!displayName)return alert('請先選擇公版糖果候選。');
    updateRaw(raw=>applyCandyGovernedRecognitionResolution(raw,'candies',item.observation_id,'MATCH',displayName));
  }

  function ignore(item){
    if(!confirm('確認這一列是辨識誤判／非目標 UI，不建立任何糖果庫存更新？'))return;
    updateRaw(raw=>applyCandyGovernedRecognitionResolution(raw,'candies',item.observation_id,'IGNORE'));
  }

  function masterGap(item){
    if(!confirm('確認畫面確實存在這個糖果項目，但目前 Candy Master 無可靠 identity？此動作只保留 gap evidence，不會寫入玩家資料。'))return;
    updateRaw(raw=>applyCandyGovernedRecognitionResolution(raw,'candies',item.observation_id,'MASTER_GAP'));
  }

  async function runInternal(){
    if(state.busy)return;
    if(!state.entries.length)return alert('請先選擇糖果庫存截圖。');
    const poolData=globalThis.PokemonSleepAiProjectPool;
    if(!poolData?.projects?.length)return alert('尚未設定 Gemini API Key；也可複製 Prompt 後使用外部 AI。');
    state.busy=true;render();
    try{
      const analysis=await analyzeUcImgScenarioWithGemini({
        scenarioKey:'candies',config:cfg,entries:state.entries,fileMap:state.files,prompt:prompt(),poolData,
        onTrace:(event,details)=>globalThis.DebugTrace?.record?.('candy_b5_gemini',event,{status:event.endsWith('failed')?'failed':event.endsWith('completed')?'completed':'started',details}),
      });
      globalThis.PokemonSleepAiProjectPool={...poolData,projects:analysis.projects};
      state.raw=analysis.raw_json;state.provider=`${analysis.provider||'gemini'} / ${analysis.model||'—'}`;
      parse();
    }catch(error){alert(`Gemini 糖果辨識失敗：${error?.message||error}`);}
    finally{state.busy=false;render();}
  }

  async function selectFiles(files){
    state.entries=[];state.files.clear();state.raw='';state.result=null;state.preview=null;
    let index=1;
    for(const file of files){
      const snap=await snapshotUcImgPickerFile(file);
      const entry={entry_id:`candy-${index}`,image_ref:`candy-image-${String(index).padStart(3,'0')}`,file_name:file.name,file_size:file.size,mime_type:snap.mime_type||file.type,byte_state:'READY',image_available:true};
      state.entries.push(entry);state.files.set(entry.entry_id,snap.blob);index+=1;
    }
    render();
  }

  async function doDryRun(){
    if(!state.result?.ok||!state.result.update_package)return;
    try{state.preview=dryRun(state.result.update_package);render();}catch(error){alert(`Dry-Run 失敗：${error.message}`);}
  }

  async function doApply(){
    if(!state.preview||state.preview.conflict_count!==0||!state.result?.ok)return;
    if(!confirm('確認套用已逐筆人工確認的糖果目前庫存？\n\n平台不保證與遊戲自動同步；未來遊戲內變動仍需重新上傳／確認。'))return;
    try{
      await applyPayload(state.result.update_package);
      alert('糖果庫存已套用。');
      state.preview=null;state.result=null;state.raw='';render();
      window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{source:'candy_quantity_screenshot_b5'}}));
    }catch(error){alert(`套用失敗：${error.message}`);}
  }

  function reviewHtml(){
    const unresolved=state.result?.unresolved||[];
    if(!unresolved.length)return '';
    const options=snapshot().rows.map(row=>row.candy_name).filter(Boolean);
    return `<div class="uc-img-recognition"><b>糖果覆核：${unresolved.length}</b><p class="notice">identity 確認與 quantity 確認是兩個不同 Gate。OCR 數量只作候選；未逐筆確認前 Dry-Run 保持鎖定。</p>${unresolved.map(item=>{
      const quantityReview=item.reason===CANDY_QUANTITY_PENDING_REASON;
      if(quantityReview)return `<article class="uc-img-recognition-card" data-id="${esc(item.observation_id)}" data-kind="quantity"><b>${esc(item.canonical_name||item.observed_text||'糖果')}</b> · OCR 候選數量 <b>${esc(item.observed_data?.quantity)}</b><div class="notice">${esc(item.source_image_ref||'—')} · confidence=${esc(item.confidence??'—')} · <code>USER_CONFIRMATION_REQUIRED</code></div><button data-action="quantity">我已核對遊戲畫面，確認數量 ${esc(item.observed_data?.quantity)}</button></article>`;
      return `<article class="uc-img-recognition-card" data-id="${esc(item.observation_id)}" data-kind="identity"><b>${esc(item.status)}</b> · ${esc(item.observed_text||'未讀到文字')}<div class="notice">辨識值：<code>${esc(JSON.stringify(item.observed_data||{}))}</code> · ${esc(item.reason||'IDENTITY_REVIEW_REQUIRED')}</div><select data-candidate><option value="">請選擇公版糖果候選</option>${options.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select><div class="buttons"><button data-action="match">確認 identity</button><button data-action="ignore">辨識誤判／忽略</button><button data-action="gap">Public Master gap</button></div></article>`;
    }).join('')}</div>`;
  }

  function render(){
    const errors=state.result?.errors||[],warnings=state.result?.warnings||[],pending=state.result?.unresolved||[];
    const confirmed=state.result?.summary?.candy_quantity_confirmed_count||0;
    section.innerHTML=`<h3>糖果截圖庫存覆核 <small>P0-B5</small></h3>
      <p class="notice"><b>OCR／AI 讀到的糖果數量只是候選值，不會直接寫入。</b> 每一筆必須由你查看目前遊戲畫面後再按一次數量確認；identity MATCH 不等於 quantity 確認。0 是合法值，但也必須人工確認。平台不保證遊戲外部變動自動同步。</p>
      <p class="notice">Authority：<code>${esc(CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION)}</code> · 已確認數量：<b>${confirmed}</b> · 待覆核：<b>${pending.length}</b> · Provider：${esc(state.provider||'—')}</p>
      <label>選擇糖果庫存截圖 <input id="candyB5Files" type="file" accept="image/*" multiple></label>
      <div class="notice">已選：${state.entries.map(item=>esc(item.file_name)).join('、')||'尚未選擇'}</div>
      <div class="buttons"><button id="candyB5Gemini" ${state.entries.length&&!state.busy?'':'disabled'}>${state.busy?'Gemini 分析中…':'Gemini API 直接分析'}</button><button id="candyB5Prompt" ${state.entries.length?'':'disabled'}>複製外部 AI Prompt</button></div>
      <label><b>Recognition JSON</b><textarea id="candyB5Json" style="width:100%;min-height:180px" placeholder="內部 Gemini 成功後自動填入；也可貼入外部 AI JSON">${esc(state.raw)}</textarea></label>
      <div class="buttons"><button id="candyB5Parse">解析／覆核</button><button id="candyB5Dry" ${state.result?.ok&&!pending.length?'':'disabled'}>Dry-Run</button><button id="candyB5Apply" ${state.preview&&state.preview.conflict_count===0&&state.result?.ok?'':'disabled'}>套用已確認數量</button></div>
      ${errors.map(value=>`<div class="status-conflict">錯誤：${esc(value)}</div>`).join('')}${warnings.map(value=>`<div>警告：${esc(value)}</div>`).join('')}
      ${reviewHtml()}
      ${state.result?.ok?`<div class="status-ready">B5 confirmation Gate PASS：${state.result.update_package?.operations?.length||0} 筆 operation 可進 Dry-Run。</div>`:''}
      ${state.preview?`<div class="notice">Dry-Run：ready=<b>${state.preview.ready_count}</b> / conflict=<b>${state.preview.conflict_count}</b></div>`:''}`;
    section.querySelector('#candyB5Files').onchange=event=>selectFiles([...event.target.files]).catch(error=>alert(`圖片讀取失敗：${error.message}`));
    section.querySelector('#candyB5Gemini').onclick=runInternal;
    section.querySelector('#candyB5Prompt').onclick=()=>copyText(prompt()).then(()=>alert('B5 外部 AI Prompt 已複製。')).catch(error=>alert(error.message));
    section.querySelector('#candyB5Json').oninput=event=>{state.raw=event.target.value;state.result=null;state.preview=null;};
    section.querySelector('#candyB5Parse').onclick=parse;
    section.querySelector('#candyB5Dry').onclick=doDryRun;
    section.querySelector('#candyB5Apply').onclick=doApply;
    section.querySelectorAll('[data-kind="quantity"] [data-action="quantity"]').forEach(button=>button.onclick=()=>{const id=button.closest('[data-id]').dataset.id;confirmQuantity((state.result?.unresolved||[]).find(item=>item.observation_id===id));});
    section.querySelectorAll('[data-kind="identity"]').forEach(card=>{
      const item=(state.result?.unresolved||[]).find(row=>row.observation_id===card.dataset.id),select=card.querySelector('[data-candidate]');
      card.querySelector('[data-action="match"]').onclick=()=>resolveIdentity(item,select.value);
      card.querySelector('[data-action="ignore"]').onclick=()=>ignore(item);
      card.querySelector('[data-action="gap"]').onclick=()=>masterGap(item);
    });
  }

  render();
  return true;
}

function boot(){
  if(mount())return;
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else queueMicrotask(boot);
}
