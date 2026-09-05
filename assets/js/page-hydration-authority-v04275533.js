import {debugTrace} from './debug-trace-manager.js';

export const PAGE_HYDRATION_AUTHORITY_VERSION='v0.4.27.55.3.3.1-page-prewarm-collapsible-hydration-2026-09-05-a';

const pageLoads=new Map();
const qs=(selector,root=document)=>root?.querySelector?.(selector)||null;
const qsa=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const trace=(event,details={},status='completed',error=null)=>debugTrace.record('page_hydration',event,{status,details:{authority:PAGE_HYDRATION_AUTHORITY_VERSION,...details},error});
const idle=callback=>{if(typeof requestIdleCallback==='function')requestIdleCallback(callback,{timeout:900});else setTimeout(callback,0);};
const pageProgress=(page,state,message,details={})=>globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:page-hydration-progress',{detail:{page,state,message,...details}}));

function markShell(shell,state,message=null){
  if(!shell)return;
  shell.dataset.hydrationState=state;
  shell.classList.toggle('loading-placeholder',state!=='ready');
  if(message){
    let note=shell.querySelector(':scope > [data-page-hydration-note]');
    if(!note){note=document.createElement('p');note.className='notice';note.dataset.pageHydrationNote='true';shell.prepend(note);}
    note.textContent=message;
  }else shell.querySelector(':scope > [data-page-hydration-note]')?.remove();
}

