import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_CAMP_BERRY_MASTER} from '../assets/js/public-camp-berry-master.js';
import {PUBLIC_RECIPE_DISCOVERY,activeCanonicalDiscoveryRows} from '../assets/js/public-recipe-discovery-master.js';
import {buildScenarioTemplate} from '../assets/js/prompt-catalog.js';
import {validateWeeklyContextImportPayload} from '../assets/js/weekly-context-import-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(item=>Number(item)||0);
const atLeast=(current,minimum)=>{const a=parts(current),b=parts(minimum),n=Math.max(a.length,b.length);for(let i=0;i<n;i+=1){const x=a[i]||0,y=b[i]||0;if(x!==y)return x>y;}return true;};
const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const build=version.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cache=version.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
assert.equal(atLeast(app,'v0.4.6.1'),true,'current release must preserve v0.4.6.1 authority behavior or later');
if(app==='v0.4.6.1'){
  assert.equal(build,'20260810-v0461-weekly-context-authority-camp-berry-discovery-semantics');
  assert.equal(cache,'pokemon-sleep-ai-v0.4.6.1-v0461-weekly-context-authority-camp-berry-discovery-semantics');
}

assert.equal(PUBLIC_CAMP_BERRY_MASTER.length,9);
assert.equal(PUBLIC_CAMP_BERRY_MASTER.find(row=>row.camp_name==='萌綠之島')?.berry_policy,'WEEKLY_RANDOM_3');
for(const camp of ['天青沙灘','灰褐洞窟','白花雪原','寶藍湖畔','黃金舊發電廠','琥褐溪谷']){
  const row=PUBLIC_CAMP_BERRY_MASTER.find(item=>item.camp_name===camp);assert.equal(row?.berry_policy,'FIXED_3');assert.equal(row?.favorite_berries?.length,3);
}

const weeklyTemplate=buildScenarioTemplate('weekly');
assert.equal(weeklyTemplate.context_authority,'UPDATE_CENTER_JSON');assert.equal(weeklyTemplate.scenario,'weekly_context_update');assert.equal(weeklyTemplate.operations.length,1);assert.equal(weeklyTemplate.operations[0].entity,'weekly_context');assert.equal(weeklyTemplate.operations[0].action,'upsert');assert.equal(weeklyTemplate.operations[0].key.context_id,`weekly_context_${weeklyTemplate.operations[0].data.week_start}_import`);assert.ok(['string','object'].includes(typeof weeklyTemplate.operations[0].data.event_effects));
const templateNow=new Date(`${weeklyTemplate.operations[0].data.week_start}T12:00:00`);assert.equal(validateWeeklyContextImportPayload(weeklyTemplate,{now:templateNow}).ok,true);
const legacyStringTemplate=JSON.parse(JSON.stringify(weeklyTemplate));legacyStringTemplate.operations[0].data.event_effects=JSON.stringify({recipe_final_energy_multiplier:1.5});assert.equal(validateWeeklyContextImportPayload(legacyStringTemplate,{now:templateNow}).ok,true);

const store=read('assets/js/weekly-context-store.js');
for(const token of ['UPDATE_CENTER_JSON','MANUAL_FALLBACK','import_changes','import_batches','WHERE week_start=?','manual_fallback_fields','field_sources'])assert.ok(store.includes(token),`weekly authority contract missing ${token}`);
assert.equal(store.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false);
const weeklyUi=read('assets/js/weekly-context-ui-bridge.js');assert.ok(weeklyUi.includes('更新中心 JSON'));assert.ok(weeklyUi.includes('weekly_context_${weekStart}_manual'));assert.ok(weeklyUi.includes('公版 Camp Berry Master 自動帶入並鎖定'));assert.ok(weeklyUi.includes('系統不會沿用上週資料'));
const successorManualOverride=store.includes('MANUAL_OVERRIDE')||weeklyUi.includes('MANUAL_OVERRIDE');
if(successorManualOverride){assert.ok(store.includes('authority_revision'));assert.ok(weeklyUi.includes('更新中心 JSON 為初始權威來源'));}else assert.ok(weeklyUi.includes('JSON 已提供的欄位仍保持優先'));
const importContract=read('assets/js/weekly-context-import-contract.js');for(const token of ['context_authority 必須為','不可使用上週／未來週 JSON','favorite_berry_1~3 必須全部三欄一起提供'])assert.ok(importContract.includes(token));assert.ok(importContract.includes('event_effects'));
const updateUi=read('assets/js/weekly-context-update-center-bridge.js');for(const token of ['Weekly Context JSON Contract','Authority Chain','validateWeeklyContextImportPayload','blockInvalidWeeklyAction'])assert.ok(updateUi.includes(token));
const consumer=read('assets/js/weekly-context-consumer-banner.js');for(const token of ['本頁 Weekly Context 唯一來源：［本週環境］','recipeWeeklyContextAuthority','warroomWeeklyContextAuthority'])assert.ok(consumer.includes(token));
for(const file of ['assets/js/recipe-strategy-local.js','assets/js/pokemon-candidate-local.js','assets/js/recipe-discovery-stockpile-local.js','assets/js/strategy-context-local.js','assets/js/evaluation-lifecycle.js','assets/js/current-week-recipe-recommendation-bridge.js','assets/js/shared-knowledge-ui.js']){const source=read(file);assert.ok(source.includes('currentWeeklyContext'),`${file} bypasses resolved Weekly Context authority`);assert.equal(source.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),false);}

