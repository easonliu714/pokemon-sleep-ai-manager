import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {currentEffectiveWeeklyContext} from './effective-weekly-context.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';
import {analyzeIngredientGaps} from './ingredient-gap-engine.js';
import {weeklyRecipeRecommendationNames} from './recipe-weekly-feedback-recommendation.js';
import {PUBLIC_INGREDIENT_CANONICAL_NAMES} from './public-ingredient-identity.js';
import {listRecipeAttemptFeedbackSummaries,getRecipeAttemptPersistenceStatus} from './recipe-attempt-feedback-local.js';

export const CURRENT_WEEK_RECIPE_RECOMMENDATION_VERSION='current-week-recipe-recommendation-2026-08-17-c-effective-context';
let applying=false;
// G6.2: a legacy badge is actionable advice; do not coerce unknown stock to zero.
function inventory(){
  const stock=rows('SELECT ingredient_name,quantity FROM ingredient_inventory');
  // G6.2: empty stock coverage is not an authoritative zero for every
  // ingredient; clear previously rendered legacy recommendation badges.
  if(!Array.isArray(stock)||stock.length===0||stock.some(row=>{
    if(!row||typeof row.ingredient_name!=='string'||!row.ingredient_name.trim())return true;
    // Unknown/legacy-alias-only stock is not canonical ingredient coverage.
    if(!PUBLIC_INGREDIENT_CANONICAL_NAMES.includes(row.ingredient_name))return true;
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
  // G6.2: personal analysis contains only unlocked recipes; the recipe_ingredients
  // table also holds valid locked-recipe requirements. Scope rows to eligible IDs
  // before the strict per-recipe coverage check, without treating missing rows as zero.
  const ids=new Set(recipes.map(recipe=>recipe.recipe_id));
  const ingredients=rows('SELECT * FROM recipe_ingredients ORDER BY recipe_id,ingredient_name').filter(item=>ids.has(item?.recipe_id));
  return analyzeIngredientGaps({recipes,recipeIngredients:verifiedRequirements(recipes,ingredients),inventory:inv});
}
// G6.2: an unverified player unlock flag must not become an actionable
// "locked" reference recommendation via Number()/truthiness coercion.
function verifiedPlayerUnlock(value){
  if(value===0||value==='0')return false;
  if(value===1||value==='1')return true;
  throw new Error('G62_LEGACY_PLAYER_UNLOCK_UNVERIFIED');
}
function referenceAnalysis(inv){
  const personal=rows('SELECT recipe_name,unlocked,notes FROM recipes'),names=new Set();
  if(!Array.isArray(personal))throw new Error('G62_LEGACY_PLAYER_UNLOCK_UNVERIFIED');
  for(const item of personal){
    if(!item||typeof item.recipe_name!=='string'||!item.recipe_name.trim())
      throw new Error('G62_LEGACY_PLAYER_UNLOCK_UNVERIFIED');
    if(!verifiedPlayerUnlock(item.unlocked))continue;
    names.add(item.recipe_name);
    const match=String(item.notes||'').match(/對照主檔名稱：(.+)$/);
    if(match)names.add(match[1]);
  }
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
  if(applying)return;
  const personalTable=document.getElementById('personalRecipeAnalysisTable'),referenceTable=document.getElementById('referenceRecipeTable');
  if(!personalTable&&!referenceTable)return;
  // G6.2: a previously verified badge must not survive a later rescue/DB loss.
  // Clear only the read-side DOM projection; never query or mutate player storage.
  if(isRescueReadonly()||!isDatabaseReady()){
    patchTable(personalTable,new Set(),2);
    patchTable(referenceTable,new Set(),2);
    for(const table of [personalTable,referenceTable])if(table)
      table.dataset.weeklyRecommendationStatus='HOLD_PLAYER_DATABASE_UNAVAILABLE';
    return;
  }
  applying=true;
  try{
    // G6.2: a SQL COMMIT with an unconfirmed IDB ACK is not durable feedback
    // authority. Never leave actionable legacy badges visible during that HOLD.
    // The existing readback contract may release the HOLD after a fresh reload.
    const persistence=getRecipeAttemptPersistenceStatus();
    if(!persistence||!['CLEAR','PERSISTED','NOT_PERSISTED'].includes(persistence.status)){
      patchTable(personalTable,new Set(),2);
      patchTable(referenceTable,new Set(),2);
      for(const table of [personalTable,referenceTable])if(table)
        table.dataset.weeklyRecommendationStatus='HOLD_FEEDBACK_PERSISTENCE_UNCERTAIN';
      return;
    }
    const week=currentEffectiveWeeklyContext(),category=normalizeDishCategory(week.dish_category),inv=inventory();
    // G6.2: BOTH legacy badge surfaces are actionable advice. The personal
    // table previously bypassed player pause/suspect feedback entirely.
    // Read one verified feedback snapshot for both tables; if unavailable,
    // withhold both projections rather than re-admitting paused recipes.
    let feedbackRows=null,recommendationStatus='VERIFIED_READ';
    try{
      feedbackRows=listRecipeAttemptFeedbackSummaries();
      if(!Array.isArray(feedbackRows))throw new Error('G62_LEGACY_FEEDBACK_UNVERIFIED');
    }catch{
      recommendationStatus='HOLD_FEEDBACK_READ_FAILED';
      console.warn('Weekly recipe recommendations withheld: feedback authority unavailable');
    }
    // Only query each recipe source when its legacy table is present AND
    // the shared feedback read succeeded. This never writes player state.
    if(personalTable)patchTable(personalTable,feedbackRows
      ?weeklyRecipeRecommendationNames(personalAnalysis(inv),category,feedbackRows):new Set(),2);
    if(referenceTable)patchTable(referenceTable,feedbackRows
      ?weeklyRecipeRecommendationNames(referenceAnalysis(inv),category,feedbackRows):new Set(),2);
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
  // The feedback writer emits this on post-COMMIT persistence uncertainty
  // without emitting data-changed. Invalidate visible advice immediately.
  globalThis.addEventListener?.('pokemon-sleep:recipe-attempt-persistence-uncertain',()=>apply());
  // G6.2: recipe unlock/state saves emit 'recipes'; refresh both legacy badge
  // projections so a previously recommended recipe cannot retain stale advice.
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(['weekly_context','public_event_master','recipe_feedback_state','recipe_attempt_feedback','ingredient_inventory','recipes'].includes(event.detail?.entity))schedule(40);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(60),{once:true});else schedule(60);
}
install();
