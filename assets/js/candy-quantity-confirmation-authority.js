import {
  applyPublicMasterRecognitionResolution as applyBaseResolution,
  buildPublicMasterCatalogSnapshot,
  buildPublicMasterRecognitionPrompt as buildBasePrompt,
  compilePublicMasterRecognitionToUpdatePackage as compileBaseRecognition,
  getPublicMasterRecognitionDefinition,
  isPublicMasterRecognitionPayload,
  supportsPublicMasterRecognition,
  validatePublicMasterRecognitionPayload as validateBaseRecognition,
} from './public-master-recognition.js';

export const CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION='candy-quantity-confirmation-authority-2026-09-01-b';
export const CANDY_QUANTITY_CONFIRMATION_ACTION='USER_CONFIRMED_CANDY_QUANTITY';
export const CANDY_QUANTITY_PENDING_REASON='CANDY_QUANTITY_REQUIRES_USER_CONFIRMATION';
export const CANDY_PUBLIC_MASTER_GAP_ACTION='PUBLIC_MASTER_GAP_CONFIRMED';
export const CANDY_IDENTITY_MISMATCH_REASON='CANDY_IDENTITY_REQUIRES_EXACT_OR_USER_CONFIRMATION';

export const CANDY_QUANTITY_CONFIRMATION_POLICY=Object.freeze({
  screenshot_quantity_is_candidate_only:true,
  identity_confirmation_is_quantity_confirmation:false,
  explicit_user_confirmation_required_before_write:true,
  zero_is_valid_when_explicitly_confirmed:true,
  missing_or_null_is_no_update:true,
  external_game_changes_auto_sync_guaranteed:false,
  professor_observed_delta_semantics_changed:false,
  player_quantity_write_authority:'USER_EXPLICIT_CONFIRMATION_ONLY',
  ai_identity_exact_display_match_required:true,
  public_master_gap_confirmation_is_terminal_review:true,
  public_master_gap_player_write:false,
});

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').trim();
const normalizeCandyName=value=>clean(value).normalize('NFKC').replace(/\s+/g,'');
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const nonNegativeInteger=value=>Number.isInteger(value)&&value>=0;

function isCandyInput(input){
  const def=getPublicMasterRecognitionDefinition(input);
  return def?.scenario_key==='candies'||def?.scenario==='candy_inventory_update';
}

function identityResolution(observation){
  const resolution=observation?.user_resolution;
  if(resolution?.action==='USER_CONFIRMED_MATCH')return resolution;
  if(resolution?.identity_resolution?.action==='USER_CONFIRMED_MATCH')return resolution.identity_resolution;
  return null;
}

export function isCandyIdentityExplicitlyConfirmed(observation){
  return Boolean(identityResolution(observation));
}

export function isCandyIdentityExactMatch(observation){
  if(observation?.status!=='MATCHED')return false;
  const observed=normalizeCandyName(observation?.observed_text);
  const canonical=normalizeCandyName(observation?.canonical_name);
  return Boolean(observed&&canonical&&observed===canonical);
}

export function isCandyIdentityAccepted(observation){
  return Boolean(observation?.status==='MATCHED'&&(isCandyIdentityExactMatch(observation)||isCandyIdentityExplicitlyConfirmed(observation)));
}

export function isCandyPublicMasterGapConfirmed(observation){
  return Boolean(observation?.user_resolution?.action===CANDY_PUBLIC_MASTER_GAP_ACTION);
}

export function isCandyQuantityExplicitlyConfirmed(observation){
  const quantity=observation?.observed_data?.quantity;
  return Boolean(
    isCandyIdentityAccepted(observation)
    && nonNegativeInteger(quantity)
    && observation?.user_resolution?.action===CANDY_QUANTITY_CONFIRMATION_ACTION
    && observation.user_resolution.confirmed_quantity===quantity
    && clean(observation.user_resolution.confirmed_at)
  );
}

function identityMismatchReview(observation,index){
  return {
    observation_id:observation?.observation_id||`observation-${index+1}`,
    status:'REVIEW_REQUIRED',
    observed_text:observation?.observed_text||'',
    observed_data:clone(observation?.observed_data||{}),
    canonical_key:clone(observation?.canonical_key||null),
    canonical_name:observation?.canonical_name||null,
    source_image_ref:observation?.source_image_ref||null,
    confidence:observation?.confidence,
    candidate_names:observation?.canonical_name?[observation.canonical_name]:[],
    user_resolution:clone(observation?.user_resolution||null),
    review_kind:'candy_identity_confirmation',
    reason:CANDY_IDENTITY_MISMATCH_REASON,
  };
}

