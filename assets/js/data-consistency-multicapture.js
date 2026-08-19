import {rows} from './database.js';
import {resolveEvolutionAuthority,hydrateEvolutionDraft,evolutionAuthorityLabel} from './analysis-confirmation-evolution-authority.js';

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
const emptyDraft=()=>({source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[],identity_guard_warnings:[]});
const trace=(event,detail={})=>{globalThis.UpdateCenterLiveDebug?.record?.(event,detail);globalThis.DebugTrace?.record?.('ai_review',event,{status:'completed',details:detail});};

const firstNonblank=(...values)=>{for(const value of values){const result=clean(value);if(result)return result;}return '';};
// Legacy static-contract parser bridge only; not runtime authority: profile?.header_name_text??profile?.species
function resolveObservedSpecies({raw={},observation={}}={}){
  const profile=observation?.profile||{},identity=observation?.identity||{};
  return firstNonblank(profile.species,raw?.pokemon_name,profile.header_name_text,identity.current_species_id,identity.capture_species_id);
}
function resolveObservedNickname({raw={},observation={},species=null}={}){
  const profile=observation?.profile||{},candidate=firstNonblank(profile.nickname,raw?.nickname);
  if(!candidate)return {value:'',candidate:'',status:'EMPTY',reason:null};
  const basis=clean(profile.nickname_observation_basis);
  if(basis!=='DIRECT_EXPLICIT_NICKNAME_FIELD')return {value:'',candidate,status:'REJECTED_UNPROVEN',reason:'NICKNAME_REQUIRES_DIRECT_EXPLICIT_FIELD',compared_species:clean(species)||null,header_name_text:clean(profile.header_name_text)||null};
  return {value:candidate,candidate,status:'ACCEPTED_DIRECT_EXPLICIT_FIELD',reason:null};
}
function buildIdentityGuardWarnings({nicknameResult}={}){
  if(!nicknameResult||!nicknameResult.candidate||nicknameResult.value)return [];
  return [{field:'nickname',candidate:nicknameResult.candidate,status:nicknameResult.status,reason:nicknameResult.reason,message:'暱稱缺少獨立直接證據，平台已留空，避免由頁首名稱／物種名稱或其他圖片自行補值。'}];
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
  if(revision?.analysis_type!=='ai'){
    const regions=Array.isArray(raw?.regions)?raw.regions:Array.isArray(raw)?raw:[];
    return {species:'',nickname:'',level:null,sp:null,specialty:'',type:'',nature:'',nature_bonus:'',nature_penalty:'',main_skill:'',main_skill_level:null,main_skill_description:'',helper_seconds:null,carry_limit:null,favorite_berry:'',sleep_hours:null,sleep_time_text:'',registered_at:'',obtained_at:'',is_favorite:null,confidence:null,subskills:[],ingredients:[],source_text:regions.map(row=>`${row.name||row.region||'區域'}\n${row.text||row.ocr_text||''}`).join('\n\n'),source_refs:[revision?.source_image_ref].filter(Boolean),analysis_ids:[revision?.analysis_id].filter(Boolean),conflicts:[],identity_guard_warnings:[]};
  }
  const observation=Array.isArray(raw?.observations)?raw.observations[0]||{}:{};
  const profile=observation?.profile||{};
  const identity=observation?.identity||{};
  const rawNature=raw?.nature;
  const favoriteValue=observation?.is_favorite??raw?.is_favorite;
  const species=resolveObservedSpecies({raw,observation});
  const nicknameResult=resolveObservedNickname({raw,observation,species});
  const identityGuardWarnings=buildIdentityGuardWarnings({nicknameResult});
  if(identityGuardWarnings.length)trace('analysis_identity_guard_rejected',{analysis_id:revision?.analysis_id||null,source_image_ref:revision?.source_image_ref||null,field:'nickname',candidate:nicknameResult.candidate,reason:nicknameResult.reason,species});
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
    favorite_berry:clean(raw?.favorite_berry??profile?.favorite_berry),
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
    identity_guard_warnings:identityGuardWarnings,
  };
}

