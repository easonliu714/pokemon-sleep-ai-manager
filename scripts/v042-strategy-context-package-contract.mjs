import fs from 'node:fs';
import {buildStrategyContextPackage,STRATEGY_CONTEXT_PACKAGE_VERSION} from '../assets/js/strategy-context-package.js';
import {normalizeGeminiStrategyResponse,STRATEGY_GEMINI_CONTRACT_VERSION,STRATEGY_GEMINI_RESPONSE_SCHEMA} from '../assets/js/strategy-gemini-contract.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const candidate={pokemon_id:'private-pokemon-id-001',pokemon_instance_id:'private-instance-id-001',nickname:'SECRET_NICKNAME',notes:'SECRET_NOTES',species:'伊布',level:25,specialty:'技能',type:'一般',main_skill:'能量填充S',main_skill_level:3,current_readiness_score:75,hard_constraint_status:'PASS',mandatory_candidate:true,favorite_berry_match:false,weekly_ingredient_overlap:['哞哞鮮奶'],weekly_ingredient_demand_coverage:.25,profile_completeness:{ratio:.9},collection_target_types:['進化目標'],failed_constraints:[],review_constraints:[],score_reasons:['CURRENT_READINESS_SCORED_FROM_CONFIRMED_UNLOCK_SLOTS']};
const candidate2={pokemon_id:'private-pokemon-id-002',pokemon_instance_id:'private-instance-id-002',species:'皮卡丘',level:30,specialty:'樹果',type:'電',main_skill:'能量填充S',main_skill_level:2,current_readiness_score:100,hard_constraint_status:'PASS',mandatory_candidate:false,favorite_berry_match:true,weekly_ingredient_overlap:['特選蘋果'],weekly_ingredient_demand_coverage:.5,profile_completeness:{ratio:1},collection_target_types:[],failed_constraints:[],review_constraints:[],score_reasons:[]};
const scoring={feature_fingerprint:'pokemon_features:fixture',scoring_engine_version:'score-v1',scoring_rule_registry_version:'rules-v1',ranked_candidates:[candidate,candidate2],candidates:[candidate,candidate2],api_key:'SHOULD_NEVER_APPEAR'};
const recipe={recipe_id:'dessert_test',recipe_name:'測試料理',unlocked:false,candidate_status:'UNLOCK_CANDIDATE_NEAR',total_strategy_shortage:5,missing_kinds:1,pot_fit:true,requirements:[{ingredient_name:'哞哞鮮奶',required:10,owned:5,safe_reserve:2,usable:3,strategy_shortage:7},{ingredient_name:'無缺口食材',required:1,owned:99,safe_reserve:0,usable:99,strategy_shortage:0}]};
const recipeStrategy={input_fingerprint:'recipe_strategy:fixture',candidates:[recipe]};
const goalProfile={goal_profile_id:'private-goal-id',primary_goal:'unlock_recipes',secondary_goals:['max_snorlax_energy'],weights:{unlock_recipes:1,max_snorlax_energy:.3},hard_constraints:{must_include_pokemon:['private-pokemon-id-001'],exclude_pokemon:['private@example.com'],must_include_role:['技能'],ingredient_safe_reserve:{'哞哞鮮奶':2},recipe_unlock_policy:'allow_unlock_target',require_verified_master:true}};
const weeklyContext={week_start:'2026-08-10',camp:'天青沙灘',dish_category:'甜點／飲料',favorite_berry_1:'橙橙果',favorite_berry_2:'葡萄果',favorite_berry_3:'桃桃果',pot_size:57,event_name:'測試活動',event_effects:'SECRET_EVENT_TEXT：技能發動率提升',legacy_player_event_observation:{event_name:'PRIVATE_LEGACY_EVENT',event_effects:'{"recipe_final_energy_multiplier":9.9}',deterministic_authority:false}};
const base={weeklyContext,goalProfile,candidateScoring:scoring,recipeStrategy,masterVersions:{public_recipe_master_version:'r1',public_pokemon_knowledge_version:'p1'},currentTeamPokemonIds:['private-pokemon-id-001']};
const hidden=buildStrategyContextPackage(base);
const visible=buildStrategyContextPackage({...base,includeEventText:true});

