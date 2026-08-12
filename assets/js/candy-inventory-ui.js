import './uc-img-v04132-pot-capacity-bootstrap.js';
import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {buildPublicCandyMasterRows,PUBLIC_CANDY_MASTER_VERSION,SPECIES_CANDY_NAME_RULE_VERSION} from './public-candy-master.js';
import {relevantResourceSnapshot,CANDY_CONVERSION_RULE_STATUS} from './resource-context.js';
import {formatLocal} from './time-utils.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const typeLabel=value=>({universal:'萬能',type:'屬性',species:'寶可夢',other_verified:'其他'}[value]||value||'—');
const targetLabel=row=>row.target_species_name||row.target_type_name||'—';

function ensureItemsUi(){
  const section=document.getElementById('items');
  if(!section||document.getElementById('candyInventoryBlock'))return;
  const block=document.createElement('section');
  block.id='candyInventoryBlock';
  block.innerHTML=`<h3>糖果庫存</h3>
    <p class="notice">糖果名稱與對應關係來自公版 Candy Master；<b>玩家數量只接受 JSON 更新中心匯入</b>，不在此頁手動改寫。萬能／屬性糖果的可轉換結果目前不計入實體庫存，避免重複計算。</p>
    <div id="candyResourceSummary" class="notice"></div>
    <div class="table-wrap"><table id="candyInventoryTable"></table></div>`;
  section.appendChild(block);
}

function ensureKnowledgeUi(){
  const panel=document.getElementById('sharedKnowledgePanel');
  if(!panel||document.getElementById('candyMasterBlock'))return;
  const block=document.createElement('section');
  block.id='candyMasterBlock';
  block.innerHTML=`<h3>糖果公版 Master</h3>
    <p class="notice">固定糖果採 Evidence-backed 名稱；「○○的糖果」由 Pokémon 公版名稱依 <code>${esc(SPECIES_CANDY_NAME_RULE_VERSION)}</code> 投影。此表不含任何玩家持有數量。</p>
    <div class="table-wrap"><table id="candyMasterTable"></table></div>
    <p class="notice">Candy Master：<b>${esc(PUBLIC_CANDY_MASTER_VERSION)}</b></p>`;
  panel.appendChild(block);
}

function table(element,data,columns){
  if(!element)return;
  const head=columns.map(column=>`<th>${esc(column.label)}</th>`).join('');
  const body=data.map(row=>`<tr>${columns.map(column=>`<td>${column.render?column.render(row):esc(row[column.key])}</td>`).join('')}</tr>`).join('');
  element.innerHTML=`<thead><tr>${head}</tr></thead><tbody>${body||'<tr><td colspan="8">目前沒有資料</td></tr>'}</tbody>`;
}

function candyMasterRows(){
  if(isRescueReadonly()||!isDatabaseReady())return buildPublicCandyMasterRows();
  try{
    const result=rows('SELECT * FROM candy_master ORDER BY CASE candy_type WHEN \'universal\' THEN 1 WHEN \'type\' THEN 2 ELSE 3 END,candy_name');
    return result.length?result:buildPublicCandyMasterRows();
  }catch{return buildPublicCandyMasterRows();}
}

function renderKnowledge(){
  ensureKnowledgeUi();
  table(document.getElementById('candyMasterTable'),candyMasterRows(),[
    {label:'糖果名稱',key:'candy_name'},
    {label:'類型',render:row=>esc(typeLabel(row.candy_type))},
    {label:'對應目標',render:row=>esc(targetLabel(row))},
    {label:'名稱來源',render:row=>row.candy_type==='species'?'Pokémon 名稱投影':'遊戲 Evidence'},
    {label:'核對狀態',key:'verification_status'},
    {label:'版本',key:'data_version'},
  ]);
}

function renderInventory(){
  ensureItemsUi();
  const tableEl=document.getElementById('candyInventoryTable');
  const summaryEl=document.getElementById('candyResourceSummary');
  if(!tableEl||!summaryEl)return;
  if(!isDatabaseReady()||isRescueReadonly()){
    table(tableEl,[],[{label:'糖果',key:'candy_name'}]);
    summaryEl.textContent='玩家 SQLite 尚未載入；救援模式只提供公版糖果名稱，不讀取玩家數量。';
    return;
  }
  let data=[];
  try{data=rows(`SELECT * FROM candy_catalog_state WHERE player_record_exists=1 ORDER BY CASE candy_type WHEN 'universal' THEN 1 WHEN 'type' THEN 2 ELSE 3 END,candy_name`);}catch{}
  table(tableEl,data,[
    {label:'糖果',key:'candy_name'},
    {label:'類型',render:row=>esc(typeLabel(row.candy_type))},
    {label:'對象',render:row=>esc(targetLabel(row))},
    {label:'持有',key:'quantity'},
    {label:'保留',key:'safe_reserve'},
    {label:'可動用',key:'available'},
    {label:'更新時間',render:row=>esc(row.updated_at?formatLocal(row.updated_at):'—')},
  ]);
  const snapshot=relevantResourceSnapshot();
  const candyRows=snapshot.status==='READY'?snapshot.candies:[];
  const stocked=candyRows.filter(row=>row.player_record_exists).length;
  const availableTotal=candyRows.reduce((sum,row)=>sum+Number(row.available||0),0);
  summaryEl.innerHTML=`已匯入糖果種類：<b>${stocked}</b> · 各糖果可動用量合計（僅介面摘要，不跨種類視為等價資源）：<b>${availableTotal}</b> · 轉換規則：<code>${esc(CANDY_CONVERSION_RULE_STATUS)}</code> · Resource fingerprint：<code>${esc(snapshot.fingerprint||'—')}</code>`;
}

export function renderCandySurfaces(){renderKnowledge();renderInventory();}

function boot(){
  ensureItemsUi();ensureKnowledgeUi();renderCandySurfaces();
  document.querySelector('nav')?.addEventListener('click',()=>setTimeout(renderCandySurfaces,0));
  window.addEventListener('pokemon-sleep:database-ready',()=>setTimeout(renderCandySurfaces,0));
  window.addEventListener('pokemon-sleep:data-changed',()=>setTimeout(renderCandySurfaces,0));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
