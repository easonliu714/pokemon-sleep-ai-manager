import {
  GROUP_BOUND_REVIEW_EVENT_GUARD_VERSION,
  installGroupBoundReviewEventGuard,
} from './group-bound-review-session-event-guard-v042743.js';

export const GROUP_BOUND_REVIEW_RUNTIME_VERSION='v0.4.27.44-deferred-session-authority-public-fixed-field-2026-08-27-a';
export const PUBLIC_FIXED_FIELD_AUTHORITY_VERSION='pokemon-sleep-public-fixed-field-authority-2026-08-27-a';

const text=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// Verified current Pokémon Sleep public fields. These values are deterministic
// game data, not player observations. AI may provide contradictory evidence,
// but it must not overwrite these fields in a review draft.
export const PUBLIC_FIXED_SPECIES_FIELDS=Object.freeze({
  '小鍛匠':Object.freeze({
    type:'妖精',
    favorite_berry:'桃桃果',
    source_type:'official_plus_reference_verified',
    source_refs:Object.freeze([
      'https://www.pokemonsleep.net/zh/news/343238363931353636383439313633323637/',
      'https://www.serebii.net/pokemonsleep/pokemon/tinkatink.shtml',
    ]),
    verified_at:'2026-08-27',
  }),
  '巧鍛匠':Object.freeze({
    type:'妖精',
    favorite_berry:'桃桃果',
    source_type:'official_plus_reference_verified',
    source_refs:Object.freeze([
      'https://www.pokemonsleep.net/zh/news/343238363931353636383439313633323637/',
      'https://www.serebii.net/pokemonsleep/pokemon/tinkatuff.shtml',
    ]),
    verified_at:'2026-08-27',
  }),
  '巨鍛匠':Object.freeze({
    type:'妖精',
    favorite_berry:'桃桃果',
    source_type:'official_plus_reference_verified',
    source_refs:Object.freeze([
      'https://www.pokemonsleep.net/zh/news/343238363931353636383439313633323637/',
      'https://www.serebii.net/pokemonsleep/pokemon/tinkaton.shtml',
    ]),
    verified_at:'2026-08-27',
  }),
});

const FIELD_LABELS=Object.freeze({type:'屬性',favorite_berry:'樹果'});
const patchState={
  status:'PENDING_CORE',
  attempts:0,
  installed_at:null,
  normalize_wrapped:false,
  capture_sanitizer_installed:false,
  event_guard_installed:false,
  last_error:null,
};

function trace(scope,event,details={},status='completed',error=null){
  const payload={
    version:GROUP_BOUND_REVIEW_RUNTIME_VERSION,
    fixed_field_version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    inherited_guard_version:GROUP_BOUND_REVIEW_EVENT_GUARD_VERSION,
    ...details,
  };
  scope.UpdateCenterLiveDebug?.record?.(event,payload);
  scope.DebugTrace?.record?.('ai_review',event,{status,details:payload,error});
}

export function publicFixedFieldsForSpecies(species){
  return PUBLIC_FIXED_SPECIES_FIELDS[text(species)]||null;
}

function fixedFieldWarning({field,candidate,authoritative,species,master}){
  const label=FIELD_LABELS[field]||field;
  return {
    field,
    candidate:clone(candidate),
    authoritative:clone(authoritative),
    species,
    status:'REVIEW_ONLY_PUBLIC_FIXED_FIELD_CONFLICT',
    reason:'AI_VALUE_DIFFERS_VERIFIED_PUBLIC_FIXED_FIELD',
    authority_version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    source_type:master?.source_type||'verified_public_master',
    source_refs:[...(master?.source_refs||[])],
    message:`${label}：AI 辨識為「${text(candidate)}」；公版固定資料為「${text(authoritative)}」。平台已保留公版值「${text(authoritative)}」，請人工確認圖片。`,
  };
}

function addWarning(draft,warning){
  if(!warning)return;
  const rows=Array.isArray(draft.identity_guard_warnings)?draft.identity_guard_warnings.map(clone):[];
  const duplicate=rows.some(row=>row?.reason===warning.reason&&row?.field===warning.field&&text(row?.candidate)===text(warning.candidate)&&text(row?.authoritative)===text(warning.authoritative));
  if(!duplicate)rows.push(warning);
  draft.identity_guard_warnings=rows;
}

export function applyPublicFixedFieldAuthorityToDraft(input={},meta={}){
  const draft=clone(input)||{};
  const species=text(draft.species||meta.species);
  const master=publicFixedFieldsForSpecies(species);
  if(!master)return {draft,changed:false,warnings:[],species,master:null};
  const warnings=[];
  for(const field of ['type','favorite_berry']){
    const authoritative=master[field];
    if(authoritative==null||authoritative==='')continue;
    const candidate=draft[field];
    if(candidate!==null&&candidate!==undefined&&candidate!==''&&!same(candidate,authoritative)){
      const warning=fixedFieldWarning({field,candidate,authoritative,species,master});
      warnings.push(warning);addWarning(draft,warning);
    }
    draft[field]=clone(authoritative);
  }
  draft.public_fixed_field_authority={
    version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    species,
    fields:['type','favorite_berry'],
    source_type:master.source_type,
    source_refs:[...master.source_refs],
    verified_at:master.verified_at,
  };
  return {draft,changed:warnings.length>0||!same(input?.type,draft.type)||!same(input?.favorite_berry,draft.favorite_berry),warnings,species,master};
}

