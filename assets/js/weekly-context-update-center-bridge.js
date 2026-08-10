import {currentWeeklyContext} from './weekly-context-store.js';
import {normalizeWeeklyContext,parseWeeklyEventEffects,validateWeeklyEventEffects} from './weekly-context-normalization.js';
import {resolveCampFavoriteBerries,campBerryAuthority} from './public-camp-berry-master.js';
import {isDatabaseReady,isRescueReadonly} from './database.js';
import {localWeekStart} from './evaluation-week.js';

export const WEEKLY_CONTEXT_UPDATE_BRIDGE_VERSION='weekly-context-update-bridge-2026-08-10-d';

let weeklyPayload=null;
const EVENT_KEYS=new Set(['recipe_final_energy_multiplier','extra_tasty_multiplier','sunday_extra_tasty_multiplier','sunday_pot_multiplier','new_recipe_count','event_start','event_end']);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const iso=value=>{try{return Boolean(value)&&Number.isFinite(new Date(value).getTime());}catch{return false;}};
const dateKey=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
function isWeeklyPayload(payload){
  if(payload?.scenario==='weekly_context_update')return true;
  const operations=Array.isArray(payload?.operations)?payload.operations:[];
  return operations.length>0&&operations.some(op=>op?.entity==='weekly_context');
}
function weeklyOperation(payload){
  const operations=Array.isArray(payload?.operations)?payload.operations:[];
  return operations.find(op=>op?.entity==='weekly_context')||operations[0]||null;
}
function weeklyContractIssues(payload,op){
  const issues=[];
  if(payload?.scenario!=='weekly_context_update')issues.push('scenario 必須為 weekly_context_update');
  if(payload?.context_authority!=='UPDATE_CENTER_JSON')issues.push('context_authority 必須為 UPDATE_CENTER_JSON');
  if(!Array.isArray(payload?.operations)||payload.operations.length!==1)issues.push('operations 必須只有 1 筆 weekly_context upsert');
  if(!op){issues.push('缺少 weekly_context operation');return issues;}
  const data=op.data||{},weekStart=String(data.week_start||'').trim(),berries=['favorite_berry_1','favorite_berry_2','favorite_berry_3'].map(key=>data[key]).filter(value=>value!==null&&value!==undefined&&String(value).trim()!=='').map(String);
  if(op.entity!=='weekly_context'||op.action!=='upsert')issues.push('operation 必須為 entity=weekly_context、action=upsert');
  if(!dateKey(weekStart))issues.push('data.week_start 必須為當週星期一 YYYY-MM-DD');
  else{
    const parsed=new Date(`${weekStart}T12:00:00`);
    if(localWeekStart(parsed)!==weekStart)issues.push('data.week_start 必須是星期一');
    const currentEpoch=localWeekStart(new Date());
    if(weekStart!==currentEpoch)issues.push(`此匯入只接受目前週期 ${currentEpoch}；不可使用上週／未來週 JSON`);
  }
  if(weekStart&&String(op.key?.context_id||'')!==`weekly_context_${weekStart}_import`)issues.push(`key.context_id 必須為 weekly_context_${weekStart}_import`);
  if(!iso(payload?.generated_at))issues.push('generated_at 必須為有效 ISO 日期時間');
  if(!iso(data.updated_at))issues.push('data.updated_at 必須為有效 ISO 日期時間');
  if(data.event_effects!==null&&data.event_effects!==undefined&&typeof data.event_effects!=='string')issues.push('event_effects 必須是 JSON 字串，不可直接放 object');
  if(typeof data.event_effects==='string'){
    let parsed=null;
    try{parsed=JSON.parse(data.event_effects||'{}');}catch{issues.push('event_effects 不是有效 JSON 字串');}
    if(parsed!==null){
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))issues.push('event_effects JSON 字串內容必須是 object');
      else{
        for(const key of Object.keys(parsed))if(!EVENT_KEYS.has(key))issues.push(`event_effects 不支援欄位：${key}`);
        try{validateWeeklyEventEffects(data.event_effects);}catch(error){issues.push(error?.message||String(error));}
        for(const key of ['event_start','event_end'])if(parsed[key]!=null&&parsed[key]!==''&&!dateKey(parsed[key]))issues.push(`event_effects.${key} 必須為 YYYY-MM-DD`);
      }
    }
  }
  if(berries.length!==0&&berries.length!==3)issues.push('動態／隨機營地的 favorite_berry_1~3 必須全部三欄一起提供，或全部省略');
  if(new Set(berries).size!==berries.length)issues.push('favorite_berry_1~3 不可重複');
  return [...new Set(issues)];
}
function ensureRoot(){
  const updates=document.getElementById('updates');if(!updates)return null;
  let root=document.getElementById('weeklyContextImportInspection');if(root)return root;
  root=document.createElement('section');root.id='weeklyContextImportInspection';root.className='panel hidden';
  const workflow=document.getElementById('workflowIssues')||document.getElementById('workflowSummary');workflow?.insertAdjacentElement('afterend',root);
  return root;
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
  if(!isWeeklyPayload(weeklyPayload)){root.classList.add('hidden');hidePokemonSpecificConfirmation(false);return;}
  const op=weeklyOperation(weeklyPayload),issues=weeklyContractIssues(weeklyPayload,op);
  hidePokemonSpecificConfirmation(true);root.classList.remove('hidden');
  const incoming=normalizeWeeklyContext({...op?.data,context_id:op?.key?.context_id||op?.data?.context_id||null});
  const current=isDatabaseReady()&&!isRescueReadonly()?currentWeeklyContext():{};
  const effects=parseWeeklyEventEffects(op?.data?.event_effects);
  root.dataset.weeklyContractValid=issues.length?'0':'1';
  root.innerHTML=`<h3>本週營地／活動匯入內容確認</h3>
    <p class="notice success"><b>Authority Chain：</b>更新中心 JSON → ［本週環境］Current Weekly Context → ［戰情室］／［食譜］／策略引擎。套用成功後，JSON 的非空欄位會成為本週 Primary Authority；只有 JSON 未提供的欄位才允許本週環境人工 fallback。</p>
    ${issues.length?`<div class="notice warning"><b>Weekly Context JSON Contract 尚未通過，Dry Run／Apply 將被阻擋：</b><ul>${issues.map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul></div>`:`<div class="notice success"><b>Weekly Context JSON Contract：PASS</b><br>context_id：<code>${esc(op?.key?.context_id||'—')}</code> · authority：<code>UPDATE_CENTER_JSON</code></div>`}
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
  const button=event.target.closest?.('#dryRunBtn,#applyBtn');if(!button||!isWeeklyPayload(weeklyPayload))return;
  const issues=weeklyContractIssues(weeklyPayload,weeklyOperation(weeklyPayload));
  if(!issues.length)return;
  event.preventDefault();event.stopImmediatePropagation();
  alert(`Weekly Context JSON Contract 尚未通過：\n- ${issues.join('\n- ')}`);
}
async function fileChanged(event){
  const file=event.target?.files?.[0];weeklyPayload=null;
  if(file){try{weeklyPayload=JSON.parse(await file.text());}catch{weeklyPayload=null;}}
  setTimeout(render,0);
}
function install(){
  document.getElementById('jsonFile')?.addEventListener('change',fileChanged);
  document.addEventListener('click',blockInvalidWeeklyAction,true);
  for(const id of ['validateJsonBtn','dryRunBtn','applyBtn'])document.getElementById(id)?.addEventListener('click',()=>setTimeout(render,0));
  document.addEventListener('pokemon-sleep-data-refreshed',()=>setTimeout(render,0));
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>setTimeout(render,0));
  render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
