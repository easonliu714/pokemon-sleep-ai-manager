export const REVISION_BOUND_TARGET_CONTEXT_VERSION='v0.4.27.34-revision-bound-target-context-2026-08-25-a';

const text=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

export function revisionItemIdentity(revision={}){
  return text(revision?.image_sha256||revision?.item_id);
}

export function resolveExactRevisionContext(scope=globalThis,revision={}){
  const itemId=revisionItemIdentity(revision);
  const perImage=scope?.PokemonSleepPerImageRuntimeContextV042733;
  const state=perImage?.getState?.()||{};
  const selectedCount=Number(state?.selected_count||0);
  const batchActive=selectedCount>0;
  if(!itemId)return {status:'REVISION_ITEM_ID_MISSING',item_id:null,context:null,batch_active:batchActive,selected_count:selectedCount};
  if(typeof perImage?.contextForItem!=='function')return {status:'PER_IMAGE_CONTEXT_API_NOT_READY',item_id:itemId,context:null,batch_active:batchActive,selected_count:selectedCount};
  const context=perImage.contextForItem(itemId)||null;
  if(context)return {status:'EXACT_CONTEXT',item_id:itemId,context:clone(context),batch_active:batchActive,selected_count:selectedCount};
  return {status:batchActive?'EXACT_CONTEXT_MISSING':'NO_ACTIVE_PER_IMAGE_BATCH',item_id:itemId,context:null,batch_active:batchActive,selected_count:selectedCount};
}

export function enforceRevisionBoundTargetContext(scope=globalThis,revision={}){
  if(!revision)return {status:'NO_REVISION'};
  const resolved=resolveExactRevisionContext(scope,revision);
  const identityApi=scope?.PokemonSleepAnalysisTargetIdentity;
  const trace=(event,detail={})=>{
    const safe={version:REVISION_BOUND_TARGET_CONTEXT_VERSION,...detail};
    scope?.UpdateCenterLiveDebug?.record?.(event,safe);
    scope?.DebugTrace?.record?.('analysis_target',event,{status:detail.status||'completed',details:safe});
  };

  if(resolved.status==='EXACT_CONTEXT'){
    revision.identity_context=clone(resolved.context);
    identityApi?.setActiveAnalysisTargetContext?.(resolved.context);
    trace('v042734_revision_exact_context_rebound',{
      status:'completed',
      item_id:resolved.item_id,
      exact_revision_item_binding:true,
      mutable_active_item_fallback:false,
      target_mode:resolved.context?.mode||null,
    });
    return {status:'BOUND',item_id:resolved.item_id,context:clone(resolved.context)};
  }

  if(resolved.batch_active){
    // Fail closed during a captured per-image batch. A revision that cannot be mapped
    // back to its exact selected item must never inherit whichever item happens to be
    // globally active when the asynchronous save event arrives.
    revision.identity_context=null;
    identityApi?.clearActiveAnalysisTargetContext?.();
    trace('v042734_revision_exact_context_missing',{
      status:'blocked',
      item_id:resolved.item_id,
      exact_revision_item_binding:false,
      mutable_active_item_fallback:false,
      selected_count:resolved.selected_count,
    });
    return {status:'BLOCKED_NO_EXACT_CONTEXT',item_id:resolved.item_id};
  }

  // Outside the per-image workflow we preserve the historical single-target path.
  return {status:'LEGACY_PATH_UNCHANGED',item_id:resolved.item_id||null};
}

export function installRevisionBoundTargetContext(scope=globalThis){
  if(!scope||typeof scope.addEventListener!=='function')return false;
  if(scope.PokemonSleepRevisionBoundTargetContextV042734?.version===REVISION_BOUND_TARGET_CONTEXT_VERSION)return true;

  const handler=event=>enforceRevisionBoundTargetContext(scope,event?.detail?.revision||event?.detail||null);
  // Capture phase is intentional: legacy analysis-target-identity listeners persist
  // activeContext during the same saved-revision event. Rebind the exact item's
  // immutable context first so those listeners can only persist the correct target.
  scope.addEventListener('pokemon-sleep:analysis-revision-saved',handler,true);

  const api=Object.freeze({
    version:REVISION_BOUND_TARGET_CONTEXT_VERSION,
    revisionItemIdentity,
    resolveExactRevisionContext:revision=>resolveExactRevisionContext(scope,revision),
    enforceRevisionBoundTargetContext:revision=>enforceRevisionBoundTargetContext(scope,revision),
  });
  scope.PokemonSleepRevisionBoundTargetContextV042734=api;
  scope.UpdateCenterLiveDebug?.record?.('v042734_revision_bound_target_context_ready',{
    version:REVISION_BOUND_TARGET_CONTEXT_VERSION,
    exact_revision_item_binding:true,
    mutable_active_item_fallback:false,
    fail_closed_missing_exact_context:true,
  });
  return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.addEventListener==='function')installRevisionBoundTargetContext(globalThis);
