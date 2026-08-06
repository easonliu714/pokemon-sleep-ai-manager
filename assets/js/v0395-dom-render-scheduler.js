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
      if(!isActive(element)){pending.set(element.id,String(value));progress('OFFSCREEN_RENDER_DEFERRED',`已延後 ${element.id} 的非首屏 DOM 建立`,'completed',{element_id:element.id,view:viewFor(element),html_length:String(value).length});return;}
      nativeInnerHtml.set.call(element,value);
    },
  });
}
function flush(id){
  const element=document.getElementById(id);if(!element)return;
  const value=pending.get(id);if(value!=null){pending.delete(id);nativeInnerHtml.set.call(element,value);progress('OFFSCREEN_RENDER_FLUSHED',`${id} 已於開啟頁面時建立`,'completed',{element_id:id,view:viewFor(element),html_length:value.length});}
}
function activateView(view){
  const map={pokemon:['pokemonTable'],ingredients:['ingredientTable'],items:['itemTable'],recipes:['recipeTable'],updates:['historyTable'],backup:['snapshotList']};
  for(const id of map[view]||[])flush(id);
  if(view==='pokemon')setTimeout(()=>document.getElementById('pokemonSearch')?.dispatchEvent(new Event('input',{bubbles:true})),0);
  if(['ingredients','items','recipes'].includes(view))setTimeout(()=>globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'lazy_view',operation:'opened',view}})),0);
}
function waitForGeneralReady(detail){
  progress('GENERAL_UI_BOOTSTRAP_START','資料庫完成，正在建立一般模式首屏','running',detail);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    progress('DASHBOARD_FIRST_PAINT','一般模式首屏已完成兩次畫面更新','completed',detail);
    const started=performance.now();
    const poll=()=>{
      const status=document.getElementById('dbStatus');
      if(status?.classList.contains('ok')||status?.textContent?.includes('SQLite 已就緒')){
        const elapsed=Math.round(performance.now()-started);
        progress('GENERAL_UI_BOOTSTRAP_COMPLETED','一般模式首屏與資料摘要已完成','completed',{...detail,elapsed_ms:elapsed,deferred_elements:[...pending.keys()]});
        globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:app-ready',{detail:{...detail,elapsed_ms:elapsed,deferred_elements:[...pending.keys()]}}));
        return;
      }
      if(performance.now()-started>45000){progress('GENERAL_UI_BOOTSTRAP_SLOW','一般模式仍在建立首屏；可展開啟動紀錄定位最後階段','warning',{...detail,deferred_elements:[...pending.keys()]});return;}
      setTimeout(poll,100);
    };
    poll();
  }));
}
function install(){
  if(installed)return;installed=true;
  for(const id of deferredIds)installDeferral(document.getElementById(id));
  document.querySelector('nav')?.addEventListener('click',event=>{const button=event.target.closest('button[data-view]');if(button)activateView(button.dataset.view);},true);
  globalThis.addEventListener('pokemon-sleep:database-ready',event=>{const detail=event.detail||{};if(detail.rescue||detail.readonly)return;waitForGeneralReady(detail);});
  progress('DOM_RENDER_SCHEDULER_READY','非首屏大型表格已改為按頁建立','completed',{deferred_ids:[...deferredIds]});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

globalThis.PokemonSleepV0395RenderScheduler=Object.freeze({version:authority.app_version,build:authority.app_build,pending:()=>[...pending.keys()],flush,activateView});
