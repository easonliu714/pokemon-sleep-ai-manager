export const GROUP_BOUND_REVIEW_SESSION_VERSION='v0.4.27.43-group-bound-review-session-cache-2026-08-27-c';
export const GROUP_BOUND_REVIEW_SESSION_REASON='v042743_group_session_authority_reseed';
export const GROUP_BOUND_REVIEW_SESSION_SCHEMA='pokemon-sleep-group-bound-review-session/1.0';

const SCALAR_FIELDS=Object.freeze([
  'species','nickname','level','sp','specialty','type','nature','nature_bonus','nature_penalty',
  'main_skill','main_skill_level','main_skill_description','helper_seconds','carry_limit',
  'favorite_berry','sleep_hours','sleep_time_text','registered_at','obtained_at','is_favorite','confidence',
]);
const FIELD_LABELS=Object.freeze({
  species:'寶可夢',nickname:'暱稱',level:'等級',sp:'SP',specialty:'專長',type:'屬性',nature:'性格',
  nature_bonus:'性格提升',nature_penalty:'性格降低',main_skill:'主技能',main_skill_level:'主技能等級',
  main_skill_description:'主技能說明',helper_seconds:'幫忙間隔',carry_limit:'持有上限',favorite_berry:'樹果',
  sleep_hours:'睡眠時數',sleep_time_text:'睡眠時間',registered_at:'登錄日期',obtained_at:'取得日期',
  is_favorite:'最愛標記',confidence:'辨識信心',ingredients:'食材',subskills:'副技能',
});
const MANUAL_SAVE_REASONS=new Set(['explicit_manual_save_v042738','explicit_manual_save_authority_promotion_v042742']);
const text=value=>String(value??'').trim();
const blank=value=>value===null||value===undefined||value===''||(Array.isArray(value)&&value.length===0);
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const now=()=>new Date().toISOString();
const unique=(values=[])=>{const out=[];for(const value of values){if(value===undefined||value===null||value==='')continue;if(!out.some(item=>same(item,value)))out.push(clone(value));}return out;};

