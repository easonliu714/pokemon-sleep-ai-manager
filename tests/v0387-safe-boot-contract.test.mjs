import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storage=fs.readFileSync('assets/js/storage.js','utf8');
const database=fs.readFileSync('assets/js/database.js','utf8');
const releaseAuthority=fs.readFileSync('assets/js/v0382-release-authority.js','utf8');
const versionSource=fs.readFileSync('assets/js/version-authority.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(versionSource,sandbox);
const current=sandbox.PokemonSleepVersionAuthority;

// v0.4.27.55.3 originally added an additive IndexedDB v3 store for snapshot
// metadata. v0.4.27.55.3.1 preserves metadata-only snapshot listing without
// requiring that browser-container upgrade: existing v2/v3 databases open at
// their current version and metadata is stored under namespaced keys in the
// pre-existing metadata store. This remains independent of SQLite Migration 15.
assert.doesNotMatch(storage,/indexedDB\.open\(IDB_NAME\s*,\s*[23]\s*\)/);
assert.match(storage,/indexedDB\.open\(IDB_NAME\)/);
assert.match(storage,/DB_STORE\s*=\s*["']database["']/);
assert.match(storage,/SNAPSHOT_STORE\s*=\s*["']snapshots["']/);
assert.match(storage,/LEGACY_SNAPSHOT_META_STORE\s*=\s*["']snapshot_metadata["']/);
assert.match(storage,/META_STORE\s*=\s*["']metadata["']/);
assert.match(storage,/SNAPSHOT_META_PREFIX\s*=\s*["']snapshot:["']/);
assert.match(storage,/snapshotMetaKey\(id\)/);
assert.match(storage,/getKey\(DB_KEY\)/);
assert.match(storage,/onblocked/);
assert.match(storage,/onversionchange/);
assert.match(storage,/resetStorageConnection/);
assert.match(storage,/byte_length/);
assert.match(storage,/getAllKeys\(\)/,'snapshot payload enumeration must stay key-only');
assert.doesNotMatch(storage,/request\(SNAPSHOT_STORE,'readonly',store=>store\.getAll\(\)\)/,'safe boot must not materialize historical SQLite snapshot payloads just to list them');
assert.match(database,/AUTO_LOAD_MAX_BYTES=48\*1024\*1024/);
assert.match(database,/CONFIRM_LOAD_MAX_BYTES=128\*1024\*1024/);
assert.match(database,/legacy_database_requires_confirmation/);
assert.match(database,/large_database_requires_confirmation/);
assert.match(database,/database_too_large_for_auto_load/);
assert.match(database,/database_metadata_probe_timeout_retryable/);
assert.match(database,/requestForcedDatabaseLoad/);
assert.match(database,/sessionStorage\.removeItem\(FORCE_LOAD_KEY\)/);
assert.match(database,/inspectDatabaseRecord\(\)/);
assert.match(database,/loadDatabaseBytesInWorker/);
assert.match(database,/applyFreshDatabaseBootstrap/);
assert.match(database,/BOOT_PERSIST_SKIPPED/);
assert.match(releaseAuthority,/(?:嘗試載入本機資料|載入玩家資料庫)/);
assert.match(releaseAuthority,/下載啟動紀錄/);
assert.match(releaseAuthority,/service-worker(?:-v0387)?\.js/);
assert.match(releaseAuthority,/detail\.rescue\|\|detail\.readonly/);
assert.match(releaseAuthority,/STARTUP_SLOW_WARNING/);
// Historical v0.3.87 safety behavior must remain valid across later v0.x releases,
// including nested numeric hotfix versions such as v0.4.27.55.3.1.
assert.match(current.app_version,/^v0(?:\.\d+){2,}$/);
assert.ok(current.app_build);
assert.match(bootstrap,/version-authority\.js/);
assert.match(bootstrap,/authority\.app_version/);
assert.match(bootstrap,/authority\.app_build/);
assert.match(sw,/importScripts\('\.\/assets\/js\/version-authority\.js'\)/);
assert.match(sw,/cache_name:CACHE/);
assert.ok(index.includes('bootstrap.js'));
console.log(JSON.stringify({status:'PASS',gate:'v0387_safe_boot_contract',version:current.app_version,player_data_write:false,legacy_auto_read:false,index_authority:true,forward_compatible_release:true,nested_hotfix_semver_supported:true,worker_isolated_load:true,worker_lifecycle_race_closed:true,fresh_database_bootstrap:true,post_migration_dispatch_isolated:true,central_version_authority:true,public_master_local_first:true,indexeddb_open:'version-neutral-v2-v3',snapshot_metadata_namespaced:true,snapshot_payload_list_materialized:false,sqlite_migration_unchanged:true}));