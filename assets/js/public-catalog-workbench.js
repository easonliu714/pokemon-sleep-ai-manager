import './version-authority.js';
import './v0415-ui-polish.js';
import './recipe-level-energy-autofill.js';
import {rows,isRescueReadonly} from './database.js';
import {PUBLIC_RECIPE_MASTER_VERSION} from './public-recipe-current-authority.js';
import {applyConfirmedRecipeDisplayNames} from './recipe-display-name-evidence.js';
import {saveIngredient,saveItem} from './manual-editor.js';
import {renderRecipeUnifiedWorkbench,RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION} from './recipe-unified-player-workbench.js';

const BUILD=globalThis.PokemonSleepVersionAuthority.app_build;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
const $=id=>document.getElementById(id);
const PUBLIC_VIEWS=Object.freeze(['ingredients','items','recipes']);
const AUTHORITY_KEYS=Object.freeze(['shared','recipes','items','candy','canonical','pokemon_knowledge']);
const GLOBAL_KEY='__PokemonSleepPublicCatalogWorkbenchV0427553';
const runtime=globalThis[GLOBAL_KEY]||(globalThis[GLOBAL_KEY]={
  installed:false,
  draining:false,
  requestedGeneration:0,
  completedGeneration:0,
  pendingView:null,
  publicFingerprint:null,
  publicExactMatch:false,
  renderedKeys:new Map(),
  localRevision:{ingredients:0,items:0,recipes:0},
});
const activeView=()=>document.querySelector('.view.active')?.id||'dashboard';
const yieldToUi=()=>new Promise(resolve=>setTimeout(resolve,0));
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));

