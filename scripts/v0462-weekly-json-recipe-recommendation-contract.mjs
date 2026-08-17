import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  WEEKLY_CONTEXT_EVENT_SCHEMA,
  normalizeDishCategory,
  parseWeeklyEventEffects,
} from '../assets/js/weekly-context-normalization.js';
import {
  WEEKLY_CONTEXT_IMPORT_CONTRACT_VERSION,
  WEEKLY_CONTEXT_AUTHORITY,
  normalizeWeeklyContextImportPayload,
  prepareWeeklyContextPayloadForImporter,
  validateWeeklyContextImportPayload,
} from '../assets/js/weekly-context-import-contract.js';
import {buildScenarioTemplate} from '../assets/js/prompt-catalog.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';
import {localWeekStart} from '../assets/js/evaluation-week.js';

const read=path=>fs.readFileSync(path,'utf8');
const NOW=new Date('2026-08-10T12:00:00+08:00');
const LIVE_NOW=new Date();
const LIVE_WEEK=localWeekStart(LIVE_NOW);
const clone=value=>JSON.parse(JSON.stringify(value));

assert.equal(WEEKLY_CONTEXT_EVENT_SCHEMA,'pokemon-sleep-weekly-event-context/1.1');
assert.equal(WEEKLY_CONTEXT_IMPORT_CONTRACT_VERSION,'weekly-context-import-contract-2026-08-10-b');
assert.equal(WEEKLY_CONTEXT_AUTHORITY,'UPDATE_CENTER_JSON');
assert.equal(normalizeDishCategory('咖哩、濃湯'),'咖哩／濃湯');
assert.equal(normalizeDishCategory('咖哩,濃湯'),'咖哩／濃湯');
assert.equal(normalizeDishCategory('咖哩/濃湯'),'咖哩／濃湯');
assert.equal(normalizeDishCategory('點心、飲料'),'甜點／飲料');
assert.equal(normalizeDishCategory('點心／飲料'),'甜點／飲料');
assert.equal(normalizeDishCategory('甜點／飲料'),'甜點／飲料');

const template=buildScenarioTemplate('weekly');
assert.equal(template.scenario,'weekly_context_update');
assert.equal(template.context_authority,'UPDATE_CENTER_JSON');
assert.equal(template.operations.length,1);
assert.equal(template.operations[0].entity,'weekly_context');
assert.equal(template.operations[0].action,'upsert');
assert.equal(typeof template.operations[0].data.event_effects,'object','new template must avoid double-encoded event JSON');
assert.equal(Array.isArray(template.operations[0].data.event_effects),false);

const modern={
  schema_version:'1.1',
  update_id:'UPD-V0462-MODERN',
  generated_at:'2026-08-10T11:41:00+08:00',
  source:'ai_screenshot_analysis',
  scenario:'weekly_context_update',
  context_authority:'UPDATE_CENTER_JSON',
  update_policy:{blank_values:'preserve_existing',explicit_clear_only_via:'operation.clear_fields',missing_fields:'no_change',explicit_zero_and_false:'write_value',identity_resolution:'platform'},
  profile_audit_confirmations:[],
  operations:[{
    operation_id:'OP-001',entity:'weekly_context',action:'upsert',
    key:{context_id:'weekly_context_2026-08-10_import'},
    data:{
      week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩、濃湯',
      favorite_berry_1:'靛莓果',favorite_berry_2:'橙橙果',favorite_berry_3:'芒芒果',
      event_name:'夏日嘉年華2026',pot_size:null,base_notes:null,updated_at:'2026-08-10T11:41:00+08:00',
      event_effects:{
        event_schema:'pokemon-sleep-weekly-event-context/1.1',
        event_start:'2026-08-10T04:00:00+08:00',event_end:'2026-08-17T03:59:00+08:00',event_camp_scope:'ALL_CAMPS',
        meal_category_forced:true,recipe_final_energy_multiplier:1.5,extra_tasty_multiplier:3,sunday_extra_tasty_multiplier:4.5,
        new_recipe_count:2,cross_sleep_type_encounters:true,boosted_pokemon_types:['水','飛行','蟲'],shiny_encounter_possible:true,limited_feature:'古月鳥扭糖機',
      },
    },
    clear_fields:[],evidence:{source_type:'screenshot',source_image_ref:'1000109411.png',source_image_refs:['1000109411.png'],confidence:0.98},review_required:false,user_audit:{accepted_current_observation:true},
  }],
};
const modernValidation=validateWeeklyContextImportPayload(modern,{now:NOW});
assert.equal(modernValidation.ok,true,modernValidation.issues.join('\n'));
assert.equal(modernValidation.normalized_payload.operations[0].data.dish_category,'咖哩／濃湯');
assert.equal(typeof modernValidation.normalized_payload.operations[0].data.event_effects,'object');
assert.equal(parseWeeklyEventEffects(modernValidation.normalized_payload.operations[0].data.event_effects).limited_feature,'古月鳥扭糖機');

