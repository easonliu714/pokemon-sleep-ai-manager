import {rows,run,persist,snapshot,begin,commit,rollback,isRescueReadonly} from './database.js';
import {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION} from './public-recipe-current-authority.js';
import {PUBLIC_INGREDIENT_CANONICAL_NAMES} from './public-ingredient-identity.js';
import {analyzeIngredientGaps,sortGapResults} from './ingredient-gap-engine.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';
import {localIso} from './time-utils.js';
import {applyRecipeAttemptFeedback} from './recipe-attempt-feedback.js';
import {listRecipeAttemptFeedbackSummaries,getRecipeAttemptPersistenceStatus} from './recipe-attempt-feedback-local.js';

export const RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION='recipe-unified-player-workbench-2026-08-12-b-summary-cards';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const draftById=new Map();
const authorityById=new Map(PUBLIC_RECIPE_MASTER.map(recipe=>[String(recipe.recipe_id),recipe]));
const ingredientRows=PUBLIC_RECIPE_MASTER.flatMap(recipe=>(recipe.ingredients||[]).map(item=>({recipe_id:recipe.recipe_id,ingredient_name:item.ingredient_name,quantity:Number(item.quantity||0)})));
const CATEGORY_ORDER=Object.freeze(['咖哩／濃湯','沙拉','甜點／飲料']);
const numberOrNull=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};
// G6.2: SQLite unlock authority is a canonical 0/1 flag. Truthy or numeric
// coercion of corrupted player state must never authorize actionable advice.
const validPlayerUnlock=value=>value===0||value===1||value==='0'||value==='1';
const isUnlocked=value=>value===1||value==='1';

function dbReady(){
  try{return !isRescueReadonly()&&Number(rows('SELECT COUNT(*) AS count FROM schema_migrations')[0]?.count||0)>0;}catch{return false;}
}

function sortRows(data){
  return [...data].sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''),'zh-Hant')||String(a.recipe_name||'').localeCompare(String(b.recipe_name||''),'zh-Hant'));
}

function recommendations(data,week){
  const category=normalizeDishCategory(week?.dish_category);
  if(!category)return new Set();
  // G6.2: player-paused recipes remain in the catalog, but cannot receive a weekly recommendation badge.
  const pool=data.filter(row=>normalizeDishCategory(row.category)===category&&row.recommendation_paused!==true);
  // G6.2: a player-marked suspect reference remains eligible when explicitly unpaused,
  // but must rank after independently unflagged recipes to avoid repeat waste.
  const ranked=sortGapResults(pool,'shortage');
  const unflagged=ranked.filter(row=>row.reference_maybe_wrong!==true);
  const needsReview=ranked.filter(row=>row.reference_maybe_wrong===true);
  return new Set([...unflagged,...needsReview].slice(0,3).map(row=>String(row.recipe_id)));
}

function categoryStatistics(catalogRows){
  const stats={};
  for(const category of CATEGORY_ORDER){
    const rowsForCategory=catalogRows.filter(row=>normalizeDishCategory(row.category)===category);
    const unlocked=rowsForCategory.filter(row=>isUnlocked(row.unlocked)).length;
    stats[category]=Object.freeze({category,total:rowsForCategory.length,unlocked,locked:rowsForCategory.length-unlocked});
  }
  return Object.freeze(stats);
}

// G6.2: feedback read failure is not proof that no recipe is paused.
// Keep the public catalog visible, but withhold all recommendation badges.
export function readRecipeFeedbackForProjection({readonly=false,readFeedback=listRecipeAttemptFeedbackSummaries,readPersistenceStatus=getRecipeAttemptPersistenceStatus}={}){
  if(readonly)return Object.freeze({rows:[],verified:false,status:'DATABASE_READONLY_OR_NOT_READY'});
  try{
    // G6.2: an in-memory SQL COMMIT is not a verified durable player feedback read.
    // Match the legacy badge gate: no recommendation until persistence settles or
    // an independent reload resolves the exact ambiguous attempt/toggle marker.
    const persistence=readPersistenceStatus();
    if(!persistence||!['CLEAR','PERSISTED','NOT_PERSISTED'].includes(persistence.status))
      return Object.freeze({rows:[],verified:false,status:'HOLD_FEEDBACK_PERSISTENCE_UNCERTAIN'});
    const rows=readFeedback();
    if(!Array.isArray(rows))throw new Error('recipe_feedback_rows_invalid');
    return Object.freeze({rows,verified:true,status:'VERIFIED_READ'});
  }catch{
    console.warn('Recipe feedback read unavailable; weekly recommendation badges withheld');
    return Object.freeze({rows:[],verified:false,status:'HOLD_FEEDBACK_READ_FAILED'});
  }
}

