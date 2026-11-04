import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {currentEffectiveWeeklyContext} from './effective-weekly-context.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';
import {analyzeIngredientGaps} from './ingredient-gap-engine.js';
import {weeklyRecipeRecommendationNames} from './recipe-weekly-feedback-recommendation.js';
import {listRecipeAttemptFeedbackSummaries} from './recipe-attempt-feedback-local.js';

export const CURRENT_WEEK_RECIPE_RECOMMENDATION_VERSION='current-week-recipe-recommendation-2026-08-17-c-effective-context';
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
    const week=currentEffectiveWeeklyContext(),category=normalizeDishCategory(week.dish_category),inv=inventory();
    patchTable(personalTable,weeklyRecipeRecommendationNames(personalAnalysis(inv),category),2);
    // G6.2: fail closed if local feedback cannot be read. A legacy "推薦" badge
    // has no suspect-source qualifier and must never override a player pause.
    let referenceNames=new Set();
    if(referenceTable){
      try{
        const feedbackRows=listRecipeAttemptFeedbackSummaries();
        referenceNames=weeklyRecipeRecommendationNames(referenceAnalysis(inv),category,feedbackRows);
      }catch{
        console.warn('Weekly reference recommendations withheld: feedback authority unavailable');
      }
    }
    patchTable(referenceTable,referenceNames,2);
    for(const table of [personalTable,referenceTable])if(table){table.dataset.weeklyContextWeek=week.week_start||'';table.dataset.weeklyDishCategory=category||'';table.dataset.weeklyContextAuthority=week.player_weekly_authority_source||week.authority_source||'MISSING';table.dataset.publicEventAuthority=week.public_event_authority_status||'PUBLIC_EVENT_MASTER_UNAVAILABLE';}
  }finally{applying=false;}
}
function schedule(delay=20){setTimeout(apply,delay);}
function install(){
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="recipes"]'))schedule(40);},true);
  document.addEventListener('pokemon-sleep-data-refreshed',()=>schedule(40));
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>schedule(40));
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(['weekly_context','public_event_master','recipe_feedback_state','recipe_attempt_feedback'].includes(event.detail?.entity))schedule(40);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(60),{once:true});else schedule(60);
}
install();
