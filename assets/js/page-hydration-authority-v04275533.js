import {debugTrace} from './debug-trace-manager.js';

export const PAGE_HYDRATION_AUTHORITY_VERSION='v0.4.27.55.3.3-page-hydration-authority-2026-09-04-a';

const pageLoads=new Map();
const qs=(selector,root=document)=>root?.querySelector?.(selector)||null;
const qsa=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
const yieldUi=()=>new Promise(resolve=>{
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(resolve,0));
  else setTimeout(resolve,0);
});
const trace=(event,details={},status='completed',error=null)=>debugTrace.record('page_hydration',event,{status,details:{authority:PAGE_HYDRATION_AUTHORITY_VERSION,...details},error});

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

export function canonicalizeImportHistoryDom(){
  const updates=document.getElementById('updates');
  if(!updates)return {ok:false,reason:'updates_missing'};
  let details=document.getElementById('importHistoryDetailsV042745');
  const tables=qsa('#historyTable');
  let table=tables[0]||null;
  if(tables.length>1){for(const duplicate of tables.slice(1))duplicate.remove();}
  let wrap=document.getElementById('importHistoryWrap');
  if(!wrap&&table){wrap=document.createElement('div');wrap.id='importHistoryWrap';wrap.className='table-wrap';table.replaceWith(wrap);wrap.appendChild(table);}
  if(!details){
    details=document.createElement('details');details.id='importHistoryDetailsV042745';details.dataset.defaultCollapsed='true';
    const summary=document.createElement('summary');summary.textContent='匯入歷程（預設收合，點此展開）';details.appendChild(summary);
    updates.appendChild(details);
  }
  let summary=details.querySelector(':scope > summary');
  if(!summary){summary=document.createElement('summary');summary.textContent='匯入歷程（預設收合，點此展開）';details.prepend(summary);}
  const exportButton=document.getElementById('exportImportHistoryJsonBtnV042745');
  if(exportButton&&!details.contains(exportButton)){
    let controls=details.querySelector(':scope > .buttons');
    if(!controls){controls=document.createElement('div');controls.className='buttons';summary.insertAdjacentElement('afterend',controls);}
    controls.appendChild(exportButton);
  }
  if(wrap&&!details.contains(wrap))details.appendChild(wrap);
  if(table&&wrap&&!wrap.contains(table))wrap.appendChild(table);
  if(details.dataset.v04275533Owned!=='true'){
    details.dataset.v04275533Owned='true';
    details.open=false;
    details.addEventListener('toggle',()=>trace('import_history_toggle',{open:details.open,row_count:table?.tBodies?.[0]?.rows?.length||0,contained:Boolean(wrap&&details.contains(wrap)&&table&&wrap.contains(table))}));
  }
  const ok=Boolean(details&&wrap&&table&&details.contains(wrap)&&wrap.contains(table)&&qsa('#importHistoryDetailsV042745').length===1&&qsa('#importHistoryWrap').length===1&&qsa('#historyTable').length===1);
  details.dataset.domOwnership=ok?'single-owner':'invalid';
  trace('import_history_dom_ownership_checked',{ok,details_count:qsa('#importHistoryDetailsV042745').length,wrap_count:qsa('#importHistoryWrap').length,table_count:qsa('#historyTable').length,details_contains_wrap:Boolean(wrap&&details.contains(wrap)),wrap_contains_table:Boolean(table&&wrap?.contains(table)),default_collapsed:!details.open},ok?'completed':'failed');
  return {ok,details,wrap,table};
}

function ensureKnowledgeSlots(){
  const panel=document.getElementById('sharedKnowledgePanel');if(!panel)return null;
  let pokemonSlot=document.getElementById('knowledgePokemonSlot');
  let candySlot=document.getElementById('knowledgeCandySlot');
  if(!pokemonSlot){pokemonSlot=document.createElement('section');pokemonSlot.id='knowledgePokemonSlot';pokemonSlot.dataset.renderOwner='shared-knowledge-ui';}
  if(!candySlot){candySlot=document.createElement('section');candySlot.id='knowledgeCandySlot';candySlot.dataset.renderOwner='candy-inventory-ui';}
  const children=[...panel.children].filter(node=>node!==pokemonSlot&&node!==candySlot);
  for(const node of children){
    if(node.id==='candyMasterBlock')candySlot.appendChild(node);
    else pokemonSlot.appendChild(node);
  }
  if(!panel.contains(pokemonSlot))panel.appendChild(pokemonSlot);
  if(!panel.contains(candySlot))panel.appendChild(candySlot);
  panel.classList.remove('loading-placeholder');
  panel.dataset.pageHydration='ready';
  return {panel,pokemonSlot,candySlot};
}