// G6.2: an unreadable ingredient inventory is not proof of zero stock.
// Preserve the public recipe catalog but withhold stock-derived recommendations.
export function readRecipeInventoryForProjection({readonly=false,readInventory=()=>rows('SELECT ingredient_name,quantity FROM ingredient_inventory')}={}){
  if(readonly)return Object.freeze({rows:[],verified:false,status:'DATABASE_READONLY_OR_NOT_READY'});
  try{
    const data=readInventory();
    // SQLite NULL, empty text, booleans and objects must never coerce to verified zero stock.
    // Permit actual nonnegative integer values and canonical decimal integer strings only.
    const validQuantity=value=>(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)
      ||(typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)
        &&Number.isSafeInteger(Number(value)));
    if(!Array.isArray(data)||data.some(row=>!row||typeof row!=='object'
      ||!String(row.ingredient_name||'').trim()||!validQuantity(row.quantity)))
      throw new Error('recipe_inventory_rows_invalid');
    // G6.2 independent canonical-identity admission: a nonempty SQL result
    // containing only unknown/legacy-alias names is not observed canonical
    // stock. A malformed row also cannot certify other otherwise-valid rows.
    // This is read-only; never silently rewrite player ingredient identities.
    if(data.some(row=>!PUBLIC_INGREDIENT_CANONICAL_NAMES.includes(row.ingredient_name)))
      return Object.freeze({rows:[],verified:false,status:'HOLD_INVENTORY_IDENTITY_UNVERIFIED'});
    // G6.2: no observed ingredient rows is not proof that every stock is zero.
    // Keep the public catalog visible but withhold actionable weekly badges.
    if(data.length===0)return Object.freeze({rows:[],verified:false,status:'HOLD_INVENTORY_NOT_OBSERVED'});
    return Object.freeze({rows:data,verified:true,status:'VERIFIED_READ'});
  }catch{
    console.warn('Recipe inventory read unavailable; shortages and weekly recommendations withheld');
    return Object.freeze({rows:[],verified:false,status:'HOLD_INVENTORY_READ_FAILED'});
  }
}

