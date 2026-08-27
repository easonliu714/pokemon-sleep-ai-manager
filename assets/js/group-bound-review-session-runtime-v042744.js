import {
  GROUP_BOUND_REVIEW_EVENT_GUARD_VERSION,
  installGroupBoundReviewEventGuard,
} from './group-bound-review-session-event-guard-v042743.js';
import {
  PUBLIC_BERRY_STRENGTH_VERSION,
  berryNameForType,
} from './public-berry-strength-master.js';

export const GROUP_BOUND_REVIEW_RUNTIME_VERSION='v0.4.27.44-deferred-session-authority-public-relation-review-only-2026-08-27-d';
export const PUBLIC_FIXED_FIELD_AUTHORITY_VERSION='pokemon-sleep-public-relation-review-only-2026-08-27-d';

const text=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

// Independent public species reference. This is validation evidence only.
// It must never manufacture or overwrite image-observed player fields.
export const PUBLIC_FIXED_SPECIES_FIELDS=Object.freeze({
  '小鍛匠':Object.freeze({
    type:'妖精',
    source_type:'official_plus_reference_verified',
    source_refs:Object.freeze([
      'https://www.pokemonsleep.net/zh/news/343238363931353636383439313633323637/',
      'https://www.serebii.net/pokemonsleep/pokemon/tinkatink.shtml',
    ]),
    verified_at:'2026-08-27',
  }),
  '巧鍛匠':Object.freeze({
    type:'妖精',
    source_type:'official_plus_reference_verified',
    source_refs:Object.freeze([
      'https://www.pokemonsleep.net/zh/news/343238363931353636383439313633323637/',
      'https://www.serebii.net/pokemonsleep/pokemon/tinkatuff.shtml',
    ]),
    verified_at:'2026-08-27',
  }),
  '巨鍛匠':Object.freeze({
    type:'妖精',
    source_type:'official_plus_reference_verified',
    source_refs:Object.freeze([
      'https://www.pokemonsleep.net/zh/news/343238363931353636383439313633323637/',
      'https://www.serebii.net/pokemonsleep/pokemon/tinkaton.shtml',
    ]),
    verified_at:'2026-08-27',
  }),
});

const patchState={
  status:'PENDING_CORE',
  attempts:0,
  installed_at:null,
  normalize_wrapped:false,
  capture_validator_installed:false,
  apply_guard_installed:false,
  event_guard_installed:false,
  last_error:null,
};

function trace(scope,event,details={},status='completed',error=null){
  const payload={
    version:GROUP_BOUND_REVIEW_RUNTIME_VERSION,
    public_relation_version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    berry_master_version:PUBLIC_BERRY_STRENGTH_VERSION,
    inherited_guard_version:GROUP_BOUND_REVIEW_EVENT_GUARD_VERSION,
    ...details,
  };
  scope.UpdateCenterLiveDebug?.record?.(event,payload);
  scope.DebugTrace?.record?.('ai_review',event,{status,details:payload,error});
}

export function publicFixedFieldsForSpecies(species){
  const row=PUBLIC_FIXED_SPECIES_FIELDS[text(species)]||null;
  if(!row)return null;
  return Object.freeze({
    ...row,
    favorite_berry:berryNameForType(row.type)||null,
    berry_master_version:PUBLIC_BERRY_STRENGTH_VERSION,
  });
}

function typeWarning({candidate,authoritative,species,master}){
  return {
    field:'type',
    candidate:clone(candidate),
    authoritative:clone(authoritative),
    species,
    status:'REVIEW_REQUIRED_SPECIES_TYPE_MISMATCH',
    reason:'AI_TYPE_DIFFERS_VERIFIED_PUBLIC_SPECIES_REFERENCE',
    authority_version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    source_type:master?.source_type||'verified_public_species_reference',
    source_refs:[...(master?.source_refs||[])],
    evidence_role:'VALIDATION_NOT_IMAGE_EVIDENCE',
    auto_rewrite:false,
    message:`屬性：AI 辨識為「${text(candidate)}」；公版物種資料為「${text(authoritative)}」。平台保留 AI 觀察值，不會自動改寫，請人工確認圖片。`,
  };
}

