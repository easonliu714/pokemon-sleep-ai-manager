import {BERRY_BY_TYPE} from './pokemon-master-options.js';
import {getPersistedPlayerEvolutionOverride,PLAYER_OVERRIDE,CUSTOM_REQUIREMENTS,CANNOT_EVOLVE} from './analysis-confirmation-evolution-authority.js';

export const PLAYER_PROFILE_CONSISTENCY_VERSION='v0.4.27.36-player-profile-consistency-review-only-2026-08-25-a';
export const DATE_INPUT_NORMALIZATION_VERSION='v0.4.27.23-localized-date-to-iso-2026-08-20-a';
export const TYPE_BERRY_CONSISTENCY_VERSION='v0.4.27.36-type-berry-review-only-2026-08-25-a';
export const DETAIL_EVOLUTION_OVERRIDE_PROJECTION_VERSION='v0.4.27.23-detail-player-override-projection-2026-08-20-a';

const text=value=>String(value??'').trim();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const meaningful=value=>value!==null&&value!==undefined&&text(value)!=='';
const trace=(event,detail={})=>{
  globalThis.UpdateCenterLiveDebug?.record?.(event,{version:PLAYER_PROFILE_CONSISTENCY_VERSION,...detail});
  globalThis.DebugTrace?.record?.('player_profile_consistency',event,{status:detail.status||'completed',details:{version:PLAYER_PROFILE_CONSISTENCY_VERSION,...detail}});
};

export function normalizeGameDateForInput(value){
  const raw=text(value);if(!raw)return '';
  let match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if(!match)match=raw.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
  if(!match)match=raw.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/);
  if(!match)return '';
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  if(year<2000||year>2100||month<1||month>12||day<1||day>31)return '';
  const probe=new Date(Date.UTC(year,month-1,day));
  if(probe.getUTCFullYear()!==year||probe.getUTCMonth()!==month-1||probe.getUTCDate()!==day)return '';
  return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function repairPlayerProfileDraft(source={}){
  const draft=clone(source)||{},corrections=[];
  const dateSource=text(draft.registered_at)||text(draft.obtained_at);
  const normalizedDate=normalizeGameDateForInput(dateSource);
  if(normalizedDate&&text(draft.registered_at)!==normalizedDate){
    corrections.push({field:'registered_at',status:'LOCALIZED_DATE_NORMALIZED',observed_value:dateSource,canonical_value:normalizedDate,authority:'HTML_DATE_INPUT_COMPATIBILITY',auto_rewrite:true});
    draft.registered_at=normalizedDate;
  }
  const type=text(draft.type),observedBerry=text(draft.favorite_berry),canonicalBerry=text(BERRY_BY_TYPE[type]);
  if(type&&observedBerry&&canonicalBerry&&observedBerry!==canonicalBerry){
    // v0.4.27.36: public type→berry relation is validation evidence only. It must
    // never mutate a player observation because a stale/wrong type would otherwise
    // manufacture a plausible but incorrect berry and hide the upstream conflict.
    corrections.push({field:'favorite_berry',status:'REVIEW_REQUIRED_TYPE_BERRY_MISMATCH',observed_value:observedBerry,canonical_value:canonicalBerry,type,authority:'PUBLIC_BERRY_BY_TYPE',evidence_role:'VALIDATION_NOT_IMAGE_EVIDENCE',auto_rewrite:false});
  }
  return Object.freeze({draft,corrections:Object.freeze(corrections)});
}

function activeDraftFromConsistency(){
  const state=globalThis.PokemonSleepMultiCaptureConsistency?.getState?.()||null;
  const active=(state?.groups||[]).find(row=>row.id===state.active_group_id)||null;
  return active?{group_id:active.id,draft:clone(active.draft||{}),revision:clone(active.latest_revision||null)}:null;
}
function visibleConfirmation(){return document.querySelector?.('#analysisConfirmationWorkbench .analysis-confirmation')||null;}
function ensureCorrectionNotice(form){
  let notice=form.querySelector('#playerProfileConsistencyNoticeV042723');
  if(notice)return notice;
  notice=document.createElement('div');notice.id='playerProfileConsistencyNoticeV042723';notice.className='notice';notice.dataset.playerProfileConsistencyVersion=PLAYER_PROFILE_CONSISTENCY_VERSION;
  const nav=form.querySelector('.analysis-review-navigation');
  if(nav)nav.insertAdjacentElement('afterend',notice);else form.querySelector('header')?.insertAdjacentElement('afterend',notice);
  return notice;
}
function renderCorrectionNotice(form,corrections=[]){
  const notice=ensureCorrectionNotice(form);
  if(!notice)return;
  if(!corrections.length){notice.remove();return;}
  const hasReview=corrections.some(row=>String(row.status||'').startsWith('REVIEW_REQUIRED'));
  notice.className=`notice ${hasReview?'pending':'success'}`;
  const lines=corrections.map(row=>{
    if(row.field==='registered_at')return `登錄日期格式正規化：${esc(row.observed_value)} → ${esc(row.canonical_value)}`;
    if(row.field==='favorite_berry')return `屬性／樹果需要人工覆核：目前為 ${esc(row.type)}屬性／${esc(row.observed_value)}；公版關係參考值為 ${esc(row.canonical_value)}。平台不會自動改寫。`;
    return `${esc(row.field)} 已正規化`;
  });
  notice.innerHTML=`<strong>${hasReview?'平台一致性檢查：需要人工覆核':'平台 deterministic 一致性校正'}</strong><br>${lines.join('<br>')}<br><small>${hasReview?'公版關係只用於偵測矛盾，不會把任何值轉成圖片 Evidence 或自動寫入玩家資料。':'AI 原始 JSON 保留不變；僅執行格式正規化。'}</small>`;
}