let historyObserver=null;
let historyRepairQueued=false;
let historyDataCache=null;
let historyFormatLocal=null;
async function prewarmImportHistory({force=false}={}){
  if(historyDataCache&&!force)return historyDataCache;
  const started=performance.now();
  const [{rows},{formatLocal}]=await Promise.all([import('./database.js'),import('./time-utils.js')]);
  historyFormatLocal=formatLocal;
  historyDataCache=rows('SELECT * FROM import_batches ORDER BY imported_at DESC LIMIT 100');
  trace('import_history_data_prewarmed',{row_count:historyDataCache.length,elapsed_ms:Math.round(performance.now()-started),dom_materialized:false});
  return historyDataCache;
}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
async function materializeImportHistory(){
  const owned=canonicalizeImportHistoryDom();if(!owned.ok||!owned.details.open)return false;
  pageProgress('updates','loading','更新中心：建立匯入歷程表格…',{surface:'import-history'});
  const data=await prewarmImportHistory();
  const table=owned.table;
  const body=data.map(row=>`<tr><td>${esc(row.update_id)}</td><td>${esc(row.schema_version)}</td><td>${esc(row.source)}</td><td>${esc(row.operation_count)}</td><td>${esc(historyFormatLocal?.(row.imported_at)||row.imported_at||'')}</td></tr>`).join('');
  table.innerHTML=`<thead><tr><th>Update ID</th><th>Schema</th><th>來源</th><th>操作</th><th>匯入時間</th></tr></thead><tbody>${body||'<tr><td colspan="5">目前沒有資料</td></tr>'}</tbody>`;
  owned.content.dataset.materialized='true';
  pageProgress('updates','ready',`更新中心：匯入歷程已建立（${data.length} 筆）`,{surface:'import-history',row_count:data.length});
  return true;
}
function syncHistoryCollapsed(details,content){
  if(!details||!content)return;
  const collapsed=!details.open;
  content.hidden=collapsed;
  content.setAttribute('aria-hidden',String(collapsed));
  details.dataset.collapsed=String(collapsed);
}
export function canonicalizeImportHistoryDom(){
  const updates=document.getElementById('updates');if(!updates)return {ok:false,reason:'updates_missing'};
  let details=document.getElementById('importHistoryDetailsV042745');
  if(!details){
    details=document.createElement('details');details.id='importHistoryDetailsV042745';details.dataset.defaultCollapsed='true';
    const summary=document.createElement('summary');summary.textContent='匯入歷程（預設收合，點此展開）';details.appendChild(summary);updates.appendChild(details);
  }
  let summary=details.querySelector(':scope > summary');
  if(!summary){summary=document.createElement('summary');summary.textContent='匯入歷程（預設收合，點此展開）';details.prepend(summary);}
  let content=document.getElementById('importHistoryContentV042755331');
  if(!content){content=document.createElement('div');content.id='importHistoryContentV042755331';content.dataset.importHistoryContent='true';details.appendChild(content);}
  else if(!details.contains(content))details.appendChild(content);

  let heading=document.getElementById('importHistoryHeading');
  if(!heading){heading=document.createElement('h3');heading.id='importHistoryHeading';heading.hidden=true;heading.textContent='匯入歷程';content.prepend(heading);}
  else if(!content.contains(heading))content.prepend(heading);

  const exportButton=document.getElementById('exportImportHistoryJsonBtnV042745');
  if(exportButton&&!content.contains(exportButton)){
    let controls=content.querySelector(':scope > .buttons');
    if(!controls){controls=document.createElement('div');controls.className='buttons';heading.insertAdjacentElement('afterend',controls);}
    controls.appendChild(exportButton);
  }

  const tables=qsa('#historyTable');let table=tables[0]||null;
  for(const duplicate of tables.slice(1))duplicate.remove();
  let wrap=document.getElementById('importHistoryWrap');
  if(!wrap){wrap=document.createElement('div');wrap.id='importHistoryWrap';wrap.className='table-wrap';content.appendChild(wrap);}
  else if(!content.contains(wrap))content.appendChild(wrap);
  if(!table){table=document.createElement('table');table.id='historyTable';wrap.appendChild(table);}
  else if(!wrap.contains(table))wrap.appendChild(table);

  if(details.dataset.v042755331Owned!=='true'){
    details.dataset.v042755331Owned='true';details.open=false;syncHistoryCollapsed(details,content);
    details.addEventListener('toggle',()=>{syncHistoryCollapsed(details,content);trace('import_history_toggle',{open:details.open,row_count:table?.tBodies?.[0]?.rows?.length||0,contained:details.contains(content)&&content.contains(wrap)&&wrap.contains(table)});if(details.open)void materializeImportHistory();});
  }else syncHistoryCollapsed(details,content);

  if(!historyObserver){
    const observe=()=>historyObserver?.observe(updates,{subtree:true,childList:true});
    historyObserver=new MutationObserver(()=>{
      if(historyRepairQueued)return;historyRepairQueued=true;
      // Ownership repair must never live in the MutationObserver microtask queue itself.
      // Legacy/update-center mounts may move the same nodes during startup; yielding to a
      // task prevents a repair ping-pong from starving App Ready and Playwright/browser input.
      setTimeout(()=>{
        historyRepairQueued=false;
        const currentDetails=document.getElementById('importHistoryDetailsV042745'),currentContent=document.getElementById('importHistoryContentV042755331'),currentWrap=document.getElementById('importHistoryWrap'),currentTable=document.getElementById('historyTable');
        const broken=Boolean(currentDetails&&currentContent&&currentWrap&&currentTable&&(!currentDetails.contains(currentContent)||!currentContent.contains(currentWrap)||!currentWrap.contains(currentTable)));
        if(!broken)return;
        historyObserver.disconnect();
        try{canonicalizeImportHistoryDom();}
        finally{observe();}
      },0);
    });
    observe();
  }
  const ok=Boolean(details&&content&&wrap&&table&&details.contains(content)&&content.contains(wrap)&&wrap.contains(table)&&qsa('#importHistoryDetailsV042745').length===1&&qsa('#importHistoryWrap').length===1&&qsa('#historyTable').length===1);
  details.dataset.domOwnership=ok?'single-owner':'invalid';
  trace('import_history_dom_ownership_checked',{ok,details_count:qsa('#importHistoryDetailsV042745').length,wrap_count:qsa('#importHistoryWrap').length,table_count:qsa('#historyTable').length,details_contains_content:details.contains(content),content_contains_wrap:content.contains(wrap),wrap_contains_table:wrap.contains(table),default_collapsed:!details.open,explicit_hidden_contract:true},ok?'completed':'failed');
  return {ok,details,content,wrap,table};
}

