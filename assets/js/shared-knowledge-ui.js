import {rows} from './database.js';
import {analyzeIngredientGaps,sortGapResults} from './ingredient-gap-engine.js';

const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rendering=false;
let lastSignature='';

function ensureKnowledgeUi(){
  const section=document.getElementById('knowledge');
  const panel=document.getElementById('sharedKnowledgePanel');
  if(!section||!panel)return false;
  if(!document.getElementById('berryMasterTable')){
    panel.classList.remove('loading-placeholder');
    panel.innerHTML='<h3>樹果與屬性對照</h3><p class="notice">樹果為共享參考資料，官方資訊優先，第三方資料僅作補充。</p><div class="table-wrap"><table id="berryMasterTable"></table></div>';
  }
  return true;
}

function removeLegacyDuplicate(){
  document.getElementById('encyclopediaNavBtn')?.remove();
  document.getElementById('encyclopedia')?.remove();
}

function ensureReferenceUi(){
  removeLegacyDuplicate();
  const section=document.getElementById('recipes');
  if(!section||!ensureKnowledgeUi())return false;
  const personalTable=document.getElementById('recipeTable');
  if(personalTable&&!document.getElementById('personalRecipeHeading')){
    const heading=document.createElement('h3');
    heading.id='personalRecipeHeading';
    heading.textContent='我的食譜';
    personalTable.parentElement?.insertAdjacentElement('beforebegin',heading);
  }
  if(!document.getElementById('sharedKnowledgeBlock')){
    const wrapper=document.createElement('div');
    wrapper.id='sharedKnowledgeBlock';
    wrapper.innerHTML=`<h3>未開啟參考食譜</h3>
      <p class="notice">只列出尚未開啟的共享參考食譜。依本週料理類型與缺口排序後的前三名會以底色標示；參考配方不保證一定能解鎖。</p>
      <div class="warning"><b>重要：</b>若依照參考配方投入足夠食材仍未解鎖，請停止重複消耗食材並改查官方公告、遊戲內資訊或其他可靠來源。</div>
      <div class="table-wrap"><table id="referenceRecipeTable"></table></div>`;
    section.appendChild(wrapper);
  }
  return true;
}

function table(el,data,columns,rowClass){
  if(!el)return;
  const head=columns.map(c=>`<th>${esc(c.label)}</th>`).join('');
  const body=data.map(r=>`<tr class="${rowClass?esc(rowClass(r)||''):''}">${columns.map(c=>`<td>${c.render?c.render(r):esc(r[c.key])}</td>`).join('')}</tr>`).join('');
  el.innerHTML=`<thead><tr>${head}</tr></thead><tbody>${body||'<tr><td colspan="10">目前沒有資料</td></tr>'}</tbody>`;
}

function ingredientText(items){return items.map(x=>`${esc(x.ingredient_name)} ×${x.required??x.quantity}`).join('、')||'—';}
function shortageText(items){const missing=items.filter(x=>Number(x.shortage||0)>0);return missing.length?missing.map(x=>`${esc(x.ingredient_name)} 缺 ${x.shortage}`).join('、'):'無';}
function inventoryStatus(items){return items.some(x=>Number(x.shortage||0)>0)?'材料不足':'材料足夠';}
function normalizeCategory(value){return String(value||'').trim().replaceAll('/','／');}

function buildPersonalAnalysis(inventory){
  const recipes=rows('SELECT * FROM recipes WHERE unlocked=1 ORDER BY category,recipe_name');
  const ingredients=rows('SELECT * FROM recipe_ingredients ORDER BY recipe_id,ingredient_name');
  return analyzeIngredientGaps({recipes,recipeIngredients:ingredients,inventory});
}

