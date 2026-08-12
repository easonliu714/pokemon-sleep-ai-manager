import './version-authority.js';
import './v0415-ui-polish.js';
import {rows,isRescueReadonly} from './database.js';
import {PUBLIC_RECIPE_MASTER_VERSION} from './public-recipe-canonical-authority.js';
import {saveIngredient,saveItem} from './manual-editor.js';
import {renderRecipeUnifiedWorkbench,RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION} from './recipe-unified-player-workbench.js';

const BUILD=globalThis.PokemonSleepVersionAuthority.app_build;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const $=id=>document.getElementById(id);
let installed=false,draining=false,requestedGeneration=0,completedGeneration=0,pendingView=null;
const activeView=()=>document.querySelector('.view.active')?.id||'dashboard';
const yieldToUi=()=>new Promise(resolve=>setTimeout(resolve,0));
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));

function databaseReady(){try{return !isRescueReadonly()&&Number(rows('SELECT COUNT(*) AS count FROM schema_migrations')[0]?.count||0)>0;}catch{return false;}}
function progress(stage,message,status='running',details={}){globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:startup-progress',{detail:{stage,message,status,details}}));}

function renderIngredientCatalog(){const table=$('ingredientTable');if(!table)return;const data=rows('SELECT * FROM ingredient_catalog_state ORDER BY ingredient_name');table.innerHTML=`<thead><tr><th>食材</th><th>數量</th><th>玩家紀錄</th><th>主檔版本</th><th>操作</th></tr></thead><tbody>${data.map(row=>`<tr><td>${esc(row.ingredient_name)}</td><td><input class="inline-number canonical-ingredient-qty" type="number" min="0" value="${Number(row.quantity||0)}" data-name="${esc(row.ingredient_name)}"></td><td>${row.player_record_exists?'已建立':'尚未建立'}</td><td>${esc(row.data_version||'')}</td><td><button class="canonical-save-ingredient" data-name="${esc(row.ingredient_name)}">儲存</button></td></tr>`).join('')}</tbody>`;table.querySelectorAll('.canonical-save-ingredient').forEach(button=>button.addEventListener('click',async()=>{const name=button.dataset.name,input=table.querySelector(`.canonical-ingredient-qty[data-name="${CSS.escape(name)}"]`);try{await saveIngredient(name,input.value);renderIngredientCatalog();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'ingredient_inventory',operation:'manual_upsert'}}));}catch(error){alert(error.message);}}));}
function renderItemCatalog(){const table=$('itemTable');if(!table)return;const data=rows('SELECT * FROM item_catalog_state ORDER BY item_category,item_name');table.innerHTML=`<thead><tr><th>道具</th><th>分類</th><th>庫存</th><th>保留</th><th>可動用</th><th>功能／備註</th><th>主檔版本</th><th>操作</th></tr></thead><tbody>${data.map(row=>`<tr><td>${esc(row.item_name)}</td><td>${esc(row.item_category||'未分類')}</td><td><input class="inline-number canonical-item-qty" type="number" min="0" value="${Number(row.quantity||0)}" data-name="${esc(row.item_name)}"></td><td><input class="inline-number canonical-item-reserve" type="number" min="0" value="${Number(row.safe_reserve||0)}" data-name="${esc(row.item_name)}"></td><td>${Math.max(0,Number(row.quantity||0)-Number(row.safe_reserve||0))}</td><td><div class="notice"><strong>功能：</strong>${esc(row.effect_description_zh_tw||'官方說明待補')}</div><textarea class="inline-text canonical-item-note" data-name="${esc(row.item_name)}">${esc(row.recommendation||'')}</textarea></td><td>${esc(row.data_version||'')}</td><td><button class="canonical-save-item" data-name="${esc(row.item_name)}">儲存</button></td></tr>`).join('')}</tbody>`;table.querySelectorAll('.canonical-save-item').forEach(button=>button.addEventListener('click',async()=>{const name=button.dataset.name,selector=CSS.escape(name),q=table.querySelector(`.canonical-item-qty[data-name="${selector}"]`).value,reserve=table.querySelector(`.canonical-item-reserve[data-name="${selector}"]`).value,note=table.querySelector(`.canonical-item-note[data-name="${selector}"]`).value;try{await saveItem(name,q,reserve,note);renderItemCatalog();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'item_inventory',operation:'manual_upsert'}}));}catch(error){alert(error.message);}}));}

function renderView(view){
  if(!['ingredients','items','recipes'].includes(view))return false;
  if(view!=='recipes'&&!databaseReady())return false;
  progress('PUBLIC_CATALOG_RENDER_START',`正在載入${view}公版資料`,'running',{view,generation:requestedGeneration});
  try{
    let recipeProjection=null;
    if(view==='ingredients')renderIngredientCatalog();
    else if(view==='items')renderItemCatalog();
    else recipeProjection=renderRecipeUnifiedWorkbench();
    progress('PUBLIC_CATALOG_RENDER_COMPLETED',`${view}公版資料載入完成`,'completed',{
      view,generation:requestedGeneration,
      recipe_master_version:view==='recipes'?PUBLIC_RECIPE_MASTER_VERSION:undefined,
      recipe_workbench_version:view==='recipes'?RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION:undefined,
      recipe_partition:view==='recipes'&&recipeProjection?`${recipeProjection.unlocked_count}+${recipeProjection.locked_count}=${recipeProjection.total_count}`:undefined,
      rescue_readonly:isRescueReadonly(),
    });return true;
  }catch(error){progress('PUBLIC_CATALOG_RENDER_FAILED',`${view}公版資料載入失敗`,'failed',{view,error:error.message});return false;}
}
async function drainRenderQueue(){if(draining)return;draining=true;try{while(completedGeneration<requestedGeneration){const generation=requestedGeneration;await yieldToUi();await nextPaint();const view=pendingView||activeView();if(activeView()===view)renderView(view);completedGeneration=generation;}}finally{draining=false;if(completedGeneration<requestedGeneration)queueMicrotask(drainRenderQueue);}}
function requestRender(view=activeView(),reason='unspecified'){pendingView=view;requestedGeneration+=1;progress('PUBLIC_CATALOG_RENDER_REQUESTED','已排程公版分頁載入','completed',{view,reason,generation:requestedGeneration});void drainRenderQueue();}
function install(){if(installed)return;installed=true;document.querySelectorAll('nav button[data-view]').forEach(button=>button.addEventListener('click',()=>requestRender(button.dataset.view,'navigation')));window.addEventListener('pokemon-sleep:data-changed',()=>requestRender(activeView(),'data-changed'));window.addEventListener('pokemon-sleep:database-ready',()=>{progress('PUBLIC_CATALOG_LAZY_READY','公版資料已改為按頁載入','completed',{build:BUILD,recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,recipe_workbench_version:RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION});requestRender(activeView(),'database-ready');});window.dispatchEvent(new CustomEvent('pokemon-sleep:public-catalog-ready',{detail:{build:BUILD,lazy_renderer:true,mutation_observer:false,first_entry_after_navigation:true,cause_aware_generation_queue:true,schema_compatible_items:true,recipe_authority:PUBLIC_RECIPE_MASTER_VERSION,recipe_workbench_authority:RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION}}));}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',install,{once:true});else install();