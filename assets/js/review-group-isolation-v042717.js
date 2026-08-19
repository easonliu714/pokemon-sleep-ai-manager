export const REVIEW_GROUP_ISOLATION_VERSION='v0.4.27.17-group-bound-snapshot-2026-08-19-a';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

export function createGroupBoundReviewController(api,{traceFn=()=>{}}={}){
  if(!api||typeof api!=='object')throw new Error('review_group_isolation_api_missing');
  for(const name of ['getState','selectGroup','replaceActiveDraft','navigateReviewGroup']){
    if(typeof api[name]!=='function')throw new Error(`review_group_isolation_api_missing_${name}`);
  }

  const original={
    selectGroup:api.selectGroup.bind(api),
    replaceActiveDraft:api.replaceActiveDraft.bind(api),
    navigateReviewGroup:api.navigateReviewGroup.bind(api),
    advanceReviewGroup:typeof api.advanceReviewGroup==='function'?api.advanceReviewGroup.bind(api):null,
  };
  let renderedGroupId=api.getState?.()?.active_group_id||null;

  const trace=(event,detail={})=>traceFn(event,{version:REVIEW_GROUP_ISOLATION_VERSION,...detail});
  const activeGroupId=()=>api.getState?.()?.active_group_id||null;

  function noteRenderedGroup(groupId,{reason='group_selected'}={}){
    renderedGroupId=groupId||null;
    trace('review_group_render_binding_changed',{rendered_group_id:renderedGroupId,active_group_id:activeGroupId(),reason});
    return renderedGroupId;
  }

  function ensureRenderedGroupActive(reason='snapshot'){
    const sourceGroupId=renderedGroupId;
    if(!sourceGroupId)return null;
    const before=activeGroupId();
    if(before===sourceGroupId)return sourceGroupId;
    const selected=original.selectGroup(sourceGroupId,{reason:`v042717_${reason}_source_resync`});
    const after=activeGroupId();
    if(!selected||selected.id!==sourceGroupId||after!==sourceGroupId){
      const error=new Error('REVIEW_GROUP_SOURCE_RESYNC_FAILED');
      error.source_group_id=sourceGroupId;
      error.active_group_id_before=before;
      error.active_group_id_after=after;
      throw error;
    }
    trace('review_group_source_resynced',{source_group_id:sourceGroupId,active_group_id_before:before,active_group_id_after:after,reason});
    return sourceGroupId;
  }

  function replaceRenderedDraft(draft,{reason='manual_navigation_snapshot',...options}={}){
    const sourceGroupId=renderedGroupId;
    if(!sourceGroupId){
      const saved=original.replaceActiveDraft(draft,{reason,...options});
      trace('review_group_snapshot_legacy_fallback',{source_group_id:null,target_group_id:saved?.id||null,reason});
      return saved;
    }
    ensureRenderedGroupActive('snapshot');
    const saved=original.replaceActiveDraft(draft,{reason,...options,source_group_id:sourceGroupId});
    const targetGroupId=saved?.id||null;
    if(targetGroupId!==sourceGroupId){
      const error=new Error('REVIEW_GROUP_SNAPSHOT_TARGET_MISMATCH');
      error.source_group_id=sourceGroupId;
      error.target_group_id=targetGroupId;
      throw error;
    }
    trace('review_group_snapshot_group_bound',{source_group_id:sourceGroupId,target_group_id:targetGroupId,reason,species:draft?.species||null,nickname:draft?.nickname||null});
    return saved;
  }

  function navigateFromRendered(offset,{reason=null,createIfEmpty=false,...options}={}){
    const sourceGroupId=renderedGroupId;
    if(sourceGroupId)ensureRenderedGroupActive('navigation');
    const selected=original.navigateReviewGroup(offset,{reason,createIfEmpty,...options});
    trace('review_group_navigation_group_bound',{source_group_id:sourceGroupId,target_group_id:selected?.id||null,direction:Number(offset)<0?'previous':'next',reason});
    return selected;
  }

  function advanceFromRendered(options={}){
    const sourceGroupId=renderedGroupId;
    if(sourceGroupId)ensureRenderedGroupActive('advance');
    const selected=original.advanceReviewGroup?original.advanceReviewGroup(options):navigateFromRendered(1,{reason:options.reason||'manual_next_pokemon',createIfEmpty:options.createIfEmpty!==false});
    trace('review_group_advance_group_bound',{source_group_id:sourceGroupId,target_group_id:selected?.id||null,reason:options.reason||null});
    return selected;
  }

  return Object.freeze({
    version:REVIEW_GROUP_ISOLATION_VERSION,
    noteRenderedGroup,
    ensureRenderedGroupActive,
    replaceRenderedDraft,
    navigateFromRendered,
    advanceFromRendered,
    getState:()=>({rendered_group_id:renderedGroupId,active_group_id:activeGroupId()}),
    original:clone({has_advance:Boolean(original.advanceReviewGroup)}),
  });
}

export function installReviewGroupIsolation(scope=globalThis){
  const api=scope?.PokemonSleepMultiCaptureConsistency;
  if(!api)return false;
  if(api.review_group_isolation_version===REVIEW_GROUP_ISOLATION_VERSION)return true;

  const traceFn=(event,detail={})=>{
    scope.UpdateCenterLiveDebug?.record?.(event,detail);
    scope.DebugTrace?.record?.('ai_review',event,{status:'completed',details:detail});
  };
  const controller=createGroupBoundReviewController(api,{traceFn});

  api.replaceActiveDraft=controller.replaceRenderedDraft;
  api.navigateReviewGroup=controller.navigateFromRendered;
  if(typeof api.advanceReviewGroup==='function')api.advanceReviewGroup=controller.advanceFromRendered;
  api.review_group_isolation_version=REVIEW_GROUP_ISOLATION_VERSION;
  api.getRenderedReviewGroupState=controller.getState;

  scope.addEventListener?.('pokemon-sleep:analysis-confirmation-group-selected',event=>{
    controller.noteRenderedGroup(event?.detail?.group_id||null,{reason:event?.detail?.reason||'group_selected'});
    const root=scope.document?.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation');
    if(root){
      const groupId=event?.detail?.group_id||'';
      root.dataset.renderedGroupId=groupId;
      root.dataset.reviewGroupIsolationVersion=REVIEW_GROUP_ISOLATION_VERSION;
    }
  });
  scope.addEventListener?.('pokemon-sleep:analysis-confirmation-terminal',event=>{
    const state=controller.getState();
    if(event?.detail?.group_id&&event.detail.group_id===state.rendered_group_id){
      const active=api.getState?.()?.active_group_id||null;
      controller.noteRenderedGroup(active,{reason:'terminal_followup'});
    }
  });

  scope.PokemonSleepReviewGroupIsolation=controller;
  traceFn('review_group_isolation_ready',{version:REVIEW_GROUP_ISOLATION_VERSION,rendered_group_id:controller.getState().rendered_group_id,active_group_id:controller.getState().active_group_id,explicit_group_bound_snapshot:true});
  return true;
}

function installWhenReady(attempt=0){
  if(installReviewGroupIsolation(globalThis))return;
  if(attempt>=80)return;
  setTimeout(()=>installWhenReady(attempt+1),25);
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined'&&typeof globalThis.addEventListener==='function')installWhenReady();
