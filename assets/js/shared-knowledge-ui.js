import {rows} from './database.js';

const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ready=false;

function ensureReferenceUi(){
  const section=document.getElementById('recipes');
  if(!section||document.getElementById('berryMasterTable')) return;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=`
    <h3>樹果與屬性對照</h3>
    <p class="notice">樹果為屬性固定資料；新增或更新寶可夢時可由屬性自動帶入。</p>
    <div class="table-wrap"><table id="berryMasterTable"></table></div>
    <h3>共享食譜主檔</h3>
    <p class="notice">基礎能量與需求食材屬共享資料；個人解鎖狀態仍只存在本機。</p>`;
  section.insertBefore(wrapper,document.getElementById('recipeTable')?.parentElement||null);
}

function table(el,data,columns){
  if(!el)return;
  const head=columns.map(c=>`<th>${esc(c.label)}</th>`).join('');
  const body=data.map(r=>`<tr>${columns.map(c=>`<td>${c.render?c.render(r):esc(r[c.key])}</td>`).join('')}</tr>`).join('');
  el.innerHTML=`<thead><tr>${head}</tr></thead><tbody>${body||'<tr><td>目前沒有資料</td></tr>'}</tbody>`;
}

function render(){
  try{
    ensureReferenceUi();
    const berries=rows('SELECT type_name,berry_name,source_name,verified_at FROM berry_master ORDER BY type_name');
    const recipes=rows(`SELECT m.*,
      COALESCE((SELECT unlocked FROM recipes r WHERE r.recipe_id=m.recipe_id),0) unlocked,
      (SELECT GROUP_CONCAT(ingredient_name||' ×'||quantity,'、') FROM recipe_master_ingredients i WHERE i.recipe_id=m.recipe_id) ingredients
      FROM recipe_master m ORDER BY category,base_energy DESC,recipe_name`);
    table(document.getElementById('berryMasterTable'),berries,[
      {label:'屬性',key:'type_name'},{label:'樹果種類',key:'berry_name'},
      {label:'資料來源',render:r=>esc(r.source_name)},{label:'核對日期',key:'verified_at'}
    ]);
    table(document.getElementById('recipeTable'),recipes,[
      {label:'分類',key:'category'},{label:'食譜',key:'recipe_name'},
      {label:'基礎能量',render:r=>Number(r.base_energy||0).toLocaleString()},
      {label:'需求食材',key:'ingredients'},{label:'已解鎖',render:r=>r.unlocked?'是':'否'},
      {label:'來源',render:r=>esc(r.source_name)}
    ]);
    ready=true;
  }catch(error){
    if(ready) console.warn('Shared knowledge render failed',error);
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  render();
  setTimeout(render,1200);
  setInterval(render,5000);
  document.querySelector('nav')?.addEventListener('click',()=>setTimeout(render,100));
});
