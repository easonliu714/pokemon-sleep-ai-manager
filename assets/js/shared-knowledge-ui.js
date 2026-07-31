import {rows} from './database.js';

const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rendering=false;
let lastSignature='';

function activateView(button,viewId){
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id===viewId));
  document.querySelectorAll('nav button').forEach(item=>item.classList.toggle('active',item===button));
}

function ensureEncyclopediaUi(){
  const nav=document.querySelector('nav');
  const main=document.querySelector('main');
  if(!nav||!main)return false;
  let button=document.getElementById('encyclopediaNavBtn');
  if(!button){
    button=document.createElement('button');
    button.id='encyclopediaNavBtn';
    button.dataset.view='encyclopedia';
    button.textContent='資料百科';
    const guideButton=nav.querySelector('[data-view="guide"]');
    nav.insertBefore(button,guideButton||null);
    button.onclick=()=>activateView(button,'encyclopedia');
  }
  if(!document.getElementById('encyclopedia')){
    const section=document.createElement('section');
    section.id='encyclopedia';
    section.className='view';
    section.innerHTML=`<h2>資料百科</h2>
      <h3>樹果與屬性對照</h3>
      <p class="notice">樹果為共享參考資料，寶可夢會依屬性自動帶入對應樹果。官方資訊優先，第三方資料僅作補充。</p>
      <div class="table-wrap"><table id="berryMasterTable"></table></div>`;
    const guide=document.getElementById('guide');
    main.insertBefore(section,guide||null);
  }
  return true;
}

function ensureReferenceUi(){
  const section=document.getElementById('recipes');
  if(!section||!ensureEncyclopediaUi()) return false;
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
    wrapper.innerHTML=`
      <h3>推薦料理</h3>
      <p class="notice">共享參考資料只用於判斷目前庫存可嘗試哪些料理，以及還缺哪些食材；真正是否已解鎖，以玩家從遊戲截圖匯入或手動登記的個人食譜為準。</p>
      <div class="warning"><b>重要：</b>若依照參考配方投入足夠食材仍未解鎖，可能是第三方資訊、名稱對照或遊戲版本有誤。請勿持續浪費大量食材，建議改試其他組合，並查證官方公告、遊戲內資訊或其他可靠來源。</div>
      <div class="table-wrap"><table id="referenceRecipeTable"></table></div>`;
    section.appendChild(wrapper);
  }
  const guide=document.querySelector('#guide .prose');
  if(guide&&!document.getElementById('dataProvenanceGuide')){
    const block=document.createElement('div');
    block.id='dataProvenanceGuide';
    block.innerHTML=`<h3>共享資料來源與優先順序</h3>
      <p>共享知識庫以 Pokémon Sleep 官方公告與遊戲內畫面為第一優先。官方未公開、難以直接取得或需要彙整的稀缺資料，才會參考第三方網站。</p>
      <p>目前樹果名稱與屬性對照、料理名稱、基礎能量及需求食材，部分整理時參考了 <b>RaenonX</b> 網站及使用者提供的該網站畫面。第三方資料不視為官方資料；若與官方資訊衝突，一律以官方為準。</p>
      <p>第三方食譜的用途是提供「可嘗試解鎖」與「缺料」分析，不保證一定能解鎖。若依照參考配方仍未解鎖，請嘗試其他組合或改由官方與其他來源查證。</p>
      <p>每筆共享資料保留來源類型、來源名稱、參考來源、核對日期與資料版本。玩家的寶可夢、庫存、食譜解鎖狀態及策略仍只儲存在本機。</p>`;
    guide.appendChild(block);
  }
  return true;
}

function table(el,data,columns){
  if(!el)return;
  const head=columns.map(c=>`<th>${esc(c.label)}</th>`).join('');
  const body=data.map(r=>`<tr>${columns.map(c=>`<td>${c.render?c.render(r):esc(r[c.key])}</td>`).join('')}</tr>`).join('');
  el.innerHTML=`<thead><tr>${head}</tr></thead><tbody>${body||'<tr><td colspan="8">目前沒有資料</td></tr>'}</tbody>`;
}

