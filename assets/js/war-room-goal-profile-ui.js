import {getActiveStrategyGoalProfile,saveStrategyGoalProfile} from './strategy-goal-store.js';
import {defaultHardConstraints,STRATEGY_GOALS} from './strategy-goal-contract.js';
import {refreshFactEvaluationSnapshots,listCurrentPokemonEvaluationSnapshots} from './pokemon-evaluation-store.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const GOAL_LABELS=Object.freeze({
  max_snorlax_energy:'卡比獸能量最大化',unlock_recipes:'開啟未解鎖料理',ingredient_stockpile:'補足食材庫存',dream_shard_farming:'夢之碎片收益',
  research_unlock:'研究／新寶可夢解鎖',evolution_progress:'進化條件推進',training_roi:'培養投資報酬',event_objective:'本週活動目標',balanced:'均衡',
});
const parseList=value=>String(value||'').split(/[,，\n]/).map(item=>item.trim()).filter(Boolean);
function parseReserve(value){
  const output={};
  for(const line of String(value||'').split(/\n/)){
    const match=line.trim().match(/^(.+?)[=:：]\s*(\d+(?:\.\d+)?)$/);if(match)output[match[1].trim()]=Number(match[2]);
  }
  return output;
}
function reserveText(map){return Object.entries(map||{}).map(([name,value])=>`${name}=${value}`).join('\n');}
function checked(value){return value?'checked':'';}

