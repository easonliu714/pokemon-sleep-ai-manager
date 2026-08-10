import {currentWeeklyContext} from './weekly-context-store.js';
import {normalizeWeeklyContext} from './weekly-context-normalization.js';
import {resolveCampFavoriteBerries,campBerryAuthority} from './public-camp-berry-master.js';
import {isDatabaseReady,isRescueReadonly} from './database.js';

export const WEEKLY_CONTEXT_UPDATE_BRIDGE_VERSION='weekly-context-update-bridge-2026-08-10-a';

let weeklyPayload=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function weeklyOperation(payload){
  if(payload?.scenario==='weekly_context_update')return (payload.operations||[]).find(op=>op.entity==='weekly_context')||null;
  const operations=Array.isArray(payload?.operations)?payload.operations:[];
  return operations.length>0&&operations.every(op=>op.entity==='weekly_context')?operations[0]:null;
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
  if(resolved.policy==='FIXED_3')return `公版固定：${resolved.berries.join('、')}（匯入後由營地 Master 自動投影）`;
  if(resolved.policy==='WEEKLY_RANDOM_3')return resolved.berries.length===3?`玩家本週觀測：${resolved.berries.join('、')}`:'每週隨機；本 JSON 尚未提供三種實際樹果';
  if(resolved.policy==='EX_DYNAMIC')return `${authority?.main_berry_pool?.length?`EX 主候選：${authority.main_berry_pool.join('、')}；`:''}${resolved.berries.length===3?`本週實際：${resolved.berries.join('、')}`:'本 JSON 尚未提供本週實際三種樹果'}`;
  return resolved.berries.join('、')||'未提供';
}
function valueRow(label,current,incoming){
  const before=current??'',after=incoming??'',same=String(before)===String(after);
  return `<tr><th>${esc(label)}</th><td>${esc(before||'—')}</td><td><b>${esc(after||'—')}</b></td><td>${same?'相同':'將更新／建立'}</td></tr>`;
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
  const op=weeklyOperation(weeklyPayload);
  if(!op){root.classList.add('hidden');hidePokemonSpecificConfirmation(false);return;}
  hidePokemonSpecificConfirmation(true);root.classList.remove('hidden');
  const incoming=normalizeWeeklyContext({...op.data,context_id:op.key?.context_id||op.data?.context_id||null});
  const current=isDatabaseReady()&&!isRescueReadonly()?currentWeeklyContext():{};
  const effects=incoming.event_effects_parsed||{};
  root.innerHTML=`<h3>本週營地／活動匯入內容確認</h3>
    <p class="notice">此 JSON 是 <b>weekly_context</b> 玩家本週資料，不是寶可夢個體更新。下表直接核對目前 SQLite 與即將套用的本週 Context。</p>
    <div class="table-wrap"><table><thead><tr><th>欄位</th><th>目前本週</th><th>JSON</th><th>判定</th></tr></thead><tbody>
      ${valueRow('週起始日',current.week_start,incoming.week_start)}
      ${valueRow('營地',current.camp,incoming.camp)}
      ${valueRow('料理類型',current.dish_category,incoming.dish_category)}
      ${valueRow('活動名稱',current.event_name,incoming.event_name)}
      ${valueRow('鍋子容量',current.pot_size,incoming.pot_size)}
      ${valueRow('料理最終能量倍率',current.recipe_final_energy_multiplier,effects.recipe_final_energy_multiplier)}
      ${valueRow('週日鍋子倍率',current.sunday_pot_multiplier,effects.sunday_pot_multiplier)}
    </tbody></table></div>
    <p class="notice"><b>營地樹果規則：</b>${esc(berryDescription(incoming))}</p>
    <p class="notice"><b>活動結構：</b>漂亮成功倍率 ${esc(effects.extra_tasty_multiplier??'—')}；週日漂亮成功倍率 ${esc(effects.sunday_extra_tasty_multiplier??'—')}；新料理數 ${esc(effects.new_recipe_count??'—')}。</p>`;
}
async function fileChanged(event){
  const file=event.target?.files?.[0];weeklyPayload=null;
  if(file){try{weeklyPayload=JSON.parse(await file.text());}catch{weeklyPayload=null;}}
  setTimeout(render,0);
}
function install(){
  document.getElementById('jsonFile')?.addEventListener('change',fileChanged);
  for(const id of ['validateJsonBtn','dryRunBtn','applyBtn'])document.getElementById(id)?.addEventListener('click',()=>setTimeout(render,0));
  document.addEventListener('pokemon-sleep-data-refreshed',()=>setTimeout(render,0));
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>setTimeout(render,0));
  render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
