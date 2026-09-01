import './uc-img-v04132-pot-capacity-bootstrap.js';
import './candy-quantity-screenshot-ui.js';
import './candy-public-master-admission-ui.js';
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
    <p class="notice">P0-B6 起，species Candy 的玩家 current-state 會先依 Public Species → Candy Family → B4 Display-Name Authority 解析成唯一 canonical family storage。截圖／JSON quantity 是 <b>ABSOLUTE_SNAPSHOT</b>，仍需使用者明確確認；送給博士的遊戲實際觀測糖果數量是 <b>DELTA_EVENT</b>。Migration 不以相同顯示文字、模糊比對或任意加總合併，provenance／時間序不明時會 <code>HOLD</code>。</p>
    <div id="candyResourceSummary" class="notice"></div>
    <div class="table-wrap"><table id="candyInventoryTable"></table></div>`;
  section.appendChild(block);
}

function ensureKnowledgeUi(){
  const panel=document.getElementById('sharedKnowledgePanel');
  if(!panel||document.getElementById('candyMasterBlock'))return;
  const block=document.createElement('section');
  block.id='candyMasterBlock';
  block.dataset.candyDisplayNameAuthority=PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION;
  block.innerHTML=`<h3>糖果公版 Master</h3>
    <p class="notice">固定糖果仍採既有 Evidence-backed 名稱。舊版 species rows 的「○○的糖果」仍保留作 <b>legacy compatibility projection</b>，不再視為正式顯示名稱 Authority。P0-B4 只在有 Pokémon Sleep 官方繁中精確字串 evidence 時顯示家族層級的正式糖果名稱；未驗證 family 顯示 <code>REVIEW_REQUIRED</code>，不會由結構 root 或 Pokémon 名稱自動猜名。.53 可由使用者在 UNMATCHED 當下建立本機 Public Candy identity overlay；這不會預先修改 source-controlled 公版，也不包含玩家 quantity。</p>
    <div class="table-wrap"><table id="candyMasterTable"></table></div>
    <p class="notice">Legacy Candy Master：<b>${esc(PUBLIC_CANDY_MASTER_VERSION)}</b> · Legacy species rule：<code>${esc(SPECIES_CANDY_NAME_RULE_VERSION)}</code> · Display-name Authority：<b>${esc(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION)}</b></p>`;
  panel.appendChild(block);
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

function renderKnowledge(){
  ensureKnowledgeUi();
  table(document.getElementById('candyMasterTable'),candyMasterRows(),[
    {label:'Legacy 名稱',key:'candy_name'},
    {label:'B4 正式顯示名稱',render:authorityLabel},
    {label:'類型',render:row=>esc(typeLabel(row.candy_type))},
    {label:'對應目標',render:row=>esc(targetLabel(row))},
    {label:'Legacy 名稱來源',render:row=>row.candy_type==='species'?'Legacy Pokémon 名稱投影（非 B4 Authority）':'遊戲 Evidence'},
    {label:'B4 Evidence',render:authorityEvidence},
    {label:'Legacy 核對狀態',key:'verification_status'},
    {label:'版本',key:'data_version'},
  ]);
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
  if(!isDatabaseReady()||isRescueReadonly()){
    table(tableEl,[],[{label:'糖果',key:'candy_name'}]);
    summaryEl.textContent='玩家 SQLite 尚未載入；救援模式只提供公版糖果名稱，不讀取玩家數量。';
    return;
  }
  let data=[];
  try{data=rows(`SELECT * FROM candy_catalog_state WHERE player_record_exists=1 ORDER BY CASE candy_type WHEN 'universal' THEN 1 WHEN 'type' THEN 2 ELSE 3 END,candy_name`);}catch{}
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
  const snapshot=relevantResourceSnapshot();
  const candyRows=snapshot.status==='READY'?snapshot.candies:[];
  const stocked=candyRows.filter(row=>row.player_record_exists).length;
  const availableTotal=candyRows.reduce((sum,row)=>sum+Number(row.available||0),0);
  const audit=migrationAuditSummary();
  summaryEl.innerHTML=`已匯入／觀測寫入糖果種類：<b>${stocked}</b> · 各糖果可動用量合計（僅介面摘要，不跨種類視為等價資源）：<b>${availableTotal}</b> · Family migration：<code>APPLIED ${Number(audit.APPLIED||0)} / HOLD ${Number(audit.HOLD||0)} / NOOP ${Number(audit.NOOP||0)}</code> · B4 Display Authority：<code>${esc(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION)}</code> · Family Storage：<code>${esc(CANDY_FAMILY_STORAGE_AUTHORITY_VERSION)}</code> · 博士 quantity：<code>USER_DIRECT_OBSERVATION_ONLY → DELTA_EVENT</code> · 截圖 quantity：<code>USER_CONFIRMATION_REQUIRED → ABSOLUTE_SNAPSHOT</code> · missing/null：<code>NO_UPDATE</code> · explicit 0：<code>VALID</code> · 自動推算：<b>停用</b> · 轉換規則：<code>${esc(CANDY_CONVERSION_RULE_STATUS)}</code> · Resource fingerprint：<code>${esc(snapshot.fingerprint||'—')}</code>`;
}

export function renderCandySurfaces(){renderKnowledge();renderInventory();}

function boot(){
  ensureItemsUi();ensureKnowledgeUi();renderCandySurfaces();
  document.querySelector('nav')?.addEventListener('click',()=>setTimeout(renderCandySurfaces,0));
  window.addEventListener('pokemon-sleep:database-ready',()=>setTimeout(renderCandySurfaces,0));
  window.addEventListener('pokemon-sleep:data-changed',()=>setTimeout(renderCandySurfaces,0));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