assert.equal(PUBLIC_RECIPE_DISCOVERY.length,2);
const promoted=activeCanonicalDiscoveryRows(),promotionActive=promoted.length===2;assert.ok([0,2].includes(promoted.length),'Discovery activation pair must transition atomically');
for(const row of PUBLIC_RECIPE_DISCOVERY){
  if(promotionActive){assert.equal(row.active_canonical,true);assert.equal(row.lifecycle,'PROMOTED_TO_CANONICAL_ACTIVE');assert.ok(row.canonical_recipe_id&&row.canonical_name_zh_tw);assert.ok(Array.isArray(row.canonical_formula)&&row.canonical_formula.length===4);assert.equal(row.quantity_assignment_status,'EXACT_CURRENT_GAME_FORMULA_CONFIRMED');assert.equal(row.planning_policy,'CANONICAL_RECIPE_MASTER');}
  else{assert.equal(row.active_canonical,false);assert.equal(row.canonical_formula,null);assert.equal(row.quantity_assignment_status,'UNKNOWN_UNORDERED_SIGNATURE');assert.equal('planning_formula' in row,false);}
}
const discovery=read('assets/js/recipe-discovery-stockpile.js');for(const token of ['CONSERVATIVE_DISCOVERY_UPPER_BOUND','EACH_REFERENCE_INGREDIENT_AT_SIGNATURE_MAX'])assert.ok(discovery.includes(token),'historical pending-stockpile behavior must remain implemented even after activation');
const discoveryUi=read('assets/js/war-room-recipe-discovery-ui.js');for(const token of ['無序，尚不能對應至個別食材','保守備貨上界','不是已驗證 canonical 配方'])assert.ok(discoveryUi.includes(token),'historical pending Discovery UI semantics must remain available');
const generalTeamUi=read('assets/js/war-room-team-optimizer-ui.js');assert.ok(generalTeamUi.includes('一般戰略自動組隊（Goal Profile）'));assert.ok(discoveryUi.includes('新料理解鎖備貨專用 5 人隊伍'));

const canonical=read('assets/js/public-recipe-canonical-authority.js');assert.equal(canonical.includes('public-recipe-discovery-master'),false,'canonical authority must not depend on mutable Discovery runtime; activation is evidence-promoted directly');
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('weekly-context-authority-camp-berry-discovery-semantics'),false);
for(const deterministic of [store,discovery,read('assets/js/public-camp-berry-master.js'),importContract])for(const forbidden of ['Gemini','fetch('])assert.equal(deterministic.includes(forbidden),false,`deterministic release layer contains provider/network token: ${forbidden}`);
const sw=read('service-worker.js');assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));assert.ok(sw.includes("url.pathname.endsWith('.js')"));assert.ok(sw.includes('caches.match(event.request)'));
const bootstrap=read('assets/js/recipe-strategy-local.js');for(const moduleName of ['weekly-context-ui-bridge.js','weekly-context-update-center-bridge.js','weekly-context-consumer-banner.js','camp-berry-knowledge-ui.js','current-week-recipe-recommendation-bridge.js'])assert.ok(bootstrap.includes(moduleName));

console.log(JSON.stringify({status:'PASS',gate:'V0.4.6.1_RELEASE_HISTORICAL_CONTRACT_SUCCESSOR_AWARE',historical_minimum:'v0.4.6.1',current_app_version:app,build,cache,authority_chain:successorManualOverride?'UPDATE_CENTER_JSON(initial) -> EXPLICIT_MANUAL_OVERRIDE -> WEEKLY_ENVIRONMENT -> WAR_ROOM/RECIPES':'UPDATE_CENTER_JSON -> WEEKLY_ENVIRONMENT -> WAR_ROOM/RECIPES',manual_fallback_secondary:true,successor_manual_override_supported:successorManualOverride,executable_weekly_json_contract:true,legacy_string_event_effects_compatible:true,camp_master_rows:PUBLIC_CAMP_BERRY_MASTER.length,discovery_evidence_rows:PUBLIC_RECIPE_DISCOVERY.length,discovery_promoted_to_canonical:promotionActive,canonical_active_discovery_rows:promoted.length,discovery_quantity_assignment:promotionActive?'CANONICAL_RECIPE_MASTER':'UNKNOWN_UNORDERED_SIGNATURE',historical_stockpile_semantics_preserved:true,schema_migration_added:false,gemini_dependency:false,player_data_write_from_deterministic_layer:false,forward_compatible_release_authority:true},null,2));