assert(['strategy-context-2026-08-09-a','strategy-context-2026-08-17-b-public-event-provenance'].includes(STRATEGY_CONTEXT_PACKAGE_VERSION),'package_version');
assert(hidden.payload.candidate_pokemon.length===2,'candidate_count');
assert(hidden.payload.current_team.length===1&&hidden.payload.current_team[0]==='cand_001','current_team_ephemeral_ref');
assert(hidden.payload.candidate_pokemon[0].candidate_ref==='cand_001','candidate_ref');
assert(hidden.resolver.cand_001.pokemon_id==='private-pokemon-id-001','local_resolver_missing_private_id');
assert(hidden.payload.weekly_context.event_effects===null,'event_text_included_without_optin');
assert(visible.payload.weekly_context.event_effects.includes('SECRET_EVENT_TEXT'),'event_text_optin_missing');
assert(hidden.privacy_manifest.event_text_included===false&&visible.privacy_manifest.event_text_included===true,'event_privacy_manifest');
assert(hidden.payload.inventory_summary.length===1&&hidden.payload.inventory_summary[0].ingredient_name==='哞哞鮮奶','inventory_not_minimized_to_relevant_shortage');
assert(hidden.payload.recipe_gap_summary[0].requirements.length===1,'recipe_requirements_not_minimized');
assert(hidden.payload.goal_profile.hard_constraints.must_include.candidate_refs.includes('cand_001'),'private_constraint_not_mapped_to_ephemeral_ref');
assert(hidden.privacy_manifest.unresolved_private_constraint_count===1,'unresolved_private_constraint_not_reported');
if(STRATEGY_CONTEXT_PACKAGE_VERSION==='strategy-context-2026-08-17-b-public-event-provenance'){
  assert(hidden.payload.public_event_authority.legacy_player_event_deterministic_authority===false,'legacy_event_authority_must_be_false');
  assert(hidden.payload.public_event_authority.event_name_is_numeric_authority===false,'event_name_must_not_be_numeric_authority');
  assert(hidden.payload.public_event_authority.authority_status==='PUBLIC_EVENT_MASTER_UNAVAILABLE','missing_public_master_must_fail_closed');
}

const payloadText=JSON.stringify(hidden.payload);
for(const forbidden of ['private-pokemon-id-001','private-instance-id-001','SECRET_NICKNAME','SECRET_NOTES','SHOULD_NEVER_APPEAR','private-goal-id','PRIVATE_LEGACY_EVENT','9.9'])assert(!payloadText.includes(forbidden),`private_value_leaked:${forbidden}`);
for(const key of ['pokemon_id','pokemon_instance_id','nickname','notes','api_key','source_image_ref','observed_json','ocr_text','legacy_player_event_observation'])assert(!payloadText.includes(`\"${key}\"`),`private_key_leaked:${key}`);
assert(hidden.privacy_manifest.stable_pokemon_ids_in_payload===false,'stable_id_manifest');
assert(hidden.privacy_manifest.raw_sqlite_in_payload===false&&hidden.privacy_manifest.api_key_in_payload===false,'raw_secret_manifest');

const normalized=normalizeGeminiStrategyResponse({
  strategy_summary:'以 cand_001 為主。',recommended_candidate_refs:['cand_001','cand_999'],recommended_recipe_ids:['dessert_test','unknown_recipe'],
  tradeoffs:[{option:'A',pros:['解鎖成熟度較高'],cons:['週樹果不匹配']}],warnings:['仍有資料缺口'],missing_inputs:['event_rule'],
  event_observation:{summary:'活動效果待確認',structured_effects:[{target:'技能型',effect:'skill_chance',value:'+?',confidence:1.4}]},
  apply_operations:[{entity:'pokemon',action:'update'}],
},{validCandidateRefs:hidden.payload.candidate_pokemon.map(row=>row.candidate_ref),validRecipeIds:hidden.payload.recipe_gap_summary.map(row=>row.recipe_id)});
assert(STRATEGY_GEMINI_CONTRACT_VERSION==='strategy-gemini-2026-08-09-a','gemini_contract_version');
assert(STRATEGY_GEMINI_RESPONSE_SCHEMA.additionalProperties===false,'schema_allows_extra_properties');
assert(normalized.recommended_candidate_refs.length===1&&normalized.recommended_candidate_refs[0]==='cand_001','unknown_candidate_ref_not_rejected');
assert(normalized.rejected_refs.candidate_refs.includes('cand_999'),'rejected_candidate_not_reported');
assert(normalized.recommended_recipe_ids.length===1&&normalized.recommended_recipe_ids[0]==='dessert_test','unknown_recipe_not_rejected');
assert(normalized.apply_allowed===false&&normalized.direct_player_write_allowed===false,'gemini_response_write_allowed');
assert(normalized.event_observation.structured_effects[0].confidence===1,'event_confidence_not_bounded');
assert(!Object.hasOwn(normalized,'apply_operations'),'untrusted_apply_operations_survived_normalization');

const ui=fs.readFileSync('assets/js/war-room-strategy-context-ui.js','utf8');
const local=fs.readFileSync('assets/js/strategy-context-local.js','utf8');
const bootstrap=fs.readFileSync('assets/js/war-room-strategy-context-bootstrap.js','utf8');
for(const source of [ui,local,bootstrap])assert(!source.includes('ai-project-pool-runtime.js'),'preview_ui_imports_provider_runtime');
assert(ui.includes('warRoomIncludeEventText')&&ui.includes('建立隱私預覽'),'privacy_preview_controls_missing');
assert(ui.includes('不呼叫 Gemini')&&ui.includes('不傳 SQLite'),'privacy_notice_missing');

console.log(JSON.stringify({status:'PASS',schema:'pokemon-sleep-strategy-context-package-contract/1.0',package_version:STRATEGY_CONTEXT_PACKAGE_VERSION,candidate_refs_ephemeral:true,stable_pokemon_ids_in_payload:false,event_text_default:false,event_text_explicit_optin:true,legacy_player_event_exported:false,public_event_provenance_fail_closed:true,inventory_minimized:true,unknown_gemini_refs_rejected:true,direct_apply_allowed:false,preview_calls_provider:false,player_data_write:false},null,2));