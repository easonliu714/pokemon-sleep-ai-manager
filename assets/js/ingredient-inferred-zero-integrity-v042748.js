import {
  ingredientNamesFromUpdatePackage,
  applyIngredientAbsenceConfirmations,
} from './ingredient-inventory-integrity-contract.js';

export const INGREDIENT_INFERRED_ZERO_INTEGRITY_VERSION='ingredient-inferred-zero-integrity-2026-08-31-a';

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();

export function isScreenshotInferredZeroOperation(operation){
  if(operation?.entity!=='ingredient_inventory')return false;
  if(operation?.data?.quantity!==0)return false;
  if(operation?.evidence?.source_type!=='screenshot')return false;
  if(operation?.evidence?.confirmed_by_user===true)return false;
  return Number(operation?.evidence?.confidence)===0;
}

export function ingredientNamesWithDirectInventoryEvidence(payload){
  return [...new Set((Array.isArray(payload?.operations)?payload.operations:[])
    .filter(operation=>operation?.entity==='ingredient_inventory'&&!isScreenshotInferredZeroOperation(operation))
    .map(operation=>clean(operation?.key?.ingredient_name))
    .filter(Boolean))];
}

export function inferredZeroIngredientNames(payload){
  return [...new Set((Array.isArray(payload?.operations)?payload.operations:[])
    .filter(isScreenshotInferredZeroOperation)
    .map(operation=>clean(operation?.key?.ingredient_name))
    .filter(Boolean))];
}

export function applyIngredientAbsenceConfirmationsWithInferredZeroPromotion(payload,confirmations,{sourceImageRefs=[]}={}){
  const copy=clone(payload||{});
  const resolutionNames=new Set((Array.isArray(confirmations)?confirmations:[])
    .filter(item=>item?.confirmed_by_user===true)
    .map(item=>clean(item?.ingredient_name))
    .filter(Boolean));

  copy.operations=(Array.isArray(copy.operations)?copy.operations:[]).filter(operation=>{
    const name=clean(operation?.key?.ingredient_name);
    return !(resolutionNames.has(name)&&isScreenshotInferredZeroOperation(operation));
  });

  const promoted=applyIngredientAbsenceConfirmations(copy,confirmations,{sourceImageRefs});
  promoted.inventory_capture_reconciliation={
    ...(promoted.inventory_capture_reconciliation||{}),
    inferred_zero_integrity_version:INGREDIENT_INFERRED_ZERO_INTEGRITY_VERSION,
    inferred_zero_not_direct_observation:true,
    inferred_zero_requires_existing_integrity_resolution:true,
  };
  return promoted;
}

export function auditIngredientInferredZeroIntegrity(payload){
  return Object.freeze({
    version:INGREDIENT_INFERRED_ZERO_INTEGRITY_VERSION,
    all_operation_names:Object.freeze(ingredientNamesFromUpdatePackage(payload)),
    direct_observed_names:Object.freeze(ingredientNamesWithDirectInventoryEvidence(payload)),
    inferred_zero_names:Object.freeze(inferredZeroIngredientNames(payload)),
    inferred_zero_not_direct_observation:true,
  });
}
