import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION} from '../assets/js/public-recipe-canonical-authority.js';
import {buildRecipeUnifiedWorkbenchProjection,RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION} from '../assets/js/recipe-unified-player-workbench.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.11.4','v0.4.12','v0.4.13'].includes(appVersion),`unexpected v0.4.12 successor authority: ${appVersion}`);
if(appVersion==='v0.4.11.4'){
  assert.equal(appBuild,'20260811-v04114-recipe-zh-tw-diagnostic-export','behavior-first stage must remain on v0.4.11.4 before v0.4.12 release promotion');
}else if(appVersion==='v0.4.12'){
  assert.equal(appBuild,'20260811-v0412-recipe-unified-player-workbench');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.12-v0412-recipe-unified-player-workbench');
  assert.ok(version.includes("// app_version: 'v0.4.11.4'"),'v0.4.12 must retain v0.4.11.4 legacy bridge');
}else{
  assert.equal(appBuild,'20260811-v0413-g7-recipe-portfolio-contention');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.13-v0413-g7-recipe-portfolio-contention');
  assert.ok(version.includes("// app_version: 'v0.4.12'"),'v0.4.13 must retain v0.4.12 legacy bridge');
  assert.ok(version.includes("// app_build: '20260811-v0412-recipe-unified-player-workbench'"));
}
assert.ok(version.includes("// app_build: '20260811-v04114-recipe-zh-tw-diagnostic-export'"));
assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-11-c');
assert.equal(PUBLIC_RECIPE_MASTER.length,76);
assert.equal(RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION,'recipe-unified-player-workbench-2026-08-11-a');

const curryIds=PUBLIC_RECIPE_MASTER.filter(row=>row.category==='咖哩／濃湯').slice(0,13).map(row=>row.recipe_id);
assert.equal(curryIds.length,13,'fixture needs 13 unlocked curry recipes');
const unlockedSet=new Set(curryIds);
const catalogRows=PUBLIC_RECIPE_MASTER.map(row=>({...row,unlocked:unlockedSet.has(row.recipe_id)?1:0,recipe_level:unlockedSet.has(row.recipe_id)?20:null,current_energy:unlockedSet.has(row.recipe_id)?1000:null}));
const inventory=[];
const week={week_start:'2026-08-10',dish_category:'咖哩／濃湯',authority_source:'UPDATE_CENTER_JSON',authority_update_id:'UPD-V0412-FIXTURE'};
const projection=buildRecipeUnifiedWorkbenchProjection({catalogRows,inventory,week});
assert.equal(projection.total_count,76);
assert.equal(projection.unlocked_count,13);
assert.equal(projection.locked_count,63);
assert.equal(projection.partition_complete,true);
assert.deepEqual(projection.duplicate_recipe_ids,[]);
assert.equal(new Set([...projection.unlocked,...projection.locked].map(row=>row.recipe_id)).size,76,'each canonical recipe_id must appear in exactly one section');
assert.ok(projection.unlocked.every(row=>Number(row.unlocked)===1));
assert.ok(projection.locked.every(row=>Number(row.unlocked)!==1));
assert.equal(projection.unlocked.filter(row=>row.weekly_recommended).length,3,'unlocked workbench keeps top-3 weekly recommendation semantics');
assert.equal(projection.locked.filter(row=>row.weekly_recommended).length,3,'locked reference section keeps top-3 weekly recommendation semantics');
assert.equal(projection.dish_category,'咖哩／濃湯');
assert.equal(projection.authority_source,'UPDATE_CENTER_JSON');

const workbench=read('assets/js/recipe-unified-player-workbench.js');
for(const token of [
  "from './public-recipe-canonical-authority.js'",
  "from './ingredient-gap-engine.js'",
  "from './weekly-context-store.js'",
  'currentWeeklyContext()',
  'analyzeIngredientGaps',
  'recipeWeeklyAuthoritySummary',
  'lockedRecipeTable',
  'weekly-recommended',
  "snapshot(`manual:recipe:${playerRecipeId}`)",
  'INSERT INTO recipes',
  'INSERT INTO import_batches',
  'INSERT INTO import_changes',
  "'manual_frontend_edit'",
  'draftById',
])assert.ok(workbench.includes(token),`unified recipe workbench missing behavior token: ${token}`);
assert.ok(workbench.includes('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json)'),'manual recipe audit must retain import_batches source column');
for(const forbidden of ['INSERT INTO recipe_master','UPDATE recipe_master','DELETE FROM recipe_master','applyPayload(','dryRun(','Gemini','fetch('])assert.equal(workbench.includes(forbidden),false,`recipe workbench owns forbidden authority/path: ${forbidden}`);

const publicCatalog=read('assets/js/public-catalog-workbench.js');
assert.ok(publicCatalog.includes("from './recipe-unified-player-workbench.js'"));
assert.ok(publicCatalog.includes('renderRecipeUnifiedWorkbench()'));
assert.equal(publicCatalog.includes('async function saveRecipeState'),false,'legacy parallel recipe writer must be retired');
assert.equal(publicCatalog.includes('INSERT INTO recipes'),false,'public catalog shell must delegate recipe writes to the single recipe workbench owner');

const shared=read('assets/js/shared-knowledge-ui.js');
assert.equal(shared.includes('personalRecipeAnalysisTable'),false,'duplicate unlocked analysis table must be retired');
assert.equal(shared.includes('referenceRecipeTable'),false,'locked recipe rendering must move to unified workbench');
assert.ok(shared.includes("document.getElementById('sharedKnowledgeBlock')?.remove()"),'legacy duplicate block must be cleaned if restored from an old DOM');

const css=read('assets/css/editor.css');
for(const token of ['.recipe-workbench-wrap','overflow-x:auto','min-width:900px','.recipe-formula-cell','.recipe-shortage-cell'])assert.ok(css.includes(token),`Android containment token missing: ${token}`);
const sw=read('service-worker.js');
assert.ok(sw.includes("'./assets/js/recipe-unified-player-workbench.js'"),'unified recipe workbench must be precached for first-offline Recipe access');

const ucImg=read('assets/js/unified-screenshot-update-center.js');
assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1,'UC.IMG must retain exactly one Apply bridge');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.12 Recipe Workbench lineage must remain schema-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0412_RECIPE_UNIFIED_PLAYER_WORKBENCH_BEHAVIOR',
  app_version:appVersion,
  v0412_or_successor:['v0.4.12','v0.4.13'].includes(appVersion),
  workbench_version:RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION,
  canonical_recipe_count:PUBLIC_RECIPE_MASTER.length,
  synthetic_unlocked_count:projection.unlocked_count,
  synthetic_locked_count:projection.locked_count,
  duplicate_recipe_ids:projection.duplicate_recipe_ids,
  unified_unlocked_table:true,
  separate_locked_table:true,
  weekly_recommendation_in_unified_rows:true,
  deterministic_shortage_analysis:true,
  public_master_read_only:true,
  player_recipe_writer_single_owner:true,
  unrelated_draft_inputs_preserved:true,
  android_horizontal_containment:true,
  first_offline_recipe_module_precached:true,
  sqlite_migration_added:false,
  uc_img_apply_bridge_count:1,
},null,2));
