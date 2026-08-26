import {rows} from './database.js';
import {resolveEvolutionAuthority,hydrateEvolutionDraft,evolutionAuthorityLabel} from './analysis-confirmation-evolution-authority.js';
import {resolveRevisionAnalysisTarget,analysisTargetIdentityKey} from './analysis-target-identity.js';

const VERSION=globalThis.PokemonSleepVersionAuthority?.app_version||'unknown';
const BUILD=globalThis.PokemonSleepVersionAuthority?.app_build||'unknown';
const groups=new Map();
let activeGroupId=null;
let groupSequence=0;

const text=value=>{
  if(value==null)return '';
  if(typeof value==='string')return value.trim();
  if(typeof value==='number')return String(value);
  if(typeof value==='object')return text(value.name??value.nature_name??value.label??value.value??'');
  return '';
};
const number=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};
const badString=value=>/^\[(object Object|object Array)\]$|^(undefined|null)$/i.test(String(value??'').trim());
const clean=value=>{const result=text(value);return badString(result)?'':result;};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const blank=value=>value===null||value===undefined||value===''||(Array.isArray(value)&&value.length===0);
const clone=value=>JSON.parse(JSON.stringify(value));
const nowIso=()=>new Date().toISOString();
const emptyDraft=()=>({source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[],conflicted_fields:[],identity_guard_warnings:[],analysis_target_context:null,baseline_reference_status:null,baseline_hydrated_fields:[]});
const trace=(event,detail={})=>{globalThis.UpdateCenterLiveDebug?.record?.(event,detail);globalThis.DebugTrace?.record?.('ai_review',event,{status:'completed',details:detail});};

const firstNonblank=(...values)=>{for(const value of values){const result=clean(value);if(result)return result;}return '';};
function resolveFavoriteBerryAuthority({raw={},profile={}}={}){
  if(Array.isArray(raw?.observations))return clean(profile?.favorite_berry);
  return clean(raw?.favorite_berry??profile?.favorite_berry);
}
// Legacy static-contract parser bridge only; not runtime authority: profile?.header_name_text??profile?.species
function resolveObservedSpecies({raw={},observation={}}={}){
  const profile=observation?.profile||{},identity=observation?.identity||{};
  if(Array.isArray(raw?.observations))return firstNonblank(profile.species,identity.current_species_id,identity.capture_species_id);
  return firstNonblank(profile.species,raw?.pokemon_name,identity.current_species_id,identity.capture_species_id);
}
function resolveObservedNickname({raw={},observation={},species=null}={}){
  const profile=observation?.profile||{},candidate=firstNonblank(profile.nickname,raw?.nickname);
  if(!candidate)return {value:'',candidate:'',status:'EMPTY',reason:null};
  const basis=clean(profile.nickname_observation_basis);
  if(basis!=='DIRECT_EXPLICIT_NICKNAME_FIELD')return {value:'',candidate,status:'REJECTED_UNPROVEN',reason:'NICKNAME_REQUIRES_DIRECT_EXPLICIT_FIELD',compared_species:clean(species)||null,header_name_text:clean(profile.header_name_text)||null};
  return {value:candidate,candidate,status:'ACCEPTED_DIRECT_EXPLICIT_FIELD',reason:null};
}
function buildIdentityGuardWarnings({nicknameResult,observedSpecies=null,targetContext=null}={}){
  const warnings=[];
  if(nicknameResult?.candidate&&!nicknameResult.value)warnings.push({field:'nickname',candidate:nicknameResult.candidate,status:nicknameResult.status,reason:nicknameResult.reason,message:'暱稱缺少獨立直接證據，平台已留空，避免由頁首名稱／物種名稱或其他圖片自行補值。'});
  const targetSpecies=clean(targetContext?.target_species_snapshot),incomingSpecies=clean(observedSpecies);
  if(targetContext?.mode==='existing'&&targetSpecies&&incomingSpecies&&targetSpecies!==incomingSpecies){
    warnings.push({field:'species',candidate:incomingSpecies,status:'REVIEW_ONLY_MISMATCH',reason:'OBSERVED_SPECIES_DIFFERS_BOUND_TARGET',message:`圖片辨識物種「${incomingSpecies}」與已綁定既有寶可夢「${targetSpecies}」不同；平台仍以 pokemon_instance_id 為目標，不切換個體。`});
  }
  return warnings;
}

