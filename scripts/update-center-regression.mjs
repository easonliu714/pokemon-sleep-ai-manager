import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {indexedDB, IDBKeyRange} from 'fake-indexeddb';

globalThis.indexedDB=indexedDB;
globalThis.IDBKeyRange=IDBKeyRange;
globalThis.initSqlJs=async()=>initSqlJs();

const database=await import('../assets/js/database.js');
const importer=await import('../assets/js/importer.js');
const storage=await import('../assets/js/storage.js');

await storage.clearAllStorage();
await database.initializeDatabase();

const payload={
  schema_version:'1.1',
  update_id:'TEST-UPDATE-001',
  generated_at:'2026-07-31T00:00:00+08:00',
  source:'ci-fixture',
  operations:[
    {
      entity:'ingredient_inventory',
      action:'upsert',
      key:{ingredient_name:'測試食材'},
      data:{quantity:12,updated_at:'2026-07-31T00:00:00+08:00',source_update_id:'TEST-UPDATE-001'},
    },
    {
      entity:'settings',
      action:'upsert',
      key:{key:'ci_marker'},
      data:{value_json:'{"ok":true}',updated_at:'2026-07-31T00:00:00+08:00'},
    },
  ],
};

const preview=importer.dryRun(payload);
assert.equal(preview.conflict_count,0);
assert.equal(preview.ready_count,2);

const beforeSnapshots=await storage.listSnapshots();
await importer.applyPayload(payload);
const afterSnapshots=await storage.listSnapshots();
assert.equal(afterSnapshots.length,beforeSnapshots.length+1,'apply must create a snapshot');
assert.equal(database.scalar('SELECT quantity FROM ingredient_inventory WHERE ingredient_name=?',['測試食材']),12);
assert.equal(database.scalar('SELECT COUNT(*) FROM import_batches WHERE update_id=?',[payload.update_id]),1);
assert.equal(database.scalar('SELECT COUNT(*) FROM import_changes WHERE update_id=?',[payload.update_id]),2);

assert.throws(()=>importer.dryRun(payload),/update_id 已套用/,'duplicate update_id must be rejected');

const backup=database.exportBytes();
database.run('UPDATE ingredient_inventory SET quantity=99 WHERE ingredient_name=?',['測試食材']);
await database.persist();
await database.replaceDatabase(backup);
assert.equal(database.scalar('SELECT quantity FROM ingredient_inventory WHERE ingredient_name=?',['測試食材']),12,'restore must recover backup value');
assert.equal(database.rows('PRAGMA integrity_check')[0].integrity_check,'ok');

const rollbackPayload={
  schema_version:'1.1',
  update_id:'TEST-UPDATE-ROLLBACK',
  generated_at:'2026-07-31T00:00:00+08:00',
  source:'ci-fixture',
  operations:[
    {
      entity:'settings',
      action:'insert',
      key:{key:'rollback_marker'},
      data:{value_json:'{"step":1}',updated_at:'2026-07-31T00:00:00+08:00'},
    },
    {
      entity:'settings',
      action:'insert',
      key:{key:'rollback_marker'},
      data:{value_json:'{"step":2}',updated_at:'2026-07-31T00:00:00+08:00'},
    },
  ],
};

let failed=false;
try{
  await importer.applyPayload(rollbackPayload);
}catch{
  failed=true;
}
assert.equal(failed,true,'invalid transactional apply must fail');
assert.equal(database.scalar('SELECT COUNT(*) FROM settings WHERE key=?',['rollback_marker']),0,'rollback must remove partial writes');
assert.equal(database.scalar('SELECT COUNT(*) FROM import_batches WHERE update_id=?',[rollbackPayload.update_id]),0);
assert.equal(database.rows('PRAGMA integrity_check')[0].integrity_check,'ok');

console.log('PASS update center: dry-run, snapshot, apply, duplicate guard, rollback, backup/restore, integrity_check');