export function buildRecipeUnifiedWorkbenchProjection({catalogRows=[],inventory=[],week={},recipeFeedback=[],feedbackAuthorityVerified=true,feedbackAuthorityStatus=null,inventoryAuthorityVerified=true}={}){
  const ids=catalogRows.map(row=>String(row.recipe_id));
  const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
  // G6.2: reuse canonical read-only feedback overlay; do not mutate readiness or Public Recipe Master.
  const analyzed=applyRecipeAttemptFeedback(analyzeIngredientGaps({recipes:catalogRows,recipeIngredients:ingredientRows,inventory}),recipeFeedback);
  // Unknown persisted unlock flags cannot be silently interpreted as either
  // unlocked or locked recommendations. Keep the public catalog visible while
  // withholding both partitions' badges until player state is verified.
  const playerUnlockAuthorityVerified=catalogRows.every(row=>validPlayerUnlock(row?.unlocked));
  const safeAnalyzed=analyzed.map(row=>validPlayerUnlock(row.unlocked)
    ?row:{...row,status:'unverified',can_attempt:false});
  const unlockedBase=safeAnalyzed.filter(row=>isUnlocked(row.unlocked));
  const lockedBase=safeAnalyzed.filter(row=>!isUnlocked(row.unlocked));
  const canRecommend=feedbackAuthorityVerified&&inventoryAuthorityVerified&&playerUnlockAuthorityVerified;
  const unlockedRecommended=canRecommend?recommendations(unlockedBase,week):new Set();
  const lockedRecommended=canRecommend?recommendations(lockedBase,week):new Set();
  const decorate=(data,set)=>sortRows(data).map(row=>({...row,weekly_recommended:set.has(String(row.recipe_id))}));
  const unlocked=decorate(unlockedBase,unlockedRecommended),locked=decorate(lockedBase,lockedRecommended);
  const basePot=numberOrNull(week?.pot_size);
  const deterministicEffects=week?.strategy_event_effects&&typeof week.strategy_event_effects==='object'?week.strategy_event_effects:{};
  const verifiedSundayMultiplier=Object.prototype.hasOwnProperty.call(deterministicEffects,'sunday_pot_multiplier')?numberOrNull(deterministicEffects.sunday_pot_multiplier):null;
  const boostedPot=basePot!==null&&verifiedSundayMultiplier!==null?basePot*verifiedSundayMultiplier:null;
  return Object.freeze({
    feedback_authority_status:feedbackAuthorityVerified?'VERIFIED_READ':(feedbackAuthorityStatus||'HOLD_FEEDBACK_READ_FAILED'),
    inventory_authority_status:inventoryAuthorityVerified?'VERIFIED_READ':'HOLD_INVENTORY_READ_FAILED',
    inventory_authority_verified:inventoryAuthorityVerified,
    player_unlock_authority_status:playerUnlockAuthorityVerified?'VERIFIED_READ':'HOLD_PLAYER_UNLOCK_UNVERIFIED',
    total_count:catalogRows.length,
    unlocked_count:unlocked.length,
    locked_count:locked.length,
    category_statistics:categoryStatistics(catalogRows),
    base_pot_capacity:basePot,
    verified_pot_multiplier:verifiedSundayMultiplier,
    verified_boosted_pot_capacity:boostedPot,
    pot_bonus_status:boostedPot===null?'NOT_ACTIVE_OR_NOT_VERIFIED':'ACTIVE_VERIFIED',
    duplicate_recipe_ids:Object.freeze(duplicateIds),
    partition_complete:duplicateIds.length===0&&unlocked.length+locked.length===catalogRows.length,
    category_partition_complete:CATEGORY_ORDER.reduce((sum,category)=>sum+(categoryStatistics(catalogRows)[category]?.total||0),0)===catalogRows.length,
    week_start:week?.week_start||null,
    dish_category:normalizeDishCategory(week?.dish_category)||null,
    authority_source:week?.authority_source||'MISSING',
    authority_update_id:week?.authority_update_id||null,
    unlocked:Object.freeze(unlocked),
    locked:Object.freeze(locked),
  });
}

function ensureShell(){
  document.getElementById('g51PersonalRecipeRoot')?.remove();
  const section=document.getElementById('recipes'),table=document.getElementById('recipeTable');
  if(!section||!table)return null;
  document.getElementById('sharedKnowledgeBlock')?.remove();
  let summary=document.getElementById('recipeWeeklyAuthoritySummary');
  if(!summary){summary=document.createElement('div');summary.id='recipeWeeklyAuthoritySummary';summary.className='recipe-workbench-summary';table.closest('.table-wrap')?.before(summary);}
  else summary.className='recipe-workbench-summary';
  let unlockedHeading=document.getElementById('recipeUnlockedWorkbenchHeading');
  if(!unlockedHeading){unlockedHeading=document.createElement('h3');unlockedHeading.id='recipeUnlockedWorkbenchHeading';unlockedHeading.textContent='已解鎖料理／玩家狀態';summary.after(unlockedHeading);}
  const unlockedWrap=table.closest('.table-wrap');
  unlockedWrap?.classList.add('recipe-workbench-wrap');
  let lockedHeading=document.getElementById('recipeLockedWorkbenchHeading');
  if(!lockedHeading){lockedHeading=document.createElement('h3');lockedHeading.id='recipeLockedWorkbenchHeading';lockedHeading.textContent='未解鎖料理';unlockedWrap?.after(lockedHeading);}
  let lockedNotice=document.getElementById('recipeLockedWorkbenchNotice');
  if(!lockedNotice){lockedNotice=document.createElement('p');lockedNotice.id='recipeLockedWorkbenchNotice';lockedNotice.className='notice';lockedNotice.textContent='缺少玩家紀錄不代表已解鎖；需要補登時可直接使用表格中的玩家狀態欄位。';lockedHeading.after(lockedNotice);}
  let lockedTable=document.getElementById('lockedRecipeTable');
  if(!lockedTable){const wrap=document.createElement('div');wrap.className='table-wrap recipe-workbench-wrap';lockedTable=document.createElement('table');lockedTable.id='lockedRecipeTable';wrap.appendChild(lockedTable);lockedNotice.after(wrap);}
  return {section,table,lockedTable,summary};
}