const modernForImporter=clone(modern);
const prepared=prepareWeeklyContextPayloadForImporter(modernForImporter);
assert.equal(typeof modernForImporter.operations[0].data.event_effects,'string','generic importer must still receive SQLite TEXT');
assert.ok(prepared.repairs.includes('DISH_CATEGORY_CANONICALIZED'));
assert.ok(prepared.repairs.includes('EVENT_EFFECTS_OBJECT_SERIALIZED_FOR_SQLITE'));
assert.equal(modernForImporter.operations[0].data.dish_category,'咖哩／濃湯');
const storedEffects=JSON.parse(modernForImporter.operations[0].data.event_effects);
assert.equal(storedEffects.event_start,'2026-08-10T04:00:00+08:00');
assert.deepEqual(storedEffects.boosted_pokemon_types,['水','飛行','蟲']);
// validateWorkflow intentionally applies the live current-week guard. Keep the
// historical v0.4.6.2 payload above fixed to its original week, but probe the
// generic workflow with an equivalent identity projected into today's week.
const workflowPayload=clone(modernForImporter);
workflowPayload.generated_at=LIVE_NOW.toISOString();
workflowPayload.operations[0].key.context_id=`weekly_context_${LIVE_WEEK}_import`;
workflowPayload.operations[0].data.week_start=LIVE_WEEK;
workflowPayload.operations[0].data.updated_at=LIVE_NOW.toISOString();
const workflow=validateWorkflow(workflowPayload);
assert.equal(workflow.errors.length,0,workflow.errors.join('\n'));
assert.equal(workflow.summary.weekly_context_contract,'PASS');

const legacy={
  schema_version:'1.1',update_id:'UPD-V0460-LEGACY',generated_at:'2026-08-10T09:05:00+08:00',source:'user_confirmed_game_screenshot',scenario:'weekly_context_update',
  update_policy:{blank_values:'preserve_existing',explicit_clear_only_via:'operation.clear_fields',missing_fields:'no_change',explicit_zero_and_false:'write_value',identity_resolution:'platform'},profile_audit_confirmations:[],
  operations:[{
    operation_id:'OP-LEGACY',entity:'weekly_context',action:'upsert',key:{context_id:'week_2026-08-10_greengrass_summer_festival_2026'},
    data:{week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',event_name:'夏日嘉年華2026',
      event_effects:JSON.stringify({event_schema:'pokemon-sleep-weekly-event-context/1.0',event_start:'2026-08-10T04:00:00+08:00',event_end:'2026-08-17T03:59:00+08:00',meal_category_forced:true,recipe_final_energy_multiplier:1.5,extra_tasty_multiplier:3,sunday_extra_tasty_multiplier:4.5,new_recipe_count:2,encounter_type_boosts:['水','飛行','蟲'],limited_feature:'古月鳥扭糖機',sunday_pot_multiplier:2,sunday_pot_multiplier_source:'player_weekly_planning_assumption'}),
      pot_size:57,base_notes:null,updated_at:'2026-08-10T09:05:00+08:00'},clear_fields:[],evidence:{source_type:'screenshot',source_image_ref:'legacy',confidence:1},review_required:false,user_audit:{accepted_current_observation:true},
  }],
};
const legacyNormalized=normalizeWeeklyContextImportPayload(legacy,{repairLegacy:true});
assert.equal(legacyNormalized.payload.context_authority,'UPDATE_CENTER_JSON');
assert.equal(legacyNormalized.payload.operations[0].key.context_id,'weekly_context_2026-08-10_import');
assert.ok(legacyNormalized.repairs.includes('LEGACY_CONTEXT_AUTHORITY_DEFAULTED'));
assert.ok(legacyNormalized.repairs.includes('LEGACY_CONTEXT_ID_CANONICALIZED'));
const legacyValidation=validateWeeklyContextImportPayload(legacy,{now:NOW,repairLegacy:true});
assert.equal(legacyValidation.ok,true,legacyValidation.issues.join('\n'));

