import {buildLocalPokemonCandidateFeatures} from './pokemon-candidate-local.js';
import {scoringRuleCoverage} from './pokemon-scoring-rule-registry.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const yesNo=value=>value===null||value===undefined?'—':value?'是':'否';
function overlap(row){return row.weekly_ingredient_overlap?.length?row.weekly_ingredient_overlap.join('、'):'—';}
function completeness(row){return `${Math.round(Number(row.profile_completeness?.ratio||0)*100)}%`;}

export function renderWarRoomCandidateFeatures(root=document.getElementById('warroomCandidateFeatures')){
  if(!root)return;
  try{
    const result=buildLocalPokemonCandidateFeatures(),rules=scoringRuleCoverage();
    if(result.projection_status!=='READY'){
      root.innerHTML='<div class="panel"><h3>寶可夢候選特徵</h3><p class="notice">目前沒有玩家資料可進行本機候選特徵投影。</p></div>';return;
    }
    const ordered=[...result.candidates].sort((a,b)=>{
      const rank={PASS:0,REVIEW:1,FAIL:2};
      if(rank[a.hard_constraint_status]!==rank[b.hard_constraint_status])return rank[a.hard_constraint_status]-rank[b.hard_constraint_status];
      if(Number(b.mandatory_candidate)!==Number(a.mandatory_candidate))return Number(b.mandatory_candidate)-Number(a.mandatory_candidate);
      return String(a.species).localeCompare(String(b.species),'zh-Hant');
    }).slice(0,15);
    root.innerHTML=`<div class="panel">
      <h3>寶可夢候選特徵（Feature-only）</h3>
      <p class="notice">目前只投影可驗證 facts/features，尚未啟用沒有 Evidence 的 numeric Pokémon score。Hard Constraint FAIL 不進後續排名；REVIEW 代表需要補資料或人工確認。</p>
      <p class="notice">候選：<b>${result.summary.candidate_count}</b>　可進排名：<b>${result.summary.rank_eligible_count}</b>　PASS：<b>${result.summary.hard_constraint_counts.PASS||0}</b>　REVIEW：<b>${result.summary.hard_constraint_counts.REVIEW||0}</b>　FAIL：<b>${result.summary.hard_constraint_counts.FAIL||0}</b>　已啟用 numeric rules：<b>${rules.active_numeric_count}</b></p>
      <div class="table-wrap"><table><thead><tr><th>限制</th><th>寶可夢</th><th>Lv</th><th>專長</th><th>必帶</th><th>喜好樹果</th><th>本週缺料能力</th><th>資料完整</th><th>原因</th></tr></thead><tbody>
        ${ordered.length?ordered.map(row=>`<tr>
          <td>${esc(row.hard_constraint_status)}</td><td>${esc(row.species)}</td><td>${esc(row.level??'—')}</td><td>${esc(row.specialty||'—')}</td>
          <td>${row.mandatory_candidate?'是':'否'}</td><td>${yesNo(row.favorite_berry_match)}</td><td>${esc(overlap(row))}</td><td>${completeness(row)}</td>
          <td>${esc([...row.failed_constraints,...row.review_constraints].join('、')||'—')}</td></tr>`).join(''):'<tr><td colspan="9">目前沒有 active Pokémon。</td></tr>'}
      </tbody></table></div>
      <p class="notice">Feature Fingerprint：<code>${esc(result.input_fingerprint||'—')}</code></p>
    </div>`;
  }catch(error){root.innerHTML=`<div class="panel"><h3>寶可夢候選特徵</h3><p class="notice">Feature Projection 尚未就緒：${esc(error?.message||String(error))}</p></div>`;}
}
