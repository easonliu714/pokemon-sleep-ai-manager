export const REVIEW_GROUP_ISOLATION_VERSION='v0.4.27.17-group-bound-snapshot-2026-08-19-a';
export const REVIEW_GROUP_SNAPSHOT_SOURCE_RESYNC_MARKER='v042717_snapshot_source_resync';
export const REVIEW_GROUP_FORM_AUTHORITY_VERSION='v0.4.27.18-immutable-form-group-2026-08-19-a';
export const PER_IMAGE_TARGET_ASSIGNMENT_VERSION='v0.4.27.18-per-image-target-assignment-2026-08-19-a';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const text=value=>String(value??'').trim();
const safeJson=value=>{try{return JSON.stringify(value);}catch{return String(value);}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// v0.4.27.17 predecessor factory is retained verbatim for historical regression replay.
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

// Historical installer remains available for predecessor replay, but v0.4.27.18 no longer uses
// mutable renderedGroupId + replaceActiveDraft as the production write authority.
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
  scope.PokemonSleepReviewGroupIsolation=controller;
  return true;
}

const DRAFT_SIGNATURE_FIELDS=[
  'species','nickname','level','sp','specialty','type','nature','nature_bonus','nature_penalty',
  'main_skill','main_skill_level','main_skill_description','helper_seconds','carry_limit','favorite_berry',
  'sleep_hours','sleep_time_text','registered_at','obtained_at','is_favorite',
  'evolution_level_required','evolution_sleep_hours_required','evolution_candy_required','evolution_item_required','evolution_other_requirement',
];
function draftSignature(draft){
  const value={};
  for(const field of DRAFT_SIGNATURE_FIELDS)value[field]=draft?.[field]??null;
  value.ingredients=Array.isArray(draft?.ingredients)?draft.ingredients:[];
  value.subskills=Array.isArray(draft?.subskills)?draft.subskills:[];
  return safeJson(value);
}
function revisionCount(draft){return Array.isArray(draft?.analysis_ids)?draft.analysis_ids.length:0;}
function sourceCount(draft){return Array.isArray(draft?.source_refs)?draft.source_refs.length:0;}

