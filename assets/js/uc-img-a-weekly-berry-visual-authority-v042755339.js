import {PROMPT_CATALOG} from './prompt-catalog.js';

// v0.4.27.55.3.3.9 UC.IMG-A
// Govern image-only weekly favorite-berry observations without promoting AI guesses
// into Shared/Public deterministic authority.

export const UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT = Object.freeze({
  version: 'v0.4.27.55.3.3.9',
  observation_type: 'favorite_berry_icon',
  statuses: Object.freeze(['OBSERVED', 'CANDIDATE', 'VERIFIED']),
  max_slots: 3,
  observed_authority: 'AI_VISUAL_OBSERVATION_ONLY',
  candidate_authority: 'AI_VISUAL_CANDIDATE_ONLY',
  verified_authority: 'CANONICAL_BERRY_ICON_AUTHORITY',
  unknown_is_absent: false,
  ai_is_rule_authority: false,
});

const clone = value => JSON.parse(JSON.stringify(value));
const isFiniteConfidence = value => value === null || value === undefined ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
const WEEKLY_BERRY_PROMPT_SENTINEL='UC.IMG-A .55.3.3.9 image-only berry contract:';

export function buildWeeklyBerryVisualPromptAddon(){
  return `${WEEKLY_BERRY_PROMPT_SENTINEL}\n- Weekly screenshot visual review is mandatory even when OCR text is sufficient.\n- Add root visual_observation_summary={favorite_berry_icon_count:<0..3>,complete:true}.\n- Add one root visual_observations item per visible favorite-berry icon with observation_type=favorite_berry_icon, slot=1..3, source_image_ref, status, confidence and authority.\n- If the icon is visible but its canonical name is not deterministically resolved, use status=OBSERVED or CANDIDATE, review_required=true and never write favorite_berry_1..3.\n- AI visual guesses are candidates only: authority=AI_VISUAL_CANDIDATE_ONLY. They are never Shared/Public rule authority.\n- VERIFIED is allowed only when an exact governed resolver supplies authority=CANONICAL_BERRY_ICON_AUTHORITY and canonical_berry_name.\n- UNKNOWN/unresolved does not mean no berry requirement and must not be converted to 0/null overwrite.\n- Text confidence is field-scoped: operation.evidence.field_confidence must carry confidence for observed weekly text fields; a single operation confidence must not claim the whole image is resolved.`;
}

export function installWeeklyBerryVisualPromptAddon(){
  const weekly=PROMPT_CATALOG?.weekly;
  if(!weekly || typeof weekly.prompt!=='string')throw new Error('PROMPT_CATALOG.weekly prompt authority is unavailable.');
  if(!weekly.prompt.includes(WEEKLY_BERRY_PROMPT_SENTINEL))weekly.prompt=`${weekly.prompt}\n\n${buildWeeklyBerryVisualPromptAddon()}`;
  return weekly.prompt;
}

installWeeklyBerryVisualPromptAddon();

export function stripWeeklyBerryVisualEnvelope(sourcePayload){
  const payload=clone(sourcePayload||{});
  delete payload.visual_observations;
  delete payload.visual_observation_summary;
  return payload;
}

function weeklyOperation(payload){
  return Array.isArray(payload?.operations)?payload.operations.find(op=>op?.entity==='weekly_context'):null;
}
function observedWeeklyTextFields(operation){
  return ['week_start','camp','dish_category','event_name'].filter(key=>operation?.data?.[key]!==undefined&&operation?.data?.[key]!==null);
}
function hasFieldConfidence(operation,fields){
  const fieldConfidence=operation?.evidence?.field_confidence;
  return Boolean(fieldConfidence&&typeof fieldConfidence==='object'&&!Array.isArray(fieldConfidence)&&fields.every(key=>isFiniteConfidence(fieldConfidence[key])&&fieldConfidence[key]!==null&&fieldConfidence[key]!==undefined));
}
function hasManualFieldConfirmation(operation,fields){
  const confirmed=new Set(Array.isArray(operation?.evidence?.user_confirmed_fields)?operation.evidence.user_confirmed_fields:[]);
  return fields.every(key=>confirmed.has(key));
}
function recomputeWeeklyOperationReviewRequired(payload){
  const operation=weeklyOperation(payload);
  if(!operation)return payload;
  const observations=Array.isArray(payload.visual_observations)?payload.visual_observations:[];
  const textFields=observedWeeklyTextFields(operation);
  const visualResolved=observations.every(item=>item?.status==='VERIFIED');
  const textResolved=!textFields.length||hasFieldConfidence(operation,textFields)||hasManualFieldConfirmation(operation,textFields);
  operation.review_required=!(visualResolved&&textResolved);
  return payload;
}