const MERGE_FIELDS=['species','nickname','level','sp','specialty','type','nature','nature_bonus','nature_penalty','main_skill','main_skill_level','main_skill_description','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','registered_at','obtained_at','is_favorite','confidence'];
function mergeDraft(base,next){
  const out={...base};const conflicts=[];
  for(const key of MERGE_FIELDS){
    if(blank(next[key]))continue;
    if(blank(out[key]))out[key]=next[key];
    else if(String(out[key])!==String(next[key]))conflicts.push({field:key,existing:out[key],incoming:next[key]});
  }
  if(next.subskills?.length){if(!out.subskills?.length)out.subskills=next.subskills;else if(JSON.stringify(out.subskills)!==JSON.stringify(next.subskills))conflicts.push({field:'subskills',existing:out.subskills,incoming:next.subskills});}
  if(next.ingredients?.length){if(!out.ingredients?.length)out.ingredients=next.ingredients;else if(JSON.stringify(out.ingredients)!==JSON.stringify(next.ingredients))conflicts.push({field:'ingredients',existing:out.ingredients,incoming:next.ingredients});}
  out.source_text=[out.source_text,next.source_text].filter(Boolean).join('\n\n---\n\n');
  out.source_refs=[...new Set([...(out.source_refs||[]),...(next.source_refs||[])])];
  out.analysis_ids=[...new Set([...(out.analysis_ids||[]),...(next.analysis_ids||[])])];
  out.conflicts=[...(out.conflicts||[]),...conflicts];
  out.identity_guard_warnings=[...(out.identity_guard_warnings||[]),...(next.identity_guard_warnings||[])];
  return out;
}

