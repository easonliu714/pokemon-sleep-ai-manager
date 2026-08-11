import assert from 'node:assert/strict';
import {
  UPDATE_PACKAGE_REQUIRED_ROOT,
  UPDATE_PACKAGE_SCHEMA_VERSION,
  UPDATE_PACKAGE_SOURCE,
  buildUpdatePackageEnvelope,
  buildUpdatePackageRootInstruction,
  buildUpdatePackageJsonSchema,
} from '../assets/js/update-package-contract.js';
import {PROMPT_CATALOG,buildScenarioTemplate} from '../assets/js/prompt-catalog.js';
import {UPDATE_PACKAGE_REQUIRED_ROOT as VALIDATOR_REQUIRED_ROOT,validateWorkflow} from '../assets/js/ai-workflow.js';
import {
  createScreenshotUpdateSession,
  addScreenshotEntry,
  assignScreenshotScenario,
  validateScreenshotScenarioPayload,
} from '../assets/js/unified-screenshot-update-center.js';

assert.deepEqual(VALIDATOR_REQUIRED_ROOT,UPDATE_PACKAGE_REQUIRED_ROOT,'validator and prompt contract must share the same required root source');
assert.deepEqual(UPDATE_PACKAGE_REQUIRED_ROOT,['schema_version','update_id','generated_at','source','operations']);
assert.equal(UPDATE_PACKAGE_SCHEMA_VERSION,'1.1');
assert.equal(UPDATE_PACKAGE_SOURCE,'ai_screenshot_analysis');

const v11Keys=['ingredients','items','candies','recipes','capacity','discard','weekly'];
for(const key of v11Keys){
  const entry=PROMPT_CATALOG[key];
  assert.equal(entry.contract,'update-package-v1.1',`${key} contract`);
  assert.ok(entry.scenario,`${key} scenario must be explicit`);
  for(const rootKey of UPDATE_PACKAGE_REQUIRED_ROOT)assert.match(entry.prompt,new RegExp(rootKey),`${key} prompt missing ${rootKey}`);
  assert.match(entry.prompt,/scenario 必須保留在 payload root/);
  assert.match(entry.prompt,/schema_version 必須是字串 "1\.1"/);
  assert.match(entry.prompt,/source 必須是字串 "ai_screenshot_analysis"/);
}
assert.equal(PROMPT_CATALOG.pokemon.contract,'observation-v2');
assert.doesNotMatch(PROMPT_CATALOG.pokemon.prompt,/Update Package v1\.1 外層契約/,'Observation v2 must not inherit v1.1 root contract');

for(const key of v11Keys){
  const template=buildScenarioTemplate(key);
  for(const rootKey of UPDATE_PACKAGE_REQUIRED_ROOT)assert.ok(rootKey in template,`${key} template missing ${rootKey}`);
  assert.equal(template.schema_version,'1.1');
  assert.equal(template.source,'ai_screenshot_analysis');
  assert.equal(template.scenario,PROMPT_CATALOG[key].scenario);
}
assert.equal(buildScenarioTemplate('weekly').context_authority,'UPDATE_CENTER_JSON');

const session=createScreenshotUpdateSession();
const weekly=addScreenshotEntry(session,{name:'weekly.png',size:1,type:'image/png'});
const ingredient=addScreenshotEntry(session,{name:'ingredient.png',size:1,type:'image/png'});
const recipe=addScreenshotEntry(session,{name:'recipe.png',size:1,type:'image/png'});
assignScreenshotScenario(session,weekly.entry_id,'weekly');
assignScreenshotScenario(session,ingredient.entry_id,'ingredients');
assignScreenshotScenario(session,recipe.entry_id,'recipes');

function readyTemplate(key,imageRef){
  const payload=buildScenarioTemplate(key);
  payload.update_id=`TEST-${key}`;
  payload.operations=payload.operations.map(operation=>({
    ...operation,
    data:key==='weekly'?{
      ...operation.data,
      event_effects:{meal_category_forced:true},
    }:operation.data,
    evidence:{...operation.evidence,source_image_ref:imageRef,source_image_refs:[imageRef]},
    review_required:false,
    user_audit:{accepted_current_observation:true},
  }));
  return payload;
}
let result=validateScreenshotScenarioPayload(session,'ingredients',readyTemplate('ingredients',ingredient.image_ref));
assert.equal(result.errors.length,0,result.errors.join('\n'));
assert.equal(result.review.length,0);
result=validateScreenshotScenarioPayload(session,'recipes',readyTemplate('recipes',recipe.image_ref));
assert.equal(result.errors.length,0,result.errors.join('\n'));
assert.equal(result.review.length,0);
result=validateScreenshotScenarioPayload(session,'weekly',readyTemplate('weekly',weekly.image_ref));
assert.equal(result.errors.length,0,result.errors.join('\n'));
assert.equal(result.review.length,0);

const badShape={
  schema:'pokemon-sleep-update-package/1.1',
  scenario:'ingredient_inventory_update',
  context_authority:'UPDATE_CENTER_JSON',
  generated_at:'2026-08-11T00:35:47.000Z',
  session_id:'ucimg-msnx7rbz-g47l9z',
  operations:[],
};
const bad=validateWorkflow(badShape);
assert.ok(bad.errors.some(value=>value.includes('缺少根欄位：schema_version')));
assert.ok(bad.errors.some(value=>value.includes('缺少根欄位：update_id')));
assert.ok(bad.errors.some(value=>value.includes('缺少根欄位：source')));
assert.ok(bad.errors.some(value=>value.includes('外層不是目前 Update Package v1.1 envelope')));
assert.ok(bad.errors.some(value=>value.includes('系統不會自動猜測或補寫 root 後套用')));

const instruction=buildUpdatePackageRootInstruction({scenario:'ingredient_inventory_update'});
assert.match(instruction,/schema_version/);assert.match(instruction,/update_id/);assert.match(instruction,/generated_at/);assert.match(instruction,/source/);assert.match(instruction,/operations/);assert.match(instruction,/scenario/);
const envelope=buildUpdatePackageEnvelope({scenario:'ingredient_inventory_update',generatedAt:'2026-08-11T00:00:00.000Z',operations:[]});
assert.equal(envelope.schema_version,'1.1');assert.equal(envelope.source,'ai_screenshot_analysis');
const schema=buildUpdatePackageJsonSchema({scenario:'ingredient_inventory_update',entities:['ingredient_inventory','account_capacity']});
assert.deepEqual(schema.required,[...UPDATE_PACKAGE_REQUIRED_ROOT,'scenario']);
assert.deepEqual(schema.properties.scenario.enum,['ingredient_inventory_update']);

console.log(JSON.stringify({
  status:'PASS',
  gate:'UC.IMG_ROOT_CONTRACT',
  schema_version:UPDATE_PACKAGE_SCHEMA_VERSION,
  required_root:UPDATE_PACKAGE_REQUIRED_ROOT,
  prompt_catalog_checked:v11Keys,
  pokemon_observation_v2_untouched:true,
  weekly_parse:true,
  ingredient_parse:true,
  recipe_parse:true,
  legacy_gemini_shape_fail_closed:true,
},null,2));
