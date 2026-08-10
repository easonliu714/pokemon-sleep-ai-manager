import {buildLocalRecipeDiscoveryStockpile} from './recipe-discovery-stockpile-local.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=value=>value===null||value===undefined?'—':String(value);

function formulaText(recipe){return (recipe.planning_formula||[]).map(row=>`${row.ingredient_name}×${row.quantity}`).join('、')||'—';}
function potStatus(recipe){
  if(recipe.sunday_pot_fit===null)return '未提供週日鍋子倍率';
  return recipe.sunday_pot_fit?`可嘗試（${recipe.total_ingredients}/${recipe.sunday_pot_capacity}，餘裕 ${recipe.sunday_pot_buffer}）`:`容量不足（${recipe.total_ingredients}/${recipe.sunday_pot_capacity}）`;
}
function stockpileRows(result){
  return (result.stockpile||[]).map(row=>`<tr><td>${esc(row.ingredient_name)}</td><td>${row.target}</td><td>${row.current}</td><td><b>${row.deficit}</b></td><td>${row.covered?'已達標':'待蒐集'}</td></tr>`).join('');
}
function teamMember(slot){
  const overlap=(slot.weekly_ingredient_overlap||[]).join('、')||'—';
  return `<li><b>${esc(slot.species||'—')}</b> Lv${esc(slot.level??'—')} · ${esc(slot.specialty||'—')}<br><span class="notice">探索缺口覆蓋：${esc(overlap)}；解鎖成熟度：${esc(slot.current_readiness_score??'—')}</span></li>`;
}
function teamBlock(team){
  if(!team)return '<p class="notice">尚無隊伍資料。</p>';
  const primary=team.primary;
  if(!primary)return '<p class="notice">尚無可建立的 5 人隊伍。</p>';
  const status=primary.team_status==='READY'?'可用隊伍':primary.team_status==='BLOCKED'?'Hard Constraint 阻擋':'隊伍未完成';
  return `<div class="war-discovery-team"><p><b>${esc(status)}</b>　<code>${esc(primary.team_id||'—')}</code></p><ol>${(primary.slots||[]).map(teamMember).join('')}</ol>${primary.missing_constraints?.length?`<p class="notice warning">未滿足：${esc(primary.missing_constraints.join('、'))}</p>`:''}</div>`;
}

export function renderWarRoomRecipeDiscovery(root=document.getElementById('warroomRecipeDiscovery')){
  if(!root)return;
  try{
    const result=buildLocalRecipeDiscoveryStockpile({maxAlternatives:2});
    if(result.projection_status!=='READY'){
      root.innerHTML='<div class="panel"><h3>新料理探索／食材備貨</h3><p class="notice">玩家資料尚未載入，無法建立本週探索計畫。</p></div>';return;
    }
    const week=result.weekly_context||{};
    root.innerHTML=`<div class="panel war-recipe-discovery-panel">
      <div class="war-team-toolbar"><div><h3>新料理探索／食材備貨</h3><p class="notice">此區讀取本機 Weekly Context JSON、食材庫存與寶可夢資料。新料理仍是 Discovery 公版，不會寫入 ACTIVE 料理或玩家解鎖狀態。</p></div><button type="button" data-war-discovery-refresh>重新計算</button></div>
      <p class="notice"><b>玩家本週環境：</b>${esc(week.week_start||'未設定')} · ${esc(week.camp||'未設定營地')} · ${esc(week.dish_category||'未設定料理')} · ${esc(week.event_name||'無活動')}</p>
      <div class="war-team-summary"><span>料理最終能量倍率 <b>${number(week.recipe_final_energy_multiplier)}</b></span><span>鍋子 <b>${number(week.pot_size)}</b></span><span>週日鍋子倍率 <b>${number(week.sunday_pot_multiplier)}</b></span><span>精準產率模型 <b>尚未啟用</b></span></div>
      <h4>Discovery 候選</h4>
      ${(result.discovery_candidates||[]).map(recipe=>`<article class="war-team-card"><div class="war-team-card-head"><div><span class="war-team-status ready">公式規劃候選</span><h4>${esc(recipe.display_name)}</h4></div><code>${esc(recipe.discovery_id)}</code></div><p>正式繁中名稱：<b>待遊戲內解鎖確認</b></p><p>規劃公式：${esc(formulaText(recipe))}</p><p>需求總量：<b>${recipe.total_ingredients}</b>；週日：<b>${esc(potStatus(recipe))}</b></p><p class="notice">Canonical ACTIVE = false；僅使用 reference formula + game quantity signature 做探索。</p></article>`).join('')}
      <h4>兩道料理合併備貨目標</h4>
      <p class="notice">目標總量 <b>${result.summary.total_target}</b>；目前已覆蓋 <b>${result.summary.total_current_capped}</b>；尚缺 <b>${result.summary.total_deficit}</b>。</p>
      <div class="table-wrap"><table><thead><tr><th>食材</th><th>目標</th><th>目前</th><th>缺口</th><th>狀態</th></tr></thead><tbody>${stockpileRows(result)}</tbody></table></div>
      <h4>備貨優先 5 人隊伍</h4>${teamBlock(result.team)}
      <p class="notice">production_rate_model = <code>${esc(result.production_rate_model)}</code>；不輸出未驗證的 ingredient/hour 或七日能量。料理 ×1.5 僅作本週活動條件呈現，尚不偽造精準能量模型。</p>
      <p class="notice">Projection Fingerprint：<code>${esc(result.input_fingerprint||'—')}</code></p>
    </div>`;
    root.querySelector('[data-war-discovery-refresh]')?.addEventListener('click',()=>renderWarRoomRecipeDiscovery(root));
  }catch(error){root.innerHTML=`<div class="panel"><h3>新料理探索／食材備貨</h3><p class="notice">Planner 尚未就緒：${esc(error?.message||String(error))}</p></div>`;}
}
