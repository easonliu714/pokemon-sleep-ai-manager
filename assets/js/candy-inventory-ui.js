import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {buildPublicCandyMasterRows,PUBLIC_CANDY_MASTER_VERSION,SPECIES_CANDY_NAME_RULE_VERSION} from './public-candy-master.js';
import {
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  resolvePublicCandyDisplayNameForSpecies,
} from './public-candy-display-name-authority.js';
import {CANDY_FAMILY_STORAGE_AUTHORITY_VERSION} from './candy-family-storage-authority.js';
import {relevantResourceSnapshot,CANDY_CONVERSION_RULE_STATUS} from './resource-context.js';
import {formatLocal} from './time-utils.js';

export const CANDY_INVENTORY_WRITE_AUTHORITY_VERSION='v0.4.27.55-p0-b6-family-storage-2026-09-01-a';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const typeLabel=value=>({universal:'萬能',type:'屬性',species:'寶可夢',other_verified:'其他'}[value]||value||'—');
const targetLabel=row=>row.target_species_name||row.target_type_name||'—';
const activeView=()=>document.querySelector('.view.active')?.id||'dashboard';
const candyCache={ready:false,masterRows:null,inventoryRows:null,audit:null,resourceSnapshot:null,revision:0};
const idle=callback=>{if(typeof requestIdleCallback==='function')requestIdleCallback(callback,{timeout:800});else setTimeout(callback,0);};
const pageProgress=(state,message,details={})=>globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:page-hydration-progress',{detail:{page:activeView()==='knowledge'?'knowledge':'items',state,message,...details}}));
const CANDY_MASTER_BATCH_SIZE=24;
let candyMasterRenderGeneration=0;
let candyMasterMaterializationPromise=null;
const yieldToPaint=()=>new Promise(resolve=>{
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(resolve,0));
  else setTimeout(resolve,0);
});

function ensureCandyMasterProgressOverlay(){
  let overlay=document.getElementById('candyMasterProgressOverlayV042755333');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='candyMasterProgressOverlayV042755333';
  overlay.dataset.active='false';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-labelledby','candyMasterProgressTitleV042755333');
  overlay.style.cssText='position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.42);padding:20px;box-sizing:border-box;';
  overlay.innerHTML=`<section style="width:min(92vw,460px);background:#fff;border-radius:16px;padding:20px;box-shadow:0 12px 36px rgba(0,0,0,.28);">
    <h3 id="candyMasterProgressTitleV042755333" style="margin:0 0 10px;">糖果資料載入中</h3>
    <p id="candyMasterProgressMessageV042755333" style="margin:0 0 12px;">正在準備糖果公版 Master…</p>
    <progress id="candyMasterProgressBarV042755333" max="100" value="0" style="width:100%;height:18px;"></progress>
    <p id="candyMasterProgressCountV042755333" class="muted" style="margin:10px 0 0;">0 / 0（0%）</p>
    <button id="candyMasterProgressCancelV042755333" type="button" style="margin-top:14px;">取消載入</button>
  </section>`;
  overlay.querySelector('#candyMasterProgressCancelV042755333')?.addEventListener('click',()=>{
    cancelCandyMasterMaterialization('user-cancelled');
    const details=document.getElementById('candyMasterDetailsV042755331');
    if(details)details.open=false;
  });
  document.body.appendChild(overlay);
  return overlay;
}

function showCandyMasterProgress(message='正在準備糖果公版 Master…'){
  const overlay=ensureCandyMasterProgressOverlay();
  overlay.dataset.active='true';
  overlay.style.display='flex';
  const messageEl=overlay.querySelector('#candyMasterProgressMessageV042755333');
  if(messageEl)messageEl.textContent=message;
  updateCandyMasterProgress(0,0,message);
}

function updateCandyMasterProgress(completed,total,message){
  const overlay=ensureCandyMasterProgressOverlay();
  const safeTotal=Math.max(0,Number(total)||0);
  const safeCompleted=Math.min(safeTotal,Math.max(0,Number(completed)||0));
  const percent=safeTotal?Math.round((safeCompleted/safeTotal)*100):0;
  const bar=overlay.querySelector('#candyMasterProgressBarV042755333');
  const count=overlay.querySelector('#candyMasterProgressCountV042755333');
  const messageEl=overlay.querySelector('#candyMasterProgressMessageV042755333');
  if(bar)bar.value=percent;
  if(count)count.textContent=`${safeCompleted} / ${safeTotal}（${percent}%）`;
  if(message&&messageEl)messageEl.textContent=message;
}

