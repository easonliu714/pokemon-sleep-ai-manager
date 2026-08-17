import {isDatabaseReady,isRescueReadonly} from './database.js';
import {currentEffectiveWeeklyContext} from './effective-weekly-context.js';

export const PUBLIC_EVENT_AUTHORITY_UI_GUARD_VERSION='public-event-authority-ui-guard-2026-08-17-a';

let applying=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const q=(form,name)=>form?.querySelector(`[name="${CSS.escape(name)}"]`);

function ensurePanel(form){
  let panel=form.querySelector('[data-public-event-authority]');
  if(!panel){
    panel=document.createElement('section');
    panel.dataset.publicEventAuthority='1';
    panel.className='notice';
    const legacyRegistry=form.querySelector('[data-weekly-effect-registry]');
    const authority=form.querySelector('[data-weekly-authority]');
    (legacyRegistry||authority)?.insertAdjacentElement('afterend',panel);
    if(!panel.isConnected)form.prepend(panel);
  }
  return panel;
}
function lockLegacyEventObservation(form){
  for(const name of ['event_name','event_effects']){
    const node=q(form,name);if(!node)continue;
    node.disabled=true;
    node.dataset.authoritySource='LEGACY_PLAYER_OBSERVATION_AUDIT_ONLY';
    const label=node.closest('label');
    if(label){label.hidden=true;label.dataset.legacyPlayerEventObservation='1';}
  }
  const legacyRegistry=form.querySelector('[data-weekly-effect-registry]');
  if(legacyRegistry){legacyRegistry.hidden=true;legacyRegistry.dataset.legacyPlayerEventRegistry='1';}
}
function renderPanel(form,effective){
  const panel=ensurePanel(form);
  const events=Array.isArray(effective.public_event_active_events)?effective.public_event_active_events:[];
  const states=Array.isArray(effective.event_effect_states)?effective.event_effect_states:[];
  const review=states.filter(row=>row.rule_status==='REVIEW_REQUIRED').length;
  const partial=effective.public_event_authority_status==='PARTIAL_VERIFIED';
  panel.className=review||effective.public_event_authority_status==='REVIEW_REQUIRED'?'notice warning':'notice success';
  const eventText=events.length?events.map(row=>`${esc(row.title)}${row.phase_title?` / ${esc(row.phase_title)}`:''}`).join('、'):'目前無套用中的公版活動';
  const period=events.length?events.map(row=>`${esc(row.start_at)} → ${esc(row.end_at)}`).join('<br>'):'—';
  const effectRows=states.map(row=>`<tr><td><code>${esc(row.effect_key)}</code></td><td>${esc(typeof row.value==='object'?JSON.stringify(row.value):row.value)}</td><td>${esc(row.rule_status)}</td><td>${esc(row.consumer||'—')}</td></tr>`).join('');
  panel.innerHTML=`<b>Public Event Master：</b>${eventText}<br>
    <small>Master：<code>${esc(effective.public_event_master_version||'尚無已驗證快取')}</code> · Authority：<b>${esc(effective.public_event_authority_status||'UNAVAILABLE')}</b>${partial?'（期間／部分欄位仍待官方詳細公告覆核）':''}</small><br>
    <small>期間：${period}</small><br>
    <small>玩家 Weekly Context 只維護營地、料理與玩家專屬欄位；舊 event_name / event_effects 僅保留為 audit observation，禁止覆蓋公版活動。</small>
    ${effectRows?`<div class="table-wrap"><table><thead><tr><th>Effect</th><th>值</th><th>Rule Status</th><th>Consumer</th></tr></thead><tbody>${effectRows}</tbody></table></div>`:'<p>目前沒有已驗證的公版 numeric event effect；系統不會自行補猜倍率。</p>'}`;
}
function apply(){
  if(applying||!isDatabaseReady()||isRescueReadonly())return;
  const form=document.getElementById('weeklyContextForm');if(!form)return;
  applying=true;
  try{lockLegacyEventObservation(form);renderPanel(form,currentEffectiveWeeklyContext());}
  finally{applying=false;}
}
function schedule(delay=25){setTimeout(apply,delay);}
function install(){
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="weekly"]'))schedule();},true);
  document.addEventListener('pokemon-sleep-data-refreshed',()=>schedule());
  globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>schedule(50));
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(['weekly_context','public_event_master'].includes(event.detail?.entity))schedule();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(60),{once:true});else schedule(60);
}
install();
