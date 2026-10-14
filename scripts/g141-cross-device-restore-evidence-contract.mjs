import assert from 'node:assert/strict';
import {G141_BACKUP_MANIFEST_SCHEMA,G141_RECEIPT_STAGES,evaluateG141CrossDeviceRestoreEvidence as audit}
  from '../assets/js/g141-cross-device-restore-evidence.js';

// No real player's SQLite, name, species or credential in these fixtures.
const expectedSHA='a'.repeat(64);
const oldManifest=Object.freeze({
  schema:G141_BACKUP_MANIFEST_SCHEMA,
  verification:{integrity_ok:true,foreign_key_error_count:0},
  database_sha256:expectedSHA,
  database_size:11513856,
  table_counts:{pokemon:81,pokemon_subskills:398,pokemon_ingredients:239,import_changes:4028,
    candy_inventory:40,schema_migrations:16},
});
const receipt=Object.freeze({integrity_ok:true,foreign_key_errors:[],database_size:11513856,
  database_sha256:expectedSHA,table_counts:{...oldManifest.table_counts,public_event_master:4}});
const run=(overrides={})=>audit({oldManifest,newReceipt:receipt,stage:G141_RECEIPT_STAGES.IMMEDIATE,...overrides});
const pass=run();
assert.equal(pass.status,'EXACT_SQLITE_BYTES_PARITY_PASS');
assert.equal(pass.matched_table_count,6);
assert.equal(pass.player_rows_read,false);
assert.equal(pass.player_rows_written,false);
assert.ok(Object.isFrozen(pass));
assert.equal(run({oldManifest:null}).status,'DEVICE_INTEGRITY_PASS_ONLY');
assert.equal(audit({newReceipt:receipt}).reason,'OLD_PHONE_MANIFEST_NOT_PROVIDED');
assert.equal(run({newReceipt:{...receipt,integrity_ok:false}}).reason,'NEW_PHONE_SQLITE_INTEGRITY_NOT_PROVEN');
assert.equal(run({newReceipt:{...receipt,foreign_key_errors:1}}).status,'HOLD');
assert.equal(run({newReceipt:{...receipt,foreign_key_errors:[{table:'synthetic'}]}}).status,'HOLD');
assert.equal(run({newReceipt:{...receipt,database_size:0}}).status,'HOLD');
assert.equal(run({oldManifest:{...oldManifest,schema:'unknown'}}).reason,'OLD_PHONE_MANIFEST_NOT_VERIFIED');
assert.equal(run({oldManifest:{...oldManifest,verification:{integrity_ok:false,foreign_key_error_count:0}}}).status,'HOLD');
assert.equal(run({oldManifest:{...oldManifest,database_sha256:expectedSHA.slice(0,16)}}).reason,'OLD_PHONE_SHA_OR_SIZE_INVALID');
assert.equal(run({oldManifest:{...oldManifest,table_counts:{}}}).reason,'OLD_PHONE_TABLE_COUNTS_MISSING');
assert.equal(run({newReceipt:{...receipt,table_counts:{pokemon:81}}}).reason,'INCOMPLETE_OR_INVALID_TABLE_COUNTS');
assert.equal(run({newReceipt:{...receipt,table_counts:{...receipt.table_counts,pokemon:80}}}).reason,'IMMEDIATE_TABLE_COUNT_MISMATCH');
assert.equal(run({newReceipt:{...receipt,database_sha256:expectedSHA.slice(0,24)}}).status,'COUNT_PARITY_ONLY');
assert.equal(run({newReceipt:{...receipt,database_sha256:'b'.repeat(64)}}).reason,'IMMEDIATE_BYTE_PARITY_MISMATCH');
assert.equal(run({newReceipt:{...receipt,database_size:receipt.database_size+4096}}).status,'REVIEW_REQUIRED');
assert.equal(run({stage:'not_a_real_stage'}).reason,'UNKNOWN_RECEIPT_CAPTURE_STAGE');
assert.equal(run({stage:G141_RECEIPT_STAGES.RELOAD}).status,'EXACT_SQLITE_BYTES_PARITY_PASS');
assert.equal(run({stage:G141_RECEIPT_STAGES.RELOAD,
  newReceipt:{...receipt,database_sha256:'b'.repeat(64)}}).reason,'POST_RELOAD_BYTES_CHANGED_NOT_AUTOMATIC_DATA_LOSS');
assert.equal(run({stage:G141_RECEIPT_STAGES.RELOAD,
  newReceipt:{...receipt,table_counts:{...receipt.table_counts,pokemon:82}}}).reason,
  'POST_RELOAD_TABLE_COUNTS_DIFFER');
assert.equal(run({newReceipt:{...receipt,database_sha256:expectedSHA.toUpperCase()}}).status,
  'EXACT_SQLITE_BYTES_PARITY_PASS');
// Restore success modal and healthy new phone alone never proves OLD phone parity.
assert.notEqual(audit({newReceipt:receipt}).status,'EXACT_SQLITE_BYTES_PARITY_PASS');
console.log('PASS G14_1_REDACTED_MANIFEST_AND_NEW_PHONE_RECEIPT_EXACT_SHA_PARITY');
console.log('PASS G14_1_NO_OLD_MANIFEST_PARTIAL_SHA_FOREIGN_KEY_AND_COUNT_FAIL_CLOSED');
console.log('PASS G14_1_POSTRELOAD_PUBLIC_METADATA_DIFFERENCE_NOT_AUTO_DATA_LOSS');
