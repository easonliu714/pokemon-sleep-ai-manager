import {buildLocalRecipePortfolioContention} from './recipe-portfolio-contention-local.js';
import {RECIPE_PORTFOLIO_OBJECTIVES} from './recipe-portfolio-contention.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const OBJECTIVE_LABEL=Object.freeze({unlock_recipes:'優先解鎖新料理',preserve_resources:'保留食材餘裕',continuous_meals:'連續多餐',maximize_verified_energy:'最高已驗證料理能量'});
const WARNING_LABEL=Object.freeze({TARGET_MEALS_NOT_REACHED:'未達目標餐數',SHARED_INVENTORY_CONTENTION:'存在共享食材競爭',USABLE_INVENTORY_EXHAUSTED:'部分可用庫存耗盡',LOW_BUFFER_AFTER_PLAN:'部分食材剩餘不足再做一餐',ENERGY_BASE_FALLBACK_USED:'部分餐次缺少玩家目前能量，使用公版基礎能量 fallback',ENERGY_INPUT_MISSING:'部分餐次缺少可用能量資料'});
const ENERGY_SOURCE_LABEL=Object.freeze({PLAYER_CURRENT_ENERGY:'玩家目前能量',PUBLIC_BASE_ENERGY:'公版基礎能量 fallback',MISSING:'缺少能量資料'});
const state={objective:'unlock_recipes',maxMeals:3};
const energyText=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('zh-TW',{maximumFractionDigits:2});

function resourceTransition(row){
  const buffer=row.buffer_state==='EXHAUSTED_USABLE'?' · 可用量耗盡':row.buffer_state==='LOW_BUFFER'?' · 低餘裕':'';
  return `<li><b>${esc(row.ingredient_name)}</b> ${row.before} → -${row.consumed} → ${row.remaining}<span class="notice">（保留 ${row.safe_reserve}${esc(buffer)}）</span></li>`;
}
function stepCard(step){
  const energySource=ENERGY_SOURCE_LABEL[step.energy_source]||step.energy_source||'—';
  const energyLine=`<p class="notice"><b>能量：</b>${esc(energySource)} ${energyText(step.pre_event_energy)} × 已驗證活動倍率 ${energyText(step.verified_event_multiplier)} = <b>${energyText(step.projected_verified_energy)}</b>${step.recipe_level?` · 料理 Lv ${esc(step.recipe_level)}`:''}</p>`;
  return `<li class="g7-cooking-step"><div><span class="war-team-slot">第 ${step.step} 餐</span> <b>${esc(step.recipe_name)}</b>${step.unlock_opportunity?' <span class="g7-unlock-badge">可解鎖</span>':''}</div>
    ${energyLine}
    <ul class="g7-resource-transitions">${(step.ingredients||[]).map(resourceTransition).join('')}</ul>
    ${step.newly_blocked_recipes?.length?`<p class="notice warning">這餐之後暫時無法再做：${esc(step.newly_blocked_recipes.map(row=>row.recipe_name).join('、'))}</p>`:''}
  </li>`;
}
function warningList(plan){return (plan.warnings||[]).map(code=>`<li>${esc(WARNING_LABEL[code]||code)}</li>`).join('');}
function planCard(plan,index){
  return `<article class="war-team-card g7-cooking-plan ${index?'alternative':''}">
    <div class="war-team-card-head"><div><span class="war-team-status ${plan.target_reached?'ready':'incomplete'}">方案 ${index+1}</span><h4>${esc(OBJECTIVE_LABEL[plan.objective]||plan.objective)}</h4></div><code>${esc(plan.plan_id)}</code></div>
    <div class="war-team-summary"><span>模擬餐數<b>${plan.completed_meals}/${plan.target_meals}</b></span><span>已驗證投影能量<b>${energyText(plan.projected_verified_energy_sum)}</b></span><span>玩家能量餐次<b>${plan.player_current_energy_meals??0}</b></span><span>基礎能量 fallback<b>${plan.base_energy_fallback_meals??0}</b></span><span>新料理機會<b>${plan.unlock_count}</b></span><span>下一餐仍可選<b>${plan.next_executable_count}</b></span><span>保留後可用總量<b>${plan.remaining_usable_total}</b></span></div>
    <ol class="g7-cooking-sequence">${(plan.steps||[]).map(stepCard).join('')}</ol>
    ${plan.exhausted_ingredients?.length?`<p class="notice warning"><b>可用量耗盡：</b>${esc(plan.exhausted_ingredients.join('、'))}</p>`:''}
    ${plan.low_buffer_ingredients?.length?`<p class="notice warning"><b>低餘裕：</b>${esc(plan.low_buffer_ingredients.join('、'))}</p>`:''}
    ${plan.warnings?.length?`<details class="war-team-warnings"><summary>方案注意事項</summary><ul>${warningList(plan)}</ul></details>`:''}
  </article>`;
}
function contentionRows(contention){
  const rows=(contention?.ingredients||[]).filter(row=>row.demander_count>1||Number(row.aggregate_over_subscription||0)>0).slice(0,8);
  if(!rows.length)return '<p class="notice">目前可立即執行的料理之間沒有偵測到共享食材競爭。</p>';
  return `<div class="g7-contention-list">${rows.map(row=>`<div class="g7-contention-row ${Number(row.aggregate_over_subscription||0)>0?'oversubscribed':''}"><div><b>${esc(row.ingredient_name)}</b><span>${row.demander_count} 道 READY 料理共用</span></div><div><span>可用 ${row.usable??'未觀測'}</span><span>合計單餐需求 ${row.aggregate_demand}</span>${row.aggregate_over_subscription?`<b>超額 ${row.aggregate_over_subscription}</b>`:''}</div></div>`).join('')}</div>`;
}
function emptyReason(result){
  if(result.projection_status==='PLAYER_DATA_UNAVAILABLE')return '玩家 SQLite 尚未就緒，無法建立料理模擬。';
  if(result.projection_status==='INVENTORY_NOT_OBSERVED')return '目前沒有可供 G7 使用的食材庫存列。空集合不會被當成「已確認全部為 0」，請先由食材頁或更新中心建立玩家觀測。';
  if(result.summary?.individually_ready_count===0)return '目前沒有通過食材、Safe Reserve、鍋子容量與 Recipe Evidence Gate 的 READY 料理。';
  if(result.summary?.simulation_candidate_count===0)return 'READY 料理的必要食材存在未觀測庫存列；為避免把 missing 誤當成 0，本 Planner 不執行共享庫存模擬。';
  return '目前共享庫存無法形成可執行序列；可檢查 Safe Reserve、鍋子容量或食材庫存。';
}

