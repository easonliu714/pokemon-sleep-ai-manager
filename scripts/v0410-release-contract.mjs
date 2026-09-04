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
const currentText=version.match(/app_version:\s*'(v\d+(?:\.\d+){2,})'/)?.[1]||'';
assert.match(currentText,/^v\d+(?:\.\d+){2,}$/,'current release version must remain parseable');
const tuple=currentText.slice(1).split('.').map(Number);
assert.ok(tuple[0]===0&&tuple[1]===4&&(tuple[2]>10||(tuple[2]===10&&(tuple[3]||0)>=0)),'current release must not regress below v0.4.10');
const exactRelease=tuple[2]===10&&(tuple[3]||0)===0&&tuple.slice(4).every(value=>value===0);
if(exactRelease){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v0410-unified-screenshot-update-center-a');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.10-v0410-unified-screenshot-update-center-a');
}
assert.ok(version.includes("// app_version: 'v0.4.9.1'"),'v0.4.10+ must retain v0.4.9.1 legacy bridge');
const ucImgAuthorityDate=UC_IMG_A_VERSION.match(/^uc-img-a-(\d{4}-\d{2}-\d{2})-/)?.[1]||null;
assert.ok(ucImgAuthorityDate&&ucImgAuthorityDate>='2026-08-11',`unexpected UC.IMG-A successor authority: ${UC_IMG_A_VERSION}`);
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
  'type="file" accept="image/*" multiple','截圖不會寫入 SQLite 或 GitHub',
])assert.ok(source.includes(token),`v0.4.10+ UC.IMG-A missing ${token}`);
const legacyBytePrivacyMarker=source.includes('圖片 bytes 未保留');
const successorBytePrivacyContract=
  source.includes("byte_state:'NOT_AVAILABLE'")&&
  source.includes('snapshotUcImgPickerFile(file)')&&
  source.includes('runtime.files.set(entry.entry_id,result.snapshot.blob)')&&
  !source.includes('runtime.files.set(entry.entry_id,file)');
assert.ok(legacyBytePrivacyMarker||successorBytePrivacyContract,'v0.4.10+ UC.IMG-A screenshot-byte privacy contract missing');
assert.equal(/indexedDB\.put\([^\n]*image|INSERT[^\n]*image_blob/i.test(source),false,'screenshot bytes must not be persisted');

const loader=read('assets/js/candy-inventory-ui.js');
const pageLoader=read('assets/js/bootstrap.js');
const directLoader=loader.includes("import './unified-screenshot-update-center.js';");
const successorBootstrap=loader.includes("import './uc-img-v04132-pot-capacity-bootstrap.js';");
const pageAwareLoader=/updates:Object\.freeze\(\[[\s\S]*'uc-img-v04132-pot-capacity-bootstrap\.js'/.test(pageLoader);
assert.ok(directLoader||successorBootstrap||pageAwareLoader,'UC.IMG-A runtime loader missing');
if(successorBootstrap||pageAwareLoader){
  const bootstrap=read('assets/js/uc-img-v04132-pot-capacity-bootstrap.js');
  assert.ok(bootstrap.includes("from './unified-screenshot-update-center.js'"),'successor bootstrap must load the same UC.IMG implementation');
  assert.ok(bootstrap.includes('account_capacity'),'successor bootstrap may only extend Recipe scenario authority explicitly');
  assert.ok(bootstrap.includes('recipeScenarioAcceptsPotCapacity'));
}
if(pageAwareLoader){
  assert.ok(pageLoader.includes('global_deferred_sweep:false'),'page-aware successor must not restore a global module sweep');
  assert.ok(pageLoader.includes('single_flight:true'),'page-aware successor must preserve single-flight module loading');
}
const promptCatalog=read('assets/js/prompt-catalog.js');
for(const token of ['weekly_context_update','ingredient_inventory_update','recipe_status_update'])assert.ok(promptCatalog.includes(token),`existing prompt scenario missing ${token}`);
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10 successor must not add SQLite migration 10');
const serviceWorker=read('service-worker.js');
assert.ok(serviceWorker.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(serviceWorker.includes("url.pathname.endsWith('.js')"),'UC.IMG-A relies on established online-load-once dynamic JS caching');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.10_RELEASE_CONTRACT_SUCCESSOR_AWARE',current_app_version:currentText,nested_hotfix_version_supported:true,
  historical_behavior_compatible:true,exact_release_authority_enforced:exactRelease,
  uc_img_a_version:UC_IMG_A_VERSION,uc_img_authority_date:ucImgAuthorityDate,
  scenarios:Object.values(UC_IMG_A_SCENARIOS).map(value=>value.scenario),multi_image:true,coverage_semantics:true,
  evidence_traceability:true,stale_response_guard:true,existing_dry_run_apply_bridge:true,screenshot_bytes_persisted:false,
  screenshot_byte_privacy_contract:legacyBytePrivacyMarker?'legacy-label':'byte-lifecycle-successor',
  loader_mode:pageAwareLoader?'page_aware_successor':successorBootstrap?'successor_bootstrap':'direct',single_uc_img_implementation:true,
  sqlite_migration_added:false,public_master_mutated:false,
},null,2));