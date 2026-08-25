export const EXPLICIT_MANUAL_DRAFT_SAVE_VERSION='v0.4.27.38-authoritative-draft-navigation-2026-08-25-a';
export const EXPLICIT_MANUAL_DRAFT_SAVE_REASON='explicit_manual_save_v042738';
export const SINGLE_CONFIRMATION_AUTHORITY_VERSION='v0.4.27.39-single-confirmation-authority-2026-08-25-a';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const text=value=>String(value??'').trim();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const trace=(scope,event,detail={})=>{
  const payload={version:EXPLICIT_MANUAL_DRAFT_SAVE_VERSION,single_confirmation_authority_version:SINGLE_CONFIRMATION_AUTHORITY_VERSION,...detail};
  scope.UpdateCenterLiveDebug?.record?.(event,payload);
  scope.DebugTrace?.record?.('ai_review',event,{status:detail.status||'completed',details:payload});
};

export function isLegacyCorrectedConfirmationEvent(detail={}){
  return detail?.v042718_form_authority_corrected===true;
}

export function revisionAuthorityFromDetail(detail={}){
  const revision=detail?.revision||{};
  return {
    group_id:text(detail?.group_id)||null,
    analysis_id:text(revision?.analysis_id)||null,
    revision_no:revision?.revision_no==null?null:Number(revision.revision_no),
    source_image_ref:text(revision?.source_image_ref)||null,
  };
}

export function revisionAuthorityMatches(expected={},state={}){
  const groupId=text(expected?.group_id);
  if(!groupId)return {ok:false,status:'MISSING_GROUP_ID'};
  if(text(state?.active_group_id)!==groupId)return {ok:false,status:'GROUP_MISMATCH',expected_group_id:groupId,active_group_id:text(state?.active_group_id)||null};
  const group=(state?.groups||[]).find(row=>text(row?.id)===groupId);
  if(!group)return {ok:false,status:'GROUP_NOT_FOUND',expected_group_id:groupId};
  const latest=group.latest_revision||{};
  const expectedAnalysis=text(expected?.analysis_id),actualAnalysis=text(latest?.analysis_id);
  const expectedRevision=expected?.revision_no==null?null:Number(expected.revision_no);
  const actualRevision=latest?.revision_no==null?null:Number(latest.revision_no);
  if(!expectedAnalysis||expectedRevision==null)return {ok:false,status:'MISSING_REVISION_AUTHORITY'};
  if(expectedAnalysis!==actualAnalysis||expectedRevision!==actualRevision){
    return {ok:false,status:'STALE_REVISION',expected_analysis_id:expectedAnalysis,actual_analysis_id:actualAnalysis||null,expected_revision_no:expectedRevision,actual_revision_no:actualRevision};
  }
  const expectedRef=text(expected?.source_image_ref),actualRef=text(latest?.source_image_ref);
  if(expectedRef&&actualRef&&expectedRef!==actualRef)return {ok:false,status:'SOURCE_IMAGE_MISMATCH',expected_source_image_ref:expectedRef,actual_source_image_ref:actualRef};
  return {ok:true,status:'AUTHORITY_MATCH',group};
}

export function classifyFormSnapshot({expected={},current={},touched_keys=[]}={}){
  const touched=new Set(touched_keys||[]),manual=[],unauthorized=[];
  for(const key of new Set([...Object.keys(expected||{}),...Object.keys(current||{})])){
    if(same(expected?.[key],current?.[key]))continue;
    (touched.has(key)?manual:unauthorized).push(key);
  }
  return {
    clean:manual.length===0&&unauthorized.length===0,
    manual_dirty:manual.length>0,
    unauthorized_drift:unauthorized.length>0,
    manual_keys:manual,
    unauthorized_keys:unauthorized,
  };
}

export function confirmationActionPolicy({action='',classification={}}={}){
  const manualDirty=Boolean(classification?.manual_dirty);
  const systemDrift=Boolean(classification?.unauthorized_drift);
  return {
    allowed:!manualDirty,
    block_reason:manualDirty?'UNSAVED_MANUAL_CHANGES':null,
    discard_system_drift:systemDrift,
    prepare_authoritative_apply:action==='applyConfirmedAnalysis'&&systemDrift&&!manualDirty,
  };
}