function buildRecipeAnalysis(){
  const inventory=Object.fromEntries(rows('SELECT ingredient_name,quantity FROM ingredient_inventory').map(x=>[x.ingredient_name,Number(x.quantity||0)]));
  const personal=rows('SELECT recipe_id,recipe_name,unlocked,notes FROM recipes');
  const personalByName=new Map();
  for(const item of personal){
    personalByName.set(item.recipe_name,item);
    const match=String(item.notes||'').match(/對照主檔名稱：(.+)$/);
    if(match) personalByName.set(match[1],item);
  }
  const masters=rows('SELECT * FROM recipe_master ORDER BY category,base_energy DESC,recipe_name');
  const ingredients=rows('SELECT * FROM recipe_master_ingredients ORDER BY recipe_id,ingredient_name');
  const byRecipe=new Map();
  for(const item of ingredients){if(!byRecipe.has(item.recipe_id))byRecipe.set(item.recipe_id,[]);byRecipe.get(item.recipe_id).push(item);}
  return masters.map(master=>{
    const personalRecipe=personalByName.get(master.recipe_name);
    const unlocked=Number(personalRecipe?.unlocked||0)===1;
    const needs=byRecipe.get(master.recipe_id)||[];
    const missing=needs.map(item=>({ingredient_name:item.ingredient_name,required:Number(item.quantity||0),owned:Number(inventory[item.ingredient_name]||0),shortage:Math.max(0,Number(item.quantity||0)-Number(inventory[item.ingredient_name]||0))})).filter(item=>item.shortage>0);
    return {...master,unlocked,ingredients:needs.map(x=>`${x.ingredient_name} ×${x.quantity}`).join('、'),missing,canAttempt:!unlocked&&missing.length===0};
  });
}

export function renderSharedKnowledge(){
  if(rendering||!ensureReferenceUi()) return;
  rendering=true;
  try{
    const berries=rows('SELECT type_name,berry_name,source_name,verified_at FROM berry_master ORDER BY type_name');
    const recipes=buildRecipeAnalysis();
    const signature=`${berries.length}:${recipes.length}:${recipes.map(r=>r.recipe_id+':'+r.unlocked+':'+r.missing.map(x=>x.ingredient_name+'-'+x.shortage).join(',')).join('|')}`;
    const referenceRecipeTable=document.getElementById('referenceRecipeTable');
    const needsRender=signature!==lastSignature||!referenceRecipeTable?.querySelector('thead th:nth-child(7)');
    if(needsRender){
      table(document.getElementById('berryMasterTable'),berries,[{label:'屬性',key:'type_name'},{label:'樹果種類',key:'berry_name'},{label:'資料來源',render:r=>esc(r.source_name)},{label:'核對日期',key:'verified_at'}]);
      table(referenceRecipeTable,recipes,[
        {label:'分類',key:'category'},{label:'料理',key:'recipe_name'},{label:'基礎能量',render:r=>Number(r.base_energy||0).toLocaleString()},
        {label:'參考配方',key:'ingredients'},{label:'個人已解鎖',render:r=>r.unlocked?'是':'否'},
        {label:'庫存判定',render:r=>r.unlocked?'已解鎖':(r.canAttempt?'<b>材料足夠，可嘗試</b>':'材料不足')},
        {label:'缺少食材',render:r=>r.unlocked?'—':(r.missing.length?r.missing.map(x=>`${esc(x.ingredient_name)} 缺 ${x.shortage}`).join('、'):'無')},{label:'來源',render:r=>esc(r.source_name)}
      ]);
      lastSignature=signature;
    }
  }catch(error){console.warn('Shared knowledge render deferred',error);}finally{rendering=false;}
}

function boot(){renderSharedKnowledge();setTimeout(renderSharedKnowledge,300);setTimeout(renderSharedKnowledge,1200);setInterval(renderSharedKnowledge,1500);document.querySelector('nav')?.addEventListener('click',()=>setTimeout(renderSharedKnowledge,100));document.addEventListener('pokemon-sleep-data-refreshed',renderSharedKnowledge);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