function berryWarning({candidate,canonicalBerry,observedType,species}){
  return {
    field:'favorite_berry',
    candidate:clone(candidate),
    authoritative:clone(canonicalBerry),
    species,
    observed_type:observedType,
    status:'REVIEW_REQUIRED_TYPE_BERRY_MISMATCH',
    reason:'AI_BERRY_DIFFERS_PUBLIC_TYPE_BERRY_RELATION',
    authority_version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    berry_master_version:PUBLIC_BERRY_STRENGTH_VERSION,
    source_type:'verified_public_type_to_berry_master',
    source_refs:[PUBLIC_BERRY_STRENGTH_VERSION],
    evidence_role:'VALIDATION_NOT_IMAGE_EVIDENCE',
    auto_rewrite:false,
    message:`樹果：AI 辨識為「${text(candidate)}」；依目前觀察屬性「${text(observedType)}」的公版關係參考值為「${text(canonicalBerry)}」。平台保留 AI 觀察值，不會自動改寫，請人工確認圖片。`,
  };
}

// Compatibility name retained for the v0.4.27.44 branch API. Despite the old
// name, this function is review-only: it returns an unchanged player draft and
// sidecar warnings. Public master data is never promoted to image evidence.
export function applyPublicFixedFieldAuthorityToDraft(input={},meta={}){
  const draft=clone(input)||{};
  const species=text(draft.species||meta.species);
  const speciesMaster=PUBLIC_FIXED_SPECIES_FIELDS[species]||null;
  const observedType=text(draft.type);
  const observedBerry=text(draft.favorite_berry);
  const warnings=[];

  if(speciesMaster?.type&&observedType&&observedType!==text(speciesMaster.type)){
    warnings.push(typeWarning({candidate:observedType,authoritative:speciesMaster.type,species,master:speciesMaster}));
  }

  // The relation is only meaningful when BOTH image-observed values exist.
  // Missing values remain missing; no public-master fill is permitted.
  const canonicalBerry=observedType?text(berryNameForType(observedType)):'';
  if(observedType&&observedBerry&&canonicalBerry&&observedBerry!==canonicalBerry){
    warnings.push(berryWarning({candidate:observedBerry,canonicalBerry,observedType,species}));
  }

  return {
    draft,
    changed:false,
    review_required:warnings.length>0,
    warnings,
    species,
    species_master:speciesMaster?publicFixedFieldsForSpecies(species):null,
    observed_type:observedType||null,
    observed_berry:observedBerry||null,
    canonical_berry_reference:canonicalBerry||null,
    auto_rewrite:false,
    missing_public_fill:false,
    evidence_role:'VALIDATION_NOT_IMAGE_EVIDENCE',
  };
}

export const validatePublicRelationsInDraft=applyPublicFixedFieldAuthorityToDraft;

export function publicRelationApplyPolicy(input={}){
  const validation=applyPublicFixedFieldAuthorityToDraft(input);
  return {
    allowed:!validation.review_required,
    block_reason:validation.review_required?'PUBLIC_RELATION_REVIEW_REQUIRED':null,
    validation,
  };
}

function installNormalizeWrapper(scope,consistency){
  if(consistency.normalizeRevision?.__v042744PublicFixedFieldAuthority===PUBLIC_FIXED_FIELD_AUTHORITY_VERSION){
    patchState.normalize_wrapped=true;
    return true;
  }
  if(typeof consistency.normalizeRevision!=='function')return false;
  const original=consistency.normalizeRevision.bind(consistency);
  const wrapped=revision=>{
    const normalized=original(revision);
    if(revision?.analysis_type!=='ai')return normalized;
    const validation=applyPublicFixedFieldAuthorityToDraft(normalized,{
      analysis_id:revision?.analysis_id||null,
      source_image_ref:revision?.source_image_ref||null,
    });
    if(validation.review_required){
      trace(scope,'v042744_public_relation_validation_flagged',{
        analysis_id:revision?.analysis_id||null,
        source_image_ref:revision?.source_image_ref||null,
        species:validation.species,
        warning_count:validation.warnings.length,
        fields:validation.warnings.map(row=>row.field),
        human_messages:validation.warnings.map(row=>row.message),
        auto_rewrite:false,
        missing_public_fill:false,
        raw_observation_preserved:true,
        player_sqlite_write:false,
      },'review_required');
    }
    // Return the exact normalized observation. The existing v0.4.27.36 player
    // profile consistency layer renders the human review notice from these
    // observed values; this successor must not pre-correct them.
    return validation.draft;
  };
  Object.defineProperty(wrapped,'__v042744PublicFixedFieldAuthority',{value:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION});
  consistency.normalizeRevision=wrapped;
  patchState.normalize_wrapped=true;
  trace(scope,'v042744_public_relation_validator_ready',{
    status:'completed',
    verified_species:Object.keys(PUBLIC_FIXED_SPECIES_FIELDS),
    generic_type_to_berry:true,
    auto_rewrite:false,
    missing_public_fill:false,
    player_sqlite_write:false,
  });
  return true;
}

