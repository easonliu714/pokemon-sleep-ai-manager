import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
  CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
  CANDY_FAMILY_STORAGE_POLICY,
  CANDY_MUTATION_TYPES,
  canonicalCandyEventTimestamp,
  reconcileCandyFamilyTimeline,
  resolveCandyFamilyStorageForSpecies,
} from '../assets/js/candy-family-storage-authority.js';

assert.equal(CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,'candy-family-storage-authority-2026-09-01-b');
assert.equal(canonicalCandyEventTimestamp('2026-09-01T13:37:33+08:00'),'2026-09-01T05:37:33.000Z');

const pichu=resolveCandyFamilyStorageForSpecies('皮丘');
const pikachu=resolveCandyFamilyStorageForSpecies('皮卡丘');
assert.equal(pichu.status,'MATCH');
assert.equal(pikachu.status,'MATCH');
assert.equal(pichu.family_id,pikachu.family_id,'Pichu/Pikachu must converge by governed family authority');
assert.equal(pichu.canonical_species_name,'皮卡丘','B4 reference species is the canonical storage representative');
assert.equal(pichu.canonical_candy_display_name,'皮卡丘的糖果');

const realDeviceInventorySpecies=['皮卡丘','伊布','波加曼','水躍魚','摔角鷹人','卡拉卡拉','卡蒂狗','達克萊伊','胖丁','寶寶暴龍','火稚雞','夢幻','拉帝歐斯','妙蛙種子','迷你龍','菊草葉','小火焰猴','小鍛匠','拉帝亞斯','草苗龜','木守宮'];
for(const species of realDeviceInventorySpecies){
  const storage=resolveCandyFamilyStorageForSpecies(species);
  assert.equal(storage.status,'MATCH',`${species} must have writable governed family storage after real-device revalidation`);
  assert.ok(storage.family_id,`${species} family id required`);
  assert.ok(storage.canonical_species_name,`${species} canonical storage species required`);
  assert.ok(storage.canonical_candy_display_name,`${species} exact Candy display authority required`);
}
assert.equal(resolveCandyFamilyStorageForSpecies('卡拉卡拉').canonical_candy_display_name,'卡拉卡拉的糖果');
assert.equal(resolveCandyFamilyStorageForSpecies('卡蒂狗').canonical_candy_display_name,'卡蒂狗的糖果');
assert.equal(resolveCandyFamilyStorageForSpecies('風速狗').canonical_candy_display_name,'卡蒂狗的糖果');
assert.equal(resolveCandyFamilyStorageForSpecies('夢幻').canonical_candy_display_name,'夢幻的糖果');
assert.equal(resolveCandyFamilyStorageForSpecies('達克萊伊').canonical_candy_display_name,'達克萊伊的糖果');

const olderDeltaThenSnapshot=reconcileCandyFamilyTimeline([
  {event_id:'delta-old',mutation_type:CANDY_MUTATION_TYPES.DELTA_EVENT,quantity_value:5,event_at:'2026-08-30T10:00:00.000Z'},
  {event_id:'snapshot-new',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:288,event_at:'2026-09-01T12:00:00.000Z'},
]);
assert.equal(olderDeltaThenSnapshot.status,'READY');
assert.equal(olderDeltaThenSnapshot.current_quantity,288,'older delta must not be double-counted after a newer absolute snapshot');

const snapshotThenDelta=reconcileCandyFamilyTimeline([
  {event_id:'snapshot-old',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:288,event_at:'2026-09-01T10:00:00.000Z'},
  {event_id:'delta-new',mutation_type:CANDY_MUTATION_TYPES.DELTA_EVENT,quantity_value:5,event_at:'2026-09-01T11:00:00.000Z'},
]);
assert.equal(snapshotThenDelta.status,'READY');
assert.equal(snapshotThenDelta.current_quantity,293,'later Professor delta must be added after the latest absolute snapshot');

