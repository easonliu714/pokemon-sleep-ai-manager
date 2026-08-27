import {rows} from './database.js';
import './group-bound-review-session-runtime-v042744.js';

const APP_VERSION='v0.3.85';
const APP_BUILD='20260805-v0385-database-boot-isolation';
const LEGACY_RECIPE_COUNT=76;

const trace=(event,details={},status='completed',error=null)=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,details);
  globalThis.DebugTrace?.record?.('v0383_contract',event,{status,details,error});
};

// v0.4.2 compatibility export only. The historical 76-row recipe literal and
// writer were retired; migrations.auditAndSyncPublicMasters now owns recipe
// synchronization through public-recipe-master.js.
async function applyRecipeCatalog(){
  const detail={
    delegated_to:'migrations.auditAndSyncPublicMasters',
    authority:'public-recipe-master.js',
    legacy_recipe_count:LEGACY_RECIPE_COUNT,
    database_write_performed:false,
    player_state_write:false,
  };
  trace('recipe_catalog_delegated',detail);
  return detail;
}

function isDuplicateOnlySelection(root){
  const selected=[...root.querySelectorAll('[data-unified-item]:checked')];
  return selected.length>0&&selected.every(box=>box.closest('.light-review-item')?.textContent?.includes('狀態：duplicate'));
}
function installOcrTerminalPatch(){
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#unifiedRun');
    if(!button)return;
    const root=document.getElementById('unifiedImportAnalysisWorkbench');
    const strategy=root?.querySelector('#unifiedStrategy');
    if(!root||!strategy)return;
    if(strategy.value==='ocr_ai'&&isDuplicateOnlySelection(root)){
      strategy.value='ai_only';
      root.querySelector('#unifiedStatus').textContent='所選圖片皆為重複圖片：沿用既有 OCR Revision，直接重新執行 AI 與人工覆核。需要強制 OCR 時請選「只重新 OCR」。';
      trace('duplicate_only_terminal_fast_path',{selected_count:root.querySelectorAll('[data-unified-item]:checked').length});
    }
  },true);
}

function canonical(entityType,raw){
  const value=String(raw||'').trim();
  if(!value)return {raw:value,canonical:'',status:'EMPTY'};
  const exact=rows('SELECT canonical_name_zh_tw FROM canonical_term WHERE entity_type=? AND canonical_name_zh_tw=? AND is_active=1',[entityType,value])[0];
  if(exact)return {raw:value,canonical:exact.canonical_name_zh_tw,status:'CANONICAL_EXACT'};
  const alias=rows(`SELECT t.canonical_name_zh_tw,a.is_auto_replace_safe FROM canonical_term_alias a JOIN canonical_term t ON t.term_id=a.term_id WHERE t.entity_type=? AND a.alias_text=? AND a.locale='zh-Hant' AND t.is_active=1`,[entityType,value])[0];
  if(alias)return {raw:value,canonical:alias.canonical_name_zh_tw,status:Number(alias.is_auto_replace_safe)===1?'CANONICAL_ALIAS_SAFE':'CANONICAL_ALIAS_REVIEW'};
  return {raw:value,canonical:'',status:'CANONICAL_UNKNOWN'};
}
function analysisPayload(row){
  try{const parsed=JSON.parse(row?.result_json||'null');return parsed?.analysis??parsed??{};}catch{return {};}
}
function mergeAiObservations(anchor){
  const candidates=rows(`SELECT * FROM image_analysis_revision WHERE analysis_type='ai' ORDER BY created_at DESC LIMIT 12`).map(row=>({row,data:analysisPayload(row)}));
  const name=anchor?.pokemon_name,level=Number(anchor?.level);
  const matched=candidates.filter(x=>(!name||x.data?.pokemon_name===name)&&(!Number.isFinite(level)||Number(x.data?.level)===level));
  const merged={...anchor};
  const pick=(path)=>{
    for(const x of matched){
      let value=x.data;for(const key of path)value=value?.[key];
      if(value!==null&&value!==undefined&&value!=='')return value;
    }return null;
  };
  for(const key of ['nickname','specialty','type','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','obtained_at','confidence'])if(merged[key]==null||merged[key]==='')merged[key]=pick([key]);
  merged.main_skill=merged.main_skill?.name?merged.main_skill:pick(['main_skill'])||merged.main_skill;
  merged.nature=merged.nature?.name?merged.nature:pick(['nature'])||merged.nature;
  const levels=[1,30,60];
  merged.ingredients=levels.map(level=>{
    for(const x of matched){
      const row=(x.data?.ingredients||[]).find(item=>Number(item.level??item.unlock_level)===level&&String(item.name??item.ingredient_name??'').trim());
      if(row)return row;
    }return (anchor?.ingredients||[]).find(item=>Number(item.level??item.unlock_level)===level)||{level,name:null,count:null};
  });
  return merged;
}

// v0.4.27.44: This historical projector is intentionally retired regardless
// of successor readiness. It used a single shared DOM and could write a later
// Pokémon Group into the currently visible review form. Group-bound review
// session authority now owns all review projection. Keep the listener only as
// a compatibility trace so older callers are observable without mutating DOM.
function applyReviewProjection(detail){
  if(detail?.analysis_type!=='ai')return;
  trace('full_review_projection_retired_v042744',{
    reason:'shared_dom_writer_permanently_retired',
    analysis_id:detail?.analysis_id||detail?.revision?.analysis_id||null,
    dom_write_performed:false,
    replacement_authority:'group-bound-review-session-runtime-v042744.js',
  });
}

function installServiceWorkerScopeRepair(){
  if(!('serviceWorker' in navigator))return;
  const script=new URL('../../service-worker.js',import.meta.url);
  const scope=new URL('../../',import.meta.url).pathname;
  navigator.serviceWorker.register(script,{scope,updateViaCache:'none'})
    .then(reg=>{reg?.update?.();trace('service_worker_scope_repaired',{scope:reg?.scope||scope,script:script.href});})
    .catch(error=>trace('service_worker_scope_repair_failed',{message:error?.message||String(error)},'failed',error));
}

let initialized=false;
function initialize(){
  if(initialized)return;
  initialized=true;
  // Intentionally do not populate PokemonSleepPublicRecipeRegistry. v0.4.2
  // uses public-recipe-master.js in both rescue and standard rendering.
  installOcrTerminalPatch();
  installServiceWorkerScopeRepair();
  globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>applyReviewProjection(event.detail));
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:public-recipe-registry-ready',{detail:{
    delegated:true,
    authority:'public-recipe-master.js',
    legacy_recipe_count:LEGACY_RECIPE_COUNT,
  }}));
  trace('v0385_boot_isolation_ready',{version:APP_VERSION,build:APP_BUILD,legacy_recipe_authority_retired:true,database_write_performed:false,legacy_review_dom_projection_retired_v042744:true});
}
initialize();
export {applyRecipeCatalog,mergeAiObservations};
