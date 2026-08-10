import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildStrategyAnalysisPack,strategyAnalysisPackMarkdown,STRATEGY_ANALYSIS_PACK_VERSION,STRATEGY_ANALYSIS_PROMPT_VERSION,buildEphemeralCandidateResolver} from '../assets/js/external-strategy-analysis-pack.js';
import {sanitizeGoalProfileForExternal,assertNoStablePokemonIds,STRATEGY_ANALYSIS_PRIVACY_VERSION} from '../assets/js/external-strategy-analysis-privacy.js';

const read=path=>fs.readFileSync(path,'utf8');
const stableIdA='PKM-PRIVATE-UUID-00000001';
const stableIdB='PKM-PRIVATE-UUID-00000002';
const candidates=[
  {pokemon_id:stableIdA,pokemon_instance_id:stableIdA,species:'皮卡丘',level:30,specialty:'樹果',type:'電',hard_constraint_status:'PASS',current_readiness_score:75,favorite_berry_match:true,weekly_ingredient_overlap:['好眠番茄'],weekly_ingredient_demand_covered:8,profile_completeness:{ratio:1},missing_inputs:['weekly_fit_scoring_rule'],failed_constraints:[],reasons:['CURRENT_READINESS_V1']},
  {pokemon_id:stableIdB,pokemon_instance_id:stableIdB,species:'伊布',level:25,specialty:'技能',type:'一般',hard_constraint_status:'REVIEW',current_readiness_score:50,favorite_berry_match:false,weekly_ingredient_overlap:['哞哞鮮奶'],weekly_ingredient_demand_covered:5,profile_completeness:{ratio:.9},missing_inputs:['training_roi_scoring_rule'],failed_constraints:[],reasons:['PROFILE_REVIEW']},
];
const resolver=buildEphemeralCandidateResolver(candidates);
const rawGoal={goal_profile_id:'goal-private-1',profile_name:'我的私人策略',primary_goal:'unlock_recipes',secondary_goals:['ingredient_stockpile'],weights:{unlock_recipes:1},hard_constraints:{must_include_pokemon:[stableIdA],exclude_pokemon:[stableIdB],sleep_evolution_member_at_night:[stableIdB],ingredient_safe_reserve:{'好眠番茄':5}},profile_version:'goal-profile-v1'};
const safeGoal=sanitizeGoalProfileForExternal(rawGoal,{stableToRef:resolver.stable_to_ref,candidates});
assert.equal(safeGoal.goal_profile_id,null);
assert.equal(safeGoal.profile_name,null);
assert.deepEqual(safeGoal.hard_constraints.must_include_pokemon,['cand_001']);
assert.deepEqual(safeGoal.hard_constraints.exclude_pokemon,['cand_002']);
assert.deepEqual(safeGoal.hard_constraints.sleep_evolution_member_at_night,['cand_002']);

