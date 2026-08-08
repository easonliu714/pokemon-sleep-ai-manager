import {BERRY_BY_TYPE} from './pokemon-master-options.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let installed=false;

function detailCard(label){
  return [...document.querySelectorAll('#detailBody .detail-card')].find(card=>card.querySelector('b')?.textContent?.trim()===label)||null;
}

function cardValue(card){
  if(!card)return '';
  const clone=card.cloneNode(true);
  clone.querySelector('b')?.remove();
  return clone.textContent.trim();
}

function projectBerryInView(){
  if(document.getElementById('pokemonEditForm'))return;
  const berryCard=detailCard('樹果種類');
  if(!berryCard||!berryCard.querySelector('.unknown')||berryCard.dataset.publicProjection==='berry')return;
  const type=cardValue(detailCard('屬性'));
  const berry=BERRY_BY_TYPE[type];
  if(!berry)return;
  berryCard.dataset.publicProjection='berry';
  const unknown=berryCard.querySelector('.unknown');
  if(unknown)unknown.outerHTML=`<span class="public-projection">${esc(berry)}（公版）</span><small class="projection-source">依屬性公版投影；不寫入玩家資料</small>`;
}

function ensureEditNotice(){
  const form=document.getElementById('pokemonEditForm');
  if(!form||form.querySelector('.projection-integrity-notice'))return;
  const notice=document.createElement('div');
  notice.className='notice projection-integrity-notice';
  notice.innerHTML='<b>公版 Projection 保護</b>：變更「性格」或「屬性」只修改你明確編輯的欄位；系統不再自動把公版性格提升／降低或屬性對應樹果寫入玩家資料。若欄位保持空白，回到檢視模式時可用「（公版）」唯讀投影顯示。';
  form.prepend(notice);
}

function protectProjectionOnlyChange(event){
  const id=event.target?.id;
  if(id!=='pokemonNatureSelect'&&id!=='pokemonTypeSelect')return;
  // pokemon-detail.js has legacy target listeners that auto-filled public
  // knowledge into player fields. Stop only those two synthetic writeback
  // paths; the select value itself has already changed and remains editable.
  event.stopImmediatePropagation();
  queueMicrotask(ensureEditNotice);
}

function refresh(){
  ensureEditNotice();
  projectBerryInView();
}

export function installProjectionIntegrityGuard(){
  if(installed||typeof document==='undefined')return;
  installed=true;
  document.addEventListener('change',protectProjectionOnlyChange,true);
  const root=document.getElementById('pokemonDetailBackdrop')||document.body;
  new MutationObserver(()=>queueMicrotask(refresh)).observe(root,{subtree:true,childList:true});
  refresh();
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installProjectionIntegrityGuard,{once:true});
  else installProjectionIntegrityGuard();
}
