import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {planSnapshotLifecycle,EVALUATION_REFRESH_PLAN_VERSION} from '../assets/js/evaluation-refresh-plan.js';
import {localWeekStart,nextLocalWeekBoundary,EVALUATION_WEEK_VERSION} from '../assets/js/evaluation-week.js';

const __filename=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(__filename),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

assert.equal(EVALUATION_REFRESH_PLAN_VERSION,'evaluation-refresh-plan-2026-08-09-a');
assert.equal(EVALUATION_WEEK_VERSION,'evaluation-week-2026-08-09-b');
const sunday=new Date(2026,7,9,21,50,0,0),monday=new Date(2026,7,10,0,0,0,0);
assert.equal(localWeekStart(sunday),'2026-08-03');
assert.equal(localWeekStart(monday),'2026-08-10');
const boundary=nextLocalWeekBoundary(sunday);
assert.equal(boundary.getFullYear(),2026);assert.equal(boundary.getMonth(),7);assert.equal(boundary.getDate(),10);assert.equal(boundary.getHours(),0);

const targets=[{pokemon_id:'p1',input_fingerprint:'fp:a'},{pokemon_id:'p2',input_fingerprint:'fp:b'}];
const current=[{evaluation_id:'e1',pokemon_id:'p1',input_fingerprint:'fp:a'},{evaluation_id:'e2',pokemon_id:'p2',input_fingerprint:'fp:b'}];
const clean=planSnapshotLifecycle({targets,currentSnapshots:current});
assert.equal(clean.refresh_required,false);assert.equal(clean.write_required,false);assert.equal(clean.refresh_count,0);assert.equal(clean.reused_count,2);assert.equal(clean.stale_count,0);

const changed=planSnapshotLifecycle({targets:[targets[0],{pokemon_id:'p2',input_fingerprint:'fp:c'}],currentSnapshots:current});
assert.equal(changed.refresh_required,true);assert.equal(changed.write_required,true);assert.equal(changed.refresh_count,1);assert.equal(changed.reused_count,1);assert.deepEqual([...changed.stale_snapshot_ids],['e2']);

const added=planSnapshotLifecycle({targets:[...targets,{pokemon_id:'p3',input_fingerprint:'fp:new'}],currentSnapshots:current});
assert.equal(added.refresh_count,1);assert.equal(added.reused_count,2);assert.equal(added.stale_count,0);

const archived=planSnapshotLifecycle({targets:[targets[0]],currentSnapshots:current});
assert.equal(archived.refresh_count,0);assert.equal(archived.reused_count,1);assert.deepEqual([...archived.stale_snapshot_ids],['e2']);assert.equal(archived.write_required,true);

// Store-scoped lifecycle semantics: a one-Pokémon refresh must receive only that Pokémon's
// current snapshot headers. Unrelated snapshots cannot be interpreted as absent targets.
const scopedUnchanged=planSnapshotLifecycle({
  targets:[{pokemon_id:'p1',input_fingerprint:'fp:a'}],
  currentSnapshots:[{evaluation_id:'e1',pokemon_id:'p1',input_fingerprint:'fp:a'}],
});
assert.equal(scopedUnchanged.write_required,false);
assert.equal(scopedUnchanged.reused_count,1);
assert.deepEqual([...scopedUnchanged.stale_snapshot_ids],[]);

const scopedChanged=planSnapshotLifecycle({
  targets:[{pokemon_id:'p1',input_fingerprint:'fp:new-a'}],
  currentSnapshots:[{evaluation_id:'e1',pokemon_id:'p1',input_fingerprint:'fp:a'}],
});
assert.equal(scopedChanged.refresh_count,1);
assert.deepEqual([...scopedChanged.stale_snapshot_ids],['e1']);

const scopedArchived=planSnapshotLifecycle({
  targets:[],
  currentSnapshots:[{evaluation_id:'e2',pokemon_id:'p2',input_fingerprint:'fp:b'}],
});
assert.equal(scopedArchived.refresh_count,0);
assert.deepEqual([...scopedArchived.stale_snapshot_ids],['e2']);

const forced=planSnapshotLifecycle({targets,currentSnapshots:current,force:true});
assert.equal(forced.refresh_count,2);assert.equal(forced.reused_count,0);assert.equal(forced.write_required,true);

const store=read('assets/js/pokemon-evaluation-store.js');
const lifecycle=read('assets/js/evaluation-lifecycle.js');
const bootstrap=read('assets/js/evaluation-lifecycle-bootstrap.js');
const recipeLocal=read('assets/js/recipe-strategy-local.js');
const manual=read('assets/js/manual-editor.js');
const lifecycleUi=read('assets/js/war-room-evaluation-lifecycle-ui.js');
const lifecycleUiBootstrap=read('assets/js/war-room-evaluation-lifecycle-bootstrap.js');