function pendingCandyIdentityReviews(payload){
  if(!Array.isArray(payload?.observations))return [];
  return payload.observations.flatMap((observation,index)=>{
    if(observation?.status!=='MATCHED')return [];
    if(isCandyIdentityAccepted(observation))return [];
    return [identityMismatchReview(observation,index)];
  });
}

function quantityPendingReview(observation,index){
  return {
    observation_id:observation?.observation_id||`observation-${index+1}`,
    status:'REVIEW_REQUIRED',
    observed_text:observation?.observed_text||'',
    observed_data:clone(observation?.observed_data||{}),
    canonical_key:clone(observation?.canonical_key||null),
    canonical_name:observation?.canonical_name||null,
    source_image_ref:observation?.source_image_ref||null,
    confidence:observation?.confidence,
    candidate_names:[],
    user_resolution:clone(observation?.user_resolution||null),
    review_kind:'candy_quantity_confirmation',
    reason:CANDY_QUANTITY_PENDING_REASON,
  };
}

function pendingCandyQuantityReviews(payload){
  if(!Array.isArray(payload?.observations))return [];
  return payload.observations.flatMap((observation,index)=>{
    if(!isCandyIdentityAccepted(observation))return [];
    if(!hasOwn(observation?.observed_data,'quantity')||!nonNegativeInteger(observation.observed_data.quantity))return [];
    if(isCandyQuantityExplicitlyConfirmed(observation))return [];
    return [quantityPendingReview(observation,index)];
  });
}

function uniqueUnresolved(items){
  const byId=new Map();
  for(const item of items){
    const key=item?.observation_id||JSON.stringify(item);
    if(!byId.has(key))byId.set(key,item);
  }
  return [...byId.values()];
}

export function validateCandyQuantityGovernedRecognition(payload,input='candies',{allowedImageRefs=[]}={}){
  const base=validateBaseRecognition(payload,input,{allowedImageRefs});
  if(!isCandyInput(input))return base;
  const observations=Array.isArray(payload?.observations)?payload.observations:[];
  const gapConfirmedCount=observations.filter(isCandyPublicMasterGapConfirmed).length;
  const baseUnresolved=(base.unresolved||[]).filter(item=>item?.user_resolution?.action!==CANDY_PUBLIC_MASTER_GAP_ACTION);
  const identityPending=pendingCandyIdentityReviews(payload);
  const quantityPending=pendingCandyQuantityReviews(payload);
  const unresolved=uniqueUnresolved([...baseUnresolved,...identityPending,...quantityPending]);
  const warnings=[...(base.warnings||[])];
  if(gapConfirmedCount){
    warnings.push(`已確認 ${gapConfirmedCount} 筆 Public Master gap；保留辨識 evidence，不建立玩家糖果寫入。`);
  }
  return {
    ...base,
    ok:(base.errors||[]).length===0&&unresolved.length===0,
    warnings:[...new Set(warnings)],
    unresolved,
    candy_quantity_confirmation:{
      authority_version:CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
      pending_count:quantityPending.length,
      confirmed_count:observations.filter(isCandyQuantityExplicitlyConfirmed).length,
      identity_pending_count:identityPending.length,
      public_master_gap_confirmed_count:gapConfirmedCount,
      screenshot_quantity_is_candidate_only:true,
      ai_identity_exact_display_match_required:true,
    },
  };
}

export function compileCandyQuantityGovernedRecognitionToUpdatePackage(payload,input='candies',{allowedImageRefs=[]}={}){
  const base=compileBaseRecognition(payload,input,{allowedImageRefs});
  if(!isCandyInput(input))return base;
  const governed=validateCandyQuantityGovernedRecognition(payload,input,{allowedImageRefs});
  const unresolvedIds=new Set((governed.unresolved||[]).map(item=>item.observation_id));
  const observations=Array.isArray(payload?.observations)?payload.observations:[];
  const operations=(base.update_package?.operations||[]).flatMap(operation=>{
    const match=String(operation?.operation_id||'').match(/^REC-(\d+)$/);
    const index=match?Number(match[1])-1:-1;
    const observation=index>=0?observations[index]:null;
    if(!observation||unresolvedIds.has(observation.observation_id)||!isCandyQuantityExplicitlyConfirmed(observation))return [];
    const candyId=clean(operation?.key?.candy_id);
    if(!candyId)return [];
    return [{
      ...operation,
      // candy_name is Recognition/display evidence, not a candy_inventory storage column.
      // Canonicalize the write key to the physical table PK before importer Dry-Run/Apply.
      key:{candy_id:candyId},
      evidence:{
        ...(operation.evidence||{}),
        quantity_candidate_source:'OCR_SCREENSHOT_HINT',
        quantity_confirmation_authority:CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
        quantity_confirmation_action:CANDY_QUANTITY_CONFIRMATION_ACTION,
        quantity_confirmed_by_user:true,
        confirmed_quantity:observation.user_resolution.confirmed_quantity,
        quantity_confirmed_at:observation.user_resolution.confirmed_at,
        candy_identity_exact_display_match:isCandyIdentityExactMatch(observation),
        candy_identity_user_confirmed:isCandyIdentityExplicitlyConfirmed(observation),
        external_game_changes_auto_sync_guaranteed:false,
      },
      review_required:false,
    }];
  });
  return {
    ...base,
    ok:governed.ok,
    update_package:{...(base.update_package||{}),operations},
    errors:[...(governed.errors||[])],
    warnings:[...(governed.warnings||[])],
    unresolved:[...(governed.unresolved||[])],
    summary:{
      ...(base.summary||{}),
      matched_count:operations.length,
      unresolved_count:governed.unresolved.length,
      candy_quantity_confirmation_authority:CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
      candy_quantity_pending_count:governed.candy_quantity_confirmation?.pending_count||0,
      candy_quantity_confirmed_count:governed.candy_quantity_confirmation?.confirmed_count||0,
      candy_identity_pending_count:governed.candy_quantity_confirmation?.identity_pending_count||0,
      candy_public_master_gap_confirmed_count:governed.candy_quantity_confirmation?.public_master_gap_confirmed_count||0,
    },
  };
}