function nodeValue(node){
  if(!node)return null;
  if(node.type==='checkbox')return Boolean(node.checked);
  if(node.type==='number')return node.value===''?null:Number(node.value);
  return String(node.value??'').trim();
}
function setNodeValue(node,value){
  if(!node)return;
  if(node.type==='checkbox'){node.checked=Boolean(value);return;}
  node.value=value==null?'':String(value);
}
function nodeKey(node){
  if(node?.dataset?.field)return `field:${node.dataset.field}`;
  if(node?.dataset?.check)return `check:${node.dataset.check}`;
  return null;
}
function rowAt(rows,level){return (Array.isArray(rows)?rows:[]).find(row=>Number(row?.unlock_level)===Number(level))||null;}
function expectedForField(draft,name,node){
  let match=name.match(/^ingredient_name_(\d+)$/);if(match)return text(rowAt(draft?.ingredients,match[1])?.ingredient_name);
  match=name.match(/^ingredient_qty_(\d+)$/);if(match){const value=rowAt(draft?.ingredients,match[1])?.quantity;return value==null?null:Number(value);}
  match=name.match(/^subskill_name_(\d+)$/);if(match)return text(rowAt(draft?.subskills,match[1])?.subskill_name);
  const value=draft?.[name];
  if(node?.type==='number')return value==null||value===''?null:Number(value);
  return text(value);
}
function expectedForCheck(draft,name){
  const match=name.match(/^sub_unlock_(\d+)$/);if(!match)return false;
  return Boolean(rowAt(draft?.subskills,match[1])?.is_unlocked);
}

export function snapshotForm(root,draft={}){
  const expected={},current={};
  for(const node of root?.querySelectorAll?.('[data-field]')||[]){
    const key=nodeKey(node);if(!key)continue;
    expected[key]=expectedForField(draft,node.dataset.field,node);
    current[key]=nodeValue(node);
  }
  for(const node of root?.querySelectorAll?.('[data-check]')||[]){
    const key=nodeKey(node);if(!key)continue;
    expected[key]=expectedForCheck(draft,node.dataset.check);
    current[key]=Boolean(node.checked);
  }
  return {expected,current};
}

export function projectAuthoritativeForm(root,draft={}){
  const projected=[];
  for(const node of root?.querySelectorAll?.('[data-field]')||[]){
    const key=nodeKey(node);if(!key)continue;
    const expected=expectedForField(draft,node.dataset.field,node);
    if(!same(nodeValue(node),expected)){setNodeValue(node,expected);projected.push(key);}
  }
  for(const node of root?.querySelectorAll?.('[data-check]')||[]){
    const key=nodeKey(node);if(!key)continue;
    const expected=expectedForCheck(draft,node.dataset.check);
    if(Boolean(node.checked)!==Boolean(expected)){node.checked=Boolean(expected);projected.push(key);}
  }
  return projected;
}

function scalarFieldName(key){return key.startsWith('field:')?key.slice(6):null;}
function rebuildIngredientLevel(out,root,level){
  const rows=new Map((Array.isArray(out.ingredients)?out.ingredients:[]).map(row=>[Number(row.unlock_level),clone(row)]));
  const name=text(root.querySelector(`[data-field="ingredient_name_${level}"]`)?.value);
  const qtyNode=root.querySelector(`[data-field="ingredient_qty_${level}"]`);
  const quantity=qtyNode?.value===''||qtyNode==null?null:Number(qtyNode.value);
  if(!name)rows.delete(Number(level));
  else rows.set(Number(level),{unlock_level:Number(level),ingredient_name:name,quantity:Number.isFinite(quantity)?quantity:null});
  out.ingredients=[...rows.values()].sort((a,b)=>a.unlock_level-b.unlock_level);
}
function rebuildSubskillLevel(out,root,level){
  const rows=new Map((Array.isArray(out.subskills)?out.subskills:[]).map(row=>[Number(row.unlock_level),clone(row)]));
  const name=text(root.querySelector(`[data-field="subskill_name_${level}"]`)?.value);
  const unlocked=Boolean(root.querySelector(`[data-check="sub_unlock_${level}"]`)?.checked);
  if(!name)rows.delete(Number(level));
  else rows.set(Number(level),{unlock_level:Number(level),subskill_name:name,is_unlocked:unlocked?1:0});
  out.subskills=[...rows.values()].sort((a,b)=>a.unlock_level-b.unlock_level);
}

export function applyManualPatch(rawDraft={},root,manualKeys=[]){
  const out=clone(rawDraft)||{};
  const ingredientLevels=new Set(),subskillLevels=new Set();
  for(const key of manualKeys||[]){
    const field=scalarFieldName(key);
    let match=field?.match(/^ingredient_(?:name|qty)_(\d+)$/);if(match){ingredientLevels.add(Number(match[1]));continue;}
    match=field?.match(/^subskill_name_(\d+)$/);if(match){subskillLevels.add(Number(match[1]));continue;}
    match=key.match(/^check:sub_unlock_(\d+)$/);if(match){subskillLevels.add(Number(match[1]));continue;}
    if(!field)continue;
    const node=root?.querySelector?.(`[data-field="${field}"]`);if(!node)continue;
    out[field]=nodeValue(node);
  }
  for(const level of ingredientLevels)rebuildIngredientLevel(out,root,level);
  for(const level of subskillLevels)rebuildSubskillLevel(out,root,level);
  return out;
}

