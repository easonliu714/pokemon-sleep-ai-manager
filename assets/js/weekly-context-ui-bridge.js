import {run,persist,snapshot,isDatabaseReady,isRescueReadonly} from './database.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {campBerryAuthority,resolveCampFavoriteBerries} from './public-camp-berry-master.js';
import {localWeekStart} from './evaluation-week.js';
import {localIso} from './time-utils.js';

export const WEEKLY_CONTEXT_UI_BRIDGE_VERSION='weekly-context-ui-bridge-2026-08-10-a';

let syncing=false;
const names=['favorite_berry_1','favorite_berry_2','favorite_berry_3'];
const q=(form,name)=>form?.querySelector(`[name="${CSS.escape(name)}"]`);
function ensureNotice(form){
  let node=form.querySelector('[data-weekly-berry-policy]');
  if(!node){node=document.createElement('div');node.className='notice';node.dataset.weeklyBerryPolicy='1';const first=q(form,'favorite_berry_1')?.closest('label');first?.parentElement?.insertBefore(node,first);}
  return node;
}
function removeFixedHidden(form){form.querySelectorAll('[data-fixed-berry-hidden]').forEach(node=>node.remove());}
function setField(form,name,value){const node=q(form,name);if(node)node.value=value??'';}
function applyBerryPolicy(form,camp,observed=[]){
  const resolved=resolveCampFavoriteBerries(camp,observed);
  const authority=campBerryAuthority(camp);
  const notice=ensureNotice(form);removeFixedHidden(form);
  names.forEach((name,index)=>{
    const select=q(form,name);if(!select)return;
    const value=resolved.berries[index]||'';
    select.value=value;
    select.disabled=resolved.locked;
    select.dataset.berryPolicy=resolved.policy;
    if(resolved.locked){const hidden=document.createElement('input');hidden.type='hidden';hidden.name=name;hidden.value=value;hidden.dataset.fixedBerryHidden='1';select.insertAdjacentElement('afterend',hidden);}
  });
  if(resolved.policy==='FIXED_3'){
    notice.className='notice success';notice.innerHTML=`<b>營地固定喜好樹果：</b>${resolved.berries.join('、')}。由公版 Camp Berry Master 自動帶入並鎖定，不需人工選擇。`;
  }else if(resolved.policy==='WEEKLY_RANDOM_3'){
    notice.className='notice warning';notice.innerHTML=`<b>本營地喜好樹果每週隨機。</b>${resolved.berries.length===3?`目前本週觀測：${resolved.berries.join('、')}。`:'請由本週遊戲畫面／Weekly Context JSON 提供三種樹果；系統不會沿用上週資料。'}`;
  }else if(resolved.policy==='EX_DYNAMIC'){
    const pool=authority?.main_berry_pool?.length?`主樹果候選池：${authority.main_berry_pool.join('、')}；`:'';
    notice.className='notice warning';notice.innerHTML=`<b>EX 喜好樹果為本週動態條件。</b>${pool}${resolved.berries.length===3?`目前本週觀測：${resolved.berries.join('、')}。`:'請由本週遊戲畫面／Weekly Context JSON 提供實際三種樹果。'}`;
  }else{notice.className='notice';notice.textContent='尚無此營地的公版喜好樹果規則；請以本週遊戲觀測為準。';}
  return resolved;
}
function syncForm(){
  if(syncing||!isDatabaseReady()||isRescueReadonly())return;
  const form=document.getElementById('weeklyContextForm');if(!form)return;
  syncing=true;
  try{
    const week=currentWeeklyContext();
    setField(form,'week_start',week.week_start||localWeekStart());
    setField(form,'camp',week.camp||'萌綠之島');
    setField(form,'dish_category',week.dish_category||'');
    setField(form,'pot_size',week.pot_size??'');
    setField(form,'event_name',week.event_name||'');
    setField(form,'event_effects',week.event_effects||'');
    setField(form,'base_notes',week.base_notes||'');
    applyBerryPolicy(form,week.camp||q(form,'camp')?.value||'萌綠之島',week.favorite_berries||[]);
    form.dataset.weeklyContextId=week.context_id||'';
    form.dataset.weeklyContextStatus=week.context_status||'';
    form.dataset.weekStart=week.week_start||'';
    installSubmit(form);
  }finally{syncing=false;}
}
function installSubmit(form){
  if(form.dataset.currentWeekSubmitInstalled==='1')return;
  form.dataset.currentWeekSubmitInstalled='1';
  form.onsubmit=async event=>{
    event.preventDefault();
    const data=new FormData(form),weekStart=String(data.get('week_start')||localWeekStart()),camp=String(data.get('camp')||'');
    const observed=names.map(name=>String(data.get(name)||'')).filter(Boolean);
    const resolved=resolveCampFavoriteBerries(camp,observed);
    if(!resolved.locked&&resolved.berries.length!==0&&resolved.berries.length!==3)return alert('動態／隨機營地的喜好樹果若填寫，必須完整提供三種。');
    if(new Set(resolved.berries).size!==resolved.berries.length)return alert('三個喜好樹果不可重複');
    const existing=currentWeeklyContext();
    const id=existing.context_status==='CURRENT_WEEK_READY'&&existing.week_start===weekStart&&existing.context_id?existing.context_id:`week_${weekStart}`;
    await snapshot('manual:weekly-context-current-week');
    run('INSERT OR REPLACE INTO weekly_context(context_id,week_start,camp,dish_category,favorite_berry_1,favorite_berry_2,favorite_berry_3,event_name,event_effects,pot_size,base_notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[
      id,weekStart,camp,String(data.get('dish_category')||''),resolved.berries[0]||'',resolved.berries[1]||'',resolved.berries[2]||'',
      String(data.get('event_name')||''),String(data.get('event_effects')||''),Number(data.get('pot_size'))||null,String(data.get('base_notes')||''),localIso(),
    ]);
    await persist();
    document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed',{detail:{entity:'weekly_context',context_id:id,week_start:weekStart}}));
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'weekly_context',context_id:id,week_start:weekStart}}));
    syncForm();alert('本週環境已儲存並同步至戰情室');
  };
}
function campChanged(event){
  const select=event.target.closest?.('#weeklyContextForm [name="camp"]');if(!select)return;
  const form=select.form;if(!form)return;
  const authority=campBerryAuthority(select.value);
  // Camp switch must never carry stale fixed berries into random/EX contexts.
  const observed=authority?.berry_policy==='FIXED_3'?authority.favorite_berries:[];
  applyBerryPolicy(form,select.value,observed);
}
function schedule(){queueMicrotask(syncForm);}
function install(){
  document.addEventListener('change',campChanged,true);
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="weekly"]'))setTimeout(syncForm,0);},true);
  document.addEventListener('pokemon-sleep-data-refreshed',()=>setTimeout(syncForm,0));
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>setTimeout(syncForm,0));
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(event.detail?.entity==='weekly_context')setTimeout(syncForm,0);});
  const observer=new MutationObserver(()=>{if(document.getElementById('weeklyContextForm'))schedule();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
}
install();