function hideCandyMasterProgress(){
  const overlay=document.getElementById('candyMasterProgressOverlayV042755333');
  if(!overlay)return;
  overlay.dataset.active='false';
  overlay.style.display='none';
}

function cancelCandyMasterMaterialization(reason='cancelled'){
  candyMasterRenderGeneration+=1;
  const overlay=document.getElementById('candyMasterProgressOverlayV042755333');
  if(overlay?.dataset.active==='true'){
    globalThis.DebugTrace?.record?.('ui_performance','candy_master_materialization_cancelled',{status:'completed',details:{reason}});
    hideCandyMasterProgress();
  }
}

function displayAuthorityForRow(row){
  if(row?.candy_type!=='species'||!row?.target_species_name)return null;
  return resolvePublicCandyDisplayNameForSpecies(row.target_species_name);
}

function ensureItemsUi(){
  const section=document.getElementById('items');
  if(!section||document.getElementById('candyInventoryBlock'))return;
  const block=document.createElement('section');
  block.id='candyInventoryBlock';
  block.dataset.candyInventoryWriteAuthority=CANDY_INVENTORY_WRITE_AUTHORITY_VERSION;
  block.dataset.candyDisplayNameAuthority=PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION;
  block.dataset.candyFamilyStorageAuthority=CANDY_FAMILY_STORAGE_AUTHORITY_VERSION;
  block.innerHTML=`<h3>糖果庫存</h3>
    <p class="notice">P0-B6 起，species Candy 的玩家 current-state 會先依 Public Species → Candy Family → B4 Display-Name Authority 解析成唯一 canonical family storage。<b>玩家數量可由 JSON 更新中心匯入，或由「送給博士」時使用者輸入的遊戲實際觀測糖果數量增量寫入</b>；截圖／JSON quantity 在具備對應 confirmation evidence 時是 <b>ABSOLUTE_SNAPSHOT</b>，截圖仍需使用者明確確認；送給博士的既有觀測增量能力在 P0-B6 以 <b>DELTA_EVENT</b> 記錄。Migration 不以相同顯示文字、模糊比對或任意加總合併，provenance／時間序不明時會 <code>HOLD</code>。</p>
    <div id="candyResourceSummary" class="notice"></div>
    <div class="table-wrap"><table id="candyInventoryTable"></table></div>`;
  section.appendChild(block);
}

function ensureKnowledgeUi(){
  const panel=document.getElementById('sharedKnowledgePanel');if(!panel)return null;
  let pokemonSlot=document.getElementById('knowledgePokemonSlot');
  let candySlot=document.getElementById('knowledgeCandySlot');
  if(!pokemonSlot){pokemonSlot=document.createElement('section');pokemonSlot.id='knowledgePokemonSlot';pokemonSlot.dataset.renderOwner='shared-knowledge-ui';panel.prepend(pokemonSlot);}
  if(!candySlot){candySlot=document.createElement('section');candySlot.id='knowledgeCandySlot';candySlot.dataset.renderOwner='candy-inventory-ui';panel.appendChild(candySlot);}
  let details=document.getElementById('candyMasterDetailsV042755331');
  if(!details){
    details=document.createElement('details');details.id='candyMasterDetailsV042755331';details.dataset.defaultCollapsed='true';
    const summary=document.createElement('summary');summary.textContent='糖果公版 Master（預設收合；展開時建立表格）';
    const content=document.createElement('div');content.id='candyMasterContentV042755331';content.dataset.materialized='false';
    const note=document.createElement('p');note.className='notice';note.textContent='糖果 Master 資料會在背景預熱；展開時才建立上百筆表格 DOM。';content.appendChild(note);
    details.append(summary,content);candySlot.appendChild(details);
  }else if(!candySlot.contains(details))candySlot.appendChild(details);
  if(details.dataset.candyToggleBound!=='true'){
    details.dataset.candyToggleBound='true';details.open=false;
    details.addEventListener('toggle',()=>{
      if(details.open)void materializeCandyMaster();
      else cancelCandyMasterMaterialization('details-collapsed');
    });
  }
  panel.dataset.pageLayout='fixed';panel.classList.remove('loading-placeholder');
  return {panel,pokemonSlot,candySlot,details,content:document.getElementById('candyMasterContentV042755331')};
}