// Real-device regression: historical migration evidence used local +08:00 text while
// screenshot quantity confirmation used UTC Z text. Lexicographic ISO comparison falsely
// treated 13:37+08 as newer than 11:44Z even though the latter is 19:44 in Taiwan.
const mixedOffsetOlderSnapshotThenNewSnapshot=reconcileCandyFamilyTimeline([
  {event_id:'legacy-local-snapshot',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:270,event_at:'2026-09-01T13:37:33+08:00'},
  {event_id:'new-utc-snapshot',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:288,event_at:'2026-09-01T11:44:00.000Z'},
]);
assert.equal(mixedOffsetOlderSnapshotThenNewSnapshot.status,'READY');
assert.equal(mixedOffsetOlderSnapshotThenNewSnapshot.current_quantity,288,'later UTC absolute snapshot must supersede older +08:00 snapshot by instant, not string order');
assert.equal(mixedOffsetOlderSnapshotThenNewSnapshot.baseline_event.event_id,'new-utc-snapshot');

const mixedOffsetSnapshotThenProfessorDelta=reconcileCandyFamilyTimeline([
  {event_id:'snapshot-local',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:288,event_at:'2026-09-01T13:37:33+08:00'},
  {event_id:'professor-local',mutation_type:CANDY_MUTATION_TYPES.DELTA_EVENT,quantity_value:5,event_at:'2026-09-01T18:29:00+08:00'},
]);
assert.equal(mixedOffsetSnapshotThenProfessorDelta.status,'READY');
assert.equal(mixedOffsetSnapshotThenProfessorDelta.current_quantity,293);

const explicitZero=reconcileCandyFamilyTimeline([
  {event_id:'snapshot-zero',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:0,event_at:'2026-09-01T10:00:00.000Z'},
]);
assert.equal(explicitZero.status,'READY');
assert.equal(explicitZero.current_quantity,0,'explicit confirmed zero remains a real snapshot value');

const unknownAfterSnapshot=reconcileCandyFamilyTimeline([
  {event_id:'snapshot',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:288,event_at:'2026-09-01T10:00:00.000Z'},
],{unknown_rows:[{candy_id:'legacy',updated_at:'2026-09-01T11:00:00.000Z'}]});
assert.equal(unknownAfterSnapshot.status,'HOLD');
assert.equal(unknownAfterSnapshot.reason,'UNKNOWN_PROVENANCE_AFTER_LATEST_SNAPSHOT');

const sameTimestamp=reconcileCandyFamilyTimeline([
  {event_id:'snapshot',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:288,event_at:'2026-09-01T10:00:00.000Z'},
  {event_id:'delta',mutation_type:CANDY_MUTATION_TYPES.DELTA_EVENT,quantity_value:5,event_at:'2026-09-01T18:00:00+08:00'},
]);
assert.equal(sameTimestamp.status,'HOLD');
assert.equal(sameTimestamp.reason,'AMBIGUOUS_SAME_TIMESTAMP_SNAPSHOT_AND_DELTA','same physical instant with different timezone text must remain ambiguous');

const invalidTimestamp=reconcileCandyFamilyTimeline([
  {event_id:'bad-time',mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,quantity_value:288,event_at:'not-a-time'},
]);
assert.equal(invalidTimestamp.status,'HOLD');
assert.equal(invalidTimestamp.reason,'INVALID_EVENT_TIMESTAMP');

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15);
assert.equal(CANDY_FAMILY_STORAGE_POLICY.display_text_dedupe,false);
assert.equal(CANDY_FAMILY_STORAGE_POLICY.fuzzy_match,false);
assert.equal(CANDY_FAMILY_STORAGE_POLICY.species_string_guess,false);
assert.equal(CANDY_FAMILY_STORAGE_POLICY.arbitrary_duplicate_sum,false);
assert.equal(CANDY_FAMILY_STORAGE_POLICY.ambiguous_provenance,'HOLD_FAIL_CLOSED');
assert.equal(CANDY_FAMILY_STORAGE_POLICY.explicit_zero_valid,true);
assert.equal(CANDY_FAMILY_STORAGE_POLICY.timestamp_ordering,'PARSED_INSTANT_UTC_CANONICAL');
assert.equal(CANDY_FAMILY_STORAGE_POLICY.mixed_timezone_offsets_supported,true);

const databaseSource=fs.readFileSync(new URL('../assets/js/database.js',import.meta.url),'utf8');
const importerSource=fs.readFileSync(new URL('../assets/js/importer.js',import.meta.url),'utf8');
const professorSource=fs.readFileSync(new URL('../assets/js/pokemon-professor-transfer.js',import.meta.url),'utf8');
const uiSource=fs.readFileSync(new URL('../assets/js/candy-inventory-ui.js',import.meta.url),'utf8');
const storageSource=fs.readFileSync(new URL('../assets/js/candy-family-storage-authority.js',import.meta.url),'utf8');
const versionSource=fs.readFileSync(new URL('../assets/js/version-authority.js',import.meta.url),'utf8');
const serviceWorkerSource=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const workflowSource=fs.readFileSync(new URL('../.github/workflows/regression-gate.yml',import.meta.url),'utf8');