export function createImmutableFormGroupAuthority(api,{traceFn=()=>{},getVisibleGroupId=()=>null}={}){
  if(!api||typeof api.getState!=='function'||typeof api.selectGroup!=='function')throw new Error('v042718_group_authority_api_missing');
  const records=new Map();
  let renderedGroupId=null;
  const trace=(event,detail={})=>traceFn(event,{version:REVIEW_GROUP_FORM_AUTHORITY_VERSION,...detail});

  function noteRenderedGroup(groupId,{reason='group_selected'}={}){
    renderedGroupId=groupId||null;
    trace('v042718_rendered_form_group_bound',{group_id:renderedGroupId,reason});
    return renderedGroupId;
  }

  function acceptCoreDraft(groupId,draft,{reason='core_event'}={}){
    const id=text(groupId);if(!id||!draft)return null;
    const incoming=clone(draft),incomingRevisionCount=revisionCount(incoming),incomingSourceCount=sourceCount(incoming);
    const current=records.get(id);
    if(!current){
      const record={group_id:id,draft:incoming,dirty:false,revision_count:incomingRevisionCount,source_count:incomingSourceCount,signature:draftSignature(incoming)};
      records.set(id,record);
      trace('v042718_group_draft_seeded',{group_id:id,revision_count:incomingRevisionCount,source_count:incomingSourceCount,reason});
      return clone(record);
    }
    const newer=incomingRevisionCount>current.revision_count||incomingSourceCount>current.source_count;
    if(newer&&!current.dirty){
      current.draft=incoming;current.revision_count=incomingRevisionCount;current.source_count=incomingSourceCount;current.signature=draftSignature(incoming);
      trace('v042718_group_draft_refreshed_from_new_revision',{group_id:id,revision_count:incomingRevisionCount,source_count:incomingSourceCount,reason});
    }else if(draftSignature(incoming)!==current.signature){
      trace('v042718_stale_or_contaminated_core_draft_rejected',{group_id:id,dirty:current.dirty,incoming_revision_count:incomingRevisionCount,authority_revision_count:current.revision_count,reason});
    }
    return clone(current);
  }

  function replaceGroupDraft(groupId,draft,{reason='manual_navigation_snapshot'}={}){
    const id=text(groupId);if(!id)throw new Error('REVIEW_FORM_GROUP_ID_REQUIRED');
    const state=api.getState?.()||{};
    const group=(state.groups||[]).find(row=>row.id===id&&row.status!=='closed');
    if(!group)throw new Error('REVIEW_FORM_GROUP_NOT_OPEN');
    const incoming=clone(draft||{}),current=records.get(id)||acceptCoreDraft(id,group.draft||incoming,{reason:'replace_group_seed'});
    const beforeSignature=current?.signature||draftSignature(group.draft||{}),nextSignature=draftSignature(incoming);
    const dirty=Boolean(current?.dirty||beforeSignature!==nextSignature);
    const record={
      group_id:id,
      draft:incoming,
      dirty,
      revision_count:Math.max(current?.revision_count||0,revisionCount(incoming)),
      source_count:Math.max(current?.source_count||0,sourceCount(incoming)),
      signature:nextSignature,
    };
    records.set(id,record);
    trace('v042718_direct_group_draft_saved',{source_group_id:id,target_group_id:id,reason,dirty,revision_count:record.revision_count});
    return {id,draft:clone(incoming),group_id:id};
  }

  function visibleGroupId(){return text(getVisibleGroupId?.()||renderedGroupId)||null;}
  function replaceVisibleDraft(draft,{reason='manual_navigation_snapshot'}={}){
    const id=visibleGroupId();if(!id)throw new Error('REVIEW_VISIBLE_FORM_GROUP_ID_REQUIRED');
    return replaceGroupDraft(id,draft,{reason});
  }

  function navigateReviewGroupFrom(groupId,offset,{reason=null,createIfEmpty=false,fallbackNavigate=null}={}){
    const id=text(groupId);if(!id)throw new Error('REVIEW_NAV_SOURCE_GROUP_ID_REQUIRED');
    const ordered=(api.getState?.()?.groups||[]).filter(row=>row.status!=='closed').sort((a,b)=>(a.order||0)-(b.order||0));
    const index=ordered.findIndex(row=>row.id===id),step=Number(offset)<0?-1:1,target=ordered[index+step]||null;
    if(index<0)throw new Error('REVIEW_NAV_SOURCE_GROUP_NOT_FOUND');
    if(target){
      const selected=api.selectGroup(target.id,{reason:reason||(step<0?'manual_previous_pokemon':'manual_next_pokemon')});
      trace('v042718_direct_group_navigation',{source_group_id:id,target_group_id:selected?.id||null,direction:step<0?'previous':'next',reason});
      return selected;
    }
    if(step>0&&createIfEmpty&&typeof fallbackNavigate==='function'){
      api.selectGroup(id,{reason:'v042718_boundary_source_select'});
      return fallbackNavigate(1,{reason:reason||'manual_next_pokemon_new_group',createIfEmpty:true});
    }
    trace('v042718_direct_group_navigation_boundary',{source_group_id:id,direction:step<0?'previous':'next',reason});
    return null;
  }

  function navigateVisible(offset,options={}){
    const id=visibleGroupId();if(!id)throw new Error('REVIEW_VISIBLE_FORM_GROUP_ID_REQUIRED');
    return navigateReviewGroupFrom(id,offset,options);
  }

  function getDraft(groupId){return clone(records.get(text(groupId))?.draft||null);}
  function getRecord(groupId){return clone(records.get(text(groupId))||null);}
  function close(groupId){records.delete(text(groupId));}

  return Object.freeze({
    version:REVIEW_GROUP_FORM_AUTHORITY_VERSION,
    noteRenderedGroup,acceptCoreDraft,replaceGroupDraft,replaceVisibleDraft,navigateReviewGroupFrom,navigateVisible,getDraft,getRecord,close,
    getState:()=>({rendered_group_id:renderedGroupId,visible_group_id:visibleGroupId(),group_ids:[...records.keys()]}),
  });
}

