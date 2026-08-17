import {isDatabaseReady,isRescueReadonly} from './database.js';
import {currentEffectiveWeeklyContext} from './effective-weekly-context.js';

export const WEEKLY_CONTEXT_CONSUMER_BANNER_VERSION='weekly-context-consumer-banner-2026-08-17-b-effective-event-authority';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function playerAuthorityLabel(week){
  const source=week.player_weekly_authority_source||week.authority_source;
  if(source==='UPDATE_CENTER_JSON')return `更新中心 JSON${week.authority_update_id?`（${week.authority_update_id}）`:''}`;
  if(source==='MANUAL_FALLBACK')return '本週環境人工 fallback';
  return '尚未建立';
}
function eventAuthorityLabel(week){
  const status=week.public_event_authority_status||'PUBLIC_EVENT_MASTER_UNAVAILABLE';
  const master=week.public_event_master_version||'—';
  return `Public Event Master · ${status} · ${master}`;
}
export function weeklyContextConsumerBannerContent(week){
  const berries=week.favorite_berries?.length?week.favorite_berries.join('、'):'尚未取得';
  const fallback=week.manual_fallback_fields?.length?`；人工補欄：${week.manual_fallback_fields.join('、')}`:'';
  return `<b>本頁 Effective Weekly Context：［本週環境］玩家週環境 + Public Event Master 活動投影</b><br>玩家週環境 Authority：${esc(playerAuthorityLabel(week))}${esc(fallback)}<br>活動 Authority：${esc(eventAuthorityLabel(week))}<br>週期 ${esc(week.week_start||'—')} · 營地 ${esc(week.camp||'—')} · 料理 ${esc(week.dish_category||'—')} · 活動 ${esc(week.event_name||'—')}<br>喜好樹果：${esc(berries)}<br><small>戰情室／食譜不各自保存營地或活動副本；營地／料理等玩家週狀態請回［本週環境］修改，活動 identity／effects 由 Public Event Master 投影。Legacy 玩家活動值僅供 audit，不具 deterministic authority。</small>`;
}
function ensure(section,id){
  if(!section)return null;let node=document.getElementById(id);if(node)return node;
  node=document.createElement('div');node.id=id;node.className='notice';
  const heading=section.querySelector('h2');heading?.insertAdjacentElement('afterend',node);return node;
}
export function renderWeeklyContextConsumerBanners(){
  if(!isDatabaseReady()||isRescueReadonly())return;
  const week=currentEffectiveWeeklyContext();
  for(const [sectionId,bannerId] of [['recipes','recipeWeeklyContextAuthority'],['warroom','warroomWeeklyContextAuthority']]){
    const node=ensure(document.getElementById(sectionId),bannerId);if(!node)continue;
    node.className=`notice ${week.context_status==='CURRENT_WEEK_READY'?'success':'warning'}`;
    node.innerHTML=week.context_status==='CURRENT_WEEK_READY'?weeklyContextConsumerBannerContent(week):'<b>本週環境尚未建立。</b> 戰情室／食譜不會沿用上週營地或活動；請先至［更新中心］匯入本週 Weekly Context JSON，或在［本週環境］人工補充。';
  }
}
function schedule(){setTimeout(renderWeeklyContextConsumerBanners,0);}
function install(){
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="recipes"],[data-view="warroom"]'))schedule();},true);
  document.addEventListener('pokemon-sleep-data-refreshed',schedule);
  globalThis.addEventListener?.('pokemon-sleep:database-ready',schedule);
  globalThis.addEventListener?.('pokemon-sleep:data-changed',event=>{if(event.detail?.entity==='weekly_context')schedule();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
}
install();
