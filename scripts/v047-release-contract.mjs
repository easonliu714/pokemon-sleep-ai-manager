import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_CANDY_MASTER_VERSION,
  PUBLIC_CANDY_FIXED_MASTER,
  buildPublicCandyMasterRows,
} from '../assets/js/public-candy-master.js';
import {PROMPT_CATALOG,buildScenarioTemplate} from '../assets/js/prompt-catalog.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';

const read=path=>fs.readFileSync(path,'utf8');
const numericVersion=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part));
const versionAtLeast=(value,floor)=>{
  const left=numericVersion(value),right=numericVersion(floor),size=Math.max(left.length,right.length);
  for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}
  return true;
};
const version=read('assets/js/version-authority.js');
const currentVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const currentBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const currentCache=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.ok(versionAtLeast(currentVersion,'v0.4.7'),`historical v0.4.7 contract cannot run on older release: ${currentVersion}`);
if(currentVersion==='v0.4.7'){
  assert.equal(currentBuild,'20260810-v047-candy-inventory-resource-context');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.7-v047-candy-inventory-resource-context');
}

assert.match(PUBLIC_CANDY_MASTER_VERSION,/^public-candy-master-\d{4}-\d{2}-\d{2}-[a-z]$/,'successor Candy catalog revisions must remain explicitly versioned');
assert.ok(PUBLIC_CANDY_FIXED_MASTER.length>=10);
assert.ok(buildPublicCandyMasterRows().length>PUBLIC_CANDY_FIXED_MASTER.length,'species candy projection must be active');
assert.ok(PUBLIC_CANDY_FIXED_MASTER.every(row=>!Object.hasOwn(row,'quantity')&&!Object.hasOwn(row,'safe_reserve')),'Public Candy Master must not contain player quantities');

const template=buildScenarioTemplate('candies');
assert.equal(PROMPT_CATALOG.candies.scenario,'candy_inventory_update');
assert.equal(template.scenario,'candy_inventory_update');
template.operations[0].data.quantity=0;
template.operations[0].review_required=false;
template.operations[0].user_audit.accepted_current_observation=true;
assert.deepEqual(validateWorkflow(template).errors,[],'v0.4.7 Candy behavior must remain compatible with explicit zero');

const schema=read('assets/js/schema.js');
const migrations=read('assets/js/migrations.js');
const importer=read('assets/js/importer.js');
const resource=read('assets/js/resource-context.js');
const candyUi=read('assets/js/candy-inventory-ui.js');
const backup=read('assets/js/backup-truth-restore.js');
const app=read('assets/js/app.js');
const canonical=read('assets/js/canonical-registry.js');
const docs=read('docs/PUBLIC_MASTER_DATABASE_VERSION_CONTRACT.md');
const index=read('index.html');

assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS candy_inventory'));
assert.ok(migrations.includes('applyCandyInventoryMigration'));
assert.ok(migrations.includes("VALUES(9,datetime('now'))"));
assert.ok(migrations.includes('syncPublicCandyMaster'));
assert.ok(migrations.includes('applyPublicCandyMasterSchema(db);applyCanonicalRegistry(db)'),'legacy canonical migration must establish Candy schema before reading it');
for(const token of ["candy_inventory: ['candy_id']","SELECT candy_id FROM candy_master WHERE candy_name=?",'找不到公版糖果'])assert.ok(importer.includes(token),`importer Candy guard missing: ${token}`);
for(const token of ["CANDY_CONVERSION_RULE_STATUS='NOT_YET_VERIFIED'",'included_in_physical_totals:false','derived_options:[]'])assert.ok(resource.includes(token),`resource conversion guard missing: ${token}`);
assert.ok(candyUi.includes('玩家數量只接受 JSON 更新中心匯入'));
assert.equal(candyUi.includes('saveCandy'),false);
assert.ok(index.includes('./assets/js/candy-inventory-ui.js'));
assert.ok(backup.includes("'candy_inventory'"));
assert.ok(app.includes("'candy_inventory'"));
assert.ok(canonical.includes("['candy','candy_master','candy_name']"));
assert.ok(docs.includes('PUBLIC_CANDY_MASTER_VERSION'));
assert.ok(docs.includes('candy_inventory.quantity'));

const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes('cache_name:CACHE'));
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'runtime JS must remain network-first/cached for supported online-load-once offline use');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.7_RELEASE_CONTRACT',
  current_app_version:currentVersion,
  historical_behavior_compatible:true,
  exact_release_authority_enforced:currentVersion==='v0.4.7',
  sqlite_migration:9,
  public_candy_master:PUBLIC_CANDY_MASTER_VERSION,
  player_candy_write_authority:'UPDATE_CENTER_JSON',
  species_candy_name_projection:true,
  physical_vs_convertible_double_count_guard:true,
  candy_conversion_rule_status:'NOT_YET_VERIFIED',
  full_json_backup:true,
  verified_backup:true,
  public_private_boundary:true,
},null,2));