const unknownEvent=clone(modern);
unknownEvent.operations[0].data.event_effects={mystery_bonus:99};
const unknownEventValidation=validateWeeklyContextImportPayload(unknownEvent,{now:NOW});
assert.equal(unknownEventValidation.ok,false);
assert.ok(unknownEventValidation.issues.some(item=>item.includes('mystery_bonus')));

const partialBerries=clone(modern);
partialBerries.operations[0].data.favorite_berry_2=null;
partialBerries.operations[0].data.favorite_berry_3=null;
const partialValidation=validateWeeklyContextImportPayload(partialBerries,{now:NOW});
assert.equal(partialValidation.ok,false);
assert.ok(partialValidation.issues.some(item=>item.includes('favorite_berry_1~3')));

const prompt=read('assets/js/prompt-catalog.js');
for(const token of ['event_effects 必須直接輸出為 JSON object','咖哩、濃湯','咖哩／濃湯','點心、飲料','甜點／飲料','不要把 JSON 再包成字串','直接建立 .json 附件','raw JSON'])assert.ok(prompt.includes(token),`prompt robustness missing: ${token}`);
assert.equal(prompt.includes('event_effects 必須是 JSON 字串，不是巢狀 object'),false,'double-encoded event prompt must be retired');

const shared=read('assets/js/shared-knowledge-ui.js');
assert.ok(shared.includes("from './weekly-context-store.js'"));
assert.ok(shared.includes('currentWeeklyContext()'));
assert.ok(shared.includes('normalizeDishCategory'));
assert.ok(shared.includes('recipeWeeklyAuthoritySummary'));
assert.equal(shared.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false,'recipe recommendation must not bypass Current Weekly Context authority');
const recommendation=read('assets/js/current-week-recipe-recommendation-bridge.js');
assert.ok(recommendation.includes('normalizeDishCategory'));
assert.ok(recommendation.includes('currentWeeklyContext()'));

const updateUi=read('assets/js/weekly-context-update-center-bridge.js');
for(const token of ['沒有 .json 附件？直接貼上 AI 回覆','weeklyJsonPasteText','weeklyJsonLoadPasteBtn','DataTransfer','SELECT berry_name FROM berry_master','levenshtein','不在公版樹果名稱中'])assert.ok(updateUi.includes(token),`Update Center robustness missing: ${token}`);
assert.ok(updateUi.includes('JSON.parse(raw)'),'paste path must use native JSON parser');
assert.equal(updateUi.includes('applyPayload('),false,'paste UX must not create a parallel direct-apply path');

const aiWorkflow=read('assets/js/ai-workflow.js');
assert.ok(aiWorkflow.includes('prepareWeeklyContextPayloadForImporter'));
assert.ok(aiWorkflow.includes("weekly_context_update:new Set(['weekly_context'])"));
const importer=read('assets/js/importer.js');
assert.equal(importer.includes('weekly-json-robustness-recipe-recommendation'),false,'generic importer must remain release-agnostic');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('v0462'),false,'v0.4.6.2 must remain SQLite-migration-free');
assert.equal(migrations.includes('weekly-json-robustness-recipe-recommendation'),false,'v0.4.6.2 must remain SQLite-migration-free');

for(const source of [read('assets/js/weekly-context-normalization.js'),read('assets/js/weekly-context-import-contract.js'),shared,recommendation]){
  for(const forbidden of ['Gemini','fetch('])assert.equal(source.includes(forbidden),false,`deterministic weekly/recipe layer contains provider/network token: ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',gate:'V0462_WEEKLY_JSON_RECIPE_RECOMMENDATION_CONTRACT',
  event_schema:WEEKLY_CONTEXT_EVENT_SCHEMA,import_contract:WEEKLY_CONTEXT_IMPORT_CONTRACT_VERSION,
  template_event_effects:'NESTED_OBJECT',sqlite_event_effects:'TEXT_AFTER_IMPORT_NORMALIZATION',
  modern_nested_object_pass:true,legacy_v046_string_payload_pass:true,legacy_context_id_repair:true,legacy_authority_repair:true,
  workflow_current_week_fixture:LIVE_WEEK,iso_event_boundaries:true,rich_event_keys:true,unknown_event_key_fail_closed:true,partial_berry_trio_fail_closed:true,
  canonical_dish_aliases:true,recipe_consumer_current_week_authority:true,berry_runtime_vocabulary_gate:true,raw_json_paste_uses_existing_flow:true,
  sqlite_migration_added:false,gemini_dependency:false,
},null,2));
