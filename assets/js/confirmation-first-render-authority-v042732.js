export const CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION='confirmation-first-render-authority-2026-08-25-b-v042736';
export const PER_IMAGE_IDENTITY_PROJECTION_ISOLATION_VERSION='v0.4.27.36-per-image-identity-projection-isolation-2026-08-25-a';

const text=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const firstNonblank=(...values)=>{for(const value of values){const result=text(value);if(result)return result;}return '';};

function stateGroup(scope,groupId){
  const state=scope?.PokemonSleepMultiCaptureConsistency?.getState?.()||null;
  const id=text(groupId);
  const group=(state?.groups||[]).find(row=>text(row?.id)===id&&row?.status!=='closed')||null;
  return {state,group};
}

function exactContext(detail={},group=null){
  const incoming=clone(detail?.draft||{})||{};
  const core=clone(group?.draft||{})||{};
  return clone(group?.identity_context||detail?.identity_context||core?.analysis_target_context||incoming?.analysis_target_context||null);
}

export function resolveConfirmationFirstRenderProjection({detail={},group=null}={}){
  const incoming=clone(detail?.draft||{})||{};
  const core=clone(group?.draft||{})||{};
  const context=exactContext(detail,group);
  const baseline=context?.mode==='existing'?clone(context?.baseline_reference||null):null;

  // v0.4.27.36: identity/master fields may only come from the exact bound group.
  // Existing targets may use their immutable target/baseline as a fallback when the
  // same-group observation is blank. New targets never borrow any public/global or
  // previous-group value. Type must never be used to synthesize a berry observation.
  const species=context?.mode==='existing'
    ? firstNonblank(context?.target_species_snapshot,core?.species,incoming?.species,baseline?.species)
    : firstNonblank(core?.species,incoming?.species);
  const type=context?.mode==='existing'
    ? firstNonblank(core?.type,incoming?.type,baseline?.type)
    : firstNonblank(core?.type,incoming?.type);
  const favorite_berry=context?.mode==='existing'
    ? firstNonblank(core?.favorite_berry,incoming?.favorite_berry,baseline?.favorite_berry)
    : firstNonblank(core?.favorite_berry,incoming?.favorite_berry);

  return Object.freeze({
    species,
    type,
    favorite_berry,
    context_mode:context?.mode||'legacy',
    berry_corrected:false,
    berry_derived_from_type:false,
    projection_authority:'EXACT_GROUP_ONLY',
  });
}

export function shouldProjectConfirmationGroup({incoming_group_id=null,active_group_id=null,visible_group_id=null}={}){
  const incoming=text(incoming_group_id),active=text(active_group_id),visible=text(visible_group_id);
  if(!incoming||!active||!visible)return false;
  return incoming===active&&incoming===visible;
}

export function patchConfirmationEventDraft(detail={},group=null){
  if(!detail?.draft||!group||text(detail?.group_id)!==text(group?.id))return {patched:false,writes:0,projection:null,status:'REJECTED_NO_EXACT_GROUP'};
  const projection=resolveConfirmationFirstRenderProjection({detail,group});
  let writes=0;
  for(const field of ['species','type','favorite_berry']){
    if(text(detail.draft[field])!==text(projection[field])){detail.draft[field]=projection[field];writes++;}
  }
  return {patched:writes>0,writes,projection,status:'PATCHED_EXACT_GROUP'};
}

