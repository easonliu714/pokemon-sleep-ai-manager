import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UC_IMG_A_VERSION,
  createScreenshotUpdateSession,
  addScreenshotEntry,
  assignScreenshotScenario,
  setScenarioCoverage,
  serializableScreenshotSession,
  buildScreenshotScenarioPrompt,
  screenshotScenarioRevision,
  extractJsonObjectText,
  validateScreenshotScenarioPayload,
} from '../assets/js/unified-screenshot-update-center.js';

const iso='2026-08-11T00:00:00.000Z';
const basePayload=(scenario,operations,extra={})=>({
  schema_version:'1.1',update_id:`TEST-${scenario}`,generated_at:iso,source:'ai_screenshot_analysis',scenario,
  update_policy:{blank_values:'preserve_existing',missing_fields:'no_change',explicit_zero_and_false:'write_value'},operations,...extra,
});
const op=(entity,key,data,imageRef='image-001')=>({
  operation_id:`OP-${entity}-${Object.values(key).join('-')}`,entity,action:'upsert',key,data,clear_fields:[],
  evidence:{source_type:'screenshot',source_image_ref:imageRef,confidence:0.99},review_required:false,user_audit:{accepted_current_observation:true},
});

assert.equal(UC_IMG_A_VERSION,'uc-img-a-2026-08-11-b');
const session=createScreenshotUpdateSession();
const weekly=addScreenshotEntry(session,{name:'weekly_event.png',size:100,type:'image/png'});
const ingredient=addScreenshotEntry(session,{name:'ingredient_bag_01.png',size:200,type:'image/png'});
const recipe=addScreenshotEntry(session,{name:'recipe_curry.png',size:300,type:'image/png'});
assert.equal(weekly.scenario_key,'weekly');assert.equal(ingredient.scenario_key,'ingredients');assert.equal(recipe.scenario_key,'recipes');
assert.deepEqual([weekly.image_ref,ingredient.image_ref,recipe.image_ref],['image-001','image-002','image-003']);

assignScreenshotScenario(session,weekly.entry_id,'weekly');assignScreenshotScenario(session,ingredient.entry_id,'ingredients');assignScreenshotScenario(session,recipe.entry_id,'recipes');
setScenarioCoverage(session,'ingredients','PARTIAL');
let prompt=buildScreenshotScenarioPrompt(session,'ingredients');
assert.match(prompt,/scenario=ingredient_inventory_update/);assert.match(prompt,/image-002 = ingredient_bag_01\.png/);assert.match(prompt,/coverage=PARTIAL/);assert.match(prompt,/沒有出現的食材／料理絕對不得補 0/);
const partialRevision=screenshotScenarioRevision(session,'ingredients');
session.scenario_state.ingredients.raw_response='{"test":"old"}';session.scenario_state.ingredients.response_prompt_revision=partialRevision;session.scenario_state.ingredients.response_stale=false;
setScenarioCoverage(session,'ingredients','USER_CONFIRMED_COMPLETE');
assert.equal(session.scenario_state.ingredients.response_stale,true,'coverage change must stale an existing AI response');
prompt=buildScreenshotScenarioPrompt(session,'ingredients');
assert.match(prompt,/completeness evidence/);assert.match(prompt,/不授權你為未出現項目新增 0、false、delete 或 clear_fields/);assert.notEqual(screenshotScenarioRevision(session,'ingredients'),partialRevision);
session.scenario_state.ingredients.raw_response='';session.scenario_state.ingredients.response_stale=false;

const ingredientPayload=basePayload('ingredient_inventory_update',[op('ingredient_inventory',{ingredient_name:'甜甜蜜'},{quantity:113},'image-002')]);
let result=validateScreenshotScenarioPayload(session,'ingredients',ingredientPayload);
assert.equal(result.errors.length,0,result.errors.join('\n'));assert.equal(result.review.length,0);assert.equal(result.summary.traceable_evidence,true);assert.equal(result.summary.coverage,'USER_CONFIRMED_COMPLETE');assert.equal(result.payload.operations.length,1,'parser must not synthesize absent inventory rows');

const fenced=`分析如下\n\`\`\`json\n${JSON.stringify(ingredientPayload)}\n\`\`\``;
assert.deepEqual(JSON.parse(extractJsonObjectText(fenced)),ingredientPayload);result=validateScreenshotScenarioPayload(session,'ingredients',fenced);assert.equal(result.errors.length,0,result.errors.join('\n'));