function normalizeSubskills(value){
  return (Array.isArray(value)?value:[]).map((row,index)=>({
    unlock_level:number(row?.unlock_level??row?.level)??[10,25,50,70,80][index]??null,
    subskill_name:clean(row?.subskill_name??row?.name),
    is_unlocked:row?.is_unlocked===1||row?.is_unlocked===true||row?.unlocked===true?1:0,
  })).filter(row=>row.unlock_level&&row.subskill_name);
}
function normalizeIngredients(value){
  return (Array.isArray(value)?value:[]).map((row,index)=>({
    unlock_level:number(row?.unlock_level??row?.level)??[1,30,60][index]??null,
    ingredient_name:clean(row?.ingredient_name??row?.name),
    quantity:number(row?.quantity??row?.count),
  })).filter(row=>row.unlock_level&&row.ingredient_name);
}
function normalizeRevision(revision){
  const raw=revision?.result?.analysis??revision?.result??{};
  const targetContext=resolveRevisionAnalysisTarget(revision);
  if(revision?.analysis_type!=='ai'){
    const regions=Array.isArray(raw?.regions)?raw.regions:Array.isArray(raw)?raw:[];
    return {species:targetContext?.mode==='existing'?clean(targetContext.target_species_snapshot):'',nickname:'',level:null,sp:null,specialty:'',type:'',nature:'',nature_bonus:'',nature_penalty:'',main_skill:'',main_skill_level:null,main_skill_description:'',helper_seconds:null,carry_limit:null,favorite_berry:'',sleep_hours:null,sleep_time_text:'',registered_at:'',obtained_at:'',is_favorite:null,confidence:null,subskills:[],ingredients:[],source_text:regions.map(row=>`${row.name||row.region||'區域'}\n${row.text||row.ocr_text||''}`).join('\n\n'),source_refs:[revision?.source_image_ref].filter(Boolean),analysis_ids:[revision?.analysis_id].filter(Boolean),conflicts:[],conflicted_fields:[],identity_guard_warnings:[],analysis_target_context:targetContext,baseline_reference_status:null,baseline_hydrated_fields:[]};
  }
  const observation=Array.isArray(raw?.observations)?raw.observations[0]||{}:{};
  const profile=observation?.profile||{};
  const identity=observation?.identity||{};
  const rawNature=raw?.nature;
  const favoriteValue=observation?.is_favorite??raw?.is_favorite;
  const observedSpecies=resolveObservedSpecies({raw,observation});
  const species=targetContext?.mode==='existing'&&clean(targetContext.target_species_snapshot)?clean(targetContext.target_species_snapshot):observedSpecies;
  const nicknameResult=resolveObservedNickname({raw,observation,species});
  const identityGuardWarnings=buildIdentityGuardWarnings({nicknameResult,observedSpecies,targetContext});
  if(identityGuardWarnings.length)trace('analysis_identity_guard_rejected',{analysis_id:revision?.analysis_id||null,source_image_ref:revision?.source_image_ref||null,warning_count:identityGuardWarnings.length,target_mode:targetContext?.mode||'legacy'});
  return {
    species:clean(species),
    nickname:clean(nicknameResult.value),
    level:number(raw?.level??profile?.level),
    sp:number(raw?.sp??profile?.sp),
    specialty:clean(raw?.specialty??profile?.specialty),
    type:clean(raw?.type??profile?.type),
    nature:clean(rawNature?.name??rawNature??profile?.nature),
    nature_bonus:clean(rawNature?.up??profile?.nature_bonus),
    nature_penalty:clean(rawNature?.down??profile?.nature_penalty),
    main_skill:clean(profile?.main_skill??raw?.main_skill?.name??raw?.main_skill),
    main_skill_level:number(profile?.main_skill_level??raw?.main_skill?.level),
    main_skill_description:clean(raw?.main_skill?.description),
    helper_seconds:number(raw?.helper_seconds??profile?.helper_seconds),
    carry_limit:number(raw?.carry_limit??profile?.carry_limit),
    favorite_berry:resolveFavoriteBerryAuthority({raw,profile}),
    sleep_hours:number(raw?.sleep_hours??profile?.sleep_hours),
    sleep_time_text:clean(raw?.sleep_time_text??profile?.sleep_time_text),
    registered_at:clean(identity?.registered_date),
    obtained_at:clean(raw?.obtained_at),
    is_favorite:favoriteValue===true?1:favoriteValue===false?0:null,
    confidence:number(raw?.confidence),
    subskills:normalizeSubskills(raw?.sub_skills?.length?raw.sub_skills:observation?.subskills),
    ingredients:normalizeIngredients(raw?.ingredients?.length?raw.ingredients:observation?.ingredients),
    source_text:'',
    source_refs:[revision?.source_image_ref].filter(Boolean),
    analysis_ids:[revision?.analysis_id].filter(Boolean),
    conflicts:[],
    conflicted_fields:[],
    identity_guard_warnings:identityGuardWarnings,
    analysis_target_context:targetContext,
    baseline_reference_status:null,
    baseline_hydrated_fields:[],
  };
}

