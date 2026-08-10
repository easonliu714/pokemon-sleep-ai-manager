import {buildLocalStrategyAnalysisPack,strategyAnalysisPackSummary} from './external-strategy-analysis-local.js';

export const STRATEGY_ANALYSIS_PACK_UI_VERSION='strategy-analysis-pack-ui-2026-08-10-b';

let currentResult=null;
let stale=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const el=id=>document.getElementById(id);
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function ensurePanel(){
  const host=el('warroomPanel');if(!host)return null;
  let panel=el('strategyAnalysisPackPanel');if(panel)return panel;
  panel=document.createElement('section');panel.id='strategyAnalysisPackPanel';panel.className='panel';
  panel.innerHTML=`<h3>外部 AI Strategy Analysis Pack</h3>
    <p class="notice">由本機 deterministic 資料產生 provider-neutral 分析包。資源數量以目前 SQLite 為準；Pokémon stable local ID 會轉成 <code>cand_XXX</code>；不包含 API Key、raw SQLite、原始截圖、完整 OCR、source image ref 或 identity fingerprint。外部 AI 回覆只作策略建議，沒有直接 Apply 路徑。</p>
    <label class="edit-field full"><span>這次想讓外部 AI 分析什麼？</span><textarea id="strategyAnalysisRequest" rows="4" placeholder="例如：本週應優先解鎖新料理、培養進化目標，還是保留糖果？請比較資源機會成本。"></textarea></label>
    <div class="buttons"><button id="strategyAnalysisBuildBtn" type="button">產生可信分析包</button><button id="strategyAnalysisCopyBtn" type="button" disabled>複製 AI 提示詞</button><button id="strategyAnalysisJsonBtn" type="button" disabled>下載 JSON</button><button id="strategyAnalysisMdBtn" type="button" disabled>下載 Markdown</button><button id="strategyAnalysisShareBtn" type="button" disabled>分享</button></div>
    <div id="strategyAnalysisStatus" class="notice">尚未產生。產生時不會呼叫任何 AI Provider。</div>
    <details id="strategyAnalysisMissing" class="notice"><summary><b>Missing deterministic rules</b></summary><div id="strategyAnalysisMissingBody">尚未產生。</div></details>
    <details><summary>可分享資料摘要</summary><pre id="strategyAnalysisPreview" style="white-space:pre-wrap;max-height:22rem;overflow:auto"></pre></details>`;
  host.appendChild(panel);bind(panel);return panel;
}
function setButtons(enabled){
  for(const id of ['strategyAnalysisCopyBtn','strategyAnalysisJsonBtn','strategyAnalysisMdBtn'])if(el(id))el(id).disabled=!enabled;
  const share=el('strategyAnalysisShareBtn');if(share)share.disabled=!enabled||typeof navigator.share!=='function';
}
function render(){
  const status=el('strategyAnalysisStatus'),preview=el('strategyAnalysisPreview'),missing=el('strategyAnalysisMissingBody');if(!status)return;
  if(!currentResult){status.className='notice';status.textContent='尚未產生。產生時不會呼叫任何 AI Provider。';if(preview)preview.textContent='';if(missing)missing.textContent='尚未產生。';setButtons(false);return;}
  const summary=strategyAnalysisPackSummary(currentResult),pack=currentResult.pack;
  status.className=stale?'notice warning':'notice success';
  status.innerHTML=`<b>${stale?'資料或分析要求已變更，請重新產生':'可分享分析包已就緒'}</b><br>Fingerprint：<code>${esc(summary.input_fingerprint||'—')}</code> · Week：${esc(summary.week_start||'—')} · Camp：${esc(summary.camp||'—')} · Goal：${esc(summary.primary_goal||'—')}<br>Candidates=${summary.candidate_count} · Ingredients=${summary.ingredient_count} · Items=${summary.item_count} · Candies=${summary.candy_count} · Missing rules=${summary.missing_rule_count}`;
  if(missing)missing.innerHTML=pack.missing_rules?.length?`<ul>${pack.missing_rules.map(item=>`<li><code>${esc(item)}</code></li>`).join('')}</ul>`:'沒有列出的 missing deterministic rule。';
  if(preview)preview.textContent=JSON.stringify({schema:pack.schema,input_fingerprint:pack.input_fingerprint,weekly_context:pack.weekly_context,goal_profile:pack.goal_profile,resource_snapshot:pack.resource_snapshot,current_team:pack.current_team,candidate_count:pack.candidate_pokemon?.length||0,missing_rules:pack.missing_rules,privacy_manifest:pack.privacy_manifest,safety_manifest:pack.safety_manifest},null,2);
  setButtons(!stale&&Boolean(currentResult.export_safe));
}
function build(){
  const status=el('strategyAnalysisStatus');if(status){status.className='notice';status.textContent='正在由本機資料建立 Strategy Analysis Pack…';}
  try{
    currentResult=buildLocalStrategyAnalysisPack({analysisRequest:el('strategyAnalysisRequest')?.value||''});stale=false;render();
  }catch(error){currentResult=null;stale=false;render();if(status){status.className='notice warning';status.textContent=`無法產生分析包：${error?.message||error}`;}}
}
async function copyPrompt(){if(!currentResult||stale)return;try{await navigator.clipboard.writeText(currentResult.prompt);alert('Strategy Analysis Prompt 已複製');}catch(error){alert(`複製失敗：${error.message}`);}}
async function share(){
  if(!currentResult||stale||typeof navigator.share!=='function')return;
  try{
    const json=JSON.stringify(currentResult.pack,null,2);
    const files=typeof File==='function'?[new File([json],'pokemon_sleep_strategy_analysis_pack.json',{type:'application/json'}),new File([currentResult.markdown],'pokemon_sleep_strategy_analysis_pack.md',{type:'text/markdown'})]:[];
    if(files.length&&navigator.canShare?.({files}))await navigator.share({title:'Pokémon Sleep Strategy Analysis Pack',text:'可供外部 AI 分析的本機可信資源包',files});
    else await navigator.share({title:'Pokémon Sleep Strategy Analysis Prompt',text:currentResult.prompt});
  }catch(error){if(error?.name!=='AbortError')alert(`分享失敗：${error.message}`);}
}
function bind(panel){
  if(panel.dataset.bound==='1')return;panel.dataset.bound='1';
  el('strategyAnalysisBuildBtn').onclick=build;
  el('strategyAnalysisCopyBtn').onclick=copyPrompt;
  el('strategyAnalysisJsonBtn').onclick=()=>{if(currentResult&&!stale)download(JSON.stringify(currentResult.pack,null,2),'pokemon_sleep_strategy_analysis_pack.json','application/json');};
  el('strategyAnalysisMdBtn').onclick=()=>{if(currentResult&&!stale)download(currentResult.markdown,'pokemon_sleep_strategy_analysis_pack.md','text/markdown');};
  el('strategyAnalysisShareBtn').onclick=share;
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
