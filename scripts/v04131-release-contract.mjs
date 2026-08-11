import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DATA_PRESERVATION_POLICY_VERSION,
  isObservedWriteValue,
  buildSparseObservedPatch,
} from '../assets/js/data-preservation-policy.js';
import {
  WEEKLY_OVERRIDE_REBASE_VERSION,
  computeWeeklyOverrideRebase,
} from '../assets/js/weekly-context-override-rebase.js';
import {WEEKLY_MANUAL_OVERRIDE_VERSION} from '../assets/js/weekly-context-manual-override.js';
import {buildUpdatePayload} from '../assets/js/identity-import-apply-operation.js';
import {RECIPE_PORTFOLIO_CONTENTION_VERSION} from '../assets/js/recipe-portfolio-contention.js';
import {RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION} from '../assets/js/recipe-unified-player-workbench.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.13.1');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04131-data-preservation-hotfix');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.13.1-v04131-data-preservation-hotfix');
assert.ok(version.includes("// app_version: 'v0.4.13'"),'v0.4.13 predecessor bridge must remain');
assert.ok(version.includes("// app_build: '20260811-v0413-g7-recipe-portfolio-contention'"));

assert.equal(DATA_PRESERVATION_POLICY_VERSION,'data-preservation-policy-2026-08-11-a');
assert.equal(WEEKLY_OVERRIDE_REBASE_VERSION,'weekly-override-rebase-2026-08-11-a');
assert.equal(WEEKLY_MANUAL_OVERRIDE_VERSION,'weekly-manual-override-2026-08-11-b-data-preservation');
assert.equal(RECIPE_PORTFOLIO_CONTENTION_VERSION,'recipe-portfolio-contention-2026-08-11-a');
assert.equal(RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION,'recipe-unified-player-workbench-2026-08-11-a');

for(const value of [null,undefined,'','   '])assert.equal(isObservedWriteValue(value),false);
for(const value of [0,false])assert.equal(isObservedWriteValue(value),true);
assert.deepEqual(buildSparseObservedPatch({quantity:null,safe_reserve:0,unlocked:false,label:''},[]),{safe_reserve:0,unlocked:false});
assert.deepEqual(buildSparseObservedPatch({quantity:null},['quantity']),{quantity:null});

const manual={
  schema:'weekly-context-manual-override/1.0',week_start:'2026-08-10',based_on_import_revision:'UPD-A',
  fields:{pot_size:57,dish_category:'咖哩／濃湯',favorite_berry_1:'橙橙果',favorite_berry_2:'桃桃果',favorite_berry_3:'萄葡果'},
  updated_at:'2026-08-11T00:00:00+08:00',
};
const carried=computeWeeklyOverrideRebase({record:manual,newImportRevision:'UPD-B',incomingData:{pot_size:null,dish_category:'沙拉'},previousCamp:'萌綠之島'});
assert.equal(carried.action,'upsert');
assert.equal(carried.record.based_on_import_revision,'UPD-B');
assert.equal(carried.record.fields.pot_size,57,'null Weekly observation must not erase pot_size 57');
assert.equal('dish_category' in carried.record.fields,false,'observed replacement supersedes old override');
const cleared=computeWeeklyOverrideRebase({record:{...manual,fields:{pot_size:57}},newImportRevision:'UPD-C',incomingData:{pot_size:null},clearFields:['pot_size'],previousCamp:'萌綠之島'});
assert.equal(cleared.action,'delete','explicit clear must remove the retained manual value');
const campChanged=computeWeeklyOverrideRebase({record:manual,newImportRevision:'UPD-D',incomingData:{camp:'天青沙灘',pot_size:null},previousCamp:'萌綠之島'});
assert.equal(campChanged.camp_changed,true);
assert.equal(campChanged.record.fields.pot_size,57);
for(const field of ['favorite_berry_1','favorite_berry_2','favorite_berry_3'])assert.equal(field in campChanged.record.fields,false);

const pokemonPatch=buildUpdatePayload(
  {action:'accept_existing',pokemon_instance_id:'inst-1'},
  {profile:{nickname:null,level:null,sp:0,nature:'',main_skill_level:0,helper_seconds:false},identity:{current_species_id:null},progression:{sleep_hours_with_helper:null}},
  {nickname:'既有',level:50,sp:1500,nature:'固執',main_skill_level:6,helper_seconds:2400,sleep_hours_with_helper:100},
);
assert.deepEqual(pokemonPatch,{sp:0,main_skill_level:0,helper_seconds:false});

const importer=read('assets/js/importer.js');
assert.ok(importer.includes('buildSparseObservedPatch'));
assert.ok(importer.includes('rebaseWeeklyManualOverrideForImport'));
assert.ok(importer.includes("null_overwrite_policy:'preserve_existing_unless_clear_fields'"));
assert.ok(importer.includes('explicit_zero_and_false_are_values:true'));
const ucImg=read('assets/js/unified-screenshot-update-center.js');
assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1,'UC.IMG must retain one Apply bridge');
const recognition=read('assets/js/public-master-recognition.js');
assert.ok(recognition.includes('hasOwn(observation.observed_data,field)&&meaningful(observation.observed_data[field])'));
const sw=read('service-worker.js');
for(const asset of ['data-preservation-policy.js','weekly-context-override-rebase.js','weekly-context-manual-override.js'])assert.ok(sw.includes(`'./assets/js/${asset}'`),`offline precache missing ${asset}`);
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.13.1 must remain migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.13.1_RELEASE_CONTRACT',app_version:'v0.4.13.1',
  null_missing_blank_noop:true,explicit_zero_false_values:true,explicit_clear_only:true,
  weekly_field_level_rebase:true,pot_size_57_preserved:true,camp_change_berry_invalidation:true,
  pokemon_observation_sparse_update:true,public_master_recognition_sparse_compile:true,
  snapshot_transaction_apply_boundary_preserved:true,uc_img_apply_bridge_count:1,
  offline_precache:true,sqlite_migration_added:false,
  predecessor_g7_planner_version:RECIPE_PORTFOLIO_CONTENTION_VERSION,
  predecessor_recipe_workbench_version:RECIPE_UNIFIED_PLAYER_WORKBENCH_VERSION,
},null,2));