function ensureKnowledgeSlots(){
  const panel=document.getElementById('sharedKnowledgePanel');if(!panel)return null;
  let pokemonSlot=document.getElementById('knowledgePokemonSlot');
  let candySlot=document.getElementById('knowledgeCandySlot');
  if(!pokemonSlot){pokemonSlot=document.createElement('section');pokemonSlot.id='knowledgePokemonSlot';pokemonSlot.dataset.renderOwner='shared-knowledge-ui';panel.prepend(pokemonSlot);}
  if(!candySlot){candySlot=document.createElement('section');candySlot.id='knowledgeCandySlot';candySlot.dataset.renderOwner='candy-inventory-ui';panel.appendChild(candySlot);}
  if(panel.firstElementChild!==pokemonSlot)panel.prepend(pokemonSlot);
  if(panel.lastElementChild!==candySlot)panel.appendChild(candySlot);
  panel.classList.remove('loading-placeholder');panel.dataset.pageLayout='fixed';
  return {panel,pokemonSlot,candySlot};
}

export async function prewarmKnowledgeData({force=false}={}){
  const started=performance.now();
  const [knowledge,candy]=await Promise.all([import('./shared-knowledge-ui.js'),import('./candy-inventory-ui.js')]);
  const [knowledgeCache,candyCache]=await Promise.all([
    Promise.resolve(knowledge.prewarmSharedKnowledge?.({force})),
    Promise.resolve(candy.prewarmCandyData?.({force})),
  ]);
  const slots=ensureKnowledgeSlots();
  const details=document.getElementById('candyMasterDetailsV042755331');if(details)details.dataset.dataReady='true';
  trace('knowledge_data_prewarmed',{elapsed_ms:Math.round(performance.now()-started),knowledge_ready:Boolean(knowledgeCache?.ready),candy_ready:Boolean(candyCache?.ready),dom_materialized:false,fixed_slots:Boolean(slots)});
  return {knowledge,candy,slots,knowledgeCache,candyCache};
}

export async function hydrateKnowledge(){
  const started=performance.now();pageProgress('knowledge','loading','資料百科：使用已預熱本機資料建立表格…',{phase:'materialize'});
  const {knowledge,candy,slots}=await prewarmKnowledgeData();
  await knowledge.renderSharedKnowledge?.();
  candy.renderCandySurfaces?.();
  const details=document.getElementById('candyMasterDetailsV042755331');
  if(details?.open)await candy.materializeCandyMaster?.();
  const berry=document.getElementById('berryMasterTable');
  const ok=Boolean(slots&&berry&&slots.pokemonSlot.contains(berry.closest('div.table-wrap')||berry)&&details&&slots.candySlot.contains(details)&&details.dataset.dataReady==='true');
  trace('knowledge_page_hydrated',{ok,elapsed_ms:Math.round(performance.now()-started),single_owner_slots:true,candy_collapsed_default:Boolean(details&&!details.open),candy_dom_materialized:document.getElementById('candyMasterContentV042755331')?.dataset?.materialized==='true'},ok?'completed':'failed');
  pageProgress('knowledge',ok?'ready':'failed',ok?'資料百科：表格載入完成；糖果 Master 預設收合':'資料百科：載入未完成',{phase:'materialize'});
  return {ok,elapsed_ms:Math.round(performance.now()-started)};
}

