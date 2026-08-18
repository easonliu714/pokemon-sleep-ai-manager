import {rows} from './database.js';
import {resolveEvolutionAuthority,hydrateEvolutionDraft,evolutionAuthorityLabel} from './analysis-confirmation-evolution-authority.js';

const VERSION=globalThis.PokemonSleepVersionAuthority?.app_version||'unknown';
const BUILD=globalThis.PokemonSleepVersionAuthority?.app_build||'unknown';
const groups=new Map();
let activeGroupId=`capture-${Date.now()}`;

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
    return {species:'',nickname:'',level:null,sp:null,specialty:'',type:'',nature:'',nature_bonus:'',nature_penalty:'',main_skill:'',main_skill_level:null,main_skill_description:'',helper_seconds:null,carry_limit:null,favorite_berry:'',sleep_hours:null,sleep_time_text:'',registered_at:'',is_favorite:null,confidence:null,subskills:[],ingredients:[],source_text:regions.map(row=>`${row.name||row.region||'區域'}\n${row.text||row.ocr_text||''}`).join('\n\n'),source_refs:[revision?.source_image_ref].filter(Boolean),analysis_ids:[revision?.analysis_id].filter(Boolean),conflicts:[]};
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
    registered_at:clean(identity?.registered_date??raw?.registered_at??raw?.obtained_at),
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

const MERGE_FIELDS=['species','nickname','level','sp','specialty','type','nature','nature_bonus','nature_penalty','main_skill','main_skill_level','main_skill_description','helper_seconds','carry_limit','favorite_berry','sleep_hours','sleep_time_text','registered_at','is_favorite','confidence'];
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
function group(){
  if(!groups.has(activeGroupId))groups.set(activeGroupId,{draft:{source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[]},created_at:new Date().toISOString()});
  return groups.get(activeGroupId);
}
function resetActiveGroup(reason='reset'){
  const previousGroupId=activeGroupId;
  activeGroupId=`capture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  group();
  globalThis.UpdateCenterLiveDebug?.record?.('multicapture_group_reset',{reason,previous_group_id:previousGroupId,group_id:activeGroupId});
  return activeGroupId;
}
function startNewGroup(){
  resetActiveGroup('user_new_group');
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-capture-group-reset',{detail:{reason:'user_new_group',group_id:activeGroupId}}));
  renderGroupNotice();
}

function setField(root,name,value){
  if(blank(value))return;
  const node=root.querySelector(`[data-field="${name}"]`);
  if(node)node.value=value;
}
function applyCollectionRows(root,draft){
  for(const row of draft.ingredients||[]){
    const level=number(row.unlock_level);if(!level)continue;
    setField(root,`ingredient_name_${level}`,row.ingredient_name);
    if(!blank(row.quantity))setField(root,`ingredient_qty_${level}`,row.quantity);
  }
  for(const row of draft.subskills||[]){
    const level=number(row.unlock_level);if(!level)continue;
    setField(root,`subskill_name_${level}`,row.subskill_name);
    const check=root.querySelector(`[data-check="sub_unlock_${level}"]`);if(check)check.checked=Boolean(row.is_unlocked);
  }
}
function applyEvolutionAuthority(root,draft){
  const hydrated=hydrateEvolutionDraft(draft,resolveEvolutionAuthority(draft.species,rows));
  for(const key of ['evolution_level_required','evolution_sleep_hours_required','evolution_candy_required','evolution_item_required','evolution_other_requirement'])setField(root,key,hydrated[key]);
  const authority=hydrated.evolution_authority||{};
  const notice=root.querySelector('[data-evolution-authority-status]');
  if(notice){
    const alert=String(authority.status||'').startsWith('REVIEW_REQUIRED')||authority.status==='MULTIPLE_PUBLIC_ROUTES_REVIEW_REQUIRED'||authority.status==='SPECIES_UNRESOLVED';
    notice.className=`notice ${alert?'error':'success'}`;
    notice.dataset.evolutionAuthorityStatus=authority.status||'UNKNOWN';
    notice.innerHTML=`<strong>公版進化條件</strong><br>${esc(evolutionAuthorityLabel(authority))}`;
  }
  return hydrated;
}
function applyMergedDraftToForm(){
  const root=document.getElementById('analysisConfirmationWorkbench');if(!root)return;
  const draft=group().draft;
  for(const key of MERGE_FIELDS)setField(root,key,draft[key]);
  if(draft.source_text)setField(root,'source_text',draft.source_text);
  applyCollectionRows(root,draft);
  const hydrated=applyEvolutionAuthority(root,draft);
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-merged',{detail:{group_id:activeGroupId,draft:{...draft,evolution_authority:hydrated.evolution_authority}}}));
  renderGroupNotice();
}
function renderGroupNotice(){
  const root=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');if(!root)return;
  let panel=root.querySelector('#captureGroupStatus');
  if(!panel){panel=document.createElement('section');panel.id='captureGroupStatus';panel.className='notice';root.querySelector('header')?.insertAdjacentElement('afterend',panel);}
  const data=group().draft;
  panel.innerHTML=`<b>同一寶可夢多截圖群組</b><br>來源圖片：${data.source_refs?.length||0}；分析 revision：${data.analysis_ids?.length||0}；衝突：${data.conflicts?.length||0}<br><small>${(data.source_refs||[]).map(esc).join('、')||'尚無來源'}</small><div class="buttons"><button type="button" id="startNewCaptureGroup" class="secondary">下一隻寶可夢／建立新群組</button></div>${data.conflicts?.length?`<details><summary>欄位衝突，請以表單目前值人工確認</summary><pre>${esc(JSON.stringify(data.conflicts,null,2))}</pre></details>`:''}`;
  panel.querySelector('#startNewCaptureGroup').onclick=startNewGroup;
}

globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>{
  const next=normalizeRevision(event.detail),current=group().draft;
  if(current.species&&next.species&&current.species!==next.species){
    const previousSpecies=current.species;
    resetActiveGroup('species_identity_changed');
    globalThis.UpdateCenterLiveDebug?.record?.('multicapture_species_boundary',{previous_species:previousSpecies,next_species:next.species,group_id:activeGroupId});
  }
  const merged=mergeDraft(group().draft,next);
  groups.get(activeGroupId).draft=merged;
  setTimeout(applyMergedDraftToForm,0);
  globalThis.UpdateCenterLiveDebug?.record?.('multicapture_revision_merged',{group_id:activeGroupId,source_count:merged.source_refs.length,analysis_count:merged.analysis_ids.length,conflict_count:merged.conflicts.length,main_skill_level:merged.main_skill_level??null,species:merged.species||null,evolution_rehydration:true,legacy_partial_writer_disabled:true,lifecycle_isolated:true});
});

globalThis.addEventListener('pokemon-sleep:analysis-confirmation-terminal',event=>{
  resetActiveGroup(event.detail?.reason||'confirmation_terminal');
});

globalThis.UpdateCenterLiveDebug?.record?.('data_consistency_multicapture_ready',{version:VERSION,build:BUILD,patch_semantics:true,null_safe_numeric:true,observation_v2:true,evolution_rehydration:true,legacy_partial_writer_disabled:true,lifecycle_isolated:true});

export {VERSION,BUILD,normalizeRevision,mergeDraft,resetActiveGroup};
