import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';
import {analyzeIngredientGaps,sortGapResults} from './ingredient-gap-engine.js';

export const CURRENT_WEEK_RECIPE_RECOMMENDATION_VERSION='current-week-recipe-recommendation-2026-08-10-b';
let applying=false;
function inventory(){return rows('SELECT ingredient_name,quantity FROM ingredient_inventory');}
function personalAnalysis(inv){
  const recipes=rows('SELECT * FROM recipes WHERE unlocked=1 ORDER BY category,recipe_name');
  const ingredients=rows('SELECT * FROM recipe_ingredients ORDER BY recipe_id,ingredient_name');
  return analyzeIngredientGaps({recipes,recipeIngredients:ingredients,inventory:inv});
}
function referenceAnalysis(inv){
  const personal=rows('SELECT recipe_name,unlocked,notes FROM recipes'),names=new Set();
  for(const item of personal){if(Number(item.unlocked||0)===1)names.add(item.recipe_name);const match=String(item.notes||'').match(/對照主檔名稱：(.+)$/);if(match&&Number(item.unlocked||0)===1)names.add(match[1]);}
  const recipes=rows('SELECT * FROM recipe_master ORDER BY category,base_energy DESC,recipe_name').map(row=>({...row,unlocked:names.has(row.recipe_name)?1:0}));
  const ingredients=rows('SELECT * FROM recipe_master_ingredients ORDER BY recipe_id,ingredient_name');
  return analyzeIngredientGaps({recipes,recipeIngredients:ingredients,inventory:inv}).filter(row=>row.status!=='unlocked');
}
function recommendedNames(analysis,category){
  const normalized=normalizeDishCategory(category);if(!normalized)return new Set();
  const pool=analysis.filter(row=>normalizeDishCategory(row.category)===normalized);
  return new Set(sortGapResults(pool,'shortage').slice(0,3).map(row=>row.recipe_name));
}
function patchTable(table,names,nameCellIndex){
  if(!table)return;
  [...table.querySelectorAll('tbody tr')].forEach(row=>{
    const cells=row.cells;if(!cells?.length)return;
    const name=cells[nameCellIndex]?.textContent?.trim()||'',recommended=names.has(name);
    if(cells[0])cells[0].innerHTML=recommended?'<b>推薦</b>':'—';
    row.classList.toggle('weekly-recommended',recommended);
  });
}
function apply(){
  if(applying||!isDatabaseReady()||isRescueReadonly())return;
  const personalTable=document.getElementById('personalRecipeAnalysisTable'),referenceTable=document.getElementById('referenceRecipeTable');
  if(!personalTable&&!referenceTable)return;
  applying=true;
  try{
    const week=currentWeeklyContext(),category=normalizeDishCategory(week.dish_category),inv=inventory();
    patchTable(personalTable,recommendedNames(personalAnalysis(inv),category),2);
    patchTable(referenceTable,recommendedNames(referenceAnalysis(inv),category),2);
    for(const table of [personalTable,referenceTable])if(table){table.dataset.weeklyContextWeek=week.week_start||'';table.dataset.weeklyDishCategory=category||'';table.dataset.weeklyContextAuthority=week.authority_source||'MISSING';}
  }finally{applying=false;}
}
function schedule(delay=20){setTimeout(apply,delay);}
function install(){
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="recipes"]'))schedule(40);},true);
  document.addEventListener('pokemon-sleep-data-refreshed',()=>schedule(40));
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>schedule(40));
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(event.detail?.entity==='weekly_context')schedule(40);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(60),{once:true});else schedule(60);
}
install();
