import {buildLocalTeamOptimization} from './team-optimizer-local.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const readiness=value=>value===null||value===undefined?'—':Number(value).toFixed(2);
const yesNo=value=>value===true?'是':value===false?'否':'—';
const REASON_LABELS=Object.freeze({
  HARD_CONSTRAINT_MANDATORY_MEMBER:'Hard Constraint：必帶成員',
  HARD_CONSTRAINT_NIGHT_EVOLUTION_MEMBER:'Hard Constraint：夜間／進化目標成員',
  WEEKLY_FAVORITE_BERRY_MATCH:'符合本週喜好樹果',
  PROFILE_COMPLETE:'個體資料完整',
  CANDIDATE_REVIEW_WARNING:'個體仍有 REVIEW 欄位',
  DETERMINISTIC_TIE_BREAK_SELECTION:'依固定 tie-break 規則選入',
});
function reasonLabel(reason){
  if(REASON_LABELS[reason])return REASON_LABELS[reason];
  if(reason.startsWith('TEAM_ROLE:'))return `補足必要角色：${reason.slice('TEAM_ROLE:'.length)}`;
  if(reason.startsWith('WEEKLY_INGREDIENT_DEMAND_COVERAGE:'))return `本週食材缺口覆蓋指標：${reason.slice('WEEKLY_INGREDIENT_DEMAND_COVERAGE:'.length)}`;
  if(reason.startsWith('CURRENT_UNLOCK_READINESS:'))return `解鎖成熟度：${reason.slice('CURRENT_UNLOCK_READINESS:'.length)}`;
  return reason;
}
function missingLabel(reason){
  if(reason.startsWith('mandatory_member_missing:'))return `找不到必帶成員：${reason.split(':').slice(1).join(':')}`;
  if(reason.startsWith('mandatory_member_ambiguous:'))return `必帶成員仍有歧義：${reason.split(':')[1]}`;
  if(reason.startsWith('mandatory_member_hard_fail:'))return `必帶成員同時被 Hard Constraint 排除：${reason.split(':').slice(1).join(':')}`;
  if(reason.startsWith('required_role_missing:'))return `缺少必要角色：${reason.split(':').slice(1).join(':')}`;
  if(reason.startsWith('team_size:'))return `目前無法補滿 5 人：${reason.split(':').slice(1).join(':')}`;
  if(reason.startsWith('mandatory_same_species_cap:'))return `必帶成員違反同物種上限：${reason.split(':').slice(1).join(':')}`;
  return reason;
}
function warningLabel(reason){
  const labels={
    TEAM_CONTAINS_REVIEW_CANDIDATE:'隊伍含 REVIEW 候選；建議補齊個體資料。',
    SOME_MEMBERS_HAVE_NO_CURRENT_READINESS_SCORE:'部分成員缺少可計算的解鎖成熟度。',
    LEADER_IS_PRESENTATION_SLOT_ONLY_NO_VERIFIED_BONUS:'隊長目前只是呈現槽位；尚未套用任何未驗證的隊長加成。',
    PRECISE_ENERGY_MODEL_NOT_ACTIVE:'精準能量模型尚未啟用；本版不顯示推測性的七日能量。',
  };
  return labels[reason]||reason;
}
function statusLabel(status){return status==='READY'?'可用隊伍':status==='BLOCKED'?'條件阻擋':'資料／條件未完成';}
function memberCard(slot){
  const overlap=slot.weekly_ingredient_overlap?.length?slot.weekly_ingredient_overlap.join('、'):'—';
  const position=slot.is_leader?'隊長（呈現槽位）':`隊員 ${slot.slot_index}`;
  return `<article class="war-team-member${slot.is_leader?' leader':''}">
    <header><span class="war-team-slot">${esc(position)}</span><strong>${esc(slot.species||'未命名')}</strong><span>Lv${esc(slot.level??'—')}</span></header>
    <div class="war-team-member-meta"><span>專長：<b>${esc(slot.specialty||'—')}</b></span><span>解鎖成熟度：<b>${readiness(slot.current_readiness_score)}</b></span><span>喜好樹果：<b>${yesNo(slot.favorite_berry_match)}</b></span></div>
    <p>本週食材能力：${esc(overlap)}</p>
    <ul>${(slot.reasons||[]).map(reason=>`<li>${esc(reasonLabel(reason))}</li>`).join('')}</ul>
  </article>`;
}
function teamCard(team,{title='主要建議',alternative=false}={}){
  if(!team)return '';
  const missing=team.missing_constraints||[],warnings=team.warnings||[],coverage=team.recipe_coverage||{};
  return `<section class="war-team-card${alternative?' alternative':''}" data-team-status="${esc(team.team_status)}">
    <div class="war-team-card-head"><div><span class="war-team-status ${String(team.team_status||'').toLowerCase()}">${esc(statusLabel(team.team_status))}</span><h4>${esc(title)}</h4></div><code>${esc(team.team_id||'—')}</code></div>
    ${missing.length?`<div class="notice warning"><b>尚未滿足：</b><ul>${missing.map(item=>`<li>${esc(missingLabel(item))}</li>`).join('')}</ul></div>`:''}
    <div class="war-team-members">${(team.slots||[]).map(memberCard).join('')||'<p class="notice">目前沒有可建立的隊伍成員。</p>'}</div>
    <div class="war-team-summary">
      <span>成員 <b>${team.slots?.length||0}/5</b></span>
      <span>喜好樹果成員 <b>${Number(coverage.favorite_berry_match_member_count||0)}</b></span>
      <span>有本週食材覆蓋 <b>${Number(coverage.members_with_weekly_ingredient_overlap||0)}</b></span>
      <span>精準能量 <b>尚未啟用</b></span>
    </div>
    ${coverage.covered_ingredient_names?.length?`<p class="notice"><b>隊伍可覆蓋的本週缺口食材：</b>${esc(coverage.covered_ingredient_names.join('、'))}</p>`:''}
    ${warnings.length?`<details class="war-team-warnings"><summary>限制與模型警告 ${warnings.length}</summary><ul>${warnings.map(item=>`<li>${esc(warningLabel(item))}</li>`).join('')}</ul></details>`:''}
    <p class="notice">Optimizer：<code>${esc(team.optimizer_version)}</code>　Fingerprint：<code>${esc(team.input_fingerprint)}</code></p>
  </section>`;
}

