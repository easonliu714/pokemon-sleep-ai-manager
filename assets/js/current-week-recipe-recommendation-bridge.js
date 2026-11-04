import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {currentEffectiveWeeklyContext} from './effective-weekly-context.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';
import {analyzeIngredientGaps} from './ingredient-gap-engine.js';
import {weeklyRecipeRecommendationNames} from './recipe-weekly-feedback-recommendation.js';
import {listRecipeAttemptFeedbackSummaries} from './recipe-attempt-feedback-local.js';

export const CURRENT_WEEK_RECIPE_RECOMMENDATION_VERSION='current-week-recipe-recommendation-2026-08-17-c-effective-context';
let applying=false;
// G6.2: a legacy badge is actionable advice; do not coerce unknown stock to zero.
function inventory(){
  const stock=rows('SELECT ingredient_name,quantity FROM ingredient_inventory');
  if(!Array.isArray(stock)||stock.some(row=>{
    if(!row||typeof row.ingredient_name!=='string'||!row.ingredient_name.trim())return true;
    const quantity=row.quantity;
    if(typeof quantity==='number')return !Number.isSafeInteger(quantity)||quantity<0;
    if(typeof quantity==='string')return !/^(0|[1-9][0-9]*)$/.test(quantity)||!Number.isSafeInteger(Number(quantity));
    return true;
  }))throw new Error('G62_LEGACY_INVENTORY_UNVERIFIED');
  return stock;
}
// G6.2: an incomplete or coercible recipe requirement is not verified zero demand.
// Never rank actionable legacy badges from a partial recipe-ingredient read.
function verifiedRequirements(recipes,requirements){
  if(!Array.isArray(recipes)||!Array.isArray(requirements))
    throw new Error('G62_LEGACY_RECIPE_REQUIREMENTS_UNVERIFIED');
  const ids=new Set();
  for(const recipe of recipes){
    if(!recipe||recipe.recipe_id===null||recipe.recipe_id===undefined)
      throw new Error('G62_LEGACY_RECIPE_REQUIREMENTS_UNVERIFIED');
    ids.add(recipe.recipe_id);
  }
  const covered=new Set();
  for(const item of requirements){
    const quantity=item?.quantity;
    const validQuantity=(typeof quantity==='number'&&Number.isSafeInteger(quantity)&&quantity>0)
      ||(typeof quantity==='string'&&/^[1-9][0-9]*$/.test(quantity)&&Number.isSafeInteger(Number(quantity)));
    if(!item||!ids.has(item.recipe_id)||typeof item.ingredient_name!=='string'
      ||!item.ingredient_name.trim()||!validQuantity)
      throw new Error('G62_LEGACY_RECIPE_REQUIREMENTS_UNVERIFIED');
    covered.add(item.recipe_id);
  }
  if([...ids].some(id=>!covered.has(id)))
    throw new Error('G62_LEGACY_RECIPE_REQUIREMENTS_UNVERIFIED');
  return requirements;
}
function personalAnalysis(inv){
  const recipes=rows('SELECT * FROM recipes WHERE unlocked=1 ORDER BY category,recipe_name');
  const ingredients=rows('SELECT * FROM recipe_ingredients ORDER BY recipe_id,ingredient_name');
  return analyzeIngredientGaps({recipes,recipeIngredients:verifiedRequirements(recipes,ingredients),inventory:inv});
}
function referenceAnalysis(inv){
  const personal=rows('SELECT recipe_name,unlocked,notes FROM recipes'),names=new Set();
  for(const item of personal){if(Number(item.unlocked||0)===1)names.add(item.recipe_name);const match=String(item.notes||'').match(/對照主檔名稱：(.+)$/);if(match&&Number(item.unlocked||0)===1)names.add(match[1]);}
  const recipes=rows('SELECT * FROM recipe_master ORDER BY category,base_energy DESC,recipe_name').map(row=>({...row,unlocked:names.has(row.recipe_name)?1:0}));
  const ingredients=rows('SELECT * FROM recipe_master_ingredients ORDER BY recipe_id,ingredient_name');
  return analyzeIngredientGaps({recipes,recipeIngredients:verifiedRequirements(recipes,ingredients),inventory:inv}).filter(row=>row.status!=='unlocked');
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
    // Only query the personal table when that legacy surface is present.
    if(personalTable)patchTable(personalTable,weeklyRecipeRecommendationNames(personalAnalysis(inv),category),2);
    // G6.2: fail closed if local feedback cannot be read. A legacy "推薦" badge
    // has no suspect-source qualifier and must never override a player pause.
    let referenceNames=new Set(),recommendationStatus='VERIFIED_READ';
    if(referenceTable){
      let feedbackRows,feedbackVerified=true;
      try{feedbackRows=listRecipeAttemptFeedbackSummaries();}
      catch{
        feedbackVerified=false;
        recommendationStatus='HOLD_FEEDBACK_READ_FAILED';
        console.warn('Weekly reference recommendations withheld: feedback authority unavailable');
      }
      // Recipe requirement read/validation errors belong to the outer source
      // fail-closed boundary, not the narrower feedback-authority HOLD.
      if(feedbackVerified)
        referenceNames=weeklyRecipeRecommendationNames(referenceAnalysis(inv),category,feedbackRows);
    }
    patchTable(referenceTable,referenceNames,2);
    for(const table of [personalTable,referenceTable])if(table){table.dataset.weeklyContextWeek=week.week_start||'';table.dataset.weeklyDishCategory=category||'';table.dataset.weeklyContextAuthority=week.player_weekly_authority_source||week.authority_source||'MISSING';table.dataset.publicEventAuthority=week.public_event_authority_status||'PUBLIC_EVENT_MASTER_UNAVAILABLE';table.dataset.weeklyRecommendationStatus=recommendationStatus;}
  }catch(error){
    // A failed or malformed inventory/recipe read cannot retain old "推薦" badges.
    patchTable(personalTable,new Set(),2);
    patchTable(referenceTable,new Set(),2);
    for(const table of [personalTable,referenceTable])if(table)table.dataset.weeklyRecommendationStatus='HOLD_SOURCE_READ_FAILED';
    console.warn('Weekly recipe recommendations withheld: source authority unavailable',error?.message||String(error));
  }finally{applying=false;}
}
function schedule(delay=20){setTimeout(apply,delay);}
function install(){
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="recipes"]'))schedule(40);},true);
  document.addEventListener('pokemon-sleep-data-refreshed',()=>schedule(40));
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>schedule(40));
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(['weekly_context','public_event_master','recipe_feedback_state','recipe_attempt_feedback','ingredient_inventory'].includes(event.detail?.entity))schedule(40);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(60),{once:true});else schedule(60);
}
install();
