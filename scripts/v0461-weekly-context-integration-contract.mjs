import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_CAMP_BERRY_MASTER,campBerryAuthority,resolveCampFavoriteBerries} from '../assets/js/public-camp-berry-master.js';
import {PUBLIC_RECIPE_DISCOVERY} from '../assets/js/public-recipe-discovery-master.js';
import {projectRecipeDiscoveryStockpile} from '../assets/js/recipe-discovery-stockpile.js';

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

const store=fs.readFileSync('assets/js/weekly-context-store.js','utf8');
assert.ok(store.includes('WHERE week_start=?'),'current-week store must scope by evaluation week');
assert.ok(!store.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),'current-week store must not fall back to latest updated row');
for(const file of ['assets/js/recipe-strategy-local.js','assets/js/pokemon-candidate-local.js','assets/js/recipe-discovery-stockpile-local.js']){
  const source=fs.readFileSync(file,'utf8');
  assert.ok(source.includes('currentWeeklyContext'),`${file} must consume currentWeeklyContext`);
  assert.ok(!source.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"),`${file} must not consume stale latest-updated weekly row`);
}

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
const weeklyContext={context_id:'week_2026-08-10',week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',event_name:'夏日嘉年華2026',pot_size:57,event_effects:JSON.stringify({recipe_final_energy_multiplier:1.5,sunday_pot_multiplier:2})};
const projected=projectRecipeDiscoveryStockpile({inventory:[],scoringProjection,goalProfile,weeklyContext,maxAlternatives:0});
assert.equal(projected.summary.total_target,236);
assert.equal(projected.summary.target_semantics,'CONSERVATIVE_DISCOVERY_UPPER_BOUND');
assert.deepEqual(Object.fromEntries(projected.stockpile.map(row=>[row.ingredient_name,row.target])),{
  '暖暖薑':59,'火辣香草':59,'品鮮蘑菇':39,'豆製肉':39,'萌綠大豆':20,'純粹油':20,
});

const weeklyUi=fs.readFileSync('assets/js/weekly-context-ui-bridge.js','utf8');
for(const token of ['公版 Camp Berry Master 自動帶入並鎖定','本營地喜好樹果每週隨機','系統不會沿用上週資料','currentWeeklyContext'])assert.ok(weeklyUi.includes(token),`weekly UI missing ${token}`);
const updateBridge=fs.readFileSync('assets/js/weekly-context-update-center-bridge.js','utf8');
for(const token of ['本週營地／活動匯入內容確認','料理最終能量倍率','營地樹果規則','hiddenForWeeklyContext','隻玩家資料'])assert.ok(updateBridge.includes(token),`weekly import inspection missing ${token}`);
const knowledge=fs.readFileSync('assets/js/camp-berry-knowledge-ui.js','utf8');
for(const token of ['營地與喜好樹果','campBerryMasterTable','每週隨機 3 種','EX 動態主／副樹果'])assert.ok(knowledge.includes(token),`camp knowledge UI missing ${token}`);
const generalTeam=fs.readFileSync('assets/js/war-room-team-optimizer-ui.js','utf8');
assert.ok(generalTeam.includes('一般戰略自動組隊（Goal Profile）'));
assert.ok(generalTeam.includes('新料理解鎖備貨專用隊伍'));
const discoveryUi=fs.readFileSync('assets/js/war-room-recipe-discovery-ui.js','utf8');
for(const token of ['無序，尚不能對應至個別食材','保守備貨上界','不是已驗證 canonical 配方','新料理解鎖備貨專用 5 人隊伍'])assert.ok(discoveryUi.includes(token),`Discovery UI missing ${token}`);
const recommendation=fs.readFileSync('assets/js/current-week-recipe-recommendation-bridge.js','utf8');
assert.ok(recommendation.includes('currentWeeklyContext'));
assert.ok(!recommendation.includes("SELECT * FROM weekly_context ORDER BY updated_at DESC LIMIT 1"));
const bootstrap=fs.readFileSync('assets/js/recipe-strategy-local.js','utf8');
for(const moduleName of ['weekly-context-ui-bridge.js','weekly-context-update-center-bridge.js','camp-berry-knowledge-ui.js','current-week-recipe-recommendation-bridge.js'])assert.ok(bootstrap.includes(moduleName),`runtime bridge not mounted: ${moduleName}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0461_WEEKLY_CONTEXT_INTEGRATION',camp_authority_rows:PUBLIC_CAMP_BERRY_MASTER.length,
  greengrass_policy:byCamp('萌綠之島').berry_policy,cyan_policy:byCamp('天青沙灘').berry_policy,discovery_target:projected.summary.total_target,
  quantity_assignment:'UNKNOWN_UNORDERED_SIGNATURE',current_week_scoped:true,weekly_import_human_summary:true,team_objectives_distinguished:true,
},null,2));