assert.match(databaseSource,/applyCandyFamilyStorageMigration/,'database lifecycle must execute migration 15');
assert.match(importerSource,/ABSOLUTE_SNAPSHOT/,'importer must persist absolute snapshot semantics');
assert.match(importerSource,/operation_evidence/,'importer must retain future quantity evidence in the event ledger');
assert.match(professorSource,/DELTA_EVENT/,'Professor write must persist delta semantics');
assert.match(professorSource,/canonical_candy_id/,'Professor write must target canonical family storage');
assert.match(professorSource,/USER_DIRECT_OBSERVATION_ONLY/,'P0-B6 must preserve direct-observation quantity authority');
assert.match(uiSource,/Family migration/,'UI must expose migration outcome for physical validation');
assert.match(storageSource,/BEGIN IMMEDIATE/);
assert.match(storageSource,/ROLLBACK/);
assert.match(storageSource,/normalizeExistingEventTimes/,'already-applied v15 devices must normalize mixed-offset event timestamps on boot');
assert.ok(!storageSource.includes('quantity=candy_inventory.quantity+excluded.quantity'), 'migration itself must never blindly sum duplicate current rows');

assert.match(versionSource,/app_version:\s*'v0\.4\.27\.55'/);
assert.match(versionSource,/app_build:\s*'20260901-v042755-p0b6-candy-family-storage-reconciliation'/);
assert.match(versionSource,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55-v042755-p0b6-candy-family-storage-reconciliation'/);
assert.ok(versionSource.includes("// app_version: 'v0.4.27.54'"),'exact .54 predecessor version bridge must remain');
assert.ok(versionSource.includes("// app_build: '20260901-v042754-p0b5-ingame-candy-master-promotion'"),'exact .54 predecessor build bridge must remain');
assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.54-v042754-p0b5-ingame-candy-master-promotion'"),'exact .54 predecessor cache bridge must remain');
assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/candy-family-storage-authority\.js/g)||[]).length,1,'P0-B6 family storage authority must be precached exactly once');
assert.equal((workflowSource.match(/node scripts\/v042755-p0b6-candy-family-storage-contract\.mjs/g)||[]).length,1,'P0-B6 static contract must be wired exactly once');
assert.equal((workflowSource.match(/node scripts\/v042755-p0b6-candy-family-storage-browser-contract\.mjs/g)||[]).length,1,'P0-B6 browser migration contract must be wired exactly once');
assert.equal(fs.existsSync('.github/workflows/v042755-p0b6-candy-family-storage-reconciliation.yml'),false,'P0-B6 must remain on consolidated CI topology');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042755_P0B6_CANDY_FAMILY_STORAGE_CONTRACT',
  app_version:'v0.4.27.55',
  app_build:'20260901-v042755-p0b6-candy-family-storage-reconciliation',
  cache_name:'pokemon-sleep-ai-v0.4.27.55-v042755-p0b6-candy-family-storage-reconciliation',
  authority:CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
  migration_version:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
  pikachu_family_id:pichu.family_id,
  real_device_inventory_species_count:realDeviceInventorySpecies.length,
  regressions:{older_delta_then_snapshot:olderDeltaThenSnapshot.current_quantity,snapshot_then_delta:snapshotThenDelta.current_quantity,mixed_offset_latest_snapshot:mixedOffsetOlderSnapshotThenNewSnapshot.current_quantity,mixed_offset_snapshot_then_delta:mixedOffsetSnapshotThenProfessorDelta.current_quantity,explicit_zero:explicitZero.current_quantity,unknown_after_snapshot:unknownAfterSnapshot.status,same_timestamp:sameTimestamp.status,invalid_timestamp:invalidTimestamp.status},
  release_wiring:{version_authority:true,predecessor_54_bridge:true,service_worker_precache_exact_once:true,consolidated_static_gate:true,consolidated_browser_gate:true},
},null,2));
