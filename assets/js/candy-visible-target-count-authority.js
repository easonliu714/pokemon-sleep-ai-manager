import {
  compileCandyQuantityGovernedRecognitionToUpdatePackage,
  validateCandyQuantityGovernedRecognition,
} from './candy-quantity-confirmation-authority.js';
import {isPublicMasterRecognitionPayload} from './public-master-recognition.js';

export const CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION='candy-visible-target-count-confirmation-authority-2026-09-02-a';
export const CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_ACTION='USER_CONFIRMED_VISIBLE_TARGET_COUNT';
export const CANDY_VISIBLE_TARGET_COUNT_MISMATCH_REASON='PROVIDER_VISIBLE_TARGET_COUNT_MISMATCH';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').trim();
const nonNegativeInteger=value=>Number.isInteger(value)&&value>=0;

export function getCandyVisibleTargetCountState(payload){
  const observations=Array.isArray(payload?.observations)?payload.observations:[];
  const providerCount=payload?.visible_target_count;
  const observationCount=observations.length;
  const resolution=payload?.visible_target_count_resolution||null;
  const resolutionStructurallyValid=Boolean(
    resolution
    &&resolution.action===CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_ACTION
    &&resolution.authority===CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION
    &&nonNegativeInteger(resolution.provider_visible_target_count)
    &&resolution.provider_visible_target_count===providerCount
    &&nonNegativeInteger(resolution.observations_length_at_confirmation)
    &&resolution.observations_length_at_confirmation===observationCount
    &&nonNegativeInteger(resolution.confirmed_visible_target_count)
    &&clean(resolution.confirmed_at)
  );
  const userConfirmedMatchesObservations=Boolean(
    resolutionStructurallyValid
    &&resolution.confirmed_visible_target_count===observationCount
  );
  const providerCountValid=nonNegativeInteger(providerCount);
  const providerMatchesObservations=providerCountValid&&providerCount===observationCount;
  const mismatch=providerCountValid&&!providerMatchesObservations;
  return {
    authority_version:CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION,
    action:CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_ACTION,
    provider_visible_target_count:providerCountValid?providerCount:null,
    observations_length:observationCount,
    delta:providerCountValid?providerCount-observationCount:null,
    provider_matches_observations:providerMatchesObservations,
    mismatch,
    resolution:resolution?clone(resolution):null,
    resolution_structurally_valid:resolutionStructurallyValid,
    user_confirmed_visible_target_count:resolutionStructurallyValid?resolution.confirmed_visible_target_count:null,
    user_confirmed_matches_observations:userConfirmedMatchesObservations,
    gate_cleared:providerMatchesObservations||userConfirmedMatchesObservations,
    gate_status:providerMatchesObservations?'PROVIDER_MATCH':userConfirmedMatchesObservations?'USER_CONFIRMED_MATCH':'HOLD',
    reason:mismatch&&!userConfirmedMatchesObservations?CANDY_VISIBLE_TARGET_COUNT_MISMATCH_REASON:null,
  };
}

export function applyCandyVisibleTargetCountResolution(payload,input='candies',confirmedCount,{confirmedAt=new Date().toISOString()}={}){
  if(input!=='candies'&&input!=='candy_inventory_update')throw new Error('Visible target count 確認只允許 candy_inventory_update');
  const copy=clone(payload||{});
  if(!isPublicMasterRecognitionPayload(copy))throw new Error('目前資料不是 Public Master Recognition payload');
  if(!nonNegativeInteger(copy.visible_target_count))throw new Error('Provider visible_target_count 必須是 0 以上整數');
  if(!Array.isArray(copy.observations))throw new Error('Recognition observations 必須是陣列');
  if(!nonNegativeInteger(confirmedCount))throw new Error('人工確認的畫面項目數必須是 0 以上整數');
  copy.visible_target_count_resolution={
    action:CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_ACTION,
    provider_visible_target_count:copy.visible_target_count,
    confirmed_visible_target_count:confirmedCount,
    observations_length_at_confirmation:copy.observations.length,
    confirmed_at:confirmedAt,
    authority:CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION,
    semantics:'USER_VERIFIES_ACTUAL_VISIBLE_TARGET_COUNT_AGAINST_ORIGINAL_GAME_SCREENSHOT',
  };
  return copy;
}

export function buildCandyVisibleTargetCountBaseContractPayload(payload){
  const copy=clone(payload||{});
  const state=getCandyVisibleTargetCountState(copy);
  if(state.user_confirmed_matches_observations){
    // This clone exists only for the historical generic validator. The Working/Resolved
    // payload and immutable Gemini Raw keep the provider value for audit evidence.
    copy.visible_target_count=state.observations_length;
  }
  return copy;
}

export function validateCandyVisibleTargetCountGovernedRecognition(payload,input='candies',{allowedImageRefs=[]}={}){
  const state=getCandyVisibleTargetCountState(payload);
  const basePayload=buildCandyVisibleTargetCountBaseContractPayload(payload);
  const governed=validateCandyQuantityGovernedRecognition(basePayload,input,{allowedImageRefs});
  const errors=[...(governed.errors||[])];
  if(state.mismatch&&!state.user_confirmed_matches_observations&&!errors.some(value=>String(value).includes('visible_target_count='))){
    errors.push(`visible_target_count=${state.provider_visible_target_count} 與 observations.length=${state.observations_length} 不一致；需人工核對原始畫面項目數，不得靜默正規化`);
  }
  return {
    ...governed,
    ok:errors.length===0&&(governed.unresolved||[]).length===0,
    errors:[...new Set(errors)],
    candy_visible_target_count:state,
  };
}

export function compileCandyVisibleTargetCountGovernedRecognitionToUpdatePackage(payload,input='candies',{allowedImageRefs=[]}={}){
  const state=getCandyVisibleTargetCountState(payload);
  const basePayload=buildCandyVisibleTargetCountBaseContractPayload(payload);
  const compiled=compileCandyQuantityGovernedRecognitionToUpdatePackage(basePayload,input,{allowedImageRefs});
  const governed=validateCandyVisibleTargetCountGovernedRecognition(payload,input,{allowedImageRefs});
  return {
    ...compiled,
    ok:governed.ok,
    errors:[...(governed.errors||[])],
    warnings:[...(governed.warnings||[])],
    unresolved:[...(governed.unresolved||[])],
    summary:{
      ...(compiled.summary||{}),
      provider_visible_target_count:state.provider_visible_target_count,
      observations_length:state.observations_length,
      visible_target_count_delta:state.delta,
      visible_target_count_gate_status:state.gate_status,
      user_confirmed_visible_target_count:state.user_confirmed_visible_target_count,
      visible_target_count_confirmation_authority:CANDY_VISIBLE_TARGET_COUNT_CONFIRMATION_AUTHORITY_VERSION,
    },
    candy_visible_target_count:state,
  };
}