function table(element,data,columns){
  if(!element)return;
  const head=columns.map(column=>`<th>${esc(column.label)}</th>`).join('');
  const body=data.map(row=>`<tr>${columns.map(column=>`<td>${column.render?column.render(row):esc(row[column.key])}</td>`).join('')}</tr>`).join('');
  element.innerHTML=`<thead><tr>${head}</tr></thead><tbody>${body||'<tr><td colspan="9">目前沒有資料</td></tr>'}</tbody>`;
}

function candyMasterRows(){
  const built=buildPublicCandyMasterRows();
  if(isRescueReadonly()||!isDatabaseReady())return built;
  try{
    const result=rows('SELECT * FROM candy_master ORDER BY CASE candy_type WHEN \'universal\' THEN 1 WHEN \'type\' THEN 2 ELSE 3 END,candy_name');
    if(!result.length)return built;
    const ids=new Set(result.map(row=>row.candy_id));
    return [...result,...built.filter(row=>!ids.has(row.candy_id))];
  }catch{return built;}
}

function authorityLabel(row){
  if(row.candy_type!=='species')return '<span>既有固定 Evidence</span>';
  const authority=displayAuthorityForRow(row);
  if(authority?.status==='MATCH')return `<b>${esc(authority.candy_display_name)}</b>`;
  return '<code>REVIEW_REQUIRED</code>';
}

function authorityEvidence(row){
  if(row.candy_type!=='species')return esc(row.source_ref||'既有固定 Evidence');
  const authority=displayAuthorityForRow(row);
  if(authority?.status==='MATCH')return `<code>OFFICIAL_ZH_TW_EXACT</code>`;
  return `<code>${esc(authority?.reason||'NOT_GOVERNED')}</code>`;
}

export function prewarmCandyData({force=false}={}){
  if(candyCache.ready&&!force)return {...candyCache};
  const started=performance.now();
  candyCache.masterRows=candyMasterRows();
  if(!isRescueReadonly()&&isDatabaseReady()){
    try{candyCache.inventoryRows=rows(`SELECT * FROM candy_catalog_state WHERE player_record_exists=1 ORDER BY CASE candy_type WHEN 'universal' THEN 1 WHEN 'type' THEN 2 ELSE 3 END,candy_name`);}catch{candyCache.inventoryRows=[];}
    candyCache.audit=migrationAuditSummary();
    try{candyCache.resourceSnapshot=relevantResourceSnapshot();}catch{candyCache.resourceSnapshot=null;}
  }else{
    candyCache.inventoryRows=[];candyCache.audit={};candyCache.resourceSnapshot=null;
  }
  candyCache.ready=true;candyCache.revision+=1;
  globalThis.DebugTrace?.record?.('page_hydration','candy_data_prewarmed',{status:'completed',details:{master_count:candyCache.masterRows.length,inventory_count:candyCache.inventoryRows.length,elapsed_ms:Math.round(performance.now()-started),dom_materialized:false,revision:candyCache.revision}});
  return {...candyCache};
}

function candyMasterRowHtml(row){
  return `<tr><td>${esc(row.candy_name)}</td><td>${authorityLabel(row)}</td><td>${esc(typeLabel(row.candy_type))}</td><td>${esc(targetLabel(row))}</td><td>${row.candy_type==='species'?'Legacy Pokémon 名稱投影（非 B4 Authority）':'遊戲 Evidence'}</td><td>${authorityEvidence(row)}</td><td>${esc(row.verification_status)}</td><td>${esc(row.data_version)}</td></tr>`;
}

