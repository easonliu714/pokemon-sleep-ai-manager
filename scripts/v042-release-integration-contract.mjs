import fs from 'node:fs';
import vm from 'node:vm';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';
import {PUBLIC_RECIPE_PROVENANCE,PUBLIC_RECIPE_UPCOMING_EVIDENCE} from '../assets/js/public-recipe-provenance.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const read=path=>fs.readFileSync(path,'utf8');

const authoritySource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(authoritySource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
assert(authority?.app_version==='v0.4.2','central_version_not_v042');
assert(authority?.app_build==='20260809-v042-recipe-war-room-strategy-readiness','unexpected_v042_build');
assert(authority?.cache_name==='pokemon-sleep-ai-v0.4.2-v042-recipe-war-room-strategy-readiness','unexpected_v042_cache');

const localRecipe=read('assets/js/recipe-strategy-local.js');
for(const module of [
  'war-room-goal-profile-bootstrap.js',
  'war-room-candidate-feature-bootstrap.js',
  'war-room-strategy-context-bootstrap.js',
]){
  assert(localRecipe.includes(`import('./${module}')`),`war_room_runtime_not_wired:${module}`);
  assert(fs.existsSync(`assets/js/${module}`),`war_room_bootstrap_missing:${module}`);
}

const serviceWorker=read('service-worker.js');
assert(serviceWorker.includes("importScripts('./assets/js/version-authority.js')"),'service_worker_not_using_version_authority');
assert(serviceWorker.includes("url.pathname.endsWith('.js')"),'js_network_first_cache_path_missing');
assert(serviceWorker.includes('caches.open(CACHE).then(cache=>cache.put(event.request,copy))'),'runtime_js_cache_write_missing');
assert(serviceWorker.includes('caches.match(event.request)'),'offline_cache_fallback_missing');

const migrations=read('assets/js/migrations.js');
assert(migrations.includes('applyWarRoomStrategySnapshotMigration'),'strategy_migration_missing');
assert(migrations.includes('if(!hasMigration(db,8))'),'strategy_migration_v8_guard_missing');
assert(migrations.includes('CREATE TABLE IF NOT EXISTS strategy_goal_profile'),'goal_profile_schema_missing');
assert(migrations.includes('CREATE TABLE IF NOT EXISTS pokemon_evaluation_snapshot'),'evaluation_snapshot_schema_missing');

assert(PUBLIC_RECIPE_MASTER.length===76,`active_recipe_authority_count:${PUBLIC_RECIPE_MASTER.length}`);
assert(PUBLIC_RECIPE_PROVENANCE.filter(row=>row.lifecycle==='ACTIVE').length===76,'active_recipe_provenance_count');
assert(PUBLIC_RECIPE_UPCOMING_EVIDENCE.length===2,'upcoming_recipe_evidence_count');
const activeIds=new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id));
assert(PUBLIC_RECIPE_UPCOMING_EVIDENCE.every(row=>!activeIds.has(row.recipe_id)),'upcoming_recipe_leaked_into_runtime_master');

const strategySources=[
  'assets/js/recipe-strategy-projection.js',
  'assets/js/pokemon-candidate-feature-projection.js',
  'assets/js/pokemon-scoring-engine.js',
  'assets/js/strategy-context-package.js',
  'assets/js/strategy-gemini-contract.js',
].map(read).join('\n');
for(const forbidden of ['ai-project-pool-runtime.js','applyPayload(','INSERT INTO pokemon(','UPDATE pokemon SET']){
  assert(!strategySources.includes(forbidden),`deterministic_strategy_forbidden_dependency:${forbidden}`);
}

console.log(JSON.stringify({
  status:'PASS',
  schema:'pokemon-sleep-v042-release-integration-contract/1.0',
  app_version:authority.app_version,
  build:authority.app_build,
  cache:authority.cache_name,
  active_recipe_count:PUBLIC_RECIPE_MASTER.length,
  upcoming_recipe_count:PUBLIC_RECIPE_UPCOMING_EVIDENCE.length,
  war_room_runtime_bootstraps:3,
  migration_version:8,
  offline_after_online_js_cache:true,
  direct_provider_apply:false,
},null,2));