function databaseReady(){try{return !isRescueReadonly()&&Number(rows('SELECT COUNT(*) AS count FROM schema_migrations')[0]?.count||0)>0;}catch{return false;}}
function progress(stage,message,status='running',details={}){globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:startup-progress',{detail:{stage,message,status,details}}));}
function canonicalAuthorityFingerprint(values={}){return AUTHORITY_KEYS.map(key=>`${key}=${String(values?.[key]??'MISSING')}`).join('|');}
function evaluatePublicAuthority(detail={}){
  const publicMaster=detail?.public_master||{};
  const expected=publicMaster.expected||{};
  const applied=publicMaster.applied||{};
  const expectedComplete=AUTHORITY_KEYS.every(key=>expected[key]!=null&&String(expected[key]).length>0);
  const exact=expectedComplete&&AUTHORITY_KEYS.every(key=>String(applied[key]??'')===String(expected[key]??''));
  const fingerprint=canonicalAuthorityFingerprint(expected);
  return {exact,fingerprint,expected,applied,updated:Boolean(publicMaster.updated),updated_authorities:[...(publicMaster.updated_authorities||[])]};
}
function lightweightIntegritySentinel(){
  if(!databaseReady())return {ok:false,reason:'DATABASE_NOT_READY'};
  try{
    const keys=['shared_master_version','public_recipe_master_version','public_item_master_version','public_candy_master_version','canonical_registry_version','public_pokemon_knowledge_version'];
    const placeholders=keys.map(()=>'?').join(',');
    const settingCount=Number(rows(`SELECT COUNT(*) AS count FROM settings WHERE key IN (${placeholders})`,keys)[0]?.count||0);
    const objectRows=rows("SELECT name,type FROM sqlite_master WHERE name IN ('ingredient_catalog_state','item_catalog_state','recipe_master','ingredient_master','item_master')");
    const names=new Set(objectRows.map(row=>row.name));
    const required=['ingredient_catalog_state','item_catalog_state','recipe_master','ingredient_master','item_master'];
    const missing=required.filter(name=>!names.has(name));
    return {ok:settingCount===keys.length&&missing.length===0,setting_count:settingCount,missing};
  }catch(error){return {ok:false,reason:'SENTINEL_QUERY_FAILED',error:error?.message||String(error)};}
}
function projectionKey(view){return `${runtime.publicFingerprint||'UNRESOLVED'}|local=${runtime.localRevision[view]||0}`;}
function ingredientUnlockLabel(row){
  if(row.unlock_state==='UNLOCKED')return '已解鎖';
  if(row.unlock_state==='NOT_UNLOCKED')return '尚未解鎖';
  if(row.unlock_state==='UNKNOWN')return '待確認';
  return '尚無玩家證據';
}
function ingredientUnlockValue(row){
  if(row.unlock_state==='UNLOCKED')return '1';
  if(row.unlock_state==='NOT_UNLOCKED')return '0';
  return '';
}

function renderIngredientCatalog(){
  const table=$('ingredientTable');if(!table)return;
  const data=rows('SELECT * FROM ingredient_catalog_state ORDER BY ingredient_name');
  table.innerHTML=`<thead><tr><th>食材</th><th>數量</th><th>解鎖狀態</th><th>本機紀錄</th><th>主檔版本</th><th>操作</th></tr></thead><tbody>${data.map(row=>`<tr><td>${esc(row.ingredient_name)}</td><td><input class="inline-number canonical-ingredient-qty" type="number" min="0" value="${Number(row.quantity||0)}" data-name="${esc(row.ingredient_name)}"></td><td><select class="canonical-ingredient-unlock" data-name="${esc(row.ingredient_name)}"><option value="" ${ingredientUnlockValue(row)===''?'selected':''}>待確認／尚無證據</option><option value="1" ${ingredientUnlockValue(row)==='1'?'selected':''}>已解鎖</option><option value="0" ${ingredientUnlockValue(row)==='0'?'selected':''}>尚未解鎖</option></select><div class="muted">${esc(ingredientUnlockLabel(row))}</div></td><td>${row.player_record_exists?'有':'無'}</td><td>${esc(row.data_version||'')}</td><td><button class="canonical-save-ingredient" data-name="${esc(row.ingredient_name)}">儲存</button></td></tr>`).join('')}</tbody>`;
  table.querySelectorAll('.canonical-save-ingredient').forEach(button=>button.addEventListener('click',async()=>{
    const name=button.dataset.name,selector=CSS.escape(name),input=table.querySelector(`.canonical-ingredient-qty[data-name="${selector}"]`),unlock=table.querySelector(`.canonical-ingredient-unlock[data-name="${selector}"]`);
    try{await saveIngredient(name,input.value,unlock.value);window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'ingredient_inventory',operation:'manual_upsert'}}));}catch(error){alert(error.message);}
  }));
}
function renderItemCatalog(){
  const table=$('itemTable');if(!table)return;
  const data=rows('SELECT * FROM item_catalog_state ORDER BY item_category,item_name');
  table.innerHTML=`<thead><tr><th>道具</th><th>分類</th><th>庫存</th><th>保留</th><th>可動用</th><th>功能／備註</th><th>主檔版本</th><th>操作</th></tr></thead><tbody>${data.map(row=>`<tr><td>${esc(row.item_name)}</td><td>${esc(row.item_category||'未分類')}</td><td><input class="inline-number canonical-item-qty" type="number" min="0" value="${Number(row.quantity||0)}" data-name="${esc(row.item_name)}"></td><td><input class="inline-number canonical-item-reserve" type="number" min="0" value="${Number(row.safe_reserve||0)}" data-name="${esc(row.item_name)}"></td><td>${Math.max(0,Number(row.quantity||0)-Number(row.safe_reserve||0))}</td><td><div class="notice"><strong>功能：</strong>${esc(row.effect_description_zh_tw||'官方說明待補')}</div><textarea class="inline-text canonical-item-note" data-name="${esc(row.item_name)}">${esc(row.recommendation||'')}</textarea></td><td>${esc(row.data_version||'')}</td><td><button class="canonical-save-item" data-name="${esc(row.item_name)}">儲存</button></td></tr>`).join('')}</tbody>`;
  table.querySelectorAll('.canonical-save-item').forEach(button=>button.addEventListener('click',async()=>{
    const name=button.dataset.name,selector=CSS.escape(name),q=table.querySelector(`.canonical-item-qty[data-name="${selector}"]`).value,reserve=table.querySelector(`.canonical-item-reserve[data-name="${selector}"]`).value,note=table.querySelector(`.canonical-item-note[data-name="${selector}"]`).value;
    try{await saveItem(name,q,reserve,note);window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'item_inventory',operation:'manual_upsert'}}));}catch(error){alert(error.message);}
  }));
}