function dispatchCorrected(scope,eventName,detail,draft){
  scope.dispatchEvent?.(new CustomEvent(eventName,{detail:{...detail,draft:clone(draft),v042718_form_authority_corrected:true}}));
}

export function installReviewGroupAuthorityV042718(scope=globalThis){
  const api=scope?.PokemonSleepMultiCaptureConsistency;
  if(!api||typeof scope?.addEventListener!=='function')return false;
  if(api.review_group_form_authority_version===REVIEW_GROUP_FORM_AUTHORITY_VERSION)return true;
  const previousNavigate=typeof api.navigateReviewGroup==='function'?api.navigateReviewGroup.bind(api):null;
  const traceFn=(event,detail={})=>{
    scope.UpdateCenterLiveDebug?.record?.(event,detail);
    scope.DebugTrace?.record?.('ai_review',event,{status:'completed',details:detail});
  };
  const domVisibleGroupId=()=>scope.document?.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation')?.dataset?.v042718GroupId||null;
  const authority=createImmutableFormGroupAuthority(api,{traceFn,getVisibleGroupId:domVisibleGroupId});

  const bindDomGroup=id=>{
    const form=scope.document?.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation');
    if(form){form.dataset.v042718GroupId=id||'';form.dataset.reviewGroupFormAuthorityVersion=REVIEW_GROUP_FORM_AUTHORITY_VERSION;}
  };
  const reconcile=(eventName,detail={})=>{
    const id=detail.group_id||null;if(!id||!detail.draft)return;
    authority.noteRenderedGroup(id,{reason:detail.reason||eventName});bindDomGroup(id);
    if(detail.v042718_form_authority_corrected)return;
    const record=authority.acceptCoreDraft(id,detail.draft,{reason:detail.reason||eventName});
    if(record?.draft&&draftSignature(record.draft)!==draftSignature(detail.draft)){
      traceFn('v042718_confirmation_event_corrected',{event_name:eventName,group_id:id,reason:detail.reason||null});
      dispatchCorrected(scope,eventName,detail,record.draft);
    }
  };

  scope.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',event=>reconcile('pokemon-sleep:analysis-confirmation-group-selected',event.detail||{}));
  scope.addEventListener('pokemon-sleep:analysis-confirmation-merged',event=>reconcile('pokemon-sleep:analysis-confirmation-merged',event.detail||{}));
  scope.addEventListener('pokemon-sleep:analysis-confirmation-terminal',event=>{
    const id=event?.detail?.group_id||null;if(id)authority.close(id);
  });

  api.replaceGroupDraft=(groupId,draft,options={})=>authority.replaceGroupDraft(groupId,draft,options);
  api.navigateReviewGroupFrom=(groupId,offset,options={})=>authority.navigateReviewGroupFrom(groupId,offset,{...options,fallbackNavigate:previousNavigate});
  api.replaceActiveDraft=(draft,options={})=>authority.replaceVisibleDraft(draft,options);
  api.navigateReviewGroup=(offset,options={})=>authority.navigateVisible(offset,{...options,fallbackNavigate:previousNavigate});
  api.advanceReviewGroup=(options={})=>authority.navigateVisible(1,{reason:options.reason||'manual_next_pokemon',createIfEmpty:options.createIfEmpty!==false,fallbackNavigate:previousNavigate});
  api.review_group_form_authority_version=REVIEW_GROUP_FORM_AUTHORITY_VERSION;
  api.getFormGroupAuthorityState=authority.getState;
  scope.PokemonSleepReviewGroupAuthorityV042718=authority;
  traceFn('v042718_review_group_form_authority_ready',{version:REVIEW_GROUP_FORM_AUTHORITY_VERSION,explicit_group_id_write:true,mutable_active_pointer_not_write_authority:true});
  return true;
}