function render(root){
  const saved=getActiveStrategyGoalProfile();
  const constraints={...defaultHardConstraints(),...(saved?.hard_constraints||{})};
  const primary=saved?.primary_goal||'balanced';
  const secondary=new Set(saved?.secondary_goals||[]);
  const snapshots=listCurrentPokemonEvaluationSnapshots();
  const factOnly=snapshots.filter(row=>row.evaluation_status==='FACT_SNAPSHOT_ONLY').length;
  root.innerHTML=`
    <div class="panel">
      <h3>戰情室目標與 Hard Constraints</h3>
      <p class="notice">目標與限制只儲存在本機。Hard Constraint 先於後續 soft score 判定；FAIL 候選不可因分數較高重新進入排名。</p>
      <form id="warRoomGoalProfileForm" class="edit-grid">
        <label class="edit-field"><span>策略名稱</span><input name="profile_name" value="${esc(saved?.profile_name||'目前策略')}"></label>
        <label class="edit-field"><span>主要目標</span><select name="primary_goal">${STRATEGY_GOALS.map(goal=>`<option value="${goal}"${goal===primary?' selected':''}>${esc(GOAL_LABELS[goal])}</option>`).join('')}</select></label>
        <fieldset class="edit-field full"><legend>次要目標</legend>${STRATEGY_GOALS.filter(goal=>goal!==primary).map(goal=>`<label><input type="checkbox" name="secondary_goal" value="${goal}" ${checked(secondary.has(goal))}> ${esc(GOAL_LABELS[goal])}</label>`).join(' ')}</fieldset>
        <fieldset class="edit-field full"><legend>資料／料理限制</legend>
          <label><input type="checkbox" name="require_verified_master" ${checked(constraints.require_verified_master)}> 只接受已核對公版 Master</label>
          <label><input type="checkbox" name="current_unlocks_only" ${checked(constraints.current_unlocks_only)}> 只使用目前已解鎖能力</label>
          <label><input type="checkbox" name="pot_capacity_limit" ${checked(constraints.pot_capacity_limit)}> 鍋子容量視為 Hard Constraint</label>
          <label><input type="checkbox" name="item_safe_reserve" ${checked(constraints.item_safe_reserve)}> 遵守道具安全庫存</label>
          <label><input type="checkbox" name="require_complete_profile_fields" ${checked(constraints.require_complete_profile_fields)}> 個體資料不完整時標 REVIEW</label>
        </fieldset>
        <label class="edit-field"><span>料理解鎖政策</span><select name="recipe_unlock_policy"><option value="allow_unlock_target"${constraints.recipe_unlock_policy==='allow_unlock_target'?' selected':''}>允許以未解鎖料理為目標</option><option value="only_unlocked"${constraints.recipe_unlock_policy==='only_unlocked'?' selected':''}>只使用已解鎖料理</option></select></label>
        <label class="edit-field"><span>同物種最多</span><input name="max_same_species" type="number" min="1" max="5" value="${esc(constraints.max_same_species??'')}"></label>
        <label class="edit-field"><span><input type="checkbox" name="no_untrained_candidates" ${checked(constraints.no_untrained_candidates)}> 排除未培養候選</span><input name="minimum_candidate_level" type="number" min="1" placeholder="最低等級" value="${esc(constraints.minimum_candidate_level??'')}"></label>
        <label class="edit-field full"><span>一定要包含的寶可夢（逗號或換行）</span><textarea name="must_include_pokemon">${esc((constraints.must_include_pokemon||[]).join('\n'))}</textarea></label>
        <label class="edit-field full"><span>排除的寶可夢（逗號或換行）</span><textarea name="exclude_pokemon">${esc((constraints.exclude_pokemon||[]).join('\n'))}</textarea></label>
        <label class="edit-field full"><span>必須角色／職能</span><textarea name="must_include_role">${esc((constraints.must_include_role||[]).join('\n'))}</textarea></label>
        <label class="edit-field full"><span>夜間共眠／進化目標成員</span><textarea name="sleep_evolution_member_at_night">${esc((constraints.sleep_evolution_member_at_night||[]).join('\n'))}</textarea></label>
        <label class="edit-field"><span>保留現隊伍槽位（1~5）</span><input name="preserve_current_team_slots" value="${esc((constraints.preserve_current_team_slots||[]).join(','))}"></label>
        <label class="edit-field full"><span>食材安全庫存（每行 食材=數量）</span><textarea name="ingredient_safe_reserve" placeholder="特選蘋果=20">${esc(reserveText(constraints.ingredient_safe_reserve))}</textarea></label>
        <label class="edit-field"><span>培養糖果預算</span><input name="budget_candy" type="number" min="0" value="${esc(constraints.training_budget?.candy??'')}"></label>
        <label class="edit-field"><span>夢之碎片預算</span><input name="budget_dream_shard" type="number" min="0" value="${esc(constraints.training_budget?.dream_shard??'')}"></label>
        <label class="edit-field"><span>種子預算</span><input name="budget_seed" type="number" min="0" value="${esc(constraints.training_budget?.seed??'')}"></label>
        <label class="edit-field"><span>進化道具預算</span><input name="budget_evolution_item" type="number" min="0" value="${esc(constraints.training_budget?.evolution_item??'')}"></label>
        <div class="full"><button type="submit">儲存目標與限制</button> <button type="button" id="warRoomRefreshEvaluationSnapshots">建立／更新評估快照</button></div>
      </form>
      <p id="warRoomGoalStatus" class="notice">${saved?`Active Profile：${esc(saved.goal_profile_id)} / ${esc(saved.profile_version)}`:'尚未儲存 Goal Profile；目前使用 UI 預設值，不會自動建立玩家資料。'}<br>目前有效 Evaluation Snapshot：${snapshots.length}；FACT-only：${factOnly}</p>
    </div>`;
  const form=root.querySelector('#warRoomGoalProfileForm'),status=root.querySelector('#warRoomGoalStatus');
  form.onsubmit=async event=>{
    event.preventDefault();const data=new FormData(form),secondaryGoals=data.getAll('secondary_goal');
    const profile={profile_name:data.get('profile_name'),primary_goal:data.get('primary_goal'),secondary_goals:secondaryGoals,hard_constraints:{
      require_verified_master:data.has('require_verified_master'),current_unlocks_only:data.has('current_unlocks_only'),pot_capacity_limit:data.has('pot_capacity_limit'),item_safe_reserve:data.has('item_safe_reserve'),require_complete_profile_fields:data.has('require_complete_profile_fields'),
      recipe_unlock_policy:data.get('recipe_unlock_policy'),max_same_species:data.get('max_same_species'),no_untrained_candidates:data.has('no_untrained_candidates'),minimum_candidate_level:data.get('minimum_candidate_level'),
      must_include_pokemon:parseList(data.get('must_include_pokemon')),exclude_pokemon:parseList(data.get('exclude_pokemon')),must_include_role:parseList(data.get('must_include_role')),sleep_evolution_member_at_night:parseList(data.get('sleep_evolution_member_at_night')),
      preserve_current_team_slots:parseList(data.get('preserve_current_team_slots')),ingredient_safe_reserve:parseReserve(data.get('ingredient_safe_reserve')),
      training_budget:{candy:data.get('budget_candy'),dream_shard:data.get('budget_dream_shard'),seed:data.get('budget_seed'),evolution_item:data.get('budget_evolution_item')},
    }};
    try{status.textContent='正在儲存策略目標…';await saveStrategyGoalProfile(profile,{goalProfileId:saved?.goal_profile_id||null,activate:true});render(root);}catch(error){status.textContent=error?.message||String(error);}
  };
  root.querySelector('#warRoomRefreshEvaluationSnapshots').onclick=async()=>{
    try{status.textContent='正在建立／重用本機 Evaluation Snapshot…';const result=await refreshFactEvaluationSnapshots();status.textContent=`Snapshot：created=${result.created||0} reused=${result.reused||0} staled=${result.staled||0} skipped=${result.skipped||0}；player_rows_modified=${result.player_rows_modified}`;}
    catch(error){status.textContent=error?.message||String(error);}
  };
}

export function mountWarRoomGoalProfile(root=document.getElementById('warroomGoalProfile')){if(root)render(root);}