for(const token of ['planFactEvaluationSnapshotRefresh','planSnapshotLifecycle','write_performed:false','snapshot_created:false','if(!plan.write_required&&!force)','stale_snapshot_ids'])assert.ok(store.includes(token),`snapshot zero-write/preflight contract missing: ${token}`);
assert.ok(store.indexOf('if(!plan.write_required&&!force)')<store.indexOf("await snapshot('war-room:evaluation-snapshots')"),'zero-write return must precede snapshot creation');
for(const forbidden of ['FROM ingredient_inventory','FROM item_inventory','FROM recipes'])assert.equal(store.includes(forbidden),false,`unrelated inventory/player recipe state must not enter evaluation fingerprint: ${forbidden}`);

// Lock the scoped-store contract that prevents a targeted Pokémon change from staling
// every unrelated current evaluation snapshot.
for(const token of [
  'function requestedPokemonIds(pokemonIds=null)',
  'function activePokemonIds(pokemonIds=null)',
  'function currentSnapshotHeaders(pokemonIds=null)',
  "WHERE pokemon_id=? AND status='active' LIMIT 1",
  'WHERE pokemon_id=? AND stale_at IS NULL ORDER BY evaluated_at DESC',
  'const current=currentSnapshotHeaders(pokemonIds);',
])assert.ok(store.includes(token),`scoped snapshot-store contract missing: ${token}`);
assert.ok(store.indexOf('const requested=requestedPokemonIds(pokemonIds);')>=0,'explicit scoped request must be resolved before active-target selection');
assert.ok(store.indexOf('const current=currentSnapshotHeaders(pokemonIds);')>store.indexOf('function currentSnapshotHeaders(pokemonIds=null)'),'refresh planner must consume scoped current snapshot headers');

for(const token of ['WEEKLY_CONTEXT_EPOCH_MISMATCH','GOAL_PROFILE_MISSING','weeklyContextMatchesEpoch','planFactEvaluationSnapshotRefresh','refreshFactEvaluationSnapshots'])assert.ok(lifecycle.includes(token),`lifecycle contract missing: ${token}`);
assert.equal(lifecycle.includes('run('),false,'lifecycle controller must not write SQLite directly');
assert.equal(lifecycle.includes('persist('),false,'lifecycle controller must delegate controlled writes to snapshot store');

for(const token of ['pokemon-sleep:database-ready','pokemon-sleep:strategy-goal-profile-changed','pokemon-sleep:pokemon-evaluation-input-changed','pokemon-sleep-data-refreshed','local_week_epoch_boundary','nextLocalWeekBoundary'])assert.ok(bootstrap.includes(token),`runtime lifecycle trigger missing: ${token}`);
assert.ok(bootstrap.includes('refreshEvaluationLifecycle'),'bootstrap must route triggers through lifecycle preflight');
assert.ok(recipeLocal.includes("import('./evaluation-lifecycle-bootstrap.js')"));
assert.ok(recipeLocal.includes("import('./war-room-evaluation-lifecycle-bootstrap.js')"));

assert.equal((manual.match(/emitPokemonEvaluationInputChanged\(/g)||[]).length,2,'targeted Pokémon lifecycle signal must have one helper and one call');
assert.ok(manual.indexOf("emitPokemonEvaluationInputChanged(id,'manual_pokemon_edit')")>manual.indexOf('export async function savePokemonDetail'),'Pokémon signal must occur only after Pokémon save path');
assert.equal(manual.slice(manual.indexOf('export async function saveIngredient'),manual.indexOf('export async function savePokemonDetail')).includes('emitPokemonEvaluationInputChanged('),false,'ingredient/item edits must not trigger Pokémon evaluation refresh');

for(const token of ['zero-write preflight','WEEKLY_CONTEXT_EPOCH_MISMATCH','write_performed','player_rows_modified'])assert.ok(lifecycleUi.includes(token),`lifecycle UI transparency missing: ${token}`);
assert.ok(lifecycleUiBootstrap.includes('pokemon-sleep:evaluation-lifecycle-state'));
for(const forbidden of ['Gemini','fetch(','ai-project-pool-runtime'])assert.equal(`${lifecycle}\n${bootstrap}\n${lifecycleUi}`.includes(forbidden),false,`lifecycle must remain local deterministic: ${forbidden}`);

process.stdout.write(`${JSON.stringify({
  status:'PASS',gate:'WAR.1C_EVALUATION_SNAPSHOT_LIFECYCLE',evaluation_refresh_plan_version:EVALUATION_REFRESH_PLAN_VERSION,evaluation_week_version:EVALUATION_WEEK_VERSION,
  sunday_epoch:'2026-08-03',monday_epoch:'2026-08-10',next_monday_boundary:true,clean_preflight_write:false,changed_scope_refresh_count:changed.refresh_count,
  unrelated_target_reused:changed.reused_count,scoped_unchanged_write:false,scoped_changed_refresh_count:scopedChanged.refresh_count,
  scoped_archived_stale_count:scopedArchived.stale_count,unrelated_scoped_snapshots_touched:false,archived_snapshot_staled:true,force_refresh_explicit:true,
  goal_profile_trigger:true,weekly_context_trigger:true,pokemon_scoped_trigger:true,generic_refresh_preflight:true,
  ingredient_item_do_not_trigger_pokemon_evaluation:true,player_rows_modified:false,gemini_used:false,
},null,2)}\n`);
