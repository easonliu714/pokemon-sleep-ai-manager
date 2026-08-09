import {inspectEvaluationLifecycle,refreshEvaluationLifecycle} from './evaluation-lifecycle.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const labels=Object.freeze({
  CURRENT:'目前 Snapshot 已同步',REFRESH_REQUIRED:'Snapshot 需要更新',GOAL_PROFILE_MISSING:'尚未建立 Active Goal Profile',
  WEEKLY_CONTEXT_MISSING:'本週環境尚未設定',WEEKLY_CONTEXT_EPOCH_MISMATCH:'本週環境仍是上一個週期',NO_ACTIVE_POKEMON:'目前沒有 active Pokémon',
  PLAYER_DATA_UNAVAILABLE:'玩家資料尚未載入',ERROR:'Lifecycle 檢查失敗',
});

function message(state){
  if(state.status==='CURRENT')return '目前 fingerprint 與有效 Snapshot 一致；切頁或重開不會重寫 SQLite。';
  if(state.status==='REFRESH_REQUIRED')return '偵測到相關輸入變更；可同步需要更新的 Pokémon Snapshot，不會重算無關資料。';
  if(state.status==='WEEKLY_CONTEXT_EPOCH_MISMATCH')return `目前週期為 ${state.week_epoch||'—'}，請先到「本週環境」確認並儲存新週資料；系統不會把上一週條件自動沿用。`;
  if(state.status==='GOAL_PROFILE_MISSING')return '請先建立並儲存 Goal Profile；未設定策略目標時不自動建立評估 Snapshot。';
  if(state.status==='WEEKLY_CONTEXT_MISSING')return '請先完成本週環境；缺少週期資料時不自動寫入 Snapshot。';
  if(state.status==='NO_ACTIVE_POKEMON')return '沒有 active Pokémon 可建立評估 Snapshot。';
  if(state.status==='PLAYER_DATA_UNAVAILABLE')return '目前為救援／唯讀狀態，不讀寫玩家 Snapshot。';
  return 'Lifecycle 狀態無法判定；請保留目前資料並查看診斷。';
}

export function renderWarRoomEvaluationLifecycle(root=document.getElementById('warroomEvaluationLifecycle'),providedState=null){
  if(!root)return;
  let state=providedState;
  try{state=state||inspectEvaluationLifecycle();}
  catch(error){state={status:'ERROR',week_epoch:null,target_count:0,refresh_count:0,reused_count:0,stale_count:0,write_performed:false,error:error?.message||String(error)};}
  const canSync=state.status==='REFRESH_REQUIRED';
  root.innerHTML=`<div class="panel">
    <div class="section-head"><div><h3>Evaluation Snapshot Lifecycle</h3><p class="notice">以週期、Goal Profile、Pokémon observation 與 Master/Rule fingerprint 判斷是否需要重算；單純切頁與無關庫存變更採 zero-write preflight。</p></div><button type="button" data-evaluation-lifecycle-sync ${canSync?'':'disabled'}>同步需要更新的 Snapshot</button></div>
    <p class="notice"><b>${esc(labels[state.status]||state.status)}</b>　週期：<code>${esc(state.week_epoch||'—')}</code></p>
    <p class="notice">${esc(message(state))}</p>
    <div class="war-team-summary"><span>目標 <b>${Number(state.target_count||0)}</b></span><span>需更新 <b>${Number(state.refresh_count||0)}</b></span><span>可重用 <b>${Number(state.reused_count||0)}</b></span><span>待標 stale <b>${Number(state.stale_count||0)}</b></span></div>
    <p class="notice">本次檢查 write_performed=<b>${state.write_performed?'true':'false'}</b>；player_rows_modified=<b>false</b></p>
    <p class="notice" data-evaluation-lifecycle-result></p>
  </div>`;
  const button=root.querySelector('[data-evaluation-lifecycle-sync]'),result=root.querySelector('[data-evaluation-lifecycle-result]');
  if(button&&!button.disabled)button.onclick=async()=>{
    button.disabled=true;result.textContent='正在同步需要更新的 Evaluation Snapshot…';
    try{
      const next=await refreshEvaluationLifecycle({reason:'manual_war_room_lifecycle'});
      result.textContent=`完成：created=${next.created||0} reused=${next.reused||0} staled=${next.staled||0}；write_performed=${Boolean(next.write_performed)}`;
      renderWarRoomEvaluationLifecycle(root,next);
    }catch(error){result.textContent=error?.message||String(error);button.disabled=false;}
  };
}