export async function materializeCandyMaster(){
  const ui=ensureKnowledgeUi();if(!ui)return false;
  if(candyMasterMaterializationPromise)return candyMasterMaterializationPromise;
  const generation=++candyMasterRenderGeneration;
  const started=performance.now();
  const task=(async()=>{
    showCandyMasterProgress('正在準備糖果公版 Master…');
    pageProgress('loading','資料百科：糖果 Master 準備中…',{surface:'candy-master',phase:'prepare'});
    globalThis.DebugTrace?.record?.('ui_performance','candy_master_materialization_started',{status:'running',details:{batch_size:CANDY_MASTER_BATCH_SIZE}});
    await yieldToPaint();

    const cache=prewarmCandyData();
    let block=document.getElementById('candyMasterBlock');
    if(!block){
      block=document.createElement('section');block.id='candyMasterBlock';
      block.dataset.candyDisplayNameAuthority=PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION;
      block.innerHTML=`<h3>糖果公版 Master</h3>
        <p class="notice">固定糖果仍採既有 Evidence-backed 名稱。舊版 species rows 的「○○的糖果」仍保留作 <b>legacy compatibility projection</b>，不再視為正式顯示名稱 Authority。P0-B4 只在有 Pokémon Sleep 官方繁中精確字串 evidence 時顯示家族層級的正式糖果名稱；未驗證 family 顯示 <code>REVIEW_REQUIRED</code>。</p>
        <div class="table-wrap"><table id="candyMasterTable"></table></div>
        <p class="notice">Legacy Candy Master：<b>${esc(PUBLIC_CANDY_MASTER_VERSION)}</b> · Legacy species rule：<code>${esc(SPECIES_CANDY_NAME_RULE_VERSION)}</code> · Display-name Authority：<b>${esc(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION)}</b></p>`;
      ui.content.replaceChildren(block);
    }

    const tableEl=document.getElementById('candyMasterTable');
    if(!tableEl)throw new Error('candy_master_table_missing');
    if(ui.content.dataset.materialized==='true'&&tableEl.dataset.candyRevision===String(cache.revision)){
      hideCandyMasterProgress();
      pageProgress('ready',`資料百科：糖果 Master 已存在（${cache.masterRows.length} 筆）`,{surface:'candy-master',row_count:cache.masterRows.length,reused:true});
      return true;
    }

    const total=cache.masterRows.length;
    updateCandyMasterProgress(0,total,'正在建立糖果資料表…');
    tableEl.innerHTML='<thead><tr><th>Legacy 名稱</th><th>B4 正式顯示名稱</th><th>類型</th><th>對應目標</th><th>Legacy 名稱來源</th><th>B4 Evidence</th><th>Legacy 核對狀態</th><th>版本</th></tr></thead><tbody></tbody>';
    const tbody=tableEl.querySelector('tbody');
    if(!tbody)throw new Error('candy_master_tbody_missing');
    await yieldToPaint();

    for(let start=0;start<total;start+=CANDY_MASTER_BATCH_SIZE){
      if(generation!==candyMasterRenderGeneration||!ui.details.open){
        pageProgress('idle','資料百科：糖果 Master 載入已取消',{surface:'candy-master',completed:start,total});
        return false;
      }
      const end=Math.min(total,start+CANDY_MASTER_BATCH_SIZE);
      const html=cache.masterRows.slice(start,end).map(candyMasterRowHtml).join('');
      tbody.insertAdjacentHTML('beforeend',html);
      const percent=total?Math.round((end/total)*100):100;
      updateCandyMasterProgress(end,total,`正在建立糖果資料表… ${percent}%`);
      pageProgress('loading',`資料百科：糖果 Master ${end}/${total}（${percent}%）`,{surface:'candy-master',phase:'rows',completed:end,total,percent});
      if(end===total||end%CANDY_MASTER_BATCH_SIZE===0){
        globalThis.DebugTrace?.record?.('ui_performance','candy_master_materialization_progress',{status:'running',details:{completed:end,total,percent}});
      }
      await yieldToPaint();
    }

    tableEl.dataset.candyRevision=String(cache.revision);
    ui.content.dataset.materialized='true';ui.details.dataset.dataReady='true';
    const elapsed=Math.round(performance.now()-started);
    updateCandyMasterProgress(total,total,'糖果資料載入完成');
    await yieldToPaint();
    hideCandyMasterProgress();
    globalThis.DebugTrace?.record?.('ui_performance','candy_master_materialization_completed',{status:'completed',details:{row_count:total,batch_size:CANDY_MASTER_BATCH_SIZE,elapsed_ms:elapsed}});
    pageProgress('ready',`資料百科：糖果 Master 已建立（${total} 筆）`,{surface:'candy-master',row_count:total,elapsed_ms:elapsed,chunked:true});
    return true;
  })();

  candyMasterMaterializationPromise=task;
  try{return await task;}
  catch(error){
    hideCandyMasterProgress();
    pageProgress('failed','資料百科：糖果 Master 載入失敗',{surface:'candy-master',error:error?.message||String(error)});
    globalThis.DebugTrace?.record?.('ui_performance','candy_master_materialization_failed',{status:'failed',error});
    throw error;
  }finally{
    if(candyMasterMaterializationPromise===task)candyMasterMaterializationPromise=null;
  }
}

function renderKnowledge(){
  const ui=ensureKnowledgeUi();if(!ui)return;
  prewarmCandyData();
  ui.details.dataset.dataReady='true';
  if(ui.details.open)void materializeCandyMaster();
}

