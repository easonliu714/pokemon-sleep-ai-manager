import {rows,run,persist,snapshot,begin,commit,rollback} from './database.js';
import {saveIngredient,saveItem} from './manual-editor.js';
import {localIso} from './time-utils.js';

const BUILD='20260804-v0379-public-catalog-main-renderer';
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const $=(id)=>document.getElementById(id);
let installed=false;
let observer=null;

function renderIngredientCatalog(){
  const table=$('ingredientTable');
  if(!table)return;
  const data=rows('SELECT * FROM ingredient_catalog_state ORDER BY ingredient_name');
  table.innerHTML=`<thead><tr><th>食材</th><th>數量</th><th>玩家紀錄</th><th>主檔版本</th><th>操作</th></tr></thead><tbody>${data.map((row)=>`<tr>
    <td>${esc(row.ingredient_name)}</td>
    <td><input class="inline-number canonical-ingredient-qty" type="number" min="0" value="${Number(row.quantity||0)}" data-name="${esc(row.ingredient_name)}"></td>
    <td>${row.player_record_exists?'已建立':'尚未建立'}</td>
    <td>${esc(row.data_version||'')}</td>
    <td><button class="canonical-save-ingredient" data-name="${esc(row.ingredient_name)}">儲存</button></td>
  </tr>`).join('')}</tbody>`;
  table.querySelectorAll('.canonical-save-ingredient').forEach((button)=>button.addEventListener('click',async()=>{
    const name=button.dataset.name;
    const input=table.querySelector(`.canonical-ingredient-qty[data-name="${CSS.escape(name)}"]`);
    try{await saveIngredient(name,input.value);renderIngredientCatalog();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'ingredient_inventory',operation:'manual_upsert'}}));}
    catch(error){alert(error.message);}
  }));
}

function renderItemCatalog(){
  const table=$('itemTable');
  if(!table)return;
  const data=rows('SELECT *,MAX(0,quantity-safe_reserve) AS available FROM item_catalog_state ORDER BY item_category,item_name');
  table.innerHTML=`<thead><tr><th>道具</th><th>分類</th><th>庫存</th><th>保留</th><th>可動用</th><th>備註</th><th>主檔版本</th><th>操作</th></tr></thead><tbody>${data.map((row)=>`<tr>
    <td>${esc(row.item_name)}</td><td>${esc(row.item_category||'未分類')}</td>
    <td><input class="inline-number canonical-item-qty" type="number" min="0" value="${Number(row.quantity||0)}" data-name="${esc(row.item_name)}"></td>
    <td><input class="inline-number canonical-item-reserve" type="number" min="0" value="${Number(row.safe_reserve||0)}" data-name="${esc(row.item_name)}"></td>
    <td>${Number(row.available||0)}</td>
    <td><textarea class="inline-text canonical-item-note" data-name="${esc(row.item_name)}">${esc(row.recommendation||'')}</textarea></td>
    <td>${esc(row.data_version||'')}</td>
    <td><button class="canonical-save-item" data-name="${esc(row.item_name)}">儲存</button></td>
  </tr>`).join('')}</tbody>`;
  table.querySelectorAll('.canonical-save-item').forEach((button)=>button.addEventListener('click',async()=>{
    const name=button.dataset.name;
    const q=table.querySelector(`.canonical-item-qty[data-name="${CSS.escape(name)}"]`).value;
    const r=table.querySelector(`.canonical-item-reserve[data-name="${CSS.escape(name)}"]`).value;
    const note=table.querySelector(`.canonical-item-note[data-name="${CSS.escape(name)}"]`).value;
    try{await saveItem(name,q,r,note);renderItemCatalog();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'item_inventory',operation:'manual_upsert'}}));}
    catch(error){alert(error.message);}
  }));
}

async function saveRecipeState(row,unlocked,level,energy){
  const before=rows('SELECT * FROM recipes WHERE recipe_id=?',[row.recipe_id])[0]||null;
  const l=level===''?null:Number(level),e=energy===''?null:Number(energy);
  if(l!==null&&(!Number.isInteger(l)||l<1))throw new Error('料理等級必須為 1 以上整數');
  if(e!==null&&(!Number.isInteger(e)||e<0))throw new Error('目前能量必須為 0 以上整數');
  await snapshot(`manual:recipe:${row.recipe_id}`);begin();
  try{
    run(`INSERT INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(recipe_id) DO UPDATE SET unlocked=excluded.unlocked,recipe_level=excluded.recipe_level,current_energy=excluded.current_energy,updated_at=excluded.updated_at`,
      [row.recipe_id,row.category,row.recipe_name,unlocked?1:0,row.total_ingredients,'public_catalog_manual',l,e,localIso(),'']);
    const after=rows('SELECT * FROM recipes WHERE recipe_id=?',[row.recipe_id])[0];
    const id=`MANUAL-RECIPE-${Date.now()}-${Math.random().toString(16).slice(2,6)}`;
    run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[id,'manual-1.0',localIso(),localIso(),'manual_frontend_edit',1,JSON.stringify({status:'applied'})]);
    run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[id,0,'recipes','manual_update',JSON.stringify({recipe_id:row.recipe_id}),JSON.stringify(before),JSON.stringify(after),'applied','前端手動修改料理解鎖狀態']);
    commit();await persist();
  }catch(error){rollback();throw error;}
}

