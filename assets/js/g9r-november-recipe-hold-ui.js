// G9R: render read-only HOLD candidates from the sole audited evidence register.
// Never promote these rows into ACTIVE recipe_master or touch player storage.
import {NOVEMBER_BANQUET_RECIPE_EVIDENCE as candidates} from './g9r-november-recipe-evidence-hold.js';

export function renderNovemberRecipeHold(root=document.getElementById('novemberBanquetRecipeHold')){
  if(!root)return false;
  const list=root.querySelector('[data-g9r-hold-list]');
  if(!list)return false;
  const rows=candidates.filter(row=>row.active===false&&row.verification_status==='HOLD_FORMULA_AND_NAME_EVIDENCE');
  if(rows.length!==3){list.replaceChildren();root.dataset.evidenceStatus='HOLD_UNAVAILABLE';return false;}
  const labels={curry:'咖哩',salad:'沙拉',dessert:'甜點'};
  const fragment=document.createDocumentFragment();
  for(const row of rows){
    const li=document.createElement('li');
    li.textContent=`${labels[row.category]||row.category}｜總食材數 ${row.total_ingredients}：${row.ingredient_names.join('、')}`;
    fragment.appendChild(li);
  }
  list.replaceChildren(fragment);
  root.dataset.evidenceStatus='HOLD_FORMULA_AND_NAME_EVIDENCE';
  return true;
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>renderNovemberRecipeHold(),{once:true});
  else renderNovemberRecipeHold();
}
