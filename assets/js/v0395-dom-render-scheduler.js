import './version-authority.js';

const authority=globalThis.PokemonSleepVersionAuthority;
let installed=false;

function progress(stage,message,status='running',details={}){
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:startup-progress',{detail:{stage,message,status,details:{version:authority.app_version,...details}}}));
}

function activateView(view){
  progress('PAGE_LAYOUT_COMMITTED',`${view} 固定框架已切換；資料由該頁唯一 hydrator 負責`,'completed',{
    view,
    inner_html_monkey_patch:false,
    hidden_dom_buffer:false,
    fake_data_changed:false,
    app_ready_authority:false,
    single_owner_page_hydration:true,
  });
  return true;
}

function flush(){
  // v0.4.27.55.3.3 retires the historical hidden-DOM buffer. Kept only as a
  // compatibility method for callers that probe the v0395 runtime object.
  return false;
}

function install(){
  if(installed)return;
  installed=true;
  globalThis.addEventListener?.('pokemon-sleep:view-activated',event=>activateView(event?.detail?.view||'unknown'));
  progress('DOM_RENDER_SCHEDULER_RETIRED','已退休非首屏 innerHTML 攔截；改由固定 Layout + 單一 Page Hydrator 一次提交 DOM','completed',{
    deferred_ids:[],
    inner_html_monkey_patch:false,
    hidden_dom_buffer:false,
    duplicate_app_ready_dispatch:false,
    navigation_is_not_data_mutation:true,
    single_owner_page_hydration:true,
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

globalThis.PokemonSleepV0395RenderScheduler=Object.freeze({
  version:authority.app_version,
  build:authority.app_build,
  pending:()=>[],
  flush,
  activateView,
});
