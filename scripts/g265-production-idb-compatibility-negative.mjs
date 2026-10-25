import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {createSqliteDurableRevisionGate} from '../assets/js/sqlite-durable-revision-gate.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

// Disposable fake IndexedDB process and SQL.js fixture only. No real browser
// profile, personal SQLite, migration, storage upgrade or production write.
globalThis.indexedDB=indexedDB;
const {saveDatabaseBytes,loadDatabaseBytes,inspectDatabaseRecord,closeStorageConnection}=
  await import('../assets/js/storage.js');
const storage=fs.readFileSync('assets/js/storage.js','utf8');
const production=fs.readFileSync('assets/js/database.js','utf8');
const revision=fs.readFileSync('assets/js/sqlite-durable-revision-gate.js','utf8');
assert.match(storage,/const IDB_NAME = "pokemon_sleep_ai_manager"/);
assert.match(storage,/const DB_STORE = "database"/);
assert.match(storage,/const META_STORE = "metadata"/);
assert.match(storage,/const DB_KEY = "primary"/);
assert.match(storage,/store=>store\.get\(DB_KEY\)/);
assert.match(storage,/tx\.objectStore\(DB_STORE\)\.put\(buffer,DB_KEY\)/);
assert.match(revision,/store\.put\(\{generation:/);
assert.doesNotMatch(production,/sqlite-durable-revision-gate/);

const SQL=await initSqlJs();
const sqlite=new SQL.Database();
sqlite.run('CREATE TABLE compatibility_fixture (id TEXT PRIMARY KEY)');
sqlite.run("INSERT INTO compatibility_fixture VALUES ('ORIGINAL')");
const original=new Uint8Array(sqlite.export());
sqlite.run("INSERT INTO compatibility_fixture VALUES ('SECOND')");
const second=new Uint8Array(sqlite.export());
sqlite.close();
const digest=bytes=>sha256SqliteBytes(bytes,webcrypto);
const originalHash=await digest(original);
const open=()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('pokemon_sleep_ai_manager');
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});
const transaction=(db,stores,fn)=>new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,'readwrite');
  try{fn(tx);}catch(e){try{tx.abort();}catch{}reject(e);return;}
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('transaction_failed'));
  tx.onabort=()=>reject(tx.error||new Error('transaction_aborted'));
});
const get=(db,store,key)=>new Promise((resolve,reject)=>{
  const tx=db.transaction(store,'readonly');
  const req=tx.objectStore(store).get(key);
  tx.oncomplete=()=>resolve(req.result);
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error);
});

await saveDatabaseBytes(original);
assert.equal((await inspectDatabaseRecord()).exists,true);
const first=await loadDatabaseBytes();
assert.ok(first instanceof ArrayBuffer);
assert.equal(await digest(new Uint8Array(first)),originalHash);
const db=await open();
assert.ok(db.objectStoreNames.contains('database'));
assert.ok(db.objectStoreNames.contains('metadata'));
const gate=createSqliteDurableRevisionGate({
  db,storeName:'database',recordKey:'primary',
  locks:{request:async(_name,_opts,callback)=>callback({name:_name})},
  fingerprint:digest,timeoutMs:2000
});
await assert.rejects(gate.readVerified(),e=>e.code==='G265_REVISION_MISSING_OR_INVALID');
assert.equal(gate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
console.log('REPRODUCED_HOLD G265_PRODUCTION_RAW_ARRAYBUFFER_NOT_ATOMIC_REVISION_RECORD');

// Replacing the legacy primary with a revision object breaks its ArrayBuffer
// reader. This write occurs only in disposable fake IndexedDB.
await transaction(db,['database'],tx=>tx.objectStore('database').put(
  {generation:0,sha256:originalHash,bytes:original},'primary'));
const incompatible=await loadDatabaseBytes();
assert.equal(incompatible instanceof ArrayBuffer,false);
assert.equal(incompatible?.generation,0);
assert.equal(new Uint8Array(incompatible).byteLength,0);
await saveDatabaseBytes(original);
assert.ok((await loadDatabaseBytes()) instanceof ArrayBuffer);
console.log('REPRODUCED_HOLD G265_REVISION_RECORD_BREAKS_LEGACY_BOOT_LOADER');

// A separate revision metadata key cannot be considered atomically coupled
// to legacy saveDatabaseBytes(), which overwrites only database/primary and
// metadata/primary. Prove divergence with two real SQL.js images.
await transaction(db,['metadata'],tx=>tx.objectStore('metadata').put(
  {generation:0,sha256:originalHash},'revision:primary'));
await saveDatabaseBytes(second);
const persisted=await loadDatabaseBytes();
const metadata=await get(db,'metadata','revision:primary');
assert.equal(metadata.generation,0);
assert.equal(metadata.sha256,originalHash);
assert.notEqual(await digest(new Uint8Array(persisted)),metadata.sha256);
const restored=new SQL.Database(new Uint8Array(persisted));
assert.equal(restored.exec('SELECT COUNT(*) FROM compatibility_fixture')[0].values[0][0],2);
restored.close();
console.log('REPRODUCED_HOLD G265_SEPARATE_REVISION_METADATA_NOT_UPDATED_BY_LEGACY_SAVE');
console.log('PASS G265_PRODUCTION_IDB_SOURCE_BOUND_STORAGE_COMPATIBILITY_NEGATIVE');
console.log('HOLD G265_NO_SCHEMA_UPGRADE_SAFE_ATOMIC_MIGRATION_ALL_WRITERS_ANDROID_UAT');
db.close();
closeStorageConnection();
