import './v0416-g73-ui.js';
import './v0417-g74-ai-intake-ui.js';
import {buildLocalStrategyContextPreview,buildLocalOptimizationStrategyPreview,intakeLocalOptimizationResponse} from './strategy-context-local.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let lastPreview=null,lastOptimization=null,lastIntake=null;

async function copyText(button,text,reset){
  if(!text)return;
  await navigator.clipboard.writeText(text);button.textContent='已複製';setTimeout(()=>{button.textContent=reset;},1200);
}
function objectiveText(proposal){
  const evaluation=proposal?.deterministic_evaluation||{},score=proposal?.objective_score;
  if(Number.isFinite(Number(score)))return `Deterministic score ${Number(score).toLocaleString('zh-TW',{maximumFractionDigits:4})}`;
  return evaluation?.objective_status||proposal?.deterministic_re_evaluation_status||'HOLD';
}
function proposalCard(proposal,index){
  return `<article class="proposal-card"><b>${esc(proposal.proposal_name||proposal.proposal_id||`候選 ${index+1}`)}</b>
    <p><code>${esc((proposal.candidate_refs||[]).join(' · '))}</code></p>
    <p>${esc(proposal.rationale||proposal.expected_tradeoff||'—')}</p>
    <div class="status-row"><span class="status-pill pass">Hard Constraints PASS</span><span class="status-pill ${proposal.deterministic_re_evaluation_status==='READY'?'pass':'hold'}">${esc(objectiveText(proposal))}</span></div>
    ${proposal.missing_data_dependencies?.length?`<p class="notice">缺少：${esc(proposal.missing_data_dependencies.join('、'))}</p>`:''}
    <p class="notice">不可直接 Apply；需 deterministic re-evaluation。</p></article>`;
}
function rejectedCard(proposal,index){return `<article class="proposal-card rejected"><b>${esc(proposal.proposal_name||proposal.proposal_id||`拒絕 ${index+1}`)}</b><p><code>${esc((proposal.candidate_refs||[]).join(' · ')||'—')}</code></p><div class="status-row"><span class="status-pill fail">REJECTED</span></div><p>${esc((proposal.reasons||[]).join('、')||'unknown reason')}</p></article>`;}
function renderIntakeResult(container,intake){
  const accepted=intake?.accepted_proposals||[],rejected=intake?.rejected_proposals||[];
  const fpClass=intake?.context_fingerprint_match?'pass':'fail';
  container.innerHTML=`<p><b>Intake：</b>${esc(intake?.intake_status||'—')}；Adapter：<code>${esc(intake?.adapter||'—')}</code></p>
    <div class="status-row"><span class="status-pill ${fpClass}">Context Fingerprint ${intake?.context_fingerprint_match?'MATCH':'MISMATCH'}</span><span class="status-pill ${accepted.length?'pass':'hold'}">接受 ${accepted.length}</span><span class="status-pill ${rejected.length?'fail':'pass'}">拒絕 ${rejected.length}</span></div>
    <p class="notice">Expected <code>${esc(intake?.expected_context_fingerprint||'—')}</code><br>Received <code>${esc(intake?.received_context_fingerprint||'—')}</code></p>
    ${accepted.length?`<h4>可進入 deterministic Review</h4><div class="proposal-grid">${accepted.map(proposalCard).join('')}</div>`:''}
    ${rejected.length?`<h4>已拒絕 Proposal</h4><div class="proposal-grid">${rejected.map(rejectedCard).join('')}</div>`:''}
    <p class="notice"><b>安全邊界：</b>本區沒有套用隊伍按鈕，不寫 SQLite；數值模型未 ACTIVE_VERIFIED 時 objective score 必須維持 HOLD/null。</p>`;
}

