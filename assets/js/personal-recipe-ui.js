import {rows,run,snapshot,begin,commit,rollback,persist} from './database.js';
import {createPersonalRecipeService} from './personal-recipe-service.js';

export const PERSONAL_RECIPE_UI_VERSION='g51-personal-recipe-ui-2026-09-26-a';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const service=createPersonalRecipeService({rows,run,snapshot,begin,commit,rollback,persist});
let editingId=null;

function playerRows(){return rows("SELECT * FROM recipes WHERE source='player_manual' ORDER BY updated_at DESC, recipe_name");}
function fullRecipe(id){const recipe=service.load(id);return recipe?{...recipe,ingredients:recipe.ingredients||[]}:null;}
function ingredientRow(row={}){return `<div class="g51-ingredient-row" style="display:grid;grid-template-columns:minmax(0,1fr) 7rem auto;gap:.5rem;align-items:end"><label class="edit-field"><span>食材</span><input data-g51-ingredient-name value="${esc(row.ingredient_name||'')}" autocomplete="off"></label><label class="edit-field"><span>數量</span><input data-g51-ingredient-qty type="number" min="1" step="1" inputmode="numeric" value="${esc(row.quantity||1)}"></label><button type="button" data-g51-remove-ingredient>移除</button></div>`;}

function ensureShell(){
  const section=document.getElementById('recipes');if(!section)return null;
  let root=document.getElementById('g51PersonalRecipeRoot');if(root)return root;
  root=document.createElement('section');root.id='g51PersonalRecipeRoot';root.className='panel';root.dataset.g51Authority=PERSONAL_RECIPE_UI_VERSION;
  root.innerHTML=`<div class="section-head"><div><h3>我的食譜</h3><p class="notice">只修改本機玩家食譜；公版料理主檔保持唯讀。</p></div><button type="button" id="g51NewRecipeBtn">新增個人食譜</button></div><div id="g51PersonalRecipeList" class="cards"></div><form id="g51PersonalRecipeForm" class="edit-grid hidden"><input type="hidden" name="recipe_id"><label class="edit-field"><span>分類</span><input name="category" required></label><label class="edit-field"><span>名稱</span><input name="recipe_name" required></label><label class="edit-field"><span>料理等級</span><input name="recipe_level" type="number" min="1" inputmode="numeric"></label><label class="edit-field"><span>目前能量</span><input name="current_energy" type="number" min="0" inputmode="numeric"></label><label class="edit-field"><span>已開啟</span><input name="unlocked" type="checkbox"></label><label class="edit-field full"><span>備註</span><textarea name="notes"></textarea></label><div class="edit-field full"><div class="section-head"><strong>食材與數量</strong><button type="button" id="g51AddIngredientBtn">新增食材</button></div><div id="g51IngredientRows" style="display:grid;gap:.6rem"></div><p class="notice">總食材數由各列數量自動加總，不接受手動覆寫。</p></div><div class="buttons full"><button type="submit" id="g51SaveRecipeBtn">儲存</button><button type="button" id="g51CancelRecipeBtn">取消</button><button type="button" id="g51DeleteRecipeBtn" class="danger hidden">刪除此個人食譜</button></div></form>`;
  section.insertBefore(root,section.querySelector('.table-wrap'));
  bind(root);renderList(root);return root;
}

function readDraft(form){
  const ingredients=[...form.querySelectorAll('.g51-ingredient-row')].map(row=>({ingredient_name:row.querySelector('[data-g51-ingredient-name]').value,quantity:row.querySelector('[data-g51-ingredient-qty]').value}));
  return {recipe_id:form.elements.recipe_id.value.trim(),category:form.elements.category.value,recipe_name:form.elements.recipe_name.value,unlocked:form.elements.unlocked.checked,recipe_level:form.elements.recipe_level.value,current_energy:form.elements.current_energy.value,notes:form.elements.notes.value,ingredients};
}
function newId(){return `player:${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
function openEditor(root,recipe=null){
  editingId=recipe?.recipe_id||null;const form=root.querySelector('#g51PersonalRecipeForm');form.classList.remove('hidden');
  form.elements.recipe_id.value=recipe?.recipe_id||newId();form.elements.category.value=recipe?.category||'';form.elements.recipe_name.value=recipe?.recipe_name||'';form.elements.unlocked.checked=Boolean(Number(recipe?.unlocked||0));form.elements.recipe_level.value=recipe?.recipe_level??'';form.elements.current_energy.value=recipe?.current_energy??'';form.elements.notes.value=recipe?.notes||'';
  root.querySelector('#g51IngredientRows').innerHTML=(recipe?.ingredients?.length?recipe.ingredients:[{}]).map(ingredientRow).join('');
  root.querySelector('#g51DeleteRecipeBtn').classList.toggle('hidden',!recipe);form.scrollIntoView({behavior:'smooth',block:'start'});
}
function closeEditor(root){editingId=null;root.querySelector('#g51PersonalRecipeForm').classList.add('hidden');}
function renderList(root){
  const list=root.querySelector('#g51PersonalRecipeList');const data=playerRows();
  list.innerHTML=data.length?data.map(row=>`<article><strong>${esc(row.recipe_name)}</strong><span>${esc(row.category)} · ${Number(row.unlocked)?'已開啟':'未開啟'} · Lv ${esc(row.recipe_level??'—')} · 能量 ${esc(row.current_energy??'—')} · 食材 ${esc(row.total_ingredients??0)}</span><button type="button" data-g51-edit="${esc(row.recipe_id)}">編輯</button></article>`).join(''):'<p class="notice">尚無個人食譜。可從空白資料庫直接新增。</p>';
  list.querySelectorAll('[data-g51-edit]').forEach(button=>button.onclick=()=>openEditor(root,fullRecipe(button.dataset.g51Edit)));
}
function bind(root){
  root.querySelector('#g51NewRecipeBtn').onclick=()=>openEditor(root);
  root.querySelector('#g51CancelRecipeBtn').onclick=()=>closeEditor(root);
  root.querySelector('#g51AddIngredientBtn').onclick=()=>root.querySelector('#g51IngredientRows').insertAdjacentHTML('beforeend',ingredientRow());
  root.addEventListener('click',event=>{const button=event.target.closest('[data-g51-remove-ingredient]');if(button)button.closest('.g51-ingredient-row')?.remove();});
  root.querySelector('#g51PersonalRecipeForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;try{const draft=readDraft(form);if(editingId)await service.update(draft);else await service.create(draft);closeEditor(root);renderList(root);globalThis.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed',{detail:{g51_personal_recipe_mutation:true}}));alert('個人食譜已儲存');}catch(error){alert(`個人食譜儲存失敗：${error.message}`);}};
  root.querySelector('#g51DeleteRecipeBtn').onclick=async()=>{if(!editingId)return;if(!confirm('確定刪除此個人食譜？刪除前會建立本機快照。'))return;try{await service.delete(editingId);closeEditor(root);renderList(root);globalThis.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed',{detail:{g51_personal_recipe_mutation:true}}));alert('個人食譜已刪除');}catch(error){alert(`刪除失敗：${error.message}`);}};
}

export function setupPersonalRecipeUi(){return ensureShell();}
setupPersonalRecipeUi();
globalThis.addEventListener('pokemon-sleep-data-refreshed',event=>{if(event?.detail?.g51_personal_recipe_mutation)return;const root=document.getElementById('g51PersonalRecipeRoot');if(root)renderList(root);});