function emptyDraft(){return {source_refs:[],analysis_ids:[],ingredients:[],subskills:[],conflicts:[],conflicted_fields:[],identity_guard_warnings:[],analysis_target_context:null};}
function valueLabel(value,field=''){
  if(value===null||value===undefined||value==='')return '空白';
  if(typeof value==='boolean')return value?'是':'否';
  if(typeof value!=='object')return String(value);
  if(field.startsWith('ingredients@')){
    const name=text(value.ingredient_name??value.name)||'未辨識食材';
    const qty=value.quantity??value.count;
    return qty==null?name:`${name} ×${qty}`;
  }
  if(field.startsWith('subskills@')){
    const name=text(value.subskill_name??value.name)||'未辨識副技能';
    return `${name}${value.is_unlocked===1||value.is_unlocked===true?'（已解鎖）':''}`;
  }
  return text(value.name??value.label??value.value)||'另一個辨識結果';
}
function fieldLabel(field=''){
  const ingredient=field.match(/^ingredients@(\d+)$/);if(ingredient)return `Lv.${ingredient[1]} 食材`;
  const subskill=field.match(/^subskills@(\d+)$/);if(subskill)return `Lv.${subskill[1]} 副技能`;
  return FIELD_LABELS[field]||field||'欄位';
}
export function humanizeConflict(conflict={}){
  const label=fieldLabel(conflict.field);
  const values=unique(conflict.candidates?.length?conflict.candidates:[conflict.existing,conflict.incoming]);
  const kept=valueLabel(values[0],conflict.field),others=values.slice(1).map(value=>`「${valueLabel(value,conflict.field)}」`).join('、');
  return `${label}：目前保留「${kept}」${others?`；其他圖片辨識為 ${others}`:''}。請人工確認；若要更改，請直接修改表單後按「儲存人工修改」。`;
}
function addConflict(out,field,existing,incoming,{source_ref=null}={}){
  const current=(out.conflicts||[]).find(row=>row.field===field);
  const candidates=unique([...(current?.candidates||[]),current?.existing,current?.incoming,existing,incoming]);
  const record={field,status:'REVIEW_REQUIRED_CROSS_IMAGE_CONFLICT_FIRST_NONBLANK_PRESERVED',candidates,existing:candidates[0]??clone(existing),incoming:candidates[1]??clone(incoming),source_refs:unique([...(current?.source_refs||[]),source_ref]),manual_review_saved:Boolean(current?.manual_review_saved)};
  record.human_message=humanizeConflict(record);
  out.conflicts=(out.conflicts||[]).filter(row=>row.field!==field);
  out.conflicts.push(record);
  out.conflicted_fields=[...new Set([...(out.conflicted_fields||[]),field])];
}
function compatibleCollection(kind,a,b){
  if(kind==='ingredients'){
    if(text(a?.ingredient_name)!==text(b?.ingredient_name))return false;
    const aq=a?.quantity==null?null:Number(a.quantity),bq=b?.quantity==null?null:Number(b.quantity);
    return aq==null||bq==null||aq===bq;
  }
  return text(a?.subskill_name)===text(b?.subskill_name)&&Boolean(Number(a?.is_unlocked))===Boolean(Number(b?.is_unlocked));
}
function mergeCollection(out,kind,incomingRows,{source_ref=null}={}){
  if(!Array.isArray(incomingRows)||incomingRows.length===0)return;
  const slots=new Map((Array.isArray(out[kind])?out[kind]:[]).map(row=>[Number(row.unlock_level),clone(row)]));
  for(const raw of incomingRows){
    const level=Number(raw?.unlock_level);if(!Number.isFinite(level))continue;
    const name=text(kind==='ingredients'?raw?.ingredient_name:raw?.subskill_name);if(!name)continue;
    const row=clone(raw),existing=slots.get(level),field=`${kind}@${level}`;
    if(!existing){slots.set(level,row);continue;}
    if(!compatibleCollection(kind,existing,row)){addConflict(out,field,existing,row,{source_ref});continue;}
    if(kind==='ingredients'&&existing.quantity==null&&row.quantity!=null)existing.quantity=row.quantity;
  }
  out[kind]=[...slots.values()].sort((a,b)=>Number(a.unlock_level)-Number(b.unlock_level));
}
export function mergeFirstNonblankDraft(base={},incoming={},meta={}){
  const out={...emptyDraft(),...clone(base),conflicts:[...(base?.conflicts||[])].map(clone),conflicted_fields:[...(base?.conflicted_fields||[])],source_refs:[...(base?.source_refs||[])],analysis_ids:[...(base?.analysis_ids||[])],identity_guard_warnings:[...(base?.identity_guard_warnings||[])]};
  for(const field of SCALAR_FIELDS){const value=incoming?.[field];if(blank(value))continue;if(blank(out[field]))out[field]=clone(value);else if(!same(out[field],value))addConflict(out,field,out[field],value,meta);}
  mergeCollection(out,'ingredients',incoming?.ingredients,meta);mergeCollection(out,'subskills',incoming?.subskills,meta);
  out.source_refs=[...new Set([...(out.source_refs||[]),...(incoming?.source_refs||[]),meta.source_ref].filter(Boolean).map(text))];
  out.analysis_ids=[...new Set([...(out.analysis_ids||[]),...(incoming?.analysis_ids||[]),meta.analysis_id].filter(Boolean).map(text))];
  out.identity_guard_warnings=[...(out.identity_guard_warnings||[]),...(incoming?.identity_guard_warnings||[]).map(clone)];
  if(!out.analysis_target_context&&incoming?.analysis_target_context)out.analysis_target_context=clone(incoming.analysis_target_context);
  return out;
}
function fillBlanksFromDraft(base={},incoming={}){
  const out=clone(base)||emptyDraft();out.conflicts=[...(out.conflicts||[])];out.conflicted_fields=[...(out.conflicted_fields||[])];
  for(const field of SCALAR_FIELDS)if(blank(out[field])&&!blank(incoming?.[field]))out[field]=clone(incoming[field]);
  for(const kind of ['ingredients','subskills']){
    const slots=new Map((Array.isArray(out[kind])?out[kind]:[]).map(row=>[Number(row.unlock_level),clone(row)]));
    for(const row of Array.isArray(incoming?.[kind])?incoming[kind]:[]){const level=Number(row?.unlock_level);if(Number.isFinite(level)&&!slots.has(level))slots.set(level,clone(row));}
    out[kind]=[...slots.values()].sort((a,b)=>Number(a.unlock_level)-Number(b.unlock_level));
  }
  out.source_refs=[...new Set([...(out.source_refs||[]),...(incoming?.source_refs||[])].filter(Boolean).map(text))];
  out.analysis_ids=[...new Set([...(out.analysis_ids||[]),...(incoming?.analysis_ids||[])].filter(Boolean).map(text))];
  if(!out.analysis_target_context&&incoming?.analysis_target_context)out.analysis_target_context=clone(incoming.analysis_target_context);
  return out;
}
function manualReplacement(previous={},draft={}){
  const next={...emptyDraft(),...clone(draft),conflicts:(previous.conflicts||[]).map(row=>({...clone(row),manual_review_saved:true})),conflicted_fields:[...(previous.conflicted_fields||[])],source_refs:[...(draft?.source_refs||previous?.source_refs||[])],analysis_ids:[...(draft?.analysis_ids||previous?.analysis_ids||[])]};
  next.conflicts=next.conflicts.map(row=>({...row,human_message:`${humanizeConflict(row)}（目前表單已人工儲存；請以表單中的目前值為準。）`}));
  return next;
}

