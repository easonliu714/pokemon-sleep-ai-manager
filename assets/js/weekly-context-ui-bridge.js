import {run,persist,snapshot,isDatabaseReady,isRescueReadonly} from './database.js';
import {currentWeeklyContext} from './weekly-context-store.js';
import {campBerryAuthority,resolveCampFavoriteBerries} from './public-camp-berry-master.js';
import {saveWeeklyManualOverride,clearWeeklyManualOverride} from './weekly-context-manual-override.js';
import {localWeekStart} from './evaluation-week.js';
import {localIso} from './time-utils.js';
import {validateWeeklyEventEffects} from './weekly-context-normalization.js';
import {WEEKLY_EVENT_EFFECT_REGISTRY_VERSION} from './weekly-event-effect-registry.js';

export const WEEKLY_CONTEXT_UI_BRIDGE_VERSION='weekly-context-ui-bridge-2026-08-10-f';

let syncing=false;
const berryNames=['favorite_berry_1','favorite_berry_2','favorite_berry_3'];
const managedFields=['camp','dish_category','pot_size','favorite_berry_1','favorite_berry_2','favorite_berry_3','event_name','event_effects','base_notes'];
const q=(form,name)=>form?.querySelector(`[name="${CSS.escape(name)}"]`);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
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
function ensureEffectPanel(form){
  let node=form.querySelector('[data-weekly-effect-registry]');
  if(!node){node=document.createElement('section');node.className='notice';node.dataset.weeklyEffectRegistry='1';const authority=ensureAuthorityNotice(form);authority.insertAdjacentElement('afterend',node);}
  return node;
}
function removeFixedHidden(form){form.querySelectorAll('[data-fixed-berry-hidden]').forEach(node=>node.remove());}
function setField(form,name,value){
  const node=q(form,name);if(!node)return;
  const normalized=value??'';
  if(node.tagName==='SELECT'&&normalized!==''&&![...node.options].some(option=>option.value===String(normalized))){const option=document.createElement('option');option.value=String(normalized);option.textContent=String(normalized);node.prepend(option);}
  node.value=normalized;
}
function sourceLabel(source){return source==='UPDATE_CENTER_JSON'?'更新中心 JSON':source==='PUBLIC_CAMP_MASTER'?'公版營地 Master':source==='MANUAL_OVERRIDE'?'人工覆寫':source==='MANUAL_FALLBACK'?'人工補充':'尚未提供';}
function statusLabel(status){return status==='ACTIVE_VERIFIED'?'可供 deterministic 規則使用':status==='FEATURE_ONLY'?'已辨識／目前只供資訊':status==='REVIEW_REQUIRED'?'待覆核／禁止計算':status==='UNSUPPORTED'?'尚未支援':'—';}
function valueText(value){if(value===null||value===undefined)return '—';if(typeof value==='object')return JSON.stringify(value);return String(value);}
function renderEffectRegistry(form,week){
  const node=ensureEffectPanel(form),states=Array.isArray(week.event_effect_states)?week.event_effect_states:[];
  const rowsHtml=states.map(item=>`<tr><td><code>${esc(item.effect_key)}</code></td><td>${esc(valueText(item.value))}</td><td>${esc(item.value_type||'—')}</td><td>${esc(item.scope||'—')}</td><td><b>${esc(item.rule_status||'—')}</b><br><small>${esc(statusLabel(item.rule_status))}</small></td><td>${esc(item.consumer||'—')}</td></tr>`).join('');
  const review=states.filter(item=>item.rule_status==='REVIEW_REQUIRED').length,active=states.filter(item=>item.rule_status==='ACTIVE_VERIFIED').length,feature=states.filter(item=>item.rule_status==='FEATURE_ONLY').length;
  node.className=review?'notice warning':'notice';
  node.innerHTML=`<b>活動效果 Typed Registry：</b><code>${esc(week.event_effect_registry_version||WEEKLY_EVENT_EFFECT_REGISTRY_VERSION)}</code> · ACTIVE_VERIFIED=${active} · FEATURE_ONLY=${feature} · REVIEW_REQUIRED=${review}<br>
    <small>只有 ACTIVE_VERIFIED 效果可進 deterministic consumer；FEATURE_ONLY 只提供資訊；未知活動效果固定進 REVIEW_REQUIRED，不會被當成倍率或機率。</small>
    ${rowsHtml?`<div class="table-wrap"><table><thead><tr><th>Effect</th><th>觀測值</th><th>型別</th><th>範圍</th><th>Rule Status</th><th>Consumer</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`:'<p>本週尚未提供結構化活動效果。</p>'}
    ${week.event_effect_strategy_fingerprint?`<small>Strategy effect fingerprint：<code>${esc(week.event_effect_strategy_fingerprint)}</code></small>`:''}`;
}
function lockAuthorityFields(form,week){
  for(const field of managedFields){
    const node=q(form,field);if(!node)continue;
    const source=week.field_sources?.[field];
    // Update Center JSON is the initial authority, but user-observed weekly facts
    // remain explicitly editable. Only Public Camp Master fixed berries are hard locked.
    node.disabled=source==='PUBLIC_CAMP_MASTER';
    node.dataset.authoritySource=source||'MISSING';
    const label=node.closest('label')?.querySelector('span');
    if(label){const base=label.dataset.baseLabel||label.textContent.replace(/（.*來源.*）$/,'').trim();label.dataset.baseLabel=base;label.textContent=source?`${base}（來源：${sourceLabel(source)}）`:base;}
  }
  const weekStart=q(form,'week_start');if(weekStart){weekStart.disabled=true;weekStart.dataset.authoritySource='CURRENT_WEEK_EPOCH';}
}
function renderAuthorityNotice(form,week){
  const node=ensureAuthorityNotice(form);
  const overrideFields=week.manual_override_fields||[];
  const clear=overrideFields.length?` <button type="button" class="secondary" data-weekly-clear-override>清除本週人工覆寫</button>`:'';
  if(week.authority_source==='MANUAL_OVERRIDE'){
    const fallback=week.manual_fallback_fields?.length?`；fallback：${week.manual_fallback_fields.join('、')}`:'';
    node.className='notice success';
    node.innerHTML=`<b>本週環境 Authority：人工覆寫 ＞ 更新中心 JSON ＞ 人工 fallback。</b> Update ID：<code>${esc(week.authority_update_id||'歷史匯入')}</code>；覆寫欄位：${esc(overrideFields.join('、')||'—')}${esc(fallback)}。覆寫只綁定目前這份 JSON；新的 Weekly JSON 套用後舊覆寫會自動失效。${clear}`;
  }else if(week.authority_source==='UPDATE_CENTER_JSON'){
    const fallback=week.manual_fallback_fields?.length?`；人工 fallback：${week.manual_fallback_fields.join('、')}`:'；目前沒有使用人工 fallback 欄位';
    const stale=week.manual_override_stale?'；偵測到舊人工覆寫，但已因 Weekly JSON revision 改變而自動失效':'';
    node.className='notice success';
    node.innerHTML=`<b>本週環境 Authority：更新中心 JSON 為初始權威來源。</b> Update ID：<code>${esc(week.authority_update_id||'歷史匯入')}</code>${esc(fallback)}${esc(stale)}。此頁可人工修正料理、鍋子、隨機／EX 樹果等本週事實；儲存後只建立明確 MANUAL_OVERRIDE，不修改原始匯入列。戰情室、食譜與策略統一讀取解析後的 Current Weekly Context。`;
  }else if(week.authority_source==='MANUAL_FALLBACK'){
    node.className='notice warning';node.innerHTML='<b>本週尚無已套用的 Weekly Context JSON。</b> 目前使用人工資料作 fallback；一旦更新中心成功套用本週營地／活動 JSON，JSON 非空欄位會成為初始 Authority，之後仍可在此建立明確人工覆寫。';
  }else{
    node.className='notice warning';node.innerHTML='<b>本週環境尚未建立。</b> 建議優先從更新中心匯入「本週營地／料理／活動 Context」JSON；沒有 JSON 時也可以在此人工建立本週資料。';
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
    const source=resolved.locked?'PUBLIC_CAMP_MASTER':(week?.field_sources?.[name]||null);
    select.disabled=resolved.locked;
    select.dataset.berryPolicy=resolved.policy;
    select.dataset.authoritySource=source||'MISSING';
  });
  if(resolved.policy==='FIXED_3'){
    notice.className='notice success';notice.innerHTML=`<b>營地固定喜好樹果：</b>${resolved.berries.join('、')}。由公版 Camp Berry Master 自動帶入並鎖定，不需人工選擇。`;
  }else if(resolved.policy==='WEEKLY_RANDOM_3'){
    notice.className='notice warning';notice.innerHTML=`<b>本營地喜好樹果每週隨機。</b>${resolved.berries.length===3?`目前解析值：${resolved.berries.join('、')}；可依遊戲畫面人工修正。`:'請由本週 Weekly Context JSON 或人工觀測完整提供三種樹果；系統不會沿用上週資料。'}`;
  }else if(resolved.policy==='EX_DYNAMIC'){
    const pool=authority?.main_berry_pool?.length?`主樹果候選池：${authority.main_berry_pool.join('、')}；`:'';
    notice.className='notice warning';notice.innerHTML=`<b>EX 喜好樹果為本週動態條件。</b>${pool}${resolved.berries.length===3?`目前解析值：${resolved.berries.join('、')}；可依遊戲畫面人工修正。`:'請由本週 Weekly Context JSON 或人工觀測完整提供實際三種樹果。'}`;
  }else{notice.className='notice';notice.textContent='尚無此營地的公版喜好樹果規則；請以本週遊戲觀測／Weekly Context JSON 為準。';}
  return resolved;
}
function rawFormState(form){
  const output={};
  for(const field of managedFields){const node=q(form,field);if(node)output[field]=String(node.value??'');}
  return output;
}
function typedValue(field,raw){
  const value=String(raw??'').trim();
  if(field==='pot_size'){
    if(value==='')return null;
    const number=Number(value);if(!Number.isInteger(number)||number<=0)throw new Error('鍋子容量必須是大於 0 的整數');return number;
  }
  return value===''?null:value;
}
function resolvedValue(week,field){
  if(field==='pot_size')return week[field]??null;
  return week[field]??null;
}
function installBaseline(form){form.dataset.weeklyBaseline=JSON.stringify(rawFormState(form));}
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
    renderEffectRegistry(form,week);
    lockAuthorityFields(form,week);
    applyBerryPolicy(form,week.camp||q(form,'camp')?.value||'萌綠之島',week.favorite_berries||[],week);
    form.dataset.weeklyContextId=week.context_id||'';
    form.dataset.weeklyContextStatus=week.context_status||'';
    form.dataset.weekStart=week.week_start||'';
    form.dataset.authoritySource=week.authority_source||'MISSING';
    form.dataset.authorityRevision=week.authority_revision||'';
    installBaseline(form);
    installSubmit(form);
  }finally{syncing=false;}
}
function formBerryObservation(form){return berryNames.map(name=>String(q(form,name)?.value??'').trim()).filter(Boolean);}
function validateManualForm(form){
  const observed=formBerryObservation(form);
  if(observed.length!==0&&observed.length!==3)throw new Error('動態／隨機營地樹果必須完整提供三種');
  if(new Set(observed).size!==observed.length)throw new Error('三個喜好樹果不可重複');
  const effects=String(q(form,'event_effects')?.value??'').trim();if(effects)validateWeeklyEventEffects(effects);
  typedValue('pot_size',q(form,'pot_size')?.value??'');
}
function hasImportedAuthority(current){return Boolean(current.authority_revision)||String(current.authority_context_id||'').endsWith('_import');}
function existingOverrideFields(current){
  const output={};
  for(const field of current.manual_override_fields||[])output[field]=resolvedValue(current,field);
  return output;
}
function changedOverrideFields(form,current){
  let baseline={};try{baseline=JSON.parse(form.dataset.weeklyBaseline||'{}');}catch{}
  const output=existingOverrideFields(current);
  let changed=0;
  for(const field of managedFields){
    const node=q(form,field);if(!node||node.disabled)continue;
    const raw=String(node.value??'');
    if(raw===String(baseline[field]??''))continue;
    output[field]=typedValue(field,raw);changed++;
  }
  return {fields:output,changed};
}
async function saveFallback(form,current){
  const weekStart=current.week_start||localWeekStart();
  const camp=String(q(form,'camp')?.value??'').trim()||null;
  const observed=formBerryObservation(form);
  const resolved=camp?resolveCampFavoriteBerries(camp,observed):{berries:observed};
  const manualEffects=String(q(form,'event_effects')?.value??'').trim()||null;
  const manualId=`weekly_context_${weekStart}_manual`;
  await snapshot('manual:weekly-context-fallback');
  run('INSERT OR REPLACE INTO weekly_context(context_id,week_start,camp,dish_category,favorite_berry_1,favorite_berry_2,favorite_berry_3,event_name,event_effects,pot_size,base_notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[
    manualId,weekStart,camp,typedValue('dish_category',q(form,'dish_category')?.value??''),resolved.berries?.[0]||null,resolved.berries?.[1]||null,resolved.berries?.[2]||null,
    typedValue('event_name',q(form,'event_name')?.value??''),manualEffects,typedValue('pot_size',q(form,'pot_size')?.value??''),typedValue('base_notes',q(form,'base_notes')?.value??''),localIso(),
  ]);
  await persist();
  return {context_id:manualId,week_start:weekStart,authority:'MANUAL_FALLBACK'};
}
function emitChanged(detail){
  document.dispatchEvent(new CustomEvent('pokemon-sleep-data-refreshed',{detail:{entity:'weekly_context',...detail}}));
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'weekly_context',...detail}}));
}
function installSubmit(form){
  if(form.dataset.currentWeekSubmitInstalled==='1')return;
  form.dataset.currentWeekSubmitInstalled='1';
  form.onsubmit=async event=>{
    event.preventDefault();
    try{validateManualForm(form);}catch(error){return alert(`本週環境無法儲存：${error.message}`);}
    const current=currentWeeklyContext(),weekStart=current.week_start||localWeekStart();
    try{
      if(hasImportedAuthority(current)){
        const {fields,changed}=changedOverrideFields(form,current);
        if(!changed)return alert('目前沒有新的人工修改；若要回到 JSON 原值，請使用「清除本週人工覆寫」。');
        await saveWeeklyManualOverride({weekStart,basedOnImportRevision:current.authority_revision,fields});
        emitChanged({context_id:current.authority_context_id,week_start:weekStart,authority:'MANUAL_OVERRIDE'});
        syncForm();alert('本週人工覆寫已儲存；戰情室／食譜會使用覆寫後的 Current Weekly Context。新的 Weekly JSON 匯入後，此覆寫會自動失效。');
      }else{
        const detail=await saveFallback(form,current);emitChanged(detail);syncForm();alert('本週人工 fallback 已儲存並同步至戰情室／食譜。');
      }
    }catch(error){alert(`本週環境儲存失敗：${error.message}`);}
  };
}
async function clearOverrideClick(event){
  const button=event.target.closest?.('[data-weekly-clear-override]');if(!button)return;
  const form=button.closest('#weeklyContextForm');if(!form)return;
  const current=currentWeeklyContext(),weekStart=current.week_start||localWeekStart();
  if(!confirm('清除本週人工覆寫，回到目前 Weekly JSON／fallback 的解析值？'))return;
  try{
    const cleared=await clearWeeklyManualOverride(weekStart);
    if(cleared)emitChanged({context_id:current.authority_context_id,week_start:weekStart,authority:'MANUAL_OVERRIDE_CLEARED'});
    syncForm();alert(cleared?'本週人工覆寫已清除。':'目前沒有人工覆寫。');
  }catch(error){alert(`清除人工覆寫失敗：${error.message}`);}
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
  document.addEventListener('click',clearOverrideClick,true);
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="weekly"]'))schedule();},true);
  document.addEventListener('pokemon-sleep-data-refreshed',schedule);
  globalThis.addEventListener?.('pokemon-sleep:database-ready',schedule);
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(event.detail?.entity==='weekly_context')schedule();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
}
install();
