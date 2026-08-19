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
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const blank=value=>value===null||value===undefined||value===''||(Array.isArray(value)&&value.length===0);
const clone=value=>JSON.parse(JSON.stringify(value));
const nowIso=()=>new Date().toISOString();
const emptyDraft=()=>({source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[]});
const trace=(event,detail={})=>{globalThis.UpdateCenterLiveDebug?.record?.(event,detail);globalThis.DebugTrace?.record?.('ai_review',event,{status:'completed',details:detail});};

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
    return {species:'',nickname:'',level:null,sp:null,specialty:'',type:'',nature:'',nature_bonus:'',nature_penalty:'',main_skill:'',main_skill_level:null,main_skill_description:'',helper_seconds:null,carry_limit:null,favorite_berry:'',sleep_hours:null,sleep_time_text:'',registered_at:'',obtained_at:'',is_favorite:null,confidence:null,subskills:[],ingredients:[],source_text:regions.map(row=>`${row.name||row.region||'區域'}\n${row.text||row.ocr_text||''}`).join('\n\n'),source_refs:[revision?.source_image_ref].filter(Boolean),analysis_ids:[revision?.analysis_id].filter(Boolean),conflicts:[]};
  }
  const observation=Array.isArray(raw?.observations)?raw.observations[0]||{}:{};
  const profile=observation?.profile||{};
  const identity=observation?.identity||{};
  const rawNature=raw?.nature;
  const favoriteValue=observation?.is_favorite??raw?.is_favorite;
  return {
    species:clean(raw?.pokemon_name??profile?.header_name_text??profile?.species),
    nickname:clean(raw?.nickname??profile?.nickname),
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
  return out;
}