export function createReviewSessionCacheModel(){
  const sessions=new Map();let activeGroupId=null;
  const ensure=(groupId,seed={})=>{
    const id=text(groupId);if(!id)return null;
    if(!sessions.has(id))sessions.set(id,{schema:GROUP_BOUND_REVIEW_SESSION_SCHEMA,version:GROUP_BOUND_REVIEW_SESSION_VERSION,group_id:id,phase:'AI_COLLECTING',draft:fillBlanksFromDraft(emptyDraft(),seed),seen_analysis_ids:[],created_at:now(),updated_at:now(),manual_saved_at:null,sealed_at:null});
    else if(seed&&Object.keys(seed).length){const session=sessions.get(id);session.draft=fillBlanksFromDraft(session.draft,seed);session.updated_at=now();}
    return sessions.get(id);
  };
  return {
    activate(groupId,seed={}){const session=ensure(groupId,seed);if(!session)return null;activeGroupId=session.group_id;return clone(session);},
    ingest(groupId,incoming={},meta={}){
      const session=ensure(groupId);if(!session)return {ok:false,status:'GROUP_ID_REQUIRED'};
      const analysisId=text(meta.analysis_id);if(analysisId&&session.seen_analysis_ids.includes(analysisId))return {ok:true,status:'DUPLICATE_REVISION_IGNORED',session:clone(session)};
      if(session.phase!=='AI_COLLECTING')return {ok:false,status:session.phase==='MANUAL_AUTHORITY'?'MANUAL_SESSION_AUTHORITY':'AI_SESSION_SEALED',session:clone(session)};
      session.draft=mergeFirstNonblankDraft(session.draft,incoming,meta);if(analysisId)session.seen_analysis_ids.push(analysisId);session.updated_at=now();return {ok:true,status:'MERGED_FIRST_NONBLANK',session:clone(session)};
    },
    manualReplace(groupId,draft={}){const session=ensure(groupId);if(!session)return null;session.draft=manualReplacement(session.draft,draft);session.phase='MANUAL_AUTHORITY';session.manual_saved_at=now();session.updated_at=now();return clone(session);},
    seal(groupId){const session=ensure(groupId);if(!session)return null;if(session.phase==='AI_COLLECTING')session.phase='AI_SEALED';session.sealed_at=now();session.updated_at=now();return clone(session);},
    get(groupId){const row=sessions.get(text(groupId));return row?clone(row):null;},
    getState(){return {active_group_id:activeGroupId,sessions:[...sessions.values()].map(clone)};},
  };
}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));}
function runtimeTrace(scope,event,detail={}){const payload={version:GROUP_BOUND_REVIEW_SESSION_VERSION,...detail};scope.UpdateCenterLiveDebug?.record?.(event,payload);scope.DebugTrace?.record?.('ai_review',event,{status:detail.status||'completed',details:payload});}
function findGroupForRevision(consistency,revision){
  const state=consistency?.getState?.()||{},analysisId=text(revision?.analysis_id);
  if(analysisId){const exact=(state.groups||[]).find(group=>text(group?.latest_revision?.analysis_id)===analysisId||(group?.revisions||[]).some(row=>text(row?.analysis_id)===analysisId));if(exact)return exact;}
  const context=revision?.identity_context||null,key=context?globalThis.PokemonSleepAnalysisTargetIdentity?.analysisTargetIdentityKey?.(context):null;
  return key?(state.groups||[]).find(group=>text(group?.identity_key)===text(key))||null:null;
}
function hideLegacyConflictJson(root){for(const detail of root?.querySelectorAll?.('#captureGroupStatus details')||[]){if(text(detail.querySelector('summary')?.textContent).includes('欄位衝突'))detail.hidden=true;}}
function renderHumanConflictPanel(scope,model,groupId){
  const root=scope.document?.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation')||scope.document?.getElementById?.('analysisConfirmationWorkbench');if(!root)return;
  hideLegacyConflictJson(root);let panel=root.querySelector?.('#groupBoundConflictPanelV042743');const session=model.get(groupId),conflicts=session?.draft?.conflicts||[];
  if(!conflicts.length){panel?.remove?.();return;}
  if(!panel){panel=scope.document.createElement('section');panel.id='groupBoundConflictPanelV042743';panel.className='notice pending';const anchor=root.querySelector('#captureGroupStatus')||root.querySelector('header');anchor?.insertAdjacentElement('afterend',panel);}
  panel.innerHTML=`<strong>多圖辨識結果有差異，需要人工確認</strong><br><span>平台已保留第一個非空值；不會因另一張圖片不同而自動清空或覆寫。</span><ul>${conflicts.map(row=>`<li>${escapeHtml(row.human_message||humanizeConflict(row))}</li>`).join('')}</ul>`;
}

