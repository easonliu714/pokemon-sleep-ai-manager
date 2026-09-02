import fs from 'node:fs';
import vm from 'node:vm';
import {PUBLIC_RECIPE_MASTER as HISTORICAL_BASE_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {PUBLIC_RECIPE_MASTER as CURRENT_RECIPE_MASTER} from '../assets/js/public-recipe-canonical-authority.js';
import {PUBLIC_RECIPE_PROVENANCE,PUBLIC_RECIPE_UPCOMING_EVIDENCE} from '../assets/js/public-recipe-provenance.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const read=path=>fs.readFileSync(path,'utf8');
function versionAtLeast(actual,minimum){
  const parse=value=>{const text=String(value||'');if(!/^v\d+(?:\.\d+){2,}$/.test(text))return null;return text.slice(1).split('.').map(Number);};
  const a=parse(actual),b=parse(minimum);if(!a||!b)return false;const length=Math.max(a.length,b.length);for(let i=0;i<length;i+=1){const left=a[i]||0,right=b[i]||0;if(left>right)return true;if(left<right)return false;}return true;
}

const authoritySource=read('assets/js/version-authority.js');const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(authoritySource,sandbox);const authority=sandbox.PokemonSleepVersionAuthority;
assert(versionAtLeast(authority?.app_version,'v0.4.2'),`central_version_older_than_v042:${authority?.app_version}`);
assert(typeof authority?.app_build==='string'&&authority.app_build.length>0,'missing_current_build');assert(typeof authority?.cache_name==='string'&&authority.cache_name.length>0,'missing_current_cache');
if(authority.app_version==='v0.4.2'){assert(authority.app_build==='20260809-v042-recipe-war-room-strategy-readiness','unexpected_v042_build');assert(authority.cache_name==='pokemon-sleep-ai-v0.4.2-v042-recipe-war-room-strategy-readiness','unexpected_v042_cache');}

const bootstrapModules=['war-room-goal-profile-bootstrap.js','war-room-candidate-feature-bootstrap.js','war-room-strategy-context-bootstrap.js'];
const localRecipe=read('assets/js/recipe-strategy-local.js');
for(const module of bootstrapModules){assert(localRecipe.includes(`import('./${module}')`),`war_room_runtime_not_wired:${module}`);assert(fs.existsSync(`assets/js/${module}`),`war_room_bootstrap_missing:${module}`);const source=read(`assets/js/${module}`);assert(source.includes("import {isDatabaseReady} from './database.js'"),`bootstrap_missing_database_ready_import:${module}`);assert(source.includes('if(!isDatabaseReady())return;'),`bootstrap_mount_before_database_ready:${module}`);assert(source.includes('pokemon-sleep:database-ready'),`bootstrap_missing_database_ready_event:${module}`);}
const goalUi=read('assets/js/war-room-goal-profile-ui.js');assert(goalUi.includes("import {isRescueReadonly} from './database.js'"),'goal_profile_ui_missing_rescue_guard_import');const rescueGuardIndex=goalUi.indexOf('if(isRescueReadonly())'),firstGoalReadIndex=goalUi.indexOf('getActiveStrategyGoalProfile()');assert(rescueGuardIndex>=0&&firstGoalReadIndex>rescueGuardIndex,'goal_profile_reads_player_db_before_rescue_guard');
const candidateLocal=read('assets/js/pokemon-candidate-local.js');assert(candidateLocal.includes('export function buildLocalPokemonCandidateScoring'),'candidate_scoring_adapter_not_exported');assert(candidateLocal.includes('if(isRescueReadonly())return'),'candidate_local_missing_rescue_guard');
const strategyContextLocal=read('assets/js/strategy-context-local.js');assert(strategyContextLocal.includes('buildLocalPokemonCandidateScoring'),'strategy_context_missing_candidate_scoring_adapter');assert(strategyContextLocal.includes('if(isRescueReadonly())return'),'strategy_context_missing_rescue_guard');
const serviceWorker=read('service-worker.js');assert(serviceWorker.includes("importScripts('./assets/js/version-authority.js')"),'service_worker_not_using_version_authority');assert(serviceWorker.includes("url.pathname.endsWith('.js')"),'js_network_first_cache_path_missing');assert(serviceWorker.includes('caches.open(CACHE).then(cache=>cache.put(event.request,copy))'),'runtime_js_cache_write_missing');assert(serviceWorker.includes('caches.match(event.request)')||serviceWorker.includes('caches.match(request,{ignoreSearch:true})'),'offline_cache_fallback_missing');
const migrations=read('assets/js/migrations.js');assert(migrations.includes('applyWarRoomStrategySnapshotMigration'),'strategy_migration_missing');assert(migrations.includes('if(!hasMigration(db,8))'),'strategy_migration_v8_guard_missing');assert(migrations.includes('CREATE TABLE IF NOT EXISTS strategy_goal_profile'),'goal_profile_schema_missing');assert(migrations.includes('CREATE TABLE IF NOT EXISTS pokemon_evaluation_snapshot'),'evaluation_snapshot_schema_missing');

assert(HISTORICAL_BASE_RECIPE_MASTER.length===76,`historical_v042_recipe_baseline_count:${HISTORICAL_BASE_RECIPE_MASTER.length}`);
const historicalIds=new Set(HISTORICAL_BASE_RECIPE_MASTER.map(row=>row.recipe_id));
const currentIds=new Set(CURRENT_RECIPE_MASTER.map(row=>row.recipe_id));
for(const id of historicalIds)assert(currentIds.has(id),`historical_v042_recipe_id_removed:${id}`);
assert(CURRENT_RECIPE_MASTER.length>=76,'successor recipe authority may add evidence-backed recipes but never remove historical v0.4.2 recipes');
assert(PUBLIC_RECIPE_PROVENANCE.filter(row=>row.lifecycle==='ACTIVE').length===CURRENT_RECIPE_MASTER.length,'active_recipe_provenance_count');
assert(PUBLIC_RECIPE_UPCOMING_EVIDENCE.length===2,'historical_aug10_recipe_evidence_rows_must_remain_traceable');
for(const row of PUBLIC_RECIPE_UPCOMING_EVIDENCE){
  if(row.lifecycle==='UPCOMING_REFERENCE_DISCOVERED')assert(!currentIds.has(row.canonical_recipe_id||row.recipe_id),'pending_recipe_leaked_into_runtime_master');
  else if(row.lifecycle==='PROMOTED_TO_CANONICAL')assert(currentIds.has(row.canonical_recipe_id),'promoted_recipe_missing_from_runtime_master');
  else throw new Error(`unknown_upcoming_evidence_lifecycle:${row.lifecycle}`);
}

const strategySources=['assets/js/recipe-strategy-projection.js','assets/js/pokemon-candidate-feature-projection.js','assets/js/pokemon-scoring-engine.js','assets/js/strategy-context-package.js','assets/js/strategy-gemini-contract.js'].map(read).join('\n');
for(const forbidden of ['ai-project-pool-runtime.js','applyPayload(','INSERT INTO pokemon(','UPDATE pokemon SET'])assert(!strategySources.includes(forbidden),`deterministic_strategy_forbidden_dependency:${forbidden}`);

console.log(JSON.stringify({status:'PASS',schema:'pokemon-sleep-v042-release-integration-contract/1.5',historical_contract_version:'v0.4.2',current_app_version:authority.app_version,build:authority.app_build,cache:authority.cache_name,historical_recipe_count:HISTORICAL_BASE_RECIPE_MASTER.length,current_active_recipe_count:CURRENT_RECIPE_MASTER.length,historical_recipe_ids_preserved:true,recipe_evidence_audit_rows:PUBLIC_RECIPE_UPCOMING_EVIDENCE.length,war_room_runtime_bootstraps:3,war_room_mount_requires_database_ready:true,migration_version:8,rescue_war_room_db_safe:true,strategy_context_scoring_adapter:true,offline_after_online_js_cache:true,direct_provider_apply:false,four_part_patch_version_supported:true,nested_hotfix_version_supported:true,forward_compatible_release_authority:true},null,2));