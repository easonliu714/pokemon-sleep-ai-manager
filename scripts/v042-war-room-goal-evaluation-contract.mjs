import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import {DDL,SEED_SQL} from '../assets/js/schema.js';
import {applyWarRoomStrategySnapshotMigration} from '../assets/js/migrations.js';
import {
  normalizeStrategyGoalProfile,strategyGoalProfileFingerprint,strategyGoalProfileValidation,STRATEGY_GOAL_PROFILE_VERSION,
} from '../assets/js/strategy-goal-contract.js';
import {
  EVALUATION_DIMENSIONS,POKEMON_EVALUATION_RULE_VERSION,pokemonEvaluationFingerprint,buildFactOnlyPokemonEvaluation,
} from '../assets/js/pokemon-evaluation-contract.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const profileA=normalizeStrategyGoalProfile({
  profile_name:'料理優先',primary_goal:'unlock_recipes',secondary_goals:['max_snorlax_energy','ingredient_stockpile','max_snorlax_energy'],
  weights:{unlock_recipes:1,max_snorlax_energy:0.3,ingredient_stockpile:0.5},
  hard_constraints:{require_verified_master:true,current_unlocks_only:true,ingredient_safe_reserve:{'特選蘋果':20,'暖暖薑':10},must_include_pokemon:['皮卡丘','伊布'],exclude_pokemon:['卡比獸'],preserve_current_team_slots:[3,1,3],recipe_unlock_policy:'allow_unlock_target'},
});
const profileB=normalizeStrategyGoalProfile({
  hard_constraints:{recipe_unlock_policy:'allow_unlock_target',preserve_current_team_slots:[1,3],exclude_pokemon:['卡比獸'],must_include_pokemon:['伊布','皮卡丘'],ingredient_safe_reserve:{'暖暖薑':10,'特選蘋果':20},current_unlocks_only:true,require_verified_master:true},
  weights:{ingredient_stockpile:0.5,max_snorlax_energy:0.3,unlock_recipes:1},secondary_goals:['ingredient_stockpile','max_snorlax_energy'],primary_goal:'unlock_recipes',profile_name:'料理優先',
});
assert(STRATEGY_GOAL_PROFILE_VERSION==='strategy-goal-profile-2026-08-09-a','goal_profile_version');
assert(JSON.stringify(profileA)===JSON.stringify(profileB),'goal_profile_normalization_order_dependent');
assert(strategyGoalProfileFingerprint(profileA)===strategyGoalProfileFingerprint(profileB),'goal_profile_fingerprint_order_dependent');
assert(profileA.hard_constraints.preserve_current_team_slots.join(',')==='1,3','team_slots_not_normalized');
assert(profileA.secondary_goals.length===2,'secondary_goal_duplicate_not_removed');
const conflict=strategyGoalProfileValidation({primary_goal:'balanced',hard_constraints:{must_include_pokemon:['伊布'],exclude_pokemon:['伊布']}});
assert(!conflict.valid&&conflict.errors.includes('include_exclude_conflict:伊布'),'include_exclude_conflict_not_blocked');
const levelMissing=strategyGoalProfileValidation({primary_goal:'balanced',hard_constraints:{no_untrained_candidates:true}});
assert(!levelMissing.valid&&levelMissing.errors.includes('minimum_candidate_level_required'),'missing_minimum_level_not_blocked');

const pokemon={pokemon_id:'pkm_fixture',pokemon_instance_id:'pkm_fixture',species:'伊布',current_species:'伊布',level:25,sp:1200,specialty:'技能',type:'一般',nature:'勤奮',main_skill:'能量填充S',main_skill_level:3,helper_seconds:2500,carry_limit:15,favorite_berry:'柿仔果',status:'active',ai_score:99,rating:'S+'};
const ingredients=[{unlock_level:30,ingredient_name:'哞哞鮮奶',quantity:2},{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1}];
const subskills=[{unlock_level:25,subskill_name:'幫忙速度S',is_unlocked:1},{unlock_level:10,subskill_name:'技能等級提升M',is_unlocked:1}];
const weeklyContext={context_id:'week_2026-08-10',week_start:'2026-08-10',camp:'天青沙灘',dish_category:'點心／飲料',favorite_berry_1:'柿仔果',favorite_berry_2:'橙橙果',favorite_berry_3:'桃桃果',event_name:'無活動',event_effects:'',pot_size:57,updated_at:'2026-08-10T04:00:00+08:00'};
const masterVersions={public_recipe_master_version:'r1',canonical_registry_version:'c1',public_pokemon_knowledge_version:'p1'};
const evalInput={pokemon,ingredients,subskills,weeklyContext,goalProfile:{...profileA,goal_profile_id:'goal_1'},masterVersions,ruleVersion:POKEMON_EVALUATION_RULE_VERSION};
const fp1=pokemonEvaluationFingerprint(evalInput);
const fp2=pokemonEvaluationFingerprint({...evalInput,ingredients:[...ingredients].reverse(),subskills:[...subskills].reverse(),masterVersions:{public_pokemon_knowledge_version:'p1',canonical_registry_version:'c1',public_recipe_master_version:'r1'}});
assert(fp1===fp2,'evaluation_fingerprint_order_dependent');
assert(fp1!==pokemonEvaluationFingerprint({...evalInput,weeklyContext:{...weeklyContext,camp:'萌綠之島'}}),'weekly_change_did_not_change_fingerprint');
assert(fp1!==pokemonEvaluationFingerprint({...evalInput,goalProfile:{...profileA,goal_profile_id:'goal_1',primary_goal:'balanced'}}),'goal_change_did_not_change_fingerprint');
assert(fp1!==pokemonEvaluationFingerprint({...evalInput,masterVersions:{...masterVersions,public_recipe_master_version:'r2'}}),'master_change_did_not_change_fingerprint');