export function reconcileVisibleConfirmation(detail=null){
  if(typeof document==='undefined')return {status:'NO_DOCUMENT',corrections:[]};
  const form=visibleConfirmation();if(!form)return {status:'NO_VISIBLE_CONFIRMATION',corrections:[]};
  const active=activeDraftFromConsistency();
  const incomingGroup=text(detail?.group_id),activeGroup=text(active?.group_id),visibleGroup=text(form.dataset?.v042718GroupId);
  if(incomingGroup&&(incomingGroup!==activeGroup||incomingGroup!==visibleGroup)){
    trace('v042736_profile_consistency_noncurrent_rejected',{status:'blocked',incoming_group_id:incomingGroup,active_group_id:activeGroup||null,visible_group_id:visibleGroup||null,dom_write_count:0});
    return {status:'REJECTED_NONCURRENT',corrections:[]};
  }
  const source=detail?.draft||active?.draft||{};
  const result=repairPlayerProfileDraft(source);
  const dateInput=form.querySelector('[data-field="registered_at"]');
  const dateCorrection=result.corrections.find(row=>row.field==='registered_at'&&row.auto_rewrite!==false);
  if(dateCorrection&&dateInput)dateInput.value=dateCorrection.canonical_value;
  else if(dateInput&&!dateInput.value){
    const attrValue=dateInput.getAttribute('value')||'';
    const normalized=normalizeGameDateForInput(attrValue);
    if(normalized)dateInput.value=normalized;
  }
  // Intentionally no favorite_berry DOM assignment here. Type/berry mismatch is
  // review-only in v0.4.27.36 and must preserve the exact-group observation.
  renderCorrectionNotice(form,result.corrections);
  if(result.corrections.length)trace('v042736_confirmation_consistency_checked',{status:result.corrections.some(row=>String(row.status).startsWith('REVIEW_REQUIRED'))?'review_required':'completed',group_id:detail?.group_id||active?.group_id||null,fields:result.corrections.map(row=>row.field),type_berry_auto_rewrite:false,raw_provider_json_mutated:false});
  return {status:result.corrections.some(row=>String(row.status).startsWith('REVIEW_REQUIRED'))?'REVIEW_REQUIRED':'RECONCILED',corrections:result.corrections,draft:result.draft};
}

