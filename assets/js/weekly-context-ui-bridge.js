import {run,persist,snapshot,isDatabaseReady,isRescueReadonly} from './database.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {campBerryAuthority,resolveCampFavoriteBerries} from './public-camp-berry-master.js';
import {localWeekStart} from './evaluation-week.js';
import {localIso} from './time-utils.js';

export const WEEKLY_CONTEXT_UI_BRIDGE_VERSION='weekly-context-ui-bridge-2026-08-10-d';

let syncing=false;
const berryNames=['favorite_berry_1','favorite_berry_2','favorite_berry_3'];
const managedFields=['camp','dish_category','pot_size','favorite_berry_1','favorite_berry_2','favorite_berry_3','event_name','event_effects','base_notes'];
const q=(form,name)=>form?.querySelector(`[name="${CSS.escape(name)}"]`);
function ensureNotice(form){
  let node=form.querySelector('[data-weekly-berry-policy]');
  if(!node){node=document.createElement('div');node.className='notice';node.dataset.weeklyBerryPolicy='1';const first=q(form,'favorite_berry_1')?.closest('label');first?.parentElement?.insertBefore(node,first);}
  return node;
}
function ensureAuthorityNotice(form){
  let node=form.querySelector('[data-weekly-authority]');
  if(!node){node=document.createElement('div');node.className='notice';node.dataset.weeklyAuthority='1';form.prepend(node);}
  return node;
}
function removeFixedHidden(form){form.querySelectorAll('[data-fixed-berry-hidden]').forEach(node=>node.remove());}
function setField(form,name,value){
  const node=q(form,name);if(!node)return;
  const normalized=value??'';
  if(node.tagName==='SELECT'&&normalized!==''&&![...node.options].some(option=>option.value===String(normalized))){const option=document.createElement('option');option.value=String(normalized);option.textContent=String(normalized);node.prepend(option);}
  node.value=normalized;
}
function sourceLabel(source){return source==='UPDATE_CENTER_JSON'?'更新中心 JSON':source==='PUBLIC_CAMP_MASTER'?'公版營地 Master':source==='MANUAL_FALLBACK'?'人工補充':'尚未提供';}
function lockAuthorityFields(form,week){
  for(const field of managedFields){
    const node=q(form,field);if(!node)continue;
    const source=week.field_sources?.[field];
    const primary=source==='UPDATE_CENTER_JSON'||source==='PUBLIC_CAMP_MASTER';
    node.disabled=primary;
    node.dataset.authoritySource=source||'MISSING';
    const label=node.closest('label')?.querySelector('span');
    if(label){const base=label.dataset.baseLabel||label.textContent.replace(/（.*來源.*）$/,'').trim();label.dataset.baseLabel=base;label.textContent=source?`${base}（來源：${sourceLabel(source)}）`:base;}
  }
  const weekStart=q(form,'week_start');if(weekStart){weekStart.disabled=true;weekStart.dataset.authoritySource='CURRENT_WEEK_EPOCH';}
}
function renderAuthorityNotice(form,week){
  const node=ensureAuthorityNotice(form);
  if(week.authority_source==='UPDATE_CENTER_JSON'){
    const fallback=week.manual_fallback_fields?.length?`；人工僅補足：${week.manual_fallback_fields.join('、')}`:'；目前沒有使用人工 fallback 欄位';
    node.className='notice success';
    node.innerHTML=`<b>本週環境 Authority：更新中心 JSON 優先。</b> Update ID：<code>${week.authority_update_id||'歷史匯入'}</code>${fallback}。戰情室、食譜與策略計算只讀此頁解析後的 Current Weekly Context。若要修正已由 JSON 提供的欄位，請重新匯入新的本週營地／活動 JSON。`;
  }else if(week.authority_source==='MANUAL_FALLBACK'){
    node.className='notice warning';node.innerHTML='<b>本週尚無已套用的 Weekly Context JSON。</b> 目前使用人工資料作 fallback；一旦更新中心成功套用本週營地／活動 JSON，JSON 非空欄位會自動成為 Primary Authority。';
  }else{
    node.className='notice warning';node.innerHTML='<b>本週環境尚未建立。</b> 建議優先從更新中心匯入「本週營地／料理／活動 Context」JSON；沒有 JSON 時才在此人工補充。';
  }
}
function applyBerryPolicy(form,camp,observed=[],week=null){
  const resolved=resolveCampFavoriteBerries(camp,observed);
  const authority=campBerryAuthority(camp);
  const notice=ensureNotice(form);removeFixedHidden(form);
  berryNames.forEach((name,index)=>{
    const select=q(form,name);if(!select)return;
    const value=resolved.berries[index]||'';
    select.value=value;
    const source=week?.field_sources?.[name]||(resolved.locked?'PUBLIC_CAMP_MASTER':null);
    select.disabled=resolved.locked||source==='UPDATE_CENTER_JSON';
    select.dataset.berryPolicy=resolved.policy;
    select.dataset.authoritySource=source||'MISSING';
  });
  if(resolved.policy==='FIXED_3'){
    notice.className='notice success';notice.innerHTML=`<b>營地固定喜好樹果：</b>${resolved.berries.join('、')}。由公版 Camp Berry Master 自動帶入並鎖定，不需人工選擇。`;
  }else if(resolved.policy==='WEEKLY_RANDOM_3'){
    notice.className='notice warning';notice.innerHTML=`<b>本營地喜好樹果每週隨機。</b>${resolved.berries.length===3?`目前本週觀測：${resolved.berries.join('、')}。`:'請優先由本週 Weekly Context JSON 提供；若 JSON 未提供，才可人工補三種樹果。系統不會沿用上週資料。'}`;
  }else if(resolved.policy==='EX_DYNAMIC'){
    const pool=authority?.main_berry_pool?.length?`主樹果候選池：${authority.main_berry_pool.join('、')}；`:'';
    notice.className='notice warning';notice.innerHTML=`<b>EX 喜好樹果為本週動態條件。</b>${pool}${resolved.berries.length===3?`目前本週觀測：${resolved.berries.join('、')}。`:'請優先由本週 Weekly Context JSON 提供實際三種樹果；JSON 未提供時才人工補充。'}`;
  }else{notice.className='notice';notice.textContent='尚無此營地的公版喜好樹果規則；請以本週遊戲觀測／Weekly Context JSON 為準。';}
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
    berryNames.forEach(name=>setField(form,name,week[name]||''));
    renderAuthorityNotice(form,week);
    lockAuthorityFields(form,week);
    applyBerryPolicy(form,week.camp||q(form,'camp')?.value||'萌綠之島',week.favorite_berries||[],week);
    form.dataset.weeklyContextId=week.context_id||'';
    form.dataset.weeklyContextStatus=week.context_status||'';
    form.dataset.weekStart=week.week_start||'';
    form.dataset.authoritySource=week.authority_source||'MISSING';
    installSubmit(form);
  }finally{syncing=false;}
}
function editableValue(form,name){const node=q(form,name);return node&&!node.disabled?String(node.value??''):null;}
function installSubmit(form){
  if(form.dataset.currentWeekSubmitInstalled==='1')return;
  form.dataset.currentWeekSubmitInstalled='1';
  form.onsubmit=async event=>{
    event.preventDefault();
    const current=currentWeeklyContext(),weekStart=current.week_start||localWeekStart();
    const camp=editableValue(form,'camp');
    const manualCamp=camp===null?null:camp;
    const berryValues=berryNames.map(name=>editableValue(form,name));
    const observed=berryValues.filter(value=>value!==null&&value!=='');
    if(observed.length!==0&&observed.length!==3)return alert('人工補充動態／隨機營地樹果時，必須完整提供三種。');
    if(new Set(observed).size!==observed.length)return alert('三個喜好樹果不可重複');
    const manualId=`weekly_context_${weekStart}_manual`;
    const resolved=manualCamp?resolveCampFavoriteBerries(manualCamp,observed):{berries:observed};
    await snapshot('manual:weekly-context-fallback');
    run('INSERT OR REPLACE INTO weekly_context(context_id,week_start,camp,dish_category,favorite_berry_1,favorite_berry_2,favorite_berry_3,event_name,event_effects,pot_size,base_notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[
      manualId,weekStart,manualCamp,editableValue(form,'dish_category'),resolved.berries?.[0]||null,resolved.berries?.[1]||null,resolved.berries?.[2]||null,
      editableValue(form,'event_name'),editableValue(form,'event_effects'),(()=>{const value=editableValue(form,'pot_size');return value===null||value===''?null:Number(value)||null;})(),editableValue(form,'base_notes'),localIso(),
    ]);
    await persist();
    document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed',{detail:{entity:'weekly_context',context_id:manualId,week_start:weekStart,authority:'MANUAL_FALLBACK'}}));
    globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'weekly_context',context_id:manualId,week_start:weekStart,authority:'MANUAL_FALLBACK'}}));
    syncForm();alert(current.authority_source==='UPDATE_CENTER_JSON'?'人工 fallback 已儲存；JSON 已提供的欄位仍保持優先，不會被覆蓋。':'本週人工 fallback 已儲存並同步至戰情室／食譜。');
  };
}
function campChanged(event){
  const select=event.target.closest?.('#weeklyContextForm [name="camp"]');if(!select||select.disabled)return;
  const form=select.form;if(!form)return;
  const authority=campBerryAuthority(select.value);
  const observed=authority?.berry_policy==='FIXED_3'?authority.favorite_berries:[];
  applyBerryPolicy(form,select.value,observed,currentWeeklyContext());
}
function schedule(){setTimeout(syncForm,0);}
function install(){
  document.addEventListener('change',campChanged,true);
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="weekly"]'))schedule();},true);
  document.addEventListener('pokemon-sleep-data-refreshed',schedule);
  globalThis.addEventListener?.('pokemon-sleep:database-ready',schedule);
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(event.detail?.entity==='weekly_context')schedule();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
}
install();
