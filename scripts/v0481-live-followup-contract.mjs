// P8A parity trigger: no behavioral change; forces both v0.4.8 predecessor wrappers onto the fixed parity head.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};
const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
assert.equal(atLeast(app,'v0.4.8.1'),true,`v0.4.8.1 behavior cannot run on older release: ${app}`);

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
assert.ok(camp.includes('camp-berry-scroll'),'Camp Berry mobile containment wrapper must remain explicit');
let mobileCampStrategy='UNKNOWN';
if(app==='v0.4.8.1'){
  for(const token of [
    'overflow-x:auto',
    '-webkit-overflow-scrolling:touch',
    'touch-action:pan-x pan-y',
    '#campBerryMasterTable{min-width:760px',
    'margin-left:0;margin-right:0',
    '可左右捲動',
  ])assert.ok(camp.includes(token),`exact v0.4.8.1 horizontal-scroll containment missing: ${token}`);
  mobileCampStrategy='HORIZONTAL_SCROLL';
}else if(atLeast(app,'v0.4.8.5')){
  for(const token of [
    '#campBerryMasterBlock{min-width:0;max-width:100%;overflow:hidden;}',
    "CAMP_BERRY_MOBILE_CONTAINMENT='COMPACT_CONTAINED_TABLE'",
    'overflow-x:auto!important',
    '#campBerryMasterTable{width:100%;min-width:640px;max-width:100%;table-layout:fixed',
    'margin-left:0!important;margin-right:0!important',
    '採與進化條件及糖果公版 Master 一致的緊湊表格',
  ])assert.ok(camp.includes(token),`successor compact Camp Berry containment missing: ${token}`);
  assert.equal(camp.includes('camp-berry-contained-cards'),false,'compact successor must not retain touch-first row cards');
  mobileCampStrategy='COMPACT_CONTAINED_TABLE';
}else{
  for(const token of [
    '#campBerryMasterBlock{min-width:0;max-width:100%;overflow:hidden;}',
    '#campBerryMasterTable{display:block;width:100%!important;min-width:0!important;max-width:100%!important',
    '#campBerryMasterTable thead{display:none;}',
    '#campBerryMasterTable td::before{content:attr(data-label)',
    '手機版改用框內卡片避免超出外框',
  ])assert.ok(camp.includes(token),`v0.4.8.3/4 row-card containment missing: ${token}`);
  mobileCampStrategy='ROW_CARD_CONTAINED';
}

const coverage=read('assets/js/public-pokemon-knowledge-coverage.js');
for(const token of ['VERIFIED_OUTGOING_OR_VERIFIED_TERMINAL_OR_UNKNOWN','UNKNOWN_NOT_YET_VERIFIED','VERIFIED_TERMINAL_CURRENT_SLEEP'])assert.ok(coverage.includes(token),`evolution tri-state safety regression: ${token}`);
const master=read('assets/js/public-pokemon-knowledge-master.js');
assert.ok(master.includes('Missing rows mean "public master not'));
assert.equal(read('assets/js/migrations.js').includes('version,applied_at) VALUES(10'),false,'LIVE follow-up behavior must not add SQLite migration 10');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0481_LIVE_FOLLOWUP_HISTORICAL_BEHAVIOR',
  app_version:app,
  exact_v0481_release:app==='v0.4.8.1',
  weekly_json_fields_manually_overridable:true,
  override_revision_scoped:true,
  fixed_camp_berries_still_locked:true,
  typed_event_validation_preserved:true,
  camp_table_mobile_contained:true,
  camp_table_mobile_strategy:mobileCampStrategy,
  evolution_three_state_semantics_preserved:true,
  sqlite_migration_added:false,
},null,2));