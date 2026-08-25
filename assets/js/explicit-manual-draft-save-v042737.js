export const EXPLICIT_MANUAL_DRAFT_SAVE_VERSION='v0.4.27.37-explicit-manual-draft-save-authority-2026-08-25-a';
export const EXPLICIT_MANUAL_DRAFT_SAVE_REASON='explicit_manual_save_v042737';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const text=value=>String(value??'').trim();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const trace=(scope,event,detail={})=>{
  const payload={version:EXPLICIT_MANUAL_DRAFT_SAVE_VERSION,...detail};
  scope.UpdateCenterLiveDebug?.record?.(event,payload);
  scope.DebugTrace?.record?.('ai_review',event,{status:detail.status||'completed',details:payload});
};

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

function nodeValue(node){
  if(!node)return null;
  if(node.type==='checkbox')return Boolean(node.checked);
  if(node.type==='number')return node.value===''?null:Number(node.value);
  return String(node.value??'').trim();
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
  if(scope.PokemonSleepExplicitManualDraftSaveV042737?.version===EXPLICIT_MANUAL_DRAFT_SAVE_VERSION)return true;

  const originalReplace=consistency.replaceActiveDraft.bind(consistency);
  const legacyReplace=consistency.replaceActiveDraft;
  consistency.replaceActiveDraft=(draft,{reason='legacy_implicit_snapshot'}={})=>{
    if(reason===EXPLICIT_MANUAL_DRAFT_SAVE_REASON)return originalReplace(draft,{reason});
    trace(scope,'v042737_implicit_draft_write_blocked',{reason,status:'blocked',active_group_id:consistency.getState()?.active_group_id||null});
    return null;
  };

  let authority=null,authoritativeDraft=null;
  const touched=new Set();
  let lastStatus=null;
  const root=()=>scope.document?.getElementById?.('analysisConfirmationWorkbench')||null;
  const confirmation=()=>root()?.querySelector?.('.analysis-confirmation')||null;
  const statusNode=()=>root()?.querySelector?.('#manualDraftStatusV042737')||null;
  const setStatus=(message,kind='')=>{
    lastStatus={message,kind};const node=statusNode();if(!node)return;
    node.className=`notice${kind?` ${kind}`:''}`;node.textContent=message;
  };
  const currentClassification=()=>{
    const currentRoot=root();if(!currentRoot||!authoritativeDraft)return {clean:true,manual_dirty:false,unauthorized_drift:false,manual_keys:[],unauthorized_keys:[]};
    const snapshots=snapshotForm(currentRoot,authoritativeDraft);
    return classifyFormSnapshot({...snapshots,touched_keys:[...touched]});
  };
  const refreshDirtyStatus=()=>{
    const state=currentClassification();
    if(state.unauthorized_drift){setStatus('偵測到非人工操作造成的畫面漂移；不會寫回草稿。請按「還原目前草稿」後重新覆核。','error');return state;}
    if(state.manual_dirty){setStatus('有尚未儲存的人工修改。請先儲存或還原，才能切換寶可夢或確認處置。','pending');return state;}
    if(!lastStatus||['pending','error'].includes(lastStatus.kind))setStatus('目前沒有尚未儲存的人工修改。','');
    return state;
  };
  const mount=()=>{
    const area=confirmation();if(!area)return false;
    let panel=area.querySelector('#manualDraftAuthorityV042737');
    if(!panel){
      panel=scope.document.createElement('section');panel.id='manualDraftAuthorityV042737';panel.className='notice';
      panel.innerHTML='<strong>人工修改 Authority</strong><br><span>切換寶可夢不會自動保存表單。只有按「儲存人工修改」才會永久覆寫目前草稿。</span><div class="buttons"><button type="button" id="saveManualAnalysisDraftV042737">儲存人工修改</button><button type="button" id="revertManualAnalysisDraftV042737" class="secondary">還原目前草稿</button></div><div id="manualDraftStatusV042737" class="notice"></div>';
      const nav=area.querySelector('.analysis-review-navigation');(nav||area.querySelector('header'))?.insertAdjacentElement('afterend',panel);
      panel.querySelector('#saveManualAnalysisDraftV042737').onclick=saveManual;
      panel.querySelector('#revertManualAnalysisDraftV042737').onclick=()=>revertManual('user_revert');
    }
    if(lastStatus)setStatus(lastStatus.message,lastStatus.kind);else refreshDirtyStatus();
    return true;
  };
  const acceptDetail=(detail={},reason='selected')=>{
    authority=revisionAuthorityFromDetail(detail);
    authoritativeDraft=detail?.draft?clone(detail.draft):null;
    touched.clear();lastStatus=null;
    mount();refreshDirtyStatus();
    trace(scope,'v042737_manual_authority_refreshed',{reason,group_id:authority.group_id,analysis_id:authority.analysis_id,revision_no:authority.revision_no,status:'completed'});
  };
  function revertManual(reason='manual_revert'){
    if(!authority?.group_id)return false;
    touched.clear();lastStatus={message:'已還原為目前群組的已儲存草稿。',kind:'success'};
    consistency.selectGroup?.(authority.group_id,{reason:`${reason}_v042737`});
    trace(scope,'v042737_manual_draft_reverted',{group_id:authority.group_id,reason,status:'completed'});
    return true;
  }
  function saveManual(){
    const currentRoot=root();if(!currentRoot||!authority)return {ok:false,status:'NO_ACTIVE_CONFIRMATION'};
    const classification=currentClassification();
    if(classification.unauthorized_drift){setStatus('儲存已阻擋：畫面含非人工操作造成的漂移。請先還原目前草稿。','error');return {ok:false,status:'UNAUTHORIZED_DOM_DRIFT',classification};}
    if(!classification.manual_dirty){setStatus('沒有需要儲存的人工修改。','');return {ok:true,status:'NO_MANUAL_CHANGES'};}
    const state=consistency.getState(),match=revisionAuthorityMatches(authority,state);
    if(!match.ok){setStatus(`儲存已阻擋：${match.status}。分析 revision 已改變，請重新覆核。`,'error');trace(scope,'v042737_manual_draft_save_blocked',{...match,status:'blocked'});return match;}
    const patched=applyManualPatch(match.group.draft,currentRoot,classification.manual_keys);
    originalReplace(patched,{reason:EXPLICIT_MANUAL_DRAFT_SAVE_REASON});
    touched.clear();lastStatus={message:'人工修改已儲存到目前寶可夢草稿。',kind:'success'};
    consistency.selectGroup?.(authority.group_id,{reason:EXPLICIT_MANUAL_DRAFT_SAVE_REASON});
    trace(scope,'v042737_manual_draft_saved',{group_id:authority.group_id,analysis_id:authority.analysis_id,revision_no:authority.revision_no,field_count:classification.manual_keys.length,fields:classification.manual_keys,status:'completed'});
    return {ok:true,status:'SAVED',manual_keys:classification.manual_keys};
  }

  const guardAction=event=>{
    const id=event?.target?.id;
    if(!['previousAnalysisGroup','nextAnalysisGroup','applyConfirmedAnalysis'].includes(id))return;
    const classification=currentClassification();
    if(classification.clean)return;
    event.preventDefault?.();event.stopImmediatePropagation?.();event.stopPropagation?.();
    if(classification.unauthorized_drift)setStatus('操作已阻擋：畫面與目前群組 Authority 不一致，且不是已記錄的人工修改。請先還原目前草稿。','error');
    else setStatus('操作已阻擋：請先「儲存人工修改」或「還原目前草稿」。','pending');
    trace(scope,'v042737_confirmation_action_blocked',{action:id,group_id:authority?.group_id||null,manual_dirty:classification.manual_dirty,unauthorized_drift:classification.unauthorized_drift,status:'blocked'});
  };
  const markTouched=event=>{
    const currentRoot=root();if(!currentRoot||!currentRoot.contains?.(event.target))return;
    if(event.isTrusted===false)return;
    const key=nodeKey(event.target);if(!key)return;
    touched.add(key);refreshDirtyStatus();
  };

  if(scope.document){
    scope.addEventListener?.('pokemon-sleep:analysis-confirmation-group-selected',event=>acceptDetail(event.detail||{},'group_selected'));
    scope.addEventListener?.('pokemon-sleep:analysis-confirmation-merged',event=>{
      const detail=event.detail||{};
      if(authority?.group_id&&text(detail.group_id)!==text(authority.group_id))return;
      const hadDirty=currentClassification().manual_dirty;
      acceptDetail(detail,'revision_merged');
      if(hadDirty)setStatus('分析 revision 已更新；先前未儲存的人工修改沒有寫回，請重新覆核。','pending');
    });
    scope.document.addEventListener('input',markTouched,true);
    scope.document.addEventListener('change',markTouched,true);
    scope.document.addEventListener('click',guardAction,true);
    setTimeout(mount,0);
  }

  const api={
    version:EXPLICIT_MANUAL_DRAFT_SAVE_VERSION,
    saveManualDraft:(draft,expected)=>{
      const state=consistency.getState(),match=revisionAuthorityMatches(expected,state);
      if(!match.ok){trace(scope,'v042737_manual_api_save_blocked',{...match,status:'blocked'});return match;}
      originalReplace(clone(draft),{reason:EXPLICIT_MANUAL_DRAFT_SAVE_REASON});
      return {ok:true,status:'SAVED',group_id:expected.group_id};
    },
    getState:()=>({authority:clone(authority),touched_keys:[...touched],classification:currentClassification(),last_status:clone(lastStatus)}),
    refresh:()=>{mount();return refreshDirtyStatus();},
    legacy_replace_reference:legacyReplace,
  };
  scope.PokemonSleepExplicitManualDraftSaveV042737=api;
  trace(scope,'v042737_explicit_manual_draft_save_ready',{status:'completed',implicit_navigation_write_disabled:true,explicit_save_only:true,revision_cas:true});
  return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installExplicitManualDraftSave(globalThis);