export async function hydrateKnowledge(){
  const started=performance.now();
  const [knowledge,candy]=await Promise.all([import('./shared-knowledge-ui.js'),import('./candy-inventory-ui.js')]);
  await knowledge.renderSharedKnowledge?.();
  candy.renderCandySurfaces?.();
  await yieldUi();
  const slots=ensureKnowledgeSlots();
  candy.renderCandySurfaces?.();
  await yieldUi();
  if(slots){
    const candyBlock=document.getElementById('candyMasterBlock');
    if(candyBlock&&!slots.candySlot.contains(candyBlock))slots.candySlot.appendChild(candyBlock);
  }
  const ok=Boolean(slots&&document.getElementById('berryMasterTable')&&document.getElementById('candyMasterTable')&&slots.pokemonSlot.contains(document.getElementById('berryMasterTable')?.closest('div.table-wrap')||document.getElementById('berryMasterTable'))&&slots.candySlot.contains(document.getElementById('candyMasterBlock')));
  trace('knowledge_page_hydrated',{ok,elapsed_ms:Math.round(performance.now()-started),single_owner_slots:true,candy_persistent:Boolean(document.getElementById('candyMasterTable'))},ok?'completed':'failed');
  return {ok,elapsed_ms:Math.round(performance.now()-started)};
}

function moveIntoShell(node,shell){if(node&&shell&&!shell.contains(node))shell.appendChild(node);}
function removeStaticPlaceholder(shell){for(const node of qsa(':scope > p.notice',shell)){if(/功能框架已就緒|需要時載入|載入.*工具/.test(node.textContent||''))node.remove();}}

export async function hydrateUpdateCenter(){
  const started=performance.now();
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
  for(let attempt=0;attempt<8;attempt++){await yieldUi();if(document.getElementById('candyQuantityScreenshotB5')&&document.getElementById('analysisConfirmationWorkbench'))break;}
  const candyRoot=document.getElementById('candyQuantityScreenshotB5');
  const analysisHeading=document.getElementById('analysisConfirmationHeading');
  const analysisRoot=document.getElementById('analysisConfirmationWorkbench');
  const identityHeading=document.getElementById('identityImportWizardHeading');
  const identityRoot=document.getElementById('identityImportWizardRoot');
  const screenshotRoot=document.getElementById('ucImgA');
  moveIntoShell(candyRoot,candyShell);
  moveIntoShell(analysisHeading,analysisShell);moveIntoShell(analysisRoot,analysisShell);
  moveIntoShell(identityHeading,ocrShell);moveIntoShell(identityRoot,ocrShell);moveIntoShell(screenshotRoot,ocrShell);
  const candyReady=Boolean(candyRoot&&candyShell?.contains(candyRoot));
  const analysisReady=Boolean(analysisRoot&&analysisShell?.contains(analysisRoot));
  const ocrReady=Boolean((identityRoot||screenshotRoot)&&ocrShell&&(identityRoot?ocrShell.contains(identityRoot):true)&&(screenshotRoot?ocrShell.contains(screenshotRoot):true));
  if(candyReady){removeStaticPlaceholder(candyShell);markShell(candyShell,'ready');}else markShell(candyShell,'failed','糖果覆核工具未完成掛載。');
  if(analysisReady){removeStaticPlaceholder(analysisShell);markShell(analysisShell,'ready');}else markShell(analysisShell,'failed','AI／OCR 結果確認未完成掛載。');
  if(ocrReady){removeStaticPlaceholder(ocrShell);markShell(ocrShell,'ready');}else markShell(ocrShell,'pending','進階 OCR 工具等待匯入工作啟用。');
  canonicalizeImportHistoryDom();
  const ok=candyReady&&analysisReady;
  trace('update_center_page_hydrated',{ok,candy_ready:candyReady,analysis_ready:analysisReady,ocr_ready:ocrReady,elapsed_ms:Math.round(performance.now()-started),static_shell_real_mount_authority:true},ok?'completed':'warning');
  return {ok,candy_ready:candyReady,analysis_ready:analysisReady,ocr_ready:ocrReady};
}

export async function hydrateView(view){
  const page=String(view||'');
  if(!['updates','knowledge'].includes(page)){if(page==='updates')canonicalizeImportHistoryDom();return {page,owned:false};}
  if(pageLoads.has(page))return pageLoads.get(page);
  const promise=(page==='updates'?hydrateUpdateCenter():hydrateKnowledge()).then(result=>({page,owned:true,...result})).catch(error=>{pageLoads.delete(page);trace('page_hydration_failed',{page,message:error?.message||String(error)},'failed',error);throw error;});
  pageLoads.set(page,promise);return promise;
}

function install(){
  canonicalizeImportHistoryDom();
  document.querySelector('nav')?.addEventListener('click',event=>{
    const button=event.target?.closest?.('button[data-view]');if(!button)return;
    const view=button.dataset.view;
    queueMicrotask(()=>{if(view==='updates')canonicalizeImportHistoryDom();void hydrateView(view).catch(()=>{});});
  },true);
  globalThis.addEventListener('pokemon-sleep:data-changed',()=>{
    if(document.querySelector('.view.active')?.id==='knowledge'){pageLoads.delete('knowledge');void hydrateKnowledge().catch(()=>{});}
    if(document.querySelector('.view.active')?.id==='updates')canonicalizeImportHistoryDom();
  });
  globalThis.PokemonSleepPageHydrationAuthorityV04275533=Object.freeze({version:PAGE_HYDRATION_AUTHORITY_VERSION,hydrateView,hydrateKnowledge,hydrateUpdateCenter,canonicalizeImportHistoryDom,loadedPages:()=>[...pageLoads.keys()]});
  trace('page_hydration_authority_ready',{single_owner_render:true,navigation_is_not_data_mutation:true,import_history_dom_ownership:true,knowledge_fixed_slots:true,update_center_real_mount_gate:true});
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
