import {
  GROUP_BOUND_REVIEW_SESSION_VERSION,
  installGroupBoundReviewSessionCache,
} from './group-bound-review-session-cache-v042743.js';

export const GROUP_BOUND_REVIEW_EVENT_GUARD_VERSION='v0.4.27.43-group-bound-review-event-guard-2026-08-27-b';

const MANUAL_SAVE_REASONS=new Set(['explicit_manual_save_v042738','explicit_manual_save_authority_promotion_v042742']);
const text=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const trace=(scope,event,detail={})=>{
  const payload={version:GROUP_BOUND_REVIEW_EVENT_GUARD_VERSION,session_version:GROUP_BOUND_REVIEW_SESSION_VERSION,...detail};
  scope.UpdateCenterLiveDebug?.record?.(event,payload);
  scope.DebugTrace?.record?.('ai_review',event,{status:detail.status||'completed',details:payload});
};
const logicalAssignmentKey=row=>row?.mode==='existing'&&text(row.pokemon_id)?`existing:${text(row.pokemon_id)}`:row?.mode==='new'&&text(row.new_group_key)?`new:${text(row.new_group_key)}`:null;

export function createExactGroupSealTracker(){
  const itemToLogical=new Map(),itemToIdentity=new Map(),expectedByLogical=new Map(),identityToLogical=new Map(),completedByIdentity=new Map();
  return {
    freeze(assignments=[]){
      itemToLogical.clear();itemToIdentity.clear();expectedByLogical.clear();identityToLogical.clear();completedByIdentity.clear();
      for(const row of assignments){
        const itemId=text(row?.item_id),logical=logicalAssignmentKey(row);if(!itemId||!logical)continue;
        itemToLogical.set(itemId,logical);
        if(!expectedByLogical.has(logical))expectedByLogical.set(logical,new Set());
        expectedByLogical.get(logical).add(itemId);
      }
      return this.getState();
    },
    bind(itemId,identityKey){
      const item=text(itemId),identity=text(identityKey),logical=itemToLogical.get(item);if(!item||!identity||!logical)return null;
      itemToIdentity.set(item,identity);identityToLogical.set(identity,logical);
      if(!completedByIdentity.has(identity))completedByIdentity.set(identity,new Set());
      return this.progress(identity);
    },
    complete(itemId){
      const item=text(itemId),identity=itemToIdentity.get(item);if(!identity)return null;
      if(!completedByIdentity.has(identity))completedByIdentity.set(identity,new Set());
      completedByIdentity.get(identity).add(item);
      return this.progress(identity);
    },
    progress(identityKey){
      const identity=text(identityKey),logical=identityToLogical.get(identity);if(!identity||!logical)return null;
      const expected=expectedByLogical.get(logical)?.size||0,completed=completedByIdentity.get(identity)?.size||0;
      return {identity_key:identity,logical_key:logical,expected_source_count:expected,completed_source_count:completed,ready_to_seal:expected>0&&completed>=expected};
    },
    identityForItem:itemId=>itemToIdentity.get(text(itemId))||null,
    getState:()=>({
      item_to_logical:Object.fromEntries(itemToLogical),
      item_to_identity:Object.fromEntries(itemToIdentity),
      expected_by_logical:Object.fromEntries([...expectedByLogical].map(([key,set])=>[key,[...set]])),
      completed_by_identity:Object.fromEntries([...completedByIdentity].map(([key,set])=>[key,[...set]])),
    }),
  };
}

function sessionApi(scope){return scope.PokemonSleepGroupBoundReviewSessionV042743||null;}
function identityKey(scope){
  const api=scope.PokemonSleepAnalysisTargetIdentity,context=api?.getActiveAnalysisTargetContext?.()||null;
  return context&&api?.analysisTargetIdentityKey?.(context)||null;
}
function coreGroupForIdentity(scope,key){
  const state=scope.PokemonSleepMultiCaptureConsistency?.getState?.()||{};
  return (state.groups||[]).find(row=>text(row?.identity_key)===text(key))||null;
}
function selectedAssignments(scope){
  const api=scope.PokemonSleepPerImageTargetAssignmentV042718,root=scope.document?.getElementById?.('unifiedImportAnalysisWorkbench');
  if(!api?.getAssignments||!root)return [];
  const selected=new Set([...root.querySelectorAll('[data-unified-item]:checked')].map(node=>text(node.value)).filter(Boolean));
  return api.getAssignments().filter(row=>selected.has(text(row.item_id)));
}
function installLegacyConflictJsonHide(scope){
  if(!scope.document||scope.document.getElementById('v042743LegacyConflictJsonHide'))return;
  const style=scope.document.createElement('style');
  style.id='v042743LegacyConflictJsonHide';
  style.textContent='#analysisConfirmationWorkbench #captureGroupStatus details{display:none!important;}';
  (scope.document.head||scope.document.documentElement)?.appendChild(style);
}

