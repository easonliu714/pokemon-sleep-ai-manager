import assert from 'node:assert/strict';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_BASE_MASTER_VERSION,
  PUBLIC_RECIPE_FORMULA_AUDIT,
  PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  PUBLIC_RECIPE_FORMULA_MUTATION_POLICY,
  PUBLIC_RECIPE_FORMULA_OVERRIDES,
  PUBLIC_RECIPE_ACTIVATION_ADDITIONS,
  PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS,
} from '../assets/js/public-recipe-canonical-authority.js';
import {PUBLIC_RECIPE_MASTER as RAW_PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {PUBLIC_INGREDIENT_NAMES} from '../assets/js/shared-master-data.js';
import {
  buildPublicMasterRecognitionJsonSchema,
  buildPublicMasterCatalogSnapshot,
  validatePublicMasterRecognitionPayload,
} from '../assets/js/public-master-recognition.js';

const ingredientNames=new Set(PUBLIC_INGREDIENT_NAMES);
const rawById=new Map(RAW_PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const currentById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const formulaObject=recipe=>Object.fromEntries((recipe?.ingredients||[]).map(row=>[row.ingredient_name,Number(row.quantity)]));
const formulaSignature=recipe=>JSON.stringify(Object.entries(formulaObject(recipe)).sort(([a],[b])=>a.localeCompare(b,'zh-Hant')));
const assertFormula=(recipeId,expected)=>assert.deepEqual(formulaObject(currentById.get(recipeId)),expected,`formula drift: ${recipeId}`);

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-13-a');
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,'public-recipe-formula-audit-2026-08-13-a');
assert.equal(PUBLIC_RECIPE_BASE_MASTER_VERSION,'public-recipe-master-2026-08-09-a');
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT.audited_recipe_count,78);
assert.equal(PUBLIC_RECIPE_FORMULA_AUDIT.status,'FULL_CATALOG_REFERENCE_CROSSCHECKED');
assert.equal(PUBLIC_RECIPE_FORMULA_MUTATION_POLICY.ai_may_mutate_formula,false);
assert.equal(PUBLIC_RECIPE_FORMULA_MUTATION_POLICY.manual_review_required,true);
assert.equal(PUBLIC_RECIPE_FORMULA_OVERRIDES.length,0,'historical recipe formulas must not be runtime-overridden after full audit');
assert.equal(RAW_PUBLIC_RECIPE_MASTER.length,76);
assert.equal(PUBLIC_RECIPE_MASTER.length,78);
assert.equal(new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id)).size,78);
assert.equal(new Set(PUBLIC_RECIPE_MASTER.map(row=>`${row.category}\u0000${row.recipe_name}`)).size,78);
assert.equal(PUBLIC_RECIPE_ACTIVATION_ADDITIONS.length,2);

for(const raw of RAW_PUBLIC_RECIPE_MASTER){
  const current=currentById.get(raw.recipe_id);
  assert.ok(current,`historical recipe missing: ${raw.recipe_id}`);
  assert.equal(formulaSignature(current),formulaSignature(raw),`historical formula changed outside reviewed base authority: ${raw.recipe_id}`);
}

for(const recipe of PUBLIC_RECIPE_MASTER){
  assert.equal(recipe.formula_audit_version,PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,`formula audit tag missing: ${recipe.recipe_id}`);
  assert.ok(Array.isArray(recipe.ingredients)&&recipe.ingredients.length>0,`ingredients missing: ${recipe.recipe_id}`);
  const sum=recipe.ingredients.reduce((total,row)=>total+Number(row.quantity||0),0);
  assert.equal(sum,Number(recipe.total_ingredients),`total_ingredients mismatch: ${recipe.recipe_id}`);
  assert.equal(new Set(recipe.ingredients.map(row=>row.ingredient_name)).size,recipe.ingredients.length,`duplicate ingredient row: ${recipe.recipe_id}`);
  for(const ingredient of recipe.ingredients){
    assert.ok(ingredientNames.has(ingredient.ingredient_name),`unknown ingredient ${ingredient.ingredient_name} in ${recipe.recipe_id}`);
    assert.ok(Number.isInteger(Number(ingredient.quantity))&&Number(ingredient.quantity)>0,`invalid quantity in ${recipe.recipe_id}`);
  }
}

// Formula conflict that triggered v0.4.22.1.
assertFormula('curry_parent_child',{'特選蘋果':11,'特選蛋':8,'甜甜蜜':12,'窩心洋芋':4});
assert.equal(Object.hasOwn(formulaObject(currentById.get('curry_parent_child')),'好眠番茄'),false);
const parentReview=PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.find(row=>row.recipe_id==='curry_parent_child');
assert.equal(parentReview?.resolution,'CURRENT_PUBLIC_FORMULA_CONFIRMED_BAD_SCREENSHOT_OBSERVATION_REJECTED');

