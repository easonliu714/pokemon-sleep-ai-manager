import {dryRun,applyPayload} from './importer.js';
import {analyzeUcImgScenarioWithGemini} from './uc-img-gemini-adapter.js';
import {snapshotUcImgPickerFile} from './uc-img-image-runtime.js';
import {
  CANDY_IDENTITY_MISMATCH_REASON,
  CANDY_PUBLIC_MASTER_GAP_ACTION,
  CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
  CANDY_QUANTITY_PENDING_REASON,
  applyCandyGovernedRecognitionResolution,
  buildCandyQuantityGovernedRecognitionPrompt,
  buildPublicMasterCatalogSnapshot,
  isPublicMasterRecognitionPayload,
} from './candy-quantity-confirmation-authority.js';
import {
  PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  commitPublicCandyLocalAdmission,
  prepareConfirmedMatchedCandyLocalAdmission,
} from './public-candy-local-admission-authority.js';
import {
  CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION,
  applyCandyVisibleTargetCountResolution,
  compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage,
  getCandyVisibleTargetCountState,
} from './candy-visible-target-count-authority.js';

export const CANDY_QUANTITY_SCREENSHOT_UI_VERSION='candy-quantity-screenshot-ui-2026-09-02-e-mobile-perf';

const cfg=Object.freeze({
  key:'candies',
  scenario:'candy_inventory_update',
  label:'糖果庫存',
  entities:['candy_inventory'],
});
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clean=value=>String(value??'').trim();
const token=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const perfNow=()=>globalThis.performance?.now?.()??Date.now();
const elapsedMs=started=>Math.round((perfNow()-started)*10)/10;
const trace=(event,details)=>globalThis.DebugTrace?.record?.('candy_b5_performance',event,{status:'completed',details});

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
    provider_raw:'',
    provider_raw_source:null,
    working_raw:'',
    result:null,
    preview:null,
    busy:false,
    provider:null,
    last_apply_summary:null,
  };
  const section=document.createElement('section');
  section.id='candyQuantityScreenshotB5';
  section.className='panel';
  section.dataset.quantityAuthority=CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION;
  section.dataset.visibleTargetCountAuthority=CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION;
  section.dataset.localCandyNameAuthority=PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION;
  section.dataset.performanceAuthority='v0.4.27.55.3-mobile-incremental-confirmation';
  host.prepend(section);

  const refs=()=>state.entries.map(item=>item.image_ref);
  const imageMap=()=>state.entries.map(item=>({image_ref:item.image_ref,file_name:item.file_name}));
  const prompt=()=>buildCandyQuantityGovernedRecognitionPrompt('candies',{sessionId:state.session_id,coverage:'PARTIAL',imageMap:imageMap()});
  const snapshot=()=>buildPublicMasterCatalogSnapshot('candies');

  function workingPayload(){try{return extractJson(state.working_raw);}catch{return null;}}
  function workingObservations(){const value=workingPayload();return Array.isArray(value?.observations)?value.observations:[];}
  function confirmedGapRows(){return workingObservations().filter(item=>item?.user_resolution?.action===CANDY_PUBLIC_MASTER_GAP_ACTION);}

  function lockExternalRawIfNeeded(){
    if(state.provider_raw||!clean(state.working_raw))return;
    state.provider_raw=state.working_raw;
    state.provider_raw_source='EXTERNAL_AI_PASTE_FIRST_PARSE';
  }

  function parse(options={}){
    const started=perfNow();
    const renderUi=options?.renderUi!==false;
    state.preview=null;
    try{
      lockExternalRawIfNeeded();
      const working=extractJson(state.working_raw);
      if(!isPublicMasterRecognitionPayload(working))throw new Error('請貼入 candy_inventory_update Public Master Recognition JSON');
      state.result=compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(working,'candies',{allowedImageRefs:refs()});
    }catch(error){state.result={ok:false,errors:[error.message],warnings:[],unresolved:[],update_package:null,summary:{}};}
    trace('compile_completed',{elapsed_ms:elapsedMs(started),render_ui:renderUi,observation_count:workingObservations().length,pending_count:state.result?.unresolved?.length||0,operation_count:state.result?.update_package?.operations?.length||0});
    if(renderUi)render();
    return state.result;
  }

  function updateWorking(mutator){
    try{
      const working=extractJson(state.working_raw);
      state.working_raw=JSON.stringify(mutator(working),null,2);
      state.preview=null;state.last_apply_summary=null;
      parse();
    }catch(error){alert(`覆核失敗：${error.message}`);}
  }

  function confirmVisibleTargetCount(){
    const payload=workingPayload();if(!payload)return alert('請先解析 Recognition JSON。');
    const countState=getCandyVisibleTargetCountState(payload);
    const input=section.querySelector('#candyB5VisibleTargetCountInput');
    const confirmedCount=Number(input?.value);
    if(!Number.isInteger(confirmedCount)||confirmedCount<0)return alert('實際畫面項目數必須是 0 以上整數。');
    if(!confirm(`Gemini 回報 visible_target_count=${countState.provider_visible_target_count}，實際輸出 observations=${countState.observations_length}。\n\n你輸入的原始遊戲畫面實際項目數：${confirmedCount}\n\n請只在已核對原始 Pokémon Sleep 畫面後按確定。這個動作不會修改 Gemini Raw JSON，也不會自動補齊漏辨識項目。`))return;
    updateWorking(raw=>applyCandyVisibleTargetCountResolution(raw,'candies',confirmedCount));
  }

  function refreshIncrementalConfirmationUi(item,admission,metrics){
    const card=section.querySelector(`[data-kind="quantity"][data-id="${CSS.escape(String(item.observation_id))}"]`);
    if(card){
      card.dataset.kind='quantity-confirmed';
      card.classList.add('status-ready');
      card.innerHTML=`<b>${esc(item.canonical_name||item.observed_text||'糖果')}</b> · 已確認數量 <b>${esc(item.observed_data?.quantity)}</b><div class="notice"><code>LOCAL_AUTHORITY_READBACK_PASS</code> · ${esc(admission.status)} · 本筆 ${esc(metrics.total_ms)} ms</div>`;
    }
    const confirmed=state.result?.summary?.candy_quantity_confirmed_count||0;
    const pending=state.result?.unresolved?.length||0;
    const operationCount=state.result?.update_package?.operations?.length||0;
    const confirmedEl=section.querySelector('#candyB5ConfirmedCount');if(confirmedEl)confirmedEl.textContent=String(confirmed);
    const pendingEl=section.querySelector('#candyB5PendingCount');if(pendingEl)pendingEl.textContent=String(pending);
    const reviewCount=section.querySelector('#candyB5ReviewCount');if(reviewCount)reviewCount.textContent=String(pending);
    const workingEl=section.querySelector('#candyB5WorkingJson');if(workingEl&&document.activeElement!==workingEl)workingEl.value=state.working_raw;
    const compiledEl=section.querySelector('#candyB5CompiledJson');if(compiledEl)compiledEl.value=state.result?.update_package?JSON.stringify(state.result.update_package,null,2):'';
    const dry=section.querySelector('#candyB5Dry');if(dry)dry.disabled=!(state.result?.ok&&!pending&&operationCount>0);
    const gate=section.querySelector('#candyB5GateStatus');
    if(gate){
      if(state.result?.ok&&operationCount>0){gate.className='status-ready';gate.textContent=`B5 confirmation Gate PASS：${operationCount} 筆 operation 可進 Dry-Run；逐筆確認採局部更新，全站 Candy refresh 延後至 Apply。`;}
      else{gate.className='notice';gate.textContent=`逐筆確認中：confirmed=${confirmed} / pending=${pending}；本次只更新糖果覆核區塊，不觸發全站重繪。`;}
    }
  }

  function confirmQuantity(item){
    const totalStarted=perfNow();
    const quantity=item?.observed_data?.quantity;
    const name=item?.canonical_name||item?.observed_text||'此糖果';
    if(!Number.isInteger(quantity)||quantity<0)return alert('此候選沒有可確認的 0 以上整數 quantity。');
    if(!confirm(`AI／OCR 候選：${name} = ${quantity}\n\n請查看 Pokémon Sleep 目前畫面，確認「目前庫存」確實是 ${quantity}。\n\n確認後，平台會同時保留這個 exact 遊戲糖果名稱作為本機 durable authority（不含 quantity）；未來公版只能補強／交叉驗證，不會靜默覆蓋這個本機名稱。`))return;
    try{
      const working=extractJson(state.working_raw);
      const updated=applyCandyGovernedRecognitionResolution(working,'candies',item.observation_id,'CONFIRM_QUANTITY');
      const confirmedObservation=(updated.observations||[]).find(row=>row?.observation_id===item.observation_id);
      if(!confirmedObservation)throw new Error(`找不到已確認 observation：${item.observation_id}`);
      const prepared=prepareConfirmedMatchedCandyLocalAdmission({observation:confirmedObservation});
      const admissionStarted=perfNow();
      const admission=commitPublicCandyLocalAdmission(prepared);
      const admissionMs=elapsedMs(admissionStarted);
      state.working_raw=JSON.stringify(updated,null,2);
      state.preview=null;state.last_apply_summary=null;
      parse({renderUi:false});
      const metrics={total_ms:elapsedMs(totalStarted),local_admission_ms:admissionMs};
      refreshIncrementalConfirmationUi(item,admission,metrics);
      trace('quantity_confirmation_incremental_completed',{
        observation_id:item.observation_id,
        candy_id:admission.row.candy_id,
        local_admission_status:admission.status,
        local_admission_ms:admissionMs,
        total_ms:metrics.total_ms,
        pending_count:state.result?.unresolved?.length||0,
        operation_count:state.result?.update_package?.operations?.length||0,
        durable_readback_preserved:true,
        global_data_changed_dispatched:false,
        global_refresh_deferred_until_apply:true,
      });
    }catch(error){
      alert(`數量／本機糖果名稱確認失敗：${error.message}\n\n為避免已確認名稱在版本更新後消失，本次不會只確認 quantity 而跳過本機 authority 儲存。`);
    }
  }

  function resolveIdentity(item,displayName){
    if(!displayName)return alert('請先選擇公版糖果候選。');
    updateWorking(raw=>applyCandyGovernedRecognitionResolution(raw,'candies',item.observation_id,'MATCH',displayName));
  }

  function ignore(item){
    if(!confirm('確認這一列是辨識誤判／非目標 UI，不建立任何糖果庫存更新？'))return;
    updateWorking(raw=>applyCandyGovernedRecognitionResolution(raw,'candies',item.observation_id,'IGNORE'));
  }

  function masterGap(item){
    if(!confirm('確認畫面確實存在這個糖果項目，但目前 Candy Master 無可靠 identity？\n\n確認後此列會記為「Public Master gap 已確認」，保留 observed_text／quantity／圖片 evidence，不會寫入玩家糖果資料，也不再阻擋其他已確認糖果進入 Dry-Run。'))return;
    updateWorking(raw=>applyCandyGovernedRecognitionResolution(raw,'candies',item.observation_id,'MASTER_GAP'));
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
      state.provider_raw=String(analysis.raw_json??'');
      state.provider_raw_source='GEMINI_PROVIDER_RAW';
      state.working_raw=state.provider_raw;
      state.provider=`${analysis.provider||'gemini'} / ${analysis.model||'—'}`;
      state.last_apply_summary=null;
      parse();
    }catch(error){alert(`Gemini 糖果辨識失敗：${error?.message||error}`);}
    finally{state.busy=false;render();}
  }

  async function selectFiles(files){
    state.entries=[];state.files.clear();state.provider_raw='';state.provider_raw_source=null;state.working_raw='';state.result=null;state.preview=null;state.last_apply_summary=null;
    let index=1;
    for(const file of files){
      const snap=await snapshotUcImgPickerFile(file);
      const entry={entry_id:`candy-${index}`,image_ref:`candy-image-${String(index).padStart(3,'0')}`,file_name:file.name,file_size:file.size,mime_type:snap.mime_type||file.type,byte_state:'READY',image_available:true};
      state.entries.push(entry);state.files.set(entry.entry_id,snap.blob);index+=1;
    }
    render();
  }

  async function doDryRun(){
    if(!state.result?.ok||!state.result.update_package?.operations?.length)return;
    try{state.preview=dryRun(state.result.update_package);render();}catch(error){alert(`Dry-Run 失敗：${error.message}`);}
  }

  async function doApply(){
    if(!state.preview||state.preview.conflict_count!==0||!state.result?.ok)return;
    if(!confirm('確認套用已逐筆人工確認的糖果目前庫存？\n\nPublic Master gap 列不會寫入。平台不保證與遊戲自動同步；未來遊戲內變動仍需重新上傳／確認。'))return;
    try{
      const applyStarted=perfNow();
      await applyPayload(state.result.update_package);
      state.last_apply_summary={operation_count:state.result.update_package?.operations?.length||0,gap_count:confirmedGapRows().length,applied_at:new Date().toISOString()};
      state.preview=null;
      trace('apply_completed',{elapsed_ms:elapsedMs(applyStarted),operation_count:state.last_apply_summary.operation_count,global_refresh_count:1});
      alert('糖果庫存已套用。Gemini Raw JSON 與 Working/Resolved JSON 仍保留在畫面供稽核；Public Master gap 不會寫入玩家糖果資料。');
      render();
      window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{source:'candy_quantity_screenshot_b5'}}));
    }catch(error){alert(`套用失敗：${error.message}`);}
  }

  function countReviewHtml(){
    const payload=workingPayload();if(!payload)return '';
    const countState=getCandyVisibleTargetCountState(payload);
    if(!countState.mismatch)return '';
    const pass=countState.user_confirmed_matches_observations;
    const confirmed=countState.user_confirmed_visible_target_count;
    const delta=countState.delta===null?'—':countState.delta>0?`+${countState.delta}`:String(countState.delta);
    return `<div class="uc-img-recognition" id="candyB5VisibleTargetCountReview"><b>畫面項目數覆核</b><p class="notice">Gemini 回報 visible_target_count=<b>${esc(countState.provider_visible_target_count)}</b>，但實際 observations.length=<b>${esc(countState.observations_length)}</b>，差異=<b>${esc(delta)}</b>。平台不會自動把兩者改成一致，以免漏辨識被靜默吞掉。</p>${pass?`<div class="status-ready">已人工核對原始畫面：實際共有 <b>${esc(confirmed)}</b> 筆，且與目前 observations.length 一致；Count Gate PASS。Provider 原值 ${esc(countState.provider_visible_target_count)} 仍保留在 Working/Raw evidence。</div>`:`<label>原始遊戲畫面實際項目數 <input id="candyB5VisibleTargetCountInput" type="number" min="0" step="1" value="${esc(countState.observations_length)}" style="max-width:8em"></label><div class="buttons"><button id="candyB5ConfirmVisibleTargetCount">我已核對原始畫面，確認共有 ${esc(countState.observations_length)} 筆</button></div><div class="status-conflict">Count Gate HOLD：必須人工確認實際畫面項目數；若實際數量不等於 observations.length，仍不可進 Dry-Run。</div>`}</div>`;
  }

  function reviewHtml(){
    const unresolved=state.result?.unresolved||[];
    if(!unresolved.length)return '';
    const options=snapshot().rows.map(row=>row.candy_name).filter(Boolean);
    return `<div class="uc-img-recognition"><b>糖果覆核：<span id="candyB5ReviewCount">${unresolved.length}</span></b><p class="notice">identity 確認與 quantity 確認是兩個不同 Gate。OCR 數量只作候選；未逐筆確認前 Dry-Run 保持鎖定。AI 自動 MATCH 另外必須通過「畫面文字 = canonical 糖果名稱」的 exact gate。完成 quantity 確認時會把 exact 遊戲糖果名稱保存為本機 durable authority；公版只補缺／佐證。</p>${unresolved.map(item=>{
      const quantityReview=item.reason===CANDY_QUANTITY_PENDING_REASON;
      if(quantityReview)return `<article class="uc-img-recognition-card" data-id="${esc(item.observation_id)}" data-kind="quantity"><b>${esc(item.canonical_name||item.observed_text||'糖果')}</b> · OCR 候選數量 <b>${esc(item.observed_data?.quantity)}</b><div class="notice">${esc(item.source_image_ref||'—')} · confidence=${esc(item.confidence??'—')} · <code>USER_CONFIRMATION_REQUIRED</code></div><button data-action="quantity">我已核對遊戲畫面，確認數量 ${esc(item.observed_data?.quantity)}</button></article>`;
      const mismatch=item.reason===CANDY_IDENTITY_MISMATCH_REASON;
      return `<article class="uc-img-recognition-card" data-id="${esc(item.observation_id)}" data-kind="identity"><b>${esc(item.status)}</b> · 畫面文字：<b>${esc(item.observed_text||'未讀到文字')}</b><div class="notice">${mismatch?`AI canonical：<b>${esc(item.canonical_name||'—')}</b> · <code>EXACT_IDENTITY_MISMATCH</code> · 不允許自動寫入。`:`辨識值：<code>${esc(JSON.stringify(item.observed_data||{}))}</code> · ${esc(item.reason||'IDENTITY_REVIEW_REQUIRED')}`}</div><select data-candidate><option value="">請選擇公版糖果候選</option>${options.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select><div class="buttons"><button data-action="match">確認 identity</button><button data-action="ignore">辨識誤判／忽略</button><button data-action="gap">確認為 Public Master gap（不寫入）</button></div></article>`;
    }).join('')}</div>`;
  }

  function gapHtml(){
    const gaps=confirmedGapRows();
    if(!gaps.length)return '';
    return `<details class="notice" id="candyB5ConfirmedGaps" open><summary><b>已確認 Public Master gap：${gaps.length}</b>（保留 evidence、不寫入玩家資料）</summary><div>${gaps.map(item=>`<div><code>${esc(item.observation_id||'—')}</code> · ${esc(item.observed_text||'未讀到文字')} · quantity=${esc(item.observed_data?.quantity??'未提供')} · ${esc(item.source_image_ref||'—')}</div>`).join('')}</div></details>`;
  }

  function evidenceHtml(){
    const operationJson=state.result?.update_package?JSON.stringify(state.result.update_package,null,2):'';
    return `<details class="notice" id="candyB5Evidence" open><summary><b>Evidence / JSON 分層</b></summary>
      <p><b>1. Gemini Raw JSON（唯讀、immutable）</b><br>這是 Gemini provider 原始回傳；人工 count、identity、Master gap、quantity 覆核永遠不會改寫此欄。來源：<code>${esc(state.provider_raw_source||'尚未建立')}</code></p>
      <textarea id="candyB5ProviderRaw" readonly style="width:100%;min-height:180px" placeholder="Gemini 成功後保留原始 provider JSON">${esc(state.provider_raw)}</textarea>
      <div class="buttons"><button id="candyB5CopyRaw" ${state.provider_raw?'':'disabled'}>複製 Gemini Raw JSON</button><button id="candyB5ResetWorking" ${state.provider_raw?'':'disabled'}>從 Raw 重設 Working JSON</button></div>
      <p><b>2. Working / Resolved Recognition JSON</b><br>人工 count、公版比對與人工覆核只修改這一層。外部 AI 流程第一次按「解析／覆核」時，會先把當下內容鎖定成 Raw evidence。</p>
      <textarea id="candyB5WorkingJson" style="width:100%;min-height:180px" placeholder="內部 Gemini 成功後自動填入；也可貼入外部 AI JSON">${esc(state.working_raw)}</textarea>
      <p><b>3. Compile / Update Package（唯讀）</b><br>這才是 Dry-Run 前的實際 operation/candy_id；Public Master gap 不會出現在 operations。</p>
      <textarea id="candyB5CompiledJson" readonly style="width:100%;min-height:180px">${esc(operationJson)}</textarea>
    </details>`;
  }

  function render(){
    const errors=state.result?.errors||[],warnings=state.result?.warnings||[],pending=state.result?.unresolved||[];
    const confirmed=state.result?.summary?.candy_quantity_confirmed_count||0;
    const gapCount=state.result?.summary?.candy_public_master_gap_confirmed_count||confirmedGapRows().length;
    const identityPending=state.result?.summary?.candy_identity_pending_count||0;
    const operationCount=state.result?.update_package?.operations?.length||0;
    const payload=workingPayload();
    const countState=payload?(state.result?.candy_visible_target_count||getCandyVisibleTargetCountState(payload)):null;
    section.innerHTML=`<h3>糖果截圖庫存覆核 <small>P0-B5 / v0.4.27.55.3</small></h3>
      <p class="notice"><b>OCR／AI 讀到的糖果數量只是候選值，不會直接寫入。</b> 每一筆必須由你查看目前遊戲畫面後再按一次數量確認；identity MATCH 不等於 quantity 確認。0 是合法值，但也必須人工確認。平台不保證遊戲外部變動自動同步。</p>
      <p class="notice"><b>Candy identity authority：</b>寶可夢／糖果繁中名稱採 <b>Local-first / Public-supplemental</b>。Gemini canonical 名稱若與 observed_text 不一致仍強制人工覆核；exact 名稱在 quantity 確認後會保存為本機 durable authority，公版更新不得靜默覆蓋。</p>
      <p class="notice"><b>.55.3 Mobile Performance：</b>逐筆 quantity confirmation 仍執行 durable authority readback 與完整 compile，但只局部更新本區塊；全站 Candy refresh 延後到 Apply 成功後一次執行。</p>
      <p class="notice">Quantity Authority：<code>${esc(CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION)}</code> · Local Name Authority：<code>${esc(PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION)}</code> · Count Authority：<code>${esc(CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION)}</code> · Count Gate：<b>${esc(countState?.gate_status||'—')}</b> · 已確認數量：<b id="candyB5ConfirmedCount">${confirmed}</b> · identity 待確認：<b>${identityPending}</b> · 已確認 Master gap：<b>${gapCount}</b> · 待覆核：<b id="candyB5PendingCount">${pending.length}</b> · Provider：${esc(state.provider||'—')}</p>
      <label>選擇糖果庫存截圖 <input id="candyB5Files" type="file" accept="image/*" multiple></label>
      <div class="notice">已選：${state.entries.map(item=>esc(item.file_name)).join('、')||'尚未選擇'}</div>
      <div class="buttons"><button id="candyB5Gemini" ${state.entries.length&&!state.busy?'':'disabled'}>${state.busy?'Gemini 分析中…':'Gemini API 直接分析'}</button><button id="candyB5Prompt" ${state.entries.length?'':'disabled'}>複製外部 AI Prompt</button></div>
      ${evidenceHtml()}
      ${countReviewHtml()}
      <div class="buttons"><button id="candyB5Parse">解析／覆核</button><button id="candyB5Dry" ${state.result?.ok&&!pending.length&&operationCount>0?'':'disabled'}>Dry-Run</button><button id="candyB5Apply" ${state.preview&&state.preview.conflict_count===0&&state.result?.ok?'':'disabled'}>套用已確認數量</button></div>
      ${errors.map(value=>`<div class="status-conflict">錯誤：${esc(value)}</div>`).join('')}${warnings.map(value=>`<div>警告：${esc(value)}</div>`).join('')}
      ${reviewHtml()}
      ${gapHtml()}
      <div id="candyB5GateStatus" class="${state.result?.ok&&operationCount>0?'status-ready':'notice'}">${state.result?.ok&&operationCount>0?`B5 confirmation Gate PASS：${operationCount} 筆 operation 可進 Dry-Run；${gapCount} 筆 Public Master gap 僅保留 evidence，不寫入。`:`逐筆確認採局部更新；尚未完成所有 Gate 時 Dry-Run 保持鎖定。`}</div>
      ${state.result?.ok&&operationCount===0&&gapCount>0?`<div class="notice">本次只有已確認 Public Master gap，沒有可安全寫入的糖果 operation；不需要執行 Dry-Run。</div>`:''}
      ${state.preview?`<div class="notice">Dry-Run：ready=<b>${state.preview.ready_count}</b> / conflict=<b>${state.preview.conflict_count}</b></div>`:''}
      ${state.last_apply_summary?`<div class="status-ready">已套用 ${state.last_apply_summary.operation_count} 筆；gap=${state.last_apply_summary.gap_count}；${esc(state.last_apply_summary.applied_at)}。Raw/Working evidence 保留中。</div>`:''}`;
    section.querySelector('#candyB5Files').onchange=event=>selectFiles([...event.target.files]).catch(error=>alert(`圖片讀取失敗：${error.message}`));
    section.querySelector('#candyB5Gemini').onclick=runInternal;
    section.querySelector('#candyB5Prompt').onclick=()=>copyText(prompt()).then(()=>alert('B5 外部 AI Prompt 已複製。')).catch(error=>alert(error.message));
    section.querySelector('#candyB5WorkingJson').oninput=event=>{state.working_raw=event.target.value;state.result=null;state.preview=null;state.last_apply_summary=null;};
    section.querySelector('#candyB5CopyRaw').onclick=()=>copyText(state.provider_raw).then(()=>alert('Gemini Raw JSON 已複製；內容未經公版或人工覆核改寫。')).catch(error=>alert(error.message));
    section.querySelector('#candyB5ResetWorking').onclick=()=>{if(!state.provider_raw)return;state.working_raw=state.provider_raw;state.result=null;state.preview=null;state.last_apply_summary=null;parse();};
    section.querySelector('#candyB5Parse').onclick=parse;
    section.querySelector('#candyB5Dry').onclick=doDryRun;
    section.querySelector('#candyB5Apply').onclick=doApply;
    const countButton=section.querySelector('#candyB5ConfirmVisibleTargetCount');if(countButton)countButton.onclick=confirmVisibleTargetCount;
    const countInput=section.querySelector('#candyB5VisibleTargetCountInput');if(countInput)countInput.oninput=()=>{if(countButton)countButton.textContent=`我已核對原始畫面，確認共有 ${countInput.value} 筆`;};
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