import {isRescueReadonly} from './database.js';
import {getActiveStrategyGoalProfile,saveStrategyGoalProfile} from './strategy-goal-store.js';
import {defaultHardConstraints,STRATEGY_GOALS,strategyGoalProfileDraftState} from './strategy-goal-contract.js';
import {refreshFactEvaluationSnapshots,listCurrentPokemonEvaluationSnapshots} from './pokemon-evaluation-store.js';
import {createControlledSelector,createControlledNumberMapEditor} from './controlled-selector.js';
import {getWarRoomPokemonOptions,getWarRoomIngredientOptions,WAR_ROOM_ROLE_OPTIONS} from './war-room-controlled-options.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const GOAL_LABELS=Object.freeze({
  max_snorlax_energy:'卡比獸能量最大化',unlock_recipes:'開啟未解鎖料理',ingredient_stockpile:'補足食材庫存',dream_shard_farming:'夢之碎片收益',
  research_unlock:'研究／新寶可夢解鎖',evolution_progress:'進化條件推進',training_roi:'培養投資報酬',event_objective:'本週活動目標',balanced:'均衡',
});
const parseSlotList=value=>String(value||'').split(/[,，\n]/).map(item=>item.trim()).filter(Boolean);
const checked=value=>value?'checked':'';

function render(root){
  if(isRescueReadonly()){
    root.innerHTML='<div class="panel"><h3>戰情室目標與 Hard Constraints</h3><p class="notice">玩家資料尚未載入，目前為救援／唯讀模式。Goal Profile 與 Evaluation Snapshot 不會讀取或寫入玩家資料；完成本機資料庫載入後再使用此區。</p></div>';
    return;
  }
  const saved=getActiveStrategyGoalProfile();
  const constraints={...defaultHardConstraints(),...(saved?.hard_constraints||{})};
  const primary=saved?.primary_goal||'balanced';
  const secondary=new Set(saved?.secondary_goals||[]);
  const snapshots=listCurrentPokemonEvaluationSnapshots();
  const factOnly=snapshots.filter(row=>row.evaluation_status==='FACT_SNAPSHOT_ONLY').length;
  root.innerHTML=`
    <div class="panel">
      <h3>戰情室目標與 Hard Constraints</h3>
      <p class="notice">目標與限制只儲存在本機。Hard Constraint 先於後續 soft score 判定；FAIL 候選不可因分數較高重新進入排名。寶可夢／角色／食材改採受控清單，避免自由文字建立不存在的值。</p>
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
        <div class="edit-field full"><span>一定要包含的寶可夢</span><div id="warRoomMustIncludePokemon"></div><small>從目前寶可夢盒選擇個體；同物種仍可分別選擇。</small></div>
        <div class="edit-field full"><span>排除的寶可夢</span><div id="warRoomExcludePokemon"></div></div>
        <div class="edit-field full"><span>必須角色／職能</span><div id="warRoomMustIncludeRole"></div></div>
        <div class="edit-field full"><span>夜間共眠／進化目標成員</span><div id="warRoomNightPokemon"></div></div>
        <label class="edit-field"><span>保留現隊伍槽位（1~5）</span><input name="preserve_current_team_slots" value="${esc((constraints.preserve_current_team_slots||[]).join(','))}"></label>
        <div class="edit-field full"><span>食材安全庫存</span><div id="warRoomIngredientSafeReserve"></div><small>先選食材，再輸入保留數量；不再使用「食材=數量」自由文字。</small></div>
        <label class="edit-field"><span>培養糖果預算</span><input name="budget_candy" type="number" min="0" value="${esc(constraints.training_budget?.candy??'')}"></label>
        <label class="edit-field"><span>夢之碎片預算</span><input name="budget_dream_shard" type="number" min="0" value="${esc(constraints.training_budget?.dream_shard??'')}"></label>
        <label class="edit-field"><span>種子預算</span><input name="budget_seed" type="number" min="0" value="${esc(constraints.training_budget?.seed??'')}"></label>
        <label class="edit-field"><span>進化道具預算</span><input name="budget_evolution_item" type="number" min="0" value="${esc(constraints.training_budget?.evolution_item??'')}"></label>
        <div class="full"><button type="submit" id="warRoomSaveGoalProfile">儲存目標與限制</button> <button type="button" id="warRoomRefreshEvaluationSnapshots">建立／更新評估快照</button></div>
      </form>
      <p id="warRoomGoalDraftStatus" class="notice"></p>
      <p id="warRoomGoalStatus" class="notice">${saved?`Active Profile：${esc(saved.goal_profile_id)} / ${esc(saved.profile_version)}`:'尚未儲存 Goal Profile；目前使用 UI 預設值，不會自動建立玩家資料。'}<br>目前有效 Evaluation Snapshot：${snapshots.length}；FACT-only：${factOnly}</p>
    </div>`;

  const pokemonOptions=getWarRoomPokemonOptions();
  const ingredientOptions=getWarRoomIngredientOptions();
  const pokemonOptionByValue=new Map(pokemonOptions.map(option=>[String(option.value),option]));
  let syncDraftState=()=>null;
  const mustIncludeSelector=createControlledSelector(root.querySelector('#warRoomMustIncludePokemon'),{
    options:pokemonOptions,values:constraints.must_include_pokemon||[],multiple:true,maxSelections:5,selectionLabel:'選擇必帶寶可夢',placeholder:'搜尋名稱、Lv、專長或個體…',onChange:()=>syncDraftState(),
  });
  const excludeSelector=createControlledSelector(root.querySelector('#warRoomExcludePokemon'),{
    options:pokemonOptions,values:constraints.exclude_pokemon||[],multiple:true,selectionLabel:'選擇排除寶可夢',placeholder:'搜尋名稱、Lv、專長或個體…',onChange:()=>syncDraftState(),
  });
  const roleSelector=createControlledSelector(root.querySelector('#warRoomMustIncludeRole'),{
    options:WAR_ROOM_ROLE_OPTIONS,values:constraints.must_include_role||[],multiple:true,maxSelections:3,selectionLabel:'選擇必要角色',placeholder:'搜尋樹果、食材、技能…',onChange:()=>syncDraftState(),
  });
  const nightSelector=createControlledSelector(root.querySelector('#warRoomNightPokemon'),{
    options:pokemonOptions,values:constraints.sleep_evolution_member_at_night||[],multiple:true,maxSelections:5,selectionLabel:'選擇夜間／進化目標成員',placeholder:'搜尋寶可夢個體…',onChange:()=>syncDraftState(),
  });
  const reserveEditor=createControlledNumberMapEditor(root.querySelector('#warRoomIngredientSafeReserve'),{
    options:ingredientOptions,value:constraints.ingredient_safe_reserve||{},selectionLabel:'新增安全庫存食材',placeholder:'搜尋食材…',minimum:0,onChange:()=>syncDraftState(),
  });

  const form=root.querySelector('#warRoomGoalProfileForm'),status=root.querySelector('#warRoomGoalStatus'),draftStatus=root.querySelector('#warRoomGoalDraftStatus');
  const saveButton=root.querySelector('#warRoomSaveGoalProfile'),snapshotButton=root.querySelector('#warRoomRefreshEvaluationSnapshots');
  const unresolvedCount=()=>mustIncludeSelector.unresolved().length+excludeSelector.unresolved().length+roleSelector.unresolved().length+nightSelector.unresolved().length+reserveEditor.unresolved().length;
  if(unresolvedCount())status.innerHTML+=`<br><b>受控清單 REVIEW：${unresolvedCount()}</b> 個舊值無法唯一解析；未手動移除前會保留原值。`;

  function buildDraftProfile(){
    const data=new FormData(form),secondaryGoals=data.getAll('secondary_goal');
    return {profile_name:data.get('profile_name'),primary_goal:data.get('primary_goal'),secondary_goals:secondaryGoals,hard_constraints:{
      require_verified_master:data.has('require_verified_master'),current_unlocks_only:data.has('current_unlocks_only'),pot_capacity_limit:data.has('pot_capacity_limit'),item_safe_reserve:data.has('item_safe_reserve'),require_complete_profile_fields:data.has('require_complete_profile_fields'),
      recipe_unlock_policy:data.get('recipe_unlock_policy'),max_same_species:data.get('max_same_species'),no_untrained_candidates:data.has('no_untrained_candidates'),minimum_candidate_level:data.get('minimum_candidate_level'),
      must_include_pokemon:[...mustIncludeSelector.values()],exclude_pokemon:[...excludeSelector.values()],must_include_role:[...roleSelector.values()],sleep_evolution_member_at_night:[...nightSelector.values()],
      preserve_current_team_slots:parseSlotList(data.get('preserve_current_team_slots')),ingredient_safe_reserve:{...reserveEditor.value()},
      training_budget:{candy:data.get('budget_candy'),dream_shard:data.get('budget_dream_shard'),seed:data.get('budget_seed'),evolution_item:data.get('budget_evolution_item')},
    }};
  }
  function humanError(error){
    if(String(error).startsWith('include_exclude_conflict:')){
      const value=String(error).slice('include_exclude_conflict:'.length),option=pokemonOptionByValue.get(value);
      return `同一個體不能同時設為「一定要包含」與「排除」：${option?.label||'目前選取的寶可夢個體'}`;
    }
    if(error==='minimum_candidate_level_required')return '勾選「排除未培養候選」時，必須設定最低等級。';
    return String(error);
  }
  function emitDraftState(state){
    window.dispatchEvent?.(new CustomEvent('pokemon-sleep:strategy-goal-profile-draft-changed',{detail:{state}}));
  }
  syncDraftState=({emit=true}={})=>{
    const draft=strategyGoalProfileDraftState(buildDraftProfile(),saved);
    const state=!draft.valid?'invalid':draft.dirty?'dirty':'clean';
    root.dataset.goalDraftState=state;
    saveButton.disabled=!draft.valid;
    snapshotButton.disabled=!draft.valid||draft.dirty;
    if(!draft.valid){
      draftStatus.className='notice warning';
      draftStatus.innerHTML=`<b>草稿無法儲存。</b> ${draft.errors.map(humanError).map(esc).join(' ') }<br>下方自動組隊仍使用最後一次成功儲存的 Active Profile。`;
    }else if(draft.dirty){
      draftStatus.className='notice warning';
      draftStatus.innerHTML=`<b>${saved?'尚未儲存變更':'尚未建立 Active Profile'}。</b> 請先按「儲存目標與限制」；完成前自動組隊不會使用這份草稿。`;
    }else{
      draftStatus.className='notice';
      draftStatus.textContent='草稿已與 Active Profile 同步；可依目前已儲存條件重新計算隊伍。';
    }
    if(emit)emitDraftState(state);
    return draft;
  };

  form.addEventListener('input',event=>{if(!event.target?.matches?.('[data-cs-search]'))syncDraftState();});
  form.addEventListener('change',()=>syncDraftState());
  syncDraftState();

  form.onsubmit=async event=>{
    event.preventDefault();
    const draft=syncDraftState({emit:true});
    if(!draft.valid){status.textContent='無法儲存：請先修正上方 Hard Constraint 衝突。';return;}
    try{
      root.dataset.goalDraftState='saving';saveButton.disabled=true;snapshotButton.disabled=true;emitDraftState('saving');status.textContent='正在儲存策略目標…';
      await saveStrategyGoalProfile(buildDraftProfile(),{goalProfileId:saved?.goal_profile_id||null,activate:true});render(root);
    }catch(error){status.textContent=error?.message||String(error);syncDraftState();}
  };
  snapshotButton.onclick=async()=>{
    const draft=syncDraftState({emit:false});
    if(!draft.valid||draft.dirty){status.textContent='請先成功儲存目前 Goal Profile，再建立／更新 Evaluation Snapshot。';return;}
    try{status.textContent='正在建立／重用本機 Evaluation Snapshot…';const result=await refreshFactEvaluationSnapshots();status.textContent=`Snapshot：created=${result.created||0} reused=${result.reused||0} staled=${result.staled||0} skipped=${result.skipped||0}；player_rows_modified=${result.player_rows_modified}`;}
    catch(error){status.textContent=error?.message||String(error);}
  };
}

export function mountWarRoomGoalProfile(root=document.getElementById('warroomGoalProfile')){if(root)render(root);}