function migrationAuditSummary(){
  try{
    const result=rows('SELECT status,COUNT(*) count FROM candy_family_storage_migration_audit GROUP BY status');
    return Object.fromEntries(result.map(row=>[String(row.status),Number(row.count||0)]));
  }catch{return {};}
}

function renderInventory(){
  ensureItemsUi();
  const tableEl=document.getElementById('candyInventoryTable');
  const summaryEl=document.getElementById('candyResourceSummary');
  if(!tableEl||!summaryEl)return;
  const cache=prewarmCandyData();
  if(!isDatabaseReady()||isRescueReadonly()){
    table(tableEl,[],[{label:'糖果',key:'candy_name'}]);
    summaryEl.textContent='玩家 SQLite 尚未載入；救援模式只提供公版糖果名稱，不讀取玩家數量。';
    return;
  }
  const data=cache.inventoryRows||[];
  table(tableEl,data,[
    {label:'Canonical / Legacy 糖果',key:'candy_name'},
    {label:'B4 正式顯示名稱',render:authorityLabel},
    {label:'類型',render:row=>esc(typeLabel(row.candy_type))},
    {label:'對象',render:row=>esc(targetLabel(row))},
    {label:'持有',key:'quantity'},
    {label:'保留',key:'safe_reserve'},
    {label:'可動用',key:'available'},
    {label:'更新時間',render:row=>esc(row.updated_at?formatLocal(row.updated_at):'—')},
  ]);
  const snapshot=cache.resourceSnapshot;
  const candyRows=snapshot?.status==='READY'?snapshot.candies:[];
  const stocked=candyRows.filter(row=>row.player_record_exists).length;
  const availableTotal=candyRows.reduce((sum,row)=>sum+Number(row.available||0),0);
  const audit=cache.audit||{};
  summaryEl.innerHTML=`已匯入／觀測寫入糖果種類：<b>${stocked}</b> · 各糖果可動用量合計（僅介面摘要，不跨種類視為等價資源）：<b>${availableTotal}</b> · Family migration：<code>APPLIED ${Number(audit.APPLIED||0)} / HOLD ${Number(audit.HOLD||0)} / NOOP ${Number(audit.NOOP||0)}</code> · B4 Display Authority：<code>${esc(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION)}</code> · Family Storage：<code>${esc(CANDY_FAMILY_STORAGE_AUTHORITY_VERSION)}</code> · 博士 quantity：<code>USER_DIRECT_OBSERVATION_ONLY → DELTA_EVENT</code> · 截圖 quantity：<code>USER_CONFIRMATION_REQUIRED → ABSOLUTE_SNAPSHOT</code> · missing/null：<code>NO_UPDATE</code> · explicit 0：<code>VALID</code> · 自動推算：<b>停用</b> · 轉換規則：<code>${esc(CANDY_CONVERSION_RULE_STATUS)}</code> · Resource fingerprint：<code>${esc(snapshot?.fingerprint||'—')}</code>`;
}

export function renderCandySurfaces(){
  const view=activeView();
  if(view==='items')renderInventory();
  else if(view==='knowledge')renderKnowledge();
}

function invalidateCandyCache(){
  candyCache.ready=false;candyCache.masterRows=null;candyCache.inventoryRows=null;candyCache.audit=null;candyCache.resourceSnapshot=null;
  candyMasterRenderGeneration+=1;
  const content=document.getElementById('candyMasterContentV042755331');
  if(content)content.dataset.materialized='false';
  hideCandyMasterProgress();
}
function schedulePrewarm(){idle(()=>{try{prewarmCandyData();}catch(error){globalThis.DebugTrace?.record?.('page_hydration','candy_data_prewarm_failed',{status:'warning',error});}});}
function boot(){
  ensureItemsUi();ensureKnowledgeUi();
  document.querySelector('nav')?.addEventListener('click',event=>{
    const view=event.target?.closest?.('button[data-view]')?.dataset?.view;
    if(view==='items')queueMicrotask(()=>renderInventory());
    else if(view==='knowledge')queueMicrotask(()=>renderKnowledge());
  });
  window.addEventListener('pokemon-sleep:database-ready',schedulePrewarm);
  window.addEventListener('pokemon-sleep:app-ready',schedulePrewarm);
  window.addEventListener('pokemon-sleep:data-changed',()=>{
    invalidateCandyCache();schedulePrewarm();
    if(activeView()==='items')queueMicrotask(()=>renderInventory());
    else if(activeView()==='knowledge'&&document.getElementById('candyMasterDetailsV042755331')?.open)queueMicrotask(()=>void materializeCandyMaster());
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