function createGroup({status='pending'}={}){
  const id=`capture-${Date.now()}-${++groupSequence}`;
  const group={id,status,draft:emptyDraft(),revisions:[],latest_revision:null,created_at:nowIso(),updated_at:nowIso()};
  groups.set(id,group);trace('confirmation_group_created',{group_id:id,status});return group;
}
function activeGroup(){return activeGroupId?groups.get(activeGroupId)||null:null;}
function openGroups(){return [...groups.values()].filter(row=>row.status!=='closed').sort((a,b)=>a.created_at.localeCompare(b.created_at));}
function pendingGroups(){return openGroups().filter(row=>row.id!==activeGroupId&&row.status==='pending');}
function shouldStartNewGroupForRevision(current,incoming){const currentSpecies=clean(current?.species),incomingSpecies=clean(incoming?.species);return Boolean((current?.source_refs?.length||0)>0&&currentSpecies&&incomingSpecies&&currentSpecies!==incomingSpecies);}
function resolveEvolutionDraftAuthority(draft){return resolveEvolutionAuthority(draft.species,rows);}
function hydratedDraft(group){return hydrateEvolutionDraft(group?.draft||emptyDraft(),resolveEvolutionDraftAuthority(group?.draft||emptyDraft()));}
function dispatchSelected(group,reason='selected'){
  const detail=group?{group_id:group.id,status:group.status,reason,revision:group.latest_revision?clone(group.latest_revision):null,draft:clone(hydratedDraft(group)),pending_count:pendingGroups().length}:{group_id:null,status:'empty',reason,revision:null,draft:null,pending_count:0};
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-group-selected',{detail}));
  trace('confirmation_group_selected',{group_id:detail.group_id,reason,pending_count:detail.pending_count,species:detail.draft?.species||null});
}
function selectGroup(groupId,{reason='manual_select'}={}){
  const next=groups.get(groupId);if(!next||next.status==='closed')return null;
  const current=activeGroup();if(current&&current.id!==next.id)current.status='pending';
  next.status='active';next.updated_at=nowIso();activeGroupId=next.id;dispatchSelected(next,reason);setTimeout(renderGroupNotice,0);return next;
}
function advanceReviewGroup({reason='manual_next_pokemon',createIfEmpty=true}={}){
  const queue=pendingGroups();let next=queue[0]||null;
  if(!next&&createIfEmpty)next=createGroup({status:'pending'});
  if(next){const selected=selectGroup(next.id,{reason});trace('confirmation_group_advanced',{group_id:selected?.id||null,reason,pending_count:pendingGroups().length});return selected;}
  activeGroupId=null;dispatchSelected(null,reason);trace('confirmation_group_advanced',{group_id:null,reason,pending_count:0});return null;
}
function closeActiveGroup(reason='terminal'){
  const current=activeGroup();if(current){current.status='closed';current.closed_at=nowIso();current.close_reason=reason;trace('confirmation_group_closed',{group_id:current.id,reason,species:current.draft?.species||null});}
  activeGroupId=null;return advanceReviewGroup({reason:`after_${reason}`,createIfEmpty:false});
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
  if(!hadActive||target.id===activeGroupId){if(!hadActive){activeGroupId=target.id;target.status='active';dispatchSelected(target,'first_revision');}else globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-merged',{detail:{group_id:target.id,status:target.status,revision:clone(revision),draft:clone(hydratedDraft(target)),pending_count:pendingGroups().length}}));}
  else trace('confirmation_group_queued',{group_id:target.id,active_group_id:activeGroupId,species:target.draft?.species||null,pending_count:pendingGroups().length});
  setTimeout(renderGroupNotice,0);
  trace('multicapture_revision_merged',{group_id:target.id,active_group_id:activeGroupId,source_count:target.draft.source_refs.length,analysis_count:target.draft.analysis_ids.length,conflict_count:target.draft.conflicts.length,main_skill_level:target.draft.main_skill_level??null,species:target.draft.species||null,evolution_rehydration:true,legacy_partial_writer_disabled:true});
  return target;
}

function renderGroupNotice(){
  const root=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');if(!root)return;
  let panel=root.querySelector('#captureGroupStatus');
  if(!panel){panel=document.createElement('section');panel.id='captureGroupStatus';panel.className='notice';root.querySelector('header')?.insertAdjacentElement('afterend',panel);}
  const current=activeGroup();if(!current){panel.remove();return;}
  const data=current.draft,queued=pendingGroups().length;
  panel.innerHTML=`<b>同一寶可夢多截圖群組</b><br>來源圖片：${data.source_refs?.length||0}；分析 revision：${data.analysis_ids?.length||0}；衝突：${data.conflicts?.length||0}；待確認群組：${queued}<br><small>${(data.source_refs||[]).map(esc).join('、')||'尚無來源'}</small><div class="buttons"><button type="button" id="startNewCaptureGroup" class="secondary">${queued?`下一隻寶可夢（${queued}）`:'建立新群組'}</button></div>${data.conflicts?.length?`<details><summary>欄位衝突，請以表單目前值人工確認</summary><pre>${esc(JSON.stringify(data.conflicts,null,2))}</pre></details>`:''}`;
  panel.querySelector('#startNewCaptureGroup').onclick=()=>advanceReviewGroup({reason:'manual_next_pokemon',createIfEmpty:true});
}

globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>upsertRevision(event.detail?.revision||event.detail||{}));
globalThis.addEventListener('pokemon-sleep:analysis-confirmation-terminal',event=>closeActiveGroup(event?.detail?.reason||'confirmation_terminal'));

globalThis.PokemonSleepMultiCaptureConsistency={
  normalizeRevision,mergeDraft,shouldStartNewGroupForRevision,upsertRevision,selectGroup,advanceReviewGroup,closeActiveGroup,
  getState:()=>({active_group_id:activeGroupId,groups:[...groups.values()].map(clone)}),
};

globalThis.UpdateCenterLiveDebug?.record?.('data_consistency_multicapture_ready',{version:VERSION,build:BUILD,patch_semantics:true,null_safe_numeric:true,observation_v2:true,evolution_rehydration:true,legacy_partial_writer_disabled:true,navigable_review_groups:true});

export {VERSION,BUILD,normalizeRevision,mergeDraft,shouldStartNewGroupForRevision,upsertRevision,selectGroup,advanceReviewGroup,closeActiveGroup};