function catalogRows(){
  if(!dbReady())return PUBLIC_RECIPE_MASTER.map(recipe=>({...recipe,unlocked:0,recipe_level:null,current_energy:null,player_record_exists:0,data_version:PUBLIC_RECIPE_MASTER_VERSION}));
  return rows('SELECT * FROM recipe_catalog_state').map(row=>{
    const authority=authorityById.get(String(row.recipe_id));
    return {...row,ingredients:authority?.ingredients||[],data_version:authority?.data_version||row.data_version||PUBLIC_RECIPE_MASTER_VERSION};
  });
}

function weeklyContext(){
  if(!dbReady())return {};
  try{return currentWeeklyContext()||{};}catch{return {};}
}

function ingredientText(requirements){
  return (requirements||[]).map(item=>`${esc(item.ingredient_name)}×${Number(item.required||0)}`).join('、')||'—';
}

function shortageText(requirements){
  const missing=(requirements||[]).filter(item=>Number(item.shortage||0)>0);
  return missing.length?missing.map(item=>`${esc(item.ingredient_name)} 缺 ${Number(item.shortage||0)}`).join('、'):'無';
}

function draftValue(row,field,fallback){
  const draft=draftById.get(String(row.recipe_id));
  return draft&&Object.prototype.hasOwnProperty.call(draft,field)?draft[field]:fallback;
}

function playerControls(row,readonly){
  // An unverified player flag must not be auto-submitted as an unchecked
  // checkbox; require independent state repair before enabling this row.
  readonly=readonly||!validPlayerUnlock(row.unlocked);
  const id=esc(row.recipe_id),unlocked=Boolean(draftValue(row,'unlocked',isUnlocked(row.unlocked)));
  const level=draftValue(row,'recipe_level',row.recipe_level??'');
  const energy=draftValue(row,'current_energy',row.current_energy??'');
  return `<td><input class="canonical-recipe-unlocked" type="checkbox" ${unlocked?'checked':''} ${readonly?'disabled':''} data-id="${id}" aria-label="${esc(row.recipe_name)} 已解鎖"></td><td><input class="inline-number canonical-recipe-level" type="number" min="1" inputmode="numeric" value="${esc(level)}" ${readonly?'disabled':''} data-id="${id}" aria-label="${esc(row.recipe_name)} 料理等級"></td><td><input class="inline-number canonical-recipe-energy" type="number" min="0" inputmode="numeric" value="${esc(energy)}" ${readonly?'disabled':''} data-id="${id}" aria-label="${esc(row.recipe_name)} 目前能量"></td><td><button class="canonical-save-recipe" ${readonly?'disabled':''} data-id="${id}">${readonly?'唯讀':'儲存'}</button></td>`;
}

function rowsHtml(data,readonly,inventoryVerified=true){
  if(!data.length)return '<tr><td colspan="9">目前沒有資料</td></tr>';
  return data.map(row=>`<tr class="${row.weekly_recommended?'weekly-recommended':''}" data-recipe-id="${esc(row.recipe_id)}"><td>${!validPlayerUnlock(row.unlocked)?'玩家狀態待核對':row.weekly_recommended?(row.reference_maybe_wrong===true?'<b>推薦（來源待查證）</b>':'<b>推薦</b>'):row.recommendation_paused===true?'已暫停':row.reference_maybe_wrong===true?'來源待查證':'—'}</td><td>${esc(row.category||'')}</td><td><b>${esc(row.recipe_name||'')}</b></td><td class="recipe-formula-cell">${ingredientText(row.requirements)}</td><td class="recipe-shortage-cell">${inventoryVerified?shortageText(row.requirements):'庫存未驗證'}</td>${playerControls(row,readonly)}</tr>`).join('');
}

