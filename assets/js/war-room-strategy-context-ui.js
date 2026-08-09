import {buildLocalStrategyContextPreview} from './strategy-context-local.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let lastPreview=null;

export function renderWarRoomStrategyContext(root=document.getElementById('warroomStrategyContext')){
  if(!root)return;
  root.innerHTML=`<div class="panel">
    <h3>Gemini Strategy Context 預覽</h3>
    <p class="notice">先在本機組出最小必要資料包。此區不呼叫 Gemini、不傳 SQLite、不傳 API Key／原始截圖／OCR 全文／穩定 Pokémon instance ID。</p>
    <label><input id="warRoomIncludeEventText" type="checkbox"> 本次預覽包含活動效果文字（需要送出活動公告內容時才勾選）</label>
    <p><button id="warRoomBuildStrategyContext" type="button">建立隱私預覽</button> <button id="warRoomCopyStrategyContext" type="button" disabled>複製 payload JSON</button></p>
    <div id="warRoomStrategyContextResult" class="notice">尚未建立預覽。</div>
  </div>`;
  const result=root.querySelector('#warRoomStrategyContextResult'),copy=root.querySelector('#warRoomCopyStrategyContext');
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
  copy.onclick=async()=>{
    if(!lastPreview?.payload)return;
    try{await navigator.clipboard.writeText(JSON.stringify(lastPreview.payload,null,2));copy.textContent='已複製';setTimeout(()=>{copy.textContent='複製 payload JSON';},1200);}catch(error){result.textContent=`無法複製：${error?.message||String(error)}`;}
  };
}