function moveIntoShell(node,shell){if(node&&shell&&!shell.contains(node))shell.appendChild(node);}
function removeStaticPlaceholder(shell){for(const node of qsa(':scope > p.notice',shell)){if(/功能框架已就緒|需要時載入|載入.*工具/.test(node.textContent||''))node.remove();}}
function mountReady(){
  const candy=document.getElementById('candyQuantityScreenshotB5');
  const analysis=document.getElementById('analysisConfirmationWorkbench');
  return Boolean(candy?.querySelector('#candyB5Parse')&&candy?.querySelector('#candyB5GateStatus')&&analysis?.querySelector('#analysisConfirmationStatus'));
}
function waitForUpdateCenterMounts(timeoutMs=4500){
  if(mountReady())return Promise.resolve(true);
  return new Promise(resolve=>{
    const root=document.getElementById('updates')||document.documentElement;
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;observer.disconnect();clearTimeout(timer);resolve(value);};
    const observer=new MutationObserver(()=>{if(mountReady())finish(true);});
    observer.observe(root,{subtree:true,childList:true});
    const timer=setTimeout(()=>finish(mountReady()),timeoutMs);
  });
}
export async function hydrateUpdateCenter(){
  const started=performance.now();pageProgress('updates','loading','更新中心：載入糖果／AI／OCR 工具…',{phase:'module-mount'});
  const candyShell=document.getElementById('updateCenterCandyStaticShell');
  const analysisShell=document.getElementById('updateCenterAnalysisStaticShell');
  const ocrShell=document.getElementById('updateCenterOcrStaticShell');
  markShell(candyShell,'loading','正在載入糖果截圖庫存覆核…');
  markShell(analysisShell,'loading','正在載入 AI／OCR 結果確認…');
  markShell(ocrShell,'loading','正在載入進階 OCR／匯入工具…');
  canonicalizeImportHistoryDom();
  await Promise.all([
    import('./candy-quantity-screenshot-ui.js'),
    import('./analysis-confirmation-workbench.js'),
    import('./identity-import-wizard-entry.js'),
    import('./unified-screenshot-update-center.js'),
    import('./data1d1-ocr-overlay-preview-event-wiring.js'),
  ]);
  await waitForUpdateCenterMounts();
  const candyRoot=document.getElementById('candyQuantityScreenshotB5');
  const analysisHeading=document.getElementById('analysisConfirmationHeading');
  const analysisRoot=document.getElementById('analysisConfirmationWorkbench');
  const identityHeading=document.getElementById('identityImportWizardHeading');
  const identityRoot=document.getElementById('identityImportWizardRoot');
  const screenshotRoot=document.getElementById('ucImgA');
  moveIntoShell(candyRoot,candyShell);
  moveIntoShell(analysisHeading,analysisShell);moveIntoShell(analysisRoot,analysisShell);
  moveIntoShell(identityHeading,ocrShell);moveIntoShell(identityRoot,ocrShell);moveIntoShell(screenshotRoot,ocrShell);

  const candyReady=Boolean(candyRoot&&candyShell?.contains(candyRoot)&&candyRoot.querySelector('#candyB5Parse')&&candyRoot.querySelector('#candyB5GateStatus'));
  const analysisReady=Boolean(analysisRoot&&analysisShell?.contains(analysisRoot)&&analysisRoot.querySelector('#analysisConfirmationStatus'));
  const ocrReady=Boolean((identityRoot||screenshotRoot)&&ocrShell&&(identityRoot?ocrShell.contains(identityRoot):true)&&(screenshotRoot?ocrShell.contains(screenshotRoot):true));
  if(candyReady){removeStaticPlaceholder(candyShell);markShell(candyShell,'ready');}else markShell(candyShell,'failed','糖果覆核工具尚未完成控制項掛載。');
  if(analysisReady){removeStaticPlaceholder(analysisShell);markShell(analysisShell,'ready');}else markShell(analysisShell,'failed','AI／OCR 結果確認尚未完成控制項掛載。');
  if(ocrReady){removeStaticPlaceholder(ocrShell);markShell(ocrShell,'ready');}else markShell(ocrShell,'pending','進階 OCR 工具等待匯入工作啟用。');
  canonicalizeImportHistoryDom();
  const ok=candyReady&&analysisReady;
  trace('update_center_page_hydrated',{ok,candy_ready:candyReady,analysis_ready:analysisReady,ocr_ready:ocrReady,elapsed_ms:Math.round(performance.now()-started),static_shell_real_mount_authority:true,root_only_ready_forbidden:true},ok?'completed':'warning');
  pageProgress('updates',ok?'ready':'failed',ok?'更新中心：糖果／AI 覆核工具載入完成':'更新中心：仍有工具未完成載入',{candy_ready:candyReady,analysis_ready:analysisReady,ocr_ready:ocrReady});
  return {ok,candy_ready:candyReady,analysis_ready:analysisReady,ocr_ready:ocrReady};
}

