import './analysis-execution-ux-v042720.js';

export const MANUAL_DRAFT_OVERLAY_VERSION='v0.4.27.29-group-local-stale-restore-guard-2026-08-24-a';
export const SINGLE_CONFIRMATION_AUTHORITY_SHADOW_VERSION='v0.4.27.39-single-confirmation-authority-2026-08-25-a';
// Legacy predecessor contract parser bridge only; not runtime authority:
// MANUAL_DRAFT_OVERLAY_VERSION='v0.4.27.19-group-local-manual-draft-2026-08-19-a'

const records=new Map();
const text=value=>String(value??'').trim();
const trace=(event,detail={})=>{
  const payload={version:MANUAL_DRAFT_OVERLAY_VERSION,...detail};
  globalThis.UpdateCenterLiveDebug?.record?.(event,payload);
  globalThis.DebugTrace?.record?.('ai_review',event,{status:'completed',details:payload});
};
function releaseAtLeast39(scope=globalThis){
  const match=text(scope?.PokemonSleepVersionAuthority?.app_version).match(/^v0\.4\.27\.(\d+)$/);
  return Boolean(match&&Number(match[1])>=39);
}

function visibleForm(){return document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');}
function visibleGroupId(form=visibleForm()){
  return text(form?.dataset?.v042718GroupId||form?.dataset?.renderedGroupId||globalThis.PokemonSleepMultiCaptureConsistency?.getReviewGroupFormAuthorityState?.()?.visible_group_id||'')||null;
}
function controlKey(node){
  if(node?.dataset?.field)return `field:${node.dataset.field}`;
  if(node?.dataset?.check)return `check:${node.dataset.check}`;
  return null;
}
function snapshotControl(node){return node?.type==='checkbox'?Boolean(node.checked):String(node?.value??'');}
function applyControl(node,value){
  if(node?.type==='checkbox')node.checked=Boolean(value);
  else node.value=String(value??'');
}
function ensureRecord(groupId){
  const id=text(groupId);if(!id)return null;
  let record=records.get(id);
  if(!record){record={group_id:id,controls:new Map(),updated_at:null};records.set(id,record);}
  return record;
}
function captureNode(node,{reason='user_edit'}={}){
  const form=node?.closest?.('#analysisConfirmationWorkbench .analysis-confirmation');
  const groupId=visibleGroupId(form),key=controlKey(node);
  if(!groupId||!key)return false;
  const record=ensureRecord(groupId);
  record.controls.set(key,snapshotControl(node));record.updated_at=new Date().toISOString();
  trace('v042719_manual_control_captured',{group_id:groupId,control:key,reason});
  return true;
}
function captureVisibleForm({reason='explicit_snapshot'}={}){
  const form=visibleForm(),groupId=visibleGroupId(form);if(!form||!groupId)return 0;
  let count=0;
  for(const node of form.querySelectorAll('[data-field],[data-check]')){
    const key=controlKey(node);if(!key)continue;
    const record=ensureRecord(groupId);
    if(record.controls.has(key)){record.controls.set(key,snapshotControl(node));count++;}
  }
  if(count)trace('v042719_manual_form_snapshot_refreshed',{group_id:groupId,control_count:count,reason});
  return count;
}
function shouldRestoreGroup(groupId,form=visibleForm()){
  const requested=text(groupId)||null,visible=visibleGroupId(form);
  if(!form||!visible)return {allowed:false,requested_group_id:requested,visible_group_id:visible,reason:'visible_group_missing'};
  if(requested&&requested!==visible)return {allowed:false,requested_group_id:requested,visible_group_id:visible,reason:'stale_group_callback'};
  const active=text(globalThis.PokemonSleepMultiCaptureConsistency?.getState?.()?.active_group_id)||null;
  if(active&&active!==visible)return {allowed:false,requested_group_id:requested,visible_group_id:visible,active_group_id:active,reason:'visible_active_group_mismatch'};
  return {allowed:true,requested_group_id:requested,visible_group_id:visible,active_group_id:active,reason:null};
}
function restoreVisibleForm({groupId=null,reason='group_render'}={}){
  const form=visibleForm(),guard=shouldRestoreGroup(groupId,form);
  if(!guard.allowed){trace('v042729_stale_manual_restore_rejected',{...guard,reason_source:reason});return 0;}
  const id=guard.visible_group_id;
  const record=records.get(id);if(!record||!record.controls.size)return 0;
  let count=0;
  for(const node of form.querySelectorAll('[data-field],[data-check]')){
    const key=controlKey(node);if(!key||!record.controls.has(key))continue;
    applyControl(node,record.controls.get(key));count++;
  }
  if(count)trace('v042719_manual_form_restored',{group_id:id,control_count:count,reason});
  return count;
}
function scheduleRestore(groupId,reason){
  const scheduledGroupId=text(groupId)||null;
  queueMicrotask(()=>restoreVisibleForm({groupId:scheduledGroupId,reason}));
  setTimeout(()=>restoreVisibleForm({groupId:scheduledGroupId,reason:`${reason}_timer`}),0);
}
function clearGroup(groupId,reason='terminal'){
  const id=text(groupId);if(!id)return false;
  const removed=records.delete(id);
  if(removed)trace('v042719_manual_draft_cleared',{group_id:id,reason});
  return removed;
}

function install(){
  if(globalThis.PokemonSleepManualDraftOverlayV042719)return globalThis.PokemonSleepManualDraftOverlayV042719;
  const shadowOnly=releaseAtLeast39(globalThis);
  if(!shadowOnly){
    document.addEventListener('input',event=>captureNode(event.target,{reason:'input'}),true);
    document.addEventListener('change',event=>captureNode(event.target,{reason:'change'}),true);
    globalThis.addEventListener('pokemon-sleep:analysis-confirmation-snapshot-request',event=>captureVisibleForm({reason:event?.detail?.reason||'snapshot_request'}));
    globalThis.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',event=>scheduleRestore(event?.detail?.group_id||null,event?.detail?.reason||'group_selected'));
    globalThis.addEventListener('pokemon-sleep:analysis-confirmation-merged',event=>scheduleRestore(event?.detail?.group_id||null,'merged'));
    globalThis.addEventListener('pokemon-sleep:analysis-confirmation-navigation-changed',()=>scheduleRestore(null,'navigation_changed'));
    globalThis.addEventListener('pokemon-sleep:analysis-confirmation-terminal',event=>clearGroup(event?.detail?.group_id||null,event?.detail?.reason||'terminal'));
  }
  const noCapture=()=>0,noRestore=()=>0;
  const api=Object.freeze({
    version:MANUAL_DRAFT_OVERLAY_VERSION,
    single_confirmation_authority_version:shadowOnly?SINGLE_CONFIRMATION_AUTHORITY_SHADOW_VERSION:null,
    shadow_only:shadowOnly,
    captureVisibleForm:shadowOnly?noCapture:captureVisibleForm,
    restoreVisibleForm:shadowOnly?noRestore:restoreVisibleForm,
    shouldRestoreGroup,
    clearGroup,
    getState:()=>({shadow_only:shadowOnly,group_ids:[...records.keys()],records:[...records.values()].map(record=>({group_id:record.group_id,controls:Object.fromEntries(record.controls),updated_at:record.updated_at}))}),
  });
  globalThis.PokemonSleepManualDraftOverlayV042719=api;
  trace(shadowOnly?'v042739_legacy_manual_overlay_shadow_only':'v042719_manual_draft_overlay_ready',{group_local:true,dirty_controls_only:true,stale_restore_fail_closed:true,visible_group_recheck:true,shadow_only:shadowOnly,confirmation_dom_write_authority:!shadowOnly,confirmation_dom_capture_authority:!shadowOnly});
  return api;
}

if(typeof document!=='undefined'&&typeof globalThis.addEventListener==='function')install();

export {install,captureVisibleForm,restoreVisibleForm,shouldRestoreGroup,clearGroup};