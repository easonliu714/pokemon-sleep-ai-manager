import {PUBLIC_CAMP_BERRY_MASTER,PUBLIC_CAMP_BERRY_VERSION} from './public-camp-berry-master.js';

export const CAMP_BERRY_KNOWLEDGE_UI_VERSION='camp-berry-knowledge-ui-2026-08-10-d';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
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
function prefersContainedCards(){
  const touchPoints=Number(globalThis.navigator?.maxTouchPoints||0);
  const coarse=Boolean(globalThis.matchMedia?.('(hover: none), (pointer: coarse)')?.matches);
  const narrow=Number(globalThis.innerWidth||0)>0&&Number(globalThis.innerWidth)<=900;
  return touchPoints>0||coarse||narrow;
}
function applyLayoutMode(block=document.getElementById('campBerryMasterBlock')){
  if(!block)return false;
  const contained=prefersContainedCards();
  block.classList.toggle('camp-berry-contained-cards',contained);
  block.dataset.layoutMode=contained?'TOUCH_FIRST_ROW_CARD':'DESKTOP_TABLE';
  return contained;
}
function ensureStyle(){
  if(document.getElementById('campBerryKnowledgeMobileStyle'))return;
  const style=document.createElement('style');style.id='campBerryKnowledgeMobileStyle';
  style.textContent=`
    #campBerryMasterBlock{min-width:0;max-width:100%;overflow:hidden;}
    #campBerryMasterBlock>*{max-width:100%;}
    #campBerryMasterBlock .camp-berry-scroll{display:block;width:100%;min-width:0;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:pan-x pan-y;}
    #campBerryMasterTable{min-width:760px;width:max-content;max-width:none;}
    #campBerryMasterBlock.camp-berry-contained-cards .camp-berry-scroll{width:100%;min-width:0;max-width:100%;margin-left:0;margin-right:0;overflow:visible;border:0;border-radius:0;background:transparent;}
    #campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable{display:block;width:100%!important;min-width:0!important;max-width:100%!important;border-collapse:separate;}
    #campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable thead{display:none;}
    #campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable tbody{display:grid;width:100%;min-width:0;max-width:100%;gap:10px;}
    #campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable tr{display:block;width:100%;min-width:0;max-width:100%;overflow:hidden;border:1px solid var(--line,#dbe4df);border-radius:10px;background:#fff;}
    #campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable th,#campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable td{max-width:100%;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word;}
    #campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable td{display:grid;grid-template-columns:minmax(78px,92px) minmax(0,1fr);gap:8px;width:100%;min-width:0;padding:9px 10px;border-bottom:1px solid #e7eeea;}
    #campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable td:last-child{border-bottom:0;}
    #campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable td::before{content:attr(data-label);min-width:0;color:#687d74;font-weight:750;}
    @media(max-width:700px){
      #campBerryMasterBlock .camp-berry-scroll{width:100%;min-width:0;max-width:100%;margin-left:0;margin-right:0;overflow:visible;border:0;border-radius:0;background:transparent;}
      #campBerryMasterTable{display:block;width:100%!important;min-width:0!important;max-width:100%!important;border-collapse:separate;}
      #campBerryMasterTable thead{display:none;}
      #campBerryMasterTable tbody{display:grid;width:100%;min-width:0;max-width:100%;gap:10px;}
      #campBerryMasterTable tr{display:block;width:100%;min-width:0;max-width:100%;overflow:hidden;border:1px solid var(--line,#dbe4df);border-radius:10px;background:#fff;}
      #campBerryMasterTable th,#campBerryMasterTable td{max-width:100%;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word;}
      #campBerryMasterTable td{display:grid;grid-template-columns:minmax(78px,92px) minmax(0,1fr);gap:8px;width:100%;min-width:0;padding:9px 10px;border-bottom:1px solid #e7eeea;}
      #campBerryMasterTable td:last-child{border-bottom:0;}
      #campBerryMasterTable td::before{content:attr(data-label);min-width:0;color:#687d74;font-weight:750;}
    }
  `;
  document.head.appendChild(style);
}
function mount(){
  const panel=document.getElementById('sharedKnowledgePanel');if(!panel)return;
  const existing=document.getElementById('campBerryMasterBlock');
  if(existing){applyLayoutMode(existing);return;}
  ensureStyle();
  const block=document.createElement('section');block.id='campBerryMasterBlock';
  block.innerHTML=`<h3>營地與喜好樹果</h3>
    <p class="notice">這是公版營地規則，不含玩家本週選擇。固定營地可自動帶入三種樹果；萌綠之島與 EX 的實際樹果屬玩家每週狀態，不會沿用上週資料。</p>
    <div class="table-wrap camp-berry-scroll" role="region" aria-label="營地與喜好樹果表；觸控裝置強制使用框內卡片避免超出外框" tabindex="0"><table id="campBerryMasterTable"><thead><tr><th>營地</th><th>規則</th><th>喜好樹果／候選規則</th><th>來源</th><th>核對日</th></tr></thead><tbody>${PUBLIC_CAMP_BERRY_MASTER.map(row=>`<tr><td data-label="營地">${esc(row.camp_name)}</td><td data-label="規則">${esc(policyLabel(row))}</td><td data-label="樹果／規則">${esc(berryText(row))}</td><td data-label="來源">${esc(row.source_name)}</td><td data-label="核對日">${esc(row.verified_at)}</td></tr>`).join('')}</tbody></table></div>
    <p class="notice">Camp Berry Master：<b>${esc(PUBLIC_CAMP_BERRY_VERSION)}</b></p>`;
  applyLayoutMode(block);
  const first=panel.querySelector('h3');if(first)first.insertAdjacentElement('beforebegin',block);else panel.prepend(block);
}
function install(){
  const schedule=()=>setTimeout(mount,0);
  const refreshLayout=()=>applyLayoutMode(document.getElementById('campBerryMasterBlock'));
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="knowledge"]'))schedule();},true);
  document.addEventListener('pokemon-sleep-data-refreshed',schedule);
  globalThis.addEventListener?.('pokemon-sleep:database-ready',schedule);
  globalThis.addEventListener?.('resize',refreshLayout,{passive:true});
  globalThis.addEventListener?.('orientationchange',refreshLayout,{passive:true});
  const panel=document.getElementById('sharedKnowledgePanel');if(panel)new MutationObserver(()=>{if(!document.getElementById('campBerryMasterBlock'))schedule();else refreshLayout();}).observe(panel,{childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
}
install();