const assignmentState=new Map();
const existingContextCache=new Map();
const newContextCache=new Map();
const batchRuntime={active:false,contextByItemId:new Map(),assignmentByItemId:new Map()};
const wiredWorkbenches=new WeakSet();

function assignmentReady(assignment){
  return Boolean(assignment&&(assignment.mode==='existing'?text(assignment.pokemon_id):assignment.mode==='new'?text(assignment.new_group_key):false));
}
function normalizeAssignment(row={}){
  const mode=row.mode==='existing'?'existing':row.mode==='new'?'new':'';
  return {mode,pokemon_id:mode==='existing'?text(row.pokemon_id):'',new_group_key:mode==='new'?text(row.new_group_key):''};
}

export async function preparePerImageTargetContexts(assignments,identityApi,{existingCache=existingContextCache,newCache=newContextCache}={}){
  if(!identityApi)throw new Error('PER_IMAGE_TARGET_IDENTITY_API_MISSING');
  const contextByItemId=new Map(),normalized=[];
  for(const raw of assignments||[]){
    const itemId=text(raw?.item_id),assignment=normalizeAssignment(raw);
    if(!itemId||!assignmentReady(assignment))throw new Error('PER_IMAGE_TARGET_ASSIGNMENT_INCOMPLETE');
    let context;
    if(assignment.mode==='existing'){
      if(!existingCache.has(assignment.pokemon_id))existingCache.set(assignment.pokemon_id,await identityApi.createExistingPokemonAnalysisContext(assignment.pokemon_id));
      context=existingCache.get(assignment.pokemon_id);
    }else{
      if(!newCache.has(assignment.new_group_key))newCache.set(assignment.new_group_key,identityApi.createNewPokemonAnalysisContext());
      context=newCache.get(assignment.new_group_key);
    }
    contextByItemId.set(itemId,context);
    normalized.push({item_id:itemId,...assignment});
  }
  return {contextByItemId,assignments:normalized,unique_existing_targets:new Set(normalized.filter(row=>row.mode==='existing').map(row=>row.pokemon_id)).size,unique_new_groups:new Set(normalized.filter(row=>row.mode==='new').map(row=>row.new_group_key)).size};
}

function rosterOptions(identityApi){
  try{return (identityApi.listActivePokemonAnalysisTargets?.()||[]).map(row=>`<option value="${esc(row.pokemon_id)}">${esc(row.target_label)} · ${esc(row.target_species)} · Lv.${esc(row.level??'—')} · SP ${esc(row.sp??'—')}</option>`).join('');}catch{return '';}
}
function newGroupOptions(){return Array.from({length:12},(_,index)=>`<option value="new-${index+1}">新增寶可夢群組 ${index+1}</option>`).join('');}
function selectedItemIds(node){return [...node.querySelectorAll('[data-unified-item]:checked')].map(box=>text(box.value)).filter(Boolean);}
function assignmentFor(id){return assignmentState.get(id)||{mode:'',pokemon_id:'',new_group_key:''};}
function selectedAssignments(node){return selectedItemIds(node).map(item_id=>({item_id,...assignmentFor(item_id)}));}

function renderAssignmentSummary(card,id,identityApi){
  const assignment=assignmentFor(id),summary=card.querySelector('[data-v042718-assignment-summary]');if(!summary)return;
  if(assignment.mode==='existing'){
    const row=(identityApi.listActivePokemonAnalysisTargets?.()||[]).find(item=>String(item.pokemon_id)===assignment.pokemon_id);
    summary.textContent=assignment.pokemon_id?`既有：${row?.target_label||row?.target_species||'已選成員'}`:'尚未選擇既有寶可夢';
  }else if(assignment.mode==='new')summary.textContent=assignment.new_group_key?`新增：${assignment.new_group_key.replace('new-','群組 ')}`:'尚未選擇新增群組';
  else summary.textContent='尚未指定這張圖片的寶可夢';
}

