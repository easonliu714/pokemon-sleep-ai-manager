import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION} from '../assets/js/public-recipe-canonical-authority.js';
import {buildRecipeUnifiedWorkbenchProjection,RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION} from '../assets/js/recipe-unified-player-workbench.js';
import {PUBLIC_MASTER_RECOGNITION_VERSION} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.equal(appVersion,'v0.4.12');
assert.equal(appBuild,'20260811-v0412-recipe-unified-player-workbench');
assert.equal(cacheName,'pokemon-sleep-ai-v0.4.12-v0412-recipe-unified-player-workbench');
assert.ok(version.includes("// app_version: 'v0.4.11.4'"),'v0.4.12 must retain v0.4.11.4 legacy bridge');
assert.ok(version.includes("// app_build: '20260811-v04114-recipe-zh-tw-diagnostic-export'"));

assert.equal(RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION,'recipe-unified-player-workbench-2026-08-11-a');
assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-11-c');
assert.equal(PUBLIC_MASTER_RECOGNITION_VERSION,'public-master-recognition-2026-08-11-b-recipe-canonical');
assert.equal(PUBLIC_RECIPE_MASTER.length,76);

const unlockedIds=new Set(PUBLIC_RECIPE_MASTER.filter(row=>row.category==='咖哩／濃湯').slice(0,13).map(row=>row.recipe_id));
const catalogRows=PUBLIC_RECIPE_MASTER.map(row=>({...row,unlocked:unlockedIds.has(row.recipe_id)?1:0,recipe_level:unlockedIds.has(row.recipe_id)?20:null,current_energy:unlockedIds.has(row.recipe_id)?1000:null}));
const projection=buildRecipeUnifiedWorkbenchProjection({catalogRows,inventory:[],week:{week_start:'2026-08-10',dish_category:'咖哩／濃湯',authority_source:'UPDATE_CENTER_JSON',authority_update_id:'UPD-RELEASE'}});
assert.equal(projection.partition_complete,true);
assert.equal(projection.total_count,76);
assert.equal(projection.unlocked_count,13);
assert.equal(projection.locked_count,63);
assert.deepEqual(projection.duplicate_recipe_ids,[]);
assert.equal(new Set([...projection.unlocked,...projection.locked].map(row=>row.recipe_id)).size,76);
assert.equal(projection.unlocked.filter(row=>row.weekly_recommended).length,3);
assert.equal(projection.locked.filter(row=>row.weekly_recommended).length,3);

const workbench=read('assets/js/recipe-unified-player-workbench.js');
for(const token of [
  "from './public-recipe-canonical-authority.js'",
  "from './ingredient-gap-engine.js'",
  "from './weekly-context-store.js'",
  "SELECT * FROM recipe_catalog_state",
  "document.getElementById('recipeTable')",
  'lockedRecipeTable',
  'recipeWeeklyAuthoritySummary',
  'draftById',
  "snapshot(`manual:recipe:${playerRecipeId}`)",
  'INSERT INTO recipes',
  'INSERT INTO import_batches',
  'INSERT INTO import_changes',
])assert.ok(workbench.includes(token),`release workbench token missing: ${token}`);
assert.equal((workbench.match(/INSERT INTO recipes/g)||[]).length,1,'one player Recipe writer owner expected');
for(const forbidden of ['INSERT INTO recipe_master','UPDATE recipe_master','DELETE FROM recipe_master','applyPayload(','dryRun(','Gemini','fetch('])assert.equal(workbench.includes(forbidden),false,`release workbench owns forbidden path: ${forbidden}`);

const shell=read('assets/js/public-catalog-workbench.js');
assert.ok(shell.includes("from './recipe-unified-player-workbench.js'"));
assert.ok(shell.includes('renderRecipeUnifiedWorkbench()'));
assert.equal(shell.includes('INSERT INTO recipes'),false,'catalog shell must not own parallel Recipe writer');
const shared=read('assets/js/shared-knowledge-ui.js');
assert.equal(shared.includes('personalRecipeAnalysisTable'),false);
assert.equal(shared.includes('referenceRecipeTable'),false);
assert.ok(shared.includes("document.getElementById('sharedKnowledgeBlock')?.remove()"));

const sw=read('service-worker.js');
assert.ok(sw.includes("'./assets/js/recipe-unified-player-workbench.js'"),'Recipe workbench must be precached');
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'runtime JS must remain network-first with offline fallback');
const css=read('assets/css/editor.css');
for(const token of ['.recipe-workbench-wrap','overflow-x:auto','min-width:900px','.recipe-formula-cell','.recipe-shortage-cell'])assert.ok(css.includes(token),`mobile containment missing: ${token}`);

const ucImg=read('assets/js/unified-screenshot-update-center.js');
assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1,'v0.4.12 must retain one UC.IMG Apply bridge');
const recognition=read('assets/js/public-master-recognition.js');
assert.ok(recognition.includes("from './public-recipe-canonical-authority.js'"));
assert.equal(recognition.includes("from './public-recipe-master.js'"),false);
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.12 must remain SQLite-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.12_RELEASE_CONTRACT',
  app_version:appVersion,app_build:appBuild,cache_name:cacheName,
  workbench_version:RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION,
  canonical_recipe_count:PUBLIC_RECIPE_MASTER.length,
  recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  unified_unlocked_workbench:true,
  separate_locked_section:true,
  full_recipe_partition:true,
  duplicate_recipe_ids:false,
  weekly_recommendation_integrated:true,
  deterministic_shortage_integrated:true,
  player_recipe_writer_count:1,
  public_master_player_state_write:false,
  duplicate_shared_recipe_renderer:false,
  android_horizontal_containment:true,
  first_offline_recipe_module_precached:true,
  sqlite_migration_added:false,
  uc_img_apply_bridge_count:1,
},null,2));
