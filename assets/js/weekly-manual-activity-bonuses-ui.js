import {currentWeeklyContext} from './weekly-context-store.js';
import {currentEffectiveWeeklyContext} from './effective-weekly-context.js';
import {readWeeklyManualActivityBonus,saveWeeklyManualActivityBonus} from './weekly-manual-activity-bonuses.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields=[
 ['pot_multiplier','活動鍋子容量加成（倍）','例：2','僅用於本週料理鍋子可用容量，不修改帳號基礎鍋子。'],
 ['sleep_exp_multiplier','睡眠經驗 EXP 加成（倍）','例：1.5','僅紀錄及顯示；尚未納入未驗證的經驗估算。'],
 ['candy_use_exp_multiplier','使用糖果獲得 EXP 加成（倍）','例：2','不是寶可夢糖果掉落數加倍；僅紀錄及顯示。'],
 ['observed_pot_capacity','遊戲實際顯示的活動後鍋子容量（選填）','例：95','若倍率乘上基礎容量出現小數，請以遊戲實際顯示的整數容量為準。'],
];
function render(){
  const form=document.getElementById('weeklyContextForm');if(!form)return;
  const week=currentWeeklyContext(),weekStart=week?.week_start||'';
  if(!weekStart)return;
  let panel=form.querySelector('[data-weekly-manual-activity-bonuses]');
  if(panel?.dataset.weekStart===weekStart)return;
  if(!panel){panel=document.createElement('fieldset');panel.dataset.weeklyManualActivityBonuses='';form.appendChild(panel);}
  panel.dataset.weekStart=weekStart;
  const existing=readWeeklyManualActivityBonus(weekStart);
  const values=existing?.values||{};
  const projection=currentEffectiveWeeklyContext().manual_activity_bonus;
  panel.innerHTML=`<legend><b>本週活動加成（玩家手動觀測）</b></legend>
    <p class="notice">週期：${esc(weekStart)}。活動說明由 AI 解析時可能不穩定，因此這裡由你明確輸入；不修改 Public Event Master，也不會沿用上週數字。留空表示未知，不是預設活動倍率 1。</p>
    <div class="form-grid">${fields.map(([key,label,placeholder,description])=>`<label style="display:block;min-width:0;margin:8px 0"><span>${esc(label)}</span>
      <input type="number" step="${key==='observed_pot_capacity'?'1':'any'}" min="1" max="${key==='observed_pot_capacity'?'10000':'10'}" placeholder="${esc(placeholder)}" data-bonus-key="${esc(key)}" value="${esc(values[key]??'')}" style="width:100%">
      <small class="notice">${esc(description)}</small></label>`).join('')}</div>
    <button type="button" data-save-manual-activity-bonus>儲存本週活動加成</button>
    <p class="notice" data-manual-activity-bonus-status>本週鍋子：基礎 ${esc(projection?.base_pot_capacity??'未確認')} → 使用 ${esc(projection?.effective_pot_capacity??'未確認')}；狀態 ${esc(projection?.pot_capacity_status||'NOT_SET')}。睡眠／糖果使用 EXP 只顯示，不參與尚未驗證的計算。</p>`;
  panel.querySelector('[data-save-manual-activity-bonus]').addEventListener('click',async event=>{
    const button=event.currentTarget;
    if(currentWeeklyContext().week_start!==weekStart){panel.dataset.weekStart='';render();alert('本週資料已切換，請重新檢查活動加成。');return;}
    const input={};
    for(const field of fields){const key=field[0];input[key]=panel.querySelector(`[data-bonus-key="${key}"]`)?.value?.trim()||null;}
    button.disabled=true;
    try{
      await saveWeeklyManualActivityBonus({weekStart,values:input});
      panel.dataset.weekStart='';
      globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'weekly_context',source:'player-manual-activity-bonus',week_start:weekStart}}));
      render();
    }catch(error){alert(`本週活動加成無法儲存：${error?.message||error}`);}
    finally{button.disabled=false;}
  });
}
function boot(){
  render();
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="weekly"]'))queueMicrotask(render);},true);
  document.addEventListener('pokemon-sleep-data-refreshed',()=>queueMicrotask(render));
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(event.detail?.entity==='weekly_context')queueMicrotask(render);});
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>queueMicrotask(render));
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
