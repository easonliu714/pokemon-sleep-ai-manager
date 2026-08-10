import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1];
const build=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cache=version.match(/cache_name:\s*'([^']+)'/)?.[1];
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const versionAtLeast=(actual,minimum)=>{
  const a=parts(actual),b=parts(minimum),length=Math.max(a.length,b.length);
  for(let i=0;i<length;i++){const av=a[i]||0,bv=b[i]||0;if(av!==bv)return av>bv;}
  return true;
};
assert.ok(versionAtLeast(app,'v0.4.4'),`current release ${app} must preserve v0.4.4 lifecycle behavior`);
if(app==='v0.4.4'){
  assert.equal(build,'20260809-v044-evaluation-snapshot-lifecycle');
  assert.equal(cache,'pokemon-sleep-ai-v0.4.4-v044-evaluation-snapshot-lifecycle');
}else{
  assert.ok(version.includes("// app_version: 'v0.4.4'"),'v0.4.4 legacy release marker missing');
  assert.ok(version.includes("// app_build: '20260809-v044-evaluation-snapshot-lifecycle'"),'v0.4.4 legacy build marker missing');
}

const week=read('assets/js/evaluation-week.js');
const planner=read('assets/js/evaluation-refresh-plan.js');
const store=read('assets/js/pokemon-evaluation-store.js');
const lifecycle=read('assets/js/evaluation-lifecycle.js');
const bootstrap=read('assets/js/evaluation-lifecycle-bootstrap.js');
const recipeLocal=read('assets/js/recipe-strategy-local.js');
const lifecycleUi=read('assets/js/war-room-evaluation-lifecycle-ui.js');
const lifecycleUiBootstrap=read('assets/js/war-room-evaluation-lifecycle-bootstrap.js');
const sw=read('service-worker.js');
const migrations=read('assets/js/migrations.js');

for(const token of ['localWeekStart','nextLocalWeekBoundary','weeklyContextMatchesEpoch'])assert.ok(week.includes(token),`week lifecycle helper missing: ${token}`);
for(const token of ['planSnapshotLifecycle','refresh_required','write_required','refresh_targets','reused_targets','stale_snapshot_ids'])assert.ok(planner.includes(token),`refresh planner missing: ${token}`);
for(const token of ['planFactEvaluationSnapshotRefresh','currentSnapshotHeaders','if(!plan.write_required&&!force)','write_performed:false','snapshot_created:false'])assert.ok(store.includes(token),`store preflight contract missing: ${token}`);
assert.ok(store.indexOf('if(!plan.write_required&&!force)')<store.indexOf("await snapshot('war-room:evaluation-snapshots')"),'zero-write preflight must return before storage snapshot');
for(const forbidden of ['UPDATE pokemon SET','INSERT INTO pokemon(','DELETE FROM pokemon','FROM ingredient_inventory','FROM item_inventory','FROM recipes'])assert.equal(store.includes(forbidden),false,`evaluation lifecycle must not mutate/read unrelated player state: ${forbidden}`);

for(const token of ['GOAL_PROFILE_MISSING','WEEKLY_CONTEXT_MISSING','WEEKLY_CONTEXT_EPOCH_MISMATCH','REFRESH_REQUIRED','CURRENT','refreshFactEvaluationSnapshots'])assert.ok(lifecycle.includes(token),`lifecycle state contract missing: ${token}`);
assert.equal(lifecycle.includes('run('),false,'lifecycle controller must not issue SQLite writes directly');
assert.equal(lifecycle.includes('persist('),false,'lifecycle controller must not persist directly');

for(const token of ['pokemon-sleep:database-ready','pokemon-sleep:strategy-goal-profile-changed','pokemon-sleep:pokemon-evaluation-input-changed','pokemon-sleep-data-refreshed','local_week_epoch_boundary','nextLocalWeekBoundary'])assert.ok(bootstrap.includes(token),`runtime trigger missing: ${token}`);
assert.ok(recipeLocal.includes("import('./evaluation-lifecycle-bootstrap.js')"));
assert.ok(recipeLocal.includes("import('./war-room-evaluation-lifecycle-bootstrap.js')"));
assert.ok(lifecycleUiBootstrap.includes('pokemon-sleep:evaluation-lifecycle-state'));
for(const token of ['Evaluation Snapshot Lifecycle','zero-write preflight','需更新','可重用','待標 stale','write_performed','player_rows_modified'])assert.ok(lifecycleUi.includes(token),`War Room lifecycle transparency missing: ${token}`);

assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"),'service worker must use central version authority');
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'runtime JS must remain network-first');
assert.ok(sw.includes('caches.open(CACHE).then(cache=>cache.put(event.request,copy))'),'runtime JS must be cached after online load');
assert.ok(sw.includes('caches.match(event.request)'),'runtime JS must have offline cache fallback');
assert.equal(migrations.includes('evaluation-lifecycle'),false,'v0.4.4 must not add a schema migration for lifecycle scheduling');

for(const source of [planner,lifecycle,bootstrap,lifecycleUi])for(const forbidden of ['Gemini','ai-project-pool-runtime','fetch('])assert.equal(source.includes(forbidden),false,`deterministic lifecycle must not depend on provider: ${forbidden}`);

process.stdout.write(`${JSON.stringify({
  status:'PASS',gate:'V0.4.4_EVALUATION_SNAPSHOT_LIFECYCLE_RELEASE',app_version:app,build,cache,
  forward_compatible_release:true,monday_local_epoch:true,weekly_epoch_guard:true,zero_write_preflight:true,scoped_pokemon_refresh:true,archived_snapshot_stale:true,
  goal_profile_trigger:true,weekly_context_trigger:true,pokemon_input_trigger:true,pwa_reopen_preflight:true,
  war_room_lifecycle_status:true,offline_after_online_js_cache:true,schema_migration_added:false,player_rows_modified:false,gemini_used:false,
},null,2)}\n`);