export function installGroupBoundReviewEventGuard(scope=globalThis){
  if(scope.PokemonSleepGroupBoundReviewEventGuardV042743?.version===GROUP_BOUND_REVIEW_EVENT_GUARD_VERSION)return true;
  installGroupBoundReviewSessionCache(scope);
  const consistency=scope.PokemonSleepMultiCaptureConsistency,api=sessionApi(scope);
  if(!consistency?.getState||!api?.model)return false;
  const tracker=createExactGroupSealTracker();
  installLegacyConflictJsonHide(scope);

  const canonicalize=(event,eventType)=>{
    const detail=event?.detail||{},id=text(detail.group_id);if(!id)return;
    let session=api.model.get(id),result=null;
    if(MANUAL_SAVE_REASONS.has(text(detail.reason))){
      session=api.model.manualReplace(id,detail.draft||session?.draft||{});
    }else if(detail.revision?.analysis_type==='ai'){
      api.model.activate(id,session?.draft||detail.draft||{});
      result=api.model.ingest(id,consistency.normalizeRevision(detail.revision),{analysis_id:detail.revision.analysis_id,source_ref:detail.revision.source_image_ref});
      session=result.session||api.model.get(id);
    }else if(!session){
      session=api.model.activate(id,detail.draft||{});
    }
    if(!session)return;
    detail.draft=clone(session.draft);
    trace(scope,'v042743_review_event_canonicalized',{event_type:eventType,group_id:id,reason:detail.reason||null,status:'completed',phase:session.phase,merge_status:result?.status||null,conflict_count:session.draft?.conflicts?.length||0,capture_phase_authority:true,selected_ai_revision_canonicalized:eventType==='selected'&&detail.revision?.analysis_type==='ai'});
  };

  // Capture phase makes the Group Session Cache authoritative before older bubble-phase
  // review renderers consume selected/merged events. The first selected AI revision and
  // every later merged AI revision therefore share one canonical session path.
  scope.addEventListener?.('pokemon-sleep:analysis-confirmation-group-selected',event=>canonicalize(event,'selected'),true);
  scope.addEventListener?.('pokemon-sleep:analysis-confirmation-merged',event=>canonicalize(event,'merged'),true);

  scope.document?.addEventListener?.('click',event=>{
    const run=event.target?.closest?.('#unifiedRun');if(!run)return;
    const frozen=tracker.freeze(selectedAssignments(scope));
    trace(scope,'v042743_group_source_expectations_frozen',{status:'completed',group_count:Object.keys(frozen.expected_by_logical||{}).length,selected_source_count:Object.values(frozen.expected_by_logical||{}).reduce((sum,items)=>sum+items.length,0),timeout_seal:false});
  },true);

  scope.addEventListener?.('pokemon-sleep:unified-analysis-stage',event=>{
    const detail=event?.detail||{};if(detail.stage!=='ai'||!detail.item_id)return;
    if(detail.state==='running'){
      const key=identityKey(scope),progress=tracker.bind(detail.item_id,key);
      if(progress)trace(scope,'v042743_group_source_identity_bound',{...progress,item_id:text(detail.item_id),status:'completed'});
      return;
    }
    if(detail.state!=='completed')return;
    const progress=tracker.complete(detail.item_id);if(!progress)return;
    trace(scope,'v042743_group_source_completed',{...progress,item_id:text(detail.item_id),status:'completed'});
    if(!progress.ready_to_seal)return;
    queueMicrotask(()=>{
      const group=coreGroupForIdentity(scope,progress.identity_key);if(!group){trace(scope,'v042743_exact_group_seal_blocked',{...progress,status:'blocked',reason:'GROUP_NOT_RESOLVED'});return;}
      const seeded=api.model.get(group.id)||api.model.activate(group.id,group.draft||{});
      const sealed=api.model.seal(group.id);
      trace(scope,'v042743_exact_group_ai_sealed',{...progress,group_id:group.id,status:'completed',phase:sealed?.phase||seeded?.phase||null,exact_assigned_source_completion:true,terminal_ai_session:true});
      if(text(consistency.getState()?.active_group_id)===text(group.id))api.reseedActiveSession?.(group.id,'exact_assigned_source_completion');
    });
  });

  const exported=Object.freeze({version:GROUP_BOUND_REVIEW_EVENT_GUARD_VERSION,tracker,getState:()=>tracker.getState()});
  scope.PokemonSleepGroupBoundReviewEventGuardV042743=exported;
  trace(scope,'v042743_review_event_guard_ready',{status:'completed',capture_phase_session_projection:true,selected_ai_revision_canonicalized:true,exact_group_source_count:true,ai_seal_terminal:true,background_dom_write:false,timeout_seal:false,legacy_conflict_json_hidden:true});
  return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installGroupBoundReviewEventGuard(globalThis);
