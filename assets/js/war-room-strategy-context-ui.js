import {buildLocalStrategyContextPreview,buildLocalOptimizationStrategyPreview} from './strategy-context-local.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let lastPreview=null,lastOptimization=null;

async function copyText(button,text,reset){
  if(!text)return;
  await navigator.clipboard.writeText(text);button.textContent='已複製';setTimeout(()=>{button.textContent=reset;},1200);
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
    <h3>G7.3 隊伍最佳化 Strategy Pack</h3>
    <p class="notice">同一份最小化 Pack 可供後續內部 Gemini 或外部 AI 使用；AI 只能提出候選 5 人隊伍與 trade-off，所有數值都必須回到 deterministic evaluator 重算。ingredient/hour、berry/hour、skill/hour 尚未 verified 時，不會假裝已有精確最佳隊伍。</p>
    <div class="buttons"><button id="warRoomBuildOptimizationPack" type="button">建立最佳化分析包</button><button id="warRoomCopyOptimizationPack" type="button" disabled>複製 Pack JSON</button><button id="warRoomCopyOptimizationPrompt" type="button" disabled>複製外部 AI 提示詞</button></div>
    <div id="warRoomOptimizationResult" class="notice">尚未建立最佳化分析包。</div>
  </div>`;
  const result=root.querySelector('#warRoomStrategyContextResult'),copy=root.querySelector('#warRoomCopyStrategyContext');
  const optimizationResult=root.querySelector('#warRoomOptimizationResult'),copyPack=root.querySelector('#warRoomCopyOptimizationPack'),copyPrompt=root.querySelector('#warRoomCopyOptimizationPrompt');
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
      lastOptimization=buildLocalOptimizationStrategyPreview({includeEventText:root.querySelector('#warRoomIncludeEventText').checked});
      if(lastOptimization.status!=='READY'){optimizationResult.textContent='目前無法建立最佳化分析包。';copyPack.disabled=true;copyPrompt.disabled=true;return;}
      const payload=lastOptimization.payload||{},privacy=lastOptimization.privacy_manifest||{},budget=payload.search_policy?.budget||{};
      optimizationResult.innerHTML=`<p><b>Optimization Fingerprint：</b><code>${esc(payload.optimization_fingerprint||'—')}</code></p>
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
}