function setTextIfChanged(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function syncPerImageRunGate(node){
  const run=node.querySelector('#unifiedRun');if(!run)return;
  const ids=selectedItemIds(node),strategy=node.querySelector('#unifiedStrategy')?.value||'',needsAi=['ocr_ai','ai_only'].includes(strategy),consent=Boolean(node.querySelector('#unifiedAiConsent')?.checked);
  const allAssigned=ids.length>0&&ids.every(id=>assignmentReady(assignmentFor(id)));
  run.disabled=!ids.length||!allAssigned||(needsAi&&!consent);
  setTextIfChanged(run,ids.length?`開始一條龍辨識（${ids.length}，逐圖綁定）`:'開始一條龍辨識');
  const notice=node.querySelector('#v042718AssignmentGateNotice');
  if(notice){
    const assigned=ids.filter(id=>assignmentReady(assignmentFor(id))).length;
    const className=`notice ${allAssigned?'success':'pending'}`;
    if(notice.className!==className)notice.className=className;
    setTextIfChanged(notice,ids.length?`已選 ${ids.length} 張；完成目標指定 ${assigned}/${ids.length}。${allAssigned?'可一次處理多位寶可夢。':'請替每張已勾選圖片指定既有成員或新增群組。'}`:'請先勾選圖片，再逐張指定資料目標。');
  }
}

async function prepareBatch(node,identityApi){
  const assignments=selectedAssignments(node);if(!assignments.length)throw new Error('請先選擇圖片');
  if(assignments.some(row=>!assignmentReady(row)))throw new Error('每張已選圖片都必須指定寶可夢目標');
  const prepared=await preparePerImageTargetContexts(assignments,identityApi);
  batchRuntime.contextByItemId=prepared.contextByItemId;batchRuntime.assignmentByItemId=new Map(prepared.assignments.map(row=>[row.item_id,row]));batchRuntime.active=true;
  return prepared;
}

function setCompatibilityRunTarget(node,firstAssignment){
  const mode=node.querySelector('#unifiedTargetMode'),existing=node.querySelector('#unifiedExistingTarget');if(!mode)return;
  if(firstAssignment?.mode==='existing'){mode.value='existing_pokemon';if(existing)existing.value=firstAssignment.pokemon_id||'';}
  else mode.value='new_pokemon';
}

function wirePerImageTargetWorkbench(scope,node,identityApi){
  if(!node?.querySelector?.('.light-review-list')||!identityApi)return false;
  const oldPanel=node.querySelector('#unifiedIdentityTargetPanel');if(oldPanel)oldPanel.classList.add('hidden');
  const legacyBanner=[...node.children].find(child=>child.matches?.('.notice.success')&&child.textContent?.includes('v0.4.27.16 Platform Identity'));
  if(legacyBanner)legacyBanner.classList.add('hidden');
  if(!node.querySelector('#v042718PerImageTargetNotice')){
    const notice=scope.document.createElement('section');notice.id='v042718PerImageTargetNotice';notice.className='panel';notice.innerHTML=`<h3>1. 每張圖片指定寶可夢</h3><div class="notice success"><strong>v0.4.27.18 Per-Image Target Assignment</strong><br>同一批可以混合多位寶可夢。每張圖獨立選「既有」或「新增」；選既有時從目前名單指定個體，選新增時用相同的「新增寶可夢群組」把同一隻新寶可夢的多張圖綁在一起。平台 identity 只留在本機，AI 不負責決定玩家個體。</div><div id="v042718AssignmentGateNotice" class="notice pending">請先勾選圖片，再逐張指定資料目標。</div>`;
    oldPanel?.insertAdjacentElement('beforebegin',notice);
  }
  const roster=rosterOptions(identityApi),newGroups=newGroupOptions();
  for(const card of node.querySelectorAll('.light-review-item')){
    const checkbox=card.querySelector('[data-unified-item]'),id=text(checkbox?.value);if(!id||card.querySelector('[data-v042718-target-assignment]'))continue;
    const assignment=assignmentFor(id),section=scope.document.createElement('section');section.className='notice';section.dataset.v042718TargetAssignment=id;
    section.innerHTML=`<strong>這張圖片的資料目標</strong><div class="filter-bar"><label>模式 <select data-v042718-target-mode><option value="">請選擇</option><option value="existing">更新既有寶可夢</option><option value="new">新增寶可夢</option></select></label><label data-v042718-existing-wrap class="hidden">既有寶可夢 <select data-v042718-existing-target><option value="">請選擇既有寶可夢</option>${roster}</select></label><label data-v042718-new-wrap class="hidden">新增群組 <select data-v042718-new-group><option value="">請選擇群組</option>${newGroups}</select></label></div><small data-v042718-assignment-summary></small>`;
    card.append(section);
    const mode=section.querySelector('[data-v042718-target-mode]'),existing=section.querySelector('[data-v042718-existing-target]'),newGroup=section.querySelector('[data-v042718-new-group]');
    mode.value=assignment.mode||'';existing.value=assignment.pokemon_id||'';newGroup.value=assignment.new_group_key||'';
    section.querySelector('[data-v042718-existing-wrap]').classList.toggle('hidden',assignment.mode!=='existing');
    section.querySelector('[data-v042718-new-wrap]').classList.toggle('hidden',assignment.mode!=='new');
    renderAssignmentSummary(card,id,identityApi);
  }

  if(!wiredWorkbenches.has(node)){
    wiredWorkbenches.add(node);
    node.addEventListener('change',event=>{
      const section=event.target?.closest?.('[data-v042718-target-assignment]');
      if(section){
        const id=text(section.dataset.v042718TargetAssignment),mode=section.querySelector('[data-v042718-target-mode]')?.value||'',existing=section.querySelector('[data-v042718-existing-target]')?.value||'',newGroup=section.querySelector('[data-v042718-new-group]')?.value||'';
        const assignment=normalizeAssignment({mode,pokemon_id:existing,new_group_key:newGroup});assignmentState.set(id,assignment);
        section.querySelector('[data-v042718-existing-wrap]')?.classList.toggle('hidden',assignment.mode!=='existing');
        section.querySelector('[data-v042718-new-wrap]')?.classList.toggle('hidden',assignment.mode!=='new');
        renderAssignmentSummary(section.closest('.light-review-item'),id,identityApi);
      }
      setTimeout(()=>syncPerImageRunGate(node),0);
    });
    node.addEventListener('click',()=>setTimeout(()=>syncPerImageRunGate(node),0));
  }

  const run=node.querySelector('#unifiedRun');
  if(run&&!run.dataset.v042718Wrapped&&typeof run.onclick==='function'){
    const originalRun=run.onclick;run.dataset.v042718Wrapped='1';
    run.onclick=async function(event){
      let prepared=null;
      try{
        prepared=await prepareBatch(node,identityApi);
        setCompatibilityRunTarget(node,prepared.assignments[0]);
        const traceDetail={selected_count:prepared.assignments.length,unique_existing_targets:prepared.unique_existing_targets,unique_new_groups:prepared.unique_new_groups,per_image_target_assignment:true};
        scope.UpdateCenterLiveDebug?.record?.('v042718_per_image_batch_prepared',traceDetail);
        scope.DebugTrace?.record?.('unified_pipeline','v042718_per_image_batch_prepared',{status:'completed',details:traceDetail});
        await originalRun.call(this,event);
        const status=node.querySelector('#unifiedStatus');if(status&&!status.classList.contains('error')){status.className='notice success';setTextIfChanged(status,`一條龍辨識完成：${prepared.assignments.length} 張；本批已依每張圖片的本機 target assignment 分流，可同時包含多位既有／新增寶可夢。`);}
      }catch(error){
        const status=node.querySelector('#unifiedStatus');if(status){status.className='notice error';setTextIfChanged(status,`逐圖目標準備失敗：${error?.message||error}`);}
      }finally{
        batchRuntime.active=false;batchRuntime.contextByItemId=new Map();batchRuntime.assignmentByItemId=new Map();setTimeout(()=>syncPerImageRunGate(node),0);
      }
    };
  }
  syncPerImageRunGate(node);return true;
}

export function installPerImageTargetAssignmentV042718(scope=globalThis){
  if(!scope?.document||typeof scope.addEventListener!=='function')return false;
  if(scope.PokemonSleepPerImageTargetAssignmentV042718?.version===PER_IMAGE_TARGET_ASSIGNMENT_VERSION)return true;
  const stageHandler=event=>{
    const detail=event?.detail||{};if(!batchRuntime.active||detail.state!=='running'||!detail.item_id)return;
    const context=batchRuntime.contextByItemId.get(String(detail.item_id));if(!context)return;
    const identityApi=scope.PokemonSleepAnalysisTargetIdentity;if(!identityApi?.setActiveAnalysisTargetContext)return;
    identityApi.setActiveAnalysisTargetContext(context);
    const assignment=batchRuntime.assignmentByItemId.get(String(detail.item_id));
    const safe={item_id:String(detail.item_id),stage:detail.stage,target_mode:assignment?.mode||context.mode,existing_target:Boolean(assignment?.mode==='existing'),new_capture_group:Boolean(assignment?.mode==='new'),private_target_ids_exported:false};
    scope.UpdateCenterLiveDebug?.record?.('v042718_per_image_context_activated',safe);
    scope.DebugTrace?.record?.('unified_pipeline','v042718_per_image_context_activated',{status:'completed',details:safe});
  };
  scope.addEventListener('pokemon-sleep:unified-analysis-stage',stageHandler);
  const wire=()=>{
    const node=scope.document.getElementById('unifiedImportAnalysisWorkbench'),identityApi=scope.PokemonSleepAnalysisTargetIdentity;
    if(node&&identityApi)wirePerImageTargetWorkbench(scope,node,identityApi);
  };
  scope.addEventListener('pokemon-sleep:identity-import-files-selected',()=>{
    assignmentState.clear();existingContextCache.clear();newContextCache.clear();batchRuntime.active=false;batchRuntime.contextByItemId=new Map();batchRuntime.assignmentByItemId=new Map();
    setTimeout(()=>wire(),0);
    setTimeout(()=>wire(),50);
    setTimeout(()=>wire(),250);
  });
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;wire();
    if((scope.document.getElementById('unifiedImportAnalysisWorkbench')&&scope.PokemonSleepAnalysisTargetIdentity)||attempts>=100)clearInterval(timer);
  },100);
  wire();
  scope.PokemonSleepPerImageTargetAssignmentV042718=Object.freeze({version:PER_IMAGE_TARGET_ASSIGNMENT_VERSION,getAssignments:()=>[...assignmentState.entries()].map(([item_id,row])=>({item_id,...clone(row)})),sync:wire});
  return true;
}

function installSuccessorWhenReady(scope=globalThis,attempt=0){
  const groupReady=installReviewGroupAuthorityV042718(scope),targetReady=installPerImageTargetAssignmentV042718(scope);
  if(groupReady&&targetReady)return;
  if(attempt>=120)return;
  setTimeout(()=>installSuccessorWhenReady(scope,attempt+1),50);
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined'&&typeof globalThis.addEventListener==='function')installSuccessorWhenReady(globalThis);