export function renderWarRoomStrategyContext(root=document.getElementById('warroomStrategyContext')){
  if(!root)return;
  root.innerHTML=`<div class="panel">
    <h3>Gemini Strategy Context 預覽</h3>
    <p class="notice">先在本機組出最小必要資料包。此區不呼叫 Gemini、不傳 SQLite、不傳 API Key／原始截圖／OCR 全文／穩定 Pokémon instance ID。</p>
    <label><input id="warRoomIncludeEventText" type="checkbox"> 本次預覽包含活動效果文字（需要送出活動公告內容時才勾選）</label>
    <p><button id="warRoomBuildStrategyContext" type="button">建立隱私預覽</button> <button id="warRoomCopyStrategyContext" type="button" disabled>複製 payload JSON</button></p>
    <div id="warRoomStrategyContextResult" class="notice">尚未建立預覽。</div>
  </div>
  <div class="panel g73-optimization-pack">
    <h3>G7.4 隊伍最佳化 Strategy Pack / AI Proposal Intake</h3>
    <p class="notice">同一份最小化 Pack 可供內部 Gemini 或外部 AI 使用。AI 只能提出候選 5 人隊伍與 trade-off；所有候選都必須回到平台重新驗證 Context Fingerprint、Hard Constraints 與 deterministic evaluator。</p>
    <div class="buttons"><button id="warRoomBuildOptimizationPack" type="button">建立最佳化分析包</button><button id="warRoomCopyOptimizationPack" type="button" disabled>複製 Pack JSON</button><button id="warRoomCopyOptimizationPrompt" type="button" disabled>複製外部 AI 提示詞</button></div>
    <div id="warRoomOptimizationResult" class="notice">尚未建立最佳化分析包。</div>
    <section class="g74-ai-intake">
      <h4>AI Proposal Intake</h4>
      <p class="notice">貼上外部 AI 的原始 JSON。v0.4.17 同時接受新的 canonical response，以及本次實測 Gemini 的 <code>proposals[].team_slots</code> legacy shape；兩者都不會直接套用。</p>
      <textarea id="warRoomOptimizationAiResponse" spellcheck="false" placeholder="先建立最佳化分析包，再貼上 Gemini / 外部 AI 回傳 JSON"></textarea>
      <div class="buttons"><button id="warRoomValidateOptimizationResponse" type="button">解析／驗證 AI 候選</button><button id="warRoomClearOptimizationResponse" type="button">清除</button></div>
      <div id="warRoomOptimizationIntakeResult" class="notice">尚未驗證 AI 回覆。</div>
    </section>
  </div>`;
  const result=root.querySelector('#warRoomStrategyContextResult'),copy=root.querySelector('#warRoomCopyStrategyContext');
  const optimizationResult=root.querySelector('#warRoomOptimizationResult'),copyPack=root.querySelector('#warRoomCopyOptimizationPack'),copyPrompt=root.querySelector('#warRoomCopyOptimizationPrompt');
  const aiText=root.querySelector('#warRoomOptimizationAiResponse'),intakeResult=root.querySelector('#warRoomOptimizationIntakeResult');
  root.querySelector('#warRoomBuildStrategyContext').onclick=()=>{
    try{
      lastPreview=buildLocalStrategyContextPreview({includeEventText:root.querySelector('#warRoomIncludeEventText').checked});
      if(lastPreview.status!=='READY'){result.textContent='目前沒有玩家資料可建立 Strategy Context。';return;}
      const privacy=lastPreview.privacy_manifest||{};
      result.innerHTML=`<p><b>Context Fingerprint：</b><code>${esc(lastPreview.payload?.context_fingerprint||'—')}</code></p>
        <p>候選 ${privacy.candidate_count||0}；目前隊伍 refs ${privacy.current_team_ref_count||0}；料理 ${privacy.recipe_count||0}；相關食材 ${privacy.inventory_ingredient_count||0}。</p>
        <p>event text：${privacy.event_text_included?'本次包含':'未包含'}；stable Pokémon ID：${privacy.stable_pokemon_ids_in_payload?'有（FAIL）':'無'}；raw SQLite：${privacy.raw_sqlite_in_payload?'有（FAIL）':'無'}；API Key：${privacy.api_key_in_payload?'有（FAIL）':'無'}。</p>
        <p>待補資料：${esc((lastPreview.missing_inputs||[]).join('、')||'無')}</p>
        <details><summary>查看 payload</summary><pre>${esc(JSON.stringify(lastPreview.payload,null,2))}</pre></details>`;
      copy.disabled=false;
    }catch(error){lastPreview=null;copy.disabled=true;result.textContent=error?.message||String(error);}
  };
  copy.onclick=async()=>{try{await copyText(copy,lastPreview?.payload?JSON.stringify(lastPreview.payload,null,2):'','複製 payload JSON');}catch(error){result.textContent=`無法複製：${error?.message||String(error)}`;}};

  root.querySelector('#warRoomBuildOptimizationPack').onclick=()=>{
    try{
      lastOptimization=buildLocalOptimizationStrategyPreview({includeEventText:root.querySelector('#warRoomIncludeEventText').checked});lastIntake=null;intakeResult.textContent='尚未驗證 AI 回覆。';
      if(lastOptimization.status!=='READY'){optimizationResult.textContent='目前無法建立最佳化分析包。';copyPack.disabled=true;copyPrompt.disabled=true;return;}
      const payload=lastOptimization.payload||{},privacy=lastOptimization.privacy_manifest||{},budget=payload.search_policy?.budget||{};
      optimizationResult.innerHTML=`<p><b>Optimization Fingerprint：</b><code>${esc(payload.optimization_fingerprint||'—')}</code></p>
        <p><b>Context Fingerprint：</b><code>${esc(payload.context_fingerprint||'—')}</code></p>
        <p><b>數值產能模型：</b>${esc(lastOptimization.production_rate_model_status||'NOT_YET_VERIFIED')}；<b>本機數值搜尋：</b>${esc(lastOptimization.team_search_execution_status||'—')}</p>
        <p>候選 refs ${privacy.candidate_ref_count||0}；Seed 隊伍 ${privacy.seed_team_ref_count||0}/5；搜尋預算 max evaluations ${esc(budget.max_team_evaluations??'—')}、beam ${esc(budget.beam_width??'—')}、Top-K ${esc(budget.top_k??'—')}。</p>
        <p>待補資料：${esc((lastOptimization.missing_inputs||[]).join('、')||'無')}</p>
        <p><b>安全邊界：</b>AI proposal 不可直接 Apply；每組隊伍都必須 deterministic re-evaluate，且不會把未來產能寫入實體庫存。</p>
        <details><summary>查看 Optimization Pack</summary><pre>${esc(JSON.stringify(payload,null,2))}</pre></details>`;
      copyPack.disabled=false;copyPrompt.disabled=!lastOptimization.external_prompt;
    }catch(error){lastOptimization=null;copyPack.disabled=true;copyPrompt.disabled=true;optimizationResult.textContent=error?.message||String(error);}
  };
  copyPack.onclick=async()=>{try{await copyText(copyPack,lastOptimization?.payload?JSON.stringify(lastOptimization.payload,null,2):'','複製 Pack JSON');}catch(error){optimizationResult.textContent=`無法複製：${error?.message||String(error)}`;}};
  copyPrompt.onclick=async()=>{try{await copyText(copyPrompt,lastOptimization?.external_prompt||'','複製外部 AI 提示詞');}catch(error){optimizationResult.textContent=`無法複製：${error?.message||String(error)}`;}};
  root.querySelector('#warRoomValidateOptimizationResponse').onclick=()=>{
    try{
      if(!lastOptimization?.payload)throw new Error('請先建立最佳化分析包，才能核對 context_fingerprint。');
      const raw=JSON.parse(aiText.value||'');lastIntake=intakeLocalOptimizationResponse(raw,lastOptimization);renderIntakeResult(intakeResult,lastIntake);
    }catch(error){lastIntake=null;intakeResult.textContent=`AI 回覆驗證失敗：${error?.message||String(error)}`;}
  };
  root.querySelector('#warRoomClearOptimizationResponse').onclick=()=>{aiText.value='';lastIntake=null;intakeResult.textContent='尚未驗證 AI 回覆。';};
}
