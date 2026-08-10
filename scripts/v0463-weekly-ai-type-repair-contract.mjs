import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizeWeeklyContextImportPayload,
  prepareWeeklyContextPayloadForImporter,
  validateWeeklyContextImportPayload,
} from '../assets/js/weekly-context-import-contract.js';
import {parseWeeklyEventEffects} from '../assets/js/weekly-context-normalization.js';
import {weeklyEventEffectDefinition} from '../assets/js/weekly-event-effect-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const NOW=new Date('2026-08-10T13:54:00+08:00');

// Synthetic fixture matching the LIVE Gemini shape observed on v0.4.6.2.
// No user/private screenshot bytes or local database values are committed.
const geminiLike={
  schema_version:'1.1',
  update_id:'UPD-V0463-GEMINI-LIVE-SHAPE',
  generated_at:'2026-08-10T13:49:24.000Z',
  source:'ai_screenshot_analysis',
  scenario:'weekly_context_update',
  context_authority:'UPDATE_CENTER_JSON',
  update_policy:{blank_values:'preserve_existing',explicit_clear_only_via:'operation.clear_fields',missing_fields:'no_change',explicit_zero_and_false:'write_value',identity_resolution:'platform'},
  profile_audit_confirmations:[],
  operations:[{
    operation_id:'OP-001',entity:'weekly_context',action:'upsert',
    key:{context_id:'weekly_context_2026-08-10_import'},
    data:{
      week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',
      favorite_berry_1:'靛莓果',favorite_berry_2:'橙橙果',favorite_berry_3:'芒芒果',
      event_name:'夏日嘉年華2026',
      event_effects:{
        event_start:'2026-08-10T04:00:00+08:00',event_end:'2026-08-17T03:59:00+08:00',event_camp_scope:'ALL_CAMPS',
        meal_category_forced:'咖哩／濃湯',
        recipe_final_energy_multiplier:1.5,extra_tasty_multiplier:3,sunday_extra_tasty_multiplier:4.5,new_recipe_count:2,
        cross_sleep_type_encounters:true,boosted_pokemon_types:['水','飛行','蟲'],limited_feature:'EVENT_FEATURE_FREE_TEXT',
      },
      pot_size:null,base_notes:null,updated_at:'2026-08-10T13:49:24.000Z',
    },
    clear_fields:[],evidence:{source_type:'screenshot',source_image_ref:'synthetic-weekly-evidence.png',confidence:0.98},review_required:false,user_audit:{accepted_current_observation:true},
  }],
};

const normalized=normalizeWeeklyContextImportPayload(geminiLike,{repairLegacy:true});
assert.ok(normalized.repairs.includes('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE'),'exact category-string misuse must be recorded as an explicit repair');
assert.equal(normalized.payload.operations[0].data.event_effects.meal_category_forced,true,'exact dish-category string must repair to boolean true');
const validation=validateWeeklyContextImportPayload(geminiLike,{now:NOW});
assert.equal(validation.ok,true,validation.issues.join('\n'));
assert.ok(validation.warnings.includes('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE'));

const importerPayload=clone(geminiLike);
const prepared=prepareWeeklyContextPayloadForImporter(importerPayload);
assert.ok(prepared.repairs.includes('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE'));
assert.equal(typeof importerPayload.operations[0].data.event_effects,'string','generic importer must still receive SQLite TEXT');
assert.equal(JSON.parse(importerPayload.operations[0].data.event_effects).meal_category_forced,true);

// Existing correct boolean input must remain unchanged.
const correctBoolean=clone(geminiLike);
correctBoolean.operations[0].data.event_effects.meal_category_forced=true;
const correctValidation=validateWeeklyContextImportPayload(correctBoolean,{now:NOW});
assert.equal(correctValidation.ok,true,correctValidation.issues.join('\n'));
assert.equal(correctValidation.warnings.includes('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE'),false);

// Fail closed for ambiguous/non-equivalent strings.
for(const badValue of ['true','false','FORCED','沙拉','咖哩']){
  const bad=clone(geminiLike);
  bad.operations[0].data.event_effects.meal_category_forced=badValue;
  const result=validateWeeklyContextImportPayload(bad,{now:NOW});
  assert.equal(result.ok,false,`ambiguous meal_category_forced string must fail closed: ${badValue}`);
  assert.ok(result.issues.some(issue=>issue.includes('meal_category_forced')&&issue.includes('true/false')));
}

// String event_effects input gets the same deterministic repair without breaking old storage shape.
const stringEffects=clone(geminiLike);
stringEffects.operations[0].data.event_effects=JSON.stringify(stringEffects.operations[0].data.event_effects);
const stringNormalized=normalizeWeeklyContextImportPayload(stringEffects,{repairLegacy:true});
assert.ok(stringNormalized.repairs.includes('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE'));
assert.equal(typeof stringNormalized.payload.operations[0].data.event_effects,'string','non-storage normalization must preserve legacy string event_effects shape');
assert.equal(parseWeeklyEventEffects(stringNormalized.payload.operations[0].data.event_effects).meal_category_forced,true);
assert.equal(validateWeeklyContextImportPayload(stringEffects,{now:NOW}).ok,true);

// Historical prompt wording may evolve, but the boolean contract itself must not.
assert.equal(weeklyEventEffectDefinition('meal_category_forced')?.value_type,'boolean');
const prompt=read('assets/js/prompt-catalog.js');
for(const token of [
  'meal_category_forced',
  '「meal_category_forced": true',
  '「meal_category_forced": "咖哩／濃湯"',
  '料理名稱只能放在 data.dish_category',
  'raw JSON',
])assert.ok(prompt.includes(token),`weekly prompt type contract missing: ${token}`);

const updateUi=read('assets/js/weekly-context-update-center-bridge.js');
for(const token of ['正式支援','外部 AI 是否建立附件由該介面決定','沒有 .json 附件？直接貼上 AI 回覆'])assert.ok(updateUi.includes(token),`first-class paste UX missing: ${token}`);
assert.ok(updateUi.includes('validation.warnings'),'repair warnings must remain visible in Weekly inspection UI');
assert.equal(updateUi.includes('applyPayload('),false,'paste path must not create direct Apply bypass');

const importContract=read('assets/js/weekly-context-import-contract.js');
assert.ok(importContract.includes('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE'));
assert.ok(importContract.includes('normalizeDishCategory(effects.meal_category_forced)'));

const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('v0463'),false,'v0.4.6.3 must remain SQLite-migration-free');
for(const source of [read('assets/js/weekly-context-normalization.js'),importContract]){
  for(const forbidden of ['Gemini','fetch('])assert.equal(source.includes(forbidden),false,`deterministic import layer contains provider/network token: ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',gate:'V0463_WEEKLY_AI_TYPE_REPAIR_CONTRACT',
  exact_category_string_repaired_to_true:true,
  repair_warning_visible:true,
  ambiguous_strings_fail_closed:true,
  legacy_string_event_effects_preserved:true,
  meal_category_forced_boolean_semantics:true,
  raw_json_paste_first_class:true,
  direct_apply_bypass:false,
  sqlite_migration_added:false,
  provider_dependency:false,
},null,2));
