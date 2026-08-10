import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_CAMP_BERRY_MASTER,campBerryAuthority,resolveCampFavoriteBerries} from '../assets/js/public-camp-berry-master.js';
import {PUBLIC_RECIPE_DISCOVERY} from '../assets/js/public-recipe-discovery-master.js';
import {projectRecipeDiscoveryStockpile} from '../assets/js/recipe-discovery-stockpile.js';
import {buildScenarioTemplate} from '../assets/js/prompt-catalog.js';

const read=file=>fs.readFileSync(file,'utf8');
const byCamp=name=>campBerryAuthority(name);
assert.equal(PUBLIC_CAMP_BERRY_MASTER.length,9);
assert.equal(byCamp('萌綠之島').berry_policy,'WEEKLY_RANDOM_3');
assert.deepEqual(byCamp('萌綠之島').favorite_berries,[]);
assert.deepEqual(byCamp('天青沙灘').favorite_berries,['橙橙果','桃桃果','椰木果']);
assert.deepEqual(byCamp('灰褐洞窟').favorite_berries,['蘋野果','勿花果','文柚果']);
assert.deepEqual(byCamp('白花雪原').favorite_berries,['莓莓果','柿仔果','異奇果']);
assert.deepEqual(byCamp('寶藍湖畔').favorite_berries,['金枕果','櫻子果','芒芒果']);
assert.deepEqual(byCamp('黃金舊發電廠').favorite_berries,['葡萄果','墨莓果','靛莓果']);
assert.deepEqual(byCamp('琥褐溪谷').favorite_berries,['零餘果','木子果','番荔果']);
assert.equal(byCamp('天青沙灘EX').berry_policy,'EX_DYNAMIC');
assert.deepEqual(byCamp('天青沙灘EX').main_berry_pool,['桃桃果','椰木果','橙橙果']);

const cyan=resolveCampFavoriteBerries('天青沙灘',['莓莓果','柿仔果','異奇果']);
assert.equal(cyan.locked,true);
assert.deepEqual(cyan.berries,['橙橙果','桃桃果','椰木果'],'fixed camp must ignore stale/player berry values');
const greengrassEmpty=resolveCampFavoriteBerries('萌綠之島',['','','']);
assert.equal(greengrassEmpty.locked,false);
assert.deepEqual(greengrassEmpty.berries,[],'Greengrass must not inherit stale berries');
const greengrassObserved=resolveCampFavoriteBerries('萌綠之島',['莓莓果','柿仔果','異奇果']);
assert.deepEqual(greengrassObserved.berries,['莓莓果','柿仔果','異奇果']);
assert.equal(greengrassObserved.source,'PLAYER_WEEK_OBSERVATION');

const store=read('assets/js/weekly-context-store.js');
for(const token of ['WHERE week_start=?','import_changes','import_batches','weekly_context_update','UPDATE_CENTER_JSON','MANUAL_FALLBACK','manual_fallback_fields','field_sources'])assert.ok(store.includes(token),`weekly context authority store missing: ${token}`);
assert.ok(!store.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),'current-week store must not fall back to latest updated row');
for(const file of ['assets/js/recipe-strategy-local.js','assets/js/pokemon-candidate-local.js','assets/js/recipe-discovery-stockpile-local.js','assets/js/strategy-context-local.js','assets/js/evaluation-lifecycle.js']){
  const source=read(file);
  assert.ok(source.includes('currentWeeklyContext'),`${file} must consume currentWeeklyContext`);
  assert.ok(!source.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),`${file} must not consume stale latest-updated weekly row`);
}

const weeklyTemplate=buildScenarioTemplate('weekly');
assert.equal(weeklyTemplate.scenario,'weekly_context_update');
assert.equal(weeklyTemplate.context_authority,'UPDATE_CENTER_JSON');
assert.equal(weeklyTemplate.operations.length,1);
assert.equal(weeklyTemplate.operations[0].entity,'weekly_context');
assert.equal(weeklyTemplate.operations[0].action,'upsert');
assert.match(weeklyTemplate.operations[0].data.week_start,/^\d{4}-\d{2}-\d{2}$/);
assert.equal(weeklyTemplate.operations[0].key.context_id,`weekly_context_${weeklyTemplate.operations[0].data.week_start}_import`);
assert.equal(typeof weeklyTemplate.operations[0].data.event_effects,'string');
assert.ok(weeklyTemplate.operations[0].data.updated_at);
const prompt=read('assets/js/prompt-catalog.js');
for(const token of ['context_authority=UPDATE_CENTER_JSON','weekly_context_<week_start>_import','event_effects 必須是 JSON 字串','全部三種喜好樹果','不得沿用上週','不要直接輸出戰情室或食譜建議'])assert.ok(prompt.includes(token),`weekly prompt contract missing: ${token}`);

