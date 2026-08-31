import assert from 'node:assert/strict';
import {
  buildIngredientAbsenceCandidates,
  validateIngredientAbsenceConfirmationPackage,
} from '../assets/js/ingredient-inventory-integrity-contract.js';
import {
  isScreenshotInferredZeroOperation,
  ingredientNamesWithDirectInventoryEvidence,
  inferredZeroIngredientNames,
  applyIngredientAbsenceConfirmationsWithInferredZeroPromotion,
  auditIngredientInferredZeroIntegrity,
} from '../assets/js/ingredient-inferred-zero-integrity-v042748.js';

const inferred={
  operation_id:'REC-018',entity:'ingredient_inventory',action:'upsert',
  key:{ingredient_name:'特選蛋'},data:{quantity:0},clear_fields:[],
  evidence:{source_type:'screenshot',source_image_ref:'IMG-001',confidence:0,observed_text:'特選蛋'},
  review_required:false,
};
const direct={
  operation_id:'REC-001',entity:'ingredient_inventory',action:'upsert',
  key:{ingredient_name:'特選蘋果'},data:{quantity:12},clear_fields:[],
  evidence:{source_type:'screenshot',source_image_ref:'IMG-001',confidence:0.99,observed_text:'特選蘋果'},
  review_required:false,
};
const payload={schema:'pokemon-sleep-update-package/1.0',update_id:'V042748-ZERO',generated_at:'2026-08-31T00:00:00.000Z',operations:[direct,inferred]};

assert.equal(isScreenshotInferredZeroOperation(inferred),true);
assert.equal(isScreenshotInferredZeroOperation(direct),false);
assert.deepEqual(ingredientNamesWithDirectInventoryEvidence(payload),['特選蘋果']);
assert.deepEqual(inferredZeroIngredientNames(payload),['特選蛋']);

const audit=auditIngredientInferredZeroIntegrity(payload);
assert.deepEqual(audit.all_operation_names,['特選蘋果','特選蛋']);
assert.deepEqual(audit.direct_observed_names,['特選蘋果']);
assert.deepEqual(audit.inferred_zero_names,['特選蛋']);

const established=[{ingredient_name:'特選蛋',quantity:7,unlocked:1,unlock_state:'UNLOCKED',player_record_exists:1}];
const candidates=buildIngredientAbsenceCandidates({
  coverage:'USER_CONFIRMED_COMPLETE',
  recognizedIngredientNames:ingredientNamesWithDirectInventoryEvidence(payload),
  establishedInventoryRows:established,
  confirmations:[],
});
assert.equal(candidates.length,1);
assert.equal(candidates[0].ingredient_name,'特選蛋');
assert.equal(candidates[0].review_kind,'INVENTORY_QUANTITY_REVIEW');
assert.equal(candidates[0].status,'REVIEW_REQUIRED');

const confirmed=[{
  ingredient_name:'特選蛋',previous_quantity:7,resolution:'CONFIRMED_EXHAUSTED',confirmed_by_user:true,confirmed_at:'2026-08-31T00:00:01.000Z',
}];
const promoted=applyIngredientAbsenceConfirmationsWithInferredZeroPromotion(payload,confirmed,{sourceImageRefs:['IMG-001']});
const eggOps=promoted.operations.filter(operation=>operation?.key?.ingredient_name==='特選蛋');
assert.equal(eggOps.length,1,'unsafe REC zero must be replaced, never duplicated');
assert.equal(eggOps[0].data.quantity,0);
assert.equal(eggOps[0].data.unlocked,1);
assert.equal(eggOps[0].evidence.confirmed_by_user,true);
assert.equal(eggOps[0].evidence.absence_reason,'CONFIRMED_EXHAUSTED');
assert.equal(eggOps[0].evidence.quantity_observed_in_image,false);
assert.equal(promoted.inventory_capture_reconciliation.inferred_zero_not_direct_observation,true);
const validation=validateIngredientAbsenceConfirmationPackage(promoted,{coverage:'USER_CONFIRMED_COMPLETE'});
assert.equal(validation.ok,true,validation.errors.join('\n'));
assert.equal(validation.explicit_zero_count,1);

const preserve=[{
  ingredient_name:'特選蛋',previous_quantity:7,resolution:'PRESERVE_EXISTING_NOT_CAPTURED',confirmed_by_user:true,confirmed_at:'2026-08-31T00:00:02.000Z',
}];
const preserved=applyIngredientAbsenceConfirmationsWithInferredZeroPromotion(payload,preserve,{sourceImageRefs:['IMG-001']});
assert.equal(preserved.operations.some(operation=>operation?.key?.ingredient_name==='特選蛋'),false,'preserve path must remove inferred zero write');
assert.equal(validateIngredientAbsenceConfirmationPackage(preserved,{coverage:'USER_CONFIRMED_COMPLETE'}).ok,true);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042748_INGREDIENT_INFERRED_ZERO_INTEGRITY',
  semantics:{
    zero_is_valid_value:true,
    screenshot_confidence_zero_is_not_direct_observation:true,
    identity_confirmation_is_not_zero_confirmation:true,
    explicit_exhausted_confirmation_promotes_to_quantity_zero:true,
    preserve_existing_removes_inferred_zero_write:true,
  },
},null,2));