function buildReferenceAnalysis(inventory){
  const personal=rows('SELECT recipe_name,unlocked,notes FROM recipes');
  const names=new Set();
  for(const item of personal){
    if(Number(item.unlocked||0)===1)names.add(item.recipe_name);
    const match=String(item.notes||'').match(/對照主檔名稱：(.+)$/);
    if(match&&Number(item.unlocked||0)===1)names.add(match[1]);
  }
  const recipes=rows('SELECT * FROM recipe_master ORDER BY category,base_energy DESC,recipe_name').map(r=>({...r,unlocked:names.has(r.recipe_name)?1:0}));
  const ingredients=rows('SELECT * FROM recipe_master_ingredients ORDER BY recipe_id,ingredient_name');
  return analyzeIngredientGaps({recipes,recipeIngredients:ingredients,inventory}).filter(r=>r.status!=='unlocked');
}

function weeklyRecommendations(analysis){
  const week=rows('SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1')[0]||{};
  const category=normalizeCategory(week.dish_category);
  const pool=category?analysis.filter(r=>normalizeCategory(r.category)===category):[];
  return new Set(sortGapResults(pool,'shortage').slice(0,3).map(r=>r.recipe_id));
}

export function renderSharedKnowledge(force=false){
  if(rendering||!ensureReferenceUi())return;
  rendering=true;
  try{
    const inventory=rows('SELECT ingredient_name,quantity FROM ingredient_inventory');
    const berries=rows('SELECT type_name,berry_name,source_name,verified_at FROM berry_master ORDER BY type_name');
    const personal=buildPersonalAnalysis(inventory);
    const reference=buildReferenceAnalysis(inventory);
    const personalWeekly=weeklyRecommendations(personal);
    const referenceWeekly=weeklyRecommendations(reference);
    const signature=JSON.stringify({inventory,berries,personal:personal.map(r=>[r.recipe_id,r.total_shortage]),reference:reference.map(r=>[r.recipe_id,r.total_shortage]),personalWeekly:[...personalWeekly],referenceWeekly:[...referenceWeekly]});
    if(!force&&signature===lastSignature)return;
    table(document.getElementById('berryMasterTable'),berries,[
      {label:'屬性',key:'type_name'},{label:'樹果種類',key:'berry_name'},{label:'資料來源',key:'source_name'},{label:'核對日期',key:'verified_at'}
    ]);
    table(document.getElementById('recipeTable'),personal,[
      {label:'本週',render:r=>personalWeekly.has(r.recipe_id)?'<b>推薦</b>':'—'},
      {label:'分類',key:'category'},{label:'食譜',key:'recipe_name'},
      {label:'等級',render:r=>r.recipe_level??'—'},{label:'目前能量',render:r=>r.current_energy==null?'—':Number(r.current_energy).toLocaleString()},
      {label:'需求配方',render:r=>ingredientText(r.requirements)},
      {label:'庫存判定',render:r=>inventoryStatus(r.requirements)},
      {label:'缺料',render:r=>shortageText(r.requirements)}
    ],r=>personalWeekly.has(r.recipe_id)?'weekly-recommended':'');
    table(document.getElementById('referenceRecipeTable'),reference,[
      {label:'本週',render:r=>referenceWeekly.has(r.recipe_id)?'<b>推薦</b>':'—'},
      {label:'分類',key:'category'},{label:'料理',key:'recipe_name'},
      {label:'基礎能量',render:r=>Number(r.base_energy||0).toLocaleString()},
      {label:'參考配方',render:r=>ingredientText(r.requirements)},
      {label:'庫存判定',render:r=>r.can_attempt?'<b>材料足夠，可嘗試</b>':(r.status==='near'?'接近可嘗試':'材料不足')},
      {label:'缺料',render:r=>shortageText(r.requirements)},{label:'來源',key:'source_name'}
    ],r=>referenceWeekly.has(r.recipe_id)?'weekly-recommended':'');
    lastSignature=signature;
  }catch(error){
    console.warn('Shared knowledge render deferred',error);
  }finally{rendering=false;}
}

function boot(){
  removeLegacyDuplicate();
  renderSharedKnowledge();
  setTimeout(renderSharedKnowledge,300);
  setTimeout(renderSharedKnowledge,1200);
  setInterval(renderSharedKnowledge,1500);
  document.querySelector('nav')?.addEventListener('click',()=>setTimeout(renderSharedKnowledge,100));
  document.addEventListener('pokemon-sleep-data-refreshed',renderSharedKnowledge);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
