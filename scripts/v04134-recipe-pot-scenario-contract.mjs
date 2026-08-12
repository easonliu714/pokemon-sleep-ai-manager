import assert from 'node:assert/strict';
import {validateWorkflow} from '../assets/js/ai-workflow.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';

const snapshot=buildPublicMasterCatalogSnapshot('recipes');
const recipe=snapshot.rows.find(row=>row.recipe_id==='curry_dream_eater')||snapshot.rows[0];
assert.ok(recipe?.recipe_id&&recipe?.recipe_name,'recipe master fixture unavailable');

const recognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'recipe_status_update',
  authority:'recipe_master',
  data_version:snapshot.data_version,
  catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:'2026-08-12T07:19:52.445Z',
  visible_target_count:1,
  observations:[{
    observation_id:'obs_recipe_1',
    status:'MATCHED',
    observed_text:recipe.recipe_name,
    observed_data:{unlocked:true,recipe_level:16,current_energy:11533},
    canonical_key:{recipe_id:recipe.recipe_id,recipe_name:recipe.recipe_name},
    canonical_name:recipe.recipe_name,
    source_image_ref:'image-057',
    confidence:0.99,
  }],
  capacity_observations:[{
    capacity_key:'pot',
    total_capacity:57,
    source_image_ref:'image-057',
    confidence:0.99,
    observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY',
  }],
};

const compiled=compilePublicMasterRecognitionToUpdatePackage(recognition,'recipes',{allowedImageRefs:['image-057']});
assert.equal(compiled.ok,true,compiled.errors.join('\n'));
assert.equal(compiled.update_package.scenario,'recipe_status_update');
assert.equal(compiled.update_package.operations.length,2);
const recipeOp=compiled.update_package.operations.find(op=>op.entity==='recipes');
const potOp=compiled.update_package.operations.find(op=>op.entity==='account_capacity');
assert.ok(recipeOp,'recipe operation missing');
assert.ok(potOp,'account_capacity operation missing');
assert.deepEqual(potOp.key,{capacity_key:'pot'});
assert.deepEqual(potOp.data,{total_capacity:57});

const workflow=validateWorkflow(compiled.update_package);
assert.deepEqual(workflow.errors,[],`recipe_status_update must accept recipe-screen account_capacity: ${workflow.errors.join(' | ')}`);
assert.equal(workflow.summary.operation_count,2);
assert.equal(workflow.summary.entity_counts.recipes,1);
assert.equal(workflow.summary.entity_counts.account_capacity,1);

const unrelated={
  ...compiled.update_package,
  update_id:`${compiled.update_package.update_id}-negative`,
  operations:[...compiled.update_package.operations,{
    operation_id:'negative-item',
    entity:'item_inventory',
    action:'upsert',
    key:{item_name:'should-not-pass'},
    data:{quantity:1},
    evidence:{source_image_ref:'image-057',confidence:0.99},
    review_required:false,
  }],
};
const negative=validateWorkflow(unrelated);
assert.ok(negative.errors.some(error=>error.includes('item_inventory')&&error.includes('recipe_status_update')),'unrelated entities must remain fail-closed');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04134_RECIPE_POT_SCENARIO_CONTRACT',
  scenario:'recipe_status_update',
  recipe_entity_allowed:true,
  account_capacity_entity_allowed:true,
  pot_capacity:potOp.data.total_capacity,
  unrelated_entity_fail_closed:true,
  operation_count:workflow.summary.operation_count,
},null,2));
