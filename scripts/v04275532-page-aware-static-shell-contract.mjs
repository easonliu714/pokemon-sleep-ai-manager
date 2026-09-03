import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const bootstrap=read('assets/js/bootstrap.js');
const storage=read('assets/js/storage.js');
const html=read('index.html');
const migrations=read('assets/js/migrations.js');
const v5531=read('scripts/v04275531-startup-idb-sw-reliability-contract.mjs');
const v553=read('scripts/v0427553-mobile-snapshot-candy-ui-performance-contract.mjs');
const v552=read('scripts/v0427552-local-gap-field-precedence-contract.mjs');

// 1) No post-App-Ready global deferred sweep. Page groups are explicit, memoized,
// single-flight, and each import yields to the browser.
assert.ok(!bootstrap.includes('const deferredProbes='),'global deferredProbes sweep must be removed');
assert.ok(!bootstrap.includes('loadDeferredFeatureModules'),'legacy all-module deferred loader must be removed');
assert.match(bootstrap,/const pageModuleGroups=Object\.freeze\(/);
assert.match(bootstrap,/const pageLoads=new Map\(\)/);
assert.match(bootstrap,/const moduleLoads=new Map\(\)/);
assert.match(bootstrap,/if\(pageLoads\.has\(page\)\)return pageLoads\.get\(page\)/);
assert.match(bootstrap,/if\(moduleLoads\.has\(file\)\)return moduleLoads\.get\(file\)/);
assert.match(bootstrap,/await yieldToBrowser\(\);\s*await importFeatureModule\(file\)/);
assert.match(bootstrap,/global_deferred_sweep:false/);

// Unopened pages must not be eagerly loaded after APP_READY. Navigation is the
// trigger for page-specific groups.
assert.match(bootstrap,/button\.addEventListener\('click',\(\)=>\{void loadPageModules\(button\.dataset\.view\);\}/);
assert.ok(!bootstrap.includes("waitForAppReady().then"),'APP_READY must not trigger an all-feature import chain');

// 2) Base refresh may call listSnapshots, but the hidden Backup page path must
// resolve immediately and schedule metadata-only work in the background.
assert.match(storage,/export async function listSnapshots\(\{force=false\}=\{\}\)/);
assert.match(storage,/!force&&typeof document!==['"]undefined['"]&&!backupActive/);
assert.match(storage,/setTimeout\(\(\)=>\{void loadSnapshotMetadata\(\)/);
assert.match(storage,/app_ready_blocked:false/);
assert.match(storage,/snapshot_payload_bytes_materialized:false/);
assert.match(storage,/getAllKeys\(\)/);
assert.ok(!/SNAPSHOT_STORE[^\n]*getAll\(/.test(storage),'snapshot list/prune must not materialize SQLite snapshot payloads');
assert.match(bootstrap,/listSnapshots\(\{force:true\}\)/);
assert.match(bootstrap,/page==='backup'/);

// 3) Major Update Center structure is present in initial HTML and dynamic code
// hydrates inside an already-settled root rather than creating the page skeleton.
for(const id of ['updateCenterDynamicContent','updateCenterCandyStaticShell','updateCenterAnalysisStaticShell','updateCenterOcrStaticShell']){
  assert.ok(html.includes(`id="${id}"`),`missing static shell: ${id}`);
}
assert.ok(html.includes('data-static-shell-root="true"'));
assert.ok(html.includes('data-update-static-shell="candy"'));

// 4) v0.4.27.45 history UX is once again visible from first paint: native
// details is closed by default (no open attribute) and export remains available.
assert.ok(html.includes('<details id="importHistoryDetailsV042745" data-default-collapsed="true">'));
assert.ok(html.includes('<summary>匯入歷程（預設收合，點此展開）</summary>'));
assert.ok(html.includes('id="exportImportHistoryJsonBtnV042745"'));
const detailsOpenTag=html.match(/<details id="importHistoryDetailsV042745"[^>]*>/)?.[0]||'';
assert.ok(!/\sopen(?:\s|=|>)/.test(detailsOpenTag),'import history must be closed by default');
assert.match(bootstrap,/bindStaticHistoryExport/);
assert.match(bootstrap,/downloadImportHistoryJson/);

// 5) Frozen predecessor semantics are still physically present and Migration 15
// remains the latest migration authority.
assert.ok(v5531.includes('v0.4.27.55.3.1'));
assert.ok(v553.includes('snapshot_payload_bytes_materialized'));
assert.ok(v553.includes('global_data_changed_dispatched:false'));
assert.ok(v552.includes('Local-first')||v552.includes('LOCAL'));
assert.match(migrations,/version\s*:\s*15|MIGRATION_VERSION\s*=\s*15|LATEST_MIGRATION\s*=\s*15/);
assert.ok(!/version\s*:\s*1[6-9]|version\s*:\s*[2-9]\d/.test(migrations),'SQLite Migration must remain 15');

console.log(JSON.stringify({
  gate:'V04275532_PAGE_AWARE_STATIC_SHELL',
  status:'PASS',
  global_deferred_sweep:false,
  page_aware_single_flight:true,
  yield_between_modules:true,
  app_ready_snapshot_block:false,
  backup_snapshot_force_metadata:true,
  update_center_static_shell:true,
  import_history_default_collapsed:true,
  snapshot_payload_materialized:false,
  migration:15,
},null,2));
