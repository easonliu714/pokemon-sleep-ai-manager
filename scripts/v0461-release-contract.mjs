import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_CAMP_BERRY_MASTER} from '../assets/js/public-camp-berry-master.js';
import {PUBLIC_RECIPE_DISCOVERY,activeCanonicalDiscoveryRows} from '../assets/js/public-recipe-discovery-master.js';
import {buildScenarioTemplate} from '../assets/js/prompt-catalog.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.6.1');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v0461-weekly-context-authority-camp-berry-discovery-semantics');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.6.1-v0461-weekly-context-authority-camp-berry-discovery-semantics');

assert.equal(PUBLIC_CAMP_BERRY_MASTER.length,9);
assert.equal(PUBLIC_CAMP_BERRY_MASTER.find(row=>row.camp_name==='萌綠之島')?.berry_policy,'WEEKLY_RANDOM_3');
for(const camp of ['天青沙灘','灰褐洞窟','白花雪原','寶藍湖畔','黃金舊發電廠','琥褐溪谷']){
  const row=PUBLIC_CAMP_BERRY_MASTER.find(item=>item.camp_name===camp);
  assert.equal(row?.berry_policy,'FIXED_3');
  assert.equal(row?.favorite_berries?.length,3);
}

const weeklyTemplate=buildScenarioTemplate('weekly');
assert.equal(weeklyTemplate.context_authority,'UPDATE_CENTER_JSON');
assert.equal(weeklyTemplate.scenario,'weekly_context_update');
assert.equal(weeklyTemplate.operations.length,1);
assert.equal(weeklyTemplate.operations[0].entity,'weekly_context');
assert.equal(weeklyTemplate.operations[0].action,'upsert');
assert.equal(weeklyTemplate.operations[0].key.context_id,`weekly_context_${weeklyTemplate.operations[0].data.week_start}_import`);
assert.equal(typeof weeklyTemplate.operations[0].data.event_effects,'string');

const store=read('assets/js/weekly-context-store.js');
for(const token of ['UPDATE_CENTER_JSON','MANUAL_FALLBACK','import_changes','import_batches','WHERE week_start=?','manual_fallback_fields','field_sources'])assert.ok(store.includes(token),`weekly authority contract missing ${token}`);
assert.equal(store.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false);
const weeklyUi=read('assets/js/weekly-context-ui-bridge.js');
for(const token of ['更新中心 JSON 優先','weekly_context_${weekStart}_manual','JSON 已提供的欄位仍保持優先'])assert.ok(weeklyUi.includes(token),`weekly UI authority missing ${token}`);
const updateUi=read('assets/js/weekly-context-update-center-bridge.js');
for(const token of ['Weekly Context JSON Contract','Authority Chain','UPDATE_CENTER_JSON','event_effects 必須是 JSON 字串','blockInvalidWeeklyAction'])assert.ok(updateUi.includes(token),`weekly Update Center guard missing ${token}`);
const consumer=read('assets/js/weekly-context-consumer-banner.js');
for(const token of ['本頁 Weekly Context 唯一來源：［本週環境］','recipeWeeklyContextAuthority','warroomWeeklyContextAuthority'])assert.ok(consumer.includes(token),`weekly consumer authority banner missing ${token}`);

for(const file of ['assets/js/recipe-strategy-local.js','assets/js/pokemon-candidate-local.js','assets/js/recipe-discovery-stockpile-local.js','assets/js/strategy-context-local.js','assets/js/evaluation-lifecycle.js','assets/js/current-week-recipe-recommendation-bridge.js']){
  const source=read(file);
  assert.ok(source.includes('currentWeeklyContext'),`${file} bypasses resolved Weekly Context authority`);
  assert.equal(source.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false,`${file} reintroduced stale latest-row selection`);
}

assert.equal(PUBLIC_RECIPE_DISCOVERY.length,2);
assert.equal(activeCanonicalDiscoveryRows().length,0);
for(const row of PUBLIC_RECIPE_DISCOVERY){
  assert.equal(row.active_canonical,false);
  assert.equal(row.canonical_formula,null);
  assert.equal(row.quantity_assignment_status,'UNKNOWN_UNORDERED_SIGNATURE');
  assert.equal('planning_formula' in row,false);
}
const discovery=read('assets/js/recipe-discovery-stockpile.js');
for(const token of ['CONSERVATIVE_DISCOVERY_UPPER_BOUND','EACH_REFERENCE_INGREDIENT_AT_SIGNATURE_MAX'])assert.ok(discovery.includes(token));
const discoveryUi=read('assets/js/war-room-recipe-discovery-ui.js');
for(const token of ['無序，尚不能對應至個別食材','保守備貨上界','不是已驗證 canonical 配方'])assert.ok(discoveryUi.includes(token));
const generalTeamUi=read('assets/js/war-room-team-optimizer-ui.js');
assert.ok(generalTeamUi.includes('一般戰略自動組隊（Goal Profile）'));
assert.ok(discoveryUi.includes('新料理解鎖備貨專用 5 人隊伍'));

const canonical=read('assets/js/public-recipe-canonical-authority.js');
assert.equal(canonical.includes('public-recipe-discovery-master'),false,'Discovery rows must remain outside canonical ACTIVE recipe authority');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('weekly-context-authority-camp-berry-discovery-semantics'),false,'v0.4.6.1 must not require a new SQLite migration');
for(const deterministic of [store,discovery,read('assets/js/public-camp-berry-master.js')]){
  for(const forbidden of ['Gemini','fetch('])assert.equal(deterministic.includes(forbidden),false,`deterministic release layer contains provider/network token: ${forbidden}`);
}
const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"));
assert.ok(sw.includes('caches.match(event.request)'));
const bootstrap=read('assets/js/recipe-strategy-local.js');
for(const moduleName of ['weekly-context-ui-bridge.js','weekly-context-update-center-bridge.js','weekly-context-consumer-banner.js','camp-berry-knowledge-ui.js','current-week-recipe-recommendation-bridge.js'])assert.ok(bootstrap.includes(moduleName),`v0.4.6.1 runtime bridge missing ${moduleName}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.6.1_RELEASE_CONTRACT',app_version:'v0.4.6.1',
  authority_chain:'UPDATE_CENTER_JSON -> WEEKLY_ENVIRONMENT -> WAR_ROOM/RECIPES',manual_fallback_secondary:true,
  camp_master_rows:PUBLIC_CAMP_BERRY_MASTER.length,discovery_candidates:PUBLIC_RECIPE_DISCOVERY.length,canonical_active_discovery_rows:0,
  discovery_quantity_assignment:'UNKNOWN_UNORDERED_SIGNATURE',stockpile_semantics:'CONSERVATIVE_DISCOVERY_UPPER_BOUND',
  schema_migration_added:false,gemini_dependency:false,player_data_write_from_deterministic_layer:false,
},null,2));