function renderTable(table,data,readonly,{inventoryVerified=true}={}){
  table.dataset.workbenchAuthority=RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION;
  table.innerHTML=`<thead><tr><th>本週</th><th>分類</th><th>料理</th><th>配方</th><th>缺料</th><th>已解鎖</th><th>料理等級</th><th>目前能量</th><th>操作</th></tr></thead><tbody>${rowsHtml(data,readonly,inventoryVerified)}</tbody>`;
}

function captureDraft(event){
  const target=event.target,id=target?.dataset?.id;if(!id)return;
  const draft={...(draftById.get(id)||{})};
  if(target.classList.contains('canonical-recipe-unlocked'))draft.unlocked=target.checked;
  if(target.classList.contains('canonical-recipe-level'))draft.recipe_level=target.value;
  if(target.classList.contains('canonical-recipe-energy'))draft.current_energy=target.value;
  draftById.set(id,draft);
}

async function saveRecipeState(row,{unlocked,level,energy}){
  if(!dbReady())throw new Error('目前為唯讀／尚未完成資料庫初始化，無法修改玩家料理狀態');
  const playerRecipeId=String(row.recipe_id),before=rows('SELECT * FROM recipes WHERE recipe_id=?',[playerRecipeId])[0]||null;
  const parsedLevel=level===''?null:Number(level),parsedEnergy=energy===''?null:Number(energy);
  if(parsedLevel!==null&&(!Number.isInteger(parsedLevel)||parsedLevel<1))throw new Error('料理等級必須為 1 以上整數');
  if(parsedEnergy!==null&&(!Number.isInteger(parsedEnergy)||parsedEnergy<0))throw new Error('目前能量必須為 0 以上整數');
  await snapshot(`manual:recipe:${playerRecipeId}`);begin();
  try{
    run(`INSERT INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(recipe_id) DO UPDATE SET unlocked=excluded.unlocked,recipe_level=excluded.recipe_level,current_energy=excluded.current_energy,updated_at=excluded.updated_at`,
      [playerRecipeId,row.category,row.recipe_name,unlocked?1:0,row.total_ingredients,'public_catalog_manual',parsedLevel,parsedEnergy,localIso(),'']);
    const after=rows('SELECT * FROM recipes WHERE recipe_id=?',[playerRecipeId])[0],updateId=`MANUAL-RECIPE-${Date.now()}-${Math.random().toString(16).slice(2,6)}`;
    run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[updateId,'manual-1.0',localIso(),localIso(),'manual_frontend_edit',1,JSON.stringify({status:'applied'})]);
    run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[updateId,0,'recipes','manual_update',JSON.stringify({recipe_id:playerRecipeId}),JSON.stringify(before),JSON.stringify(after),'applied','Unified Recipe Workbench 玩家料理狀態修改']);
    commit();await persist();return after;
  }catch(error){rollback();throw error;}
}

function bindTable(table,projection){
  table.oninput=captureDraft;table.onchange=captureDraft;
  table.querySelectorAll('.canonical-save-recipe').forEach(button=>button.addEventListener('click',async()=>{
    const id=button.dataset.id,row=[...projection.unlocked,...projection.locked].find(item=>String(item.recipe_id)===id),selector=CSS.escape(id);
    if(!row)return;
    const owner=button.closest('table'),unlocked=owner.querySelector(`.canonical-recipe-unlocked[data-id="${selector}"]`)?.checked||false,level=owner.querySelector(`.canonical-recipe-level[data-id="${selector}"]`)?.value??'',energy=owner.querySelector(`.canonical-recipe-energy[data-id="${selector}"]`)?.value??'';
    try{button.disabled=true;await saveRecipeState(row,{unlocked,level,energy});draftById.delete(id);renderRecipeUnifiedWorkbench();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'recipes',operation:'manual_upsert',recipe_id:id}}));}catch(error){button.disabled=false;alert(error.message);}
  }));
}

