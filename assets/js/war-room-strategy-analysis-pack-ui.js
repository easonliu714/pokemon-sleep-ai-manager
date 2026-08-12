import {buildLocalStrategyAnalysisPack,strategyAnalysisPackSummary} from './external-strategy-analysis-local.js';

export const STRATEGY_ANALYSIS_PACK_UI_VERSION='strategy-analysis-pack-ui-2026-08-12-d-g72-evidence-authority';

let currentResult=null;
let stale=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const el=id=>document.getElementById(id);
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);}

export async function shareStrategyPromptText(prompt,{shareFn=null,writeTextFn=null}={}){
  const value=String(prompt??'');
  if(typeof shareFn==='function'){
    try{await shareFn({title:'Pokémon Sleep Strategy Analysis Prompt',text:value});return Object.freeze({status:'SHARED'});}
    catch(error){if(error?.name==='AbortError')return Object.freeze({status:'ABORTED'});}
  }
  if(typeof writeTextFn==='function'){
    await writeTextFn(value);
    return Object.freeze({status:'COPIED_FALLBACK'});
  }
  return Object.freeze({status:'UNAVAILABLE'});
}

function ensurePanel(){
  const host=el('warroomPanel');if(!host)return null;
  let panel=el('strategyAnalysisPackPanel');if(panel)return panel;
  panel=document.createElement('section');panel.id='strategyAnalysisPackPanel';panel.className='panel';
  panel.innerHTML=`<h3>外部 AI Strategy Analysis Pack</h3>
    <p class="notice">由本機 deterministic 資料產生 provider-neutral 分析包。G7.2 會保留資源 Evidence 狀態：<code>ZERO_CONFIRMED</code> 才是已確認 0，<code>NOT_OBSERVED</code> 永遠是未知；空 collection 不代表零庫存。G7.1 共享庫存 contention planner 也會以唯讀 DETERMINISTIC facts 匯出。Pokémon stable local ID 會轉成 <code>cand_XXX</code>，外部 AI 回覆沒有直接 Apply 路徑。</p>
    <p class="notice warning"><b>分享提醒：</b>匯出的 Prompt／JSON／Markdown 不包含 API Key、raw SQLite、原始截圖、完整 OCR、source image ref 或 identity fingerprint，但會包含你的 Pokémon roster 摘要、食材／道具／糖果庫存、策略目標與本週環境等遊戲記錄。請只提供給你信賴的 AI 模型／服務分析，不建議公開張貼或分享給不必要的第三方。</p>
    <p class="notice"><b>離線使用：</b>首次使用或版本更新後，請先保持連線完成 SQLite/WASM 與戰情室動態模組載入；確認頁首顯示「SQLite 已就緒」且本區可正常產生分析包後，再切換飛航／離線模式。</p>
    <label class="edit-field full"><span>這次想讓外部 AI 分析什麼？</span><textarea id="strategyAnalysisRequest" rows="4" placeholder="例如：本週應優先解鎖新料理、培養進化目標，還是保留糖果？請比較資源機會成本。"></textarea></label>
    <div class="buttons"><button id="strategyAnalysisBuildBtn" type="button">產生可信分析包</button><button id="strategyAnalysisCopyBtn" type="button" disabled>複製 AI 提示詞</button><button id="strategyAnalysisJsonBtn" type="button" disabled>下載 JSON</button><button id="strategyAnalysisMdBtn" type="button" disabled>下載 Markdown</button><button id="strategyAnalysisShareBtn" type="button" disabled>分享 Prompt</button></div>
    <div id="strategyAnalysisStatus" class="notice">尚未產生。產生時不會呼叫任何 AI Provider。</div>
    <details id="strategyAnalysisMissing" class="notice"><summary><b>Missing deterministic rules / Evidence gaps</b></summary><div id="strategyAnalysisMissingBody">尚未產生。</div></details>
    <details><summary>可分享資料摘要</summary><pre id="strategyAnalysisPreview" style="white-space:pre-wrap;max-height:22rem;overflow:auto"></pre></details>`;
  host.appendChild(panel);bind(panel);return panel;
}
function setButtons(enabled){
  for(const id of ['strategyAnalysisCopyBtn','strategyAnalysisJsonBtn','strategyAnalysisMdBtn','strategyAnalysisShareBtn'])if(el(id))el(id).disabled=!enabled;
}
function render(){
  const status=el('strategyAnalysisStatus'),preview=el('strategyAnalysisPreview'),missing=el('strategyAnalysisMissingBody');if(!status)return;
  if(!currentResult){status.className='notice';status.textContent='尚未產生。產生時不會呼叫任何 AI Provider。';if(preview)preview.textContent='';if(missing)missing.textContent='尚未產生。';setButtons(false);return;}
  const summary=strategyAnalysisPackSummary(currentResult),pack=currentResult.pack;
  status.className=stale?'notice warning':'notice success';
  status.innerHTML=`<b>${stale?'資料或分析要求已變更，請重新產生':'可分享分析包已就緒'}</b><br>Fingerprint：<code>${esc(summary.input_fingerprint||'—')}</code> · Week：${esc(summary.week_start||'—')} · Camp：${esc(summary.camp||'—')} · Goal：${esc(summary.primary_goal||'—')}<br>Candidates=${summary.candidate_count} · Ingredients=${summary.ingredient_count} · Items=${summary.item_count} · Candies=${summary.candy_count} · Unknown rows=${summary.unknown_resource_row_count} · Confirmed zero=${summary.confirmed_zero_row_count}<br>G7 Portfolio=${esc(summary.recipe_portfolio_status||'—')} · Alternatives=${summary.recipe_portfolio_alternative_count} · Missing rules=${summary.missing_rule_count}<br>Candidate refs：${pack.integrity_manifest?.candidate_reference_closure?'PASS':'FAIL'} · Recipe/resource parity：${esc(pack.integrity_manifest?.recipe_resource_parity_status||'—')} · Unknown→0 guard：${pack.integrity_manifest?.resource_unknown_preserved?'PASS':'FAIL'} · Portfolio read-only：${pack.integrity_manifest?.recipe_portfolio_read_only?'PASS':'FAIL'}`;
  if(missing){
    const ruleRows=(pack.missing_rules||[]).map(item=>`<li>RULE <code>${esc(item)}</code></li>`);
    const evidenceRows=(pack.evidence_gaps||[]).map(item=>`<li>EVIDENCE <code>${esc(item)}</code></li>`);
    missing.innerHTML=ruleRows.length||evidenceRows.length?`<ul>${[...ruleRows,...evidenceRows].join('')}</ul>`:'沒有列出的 missing deterministic rule / evidence gap。';
  }
  if(preview)preview.textContent=JSON.stringify({
    schema:pack.schema,input_fingerprint:pack.input_fingerprint,sharing_notice:pack.sharing_notice,evidence_authority_manifest:pack.evidence_authority_manifest,
    weekly_context:pack.weekly_context,goal_profile:pack.goal_profile,resource_snapshot:pack.resource_snapshot,current_team:pack.current_team,candidate_count:pack.candidate_pokemon?.length||0,
    recipe_portfolio:pack.deterministic_results?.recipe_portfolio,integrity_manifest:pack.integrity_manifest,missing_rules:pack.missing_rules,evidence_gaps:pack.evidence_gaps,privacy_manifest:pack.privacy_manifest,safety_manifest:pack.safety_manifest,
  },null,2);
  setButtons(!stale&&Boolean(currentResult.export_safe));
}
function build(){
  const status=el('strategyAnalysisStatus');if(status){status.className='notice';status.textContent='正在由本機資料建立 Strategy Analysis Pack…';}
  try{
    currentResult=buildLocalStrategyAnalysisPack({analysisRequest:el('strategyAnalysisRequest')?.value||''});stale=false;render();
  }catch(error){currentResult=null;stale=false;render();if(status){status.className='notice warning';status.textContent=`無法產生分析包：${error?.message||error}`;}}
}
async function copyPrompt(){if(!currentResult||stale)return;try{await navigator.clipboard.writeText(currentResult.prompt);alert('Strategy Analysis Prompt 已複製');}catch(error){alert(`複製失敗：${error.message}`);}}
async function sharePrompt(){
  if(!currentResult||stale)return;
  try{
    const result=await shareStrategyPromptText(currentResult.prompt,{
      shareFn:typeof navigator.share==='function'?payload=>navigator.share(payload):null,
      writeTextFn:typeof navigator.clipboard?.writeText==='function'?value=>navigator.clipboard.writeText(value):null,
    });
    if(result.status==='COPIED_FALLBACK')alert('此瀏覽器無法直接開啟分享面板，已改為複製 Strategy Analysis Prompt。請貼到你信賴的 AI 模型／服務進行分析。');
    else if(result.status==='UNAVAILABLE')alert('此瀏覽器無法直接分享或自動複製。請改用「複製 AI 提示詞」或下載 JSON / Markdown。');
  }catch(error){alert(`分享與複製皆未完成：${error?.message||error}。請改用「複製 AI 提示詞」或下載 JSON / Markdown。`);}
}
function bind(panel){
  if(panel.dataset.bound==='1')return;panel.dataset.bound='1';
  el('strategyAnalysisBuildBtn').onclick=build;
  el('strategyAnalysisCopyBtn').onclick=copyPrompt;
  el('strategyAnalysisJsonBtn').onclick=()=>{if(currentResult&&!stale)download(JSON.stringify(currentResult.pack,null,2),'pokemon_sleep_strategy_analysis_pack.json','application/json');};
  el('strategyAnalysisMdBtn').onclick=()=>{if(currentResult&&!stale)download(currentResult.markdown,'pokemon_sleep_strategy_analysis_pack.md','text/markdown');};
  el('strategyAnalysisShareBtn').onclick=sharePrompt;
  el('strategyAnalysisRequest')?.addEventListener('input',()=>invalidate());
}
function invalidate(){if(!currentResult||stale)return;stale=true;render();}
function install(){
  ensurePanel();
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="warroom"]'))setTimeout(()=>{ensurePanel();render();},0);},true);
  for(const name of ['pokemon-sleep:data-changed','pokemon-sleep:strategy-goal-profile-changed','pokemon-sleep:evaluation-input-changed'])globalThis.addEventListener?.(name,invalidate);
  document.addEventListener('pokemon-sleep-data-refreshed',invalidate);
  render();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
