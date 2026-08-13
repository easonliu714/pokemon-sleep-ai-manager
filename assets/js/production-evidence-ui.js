import {buildLocalProductionEvidenceSnapshot} from './strategy-context-local.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pct=value=>Number.isFinite(Number(value))?`${(Number(value)*100).toFixed(0)}%`:'—';
function evidenceClass(status){return /ACTIVE_VERIFIED|READY|LOCAL_PUBLIC_MASTER|IDENTIFIED|TEXT_ONLY/.test(String(status||''))?'pass':/BLOCKED/.test(String(status||''))?'hold':'hold';}
function authorityClass(status){return /ACTIVE_VERIFIED|LOCAL_PUBLIC_MASTER|OBSERVED_INPUT/.test(String(status||''))?'pass':'hold';}
function ruleCard(row){
  const cov=row?.coverage||{},blockers=row?.blocking_reasons||[],active=row?.authority_status==='ACTIVE_VERIFIED';
  return `<article class="proposal-card"><b><code>${esc(row?.dimension||'—')}</code></b>
    <div class="status-row"><span class="status-pill ${evidenceClass(row?.evidence_status)}">${esc(row?.evidence_status||'—')}</span><span class="status-pill ${authorityClass(row?.authority_status)}">${esc(row?.authority_status||'—')}</span></div>
    <p class="notice">Coverage ${esc(cov.observed_count??0)}/${esc(cov.total_count??0)} (${esc(pct(cov.ratio))})</p>
    <p>${blockers.length?`阻擋：${esc(blockers.join('、'))}`:active?'此 dimension 已通過 Production Authority，可作為局部 numeric component；完整 rate model 仍須等待其他必要 dimension。':'目前 Evidence 無額外阻擋；仍依 Production Authority 決定是否可進數值模型。'}</p>
    <p class="notice">Evidence：${esc((row?.source_refs||[]).join('；')||'—')}</p>
  </article>`;
}
function renderResult(container,snapshot){
  const s=snapshot?.summary||{};
  container.innerHTML=`<p><b>Evidence Fingerprint：</b><code>${esc(snapshot?.evidence_fingerprint||'—')}</code></p>
    <p><b>Activation：</b>${esc(snapshot?.activation_decision||'—')}；<b>Numeric model：</b>${esc(snapshot?.numeric_rate_model_status||'—')}</p>
    <div class="status-row"><span class="status-pill pass">helper ${esc(s.helper_seconds_observed_count??0)}/${esc(snapshot?.candidate_count??0)}</span><span class="status-pill pass">type→berry ${esc(s.type_to_berry_mapped_count??0)}/${esc(snapshot?.candidate_count??0)}</span><span class="status-pill pass">berry strength ${esc(s.berry_strength_resolved_candidate_count??0)}/${esc(snapshot?.candidate_count??0)}</span><span class="status-pill hold">active numeric ${esc(s.active_numeric_dimension_count??0)}/${esc(s.numeric_dimension_count??0)}</span><span class="status-pill hold">blocked ${esc(s.blocked_numeric_dimension_count??0)}</span></div>
    <p class="notice"><b>安全邊界：</b>局部 ACTIVE_VERIFIED ≠ 完整 Production Model 已啟用；缺值不等於 0。本區不寫 SQLite、不呼叫網路、不讓 AI 成為 numeric authority。</p>
    <div class="proposal-grid">${(snapshot?.rules||[]).map(ruleCard).join('')}</div>
    <details><summary>查看 Evidence Snapshot JSON</summary><pre>${esc(JSON.stringify(snapshot,null,2))}</pre></details>`;
}

export function renderProductionEvidencePanel(root){
  if(!root)return;
  root.querySelector('#warRoomProductionEvidencePanel')?.remove();
  const section=document.createElement('section');section.id='warRoomProductionEvidencePanel';section.className='panel g75-production-evidence';
  section.innerHTML=`<h3>G7.5 Production Model Evidence Gate</h3>
    <p class="notice">先確認每個產能 dimension 的 Evidence 與本機 Master 覆蓋，再決定是否升級 ACTIVE_VERIFIED。REFERENCE_EVIDENCE_IDENTIFIED 只表示已找到可治理來源，不代表公式已啟用。</p>
    <div class="buttons"><button id="warRoomRefreshProductionEvidence" type="button">重新檢查 Evidence</button><button id="warRoomCopyProductionEvidence" type="button">複製 Evidence JSON</button></div>
    <div id="warRoomProductionEvidenceResult" class="notice">正在建立 Evidence Snapshot…</div>`;
  root.append(section);
  const result=section.querySelector('#warRoomProductionEvidenceResult');let snapshot=null;
  const refresh=()=>{try{snapshot=buildLocalProductionEvidenceSnapshot();renderResult(result,snapshot);}catch(error){snapshot=null;result.textContent=`Evidence 檢查失敗：${error?.message||String(error)}`;}};
  section.querySelector('#warRoomRefreshProductionEvidence').onclick=refresh;
  section.querySelector('#warRoomCopyProductionEvidence').onclick=async()=>{try{if(!snapshot)refresh();if(!snapshot)return;await navigator.clipboard.writeText(JSON.stringify(snapshot,null,2));const button=section.querySelector('#warRoomCopyProductionEvidence');button.textContent='已複製';setTimeout(()=>{button.textContent='複製 Evidence JSON';},1200);}catch(error){result.textContent=`無法複製 Evidence：${error?.message||String(error)}`;}};
  refresh();
}