function statCard(label,strong,sub,extraClass=''){
  return `<article class="recipe-stat-card ${extraClass}"><span>${esc(label)}</span><strong>${esc(strong)}</strong><small>${esc(sub)}</small></article>`;
}
function renderSummary(target,projection){
  const week=projection.week_start||'—',category=projection.dish_category||'未設定',authority=projection.authority_source||'MISSING';
  const boosted=projection.verified_boosted_pot_capacity===null?'未啟用':energyCapacity(projection.verified_boosted_pot_capacity);
  const boostedSub=projection.verified_boosted_pot_capacity===null?'沒有 ACTIVE_VERIFIED 鍋子倍率':`基礎 ${energyCapacity(projection.base_pot_capacity)} × ${projection.verified_pot_multiplier}`;
  const categories=CATEGORY_ORDER.map(name=>{
    const row=projection.category_statistics[name]||{total:0,unlocked:0,locked:0};
    return statCard(name,`${row.unlocked} / ${row.total}`,`已解鎖 / 總數 · 未解鎖 ${row.locked}`,'category');
  }).join('');
  const feedbackNotice=projection.feedback_authority_status==='VERIFIED_READ'?'':` · Recipe Feedback <code>${esc(projection.feedback_authority_status)}</code>`;
  const inventoryNotice=projection.inventory_authority_status==='VERIFIED_READ'?'':` · Inventory <code>${esc(projection.inventory_authority_status)}</code>`;
  const unlockNotice=projection.player_unlock_authority_status==='VERIFIED_READ'?'':` · Player Unlock <code>${esc(projection.player_unlock_authority_status)}</code>`;
  target.innerHTML=`<div class="recipe-summary-grid">
    ${statCard('基礎鍋子',energyCapacity(projection.base_pot_capacity),'帳號層級可用容量','pot')}
    ${statCard('已驗證加成鍋子',boosted,boostedSub,'pot')}
    ${statCard('全部料理',`${projection.unlocked_count} / ${projection.total_count}`,`已解鎖 / 總數 · 未解鎖 ${projection.locked_count}`,'total')}
    ${categories}
  </div><div class="recipe-summary-meta"><b>本週 ${esc(category)}</b> · ${esc(week)} · Weekly Context <code>${esc(authority)}</code>${projection.authority_update_id?` · <code>${esc(projection.authority_update_id)}</code>`:''}<br>Public Recipe Master <code>${esc(PUBLIC_RECIPE_MASTER_VERSION)}</code>${feedbackNotice}${inventoryNotice}${unlockNotice}</div>`;
}
function energyCapacity(value){return value===null||value===undefined||!Number.isFinite(Number(value))?'未設定':Number(value).toLocaleString('zh-TW',{maximumFractionDigits:2});}

export function renderRecipeUnifiedWorkbench(){
  const shell=ensureShell();if(!shell)return null;
  const readonly=!dbReady();
  const feedback=readRecipeFeedbackForProjection({readonly});
  const inventory=readRecipeInventoryForProjection({readonly});
  const projection=buildRecipeUnifiedWorkbenchProjection({
    catalogRows:catalogRows(),inventory:inventory.rows,week:weeklyContext(),
    recipeFeedback:feedback.rows,feedbackAuthorityVerified:feedback.verified,
    feedbackAuthorityStatus:feedback.status,inventoryAuthorityVerified:inventory.verified,
  });
  if(!projection.partition_complete)throw new Error(`recipe_workbench_partition_invalid:${projection.duplicate_recipe_ids.join(',')}`);
  renderSummary(shell.summary,projection);
  renderTable(shell.table,projection.unlocked,readonly,{inventoryVerified:inventory.verified});
  renderTable(shell.lockedTable,projection.locked,readonly,{inventoryVerified:inventory.verified});
  bindTable(shell.table,projection);bindTable(shell.lockedTable,projection);
  shell.section.dataset.recipeFeedbackAuthority=feedback.status;
  shell.section.dataset.recipeInventoryAuthority=inventory.status;
  shell.section.dataset.recipePlayerUnlockAuthority=projection.player_unlock_authority_status;
  shell.section.dataset.recipeWorkbenchAuthority=RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION;
  shell.section.dataset.recipePartition=`${projection.unlocked_count}+${projection.locked_count}=${projection.total_count}`;
  return projection;
}