function validateConfirmationEvent(scope,event,eventType){
  const detail=event?.detail;
  if(!detail||!detail.draft)return;
  const validation=applyPublicFixedFieldAuthorityToDraft(detail.draft,{species:detail.draft?.species});
  if(!validation.review_required)return;
  trace(scope,'v042744_confirmation_event_public_relation_flagged',{
    event_type:eventType,
    group_id:detail.group_id||null,
    species:validation.species,
    warning_count:validation.warnings.length,
    fields:validation.warnings.map(row=>row.field),
    human_messages:validation.warnings.map(row=>row.message),
    capture_phase:true,
    auto_rewrite:false,
    raw_observation_preserved:true,
    background_dom_write:false,
  },'review_required');
}

function installCaptureValidator(scope){
  if(patchState.capture_validator_installed)return true;
  if(typeof scope.addEventListener!=='function')return false;
  scope.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',event=>validateConfirmationEvent(scope,event,'selected'),true);
  scope.addEventListener('pokemon-sleep:analysis-confirmation-merged',event=>validateConfirmationEvent(scope,event,'merged'),true);
  patchState.capture_validator_installed=true;
  trace(scope,'v042744_public_relation_capture_validator_ready',{
    status:'completed',capture_phase:true,auto_rewrite:false,background_dom_write:false,
  });
  return true;
}

function visiblePublicRelationDraft(scope){
  const root=scope.document?.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation')||scope.document?.getElementById?.('analysisConfirmationWorkbench');
  if(!root)return null;
  const value=name=>text(root.querySelector?.(`[data-field="${name}"]`)?.value);
  return {root,draft:{species:value('species'),type:value('type'),favorite_berry:value('favorite_berry')}};
}

function setApplyBlockedStatus(scope,validation){
  const status=scope.document?.querySelector?.('#analysisConfirmationStatus');
  if(!status)return;
  status.className='notice pending';
  const messages=(validation?.warnings||[]).map(row=>text(row?.message)).filter(Boolean);
  status.textContent=`操作已阻擋：屬性／樹果仍有公版一致性衝突。請修正相關欄位後按「儲存人工修改」，再執行「確認處置」。${messages.length?` ${messages.join(' ')}`:''}`;
}

function guardPublicRelationApply(scope,event){
  const target=event?.target;
  const button=target?.id==='applyConfirmedAnalysis'?target:target?.closest?.('#applyConfirmedAnalysis');
  if(!button)return;
  const visible=visiblePublicRelationDraft(scope);
  if(!visible)return;
  const policy=publicRelationApplyPolicy(visible.draft);
  if(policy.allowed)return;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  event.stopPropagation?.();
  scope.PokemonSleepPlayerProfileConsistencyV042723?.reconcileVisibleConfirmation?.();
  setApplyBlockedStatus(scope,policy.validation);
  const state=scope.PokemonSleepMultiCaptureConsistency?.getState?.()||{};
  trace(scope,'v042744_public_relation_apply_blocked',{
    status:'blocked',
    block_reason:policy.block_reason,
    group_id:state.active_group_id||null,
    fields:policy.validation.warnings.map(row=>row.field),
    human_messages:policy.validation.warnings.map(row=>row.message),
    explicit_manual_save_required:true,
    auto_rewrite:false,
    player_sqlite_write:false,
  },'blocked');
}

function installPublicRelationApplyGuard(scope){
  if(patchState.apply_guard_installed)return true;
  if(!scope.document?.addEventListener)return true;
  scope.document.addEventListener('click',event=>guardPublicRelationApply(scope,event),true);
  patchState.apply_guard_installed=true;
  trace(scope,'v042744_public_relation_apply_guard_ready',{
    status:'completed',
    apply_fail_closed:true,
    explicit_manual_save_required:true,
    no_new_mutation_observer:true,
  });
  return true;
}