export function confirmCandyScreenshotQuantity(payload,input,observationId,{confirmedAt=new Date().toISOString()}={}){
  if(!isCandyInput(input))throw new Error('此確認動作只允許 candy_inventory_update');
  const copy=clone(payload||{});
  if(!isPublicMasterRecognitionPayload(copy))throw new Error('目前資料不是 Public Master Recognition payload');
  const observation=(copy.observations||[]).find(item=>item?.observation_id===observationId);
  if(!observation)throw new Error(`找不到 Recognition observation：${observationId}`);
  if(observation.status!=='MATCHED')throw new Error('必須先完成糖果 identity MATCHED，才可確認數量');
  if(!observation.canonical_key||!clean(observation.canonical_name))throw new Error('缺少已解析的公版糖果 identity');
  if(!isCandyIdentityAccepted(observation))throw new Error('AI 辨識文字與 canonical 糖果名稱不一致；請先人工確認正確糖果 identity');
  const quantity=observation?.observed_data?.quantity;
  if(!nonNegativeInteger(quantity))throw new Error('糖果候選數量必須是 0 以上整數');
  const prior=clone(observation.user_resolution||null);
  observation.user_resolution={
    action:CANDY_QUANTITY_CONFIRMATION_ACTION,
    confirmed_at:confirmedAt,
    confirmed_quantity:quantity,
    canonical_name:observation.canonical_name,
    identity_resolution:prior?.action==='USER_CONFIRMED_MATCH'?prior:null,
    authority:CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
    semantics:'SCREENSHOT_QUANTITY_IS_HINT_USER_CONFIRMS_CURRENT_IN_GAME_INVENTORY',
  };
  return copy;
}

export function applyCandyGovernedRecognitionResolution(payload,input,observationId,action,displayName=null){
  if(action==='CONFIRM_QUANTITY')return confirmCandyScreenshotQuantity(payload,input,observationId);
  return applyBaseResolution(payload,input,observationId,action,displayName);
}

export function buildCandyQuantityGovernedRecognitionPrompt(input,{sessionId=null,coverage='PARTIAL',imageMap=[]}={}){
  const base=buildBasePrompt(input,{sessionId,coverage,imageMap});
  if(!isCandyInput(input))return base;
  return `${base}\n\nP0-B5 糖果數量治理：\n- 你從截圖讀到的 observed_data.quantity 只是一個 OCR／視覺辨識候選值，不是玩家庫存寫入 Authority。\n- 糖果 identity 的 observed_text 必須與你選擇的 canonical candy_name 逐字一致（允許 Unicode/空白正規化）；進化家族相近、圖示相似或同家族都不能把不同糖果名稱標成 MATCHED。若文字與候選名稱不同，必須輸出 AMBIGUOUS 或 UNMATCHED，交由使用者確認。\n- 即使 identity 能 MATCHED，也不得聲稱 quantity 已由使用者確認；平台會在 AI 回傳後要求使用者逐筆確認目前遊戲內糖果庫存數量。\n- 看不到數量時省略，不得補 0；0 只有在畫面確實可辨識為 0 時才可作候選，且仍需使用者確認。\n- 不得依上一次平台庫存、進化、博士傳送或任何遊戲規則推算目前糖果數量。\n- 遊戲外部變動不保證自動同步；平台只更新使用者明確確認的本次候選。`;
}

export {
  buildPublicMasterCatalogSnapshot,
  isPublicMasterRecognitionPayload,
  supportsPublicMasterRecognition,
};