function detailSection(title){return [...document.querySelectorAll?.('#detailBody .detail-section')||[]].find(section=>text(section.querySelector('h3')?.textContent)===title)||null;}
function requirementCard(label,value){return `<div class="detail-card"><b>${esc(label)}</b>${meaningful(value)?esc(value):'<span class="unknown">不需要／未設定</span>'}</div>`;}
function overrideSignature(override){return JSON.stringify({mode:override?.evolution_authority_mode||null,status:override?.evolution_override_status||null,target:override?.evolution_target_override||null,reason:override?.evolution_override_reason||null,level:override?.evolution_level_required??null,sleep:override?.evolution_sleep_hours_required??null,candy:override?.evolution_candy_required??null,item:override?.evolution_item_required||null,other:override?.evolution_other_requirement||null});}
function renderEvolutionOverrideSection(section,override){
  const signature=overrideSignature(override);
  if(section.dataset.v042723OverrideSignature===signature)return false;
  section.dataset.v042723OverrideSignature=signature;
  section.dataset.v042723EvolutionAuthority=override.evolution_override_status||PLAYER_OVERRIDE;
  if(override.evolution_override_status===CANNOT_EVOLVE){
    const reason=meaningful(override.evolution_override_reason)?`<br>原因：${esc(override.evolution_override_reason)}`:'';
    section.innerHTML=`<h3>進化條件</h3><div class="notice success"><strong>玩家個體進化覆寫</strong><br>此特殊個體無法進化。${reason}<br><small>公版進化 Master 僅供物種參考，不是此個體的有效進化條件。</small></div>`;
    return true;
  }
  const target=meaningful(override.evolution_target_override)?`<br>人工進化目標：${esc(override.evolution_target_override)}`:'';
  section.innerHTML=`<h3>進化條件</h3><div class="notice success"><strong>玩家個體進化覆寫</strong><br>此個體使用自訂進化條件。${target}<br><small>公版進化 Master 僅供參考，不覆寫此個體。</small></div><div class="detail-grid">${requirementCard('等級門檻',override.evolution_level_required==null?null:`Lv${override.evolution_level_required}`)}${requirementCard('進化所需一起睡覺的時間',override.evolution_sleep_hours_required==null?null:`${override.evolution_sleep_hours_required} 小時`)}${requirementCard('糖果需求',override.evolution_candy_required==null?null:`×${override.evolution_candy_required}`)}${requirementCard('進化道具',override.evolution_item_required)}${requirementCard('其他條件',override.evolution_other_requirement)}</div>`;
  return true;
}
function reconcilePublicReferenceNotice(){
  const section=detailSection('公版引用'),notice=section?.querySelector('.notice');if(!notice||notice.dataset.v042723EvolutionOverrideNotice==='true')return;
  const original=text(notice.textContent);
  const replacement=original.replace('性格影響、主技能顯示／說明與進化條件為公版 Projection；','性格影響、主技能顯示／說明為公版 Projection；此個體的進化條件由玩家覆寫 Authority 決定；');
  notice.textContent=replacement===original?`此個體的進化條件由玩家覆寫 Authority 決定；公版進化 Master 僅供參考。 ${original}`:replacement;
  notice.dataset.v042723EvolutionOverrideNotice='true';
}

export function reconcilePokemonDetail(pokemonId){
  if(typeof document==='undefined'||!text(pokemonId))return {status:'NO_TARGET'};
  let override=null;try{override=getPersistedPlayerEvolutionOverride(text(pokemonId));}catch{return {status:'OVERRIDE_LOOKUP_DEFERRED'};}
  if(!override||override.evolution_authority_mode!==PLAYER_OVERRIDE)return {status:'PUBLIC_MASTER_EFFECTIVE'};
  const section=detailSection('進化條件');if(!section)return {status:'DETAIL_NOT_RENDERED'};
  const changed=renderEvolutionOverrideSection(section,override);reconcilePublicReferenceNotice();
  if(changed)trace('v042723_detail_player_evolution_override_projected',{pokemon_id_present:true,override_status:override.evolution_override_status,public_route_effective:false});
  return {status:'PLAYER_OVERRIDE_PROJECTED',override_status:override.evolution_override_status,changed};
}

let currentDetailPokemonId=null,detailObserver=null;
function scheduleConfirmation(detail){queueMicrotask(()=>reconcileVisibleConfirmation(detail));}
function scheduleDetail(){const id=currentDetailPokemonId;if(id)setTimeout(()=>reconcilePokemonDetail(id),0);}
function install(){
  if(typeof globalThis.addEventListener==='function'){
    globalThis.addEventListener('pokemon-sleep:analysis-confirmation-group-selected',event=>scheduleConfirmation(event.detail||null));
    globalThis.addEventListener('pokemon-sleep:analysis-confirmation-merged',event=>scheduleConfirmation(event.detail||null));
  }
  if(typeof document!=='undefined'){
    document.addEventListener('click',event=>{
      const row=event.target instanceof Element?event.target.closest('.pokemon-row[data-pokemon-id]'):null;
      if(row){currentDetailPokemonId=text(row.dataset.pokemonId);scheduleDetail();}
    },true);
    const body=document.getElementById('detailBody');
    if(body&&typeof MutationObserver!=='undefined'){
      detailObserver=new MutationObserver(()=>scheduleDetail());
      detailObserver.observe(body,{childList:true,subtree:true});
    }
  }
  trace('v042736_player_profile_consistency_ready',{date_normalization:true,type_berry_conflict_review_only:true,type_berry_auto_rewrite:false,detail_player_override_projection:true,raw_provider_json_mutated:false,missing_berry_public_fill:false,exact_visible_group_gate:true});
}

install();

globalThis.PokemonSleepPlayerProfileConsistencyV042723=Object.freeze({
  version:PLAYER_PROFILE_CONSISTENCY_VERSION,
  date_normalization_version:DATE_INPUT_NORMALIZATION_VERSION,
  type_berry_consistency_version:TYPE_BERRY_CONSISTENCY_VERSION,
  detail_evolution_override_projection_version:DETAIL_EVOLUTION_OVERRIDE_PROJECTION_VERSION,
  normalizeGameDateForInput,
  repairPlayerProfileDraft,
  reconcileVisibleConfirmation,
  reconcilePokemonDetail,
  getCurrentDetailPokemonId:()=>currentDetailPokemonId,
});
