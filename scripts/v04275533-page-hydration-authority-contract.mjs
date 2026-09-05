import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const authority=read('assets/js/version-authority.js');
const bootstrap=read('assets/js/bootstrap.js');
const scheduler=read('assets/js/v0395-dom-render-scheduler.js');
const hydrator=read('assets/js/page-hydration-authority-v04275533.js');
const html=read('index.html');
const sw=read('service-worker.js');
const appVersion=authority.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const appBuild=authority.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=authority.match(/cache_name:\s*'([^']+)'/)?.[1]||'';

if(appVersion==='v0.4.27.55.3.3.1'){
  assert.equal(appBuild,'20260905-v042755331-page-prewarm-collapsible-hydration');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3.1-v042755331-page-prewarm-collapsible-hydration');
  assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3'/,'successor must retain .55.3.3 predecessor bridge');
}else{
  assert.equal(appVersion,'v0.4.27.55.3.3');
  assert.equal(appBuild,'20260904-v04275533-page-hydration-authority');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3.3-v04275533-page-hydration-authority');
}
assert.match(authority,/\/\/ app_version: 'v0\.4\.27\.55\.3\.2'/,'predecessor bridge must remain');
assert.match(sw,/importScripts\('\.\/assets\/js\/version-authority\.js'\)/);

assert.match(bootstrap,/page-hydration-authority-v04275533\.js/);
assert.match(bootstrap,/PokemonSleepPageHydrationAuthorityV04275533/);
assert.match(bootstrap,/canonical_esm_identity:true/);
assert.match(bootstrap,/const promise=import\(\`\.\/\$\{file\}\`\)/,'page feature imports must retain canonical ESM identity');

assert.match(scheduler,/OFFSCREEN_RENDER_SUPERSEDED/);
assert.match(scheduler,/navigation_is_data_mutation:false/);
assert.ok(!scheduler.includes("new CustomEvent('pokemon-sleep:data-changed'"),'navigation must not fake a data mutation');
assert.match(scheduler,/discard\(singleOwnerMap\[view\]\)/,'items/ingredients/recipes/backup must discard stale deferred DOM rather than flush');
assert.ok(!scheduler.includes("globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:app-ready'"),'render scheduler must not emit business App Ready');

for(const token of [
  'canonicalizeImportHistoryDom',
  'knowledgePokemonSlot',
  'knowledgeCandySlot',
  'single_owner_render:true',
  'update_center_real_mount_gate:true',
  "document.getElementById('candyQuantityScreenshotB5')",
  "document.getElementById('analysisConfirmationWorkbench')",
]) assert.ok(hydrator.includes(token),'missing .55.3.3 hydration contract token: '+token);

assert.ok(html.includes('<details id="importHistoryDetailsV042745" data-default-collapsed="true">'));
assert.ok(html.includes('id="importHistoryWrap"'));
assert.ok(html.includes('id="historyTable"'));
assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'SQLite Migration 15 must remain frozen');

console.log(JSON.stringify({
  gate:'V04275533_PAGE_HYDRATION_AUTHORITY',
  status:'PASS',
  version:appVersion,
  navigation_is_data_mutation:false,
  single_owner_render:true,
  deferred_double_render_removed:true,
  knowledge_fixed_slots:true,
  update_center_real_mount_gate:true,
  import_history_single_owner:true,
  migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
},null,2));

if(appVersion==='v0.4.27.55.3.3.1')await import('./v042755331-page-prewarm-collapsible-hydration-contract.mjs');