export function installConfirmationFirstRenderAuthority(scope=globalThis){
  if(!scope||typeof scope.addEventListener!=='function')return false;
  if(scope.PokemonSleepConfirmationFirstRenderAuthorityV042732?.version===CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION)return true;
  const trace=(event,detail={})=>{
    const safe={version:CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION,isolation_version:PER_IMAGE_IDENTITY_PROJECTION_ISOLATION_VERSION,...detail};
    scope.UpdateCenterLiveDebug?.record?.(event,safe);
    scope.DebugTrace?.record?.('ai_review',event,{status:detail.status||'completed',details:safe});
  };
  const visibleForm=()=>scope.document?.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation')||null;
  const visibleGroupId=()=>text(visibleForm()?.dataset?.v042718GroupId)||null;
  let projectionSequence=0;

  function projectVisible(detail={},reason='event',expectedSequence=null){
    const incoming=text(detail?.group_id),{state,group}=stateGroup(scope,incoming),active=text(state?.active_group_id),form=visibleForm();
    if(expectedSequence!=null&&expectedSequence!==projectionSequence){
      trace('v042736_stale_projection_token_rejected',{status:'blocked',reason,incoming_group_id:incoming||null,expected_sequence:expectedSequence,current_sequence:projectionSequence});
      return {status:'REJECTED_STALE_TOKEN',writes:0};
    }
    if(!form||!group)return {status:!form?'NO_VISIBLE_FORM':'NO_EXACT_GROUP',writes:0};
    const visible=text(form.dataset?.v042718GroupId);
    if(!shouldProjectConfirmationGroup({incoming_group_id:incoming,active_group_id:active,visible_group_id:visible})){
      // Fail closed. Never relabel a visible form to make a stale event look current.
      trace('v042736_noncurrent_projection_rejected',{status:'blocked',reason,incoming_group_id:incoming||null,active_group_id:active||null,visible_group_id:visible||null,render_marker_mutated:false});
      return {status:'REJECTED_NONCURRENT',writes:0};
    }
    const projection=resolveConfirmationFirstRenderProjection({detail,group});
    let writes=0;
    for(const [field,value] of [['species',projection.species],['type',projection.type],['favorite_berry',projection.favorite_berry]]){
      const input=form.querySelector?.(`[data-field="${field}"]`);if(!input)continue;
      const desired=text(value);
      if(String(input.value??'')!==desired){input.value=desired;writes++;}
    }
    form.dataset.v042732FirstRenderGroupId=incoming;
    form.dataset.v042736ProjectionIsolation=PER_IMAGE_IDENTITY_PROJECTION_ISOLATION_VERSION;
    trace('v042736_visible_projection_committed',{status:'completed',reason,group_id:incoming,dom_write_count:writes,exact_group_only:true,berry_derived_from_type:false,deferred_writer_count:0});
    return {status:'PROJECTED',writes,projection};
  }

  function scheduleFinalProjection(detail,reason){
    // One microtask is retained only to allow the authoritative form-render listener
    // from the same event to finish. The captured sequence and exact group IDs are
    // revalidated before any DOM write. There is intentionally no setTimeout writer.
    const sequence=++projectionSequence;
    queueMicrotask(()=>projectVisible(detail,`${reason}_exact_postrender`,sequence));
    return sequence;
  }

  function onEvent(event,reason){
    const detail=event?.detail||{},incoming=text(detail.group_id),{state,group}=stateGroup(scope,incoming),active=text(state?.active_group_id);
    if(!incoming||!group)return;
    if(active&&incoming!==active){
      ++projectionSequence;
      trace('v042736_nonactive_event_rejected',{status:'blocked',reason,incoming_group_id:incoming,active_group_id:active,event_draft_mutated:false});
      return;
    }
    const patched=patchConfirmationEventDraft(detail,group);
    if(patched.patched)trace('v042736_event_projection_patched',{status:'completed',reason,group_id:incoming,field_write_count:patched.writes,species_authority:patched.projection?.context_mode==='existing'?'BOUND_EXISTING_TARGET':'EXACT_GROUP_DRAFT',berry_derived_from_type:false,raw_provider_json_mutated:false});
    scheduleFinalProjection(detail,reason);
  }

  scope.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',event=>onEvent(event,'group_selected'),true);
  scope.addEventListener('pokemon-sleep:analysis-confirmation-merged',event=>onEvent(event,'merged'),true);

  const api=Object.freeze({
    version:CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION,
    isolation_version:PER_IMAGE_IDENTITY_PROJECTION_ISOLATION_VERSION,
    resolveConfirmationFirstRenderProjection,
    shouldProjectConfirmationGroup,
    patchConfirmationEventDraft,
    projectVisible,
    visibleGroupId,
  });
  scope.PokemonSleepConfirmationFirstRenderAuthorityV042732=api;
  trace('v042736_confirmation_first_render_authority_ready',{status:'completed',exact_group_only:true,existing_target_species_fallback:true,type_berry_auto_rewrite:false,stale_render_marker_repair:false,noncurrent_merged_projection:false,deferred_timeout_writer:false,raw_provider_json_mutated:false});
  return true;
}

if(typeof globalThis!=='undefined')installConfirmationFirstRenderAuthority(globalThis);