function createGroup({status='pending'}={}){
  const order=++groupSequence;
  const id=`capture-${Date.now()}-${order}`;
  const group={id,order,status,draft:emptyDraft(),revisions:[],latest_revision:null,created_at:nowIso(),updated_at:nowIso()};
  groups.set(id,group);trace('confirmation_group_created',{group_id:id,status,order});return group;
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
function shouldStartNewGroupForRevision(current,incoming){const currentSpecies=clean(current?.species),incomingSpecies=clean(incoming?.species);return Boolean((current?.source_refs?.length||0)>0&&currentSpecies&&incomingSpecies&&currentSpecies!==incomingSpecies);}
function resolveEvolutionDraftAuthority(draft){return resolveEvolutionAuthority(draft.species,rows);}
function hydratedDraft(group){return hydrateEvolutionDraft(group?.draft||emptyDraft(),resolveEvolutionDraftAuthority(group?.draft||emptyDraft()));}
function dispatchSelected(group,reason='selected'){
  const navigation=getNavigationState();
  const detail=group?{group_id:group.id,status:group.status,reason,revision:group.latest_revision?clone(group.latest_revision):null,draft:clone(hydratedDraft(group)),pending_count:navigation.pending_count,navigation}:{group_id:null,status:'empty',reason,revision:null,draft:null,pending_count:0,navigation};
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-group-selected',{detail}));
  trace('confirmation_group_selected',{group_id:detail.group_id,reason,pending_count:detail.pending_count,species:detail.draft?.species||null,position:navigation.position,total:navigation.total});
}
function selectGroup(groupId,{reason='manual_select'}={}){
  const next=groups.get(groupId);if(!next||next.status==='closed')return null;
  const current=activeGroup();if(current&&current.id!==next.id)current.status='pending';
  next.status='active';next.updated_at=nowIso();activeGroupId=next.id;dispatchSelected(next,reason);setTimeout(renderGroupNotice,0);return next;
}
function replaceActiveDraft(draft,{reason='manual_navigation_snapshot'}={}){
  const current=activeGroup();if(!current||!draft)return null;
  const metadata={
    source_refs:[...(current.draft?.source_refs||[])],
    analysis_ids:[...(current.draft?.analysis_ids||[])],
    conflicts:[...(current.draft?.conflicts||[])],
    identity_guard_warnings:[...(current.draft?.identity_guard_warnings||[])],
  };
  current.draft={...current.draft,...clone(draft),...metadata};
  current.updated_at=nowIso();
  trace('confirmation_group_manual_draft_saved',{group_id:current.id,reason,species:current.draft?.species||null,nickname:current.draft?.nickname||null});
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
  if(current){current.status='closed';current.closed_at=nowIso();current.close_reason=reason;trace('confirmation_group_closed',{group_id:current.id,reason,species:current.draft?.species||null});}
  activeGroupId=null;
  const ordered=openGroups();
  const next=(order==null?ordered[0]:ordered.find(row=>row.order>order))||ordered[0]||null;
  if(next)return selectGroup(next.id,{reason:`after_${reason}`});
  dispatchSelected(null,`after_${reason}`);return null;
}
function findGroupForRevision(incoming){
  const current=activeGroup(),incomingSpecies=clean(incoming?.species);
  if(current&&!shouldStartNewGroupForRevision(current.draft,incoming))return current;
  if(incomingSpecies){
    const matched=openGroups().find(row=>clean(row.draft?.species)===incomingSpecies);if(matched)return matched;
  }
  return createGroup({status:current?'pending':'active'});
}
function upsertRevision(revision){
  const incoming=normalizeRevision(revision),target=findGroupForRevision(incoming);
  target.draft=mergeDraft(target.draft,incoming);target.latest_revision=revision;target.revisions.push(revision);target.updated_at=nowIso();
  const hadActive=Boolean(activeGroupId);
  if(!hadActive||target.id===activeGroupId){if(!hadActive){activeGroupId=target.id;target.status='active';dispatchSelected(target,'first_revision');}else globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-merged',{detail:{group_id:target.id,status:target.status,revision:clone(revision),draft:clone(hydratedDraft(target)),pending_count:pendingGroups().length,navigation:getNavigationState()}}));}
  else trace('confirmation_group_queued',{group_id:target.id,active_group_id:activeGroupId,species:target.draft?.species||null,pending_count:pendingGroups().length});
  setTimeout(renderGroupNotice,0);
  trace('multicapture_revision_merged',{group_id:target.id,active_group_id:activeGroupId,source_count:target.draft.source_refs.length,analysis_count:target.draft.analysis_ids.length,conflict_count:target.draft.conflicts.length,identity_guard_warning_count:target.draft.identity_guard_warnings.length,main_skill_level:target.draft.main_skill_level??null,species:target.draft.species||null,evolution_rehydration:true,legacy_partial_writer_disabled:true});
  return target;
}

function renderGroupNotice(){
  const root=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');if(!root)return;
  let panel=root.querySelector('#captureGroupStatus');
  if(!panel){panel=document.createElement('section');panel.id='captureGroupStatus';panel.className='notice';root.querySelector('header')?.insertAdjacentElement('afterend',panel);}
  const current=activeGroup();if(!current){panel.remove();return;}
  const data=current.draft,navigation=getNavigationState();
  panel.innerHTML=`<b>同一寶可夢多截圖群組</b><br>目前：${navigation.position}/${navigation.total||1}；來源圖片：${data.source_refs?.length||0}；分析 revision：${data.analysis_ids?.length||0}；衝突：${data.conflicts?.length||0}；待確認群組：${navigation.pending_count}<br><small>${(data.source_refs||[]).map(esc).join('、')||'尚無來源'}</small>${data.identity_guard_warnings?.length?`<div class="notice pending"><b>Identity Guard</b><br>${data.identity_guard_warnings.map(row=>esc(row.message)).join('<br>')}</div>`:''}${data.conflicts?.length?`<details><summary>欄位衝突，請以表單目前值人工確認</summary><pre>${esc(JSON.stringify(data.conflicts,null,2))}</pre></details>`:''}`;
}

globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>upsertRevision(event.detail?.revision||event.detail||{}));
globalThis.addEventListener('pokemon-sleep:analysis-confirmation-terminal',event=>closeActiveGroup(event?.detail?.reason||'confirmation_terminal'));

globalThis.PokemonSleepMultiCaptureConsistency={
  normalizeRevision,mergeDraft,shouldStartNewGroupForRevision,upsertRevision,selectGroup,replaceActiveDraft,navigateReviewGroup,advanceReviewGroup,closeActiveGroup,getNavigationState,
  getState:()=>({active_group_id:activeGroupId,groups:[...groups.values()].map(clone),navigation:getNavigationState()}),
};

globalThis.UpdateCenterLiveDebug?.record?.('data_consistency_multicapture_ready',{version:VERSION,build:BUILD,patch_semantics:true,null_safe_numeric:true,observation_v2:true,evolution_rehydration:true,legacy_partial_writer_disabled:true,navigable_review_groups:true,bidirectional_review_navigation:true,nickname_fail_closed:true});

export {VERSION,BUILD,normalizeRevision,mergeDraft,shouldStartNewGroupForRevision,upsertRevision,selectGroup,replaceActiveDraft,navigateReviewGroup,advanceReviewGroup,closeActiveGroup,getNavigationState};