const weekly={
  context_id:'weekly_context_2026-08-10_import',week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',favorite_berry_1:'靛莓果',favorite_berry_2:'橙橙果',favorite_berry_3:'芒芒果',pot_size:57,event_name:'夏日活動',
  event_effect_registry_version:'weekly-event-effect-registry-2026-08-10-a',strategy_event_effects:{recipe_final_energy_multiplier:1.5,sunday_pot_multiplier:2},feature_only_event_effects:{limited_feature:'活動功能'},review_event_effects:[{source_text:'尚未建模活動效果',source_image_ref:'private-shot.png'}],event_effect_strategy_fingerprint:'weekly_event_strategy:abc12345',authority_source:'UPDATE_CENTER_JSON',
};
const resources={version:'resource-context-2026-08-10-a',fingerprint:'resource:abc12345',ingredients:[{ingredient_name:'好眠番茄',quantity:20,available:20,player_record_exists:true},{ingredient_name:'哞哞鮮奶',quantity:12,available:12,player_record_exists:true}],items:[{item_name:'雷之石',item_category:'evolution',quantity:1,safe_reserve:0,available:1,player_record_exists:true}],candies:[{candy_name:'皮卡丘的糖果',candy_type:'species',target_species_name:'皮卡丘',quantity:40,safe_reserve:10,available:30,player_record_exists:true},{candy_name:'萬能糖果S',candy_type:'universal',quantity:5,safe_reserve:0,available:5,player_record_exists:true}],candy_conversion:{rule_status:'NOT_YET_VERIFIED',derived_options:[{target:'皮卡丘的糖果',quantity:999}],included_in_physical_totals:true}};
const scoring={input_fingerprint:'score:1',candidates};
const team={projection_status:'READY',input_fingerprint:'team:1',primary:{team_status:'READY',slots:[{slot_index:0,is_leader:true,pokemon_id:stableIdA,species:'皮卡丘',level:30,specialty:'樹果',hard_constraint_status:'PASS',current_readiness_score:75,favorite_berry_match:true,weekly_ingredient_overlap:['好眠番茄'],reasons:['mandatory']},{slot_index:1,is_leader:false,pokemon_id:stableIdB,species:'伊布',level:25,specialty:'技能',hard_constraint_status:'REVIEW',current_readiness_score:50,favorite_berry_match:false,weekly_ingredient_overlap:['哞哞鮮奶'],reasons:['coverage']}],satisfied_constraints:['must_include_pokemon'],missing_constraints:[],warnings:[],recipe_coverage:{covered_ingredients:['好眠番茄','哞哞鮮奶']},estimated_energy:null},alternatives:[]};
const recipeStrategy={projection_status:'READY',input_fingerprint:'recipe:1',candidates:[{recipe_id:'recipe_001',recipe_name:'測試咖哩',category:'咖哩／濃湯',unlocked:false,total_ingredients:10,requirements:[{ingredient_name:'好眠番茄',required:8,current:20,strategy_shortage:0}]}]};
const discovery={projection_status:'READY',input_fingerprint:'discovery:1',summary:{total_target:20,total_deficit:5},discovery_candidates:[{discovery_id:'disc_a',display_name:'新料理候選 A',canonical_name_zh_tw:null,total_ingredients:20,quantity_signature:[8,12],reference_ingredient_set:['好眠番茄','哞哞鮮奶'],sunday_pot_capacity:114,sunday_pot_fit:true,sunday_pot_buffer:94}],stockpile:[{ingredient_name:'好眠番茄',target:20,current:15,deficit:5,target_semantics:'CONSERVATIVE_DISCOVERY_UPPER_BOUND'}],team:{primary:team.primary},production_rate_model:'NOT_YET_VERIFIED',estimated_ingredient_per_hour:null,estimated_weekly_energy:null};
const input={analysisRequest:'比較本週解鎖料理與培養目標的優先順序',weeklyContext:weekly,goalProfile:safeGoal,resourceSnapshot:resources,candidateScoring:scoring,teamOptimization:team,recipeStrategy,recipeDiscovery:discovery,masterVersions:{public_candy_master_version:'candy-v1',public_recipe_master_version:'recipe-v1'},ruleVersions:{team_optimizer_version:'team-v1'},currentTeamPokemonIds:[stableIdA,stableIdB],candidateLimit:30};
const first=buildStrategyAnalysisPack(input),second=buildStrategyAnalysisPack(input);
assert.equal(first.pack.pack_version,STRATEGY_ANALYSIS_PACK_VERSION);
assert.equal(first.pack.prompt_version,STRATEGY_ANALYSIS_PROMPT_VERSION);
assert.equal(first.pack.input_fingerprint,second.pack.input_fingerprint,'same canonical input must produce same fingerprint');
assert.equal(first.pack.current_team.candidate_refs.includes('cand_001'),true);
assert.equal(first.pack.current_team.candidate_refs.includes('cand_002'),true);
assert.equal(first.pack.candidate_pokemon.some(row=>row.candidate_ref==='cand_001'&&row.species==='皮卡丘'),true);
assert.equal(first.pack.deterministic_results.team_optimization.primary.slots[0].candidate_ref,'cand_001');
assert.equal(first.pack.goal_profile.hard_constraints.must_include_pokemon[0],'cand_001');
assert.equal(first.pack.resource_snapshot.candy_conversion.rule_status,'NOT_YET_VERIFIED');
assert.deepEqual(first.pack.resource_snapshot.candy_conversion.derived_options,[],'derived candy conversion must not enter external pack');
assert.equal(first.pack.resource_snapshot.candy_conversion.included_in_physical_totals,false);
assert.ok(first.pack.missing_rules.includes('verified_candy_conversion_rule'));
assert.ok(first.pack.missing_rules.includes('verified_weekly_energy_model'));
assert.ok(first.pack.missing_rules.includes('verified_ingredient_production_rate_model'));
assert.ok(first.pack.missing_rules.includes('review_required_event_effect_rules'));
assert.equal(first.pack.privacy_manifest.stable_pokemon_ids_in_pack,false);
assert.equal(first.pack.safety_manifest.direct_apply_allowed,false);
assert.equal(first.pack.safety_manifest.ai_numeric_source_of_truth,false);

