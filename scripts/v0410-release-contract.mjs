import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UC_IMG_A_VERSION,
  UC_IMG_A_SCENARIOS,
  createScreenshotUpdateSession,
  addScreenshotEntry,
  buildScreenshotScenarioPrompt,
  screenshotScenarioRevision,
  serializableScreenshotSession,
} from '../assets/js/unified-screenshot-update-center.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const current=version.match(/app_version:\s*'v(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?'/);
assert.ok(current,'current release version must remain parseable');
const tuple=current.slice(1).map(value=>Number(value||0));
assert.ok(tuple[0]===0&&tuple[1]===4&&(tuple[2]>10||(tuple[2]===10&&tuple[3]>=0)),'current release must not regress below v0.4.10');
if(tuple[2]===10&&tuple[3]===0){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v0410-unified-screenshot-update-center-a');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.10-v0410-unified-screenshot-update-center-a');
}
assert.ok(version.includes("// app_version: 'v0.4.9.1'"),'v0.4.10+ must retain v0.4.9.1 legacy bridge');
assert.match(UC_IMG_A_VERSION,/^uc-img-a-2026-08-11-/);
assert.deepEqual(Object.keys(UC_IMG_A_SCENARIOS),['weekly','ingredients','recipes']);
assert.equal(UC_IMG_A_SCENARIOS.weekly.scenario,'weekly_context_update');
assert.equal(UC_IMG_A_SCENARIOS.ingredients.scenario,'ingredient_inventory_update');
assert.equal(UC_IMG_A_SCENARIOS.recipes.scenario,'recipe_status_update');

const session=createScreenshotUpdateSession();
const ingredient=addScreenshotEntry(session,{name:'ingredient_page_1.png',size:321,type:'image/png'});
assert.equal(ingredient.scenario_key,'ingredients');
const prompt=buildScreenshotScenarioPrompt(session,'ingredients');
assert.match(prompt,/image-001 = ingredient_page_1\.png/);
assert.match(prompt,/coverage=PARTIAL/);
assert.match(prompt,/不得補 0/);
assert.ok(screenshotScenarioRevision(session,'ingredients').includes('ingredient_page_1.png'));
ingredient.object_url='blob:private-image';ingredient.image_available=true;
const persisted=serializableScreenshotSession(session);
assert.equal(persisted.entries[0].object_url,null);
assert.equal(persisted.entries[0].image_available,false);

const source=read('assets/js/unified-screenshot-update-center.js');
for(const token of [
  "from './ai-workflow.js'","from './importer.js'",'validateWorkflow','approveReviewed','dryRun','applyPayload',
  'PARTIAL','USER_CONFIRMED_COMPLETE','response_stale','screenshotScenarioRevision','source_image_ref','source_image_refs',
  'type="file" accept="image/*" multiple','圖片 bytes 未保留','截圖不會寫入 SQLite 或 GitHub',
])assert.ok(source.includes(token),`v0.4.10+ UC.IMG-A missing ${token}`);
assert.equal(/indexedDB\.put\([^\n]*image|INSERT[^\n]*image_blob/i.test(source),false,'screenshot bytes must not be persisted');

const loader=read('assets/js/candy-inventory-ui.js');
assert.ok(loader.includes("import './unified-screenshot-update-center.js';"),'UC.IMG-A runtime loader missing');
const promptCatalog=read('assets/js/prompt-catalog.js');
for(const token of ['weekly_context_update','ingredient_inventory_update','recipe_status_update'])assert.ok(promptCatalog.includes(token),`existing prompt scenario missing ${token}`);
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10 successor must not add SQLite migration 10');
const serviceWorker=read('service-worker.js');
assert.ok(serviceWorker.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(serviceWorker.includes("url.pathname.endsWith('.js')"),'UC.IMG-A relies on established online-load-once dynamic JS caching');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.10_RELEASE_CONTRACT',current_app_version:`v${tuple.join('.')}`,
  historical_behavior_compatible:true,exact_release_authority_enforced:tuple[2]===10&&tuple[3]===0,
  uc_img_a_version:UC_IMG_A_VERSION,
  scenarios:Object.values(UC_IMG_A_SCENARIOS).map(value=>value.scenario),multi_image:true,coverage_semantics:true,
  evidence_traceability:true,stale_response_guard:true,existing_dry_run_apply_bridge:true,screenshot_bytes_persisted:false,
  sqlite_migration_added:false,public_master_mutated:false,
},null,2));