function installNormalizeWrapper(scope,consistency){
  if(consistency.normalizeRevision?.__v042744PublicFixedFieldAuthority===PUBLIC_FIXED_FIELD_AUTHORITY_VERSION){patchState.normalize_wrapped=true;return true;}
  if(typeof consistency.normalizeRevision!=='function')return false;
  const original=consistency.normalizeRevision.bind(consistency);
  const wrapped=revision=>{
    const normalized=original(revision);
    if(revision?.analysis_type!=='ai')return normalized;
    const result=applyPublicFixedFieldAuthorityToDraft(normalized,{analysis_id:revision?.analysis_id||null,source_image_ref:revision?.source_image_ref||null});
    if(result.changed){
      trace(scope,'v042744_public_fixed_field_projection_applied',{
        analysis_id:revision?.analysis_id||null,
        source_image_ref:revision?.source_image_ref||null,
        species:result.species,
        warning_count:result.warnings.length,
        corrected_fields:['type','favorite_berry'],
        ai_candidate_values:result.warnings.map(row=>({field:row.field,candidate:row.candidate,authoritative:row.authoritative})),
        player_sqlite_write:false,
      });
    }
    return result.draft;
  };
  Object.defineProperty(wrapped,'__v042744PublicFixedFieldAuthority',{value:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION});
  consistency.normalizeRevision=wrapped;
  patchState.normalize_wrapped=true;
  trace(scope,'v042744_public_fixed_field_normalizer_ready',{status:'completed',verified_species:Object.keys(PUBLIC_FIXED_SPECIES_FIELDS),player_sqlite_write:false});
  return true;
}

function sanitizeConfirmationEvent(scope,event,eventType){
  const detail=event?.detail;if(!detail||!detail.draft)return;
  const result=applyPublicFixedFieldAuthorityToDraft(detail.draft,{species:detail.draft?.species});
  if(!result.changed)return;
  detail.draft=result.draft;
  trace(scope,'v042744_confirmation_event_public_fields_sanitized',{
    event_type:eventType,
    group_id:detail.group_id||null,
    species:result.species,
    warning_count:result.warnings.length,
    corrected_fields:['type','favorite_berry'],
    capture_phase:true,
    background_dom_write:false,
  });
}

function installCaptureSanitizer(scope){
  if(patchState.capture_sanitizer_installed)return true;
  if(typeof scope.addEventListener!=='function')return false;
  scope.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',event=>sanitizeConfirmationEvent(scope,event,'selected'),true);
  scope.addEventListener('pokemon-sleep:analysis-confirmation-merged',event=>sanitizeConfirmationEvent(scope,event,'merged'),true);
  patchState.capture_sanitizer_installed=true;
  trace(scope,'v042744_public_fixed_field_capture_guard_ready',{status:'completed',capture_phase:true,background_dom_write:false});
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
    installCaptureSanitizer(scope);
    const guardOk=installGroupBoundReviewEventGuard(scope);
    patchState.event_guard_installed=Boolean(guardOk&&scope.PokemonSleepGroupBoundReviewEventGuardV042743);
    if(!patchState.event_guard_installed){patchState.status='PENDING_GUARD';return false;}
    patchState.status='READY';patchState.installed_at=patchState.installed_at||new Date().toISOString();patchState.last_error=null;
    trace(scope,'v042744_deferred_group_review_authority_ready',{
      status:'completed',attempts:patchState.attempts,normalize_wrapped:patchState.normalize_wrapped,
      capture_sanitizer_installed:patchState.capture_sanitizer_installed,event_guard_installed:true,
      legacy_projection_retired:true,public_fixed_field_guard:true,no_new_mutation_observer:true,
    });
    return true;
  }catch(error){
    patchState.status='ERROR';patchState.last_error=error?.message||String(error);
    trace(scope,'v042744_deferred_group_review_authority_failed',{status:'failed',attempts:patchState.attempts,message:patchState.last_error},'failed',error);
    return false;
  }
}

export function installDeferredReviewAuthority(scope=globalThis,{interval_ms=50,max_wait_ms=120000}={}){
  if(scope.PokemonSleepReviewSessionRuntimeV042744?.version===GROUP_BOUND_REVIEW_RUNTIME_VERSION)return scope.PokemonSleepReviewSessionRuntimeV042744;
  let timer=null,stopped=false,startedAt=Date.now();
  const attempt=()=>{
    if(stopped)return;
    if(attemptInstallDeferredReviewAuthority(scope)){stopped=true;if(timer)scope.clearInterval?.(timer);return;}
    if(Date.now()-startedAt>=max_wait_ms){
      stopped=true;if(timer)scope.clearInterval?.(timer);
      patchState.status='TIMEOUT';
      trace(scope,'v042744_deferred_group_review_authority_timeout',{status:'blocked',attempts:patchState.attempts,max_wait_ms},'blocked');
    }
  };
  const api={
    version:GROUP_BOUND_REVIEW_RUNTIME_VERSION,
    fixed_field_version:PUBLIC_FIXED_FIELD_AUTHORITY_VERSION,
    attemptNow:attempt,
    getState:()=>clone(patchState),
    getPublicFixedFields:species=>clone(publicFixedFieldsForSpecies(species)),
    applyPublicFixedFieldAuthorityToDraft:(draft,meta={})=>applyPublicFixedFieldAuthorityToDraft(draft,meta),
  };
  scope.PokemonSleepReviewSessionRuntimeV042744=api;
  attempt();
  if(!stopped&&typeof scope.setInterval==='function')timer=scope.setInterval(attempt,interval_ms);
  scope.addEventListener?.('DOMContentLoaded',attempt,{once:true});
  scope.addEventListener?.('load',attempt,{once:true});
  trace(scope,'v042744_deferred_group_review_authority_bootstrap',{status:patchState.status,interval_ms,max_wait_ms,legacy_projection_retired:true});
  return api;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installDeferredReviewAuthority(globalThis);