export function renderWarRoomTeamOptimizer(root=document.getElementById('warroomTeamOptimizer')){
  if(!root)return;
  try{
    const result=buildLocalTeamOptimization({maxAlternatives:2});
    if(result.projection_status!=='READY'){
      root.innerHTML='<div class="panel"><h3>自動組隊建議（本機 deterministic）</h3><p class="notice">玩家資料尚未載入，暫時無法建立隊伍草稿。</p></div>';return;
    }
    const draftState=document.getElementById('warroomGoalProfile')?.dataset?.goalDraftState||'clean';
    const draftBlocked=draftState!=='clean';
    const draftMessage=draftState==='invalid'?'目前 Goal Profile 草稿有 Hard Constraint 衝突；下方結果只代表最後一次成功儲存的 Active Profile。':draftState==='dirty'?'目前 Goal Profile 有尚未儲存的變更；下方結果只代表最後一次成功儲存的 Active Profile。':draftState==='saving'?'Goal Profile 正在儲存；完成後會自動重新計算。':'';
    root.innerHTML=`<div class="panel war-team-optimizer-panel">
      <div class="war-team-toolbar"><div><h3>自動組隊建議（本機 deterministic）</h3><p class="notice">依目前已儲存的 Active Goal Profile、Hard Constraints、本週條件與可驗證候選特徵建立完整 5 人草稿。Leader 目前只是第 1 槽呈現，不套用未驗證加成。</p></div><button type="button" data-war-team-refresh ${draftBlocked?'disabled':''}>重新計算隊伍</button></div>
      ${draftMessage?`<div class="notice warning" data-war-team-stale-profile><b>尚未套用畫面上的草稿。</b> ${esc(draftMessage)} 請先成功儲存 Goal Profile。</div>`:''}
      <p class="notice" data-war-team-goal-source>Active Goal Profile：<code>${esc(result.goal_profile_id||'尚未建立')}</code>　必帶成員：<b>${Number(result.mandatory_satisfied_count||0)} / ${Number(result.mandatory_member_count||0)}</b></p>
      ${teamCard(result.primary,{title:'主要建議'})}
      ${result.alternatives?.length?`<details class="war-team-alternatives"><summary>查看替代隊伍（${result.alternatives.length}）</summary>${result.alternatives.map((team,index)=>teamCard(team,{title:`替代方案 ${index+1}`,alternative:true})).join('')}</details>`:'<p class="notice">目前沒有可保持全部 Hard Constraints 的替代 5 人隊伍。</p>'}
      <p class="notice">此區只建立本機草稿，不會自動覆蓋或寫入正式隊伍；Gemini 不參與成員挑選或數值排序。</p>
    </div>`;
    root.querySelector('[data-war-team-refresh]')?.addEventListener('click',()=>{if(!draftBlocked)renderWarRoomTeamOptimizer(root);});
  }catch(error){
    root.innerHTML=`<div class="panel"><h3>自動組隊建議（本機 deterministic）</h3><p class="notice">Team Optimizer 尚未就緒：${esc(error?.message||String(error))}</p></div>`;
  }
}
