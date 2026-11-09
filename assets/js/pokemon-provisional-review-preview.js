// RATE.2: read-only evidence-gated screenshot rating preview.
// Never infer missing OCR/AI facts, bypass identity review, or persist a rating.
import {scorePokemonProvisionalRating,POKEMON_PROVISIONAL_RATING_RULE_VERSION} from './pokemon-provisional-rating.js';

const clean=value=>String(value??'').normalize('NFKC').trim();
const present=value=>value!==null&&value!==undefined&&clean(value)!=='';
const esc=value=>clean(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const REQUIRED=['species','specialty','level','nature','subskills'];
const confidence=(map,key)=>{
  const entry=map?.['profile.'+key]??map?.[key];
  const value=typeof entry==='object'&&entry!==null?entry.confidence:entry;
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0&&n<=1?n:null;
};
const slotKey=rows=>(Array.isArray(rows)?rows:[]).map(row=>
  [Number(row?.unlock_level??row?.level),clean(row?.subskill_name??row?.ingredient_name??row?.name)])
  .sort((a,b)=>a[0]-b[0]).map(row=>row.join(':')).join('|');
const unique=items=>[...new Set(items)].sort();

/**
 * Pure observation-to-scorer adapter. A draft may be edited in the Review UI,
 * but a changed value is not silently promoted to verified image evidence.
 * Confidence must be explicitly attached to each rating-relevant source field.
 */
export function buildPokemonScreenshotRatingPreview({draft={},revision=null}={}){
  const raw=revision?.result?.analysis??revision?.result??{};
  const observation=Array.isArray(raw?.observations)?raw.observations[0]||null:null;
  const evidence=observation?.evidence||{};
  const profile=observation?.profile||{};
  const required=[...REQUIRED];
  if(clean(draft.specialty)==='食材')required.push('ingredients');
  if(clean(draft.specialty)==='技能')required.push('main_skill');
  const reasons=[],missing=[],confidenceRows=[];
  if(revision?.analysis_type!=='ai'||!observation)reasons.push('OBSERVATION_V2_REQUIRED');
  const refs=unique((Array.isArray(evidence.source_image_refs)?evidence.source_image_refs:[]).filter(present).map(clean));
  if(!refs.length)reasons.push('OBSERVATION_IMAGE_PROVENANCE_MISSING');
  // RATE.2: evidence belonging to image-A cannot certify an AI revision
  // whose canonical source_image_ref identifies image-B (or is absent).
  // This is read-only source provenance, not a grant of Apply authority.
  const revisionImageRef=typeof revision?.source_image_ref==='string'
    ?clean(revision.source_image_ref):'';
  if(!revisionImageRef||!refs.includes(revisionImageRef))
    reasons.push('REVISION_IMAGE_PROVENANCE_MISMATCH');
  if(Object.keys(evidence.field_conflicts||{}).length||(
    Array.isArray(draft.conflicts)&&draft.conflicts.length
  ))reasons.push('OBSERVATION_FIELD_CONFLICT');
  if(draft.identity_review_required||draft.identity_guard_warnings?.length)reasons.push('IDENTITY_REVIEW_REQUIRED');
  if(['species','specialty','level','nature','subskills','ingredients','main_skill'].some(
    key=>(draft.baseline_hydrated_fields||[]).includes(key)
  ))reasons.push('BASELINE_NOT_NEW_IMAGE_EVIDENCE');
  const unreadable=new Set(evidence.unreadable_fields||[]);
  for(const key of required){
    const value=confidence(evidence.field_confidence,key);
    confidenceRows.push({field:key,confidence:value,source:'OBSERVATION_V2_FIELD_CONFIDENCE'});
    if(value===null)missing.push('field_confidence_'+key);
    else if(value<0.75)reasons.push('LOW_CONFIDENCE_'+key);
    if(unreadable.has(key)||unreadable.has('profile.'+key))reasons.push('UNREADABLE_'+key);
  }
  for(const key of ['species','specialty','level','nature','main_skill']){
    if(!required.includes(key))continue;
    const original=profile[key];
    if(!present(original))missing.push('source_profile_'+key);
    else if(clean(original)!==clean(draft[key]))reasons.push('DRAFT_SOURCE_MISMATCH_'+key);
  }
  if(!Array.isArray(observation?.subskills)||!observation.subskills.length)missing.push('source_subskills');
  else if(slotKey(observation.subskills)!==slotKey(draft.subskills))reasons.push('DRAFT_SOURCE_MISMATCH_subskills');
  if(required.includes('ingredients')){
    if(!Array.isArray(observation?.ingredients)||!observation.ingredients.length)missing.push('source_ingredients');
    else if(slotKey(observation.ingredients)!==slotKey(draft.ingredients))reasons.push('DRAFT_SOURCE_MISMATCH_ingredients');
  }
  if((observation?.visual_evidence?.subskills||[]).some(row=>row?.merge_conflict===true))reasons.push('VISUAL_SUBSKILL_CONFLICT');
  if((observation?.audit_candidates||[]).some(row=>row?.confirmed_by_user!==true))reasons.push('UNCONFIRMED_AUDIT_CANDIDATE');

  const score=scorePokemonProvisionalRating({pokemon:{
    ...draft,current_species:draft.species,identity_review_required:!!draft.identity_review_required,
  },ingredients:draft.ingredients||[],subskills:draft.subskills||[],
    evidenceConflicts:Object.keys(evidence.field_conflicts||{})});
  missing.push(...score.missing_inputs);
  if(score.status!=='PROVISIONAL_HEURISTIC')reasons.push(...score.reason_codes);
  const eligible=!reasons.length&&!missing.length&&score.status==='PROVISIONAL_HEURISTIC';
  return {
    schema:'pokemon-screenshot-rating-review/1.0',rule_version:POKEMON_PROVISIONAL_RATING_RULE_VERSION,
    status:eligible?'PROVISIONAL_HEURISTIC':'REVIEW_REQUIRED',
    proposed_rating:eligible?score.proposed_rating:null,
    heuristic_score:eligible?score.heuristic_score:null,
    current_contribution:eligible?score.current_contribution:null,
    future_contribution:eligible?score.future_contribution:null,
    score_breakdown:eligible?score.score_breakdown:[],
    missing_inputs:unique(missing),reason_codes:unique(reasons),
    confidence_rows:confidenceRows,source_image_refs:refs,
    identity_resolution:'REQUIRED_BEFORE_APPLY',player_data_write:false,overwrite_allowed:false,
  };
}

export function renderPokemonScreenshotRatingPreviewHtml(result){
  const approved=result?.status==='PROVISIONAL_HEURISTIC';
  const grade=approved?esc(result.proposed_rating):'待覆核（不顯示等級）';
  const issues=[...(result?.missing_inputs||[]),...(result?.reason_codes||[])];
  const lines=(result?.score_breakdown||[]).map(row=>
    `<li>${esc(row.scope)} · ${esc(row.name||row.reason)}：${Number(row.delta)>0?'+':''}${esc(row.delta)}</li>`).join('');
  return `<section class="detail-section" data-rate2-read-only="true">
    <h3>15 階培養初評（唯讀／待人工覆核）</h3>
    <div class="notice ${approved?'success':'pending'}"><strong>${grade}</strong>
    · ${esc(result?.status||'REVIEW_REQUIRED')} · 規則 ${esc(result?.rule_version||'—')}<br>
    本平台啟發式，不是遊戲官方個體值、產率或資源 ROI；不會覆蓋舊評級或寫入玩家資料。</div>
    <div class="notice">圖片證據：${(result?.source_image_refs||[]).map(esc).join('、')||'未提供'}<br>
    欄位信心：${(result?.confidence_rows||[]).map(row=>`${esc(row.field)}=${row.confidence===null?'未提供':esc(row.confidence)}`).join('、')||'未提供'}<br>
    身分解析／寫入目標仍須另外確認。</div>
    ${approved?`<div class="notice">CURRENT 副技能貢獻：${esc(result.current_contribution)}；FUTURE 尚未解鎖：${esc(result.future_contribution)}。完整長期分數 ${esc(result.heuristic_score)} 僅供參考。</div><ul>${lines}</ul>`:''}
    ${issues.length?`<div class="notice pending">需覆核／缺項：${issues.map(esc).join('、')}</div>`:''}
  </section>`;
}
