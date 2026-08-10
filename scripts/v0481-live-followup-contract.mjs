import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
assert.ok(['v0.4.8','v0.4.8.1'].includes(app),`unexpected release during v0.4.8.1 closure: ${app}`);

const override=read('assets/js/weekly-context-manual-override.js');
for(const token of [
  'weekly-context-manual-override/1.0',
  'weekly_context_manual_override:',
  'based_on_import_revision',
  'expected!==\'\'&&based===expected',
  "snapshot('manual:weekly-context-override')",
  "snapshot('manual:weekly-context-override-clear')",
])assert.ok(override.includes(token),`manual override contract missing: ${token}`);

const store=read('assets/js/weekly-context-store.js');
for(const token of [
  'resolveWeeklyManualOverride',
  "fieldSources[field]='MANUAL_OVERRIDE'",
  "fieldSources.event_effects='MANUAL_OVERRIDE'",
  'manual_override_fields',
  'manual_override_stale',
  'authority_revision',
  "fieldSources[field]='PUBLIC_CAMP_MASTER'",
])assert.ok(store.includes(token),`resolved Weekly authority missing: ${token}`);
assert.ok(store.indexOf("manualOverride.active&&own(overrideFields,field)")<store.indexOf("fieldSources[field]='UPDATE_CENTER_JSON'"),'explicit manual override must be evaluated before imported JSON values');
assert.ok(store.includes("if(manualOverride.active&&own(overrideFields,'camp'))"),'camp override must invalidate inherited dynamic berry observations');

const ui=read('assets/js/weekly-context-ui-bridge.js');
for(const token of [
  '人工覆寫 ＞ 更新中心 JSON ＞ 人工 fallback',
  'data-weekly-clear-override',
  'saveWeeklyManualOverride',
  'clearWeeklyManualOverride',
  'validateWeeklyEventEffects',
  "node.disabled=source==='PUBLIC_CAMP_MASTER'",
  '新的 Weekly JSON 套用後舊覆寫會自動失效',
])assert.ok(ui.includes(token),`Weekly manual edit UX missing: ${token}`);
assert.equal(ui.includes("node.disabled=primary"),false,'Update Center JSON fields must no longer be globally hard-disabled');
assert.equal(ui.includes("select.disabled=resolved.locked||source==='UPDATE_CENTER_JSON'"),false,'random/EX berries from JSON must remain manually correctable');

const camp=read('assets/js/camp-berry-knowledge-ui.js');
for(const token of [
  'camp-berry-scroll',
  'overflow-x:auto',
  '-webkit-overflow-scrolling:touch',
  'touch-action:pan-x pan-y',
  '#campBerryMasterTable{min-width:760px',
  'margin-left:0;margin-right:0',
  '可左右捲動',
])assert.ok(camp.includes(token),`mobile Camp Berry containment missing: ${token}`);

const coverage=read('assets/js/public-pokemon-knowledge-coverage.js');
for(const token of ['VERIFIED_OUTGOING_OR_VERIFIED_TERMINAL_OR_UNKNOWN','UNKNOWN_NOT_YET_VERIFIED','VERIFIED_TERMINAL_CURRENT_SLEEP'])assert.ok(coverage.includes(token),`evolution tri-state safety regression: ${token}`);
const master=read('assets/js/public-pokemon-knowledge-master.js');
assert.ok(master.includes('Missing rows mean "public master not'));
assert.equal(read('assets/js/migrations.js').includes('version,applied_at) VALUES(10'),false,'LIVE follow-up must not add SQLite migration 10');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0481_LIVE_FOLLOWUP_BEHAVIOR',
  app_version:app,
  release_phase:app==='v0.4.8.1',
  weekly_json_fields_manually_overridable:true,
  override_revision_scoped:true,
  fixed_camp_berries_still_locked:true,
  typed_event_validation_preserved:true,
  camp_table_mobile_horizontal_scroll:true,
  evolution_three_state_semantics_preserved:true,
  sqlite_migration_added:false,
},null,2));
