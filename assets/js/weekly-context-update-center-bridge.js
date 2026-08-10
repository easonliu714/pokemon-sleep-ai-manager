import {currentWeeklyContext} from './weekly-context-store.js';
import {normalizeWeeklyContext,parseWeeklyEventEffects} from './weekly-context-normalization.js';
import {resolveCampFavoriteBerries,campBerryAuthority} from './public-camp-berry-master.js';
import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {isWeeklyContextPayload,validateWeeklyContextImportPayload} from './weekly-context-import-contract.js';

export const WEEKLY_CONTEXT_UPDATE_BRIDGE_VERSION='weekly-context-update-bridge-2026-08-10-f';

let weeklyPayload=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function ensureRoot(){
  const updates=document.getElementById('updates');if(!updates)return null;
  let root=document.getElementById('weeklyContextImportInspection');if(root)return root;
  root=document.createElement('section');root.id='weeklyContextImportInspection';root.className='panel hidden';
  const workflow=document.getElementById('workflowIssues')||document.getElementById('workflowSummary');workflow?.insertAdjacentElement('afterend',root);
  return root;
}
function levenshtein(a,b){
  const x=[...String(a||'')],y=[...String(b||'')],dp=Array.from({length:x.length+1},()=>Array(y.length+1).fill(0));
  for(let i=0;i<=x.length;i+=1)dp[i][0]=i;for(let j=0;j<=y.length;j+=1)dp[0][j]=j;
  for(let i=1;i<=x.length;i+=1)for(let j=1;j<=y.length;j+=1)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(x[i-1]===y[j-1]?0:1));
  return dp[x.length][y.length];
}
function runtimeVocabularyIssues(operation){
  if(!operation||!isDatabaseReady()||isRescueReadonly())return [];
  let vocabulary=[];try{vocabulary=rows('SELECT berry_name FROM berry_master ORDER BY berry_name').map(row=>String(row.berry_name||'').trim()).filter(Boolean);}catch{return [];}
  if(!vocabulary.length)return [];
  const set=new Set(vocabulary),issues=[];
  for(const key of ['favorite_berry_1','favorite_berry_2','favorite_berry_3']){
    const value=String(operation.data?.[key]||'').trim();if(!value||set.has(value))continue;
    const ranked=vocabulary.map(name=>[name,levenshtein(value,name)]).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0],'zh-Hant'));
    const suggestion=ranked[0]?.[1]<=1?`；可能是「${ranked[0][0]}」，請回原圖確認`:'；請回原圖確認';
    issues.push(`${key}「${value}」不在公版樹果名稱中${suggestion}`);
  }
  return issues;
}
function fullValidation(){
  const base=validateWeeklyContextImportPayload(weeklyPayload),runtime=runtimeVocabularyIssues(base.operation);
  return {...base,ok:base.ok&&runtime.length===0,issues:[...new Set([...base.issues,...runtime])]};
}
function berryDescription(incoming){
  const observed=[incoming.favorite_berry_1,incoming.favorite_berry_2,incoming.favorite_berry_3].filter(Boolean);
  const resolved=resolveCampFavoriteBerries(incoming.camp,observed),authority=campBerryAuthority(incoming.camp);
  if(resolved.policy==='FIXED_3')return `公版固定：${resolved.berries.join('、')}（JSON 可省略；匯入後由營地 Master 自動投影）`;
  if(resolved.policy==='WEEKLY_RANDOM_3')return resolved.berries.length===3?`玩家本週觀測：${resolved.berries.join('、')}`:'每週隨機；本 JSON 未提供三種實際樹果，套用後可在本週環境人工 fallback 補足';
  if(resolved.policy==='EX_DYNAMIC')return `${authority?.main_berry_pool?.length?`EX 主候選：${authority.main_berry_pool.join('、')}；`:''}${resolved.berries.length===3?`本週實際：${resolved.berries.join('、')}`:'本 JSON 未提供本週實際三種樹果，套用後可人工 fallback 補足'}`;
  return resolved.berries.join('、')||'未提供';
}
function valueRow(label,current,incoming){
  const before=current??'',after=incoming??'',same=String(before)===String(after);
  return `<tr><th>${esc(label)}</th><td>${esc(before||'—')}</td><td><b>${esc(after||'—')}</b></td><td>${same?'相同':'JSON 將成為 Primary 值'}</td></tr>`;
}
function hidePokemonSpecificConfirmation(active){
  document.querySelectorAll('#updates section,#updates .panel').forEach(node=>{
    if(node.id==='weeklyContextImportInspection')return;
    const text=node.textContent||'';
    const pokemonSpecific=/匯入內容確認/.test(text)&&(/隻玩家資料/.test(text)||/目前可能力/.test(text)||/寶可夢能力/.test(text));
    if(active&&pokemonSpecific){node.hidden=true;node.dataset.hiddenForWeeklyContext='1';}
    else if(!active&&node.dataset.hiddenForWeeklyContext==='1'){node.hidden=false;delete node.dataset.hiddenForWeeklyContext;}
  });
}
function render(){
  const root=ensureRoot();if(!root)return;
  if(!isWeeklyContextPayload(weeklyPayload)){root.classList.add('hidden');hidePokemonSpecificConfirmation(false);return;}
  const validation=fullValidation(),op=validation.operation;
  hidePokemonSpecificConfirmation(true);root.classList.remove('hidden');
  const incoming=normalizeWeeklyContext({...op?.data,context_id:op?.key?.context_id||op?.data?.context_id||null});
  const current=isDatabaseReady()&&!isRescueReadonly()?currentWeeklyContext():{};
  const effects=parseWeeklyEventEffects(op?.data?.event_effects);
  root.dataset.weeklyContractValid=validation.ok?'1':'0';
  root.innerHTML=`<h3>本週營地／活動匯入內容確認</h3>
    <p class="notice success"><b>Authority Chain：</b>更新中心 JSON → ［本週環境］Current Weekly Context → ［戰情室］／［食譜］／策略引擎。套用成功後，JSON 的非空欄位會成為本週 Primary Authority；只有 JSON 未提供的欄位才允許本週環境人工 fallback。</p>
    ${validation.warnings?.length?`<div class="notice"><b>相容正規化：</b><ul>${validation.warnings.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`:''}
    ${validation.ok?`<div class="notice success"><b>Weekly Context JSON Contract：PASS</b><br>context_id：<code>${esc(op?.key?.context_id||'—')}</code> · authority：<code>UPDATE_CENTER_JSON</code></div>`:`<div class="notice warning"><b>Weekly Context JSON Contract 尚未通過，Dry Run／Apply 將被阻擋：</b><ul>${validation.issues.map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul></div>`}
    <div class="table-wrap"><table><thead><tr><th>欄位</th><th>目前［本週環境］</th><th>JSON</th><th>套用後 Authority</th></tr></thead><tbody>
      ${valueRow('週起始日',current.week_start,incoming.week_start)}
      ${valueRow('營地',current.camp,incoming.camp)}
      ${valueRow('料理類型',current.dish_category,incoming.dish_category)}
      ${valueRow('活動名稱',current.event_name,incoming.event_name)}
      ${valueRow('鍋子容量',current.pot_size,incoming.pot_size)}
      ${valueRow('料理最終能量倍率',current.recipe_final_energy_multiplier,effects.recipe_final_energy_multiplier)}
      ${valueRow('週日鍋子倍率',current.sunday_pot_multiplier,effects.sunday_pot_multiplier)}
    </tbody></table></div>
    <p class="notice"><b>營地樹果規則：</b>${esc(berryDescription(incoming))}</p>
    <p class="notice"><b>活動結構：</b>漂亮成功倍率 ${esc(effects.extra_tasty_multiplier??'—')}；週日漂亮成功倍率 ${esc(effects.sunday_extra_tasty_multiplier??'—')}；新料理數 ${esc(effects.new_recipe_count??'—')}；活動期間 ${esc(effects.event_start??'—')} ～ ${esc(effects.event_end??'—')}。</p>`;
}
function blockInvalidWeeklyAction(event){
  const button=event.target.closest?.('#dryRunBtn,#applyBtn');if(!button||!isWeeklyContextPayload(weeklyPayload))return;
  const validation=fullValidation();
  if(validation.ok)return;
  event.preventDefault();event.stopImmediatePropagation();
  alert(`Weekly Context JSON Contract 尚未通過：\n- ${validation.issues.join('\n- ')}`);
}
async function fileChanged(event){
  const file=event.target?.files?.[0];weeklyPayload=null;
  if(file){try{weeklyPayload=JSON.parse(await file.text());}catch{weeklyPayload=null;}}
  setTimeout(render,0);
}
function ensurePasteUi(){
  const input=document.getElementById('jsonFile'),panel=input?.closest?.('.panel');if(!input||!panel||document.getElementById('weeklyJsonPasteTools'))return;
  const tools=document.createElement('details');tools.id='weeklyJsonPasteTools';tools.className='notice';tools.innerHTML=`<summary><b>沒有 .json 附件？直接貼上 AI 回覆</b></summary><p>適用於 ChatGPT／Gemini 只回傳 raw JSON 文字的情況。平台會先用瀏覽器原生 JSON parser 驗證，再轉成暫存 .json 交給既有更新流程；不會繞過 Dry Run。</p><textarea id="weeklyJsonPasteText" rows="10" placeholder="在此貼上完整 JSON；不要包含 Markdown code fence"></textarea><div class="buttons"><button id="weeklyJsonLoadPasteBtn" type="button">載入貼上 JSON</button><button id="weeklyJsonDownloadPasteBtn" type="button">下載成 .json</button></div>`;
  panel.appendChild(tools);
  const textarea=tools.querySelector('#weeklyJsonPasteText');
  function parsedText(){const raw=textarea.value.trim();if(!raw)throw new Error('尚未貼上 JSON');return {raw,payload:JSON.parse(raw)};}
  function filename(payload){const week=payload?.operations?.[0]?.data?.week_start||'current';return `pokemon_sleep_weekly_context_${week}.json`;}
  tools.querySelector('#weeklyJsonLoadPasteBtn').onclick=()=>{
    try{
      const {raw,payload}=parsedText();
      if(typeof DataTransfer==='undefined')throw new Error('此瀏覽器無法直接建立暫存檔；請使用右側「下載成 .json」後再選取該檔案。');
      const file=new File([raw],filename(payload),{type:'application/json'}),transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(error){alert(`貼上 JSON 無法載入：${error.message}`);}
  };
  tools.querySelector('#weeklyJsonDownloadPasteBtn').onclick=()=>{
    try{
      const {payload}=parsedText(),text=JSON.stringify(payload,null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download=filename(payload);anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){alert(`貼上 JSON 無法下載：${error.message}`);}
  };
  const scenario=document.getElementById('promptScenario');
  const sync=()=>{tools.hidden=Boolean(scenario&&scenario.value!=='weekly');};scenario?.addEventListener('change',sync);sync();
}
function install(){
  document.getElementById('jsonFile')?.addEventListener('change',fileChanged);
  document.addEventListener('click',blockInvalidWeeklyAction,true);
  for(const id of ['validateJsonBtn','dryRunBtn','applyBtn'])document.getElementById(id)?.addEventListener('click',()=>setTimeout(render,0));
  document.addEventListener('pokemon-sleep-data-refreshed',()=>setTimeout(render,0));
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>setTimeout(render,0));
  ensurePasteUi();render();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
