import {rows,run,persist,snapshot,begin,commit,rollback,isRescueReadonly} from './database.js';
import {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION} from './public-recipe-canonical-authority.js';
import {analyzeIngredientGaps,sortGapResults} from './ingredient-gap-engine.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {normalizeDishCategory} from './weekly-context-normalization.js';
import {localIso} from './time-utils.js';

export const RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION='recipe-unified-player-workbench-2026-08-12-b-summary-cards';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const draftById=new Map();
const authorityById=new Map(PUBLIC_RECIPE_MASTER.map(recipe=>[String(recipe.recipe_id),recipe]));
const ingredientRows=PUBLIC_RECIPE_MASTER.flatMap(recipe=>(recipe.ingredients||[]).map(item=>({recipe_id:recipe.recipe_id,ingredient_name:item.ingredient_name,quantity:Number(item.quantity||0)})));
const CATEGORY_ORDER=Object.freeze(['咖哩／濃湯','沙拉','甜點／飲料']);
const numberOrNull=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;};

function dbReady(){
  try{return !isRescueReadonly()&&Number(rows('SELECT COUNT(*) AS count FROM schema_migrations')[0]?.count||0)>0;}catch{return false;}
}

function sortRows(data){
  return [...data].sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''),'zh-Hant')||String(a.recipe_name||'').localeCompare(String(b.recipe_name||''),'zh-Hant'));
}

function recommendations(data,week){
  const category=normalizeDishCategory(week?.dish_category);
  if(!category)return new Set();
  const pool=data.filter(row=>normalizeDishCategory(row.category)===category);
  return new Set(sortGapResults(pool,'shortage').slice(0,3).map(row=>String(row.recipe_id)));
}

function categoryStatistics(catalogRows){
  const stats={};
  for(const category of CATEGORY_ORDER){
    const rowsForCategory=catalogRows.filter(row=>normalizeDishCategory(row.category)===category);
    const unlocked=rowsForCategory.filter(row=>Number(row.unlocked||0)===1).length;
    stats[category]=Object.freeze({category,total:rowsForCategory.length,unlocked,locked:rowsForCategory.length-unlocked});
  }
  return Object.freeze(stats);
}