assert.equal(PUBLIC_RECIPE_DISCOVERY.length,2);
for(const row of PUBLIC_RECIPE_DISCOVERY){
  assert.equal(row.quantity_assignment_status,'UNKNOWN_UNORDERED_SIGNATURE');
  assert.equal(row.active_canonical,false);
  assert.equal(row.canonical_formula,null);
  assert.equal('planning_formula' in row,false);
  assert.equal(row.max_observed_quantity,Math.max(...row.observed_quantity_signature));
  assert.equal(row.reference_ingredient_set.length,4);
}
const make=(id,species,ingredients)=>({pokemon_id:id,species,level:30,specialty:'食材',hard_constraint_status:'PASS',mandatory_candidate:false,favorite_berry_match:false,current_readiness_score:50,profile_completeness:{ratio:1},unlocked_ingredients:ingredients.map(ingredient_name=>({ingredient_name,unlock_level:1,quantity:1})),failed_constraints:[],review_constraints:[]});
const scoringProjection={feature_fingerprint:'v0461',candidates:[
  make('p1','甲',['暖暖薑']),make('p2','乙',['火辣香草']),make('p3','丙',['品鮮蘑菇']),make('p4','丁',['豆製肉']),make('p5','戊',['萌綠大豆','純粹油']),
]};
const goalProfile={goal_profile_id:'goal',hard_constraints:{must_include_pokemon:[],exclude_pokemon:[],must_include_role:[],max_same_species:5}};
const weeklyContext={context_id:'weekly_context_2026-08-10_import',week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',event_name:'夏日嘉年華2026',pot_size:57,event_effects:JSON.stringify({recipe_final_energy_multiplier:1.5,sunday_pot_multiplier:2})};
const projected=projectRecipeDiscoveryStockpile({inventory:[],scoringProjection,goalProfile,weeklyContext,maxAlternatives:0});
assert.equal(projected.summary.total_target,236);
assert.equal(projected.summary.target_semantics,'CONSERVATIVE_DISCOVERY_UPPER_BOUND');
assert.deepEqual(Object.fromEntries(projected.stockpile.map(row=>[row.ingredient_name,row.target])),{
  '暖暖薑':59,'火辣香草':59,'品鮮蘑菇':39,'豆製肉':39,'萌綠大豆':20,'純粹油':20,
});

const weeklyUi=read('assets/js/weekly-context-ui-bridge.js');
for(const token of ['Authority：更新中心 JSON 優先','weekly_context_${weekStart}_manual','JSON 已提供的欄位仍保持優先','公版 Camp Berry Master 自動帶入並鎖定','系統不會沿用上週資料'])assert.ok(weeklyUi.includes(token),`weekly UI authority missing ${token}`);
const updateBridge=read('assets/js/weekly-context-update-center-bridge.js');
for(const token of ['Authority Chain','Weekly Context JSON Contract','UPDATE_CENTER_JSON','key.context_id 必須為 weekly_context_','event_effects 必須是 JSON 字串','hiddenForWeeklyContext','隻玩家資料'])assert.ok(updateBridge.includes(token),`weekly import inspection missing ${token}`);
const consumerBanner=read('assets/js/weekly-context-consumer-banner.js');
for(const token of ['本頁 Weekly Context 唯一來源：［本週環境］','recipeWeeklyContextAuthority','warroomWeeklyContextAuthority','更新中心 JSON'])assert.ok(consumerBanner.includes(token),`weekly consumer banner missing ${token}`);
const knowledge=read('assets/js/camp-berry-knowledge-ui.js');
for(const token of ['營地與喜好樹果','campBerryMasterTable','每週隨機 3 種','EX 動態主／副樹果'])assert.ok(knowledge.includes(token),`camp knowledge UI missing ${token}`);
const generalTeam=read('assets/js/war-room-team-optimizer-ui.js');
assert.ok(generalTeam.includes('一般戰略自動組隊（Goal Profile）'));
assert.ok(generalTeam.includes('新料理解鎖備貨專用隊伍'));
const discoveryUi=read('assets/js/war-room-recipe-discovery-ui.js');
for(const token of ['無序，尚不能對應至個別食材','保守備貨上界','不是已驗證 canonical 配方','新料理解鎖備貨專用 5 人隊伍'])assert.ok(discoveryUi.includes(token),`Discovery UI missing ${token}`);
const recommendation=read('assets/js/current-week-recipe-recommendation-bridge.js');
assert.ok(recommendation.includes('currentWeeklyContext'));
assert.ok(!recommendation.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"));
const bootstrap=read('assets/js/recipe-strategy-local.js');
for(const moduleName of ['weekly-context-ui-bridge.js','weekly-context-update-center-bridge.js','weekly-context-consumer-banner.js','camp-berry-knowledge-ui.js','current-week-recipe-recommendation-bridge.js'])assert.ok(bootstrap.includes(moduleName),`runtime bridge not mounted: ${moduleName}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0461_WEEKLY_CONTEXT_INTEGRATION',camp_authority_rows:PUBLIC_CAMP_BERRY_MASTER.length,
  greengrass_policy:byCamp('萌綠之島').berry_policy,cyan_policy:byCamp('天青沙灘').berry_policy,discovery_target:projected.summary.total_target,
  quantity_assignment:'UNKNOWN_UNORDERED_SIGNATURE',current_week_scoped:true,authority_chain:'UPDATE_CENTER_JSON -> WEEKLY_ENVIRONMENT -> WAR_ROOM/RECIPES',
  manual_fallback_secondary:true,weekly_import_human_summary:true,weekly_json_contract_enforced:true,team_objectives_distinguished:true,
},null,2));