export function resolveWeeklyBerryVisualCandidate(sourcePayload,slot,canonicalBerryName,{confirmedAt=new Date().toISOString()}={}){
  const payload=clone(sourcePayload||{});
  const name=String(canonicalBerryName??'').trim();
  if(!Number.isInteger(slot)||slot<1||slot>3)throw new Error('weekly_berry_slot_invalid');
  if(!name)throw new Error('weekly_berry_canonical_name_required');
  const observations=Array.isArray(payload.visual_observations)?payload.visual_observations:[];
  const item=observations.find(row=>row?.slot===slot);
  if(!item)throw new Error(`weekly_berry_slot_${slot}_missing`);
  item.status='VERIFIED';
  item.authority=UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.verified_authority;
  item.canonical_berry_name=name;
  item.review_required=false;
  item.user_confirmation={method:'USER_CONFIRMED_CANONICAL_SELECTOR',confirmed_at:confirmedAt};
  const operation=weeklyOperation(payload);
  if(operation){
    operation.data={...(operation.data||{}),[`favorite_berry_${slot}`]:name};
  }
  return recomputeWeeklyOperationReviewRequired(payload);
}

export function confirmWeeklyObservedTextFields(sourcePayload,{confirmedAt=new Date().toISOString()}={}){
  const payload=clone(sourcePayload||{});
  const operation=weeklyOperation(payload);
  if(!operation)return payload;
  const fields=observedWeeklyTextFields(operation);
  operation.evidence={...(operation.evidence||{}),user_confirmed_fields:[...fields],user_confirmed_fields_at:confirmedAt};
  return recomputeWeeklyOperationReviewRequired(payload);
}

function weeklyEvidenceImageRefs(source){
  const operation=Array.isArray(source?.operations)?source.operations.find(op=>op?.entity==='weekly_context'):null;
  if(!operation)return [];
  const refs=[];
  if(operation.evidence?.source_image_ref)refs.push(operation.evidence.source_image_ref);
  if(Array.isArray(operation.evidence?.source_image_refs))refs.push(...operation.evidence.source_image_refs);
  return [...new Set(refs.filter(Boolean))];
}