export function attemptInstallDeferredReviewAuthority(scope=globalThis){
  patchState.attempts+=1;
  const consistency=scope.PokemonSleepMultiCaptureConsistency;
  if(!consistency?.getState||typeof consistency?.normalizeRevision!=='function'){
    patchState.status='PENDING_CORE';
    return false;
  }
  try{
    installNormalizeWrapper(scope,consistency);
    installCaptureValidator(scope);
    installPublicRelationApplyGuard(scope);
    const guardOk=installGroupBoundReviewEventGuard(scope);
    patchState.event_guard_installed=Boolean(guardOk&&scope.PokemonSleepGroupBoundReviewEventGuardV042743);
    if(!patchState.event_guard_installed){
      patchState.status='PENDING_GUARD';
      return false;
    }
    patchState.status='READY';
    patchState.installed_at=patchState.installed_at||new Date().toISOString();
    patchState.last_error=null;
    trace(scope,'v042744_deferred_group_review_authority_ready',{
      status:'completed',
      attempts:patchState.attempts,
      normalize_wrapped:patchState.normalize_wrapped,
      capture_validator_installed:patchState.capture_validator_installed,
      apply_guard_installed:patchState.apply_guard_installed,
      event_guard_installed:true,
      legacy_projection_retired:true,
      public_relation_review_only:true,
      public_relation_apply_fail_closed:true,
      generic_type_to_berry:true,
      auto_rewrite:false,
      no_new_mutation_observer:true,
    });
    return true;
  }catch(error){
    patchState.status='ERROR';
    patchState.last_error=error?.message||String(error);
    trace(scope,'v042744_deferred_group_review_authority_failed',{
      status:'failed',attempts:patchState.attempts,message:patchState.last_error,
    },'failed',error);
    return false;
  }
}

export function installDeferredReviewAuthority(scope=globalThis,{interval_ms=50,max_wait_ms=120000}={}){
  if(scope.PokemonSleepReviewSessionRuntimeV042744?.version===GROUP_BOUND_REVIEW_RUNTIME_VERSION){
    return scope.PokemonSleepReviewSessionRuntimeV042744;
  }
  let timer=null,stopped=false,startedAt=Date.now();
  const attempt=()=>{
    if(stopped)return;
    if(attemptInstallDeferredReviewAuthority(scope)){
      stopped=true;
      if(timer)scope.clearInterval?.(timer);
      return;
    }
    if(Date.now()-startedAt>=max_wait_ms){
      stopped=true;
      if(timer)scope.clearInterval?.(timer);
      patchState.status='TIMEOUT';
      trace(scope,'v042744_deferred_group_review_authority_timeout',{
        status:'blocked',attempts:patchState.attempts,max_wait_ms,
      },'blocked');
    }
  };
  const api={
    version:GROUP_BOUND_REVIEW_RUNTIME_VERSION,
    public_relation_version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    fixed_field_version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    berry_master_version:PUBLIC_BERRY_STRENGTH_VERSION,
    attemptNow:attempt,
    getState:()=>clone(patchState),
    getPublicFixedFields:species=>clone(publicFixedFieldsForSpecies(species)),
    validatePublicRelationsInDraft:(draft,meta={})=>applyPublicFixedFieldAuthorityToDraft(draft,meta),
    applyPublicFixedFieldAuthorityToDraft:(draft,meta={})=>applyPublicFixedFieldAuthorityToDraft(draft,meta),
    publicRelationApplyPolicy:draft=>publicRelationApplyPolicy(draft),
  };
  scope.PokemonSleepReviewSessionRuntimeV042744=api;
  attempt();
  if(!stopped&&typeof scope.setInterval==='function')timer=scope.setInterval(attempt,interval_ms);
  scope.addEventListener?.('DOMContentLoaded',attempt,{once:true});
  scope.addEventListener?.('load',attempt,{once:true});
  trace(scope,'v042744_deferred_group_review_authority_bootstrap',{
    status:patchState.status,
    interval_ms,
    max_wait_ms,
    legacy_projection_retired:true,
    public_relation_review_only:true,
    public_relation_apply_fail_closed:true,
    auto_rewrite:false,
  });
  return api;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined'){
  installDeferredReviewAuthority(globalThis);
}