const MERGE_FIELDS=['species','nickname','level','sp','specialty','type','nature','nature_bonus','nature_penalty','main_skill','main_skill_level','main_skill_description','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','registered_at','obtained_at','is_favorite','confidence'];
const BASELINE_SCALAR_FIELDS=['species','level','sp','specialty','type','nature','nature_bonus','nature_penalty','main_skill','main_skill_level','main_skill_description','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','registered_at','obtained_at','is_favorite'];
function addConflict(out,field,existing,incoming){
  const current=(out.conflicts||[]).find(row=>row.field===field);
  const values=[];
  for(const value of [current?.candidates?.length?current.candidates:null,current?.existing,current?.incoming,existing,incoming].flat().filter(value=>value!==undefined&&value!==null&&value!=='')){
    if(!values.some(item=>JSON.stringify(item)===JSON.stringify(value)))values.push(clone(value));
  }
  out.conflicts=(out.conflicts||[]).filter(row=>row.field!==field);
  out.conflicts.push({field,status:'REVIEW_REQUIRED_CROSS_IMAGE_CONFLICT',candidates:values,existing:values[0]??null,incoming:values[1]??null});
  out.conflicted_fields=[...new Set([...(out.conflicted_fields||[]),field])];
}
function compatibleCollectionRow(key,a,b){
  if(key==='ingredients'){
    if(clean(a?.ingredient_name)!==clean(b?.ingredient_name))return false;
    const aq=number(a?.quantity),bq=number(b?.quantity);
    return aq==null||bq==null||aq===bq;
  }
  return clean(a?.subskill_name)===clean(b?.subskill_name);
}
function mergeCollectionRows(out,key,nextRows){
  if(!Array.isArray(nextRows)||!nextRows.length)return;
  if(out.conflicted_fields.includes(key)){addConflict(out,key,null,nextRows);out[key]=[];return;}
  const map=new Map((Array.isArray(out[key])?out[key]:[]).map(row=>[Number(row.unlock_level),clone(row)]));
  for(const raw of nextRows){
    const level=Number(raw?.unlock_level);if(!Number.isFinite(level))continue;
    const field=`${key}@${level}`;
    if(out.conflicted_fields.includes(field)){addConflict(out,field,null,raw);map.delete(level);continue;}
    const existing=map.get(level);
    if(!existing){map.set(level,clone(raw));continue;}
    if(!compatibleCollectionRow(key,existing,raw)){addConflict(out,field,existing,raw);map.delete(level);continue;}
    if(key==='ingredients'&&number(existing.quantity)==null&&number(raw.quantity)!=null)existing.quantity=number(raw.quantity);
    if(key==='subskills')existing.is_unlocked=(Number(existing.is_unlocked)||Number(raw.is_unlocked))?1:0;
  }
  out[key]=[...map.values()].sort((a,b)=>Number(a.unlock_level)-Number(b.unlock_level));
}
function mergeDraft(base,next){
  const out={...base,conflicts:[...(base.conflicts||[])],conflicted_fields:[...(base.conflicted_fields||[])],identity_guard_warnings:[...(base.identity_guard_warnings||[])],baseline_hydrated_fields:[]};
  for(const key of MERGE_FIELDS){
    if(blank(next[key]))continue;
    if(out.conflicted_fields.includes(key)){addConflict(out,key,null,next[key]);out[key]=null;continue;}
    if(blank(out[key]))out[key]=clone(next[key]);
    else if(String(out[key])!==String(next[key])){addConflict(out,key,out[key],next[key]);out[key]=null;}
  }
  mergeCollectionRows(out,'subskills',next.subskills);
  mergeCollectionRows(out,'ingredients',next.ingredients);
  out.source_text=[out.source_text,next.source_text].filter(Boolean).join('\n\n---\n\n');
  out.source_refs=[...new Set([...(out.source_refs||[]),...(next.source_refs||[])])];
  out.analysis_ids=[...new Set([...(out.analysis_ids||[]),...(next.analysis_ids||[])])];
  out.identity_guard_warnings=[...(out.identity_guard_warnings||[]),...(next.identity_guard_warnings||[])];
  if(!out.analysis_target_context&&next.analysis_target_context)out.analysis_target_context=clone(next.analysis_target_context);
  return out;
}