export function evaluateWeeklyBerryVisualEnvelope(sourcePayload,{allowedImageRefs=[]}={}){
  const source=sourcePayload&&typeof sourcePayload==='object'?sourcePayload:{};
  const explicitAllowed=(allowedImageRefs||[]).filter(Boolean);
  const allowed=new Set(explicitAllowed.length?explicitAllowed:weeklyEvidenceImageRefs(source));
  const observations=Array.isArray(source.visual_observations)?source.visual_observations:[];
  const summary=source.visual_observation_summary&&typeof source.visual_observation_summary==='object'
    ?source.visual_observation_summary:null;
  const errors=[];
  const warnings=[];
  const review=[];
  const seenSlots=new Set();

  if(!summary || summary.complete!==true){
    review.push({kind:'weekly_berry_visual_surface_unreported',reason:'Weekly screenshot berry-icon surface must be explicitly reviewed; missing/unreported is not equivalent to no berry requirement.'});
  }

  const count=summary?.favorite_berry_icon_count;
  if(summary){
    if(!Number.isInteger(count)||count<0||count>UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.max_slots){
      errors.push('visual_observation_summary.favorite_berry_icon_count must be an integer from 0 to 3.');
    }else if(observations.length!==count){
      errors.push(`favorite_berry_icon_count=${count} but visual_observations contains ${observations.length} item(s).`);
    }
  }

  observations.forEach((item,index)=>{
    const label=`visual_observations[${index}]`;
    if(item?.observation_type!==UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.observation_type)errors.push(`${label}.observation_type must be favorite_berry_icon.`);
    if(!Number.isInteger(item?.slot)||item.slot<1||item.slot>3)errors.push(`${label}.slot must be 1, 2, or 3.`);
    else if(seenSlots.has(item.slot))errors.push(`${label}.slot duplicates slot ${item.slot}.`);
    else seenSlots.add(item.slot);
    if(!item?.source_image_ref)errors.push(`${label}.source_image_ref is required.`);
    else if(allowed.size&&!allowed.has(item.source_image_ref))errors.push(`${label}.source_image_ref is not assigned to the weekly scenario: ${item.source_image_ref}`);
    if(!isFiniteConfidence(item?.confidence))errors.push(`${label}.confidence must be null or a number from 0 to 1.`);
    if(!UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.statuses.includes(item?.status)){
      errors.push(`${label}.status must be OBSERVED, CANDIDATE, or VERIFIED.`);
      return;
    }
    if(item.status==='OBSERVED'){
      if(item.authority!==UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.observed_authority)errors.push(`${label}.authority must be AI_VISUAL_OBSERVATION_ONLY for OBSERVED.`);
      if(item.review_required!==true)errors.push(`${label}.review_required must be true while OBSERVED is unresolved.`);
      review.push({kind:'weekly_berry_visual_observation',slot:item.slot,status:item.status,source_image_ref:item.source_image_ref});
    }
    if(item.status==='CANDIDATE'){
      if(item.authority!==UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.candidate_authority)errors.push(`${label}.authority must be AI_VISUAL_CANDIDATE_ONLY for CANDIDATE.`);
      if(typeof item.candidate_name!=='string'||!item.candidate_name.trim())errors.push(`${label}.candidate_name is required for CANDIDATE.`);
      if(item.review_required!==true)errors.push(`${label}.review_required must be true for AI visual candidates.`);
      if(item.canonical_berry_name)errors.push(`${label} may not set canonical_berry_name before VERIFIED resolution.`);
      review.push({kind:'weekly_berry_visual_candidate',slot:item.slot,status:item.status,candidate_name:item.candidate_name||null,source_image_ref:item.source_image_ref});
    }
    if(item.status==='VERIFIED'){
      if(item.authority!==UC_IMG_A_WEEKLY_BERRY_VISUAL_CONTRACT.verified_authority)errors.push(`${label}.authority must be CANONICAL_BERRY_ICON_AUTHORITY for VERIFIED.`);
      if(typeof item.canonical_berry_name!=='string'||!item.canonical_berry_name.trim())errors.push(`${label}.canonical_berry_name is required for VERIFIED.`);
      if(item.review_required===true)warnings.push(`${label} is VERIFIED but still marked review_required=true.`);
    }
  });

  const weeklyOp=weeklyOperation(source);
  if(weeklyOp){
    const observedTextFields=observedWeeklyTextFields(weeklyOp);
    const fieldConfidence=weeklyOp.evidence?.field_confidence;
    const manuallyConfirmed=hasManualFieldConfirmation(weeklyOp,observedTextFields);
    if(observedTextFields.length&&(!fieldConfidence||typeof fieldConfidence!=='object'||Array.isArray(fieldConfidence))){
      if(manuallyConfirmed)warnings.push('Observed weekly text fields were confirmed by the owner; operation-level AI confidence was not promoted to field authority.');
      else review.push({kind:'weekly_field_confidence_missing',fields:observedTextFields,reason:'Operation-level confidence is too coarse; observed weekly text fields require field-scoped confidence or explicit owner confirmation.'});
    }else if(fieldConfidence){
      for(const key of observedTextFields){
        if((!isFiniteConfidence(fieldConfidence[key])||fieldConfidence[key]===null||fieldConfidence[key]===undefined)&&!manuallyConfirmed)errors.push(`operation.evidence.field_confidence.${key} must be a number from 0 to 1 or be explicitly confirmed by the owner.`);
      }
    }
  }

  const unresolvedCount=observations.filter(item=>item?.status!=='VERIFIED').length;
  const blockerSlots=[...new Set(review.filter(row=>row.kind==='weekly_berry_visual_observation'||row.kind==='weekly_berry_visual_candidate').map(row=>row.slot).filter(Number.isInteger))].sort((a,b)=>a-b);
  const dryRunReasons=[];
  if(blockerSlots.length)dryRunReasons.push('unresolved_visual_slots');
  if(review.some(row=>row.kind==='weekly_field_confidence_missing'))dryRunReasons.push('field_confidence_missing');
  if(review.some(row=>row.kind==='weekly_berry_visual_surface_unreported'))dryRunReasons.push('visual_surface_unreported');
  if(errors.length)dryRunReasons.push('validation_errors');
  const blockerCount=review.length+errors.length;

  return {
    ok:errors.length===0&&review.length===0,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    review,
    clean_payload:stripWeeklyBerryVisualEnvelope(source),
    summary:{
      visual_surface_complete:summary?.complete===true,
      favorite_berry_icon_count:Number.isInteger(count)?count:null,
      observation_count:observations.length,
      unresolved_count:unresolvedCount,
      verified_count:observations.length-unresolvedCount,
      blocker_count:blockerCount,
      blocker_slots:blockerSlots,
      dry_run_outcome:blockerCount>0?'HOLD':'PASS',
      dry_run_hold_reason:dryRunReasons.join(',')||null,
      ai_is_rule_authority:false,
      unknown_is_absent:false,
    },
  };
}