let productionCoreDraftWriter=null,productionCoreWriterLoadError=null;
if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')import('./data-consistency-multicapture.js').then(module=>{productionCoreDraftWriter=typeof module?.replaceActiveDraft==='function'?module.replaceActiveDraft:null;if(!productionCoreDraftWriter)productionCoreWriterLoadError='CORE_WRITER_EXPORT_MISSING';}).catch(error=>{productionCoreWriterLoadError=error?.message||String(error);});

export function installGroupBoundReviewSessionCache(scope=globalThis,{coreWriter=null}={}){
  if(scope.PokemonSleepGroupBoundReviewSessionV042743?.version===GROUP_BOUND_REVIEW_SESSION_VERSION)return true;
  const consistency=scope.PokemonSleepMultiCaptureConsistency;if(!consistency?.getState||!consistency?.normalizeRevision)return false;
  const model=createReviewSessionCacheModel(),scheduled=new Set(),writer=()=>coreWriter||productionCoreDraftWriter;
  const scheduleReseed=(groupId,reason='session_update')=>{
    const id=text(groupId);if(!id||scheduled.has(id))return;scheduled.add(id);queueMicrotask(()=>{
      scheduled.delete(id);const state=consistency.getState(),group=(state.groups||[]).find(row=>text(row.id)===id),session=model.get(id);
      if(!group||!session||text(state.active_group_id)!==id){renderHumanConflictPanel(scope,model,state.active_group_id);return;}
      const write=writer();if(typeof write!=='function'){runtimeTrace(scope,'v042743_session_reseed_blocked',{group_id:id,reason,status:'blocked',error:productionCoreWriterLoadError||'CORE_WRITER_NOT_READY'});return;}
      write(clone(session.draft),{reason:GROUP_BOUND_REVIEW_SESSION_REASON});runtimeTrace(scope,'v042743_active_session_core_reconciled',{group_id:id,reason,status:'completed',conflict_count:session.draft.conflicts?.length||0,phase:session.phase});consistency.selectGroup?.(id,{reason:GROUP_BOUND_REVIEW_SESSION_REASON});
    });
  };
  const onSelected=event=>{
    const detail=event?.detail||{},id=text(detail.group_id);if(!id)return;
    if(detail.reason===GROUP_BOUND_REVIEW_SESSION_REASON){model.activate(id);renderHumanConflictPanel(scope,model,id);return;}
    if(MANUAL_SAVE_REASONS.has(text(detail.reason))){model.activate(id);model.manualReplace(id,detail.draft||{});renderHumanConflictPanel(scope,model,id);runtimeTrace(scope,'v042743_manual_save_promoted_to_session_cache',{group_id:id,status:'completed'});return;}
    model.activate(id,detail.draft||{});renderHumanConflictPanel(scope,model,id);scheduleReseed(id,`group_selected:${detail.reason||'unknown'}`);
  };
  const onMerged=event=>{const detail=event?.detail||{},id=text(detail.group_id);if(!id)return;model.activate(id,detail.draft||{});renderHumanConflictPanel(scope,model,id);scheduleReseed(id,'active_group_merged');};
  const onRevision=event=>{
    const revision=event?.detail?.revision||event?.detail||{};if(revision?.analysis_type!=='ai')return;
    const group=findGroupForRevision(consistency,revision);if(!group){runtimeTrace(scope,'v042743_revision_session_bind_blocked',{analysis_id:revision?.analysis_id||null,status:'blocked',reason:'GROUP_NOT_RESOLVED'});return;}
    const result=model.ingest(group.id,consistency.normalizeRevision(revision),{analysis_id:revision.analysis_id,source_ref:revision.source_image_ref});runtimeTrace(scope,result.ok?'v042743_revision_merged_into_group_session':'v042743_revision_session_write_blocked',{group_id:group.id,analysis_id:revision.analysis_id||null,source_image_ref:revision.source_image_ref||null,status:result.ok?'completed':'blocked',merge_status:result.status,active_group_id:consistency.getState()?.active_group_id||null,background_group:text(consistency.getState()?.active_group_id)!==text(group.id),conflict_count:result.session?.draft?.conflicts?.length||0});
    if(result.ok&&text(consistency.getState()?.active_group_id)===text(group.id))scheduleReseed(group.id,'revision_saved_after_core');
  };
  scope.addEventListener?.('pokemon-sleep:analysis-confirmation-group-selected',onSelected);scope.addEventListener?.('pokemon-sleep:analysis-confirmation-merged',onMerged);scope.addEventListener?.('pokemon-sleep:analysis-revision-saved',onRevision);
  const api={version:GROUP_BOUND_REVIEW_SESSION_VERSION,schema:GROUP_BOUND_REVIEW_SESSION_SCHEMA,model,legacyProjectionAllowed:()=>false,getSession:groupId=>model.get(groupId),getState:()=>model.getState(),reseedActiveSession:(groupId,reason='api_reseed')=>scheduleReseed(groupId,reason),renderHumanConflicts:groupId=>renderHumanConflictPanel(scope,model,groupId)};
  scope.PokemonSleepGroupBoundReviewSessionV042743=api;runtimeTrace(scope,'v042743_group_bound_review_session_ready',{status:'completed',first_nonblank_wins:true,background_dom_write:false,human_conflict_messages:true,legacy_projection_allowed:false,ai_seal_terminal:true,ai_lifecycle_delegated_to_exact_group_guard:true,manual_save_authority_preserved:true});return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installGroupBoundReviewSessionCache(globalThis);