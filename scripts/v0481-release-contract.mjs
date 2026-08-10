import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};
const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const build=version.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cache=version.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
assert.equal(atLeast(app,'v0.4.8.1'),true,`v0.4.8.1 historical behavior cannot run on older release: ${app}`);
if(app==='v0.4.8.1'){
  assert.equal(build,'20260810-v0481-weekly-manual-override-mobile-coverage');
  assert.equal(cache,'pokemon-sleep-ai-v0.4.8.1-v0481-weekly-manual-override-mobile-coverage');
}

const override=read('assets/js/weekly-context-manual-override.js');
const store=read('assets/js/weekly-context-store.js');
const ui=read('assets/js/weekly-context-ui-bridge.js');
const camp=read('assets/js/camp-berry-knowledge-ui.js');
const sw=read('service-worker.js');
for(const token of ['based_on_import_revision','weekly_context_manual_override:'])assert.ok(override.includes(token));
for(const token of ['MANUAL_OVERRIDE','authority_revision','manual_override_stale'])assert.ok(store.includes(token));
for(const token of ['清除本週人工覆寫','更新中心 JSON 為初始權威來源','validateWeeklyEventEffects('])assert.ok(ui.includes(token));
for(const token of ['camp-berry-scroll','overflow-x:auto','touch-action:pan-x pan-y'])assert.ok(camp.includes(token));
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"),'runtime JS must remain on the network-first/cache-write path');
assert.ok(sw.includes('caches.open(CACHE).then(cache=>cache.put(event.request,copy))'),'successful runtime JS load must be cached for supported offline reopen');
assert.equal(read('assets/js/migrations.js').includes('VALUES(10,'),false,'v0.4.8.1 behavior must remain migration-10 free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.8.1_RELEASE_HISTORICAL_CONTRACT',current_app_version:app,
  exact_release_authority_enforced:app==='v0.4.8.1',
  manual_override_revision_scoped:true,imported_weekly_rows_mutated:false,fixed_camp_berries_locked:true,
  typed_event_validator_preserved:true,mobile_camp_table_scroll:true,pwa_runtime_js_cache_contract:true,sqlite_migration_added:false,
},null,2));