export function buildRecipeUnifiedWorkbenchProjection({catalogRows=[],inventory=[],week={}}={}){
  const ids=catalogRows.map(row=>String(row.recipe_id));
  const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
  const analyzed=analyzeIngredientGaps({recipes:catalogRows,recipeIngredients:ingredientRows,inventory});
  const unlockedBase=analyzed.filter(row=>Number(row.unlocked||0)===1);
  const lockedBase=analyzed.filter(row=>Number(row.unlocked||0)!==1);
  const unlockedRecommended=recommendations(unlockedBase,week),lockedRecommended=recommendations(lockedBase,week);
  const decorate=(data,set)=>sortRows(data).map(row=>({...row,weekly_recommended:set.has(String(row.recipe_id))}));
  const unlocked=decorate(unlockedBase,unlockedRecommended),locked=decorate(lockedBase,lockedRecommended);
  const basePot=numberOrNull(week?.pot_size);
  const deterministicEffects=week?.strategy_event_effects&&typeof week.strategy_event_effects==='object'?week.strategy_event_effects:{};
  const verifiedSundayMultiplier=Object.prototype.hasOwnProperty.call(deterministicEffects,'sunday_pot_multiplier')?numberOrNull(deterministicEffects.sunday_pot_multiplier):null;
  const boostedPot=basePot!==null&&verifiedSundayMultiplier!==null?basePot*verifiedSundayMultiplier:null;
  return Object.freeze({
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

function inventoryRows(){
  if(!dbReady())return [];
  try{return rows('SELECT ingredient_name,quantity FROM ingredient_inventory');}catch{return [];}
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
  const id=esc(row.recipe_id),unlocked=Boolean(draftValue(row,'unlocked',Number(row.unlocked||0)===1));
  const level=draftValue(row,'recipe_level',row.recipe_level??'');
  const energy=draftValue(row,'current_energy',row.current_energy??'');
  return `<td><input class="canonical-recipe-unlocked" type="checkbox" ${unlocked?'checked':''} ${readonly?'disabled':''} data-id="${id}" aria-label="${esc(row.recipe_name)} 已解鎖"></td><td><input class="inline-number canonical-recipe-level" type="number" min="1" inputmode="numeric" value="${esc(level)}" ${readonly?'disabled':''} data-id="${id}" aria-label="${esc(row.recipe_name)} 料理等級"></td><td><input class="inline-number canonical-recipe-energy" type="number" min="0" inputmode="numeric" value="${esc(energy)}" ${readonly?'disabled':''} data-id="${id}" aria-label="${esc(row.recipe_name)} 目前能量"></td><td><button class="canonical-save-recipe" ${readonly?'disabled':''} data-id="${id}">${readonly?'唯讀':'儲存'}</button></td>`;
}

function rowsHtml(data,readonly){
  if(!data.length)return '<tr><td colspan="9">目前沒有資料</td></tr>';
  return data.map(row=>`<tr class="${row.weekly_recommended?'weekly-recommended':''}" data-recipe-id="${esc(row.recipe_id)}"><td>${row.weekly_recommended?'<b>推薦</b>':'—'}</td><td>${esc(row.category||'')}</td><td><b>${esc(row.recipe_name||'')}</b></td><td class="recipe-formula-cell">${ingredientText(row.requirements)}</td><td class="recipe-shortage-cell">${shortageText(row.requirements)}</td>${playerControls(row,readonly)}</tr>`).join('');
}

function renderTable(table,data,readonly){
  table.dataset.workbenchAuthority=RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION;
  table.innerHTML=`<thead><tr><th>本週</th><th>分類</th><th>料理</th><th>配方</th><th>缺料</th><th>已解鎖</th><th>料理等級</th><th>目前能量</th><th>操作</th></tr></thead><tbody>${rowsHtml(data,readonly)}</tbody>`;
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
  target.innerHTML=`<div class="recipe-summary-grid">
    ${statCard('基礎鍋子',energyCapacity(projection.base_pot_capacity),'帳號層級可用容量','pot')}
    ${statCard('已驗證加成鍋子',boosted,boostedSub,'pot')}
    ${statCard('全部料理',`${projection.unlocked_count} / ${projection.total_count}`,`已解鎖 / 總數 · 未解鎖 ${projection.locked_count}`,'total')}
    ${categories}
  </div><div class="recipe-summary-meta"><b>本週 ${esc(category)}</b> · ${esc(week)} · Weekly Context <code>${esc(authority)}</code>${projection.authority_update_id?` · <code>${esc(projection.authority_update_id)}</code>`:''}<br>Public Recipe Master <code>${esc(PUBLIC_RECIPE_MASTER_VERSION)}</code></div>`;
}
function energyCapacity(value){return value===null||value===undefined||!Number.isFinite(Number(value))?'未設定':Number(value).toLocaleString('zh-TW',{maximumFractionDigits:2});}

export function renderRecipeUnifiedWorkbench(){
  const shell=ensureShell();if(!shell)return null;
  const readonly=!dbReady(),projection=buildRecipeUnifiedWorkbenchProjection({catalogRows:catalogRows(),inventory:inventoryRows(),week:weeklyContext()});
  if(!projection.partition_complete)throw new Error(`recipe_workbench_partition_invalid:${projection.duplicate_recipe_ids.join(',')}`);
  renderSummary(shell.summary,projection);renderTable(shell.table,projection.unlocked,readonly);renderTable(shell.lockedTable,projection.locked,readonly);bindTable(shell.table,projection);bindTable(shell.lockedTable,projection);
  shell.section.dataset.recipeWorkbenchAuthority=RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION;
  shell.section.dataset.recipePartition=`${projection.unlocked_count}+${projection.locked_count}=${projection.total_count}`;
  return projection;
}