function recipeIngredients(recipeId){
  return rows('SELECT ingredient_name,quantity FROM recipe_master_ingredients WHERE recipe_id=? ORDER BY ingredient_name',[recipeId]).map((row)=>`${row.ingredient_name}×${row.quantity}`).join('、');
}

function renderRecipeCatalog(){
  const table=$('recipeTable');if(!table)return;
  const data=rows('SELECT * FROM recipe_catalog_state ORDER BY category,base_energy DESC,recipe_name');
  const notice=document.querySelector('#recipes .notice');
  if(notice)notice.textContent=`公版主檔 ${data.length} 筆；沒有玩家紀錄時預設未解鎖。主檔完整度會隨遊戲截圖、官方公告與 RaenonX 對帳持續更新。`;
  table.innerHTML=`<thead><tr><th>分類</th><th>料理</th><th>基礎能量</th><th>配方</th><th>已解鎖</th><th>料理等級</th><th>目前能量</th><th>主檔版本</th><th>操作</th></tr></thead><tbody>${data.map((row)=>`<tr>
    <td>${esc(row.category)}</td><td>${esc(row.recipe_name)}</td><td>${esc(row.base_energy??'—')}</td><td>${esc(recipeIngredients(row.recipe_id))}</td>
    <td><input class="canonical-recipe-unlocked" type="checkbox" ${row.unlocked?'checked':''} data-id="${esc(row.recipe_id)}"></td>
    <td><input class="inline-number canonical-recipe-level" type="number" min="1" value="${esc(row.recipe_level??'')}" data-id="${esc(row.recipe_id)}"></td>
    <td><input class="inline-number canonical-recipe-energy" type="number" min="0" value="${esc(row.current_energy??'')}" data-id="${esc(row.recipe_id)}"></td>
    <td>${esc(row.data_version||'')}</td><td><button class="canonical-save-recipe" data-id="${esc(row.recipe_id)}">儲存</button></td>
  </tr>`).join('')}</tbody>`;
  table.querySelectorAll('.canonical-save-recipe').forEach((button)=>button.addEventListener('click',async()=>{
    const id=button.dataset.id,row=data.find((item)=>item.recipe_id===id);
    const unlocked=table.querySelector(`.canonical-recipe-unlocked[data-id="${CSS.escape(id)}"]`).checked;
    const level=table.querySelector(`.canonical-recipe-level[data-id="${CSS.escape(id)}"]`).value;
    const energy=table.querySelector(`.canonical-recipe-energy[data-id="${CSS.escape(id)}"]`).value;
    try{await saveRecipeState(row,unlocked,level,energy);renderRecipeCatalog();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'recipes',operation:'manual_upsert'}}));}
    catch(error){alert(error.message);}
  }));
}

function renderCatalogStatus(){
  const counts={ingredients:rows('SELECT COUNT(*) count FROM ingredient_master')[0]?.count||0,items:rows('SELECT COUNT(*) count FROM item_master')[0]?.count||0,recipes:rows('SELECT COUNT(*) count FROM recipe_master')[0]?.count||0,terms:rows('SELECT COUNT(*) count FROM canonical_term')[0]?.count||0};
  for(const [view,label] of [['ingredients','食材'],['items','道具'],['recipes','料理']]){
    const section=$(view);if(!section||section.querySelector('.canonical-catalog-status'))continue;
    const box=document.createElement('div');box.className='panel canonical-catalog-status';
    box.innerHTML=`<b>${label}公版主檔</b><br>Canonical Registry：${esc(rows("SELECT value_json FROM settings WHERE key='canonical_registry_version'")[0]?.value_json||'未建立')}<br>食材 ${counts.ingredients}、道具 ${counts.items}、料理 ${counts.recipes}、正規名詞 ${counts.terms}<br><span class="notice">玩家數量與解鎖狀態不由 GitHub 預載；初始為 0／未解鎖，儲存後才建立本機玩家紀錄。</span>`;
    section.insertBefore(box,section.children[1]||null);
  }
}

function renderAll(){renderIngredientCatalog();renderItemCatalog();renderRecipeCatalog();renderCatalogStatus();}
function catalogIsMissing(){
  return Boolean(
    ($('ingredientTable')&&!$('ingredientTable').querySelector('.canonical-ingredient-qty'))||
    ($('itemTable')&&!$('itemTable').querySelector('.canonical-item-qty'))||
    ($('recipeTable')&&!$('recipeTable').querySelector('.canonical-recipe-unlocked'))
  );
}
function ensureCatalogAuthority(){if(catalogIsMissing())renderAll();}
function scheduleRender(){for(const delay of [0,80,250,750,1500])setTimeout(ensureCatalogAuthority,delay);}
function observeCompetingRenderer(){
  observer?.disconnect();
  observer=new MutationObserver(()=>queueMicrotask(ensureCatalogAuthority));
  for(const id of ['ingredientTable','itemTable','recipeTable']){const table=$(id);if(table)observer.observe(table,{childList:true,subtree:true});}
}
function install(){
  if(installed){scheduleRender();return;}
  installed=true;
  renderAll();observeCompetingRenderer();
  document.querySelectorAll('nav button').forEach((button)=>button.addEventListener('click',scheduleRender,true));
  window.addEventListener('pokemon-sleep:data-changed',scheduleRender);
  window.addEventListener('pageshow',scheduleRender);
  window.dispatchEvent(new CustomEvent('pokemon-sleep:public-catalog-ready',{detail:{build:BUILD,authoritative_renderer:true}}));
  scheduleRender();
}

if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
else setTimeout(install,0);
