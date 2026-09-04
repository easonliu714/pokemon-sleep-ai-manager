import './version-authority.js';

const authority=globalThis.PokemonSleepVersionAuthority;
const deferredIds=new Set(['pokemonTable','ingredientTable','itemTable','recipeTable','historyTable','snapshotList']);
const pending=new Map();
const nativeInnerHtml=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
let installed=false;

function progress(stage,message,status='running',details={}){
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:startup-progress',{detail:{stage,message,status,details:{version:authority.app_version,...details}}}));
}
function viewFor(element){return element?.closest?.('.view')?.id||'';}
function isActive(element){const view=element?.closest?.('.view');return !view||view.classList.contains('active');}
function installDeferral(element){
  if(!element||element.dataset.v0395Deferred==='1')return;
  element.dataset.v0395Deferred='1';
  Object.defineProperty(element,'innerHTML',{
    configurable:true,
    get(){return nativeInnerHtml.get.call(element);},
    set(value){
      if(!isActive(element)){
        pending.set(element.id,String(value));
        progress('OFFSCREEN_RENDER_DEFERRED',`已延後 ${element.id} 的非首屏 DOM 建立`,'completed',{element_id:element.id,view:viewFor(element),html_length:String(value).length,superseded_by_page_owner:['ingredientTable','itemTable','recipeTable','snapshotList'].includes(element.id)});
        return;
      }
      nativeInnerHtml.set.call(element,value);
    },
  });
}
function flush(id){
  const element=document.getElementById(id);if(!element)return false;
  const value=pending.get(id);if(value==null)return false;
  pending.delete(id);nativeInnerHtml.set.call(element,value);
  progress('OFFSCREEN_RENDER_FLUSHED',`${id} 已於開啟頁面時建立`,'completed',{element_id:id,view:viewFor(element),html_length:value.length});
  return true;
}
function discard(id,reason='single-owner-page-renderer'){
  if(!pending.has(id))return false;
  pending.delete(id);
  progress('OFFSCREEN_RENDER_SUPERSEDED',`${id} 的舊版 deferred DOM 已丟棄，由分頁唯一 renderer 接管`,'completed',{element_id:id,reason,no_dom_commit:true});
  return true;
}
function activateView(view){
  const singleOwnerMap={ingredients:'ingredientTable',items:'itemTable',recipes:'recipeTable',backup:'snapshotList'};
  if(view==='pokemon'){
    flush('pokemonTable');
    setTimeout(()=>document.getElementById('pokemonSearch')?.dispatchEvent(new Event('input',{bubbles:true})),0);
  }else if(view==='updates'){
    globalThis.PokemonSleepPageHydrationAuthorityV04275533?.canonicalizeImportHistoryDom?.();
    flush('historyTable');
    globalThis.PokemonSleepPageHydrationAuthorityV04275533?.canonicalizeImportHistoryDom?.();
  }else if(singleOwnerMap[view]){
    discard(singleOwnerMap[view]);
  }
  // Navigation is not a data mutation. v0.4.27.55.3.3 deliberately does NOT
  // dispatch pokemon-sleep:data-changed for page opens.
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:view-activated',{detail:{view,authority:'v0.4.27.55.3.3',navigation_is_data_mutation:false}}));
  globalThis.PokemonSleepPageHydrationAuthorityV04275533?.hydrateView?.(view)?.catch?.(()=>{});
}
function install(){
  if(installed)return;installed=true;
  for(const id of deferredIds)installDeferral(document.getElementById(id));
  document.querySelector('nav')?.addEventListener('click',event=>{const button=event.target.closest('button[data-view]');if(button)activateView(button.dataset.view);},true);
  globalThis.addEventListener('pokemon-sleep:database-ready',event=>{
    const detail=event.detail||{};if(detail.rescue||detail.readonly)return;
    progress('DOM_RENDER_SCHEDULER_DATABASE_READY','資料庫已就緒；非首屏 DOM 保持 deferred，等待唯一分頁 renderer','completed',{single_owner_page_render:true,app_ready_authority:false,deferred_elements:[...pending.keys()]});
  });
  progress('DOM_RENDER_SCHEDULER_READY','非首屏大型表格已改為按頁唯一 renderer 建立','completed',{deferred_ids:[...deferredIds],navigation_is_data_mutation:false,double_render_flush_removed:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

globalThis.PokemonSleepV0395RenderScheduler=Object.freeze({version:authority.app_version,build:authority.app_build,pending:()=>[...pending.keys()],flush,discard,activateView});
