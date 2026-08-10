import {buildLocalPokemonCandidateFeatures} from './pokemon-candidate-local.js';
import {scoringRuleCoverage} from './pokemon-scoring-rule-registry.js';
import {scorePokemonCandidateFeatures} from './pokemon-scoring-engine.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const yesNo=value=>value===null||value===undefined?'—':value?'是':'否';
function overlap(row){return row.weekly_ingredient_overlap?.length?row.weekly_ingredient_overlap.join('、'):'—';}
function completeness(row){return `${Math.round(Number(row.profile_completeness?.ratio||0)*100)}%`;}
function readiness(row){return row.current_readiness_score===null||row.current_readiness_score===undefined?'—':`${Number(row.current_readiness_score).toFixed(2)}`;}
function readinessBreakdown(row){
  const detail=row.score_breakdown?.current_readiness_score||null;
  const missing=row.missing_score_inputs||[];
  if(!detail)return `<details class="war-score-breakdown"><summary>查看</summary><p class="notice">目前沒有足夠的已確認解鎖槽位資料可計算此分數。</p>${missing.length?`<p class="notice">Missing inputs：${esc(missing.join('、'))}</p>`:''}</details>`;
  const sources=(detail.source_refs||[]).join('、')||'—';
  return `<details class="war-score-breakdown"><summary>查看</summary>
    <p class="notice"><b>目前解鎖成熟度：</b>${readiness(row)} / 100。只描述已記錄能力槽位目前解鎖的比例，不代表產能、總體強度、七日能量或長期價值。</p>
    <dl>
      <dt>Rule</dt><dd><code>${esc(detail.rule_id||'—')}</code></dd>
      <dt>Rule version</dt><dd><code>${esc(detail.rule_version||'—')}</code></dd>
      <dt>Formula</dt><dd><code>${esc(detail.formula||'—')}</code></dd>
      <dt>Known / unlocked</dt><dd>${esc(detail.known_unlock_slots??'—')} / ${esc(detail.unlocked_known_slots??'—')}</dd>
      <dt>食材槽</dt><dd>known ${esc(detail.known_ingredient_slots??'—')} / unlocked ${esc(detail.unlocked_ingredient_slots??'—')}</dd>
      <dt>副技能槽</dt><dd>known ${esc(detail.known_subskill_slots??'—')} / unlocked ${esc(detail.unlocked_subskill_slots??'—')}</dd>
      <dt>Evidence</dt><dd>${esc(sources)}</dd>
    </dl>
    ${row.score_reasons?.length?`<p class="notice">Reasons：${esc(row.score_reasons.join('、'))}</p>`:''}
  </details>`;
}

export function renderWarRoomCandidateFeatures(root=document.getElementById('warroomCandidateFeatures')){
  if(!root)return;
  try{
    const featureResult=buildLocalPokemonCandidateFeatures(),rules=scoringRuleCoverage();
    if(featureResult.projection_status!=='READY'){
      root.innerHTML='<div class="panel"><h3>候選／替補池</h3><p class="notice">目前沒有玩家資料可進行本機候選特徵投影。</p></div>';return;
    }
    const scored=scorePokemonCandidateFeatures(featureResult);
    const ordered=[...scored.candidates].sort((a,b)=>{
      const rank={PASS:0,REVIEW:1,FAIL:2};
      if(rank[a.hard_constraint_status]!==rank[b.hard_constraint_status])return rank[a.hard_constraint_status]-rank[b.hard_constraint_status];
      if(Number(b.mandatory_candidate)!==Number(a.mandatory_candidate))return Number(b.mandatory_candidate)-Number(a.mandatory_candidate);
      const ar=a.current_readiness_score??-1,br=b.current_readiness_score??-1;
      if(br!==ar)return br-ar;
      return String(a.species).localeCompare(String(b.species),'zh-Hant');
    }).slice(0,20);
    root.innerHTML=`<div class="panel">
      <details class="war-candidate-pool">
        <summary>候選／替補池 · 顯示前 ${ordered.length} / ${featureResult.summary.candidate_count}</summary>
        <p class="notice">此表是自動組隊的解釋／替補資料，不是最終隊伍。Facts/Features 與分數分層計算；唯一啟用的數值規則仍是「解鎖成熟度」，不代表產能或總體強度。Hard Constraint FAIL 不進正式建議隊伍。</p>
        <p class="notice">可進排名：<b>${scored.summary.rank_eligible_count}</b>　PASS：<b>${featureResult.summary.hard_constraint_counts.PASS||0}</b>　REVIEW：<b>${featureResult.summary.hard_constraint_counts.REVIEW||0}</b>　FAIL：<b>${featureResult.summary.hard_constraint_counts.FAIL||0}</b>　已啟用 numeric rules：<b>${rules.active_numeric_count}</b></p>
        <div class="table-wrap"><table><thead><tr><th>限制</th><th>寶可夢</th><th>Lv</th><th>專長</th><th>必帶</th><th>解鎖成熟度</th><th>分數明細</th><th>喜好樹果</th><th>本週缺料能力</th><th>資料完整</th><th>原因</th></tr></thead><tbody>
          ${ordered.length?ordered.map(row=>`<tr>
            <td>${esc(row.hard_constraint_status)}</td><td>${esc(row.species)}</td><td>${esc(row.level??'—')}</td><td>${esc(row.specialty||'—')}</td>
            <td>${row.mandatory_candidate?'是':'否'}</td><td>${readiness(row)}</td><td>${readinessBreakdown(row)}</td><td>${yesNo(row.favorite_berry_match)}</td><td>${esc(overlap(row))}</td><td>${completeness(row)}</td>
            <td>${esc([...row.failed_constraints,...row.review_constraints].join('、')||'—')}</td></tr>`).join(''):'<tr><td colspan="11">目前沒有 active Pokémon。</td></tr>'}
        </tbody></table></div>
        <p class="notice">Feature Fingerprint：<code>${esc(featureResult.input_fingerprint||'—')}</code>　Scoring Registry：<code>${esc(scored.scoring_rule_registry_version||'—')}</code></p>
      </details>
    </div>`;
  }catch(error){root.innerHTML=`<div class="panel"><h3>候選／替補池</h3><p class="notice">Feature/Scoring Projection 尚未就緒：${esc(error?.message||String(error))}</p></div>`;}
}