export function installExplicitManualDraftSave(scope=globalThis){
  const consistency=scope?.PokemonSleepMultiCaptureConsistency;
  if(!consistency||typeof consistency.getState!=='function'||typeof consistency.replaceActiveDraft!=='function')return false;
  const installed=scope.PokemonSleepSingleConfirmationAuthorityV042739||scope.PokemonSleepExplicitManualDraftSaveV042738||scope.PokemonSleepExplicitManualDraftSaveV042737;
  if(installed?.single_confirmation_authority_version===SINGLE_CONFIRMATION_AUTHORITY_VERSION)return true;

  const originalReplace=consistency.replaceActiveDraft.bind(consistency);
  const legacyReplace=consistency.replaceActiveDraft;
  consistency.replaceActiveDraft=(draft,{reason='legacy_implicit_snapshot'}={})=>{
    if(reason===EXPLICIT_MANUAL_DRAFT_SAVE_REASON)return originalReplace(draft,{reason});
    trace(scope,'v042738_implicit_draft_write_blocked',{reason,status:'blocked',active_group_id:consistency.getState()?.active_group_id||null});
    return null;
  };

  let authority=null,authoritativeDraft=null,lastStatus=null,lastDriftSignature='',projectionSequence=0;
  const touched=new Set();
  const root=()=>scope.document?.getElementById?.('analysisConfirmationWorkbench')||null;
  const confirmation=()=>root()?.querySelector?.('.analysis-confirmation')||null;
  const statusNode=()=>root()?.querySelector?.('#manualDraftStatusV042738')||null;
  const setStatus=(message,kind='')=>{
    lastStatus={message,kind};const node=statusNode();if(!node)return;
    node.className=`notice${kind?` ${kind}`:''}`;node.textContent=message;
  };
  const currentClassification=()=>{
    const currentRoot=root();if(!currentRoot||!authoritativeDraft)return {clean:true,manual_dirty:false,unauthorized_drift:false,manual_keys:[],unauthorized_keys:[]};
    const snapshots=snapshotForm(currentRoot,authoritativeDraft);
    return classifyFormSnapshot({...snapshots,touched_keys:[...touched]});
  };
  const traceSystemDrift=state=>{
    if(!state.unauthorized_drift)return;
    const signature=state.unauthorized_keys.join('|');if(signature===lastDriftSignature)return;
    lastDriftSignature=signature;
    trace(scope,'v042738_system_dom_drift_isolated',{group_id:authority?.group_id||null,fields:state.unauthorized_keys,status:'isolated',write_authority:false,navigation_blocked:false});
  };
  const refreshDirtyStatus=()=>{
    const state=currentClassification();
    if(state.manual_dirty){setStatus('有尚未儲存的人工修改。請先儲存或還原，才能切換寶可夢或確認處置。','pending');return state;}
    traceSystemDrift(state);
    if(!lastStatus||['pending','error'].includes(lastStatus.kind))setStatus(state.unauthorized_drift?'目前沒有尚未儲存的人工修改；系統顯示差異不具寫入權，切換時會直接丟棄。':'目前沒有尚未儲存的人工修改。','');
    return state;
  };
  const mount=()=>{
    const area=confirmation();if(!area)return false;
    let panel=area.querySelector('#manualDraftAuthorityV042738');
    if(!panel){
      panel=scope.document.createElement('section');panel.id='manualDraftAuthorityV042738';panel.className='notice';
      panel.innerHTML='<strong>人工修改 Authority</strong><br><span>切換寶可夢不會自動保存表單。只有按「儲存人工修改」才會永久覆寫目前草稿。</span><div class="buttons"><button type="button" id="saveManualAnalysisDraftV042738">儲存人工修改</button><button type="button" id="revertManualAnalysisDraftV042738" class="secondary">還原目前草稿</button></div><div id="manualDraftStatusV042738" class="notice"></div>';
      const nav=area.querySelector('.analysis-review-navigation');(nav||area.querySelector('header'))?.insertAdjacentElement('afterend',panel);
      panel.querySelector('#saveManualAnalysisDraftV042738').onclick=saveManual;
      panel.querySelector('#revertManualAnalysisDraftV042738').onclick=()=>revertManual('user_revert');
    }
    if(lastStatus)setStatus(lastStatus.message,lastStatus.kind);else refreshDirtyStatus();
    return true;
  };
  const acceptDetail=(detail={},reason='selected')=>{
    if(isLegacyCorrectedConfirmationEvent(detail))return false;
    authority=revisionAuthorityFromDetail(detail);
    authoritativeDraft=detail?.draft?clone(detail.draft):null;
    touched.clear();lastStatus=null;lastDriftSignature='';
    mount();refreshDirtyStatus();
    trace(scope,'v042738_manual_authority_refreshed',{reason,group_id:authority.group_id,analysis_id:authority.analysis_id,revision_no:authority.revision_no,status:'completed'});
    return true;
  };
  const scheduleAuthoritativeRender=(detail={},reason='core_event')=>{
    const expected=revisionAuthorityFromDetail(detail),token=++projectionSequence;
    if(!expected.group_id||!expected.analysis_id||expected.revision_no==null)return token;
    queueMicrotask(()=>{
      if(token!==projectionSequence)return;
      const match=revisionAuthorityMatches(expected,consistency.getState());
      if(!match.ok||text(authority?.group_id)!==text(expected.group_id)){
        trace(scope,'v042739_authoritative_render_skipped',{reason,status:'blocked',match_status:match.status||null,expected_group_id:expected.group_id,active_group_id:consistency.getState()?.active_group_id||null});
        return;
      }
      const projected=projectAuthoritativeForm(root(),authoritativeDraft||{});
      trace(scope,'v042739_authoritative_render_committed',{reason,status:'completed',group_id:expected.group_id,analysis_id:expected.analysis_id,revision_no:expected.revision_no,field_count:projected.length,fields:projected,legacy_dom_writer_count:0,single_confirmation_authority:true});
      refreshDirtyStatus();
    });
    return token;
  };
  function revertManual(reason='manual_revert'){
    if(!authority?.group_id)return false;
    touched.clear();lastDriftSignature='';lastStatus={message:'已還原為目前群組的已儲存草稿。',kind:'success'};
    consistency.selectGroup?.(authority.group_id,{reason:`${reason}_v042738`});
    trace(scope,'v042738_manual_draft_reverted',{group_id:authority.group_id,reason,status:'completed'});
    return true;
  }
  function saveManual(){
    const currentRoot=root();if(!currentRoot||!authority)return {ok:false,status:'NO_ACTIVE_CONFIRMATION'};
    const classification=currentClassification();
    if(!classification.manual_dirty){
      traceSystemDrift(classification);
      setStatus(classification.unauthorized_drift?'沒有需要儲存的人工修改；系統顯示差異不會寫回草稿。':'沒有需要儲存的人工修改。','');
      return {ok:true,status:'NO_MANUAL_CHANGES',discarded_system_drift:classification.unauthorized_keys};
    }
    const state=consistency.getState(),match=revisionAuthorityMatches(authority,state);
    if(!match.ok){setStatus(`儲存已阻擋：${match.status}。分析 revision 已改變，請重新覆核。`,'error');trace(scope,'v042738_manual_draft_save_blocked',{...match,status:'blocked'});return match;}
    const patched=applyManualPatch(match.group.draft,currentRoot,classification.manual_keys);
    originalReplace(patched,{reason:EXPLICIT_MANUAL_DRAFT_SAVE_REASON});
    touched.clear();lastDriftSignature='';lastStatus={message:'人工修改已儲存到目前寶可夢草稿。',kind:'success'};
    consistency.selectGroup?.(authority.group_id,{reason:EXPLICIT_MANUAL_DRAFT_SAVE_REASON});
    trace(scope,'v042738_manual_draft_saved',{group_id:authority.group_id,analysis_id:authority.analysis_id,revision_no:authority.revision_no,field_count:classification.manual_keys.length,fields:classification.manual_keys,discarded_system_drift:classification.unauthorized_keys,status:'completed'});
    return {ok:true,status:'SAVED',manual_keys:classification.manual_keys,discarded_system_drift:classification.unauthorized_keys};
  }

  const guardAction=event=>{
    const id=event?.target?.id;
    if(!['previousAnalysisGroup','nextAnalysisGroup','applyConfirmedAnalysis'].includes(id))return;
    const classification=currentClassification();
    const policy=confirmationActionPolicy({action:id,classification});
    if(!policy.allowed){
      event.preventDefault?.();event.stopImmediatePropagation?.();event.stopPropagation?.();
      setStatus('操作已阻擋：請先「儲存人工修改」或「還原目前草稿」。','pending');
      trace(scope,'v042738_confirmation_action_blocked',{action:id,group_id:authority?.group_id||null,manual_dirty:true,system_drift:classification.unauthorized_drift,status:'blocked'});
      return;
    }
    if(policy.discard_system_drift){
      traceSystemDrift(classification);
      if(policy.prepare_authoritative_apply){
        const projected=projectAuthoritativeForm(root(),authoritativeDraft||{});
        trace(scope,'v042738_authoritative_apply_projection',{group_id:authority?.group_id||null,field_count:projected.length,fields:projected,status:'completed'});
      }else{
        trace(scope,'v042738_navigation_system_drift_discarded',{action:id,group_id:authority?.group_id||null,fields:classification.unauthorized_keys,status:'completed'});
      }
    }
  };
  const markTouched=event=>{
    const currentRoot=root();if(!currentRoot||!currentRoot.contains?.(event.target))return;
    if(event.isTrusted===false)return;
    const key=nodeKey(event.target);if(!key)return;
    touched.add(key);refreshDirtyStatus();
  };
  const suppressLegacyCorrectedEvent=event=>{
    if(!isLegacyCorrectedConfirmationEvent(event?.detail||{}))return;
    event.preventDefault?.();event.stopImmediatePropagation?.();event.stopPropagation?.();
    trace(scope,'v042739_legacy_corrected_event_suppressed',{status:'blocked',group_id:event?.detail?.group_id||null,event_type:event?.type||null,legacy_source:'v042718_form_authority_corrected',single_confirmation_authority:true});
  };

  if(scope.document){
    scope.addEventListener?.('pokemon-sleep:analysis-confirmation-group-selected',suppressLegacyCorrectedEvent,true);
    scope.addEventListener?.('pokemon-sleep:analysis-confirmation-merged',suppressLegacyCorrectedEvent,true);
    scope.addEventListener?.('pokemon-sleep:analysis-confirmation-group-selected',event=>{
      const detail=event.detail||{};if(isLegacyCorrectedConfirmationEvent(detail))return;
      if(acceptDetail(detail,'group_selected'))scheduleAuthoritativeRender(detail,'group_selected');
    });
    scope.addEventListener?.('pokemon-sleep:analysis-confirmation-merged',event=>{
      const detail=event.detail||{};if(isLegacyCorrectedConfirmationEvent(detail))return;
      if(authority?.group_id&&text(detail.group_id)!==text(authority.group_id))return;
      const hadDirty=currentClassification().manual_dirty;
      if(acceptDetail(detail,'revision_merged'))scheduleAuthoritativeRender(detail,'revision_merged');
      if(hadDirty)setStatus('分析 revision 已更新；先前未儲存的人工修改沒有寫回，請重新覆核。','pending');
    });
    scope.document.addEventListener('input',markTouched,true);
    scope.document.addEventListener('change',markTouched,true);
    scope.document.addEventListener('click',guardAction,true);
    setTimeout(mount,0);
  }

  const api={
    version:EXPLICIT_MANUAL_DRAFT_SAVE_VERSION,
    single_confirmation_authority_version:SINGLE_CONFIRMATION_AUTHORITY_VERSION,
    saveManualDraft:(draft,expected)=>{
      const state=consistency.getState(),match=revisionAuthorityMatches(expected,state);
      if(!match.ok){trace(scope,'v042738_manual_api_save_blocked',{...match,status:'blocked'});return match;}
      originalReplace(clone(draft),{reason:EXPLICIT_MANUAL_DRAFT_SAVE_REASON});
      return {ok:true,status:'SAVED',group_id:expected.group_id};
    },
    getState:()=>({authority:clone(authority),touched_keys:[...touched],classification:currentClassification(),last_status:clone(lastStatus),projection_sequence:projectionSequence}),
    refresh:()=>{mount();return refreshDirtyStatus();},
    legacy_replace_reference:legacyReplace,
  };
  scope.PokemonSleepExplicitManualDraftSaveV042737=api;
  scope.PokemonSleepExplicitManualDraftSaveV042738=api;
  scope.PokemonSleepSingleConfirmationAuthorityV042739=api;
  trace(scope,'v042739_single_confirmation_authority_ready',{status:'completed',implicit_navigation_write_disabled:true,explicit_save_only:true,revision_cas:true,system_drift_navigation_blocked:false,authoritative_apply_projection:true,legacy_corrected_event_suppressed:true,legacy_manual_overlay_shadow_only:true,first_render_projector_shadow_only:true,single_confirmation_authority:true});
  return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installExplicitManualDraftSave(globalThis);