const badRef=structuredClone(ingredientPayload);badRef.update_id='TEST-bad-ref';badRef.operations[0].evidence.source_image_ref='image-999';result=validateScreenshotScenarioPayload(session,'ingredients',badRef);assert.ok(result.errors.some(value=>value.includes('不屬於本情境的 image_ref')));
const wrongScenario=structuredClone(ingredientPayload);wrongScenario.update_id='TEST-wrong-scenario';wrongScenario.scenario='recipe_status_update';result=validateScreenshotScenarioPayload(session,'ingredients',wrongScenario);assert.ok(result.errors.some(value=>value.includes('scenario 必須為 ingredient_inventory_update')));
const duplicate=basePayload('ingredient_inventory_update',[op('ingredient_inventory',{ingredient_name:'甜甜蜜'},{quantity:113},'image-002'),{...op('ingredient_inventory',{ingredient_name:'甜甜蜜'},{quantity:113},'image-002'),operation_id:'OP-DUP-2'}]);result=validateScreenshotScenarioPayload(session,'ingredients',duplicate);assert.ok(result.warnings.some(value=>value.includes('相同目標 key')));
const wrongAction=structuredClone(ingredientPayload);wrongAction.update_id='TEST-wrong-action';wrongAction.operations[0].action='update';result=validateScreenshotScenarioPayload(session,'ingredients',wrongAction);assert.ok(result.errors.some(value=>value.includes('截圖更新只允許 action=upsert')));

const recipePayload=basePayload('recipe_status_update',[op('recipes',{recipe_name:'寶寶甜蜜咖哩'},{unlocked:true,recipe_level:1,current_energy:100},'image-003')]);
result=validateScreenshotScenarioPayload(session,'recipes',recipePayload);assert.equal(result.errors.length,0,result.errors.join('\n'));assert.equal(result.payload.operations.length,1,'unseen recipes must not be synthesized as locked');

const weeklyPayload=basePayload('weekly_context_update',[op('weekly_context',{context_id:'weekly_context_2026-08-10_import'},{week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',pot_size:57,event_name:'測試活動',event_effects:{meal_category_forced:true,recipe_final_energy_multiplier:1.5},updated_at:iso},'image-001')],{context_authority:'UPDATE_CENTER_JSON'});
result=validateScreenshotScenarioPayload(session,'weekly',weeklyPayload);assert.equal(result.errors.length,0,result.errors.join('\n'));assert.equal(result.summary.weekly_context_contract,'PASS');
const weeklyTwo=structuredClone(weeklyPayload);weeklyTwo.update_id='TEST-weekly-two';weeklyTwo.operations.push({...weeklyTwo.operations[0],operation_id:'OP-weekly-2'});result=validateScreenshotScenarioPayload(session,'weekly',weeklyTwo);assert.ok(result.errors.some(value=>value.includes('Weekly Context 必須只有 1 筆 operation')));

weekly.object_url='blob:private-screenshot';weekly.image_available=true;const persisted=serializableScreenshotSession(session);assert.equal(persisted.entries[0].object_url,null);assert.equal(persisted.entries[0].image_available,false);assert.equal(persisted.entries[0].file_name,'weekly_event.png');

const loader=fs.readFileSync(new URL('../assets/js/candy-inventory-ui.js',import.meta.url),'utf8');assert.match(loader,/import '\.\/unified-screenshot-update-center\.js';/);
const source=fs.readFileSync(new URL('../assets/js/unified-screenshot-update-center.js',import.meta.url),'utf8');
for(const token of ["from './ai-workflow.js'","from './importer.js'",'validateWorkflow','dryRun','applyPayload','multiple','USER_CONFIRMED_COMPLETE','PARTIAL','response_stale','screenshotScenarioRevision'])assert.ok(source.includes(token),`missing runtime contract token: ${token}`);
assert.ok(!/indexedDB\.put\([^\n]*image|INSERT[^\n]*image_blob/i.test(source),'UC.IMG-A must not persist screenshot bytes');

console.log(JSON.stringify({status:'PASS',gate:'UC.IMG-A',version:UC_IMG_A_VERSION,session_entries:session.entries.length,weekly_contract:'PASS',ingredient_partial_zero_guard:'PASS',recipe_absent_lock_guard:'PASS',image_ref_filename_mapping:'PASS',stale_response_guard:'PASS',evidence_ref_guard:'PASS',existing_importer_bridge:'PASS'},null,2));