const json=JSON.stringify(first.pack,null,2),markdown=strategyAnalysisPackMarkdown(first.pack),prompt=first.prompt;
for(const stableId of [stableIdA,stableIdB]){
  assert.equal(json.includes(stableId),false,`stable ID leaked to JSON: ${stableId}`);
  assert.equal(markdown.includes(stableId),false,`stable ID leaked to Markdown: ${stableId}`);
  assert.equal(prompt.includes(stableId),false,`stable ID leaked to Prompt: ${stableId}`);
}
assertNoStablePokemonIds(json,first.resolver,'synthetic JSON');
assertNoStablePokemonIds(markdown,first.resolver,'synthetic Markdown');
assertNoStablePokemonIds(prompt,first.resolver,'synthetic Prompt');
for(const forbidden of ['identity_fingerprint','field_evidence_json','source_image_refs_json'])assert.equal(json.includes(forbidden),false,`forbidden private field leaked: ${forbidden}`);
assert.equal(json.includes('private-shot.png'),false,'unknown Weekly effect source image ref must not be exported');
for(const token of ['平台觀測事實','平台 deterministic 結果','AI_INFERENCE','不得自造不存在的寶可夢個體','不得把萬能／屬性糖果的推算轉換量當成已持有'])assert.ok(prompt.includes(token),`model-neutral prompt missing safety instruction: ${token}`);

const changedRequest=buildStrategyAnalysisPack({...input,analysisRequest:'只比較料理方案'});
assert.notEqual(first.pack.input_fingerprint,changedRequest.pack.input_fingerprint,'analysis request is part of canonical analysis input');
const changedResource=buildStrategyAnalysisPack({...input,resourceSnapshot:{...resources,candies:[{...resources.candies[0],quantity:41,available:31},resources.candies[1]]}});
assert.notEqual(first.pack.input_fingerprint,changedResource.pack.input_fingerprint,'resource quantity change must change pack fingerprint');

assert.equal(STRATEGY_ANALYSIS_PRIVACY_VERSION,'strategy-analysis-privacy-2026-08-10-a');
const local=read('assets/js/external-strategy-analysis-local.js');
for(const token of ['buildUnifiedResourceSnapshot','buildLocalCandidateScoring','buildLocalTeamOptimization','buildLocalRecipeStrategy','buildLocalRecipeDiscoveryStockpile','assertNoStablePokemonIds','forbiddenKeyPaths'])assert.ok(local.includes(token),`local adapter missing ${token}`);
for(const forbidden of ['fetch(','Gemini','applyPayload('])assert.equal(local.includes(forbidden),false,`local Strategy Analysis path must be provider/apply independent: ${forbidden}`);
const ui=read('assets/js/war-room-strategy-analysis-pack-ui.js');
for(const token of ['產生可信分析包','複製 AI 提示詞','下載 JSON','下載 Markdown','navigator.share','資料已變更，請重新產生'])assert.ok(ui.includes(token),`Strategy Analysis UI missing ${token}`);
assert.equal(ui.includes('applyPayload('),false,'external Analysis UI must have no direct Apply path');
const recipeLocal=read('assets/js/recipe-strategy-local.js');
assert.ok(recipeLocal.includes("import('./war-room-strategy-analysis-pack-ui.js')"),'War Room must load Strategy Analysis UI');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'WAR.3C must not add SQLite migration 10');

console.log(JSON.stringify({
  status:'PASS',gate:'WAR3C_EXTERNAL_STRATEGY_ANALYSIS_PACK_CONTRACT',pack_version:STRATEGY_ANALYSIS_PACK_VERSION,prompt_version:STRATEGY_ANALYSIS_PROMPT_VERSION,privacy_version:STRATEGY_ANALYSIS_PRIVACY_VERSION,
  deterministic_fingerprint:true,stable_pokemon_id_export:false,ephemeral_candidate_refs:true,goal_constraint_ids_sanitized:true,resource_counts_authoritative:true,
  candy_double_count_guard:true,missing_rules_explicit:true,provider_call_required:false,direct_apply_path:false,json_export:true,markdown_export:true,copy_prompt:true,web_share:true,sqlite_migration_added:false,
},null,2));
