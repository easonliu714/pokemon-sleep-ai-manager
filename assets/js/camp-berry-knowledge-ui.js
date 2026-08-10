import {PUBLIC_CAMP_BERRY_MASTER,PUBLIC_CAMP_BERRY_VERSION} from './public-camp-berry-master.js';

export const CAMP_BERRY_KNOWLEDGE_UI_VERSION='camp-berry-knowledge-ui-2026-08-10-e';
export const CAMP_BERRY_MOBILE_CONTAINMENT='COMPACT_CONTAINED_TABLE';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function policyLabel(row){
  if(row.berry_policy==='FIXED_3')return '固定 3 種';
  if(row.berry_policy==='WEEKLY_RANDOM_3')return '每週隨機 3 種';
  if(row.berry_policy==='EX_DYNAMIC')return 'EX 動態';
  return row.berry_policy||'未核對';
}
function berryText(row){
  if(row.berry_policy==='FIXED_3')return row.favorite_berries.join('、');
  if(row.berry_policy==='WEEKLY_RANDOM_3')return '不固定；以玩家本週觀測為準';
  const pool=row.main_berry_pool?.length?`主樹果：${row.main_berry_pool.join('、')}；`:'主樹果依 EX 規則；';
  return `${pool}副樹果為本週動態`;
}
function sourceLabel(row){
  const source=String(row.source_name||'').trim();
  if(/serebii/i.test(source))return 'Serebii / research-area';
  if(/game\/public reference/i.test(source))return 'Pokémon Sleep / public';
  if(/official/i.test(source))return 'Pokémon Sleep / official';
  return source||'—';
}
function ensureStyle(){
  if(document.getElementById('campBerryKnowledgeMobileStyle'))return;
  const style=document.createElement('style');style.id='campBerryKnowledgeMobileStyle';
  style.textContent=`
    #campBerryMasterBlock{min-width:0;max-width:100%;overflow:hidden;}
    #campBerryMasterBlock>*{max-width:100%;}
    #campBerryMasterBlock .camp-berry-scroll{display:block;width:100%;min-width:0;max-width:100%;margin:12px 0 20px!important;overflow-x:auto!important;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:pan-x pan-y;border:1px solid #dbe4df!important;border-radius:10px!important;background:#fff;}
    #campBerryMasterTable{width:100%;min-width:640px;max-width:100%;table-layout:fixed;border-collapse:collapse;}
    #campBerryMasterTable th,#campBerryMasterTable td{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere;word-break:break-word;vertical-align:top;padding:8px 9px;}
    #campBerryMasterTable th:nth-child(1),#campBerryMasterTable td:nth-child(1){width:17%;}
    #campBerryMasterTable th:nth-child(2),#campBerryMasterTable td:nth-child(2){width:13%;}
    #campBerryMasterTable th:nth-child(3),#campBerryMasterTable td:nth-child(3){width:32%;}
    #campBerryMasterTable th:nth-child(4),#campBerryMasterTable td:nth-child(4){width:24%;}
    #campBerryMasterTable th:nth-child(5),#campBerryMasterTable td:nth-child(5){width:14%;}
    #campBerryMasterTable td:nth-child(1),#campBerryMasterTable td:nth-child(2),#campBerryMasterTable td:nth-child(5){white-space:nowrap!important;}
    #campBerryMasterTable .camp-berry-source{display:inline;white-space:normal;overflow-wrap:anywhere;}
    @media(max-width:700px){
      #campBerryMasterBlock .camp-berry-scroll{margin-left:0!important;margin-right:0!important;border-left:1px solid #dbe4df!important;border-right:1px solid #dbe4df!important;border-radius:10px!important;}
      #campBerryMasterTable{min-width:620px;}
      #campBerryMasterTable th,#campBerryMasterTable td{font-size:.8rem;padding:8px 7px;}
    }
  `;
  document.head.appendChild(style);
}
function mount(){
  const panel=document.getElementById('sharedKnowledgePanel');if(!panel||document.getElementById('campBerryMasterBlock'))return;
  ensureStyle();
  const block=document.createElement('section');block.id='campBerryMasterBlock';block.dataset.layoutMode=CAMP_BERRY_MOBILE_CONTAINMENT;
  block.innerHTML=`<h3>營地與喜好樹果</h3>
    <p class="notice">這是公版營地規則，不含玩家本週選擇。固定營地可自動帶入三種樹果；萌綠之島與 EX 的實際樹果屬玩家每週狀態，不會沿用上週資料。</p>
    <div class="table-wrap camp-berry-scroll" role="region" aria-label="營地與喜好樹果表；採與進化條件及糖果公版 Master 一致的緊湊表格，窄螢幕僅在框內水平捲動" tabindex="0"><table id="campBerryMasterTable"><thead><tr><th>營地</th><th>規則</th><th>喜好樹果／候選規則</th><th>來源</th><th>核對日</th></tr></thead><tbody>${PUBLIC_CAMP_BERRY_MASTER.map(row=>`<tr><td>${esc(row.camp_name)}</td><td>${esc(policyLabel(row))}</td><td>${esc(berryText(row))}</td><td><span class="camp-berry-source" title="${esc(row.source_name)}" aria-label="${esc(row.source_name)}">${esc(sourceLabel(row))}</span></td><td>${esc(row.verified_at)}</td></tr>`).join('')}</tbody></table></div>
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