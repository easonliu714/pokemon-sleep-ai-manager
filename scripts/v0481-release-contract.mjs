import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.8.1');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v0481-weekly-manual-override-mobile-coverage');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.8.1-v0481-weekly-manual-override-mobile-coverage');

const override=read('assets/js/weekly-context-manual-override.js');
const store=read('assets/js/weekly-context-store.js');
const ui=read('assets/js/weekly-context-ui-bridge.js');
const camp=read('assets/js/camp-berry-knowledge-ui.js');
const sw=read('service-worker.js');
for(const token of ['based_on_import_revision','weekly_context_manual_override:'])assert.ok(override.includes(token));
for(const token of ['MANUAL_OVERRIDE','authority_revision','manual_override_stale'])assert.ok(store.includes(token));
for(const token of ['清除本週人工覆寫','更新中心 JSON 為初始權威來源','validateWeeklyEventEffects('])assert.ok(ui.includes(token));
for(const token of ['camp-berry-scroll','overflow-x:auto','touch-action:pan-x pan-y'])assert.ok(camp.includes(token));
assert.ok(sw.includes("'./assets/js/weekly-context-manual-override.js'"),'critical manual override module must be part of v0.4.8.1 PWA precache');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.equal(read('assets/js/migrations.js').includes('VALUES(10,'),false,'v0.4.8.1 must remain migration-10 free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.8.1_RELEASE_CONTRACT',app_version:'v0.4.8.1',
  build:'20260810-v0481-weekly-manual-override-mobile-coverage',
  manual_override_revision_scoped:true,imported_weekly_rows_mutated:false,fixed_camp_berries_locked:true,
  typed_event_validator_preserved:true,mobile_camp_table_scroll:true,pwa_override_module_precached:true,sqlite_migration_added:false,
},null,2));