function createGroup({status='pending',identityContext=null,identityKey=null}={}){
  const order=++groupSequence;
  const id=`capture-${Date.now()}-${order}`;
  const group={id,order,status,identity_key:identityKey||analysisTargetIdentityKey(identityContext),identity_context:identityContext?clone(identityContext):null,draft:emptyDraft(),revisions:[],latest_revision:null,created_at:nowIso(),updated_at:nowIso()};
  group.draft.analysis_target_context=group.identity_context?clone(group.identity_context):null;
  groups.set(id,group);trace('confirmation_group_created',{group_id:id,status,order,target_mode:group.identity_context?.mode||'legacy',platform_identity:Boolean(group.identity_key)});return group;
}
function activeGroup(){return activeGroupId?groups.get(activeGroupId)||null:null;}
function openGroups(){return [...groups.values()].filter(row=>row.status!=='closed').sort((a,b)=>a.order-b.order);}
function pendingGroups(){return openGroups().filter(row=>row.id!==activeGroupId&&row.status==='pending');}
function getNavigationState(){
  const ordered=openGroups(),index=ordered.findIndex(row=>row.id===activeGroupId);
  const previous=index>0?ordered[index-1]:null;
  const next=index>=0&&index<ordered.length-1?ordered[index+1]:null;
  return {
    active_group_id:activeGroupId,
    position:index>=0?index+1:0,
    total:ordered.length,
    pending_count:pendingGroups().length,
    has_previous:Boolean(previous),
    previous_group_id:previous?.id||null,
    has_next:Boolean(next),
    next_group_id:next?.id||null,
  };
}
function publishNavigation(reason='navigation_changed'){
  const detail={...getNavigationState(),reason};
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-navigation-changed',{detail}));
  trace('confirmation_navigation_changed',{reason,position:detail.position,total:detail.total,pending_count:detail.pending_count,has_previous:detail.has_previous,has_next:detail.has_next});
  return detail;
}
function shouldStartNewGroupForRevision(current,incoming){const currentSpecies=clean(current?.species),incomingSpecies=clean(incoming?.species);return Boolean((current?.source_refs?.length||0)>0&&currentSpecies&&incomingSpecies&&currentSpecies!==incomingSpecies);}
function resolveEvolutionDraftAuthority(draft){return resolveEvolutionAuthority(draft.species,rows);}
function overlayExistingBaseline(draft,context){
  const out=clone(draft||emptyDraft());
  const baseline=context?.mode==='existing'?context?.baseline_reference:null;
  if(!baseline)return out;
  const hydrated=[];
  for(const field of BASELINE_SCALAR_FIELDS){
    if(blank(out[field])&&!blank(baseline[field])){out[field]=clone(baseline[field]);hydrated.push(field);}
  }
  if((!out.ingredients||out.ingredients.length===0)&&Array.isArray(baseline.ingredients)&&baseline.ingredients.length){out.ingredients=clone(baseline.ingredients);hydrated.push('ingredients');}
  if((!out.subskills||out.subskills.length===0)&&Array.isArray(baseline.subskills)&&baseline.subskills.length){out.subskills=clone(baseline.subskills);hydrated.push('subskills');}
  out.baseline_reference_status='REFERENCE_OVERLAY_ACTIVE';
  out.baseline_hydrated_fields=[...new Set(hydrated)];
  out.analysis_target_context=context?clone(context):out.analysis_target_context;
  return out;
}
function hydratedDraft(group){
  const overlaid=overlayExistingBaseline(group?.draft||emptyDraft(),group?.identity_context||group?.draft?.analysis_target_context||null);
  return hydrateEvolutionDraft(overlaid,resolveEvolutionDraftAuthority(overlaid));
}
function dispatchSelected(group,reason='selected'){
  const navigation=getNavigationState();
  const detail=group?{group_id:group.id,status:group.status,reason,revision:group.latest_revision?clone(group.latest_revision):null,draft:clone(hydratedDraft(group)),identity_context:group.identity_context?clone(group.identity_context):null,pending_count:navigation.pending_count,navigation}:{group_id:null,status:'empty',reason,revision:null,draft:null,identity_context:null,pending_count:0,navigation};
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-group-selected',{detail}));
  trace('confirmation_group_selected',{group_id:detail.group_id,reason,pending_count:detail.pending_count,species:detail.draft?.species||null,position:navigation.position,total:navigation.total,target_mode:detail.identity_context?.mode||'legacy'});
}
function selectGroup(groupId,{reason='manual_select'}={}){
  const next=groups.get(groupId);if(!next||next.status==='closed')return null;
  const current=activeGroup();if(current&&current.id!==next.id)current.status='pending';
  next.status='active';next.updated_at=nowIso();activeGroupId=next.id;dispatchSelected(next,reason);publishNavigation(reason);setTimeout(renderGroupNotice,0);return next;
}
function replaceActiveDraft(draft,{reason='manual_navigation_snapshot'}={}){
  const current=activeGroup();if(!current||!draft)return null;
  const metadata={
    source_refs:[...(current.draft?.source_refs||[])],
    analysis_ids:[...(current.draft?.analysis_ids||[])],
    conflicts:[...(current.draft?.conflicts||[])],
    conflicted_fields:[...(current.draft?.conflicted_fields||[])],
    identity_guard_warnings:[...(current.draft?.identity_guard_warnings||[])],
    analysis_target_context:current.identity_context?clone(current.identity_context):null,
    baseline_reference_status:null,
    baseline_hydrated_fields:[],
  };
  current.draft={...current.draft,...clone(draft),...metadata};
  current.updated_at=nowIso();
  trace('confirmation_group_manual_draft_saved',{group_id:current.id,reason,species:current.draft?.species||null,nickname:current.draft?.nickname||null,target_mode:current.identity_context?.mode||'legacy'});
  return current;
}
function navigateReviewGroup(offset,{reason=null,createIfEmpty=false}={}){
  const step=Number(offset)<0?-1:1;
  const navigation=getNavigationState();
  const targetId=step<0?navigation.previous_group_id:navigation.next_group_id;
  if(targetId){
    const selected=selectGroup(targetId,{reason:reason||(step<0?'manual_previous_pokemon':'manual_next_pokemon')});
    trace('confirmation_group_navigated',{direction:step<0?'previous':'next',group_id:selected?.id||null,reason,pending_count:pendingGroups().length});
    return selected;
  }
  if(step>0&&createIfEmpty){
    const created=createGroup({status:'pending'});
    const selected=selectGroup(created.id,{reason:reason||'manual_next_pokemon_new_group'});
    trace('confirmation_group_navigated',{direction:'next_new_group',group_id:selected?.id||null,reason,pending_count:pendingGroups().length});
    return selected;
  }
  publishNavigation(reason||'navigation_boundary');
  trace('confirmation_group_navigation_boundary',{direction:step<0?'previous':'next',active_group_id:activeGroupId,reason});
  return null;
}
function advanceReviewGroup({reason='manual_next_pokemon',createIfEmpty=true}={}){
  const selected=navigateReviewGroup(1,{reason,createIfEmpty});
  trace('confirmation_group_advanced',{group_id:selected?.id||activeGroupId||null,reason,pending_count:pendingGroups().length});
  return selected;
}
function closeActiveGroup(reason='terminal'){
  const current=activeGroup();
  const order=current?.order??null;
  if(current){current.status='closed';current.closed_at=nowIso();current.close_reason=reason;trace('confirmation_group_closed',{group_id:current.id,reason,species:current.draft?.species||null,target_mode:current.identity_context?.mode||'legacy'});}
  activeGroupId=null;
  const ordered=openGroups();
  const next=(order==null?ordered[0]:ordered.find(row=>row.order>order))||ordered[0]||null;
  if(next)return selectGroup(next.id,{reason:`after_${reason}`});
  dispatchSelected(null,`after_${reason}`);publishNavigation(`after_${reason}`);return null;
}
function findGroupForRevision(revision,incoming){
  const targetContext=resolveRevisionAnalysisTarget(revision)||incoming?.analysis_target_context||null;
  const targetKey=analysisTargetIdentityKey(targetContext);
  if(targetKey){
    const matched=openGroups().find(row=>row.identity_key===targetKey);
    if(matched)return matched;
    return createGroup({status:activeGroupId?'pending':'active',identityContext:targetContext,identityKey:targetKey});
  }
  const current=activeGroup(),incomingSpecies=clean(incoming?.species);
  if(current&&!current.identity_key&&!shouldStartNewGroupForRevision(current.draft,incoming))return current;
  if(incomingSpecies){
    const matched=openGroups().find(row=>!row.identity_key&&clean(row.draft?.species)===incomingSpecies);if(matched)return matched;
  }
  return createGroup({status:current?'pending':'active'});
}
function requestActiveDraftSnapshot(reason){
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-snapshot-request',{detail:{reason,active_group_id:activeGroupId}}));
  trace('confirmation_group_snapshot_requested',{reason,active_group_id:activeGroupId});
}
function upsertRevision(revision){
  const incoming=normalizeRevision(revision),target=findGroupForRevision(revision,incoming);
  if(!target.identity_context&&incoming.analysis_target_context){target.identity_context=clone(incoming.analysis_target_context);target.identity_key=analysisTargetIdentityKey(target.identity_context);}
  target.draft=mergeDraft(target.draft,incoming);target.latest_revision={...revision,identity_context:target.identity_context?clone(target.identity_context):revision.identity_context||null};target.revisions.push(target.latest_revision);target.updated_at=nowIso();
  const hadActive=Boolean(activeGroupId),differentPlatformTarget=Boolean(target.identity_key&&hadActive&&target.id!==activeGroupId);
  if(differentPlatformTarget){
    target.status='pending';
    trace('confirmation_group_queued',{group_id:target.id,active_group_id:activeGroupId,species:target.draft?.species||null,pending_count:pendingGroups().length,target_mode:target.identity_context?.mode||'legacy',reason:'platform_target_background_revision'});
    publishNavigation('platform_target_background_revision_queued');
  }else if(!hadActive||target.id===activeGroupId){
    if(!hadActive){activeGroupId=target.id;target.status='active';dispatchSelected(target,'first_revision');publishNavigation('first_revision');}
    else {globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-merged',{detail:{group_id:target.id,status:target.status,revision:clone(target.latest_revision),draft:clone(hydratedDraft(target)),identity_context:target.identity_context?clone(target.identity_context):null,pending_count:pendingGroups().length,navigation:getNavigationState()}}));publishNavigation('revision_merged');}
  }else {trace('confirmation_group_queued',{group_id:target.id,active_group_id:activeGroupId,species:target.draft?.species||null,pending_count:pendingGroups().length,target_mode:target.identity_context?.mode||'legacy'});publishNavigation('group_queued');}
  setTimeout(renderGroupNotice,0);
  trace('multicapture_revision_merged',{group_id:target.id,active_group_id:activeGroupId,source_count:target.draft.source_refs.length,analysis_count:target.draft.analysis_ids.length,conflict_count:target.draft.conflicts.length,conflicted_field_count:target.draft.conflicted_fields.length,identity_guard_warning_count:target.draft.identity_guard_warnings.length,main_skill_level:target.draft.main_skill_level??null,species:target.draft.species||null,evolution_rehydration:true,legacy_partial_writer_disabled:true,platform_identity_authority:Boolean(target.identity_key),target_mode:target.identity_context?.mode||'legacy',existing_baseline_overlay:Boolean(target.identity_context?.mode==='existing'&&target.identity_context?.baseline_reference),platform_target_auto_focus:false,background_target_queue:true,partial_collection_merge:true});
  return target;
}

function renderGroupNotice(){
  const root=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');if(!root)return;
  let panel=root.querySelector('#captureGroupStatus');
  if(!panel){panel=document.createElement('section');panel.id='captureGroupStatus';panel.className='notice';root.querySelector('header')?.insertAdjacentElement('afterend',panel);}
  const current=activeGroup();if(!current){panel.remove();return;}
  const data=hydratedDraft(current),navigation=getNavigationState(),context=current.identity_context;
  const targetLabel=context?.mode==='existing'?`既有成員：${esc(context.target_label_snapshot||context.target_species_snapshot||'已綁定個體')}`:context?.mode==='new'?'新增寶可夢：平台 Capture Group':'Legacy／未綁定模式';
  panel.innerHTML=`<b>同一寶可夢多截圖群組</b><br><b>Identity Authority：</b>${targetLabel}<br>目前：${navigation.position}/${navigation.total||1}；來源圖片：${current.draft.source_refs?.length||0}；分析 revision：${current.draft.analysis_ids?.length||0}；衝突：${current.draft.conflicts?.length||0}；待確認群組：${navigation.pending_count}<br><small>${(current.draft.source_refs||[]).map(esc).join('、')||'尚無來源'}</small>${data.baseline_reference_status==='REFERENCE_OVERLAY_ACTIVE'&&data.baseline_hydrated_fields?.length?`<div class="notice success"><b>Existing Baseline Reference</b><br>目前資料庫值已補入人工確認畫面：${data.baseline_hydrated_fields.map(esc).join('、')}。這些值只是 review default，不會因此成為新圖片 Evidence；維持不變即不更新。</div>`:''}${current.draft.identity_guard_warnings?.length?`<div class="notice pending"><b>Identity Guard</b><br>${current.draft.identity_guard_warnings.map(row=>esc(row.message)).join('<br>')}</div>`:''}${current.draft.conflicts?.length?`<details open><summary>欄位衝突：已 Fail-Closed，Baseline 只供參考，請人工選擇正確值</summary><pre>${esc(JSON.stringify(current.draft.conflicts,null,2))}</pre></details>`:''}`;
}

globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>upsertRevision(event.detail?.revision||event.detail||{}));
globalThis.addEventListener('pokemon-sleep:analysis-confirmation-terminal',event=>closeActiveGroup(event?.detail?.reason||'confirmation_terminal'));