// Previous OCR conflict must remain rejected.
assertFormula('curry_dizzy_punch',{'火辣香草':11,'甜甜蜜':11,'醒腦咖啡豆':11});
const dizzyReview=PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.find(row=>row.recipe_id==='curry_dizzy_punch');
assert.equal(dizzyReview?.resolution,'CURRENT_PUBLIC_FORMULA_CONFIRMED_OLD_OCR_EVIDENCE_REJECTED');

// Historical formula changes documented by the game version history are explicit regression anchors.
assertFormula('curry_ninja',{'品鮮蘑菇':5,'粗枝大蔥':12,'萌綠大豆':24,'豆製肉':9});
assertFormula('salad_tofu',{'好眠番茄':9,'萌綠大豆':15});
assertFormula('salad_ninja',{'品鮮蘑菇':12,'暖暖薑':11,'粗枝大蔥':15,'萌綠大豆':19});
assertFormula('recipe_dessert_016',{'放鬆可可':7,'純粹油':12,'萌綠大豆':16});

// Recent ingredient/recipe additions are explicit regression anchors.
assertFormula('recipe_curry_022',{'品鮮蘑菇':25,'沉甸甸南瓜':10,'窩心洋芋':18,'豆製肉':16});
assertFormula('recipe_curry_023',{'哞哞鮮奶':41,'特選酪梨':22,'純粹油':32,'窩心洋芋':20});
assertFormula('recipe_salad_024',{'特選酪梨':14,'純粹油':10,'萌綠大豆':18});
assertFormula('recipe_salad_025',{'火辣香草':30,'特選酪梨':28,'萌綠大豆':22,'萌綠玉米':25});
assertFormula('recipe_salad_026',{'品鮮蘑菇':27,'沉甸甸南瓜':20,'窩心洋芋':30,'萌綠玉米':18});
assertFormula('dessert_ghost_donut',{'好眠番茄':29,'沉甸甸南瓜':18,'特選蛋':24,'甜甜蜜':32});
assertFormula('recipe_dessert_026',{'哞哞鮮奶':14,'好眠番茄':16,'特選酪梨':18});
assertFormula('dessert_honey_chocolate',{'放鬆可可':21,'甜甜蜜':38,'純粹油':28,'萌綠玉米':28});
assertFormula('curry_greengrass_bun',{'暖暖薑':20,'火辣香草':20,'萌綠大豆':8,'純粹油':15});
assertFormula('curry_bounce_udon',{'暖暖薑':39,'品鮮蘑菇':31,'火辣香草':22,'豆製肉':20});

// Gemini/public-recognition may observe player recipe state only; formula payload fields are forbidden.
const recipeSchema=buildPublicMasterRecognitionJsonSchema('recipes');
const observedSchema=recipeSchema.properties.observations.items.properties.observed_data;
assert.deepEqual(Object.keys(observedSchema.properties).sort(),['current_energy','recipe_level','unlocked']);
assert.equal(observedSchema.additionalProperties,false);
const snapshot=buildPublicMasterCatalogSnapshot('recipes');
const injectedPayload={
  schema:'pokemon-sleep-public-master-recognition/1.0',
  recognition_version:recipeSchema.properties.recognition_version.enum[0],
  scenario:'recipe_status_update',
  authority:'recipe_master',
  data_version:snapshot.data_version,
  catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:'2026-08-13T12:00:00Z',
  visible_target_count:1,
  observations:[{
    observation_id:'formula-injection-1',status:'MATCHED',observed_text:'親子愛咖哩',
    observed_data:{unlocked:true,ingredients:[{ingredient_name:'好眠番茄',quantity:11}]},
    canonical_key:{recipe_id:'curry_parent_child',recipe_name:'親子愛咖哩'},canonical_name:'親子愛咖哩',
    source_image_ref:'image-001',confidence:1,
  }],
};
const validation=validatePublicMasterRecognitionPayload(injectedPayload,'recipes',{allowedImageRefs:['image-001']});
assert.equal(validation.ok,false);
assert.ok(validation.errors.some(error=>error.includes('observed_data 不支援欄位：ingredients')));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04221_FULL_78_RECIPE_FORMULA_AUTHORITY_AUDIT',
  recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  formula_audit_version:PUBLIC_RECIPE_FORMULA_AUDIT_VERSION,
  audited_recipe_count:PUBLIC_RECIPE_MASTER.length,
  historical_recipe_count:RAW_PUBLIC_RECIPE_MASTER.length,
  activation_addition_count:PUBLIC_RECIPE_ACTIVATION_ADDITIONS.length,
  runtime_formula_override_count:PUBLIC_RECIPE_FORMULA_OVERRIDES.length,
  parent_child_formula:'特選蘋果x11+特選蛋x8+甜甜蜜x12+窩心洋芋x4',
  ai_formula_mutation_allowed:false,
},null,2));
