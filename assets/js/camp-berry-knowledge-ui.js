import {PUBLIC_CAMP_BERRY_MASTER,PUBLIC_CAMP_BERRY_VERSION} from './public-camp-berry-master.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function policyLabel(row){
  if(row.berry_policy==='FIXED_3')return '固定 3 種';
  if(row.berry_policy==='WEEKLY_RANDOM_3')return '每週隨機 3 種';
  if(row.berry_policy==='EX_DYNAMIC')return 'EX 動態主／副樹果';
  return row.berry_policy||'未核對';
}
function berryText(row){
  if(row.berry_policy==='FIXED_3')return row.favorite_berries.join('、');
  if(row.berry_policy==='WEEKLY_RANDOM_3')return '不固定；以玩家本週觀測為準';
  const pool=row.main_berry_pool?.length?`主樹果候選：${row.main_berry_pool.join('、')}；`:'主樹果依該 EX 營地規則；';
  return `${pool}副樹果為本週動態`;
}
function mount(){
  const panel=document.getElementById('sharedKnowledgePanel');if(!panel||document.getElementById('campBerryMasterBlock'))return;
  const block=document.createElement('section');block.id='campBerryMasterBlock';
  block.innerHTML=`<h3>營地與喜好樹果</h3>
    <p class="notice">這是公版營地規則，不含玩家本週選擇。固定營地可自動帶入三種樹果；萌綠之島與 EX 的實際樹果屬玩家每週狀態，不會沿用上週資料。</p>
    <div class="table-wrap"><table id="campBerryMasterTable"><thead><tr><th>營地</th><th>規則</th><th>喜好樹果／候選規則</th><th>來源</th><th>核對日</th></tr></thead><tbody>${PUBLIC_CAMP_BERRY_MASTER.map(row=>`<tr><td>${esc(row.camp_name)}</td><td>${esc(policyLabel(row))}</td><td>${esc(berryText(row))}</td><td>${esc(row.source_name)}</td><td>${esc(row.verified_at)}</td></tr>`).join('')}</tbody></table></div>
    <p class="notice">Camp Berry Master：<b>${esc(PUBLIC_CAMP_BERRY_VERSION)}</b></p>`;
  const first=panel.querySelector('h3');if(first)first.insertAdjacentElement('beforebegin',block);else panel.prepend(block);
}
function install(){
  const schedule=()=>setTimeout(mount,0);
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="knowledge"]'))schedule();},true);
  document.addEventListener('pokemon-sleep-data-refreshed',schedule);
  globalThis.addEventListener?.('pokemon-sleep:database-ready',schedule);
  const panel=document.getElementById('sharedKnowledgePanel');if(panel)new MutationObserver(()=>{if(!document.getElementById('campBerryMasterBlock'))schedule();}).observe(panel,{childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
}
install();
