import assert from 'node:assert/strict';
import {buildUpdatePackageJsonSchema} from '../assets/js/update-package-contract.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';

const schema=buildUpdatePackageJsonSchema({
  scenario:'ingredient_inventory_update',
  entities:['ingredient_inventory','account_capacity'],
});

const keySchema=schema.properties.operations.items.properties.key;
assert.equal(keySchema.additionalProperties,false,'structured output must reject invented ingredient_id keys');
assert.ok(keySchema.properties.ingredient_name,'ingredient_name must be declared in structured output key schema');
assert.ok(keySchema.properties.capacity_key,'account_capacity key must remain supported');
assert.equal('ingredient_id' in keySchema.properties,false,'ingredient_id is not a platform key');

const base={
  schema_version:'1.1',
  update_id:'TEST-INGREDIENT-KEY',
  generated_at:'2026-08-11T02:40:00.000Z',
  source:'ai_screenshot_analysis',
  scenario:'ingredient_inventory_update',
};
const operation=(key,quantity=12)=>({
  operation_id:'OP-1',entity:'ingredient_inventory',action:'upsert',key,data:{quantity},
  evidence:{source_image_ref:'image-004',confidence:0.99},review_required:false,
});

let result=validateWorkflow({...base,operations:[operation({ingredient_name:'沉甸甸南瓜'})]});
assert.equal(result.errors.length,0,result.errors.join('\n'));

result=validateWorkflow({...base,update_id:'TEST-INGREDIENT-ID',operations:[operation({ingredient_id:'fancy_pumpkin'})]});
assert.ok(result.errors.some(error=>error.includes('ingredient_inventory key 缺少 ingredient_name')),'invented ingredient_id must fail during Parse/Validate, before Dry Run/Apply');

result=validateWorkflow({...base,update_id:'TEST-INGREDIENT-EMPTY',operations:[operation({ingredient_name:''})]});
assert.ok(result.errors.some(error=>error.includes('ingredient_inventory key 缺少 ingredient_name')),'blank ingredient_name must fail early');

console.log(JSON.stringify({
  status:'PASS',gate:'UC_IMG_INGREDIENT_KEY_CONTRACT',
  canonical_key:'ingredient_name',
  invented_ingredient_id_blocked:true,
  parse_stage_fail_closed:true,
  structured_output_additional_properties:false,
},null,2));