export function renderWarRoomCookingPlanner(root=document.getElementById('warroomCookingPlanner')){
  if(!root)return;
  try{
    const result=buildLocalRecipePortfolioContention({objective:state.objective,maxMeals:state.maxMeals,maxAlternatives:3,beamWidth:64});
    const week=result.weekly_context||{},energyContext=result.context?.energy_context||{};
    root.innerHTML=`<div class="panel war-team-optimizer-panel g7-cooking-panel">
      <div class="war-team-toolbar"><div><h3>G7 料理資源競爭／多餐模擬</h3><p class="notice">同一道料理的 READY 判定仍由既有 Recipe Strategy 負責；本區只模擬 READY 料理在共享實體庫存下的可執行序列。所有結果都是 deterministic 模擬，不修改食材庫存或料理狀態。</p></div><button type="button" data-g7-refresh>重新計算</button></div>
      <div class="g7-cooking-controls">
        <label><span>目標</span><select data-g7-objective>${RECIPE_PORTFOLIO_OBJECTIVES.map(value=>`<option value="${value}" ${value===state.objective?'selected':''}>${esc(OBJECTIVE_LABEL[value])}</option>`).join('')}</select></label>
        <label><span>模擬餐數</span><select data-g7-meals>${[1,2,3,4,5,6,7].map(value=>`<option value="${value}" ${value===state.maxMeals?'selected':''}>${value} 餐</option>`).join('')}</select></label>
      </div>
      <p class="notice"><b>本週：</b>${esc(week.week_start||'未設定')} · ${esc(week.dish_category||'未設定料理類型')} · 鍋子 ${esc(week.pot_size??'未設定')} · Authority ${esc(week.authority_source||'MISSING')}</p>
      <p class="notice"><b>料理能量 Authority：</b>玩家已觀測 <code>current_energy</code> 優先；缺值才使用 Public Recipe Master <code>base_energy</code> fallback。只套用 ACTIVE_VERIFIED <code>recipe_final_energy_multiplier=${esc(energyText(energyContext.recipe_final_energy_multiplier??week.recipe_final_energy_multiplier??1))}</code>；漂亮成功倍率仍為 FEATURE_ONLY，不參與此排序。</p>
      <p class="notice"><b>序列數量語意：</b><code>before → consumed → remaining</code>；每一步都重新套用 Safe Reserve，再判斷下一餐仍可執行的料理。</p>
      <div class="war-team-summary"><span>單獨 READY<b>${result.summary?.individually_ready_count??0}</b></span><span>可安全模擬<b>${result.summary?.simulation_candidate_count??0}</b></span><span>玩家能量候選<b>${result.summary?.player_current_energy_candidate_count??0}</b></span><span>基礎能量 fallback<b>${result.summary?.base_energy_fallback_candidate_count??0}</b></span><span>競爭邊<b>${result.summary?.contention_edge_count??0}</b></span><span>全部可同時執行<b>${result.summary?.all_individually_ready_simultaneously_executable===true?'是':result.summary?.all_individually_ready_simultaneously_executable===false?'否':'—'}</b></span></div>
      ${result.missing_inventory_observations?.length?`<div class="notice warning"><b>未觀測必要食材：</b>${esc(result.missing_inventory_observations.map(row=>`${row.recipe_id}: ${row.ingredients.join('、')}`).join('；'))}<br>missing 不會在 G7 中自動轉成已確認 0。</div>`:''}
      <details class="g7-contention-details" open><summary>共享食材競爭</summary>${contentionRows(result.contention)}</details>
      <h4>Top 3 可執行序列</h4>
      ${result.alternatives?.length?result.alternatives.map(planCard).join(''):`<div class="notice warning">${esc(emptyReason(result))}</div>`}
      <p class="notice">Inventory semantics：<code>${esc(result.context?.inventory_semantics||'—')}</code>；Safe Reserve 每一步都會重新套用。Planner Fingerprint：<code>${esc(result.input_fingerprint||'—')}</code></p>
    </div>`;
    root.querySelector('[data-g7-refresh]')?.addEventListener('click',()=>renderWarRoomCookingPlanner(root));
    root.querySelector('[data-g7-objective]')?.addEventListener('change',event=>{state.objective=event.target.value;renderWarRoomCookingPlanner(root);});
    root.querySelector('[data-g7-meals]')?.addEventListener('change',event=>{state.maxMeals=Math.max(1,Math.min(7,Number(event.target.value)||3));renderWarRoomCookingPlanner(root);});
  }catch(error){root.innerHTML=`<div class="panel"><h3>G7 料理資源競爭／多餐模擬</h3><p class="notice warning">Planner 尚未就緒：${esc(error?.message||String(error))}</p></div>`;}
}