export async function hydrateView(view){
  const page=String(view||'');
  if(!['updates','knowledge'].includes(page))return {page,owned:false};
  if(pageLoads.has(page))return pageLoads.get(page);
  const promise=(page==='updates'?hydrateUpdateCenter():hydrateKnowledge()).then(result=>({page,owned:true,...result})).catch(error=>{pageLoads.delete(page);pageProgress(page,'failed',`${page==='updates'?'更新中心':'資料百科'}：載入失敗`);trace('page_hydration_failed',{page,message:error?.message||String(error)},'failed',error);throw error;});
  pageLoads.set(page,promise);return promise;
}
export function invalidatePage(view){
  pageLoads.delete(String(view||''));
  if(view==='updates')historyDataCache=null;
}
function scheduleIdlePrewarm(){
  idle(()=>void Promise.allSettled([prewarmKnowledgeData(),prewarmImportHistory()]).then(results=>trace('page_data_idle_prewarm_completed',{result_count:results.length,fulfilled:results.filter(item=>item.status==='fulfilled').length,dom_materialized:false})));
}
function install(){
  canonicalizeImportHistoryDom();ensureKnowledgeSlots();
  document.querySelector('nav')?.addEventListener('click',event=>{
    const button=event.target?.closest?.('button[data-view]');if(!button)return;
    const view=button.dataset.view;
    queueMicrotask(()=>{if(view==='updates')canonicalizeImportHistoryDom();void hydrateView(view).catch(()=>{});});
  },true);
  globalThis.addEventListener('pokemon-sleep:app-ready',scheduleIdlePrewarm,{once:true});
  globalThis.addEventListener('pokemon-sleep:data-changed',event=>{
    const entity=event?.detail?.entity||'';
    if(document.querySelector('.view.active')?.id==='knowledge'){pageLoads.delete('knowledge');void hydrateKnowledge().catch(()=>{});}
    if(document.querySelector('.view.active')?.id==='updates'){historyDataCache=null;canonicalizeImportHistoryDom();if(document.getElementById('importHistoryDetailsV042745')?.open)void materializeImportHistory();}
    if(entity==='import_batches'||entity==='import_changes')historyDataCache=null;
  });
  const api=Object.freeze({version:PAGE_HYDRATION_AUTHORITY_VERSION,hydrateView,hydrateKnowledge,hydrateUpdateCenter,prewarmKnowledgeData,canonicalizeImportHistoryDom,prewarmImportHistory,materializeImportHistory,invalidatePage,loadedPages:()=>[...pageLoads.keys()]});
  globalThis.PokemonSleepPageHydrationAuthorityV042755331=api;
  globalThis.PokemonSleepPageHydrationAuthorityV04275533=api;
  trace('page_hydration_authority_ready',{single_owner_render:true,navigation_is_not_data_mutation:true,import_history_dom_ownership:true,import_history_explicit_hidden_contract:true,knowledge_fixed_slots:true,candy_collapsed_lazy_materialization:true,page_data_idle_prewarm:true,update_center_real_mount_gate:true});
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}