function renderView(view){
  if(!PUBLIC_VIEWS.includes(view))return false;
  if(view!=='recipes'&&!databaseReady())return false;
  const key=projectionKey(view);
  if(runtime.renderedKeys.get(view)===key){progress('PUBLIC_CATALOG_RENDER_DEDUPED',`${view} 已是目前版次／玩家投影，不重建`,'completed',{view,fingerprint:runtime.publicFingerprint,local_revision:runtime.localRevision[view]||0});return true;}
  progress('PUBLIC_CATALOG_RENDER_START',`正在載入${view}公版資料`,'running',{view,generation:runtime.requestedGeneration,fingerprint:runtime.publicFingerprint});
  try{
    let recipeProjection=null;
    if(view==='ingredients')renderIngredientCatalog();
    else if(view==='items')renderItemCatalog();
    else {recipeProjection=renderRecipeUnifiedWorkbench();applyConfirmedRecipeDisplayNames();}
    runtime.renderedKeys.set(view,key);
    progress('PUBLIC_CATALOG_RENDER_COMPLETED',`${view}公版資料載入完成`,'completed',{
      view,generation:runtime.requestedGeneration,fingerprint:runtime.publicFingerprint,local_revision:runtime.localRevision[view]||0,
      recipe_master_version:view==='recipes'?PUBLIC_RECIPE_MASTER_VERSION:undefined,
      recipe_workbench_version:view==='recipes'?RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION:undefined,
      recipe_partition:view==='recipes'&&recipeProjection?`${recipeProjection.unlocked_count}+${recipeProjection.locked_count}=${recipeProjection.total_count}`:undefined,
      rescue_readonly:isRescueReadonly(),
    });return true;
  }catch(error){progress('PUBLIC_CATALOG_RENDER_FAILED',`${view}公版資料載入失敗`,'failed',{view,error:error.message});return false;}
}
async function drainRenderQueue(){
  if(runtime.draining)return;runtime.draining=true;
  try{while(runtime.completedGeneration<runtime.requestedGeneration){const generation=runtime.requestedGeneration;await yieldToUi();await nextPaint();const view=runtime.pendingView||activeView();if(activeView()===view)renderView(view);runtime.completedGeneration=generation;}}
  finally{runtime.draining=false;if(runtime.completedGeneration<runtime.requestedGeneration)queueMicrotask(drainRenderQueue);}
}
function requestRender(view=activeView(),reason='unspecified'){
  if(!PUBLIC_VIEWS.includes(view)){progress('PUBLIC_CATALOG_RENDER_DEDUPED','目前分頁不需要公版表格重建','completed',{view,reason,fingerprint:runtime.publicFingerprint});return false;}
  const key=projectionKey(view);
  if(runtime.renderedKeys.get(view)===key){progress('PUBLIC_CATALOG_RENDER_DEDUPED',`${view} 版次與本機投影均未變更`,'completed',{view,reason,fingerprint:runtime.publicFingerprint,local_revision:runtime.localRevision[view]||0});return false;}
  runtime.pendingView=view;runtime.requestedGeneration+=1;
  progress('PUBLIC_CATALOG_RENDER_REQUESTED','已排程公版分頁載入','completed',{view,reason,generation:runtime.requestedGeneration,fingerprint:runtime.publicFingerprint});
  void drainRenderQueue();return true;
}
function markLocalProjectionDirty(entity){
  const mapping={ingredient_inventory:'ingredients',item_inventory:'items',recipes:'recipes',recipe_status:'recipes'};
  const view=mapping[String(entity||'')];if(!view)return null;
  runtime.localRevision[view]=(runtime.localRevision[view]||0)+1;return view;
}
function handleDatabaseReady(event){
  const authority=evaluatePublicAuthority(event?.detail||{});
  const sentinel=lightweightIntegritySentinel();
  runtime.publicFingerprint=authority.fingerprint;
  runtime.publicExactMatch=authority.exact&&sentinel.ok&&!authority.updated;
  progress('PUBLIC_CATALOG_VERSION_CHECK','已比對本機與 Release 公版資料版次','completed',{fingerprint:authority.fingerprint,exact_match:authority.exact,updated:authority.updated,updated_authorities:authority.updated_authorities,integrity_sentinel:sentinel});
  if(runtime.publicExactMatch){
    progress('PUBLIC_CATALOG_VERSION_MATCH_BYPASS','公版版次一致；略過全量公版 hydration／reconciliation','completed',{fingerprint:authority.fingerprint,integrity_sentinel:sentinel,player_sqlite_bypassed:false,local_authority_bypassed:false,migration_bypassed:false});
  }else{
    progress('PUBLIC_CATALOG_HYDRATE_COMPLETED','公版版本稽核已由資料庫階段完成；目前投影採最新 authority','completed',{fingerprint:authority.fingerprint,exact_match:authority.exact,updated_authorities:authority.updated_authorities,integrity_sentinel:sentinel});
    runtime.renderedKeys.clear();
  }
  progress('PUBLIC_CATALOG_LAZY_READY','公版資料採版次比對＋按頁單次投影','completed',{build:BUILD,fingerprint:runtime.publicFingerprint,version_match_bypass:runtime.publicExactMatch,recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,recipe_workbench_version:RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION});
  requestRender(activeView(),'database-ready');
}
function handleDataChanged(event){
  const detail=event?.detail||{};
  if(detail.public_master_changed===true||detail.public_authority_changed===true){runtime.renderedKeys.clear();requestRender(activeView(),'public-authority-changed');return;}
  const dirtyView=markLocalProjectionDirty(detail.entity);
  if(!dirtyView){progress('PUBLIC_CATALOG_RENDER_DEDUPED','本機玩家資料變更不影響 Public Master fingerprint','completed',{reason:'unrelated-local-data-changed',entity:detail.entity||null,fingerprint:runtime.publicFingerprint});return;}
  if(activeView()===dirtyView)requestRender(dirtyView,'local-projection-changed');
}
function install(){
  if(runtime.installed){progress('PUBLIC_CATALOG_RENDER_DEDUPED','Public Catalog runtime 已由另一 URL identity 安裝；略過重複 listener','completed',{reason:'global-singleton',build:BUILD});return;}
  runtime.installed=true;
  document.querySelectorAll('nav button[data-view]').forEach(button=>button.addEventListener('click',()=>requestRender(button.dataset.view,'navigation')));
  window.addEventListener('pokemon-sleep:data-changed',handleDataChanged);
  window.addEventListener('pokemon-sleep:database-ready',handleDatabaseReady);
  window.dispatchEvent(new CustomEvent('pokemon-sleep:public-catalog-ready',{detail:{build:BUILD,lazy_renderer:true,mutation_observer:false,global_singleton:true,public_version_match_bypass:true,local_change_does_not_invalidate_public_fingerprint:true,cause_aware_generation_queue:true,schema_compatible_items:true,ingredient_unlock_state_semantics:true,recipe_authority:PUBLIC_RECIPE_MASTER_VERSION,recipe_workbench_authority:RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION}}));
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',install,{once:true});else install();