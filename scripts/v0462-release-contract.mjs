import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildScenarioTemplate} from '../assets/js/prompt-catalog.js';
import {normalizeDishCategory,parseWeeklyEventEffects} from '../assets/js/weekly-context-normalization.js';
import {prepareWeeklyContextPayloadForImporter,validateWeeklyContextImportPayload} from '../assets/js/weekly-context-import-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const numericVersion=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part));
const versionAtLeast=(value,floor)=>{
  const left=numericVersion(value),right=numericVersion(floor),size=Math.max(left.length,right.length);
  for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}
  return true;
};
const version=read('assets/js/version-authority.js');
const currentVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const currentBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const currentCache=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.ok(versionAtLeast(currentVersion,'v0.4.6.2'),`historical v0.4.6.2 contract cannot run on older release: ${currentVersion}`);
if(currentVersion==='v0.4.6.2'){
  assert.equal(currentBuild,'20260810-v0462-weekly-json-robustness-recipe-recommendation');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.6.2-v0462-weekly-json-robustness-recipe-recommendation');
}

const template=buildScenarioTemplate('weekly');
assert.equal(template.context_authority,'UPDATE_CENTER_JSON');
assert.equal(template.scenario,'weekly_context_update');
assert.equal(typeof template.operations[0].data.event_effects,'object');
assert.equal(template.operations[0].key.context_id,`weekly_context_${template.operations[0].data.week_start}_import`);
const templateNow=new Date(`${template.operations[0].data.week_start}T12:00:00`);
assert.equal(validateWeeklyContextImportPayload(template,{now:templateNow}).ok,true);

const runtimePayload=JSON.parse(JSON.stringify(template));
runtimePayload.operations[0].data.dish_category='咖哩、濃湯';
runtimePayload.operations[0].data.event_effects={event_start:`${template.operations[0].data.week_start}T04:00:00+08:00`,event_end:'2026-08-17T03:59:00+08:00',meal_category_forced:true,recipe_final_energy_multiplier:1.5,extra_tasty_multiplier:3,sunday_extra_tasty_multiplier:4.5,new_recipe_count:2,cross_sleep_type_encounters:true,boosted_pokemon_types:['水','飛行','蟲'],shiny_encounter_possible:true,limited_feature:'古月鳥扭糖機'};
assert.equal(validateWeeklyContextImportPayload(runtimePayload,{now:templateNow}).ok,true);
prepareWeeklyContextPayloadForImporter(runtimePayload);
assert.equal(runtimePayload.operations[0].data.dish_category,'咖哩／濃湯');
assert.equal(typeof runtimePayload.operations[0].data.event_effects,'string');
assert.equal(parseWeeklyEventEffects(runtimePayload.operations[0].data.event_effects).recipe_final_energy_multiplier,1.5);
assert.equal(normalizeDishCategory('點心、飲料'),'甜點／飲料');

const prompt=read('assets/js/prompt-catalog.js');
assert.ok(prompt.includes('event_effects 必須直接輸出為 JSON object'));
assert.equal(prompt.includes('event_effects 必須是 JSON 字串，不是巢狀 object'),false);
const shared=read('assets/js/shared-knowledge-ui.js');
assert.ok(shared.includes('currentWeeklyContext()'));
assert.ok(shared.includes('recipeWeeklyAuthoritySummary'));
assert.equal(shared.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false);
const recommendation=read('assets/js/current-week-recipe-recommendation-bridge.js');
assert.ok(recommendation.includes('normalizeDishCategory'));
assert.ok(recommendation.includes('currentWeeklyContext()'));
const updateUi=read('assets/js/weekly-context-update-center-bridge.js');
for(const token of ['沒有 .json 附件？直接貼上 AI 回覆','JSON.parse(raw)','SELECT berry_name FROM berry_master','不在公版樹果名稱中'])assert.ok(updateUi.includes(token));
assert.equal(updateUi.includes('applyPayload('),false);
const workflow=read('assets/js/ai-workflow.js');
assert.ok(workflow.includes('prepareWeeklyContextPayloadForImporter'));
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('v0462'),false);
assert.equal(migrations.includes('weekly-json-robustness-recipe-recommendation'),false);
const importer=read('assets/js/importer.js');
assert.equal(importer.includes('v0462'),false,'generic importer remains unchanged/release agnostic');

const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"));
assert.ok(sw.includes('caches.match(event.request)'));
for(const deterministic of [read('assets/js/weekly-context-normalization.js'),read('assets/js/weekly-context-import-contract.js'),shared,recommendation]){
  for(const forbidden of ['Gemini','fetch('])assert.equal(deterministic.includes(forbidden),false,`deterministic release layer contains provider/network token: ${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.6.2_RELEASE_CONTRACT',current_app_version:currentVersion,
  historical_behavior_compatible:true,exact_release_authority_enforced:currentVersion==='v0.4.6.2',
  event_input_contract:'NESTED_OBJECT',event_storage_contract:'SQLITE_TEXT_AFTER_NORMALIZATION',legacy_string_compatible:true,
  canonical_dish_aliases:true,current_week_recipe_authority:true,raw_json_paste:true,berry_vocabulary_gate:true,
  sqlite_migration_added:false,gemini_dependency:false,direct_paste_apply:false,
},null,2));