globalThis.PokemonSleepMultiCaptureConsistency={
  normalizeRevision,mergeDraft,overlayExistingBaseline,shouldStartNewGroupForRevision,upsertRevision,selectGroup,replaceActiveDraft,navigateReviewGroup,advanceReviewGroup,closeActiveGroup,getNavigationState,publishNavigation,
  getState:()=>({active_group_id:activeGroupId,groups:[...groups.values()].map(clone),navigation:getNavigationState()}),
};

globalThis.UpdateCenterLiveDebug?.record?.('data_consistency_multicapture_ready',{version:VERSION,build:BUILD,patch_semantics:true,null_safe_numeric:true,observation_v2:true,observation_v2_profile_berry_authority:true,evolution_rehydration:true,legacy_partial_writer_disabled:true,navigable_review_groups:true,bidirectional_review_navigation:true,nickname_fail_closed:true,platform_identity_authority:true,cross_image_conflict_fail_closed:true,existing_baseline_review_overlay:true,live_navigation_sync:true,platform_target_auto_focus:false,background_target_queue:true,partial_collection_merge:true});

export {VERSION,BUILD,normalizeRevision,resolveFavoriteBerryAuthority,mergeDraft,overlayExistingBaseline,shouldStartNewGroupForRevision,upsertRevision,selectGroup,replaceActiveDraft,navigateReviewGroup,advanceReviewGroup,closeActiveGroup,getNavigationState,publishNavigation};
