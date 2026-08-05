import assert from 'node:assert/strict';
import fs from 'node:fs';

const storage=fs.readFileSync('assets/js/storage.js','utf8');
const database=fs.readFileSync('assets/js/database.js','utf8');
const authority=fs.readFileSync('assets/js/v0382-release-authority.js','utf8');
const bootstrap=fs.readFileSync('assets/js/bootstrap.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(storage,/IDB_VERSION\s*=\s*2/);
assert.match(storage,/META_STORE\s*=\s*["']metadata["']/);
assert.match(storage,/getKey\(DB_KEY\)/);
assert.match(storage,/onblocked/);
assert.match(storage,/onversionchange/);
assert.match(storage,/byte_length/);

assert.match(database,/AUTO_LOAD_MAX_BYTES=48\*1024\*1024/);
assert.match(database,/CONFIRM_LOAD_MAX_BYTES=128\*1024\*1024/);
assert.match(database,/legacy_database_requires_confirmation/);
assert.match(database,/large_database_requires_confirmation/);
assert.match(database,/database_too_large_for_auto_load/);
assert.match(database,/requestForcedDatabaseLoad/);
assert.match(database,/inspectDatabaseRecord\(\)/);

assert.match(authority,/v0\.3\.87/);
assert.match(authority,/嘗試載入本機資料/);
assert.match(authority,/下載啟動紀錄/);
assert.match(authority,/service-worker-v0387\.js/);

// v0.3.87 establishes the Safe Boot contract; later releases may promote
// runtime/cache authority while retaining the same storage and confirmation rules.
assert.match(bootstrap,/const APP_VERSION\s*=\s*'v0\.3\.(?:87|88)'/);
assert.match(bootstrap,/const VERSION\s*=\s*'20260805-v03(?:87-indexeddb-safe-boot-memory-guard|88-zero-sql-rescue)'/);
assert.match(sw,/const APP_VERSION\s*=\s*'v0\.3\.(?:87|88)'/);
assert.match(sw,/v03(?:87-indexeddb-safe-boot-memory-guard|88-zero-sql-rescue)/);
assert.match(index,/bootstrap\.js\?v=20260805-v03(?:87-indexeddb-safe-boot-memory-guard|88-zero-sql-rescue)/);

console.log(JSON.stringify({status:'PASS',gate:'v0387_safe_boot_contract',player_data_write:false,legacy_auto_read:false,index_authority:true,forward_compatible_release:true}));
