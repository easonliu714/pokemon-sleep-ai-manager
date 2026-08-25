import {BERRY_BY_TYPE} from './pokemon-master-options.js';

export const CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION='confirmation-first-render-authority-2026-08-25-a';

const text=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const firstNonblank=(...values)=>{for(const value of values){const result=text(value);if(result)return result;}return '';};

function stateGroup(scope,groupId){
  const state=scope?.PokemonSleepMultiCaptureConsistency?.getState?.()||null;
  const id=text(groupId);
  const group=(state?.groups||[]).find(row=>text(row?.id)===id&&row?.status!=='closed')||null;
  return {state,group};
}

export function resolveConfirmationFirstRenderProjection({detail={},group=null}={}){
  const incoming=clone(detail?.draft||{})||{};
  const core=clone(group?.draft||{})||{};
  const context=clone(detail?.identity_context||group?.identity_context||incoming?.analysis_target_context||core?.analysis_target_context||null);
  const baseline=context?.mode==='existing'?context?.baseline_reference||null:null;
  const species=context?.mode==='existing'
    ? firstNonblank(context?.target_species_snapshot,baseline?.species,core?.species,incoming?.species)
    : firstNonblank(core?.species,incoming?.species);
  const type=firstNonblank(core?.type,incoming?.type,baseline?.type);
  const sourceBerry=firstNonblank(core?.favorite_berry,incoming?.favorite_berry,baseline?.favorite_berry);
  const canonicalBerry=text(BERRY_BY_TYPE[type]);
  const favorite_berry=sourceBerry&&canonicalBerry&&sourceBerry!==canonicalBerry?canonicalBerry:sourceBerry;
  return Object.freeze({species,type,favorite_berry,context_mode:context?.mode||'legacy',berry_corrected:Boolean(sourceBerry&&canonicalBerry&&sourceBerry!==canonicalBerry)});
}

export function shouldProjectConfirmationGroup({incoming_group_id=null,active_group_id=null,visible_group_id=null}={}){
  const incoming=text(incoming_group_id),active=text(active_group_id),visible=text(visible_group_id);
  if(!incoming||!active||incoming!==active)return false;
  if(visible&&visible!==incoming)return false;
  return true;
}

export function patchConfirmationEventDraft(detail={},group=null){
  if(!detail?.draft)return {patched:false,projection:null};
  const projection=resolveConfirmationFirstRenderProjection({detail,group});
  let writes=0;
  for(const field of ['species','type','favorite_berry']){
    if(text(detail.draft[field])!==text(projection[field])){detail.draft[field]=projection[field];writes++;}
  }
  return {patched:writes>0,writes,projection};
}

export function installConfirmationFirstRenderAuthority(scope=globalThis){
  if(!scope||typeof scope.addEventListener!=='function')return false;
  if(scope.PokemonSleepConfirmationFirstRenderAuthorityV042732?.version===CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION)return true;
  const trace=(event,detail={})=>{
    const safe={version:CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION,...detail};
    scope.UpdateCenterLiveDebug?.record?.(event,safe);
    scope.DebugTrace?.record?.('ai_review',event,{status:detail.status||'completed',details:safe});
  };
  const visibleForm=()=>scope.document?.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation')||null;
  const visibleGroupId=()=>text(visibleForm()?.dataset?.v042718GroupId)||null;

  function repairStaleRenderedMarker(incomingId){
    const {state}=stateGroup(scope,incomingId),active=text(state?.active_group_id),form=visibleForm();
    if(!form||!active)return false;
    const visible=text(form.dataset?.v042718GroupId);
    if(visible&&visible!==active){
      form.dataset.v042718GroupId=active;
      trace('v042732_stale_render_marker_repaired',{status:'completed',incoming_group_id:text(incomingId)||null,active_group_id:active,stale_visible_group_id:visible});
      return true;
    }
    return false;
  }

  function projectVisible(detail={},reason='event'){
    const incoming=text(detail?.group_id),{state,group}=stateGroup(scope,incoming),active=text(state?.active_group_id),form=visibleForm();
    if(!form){return {status:'NO_VISIBLE_FORM',writes:0};}
    const visible=text(form.dataset?.v042718GroupId);
    if(!shouldProjectConfirmationGroup({incoming_group_id:incoming,active_group_id:active,visible_group_id:visible})){
      repairStaleRenderedMarker(incoming);
      trace('v042732_noncurrent_projection_rejected',{status:'completed',reason,incoming_group_id:incoming||null,active_group_id:active||null,visible_group_id:visible||null});
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
    trace('v042732_visible_projection_committed',{status:'completed',reason,group_id:incoming,species_present:Boolean(projection.species),berry_present:Boolean(projection.favorite_berry),berry_corrected:projection.berry_corrected,dom_write_count:writes,first_render_atomic:true});
    return {status:'PROJECTED',writes,projection};
  }

  function scheduleFinalProjection(detail,reason){
    queueMicrotask(()=>queueMicrotask(()=>queueMicrotask(()=>{
      projectVisible(detail,`${reason}_prepaint`);
      setTimeout(()=>projectVisible(detail,`${reason}_post_deferred`),0);
    })));
  }

  function onEvent(event,reason){
    const detail=event?.detail||{},incoming=text(detail.group_id),{state,group}=stateGroup(scope,incoming),active=text(state?.active_group_id);
    if(!incoming||!group)return;
    if(reason==='merged'&&active&&incoming!==active){scheduleFinalProjection(detail,reason);return;}
    const patched=patchConfirmationEventDraft(detail,group);
    if(patched.patched)trace('v042732_event_projection_patched',{status:'completed',reason,group_id:incoming,field_write_count:patched.writes,species_authority:patched.projection?.context_mode==='existing'?'BOUND_EXISTING_TARGET':'GROUP_DRAFT',berry_corrected:Boolean(patched.projection?.berry_corrected),raw_provider_json_mutated:false});
    scheduleFinalProjection(detail,reason);
  }

  scope.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',event=>onEvent(event,'group_selected'),true);
  scope.addEventListener('pokemon-sleep:analysis-confirmation-merged',event=>onEvent(event,'merged'),true);

  const api=Object.freeze({version:CONFIRMATION_FIRST_RENDER_AUTHORITY_VERSION,resolveConfirmationFirstRenderProjection,shouldProjectConfirmationGroup,patchConfirmationEventDraft,projectVisible});
  scope.PokemonSleepConfirmationFirstRenderAuthorityV042732=api;
  trace('v042732_confirmation_first_render_authority_ready',{status:'completed',first_render_atomic:true,existing_target_species_fallback:true,group_local_berry_projection:true,noncurrent_merged_projection:false,raw_provider_json_mutated:false});
  return true;
}

if(typeof globalThis!=='undefined')installConfirmationFirstRenderAuthority(globalThis);