const fact=buildFactOnlyPokemonEvaluation(evalInput);
for(const dimension of EVALUATION_DIMENSIONS)assert(fact[dimension]===null,`fact_snapshot_guessed_score:${dimension}`);
assert(fact.evaluation_status==='FACT_SNAPSHOT_ONLY','fact_snapshot_status');
assert(fact.score_breakdown.fact_snapshot.favorite_berry_match===true,'favorite_berry_fact_missing');
assert(fact.score_breakdown.fact_snapshot.unlocked_subskills.length===2,'unlocked_subskills_fact');
assert(fact.score_breakdown.fact_snapshot.unlocked_ingredients.length===1,'lv1_ingredient_not_unlocked_or_lv30_unlocked_early');
assert(fact.score_breakdown.fact_snapshot.unlocked_ingredients[0]==='哞哞鮮奶','unexpected_unlocked_ingredient');
assert(fact.reasons.includes('FACTS_CAPTURED_WITHOUT_GUESSED_SCORE'),'no_guess_reason_missing');
assert(fact.missing_inputs.length===5,'missing_scoring_rules_not_explicit');

const SQL=await initSqlJs({locateFile:file=>path.resolve('node_modules/sql.js/dist',file)});
const fresh=new SQL.Database();fresh.run(DDL);fresh.run(SEED_SQL);
const count=(db,table)=>{const stmt=db.prepare(`SELECT COUNT(*) AS count FROM ${table}`);stmt.step();const value=Number(stmt.getAsObject().count);stmt.free();return value;};
assert(count(fresh,'strategy_goal_profile')===0,'fresh_db_seeded_goal_profile');
assert(count(fresh,'pokemon_evaluation_snapshot')===0,'fresh_db_seeded_evaluation_snapshot');
const legacy=new SQL.Database();legacy.run('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)');legacy.run("INSERT INTO schema_migrations(version,applied_at) VALUES(1,'legacy')");
applyWarRoomStrategySnapshotMigration(legacy);
assert(count(legacy,'strategy_goal_profile')===0,'migration_seeded_goal_profile');
assert(count(legacy,'pokemon_evaluation_snapshot')===0,'migration_seeded_evaluation_snapshot');
assert(count(legacy,'schema_migrations')===2,'migration_8_not_recorded_once');
const migration8=legacy.exec('SELECT version FROM schema_migrations WHERE version=8');assert(migration8.length===1,'migration_8_missing');

const store=fs.readFileSync('assets/js/pokemon-evaluation-store.js','utf8');
const goalStore=fs.readFileSync('assets/js/strategy-goal-store.js','utf8');
const localRecipe=fs.readFileSync('assets/js/recipe-strategy-local.js','utf8');
for(const forbidden of ['UPDATE pokemon SET','INSERT INTO pokemon(','DELETE FROM pokemon','ai_score','rating='])assert(!store.includes(forbidden),`evaluation_store_mutates_pokemon:${forbidden}`);
const legacyReuseQuery=store.includes('input_fingerprint=? AND stale_at IS NULL');
const plannerReuseContract=store.includes('planFactEvaluationSnapshotRefresh')&&store.includes('planSnapshotLifecycle')&&store.includes('if(!plan.write_required&&!force)')&&store.includes('write_performed:false');
assert(legacyReuseQuery||plannerReuseContract,'snapshot_reuse_contract_missing');
if(plannerReuseContract)assert(store.indexOf('if(!plan.write_required&&!force)')<store.indexOf("await snapshot('war-room:evaluation-snapshots')"),'snapshot_reuse_zero_write_must_precede_snapshot');
assert(store.includes('SET stale_at=?'),'stale_lifecycle_missing');
assert(store.includes('player_rows_modified:false'),'snapshot_player_write_contract_missing');
assert(goalStore.includes('UPDATE strategy_goal_profile SET is_active=0'),'single_active_goal_contract_missing');
assert(localRecipe.includes('getActiveStrategyGoalProfile'),'recipe_strategy_not_connected_to_goal_profile');
assert(localRecipe.includes('ingredient_safe_reserve'),'ingredient_safe_reserve_not_applied');
assert(localRecipe.includes('require_verified_master'),'verified_master_goal_constraint_not_applied');
for(const module of ['war-room-goal-profile-bootstrap.js','war-room-candidate-feature-bootstrap.js','war-room-strategy-context-bootstrap.js'])assert(localRecipe.includes(module),`war_room_bootstrap_not_wired:${module}`);

console.log(JSON.stringify({
  status:'PASS',schema:'pokemon-sleep-war-room-goal-evaluation-contract/1.2',goal_profile_version:STRATEGY_GOAL_PROFILE_VERSION,evaluation_rule_version:POKEMON_EVALUATION_RULE_VERSION,
  goal_profile_order_invariant:true,include_exclude_conflict_blocked:true,no_untrained_minimum_level_required:true,fresh_db_player_strategy_rows:0,
  evaluation_fingerprint_order_invariant:true,weekly_goal_master_changes_invalidate_fingerprint:true,fact_only_scores_null:true,legacy_ai_score_not_reused:true,
  snapshot_reuse_contract:true,snapshot_reuse_implementation:plannerReuseContract?'planner_zero_write':'legacy_query',stale_lifecycle_contract:true,pokemon_master_rows_modified:false,recipe_projection_uses_active_goal_constraints:true,
  historical_war_room_bootstraps_preserved:3,
},null,2));