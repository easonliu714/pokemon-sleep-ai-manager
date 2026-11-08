// G265: one named production entry (manual-editor::savePokemonDetail).
// Disposable SQL.js/IDB only. Fail before SQL when a competing tab advanced
// the durable revision, and retain a Web Lock through SQL mutation + ACK.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';

const manual=fs.readFileSync('assets/js/manual-editor.js','utf8');
const storage=fs.readFileSync('assets/js/storage.js','utf8');
const database=fs.readFileSync('assets/js/database.js','utf8');
const guard=fs.readFileSync('assets/js/sqlite-direct-write-window-guard.js','utf8');
const entry=manual.split('export async function savePokemonDetail(')[1];
assert.ok(entry,'named production writer must exist');
assert.match(entry,/withPrimarySqliteMutationLock\(/,'pre-SQL native lock admission missing');
assert.match(entry,/beginSqliteExclusiveWriteWindow\(/,'same-page SQL mutation window missing');
assert.match(entry,/persist\(\{primaryMutationLease:lease\}\)/,'save must reuse held lock, not deadlock');
assert.match(storage,/export async function withPrimarySqliteMutationLock\(/);
assert.match(storage,/primaryMutationLease===activePrimaryMutationLease/);
assert.match(database,/saveDatabaseBytes\(bytes,\{primaryMutationLease\}\)/);
assert.match(guard,/export function beginSqliteExclusiveWriteWindow\(/);
console.log('PASS G265_MANUAL_POKEMON_PRODUCTION_NAMED_ENTRY_SOURCE_BOUND_PRE_SQL_ADMISSION');

globalThis.crypto=webcrypto;
globalThis.indexedDB=indexedDB;
let tail=Promise.resolve(),held=0,waiting=0;
const locks={request(name,options,callback){
  assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
  assert.equal(options.mode,'exclusive');
  waiting++;
  const run=tail.then(async()=>{
    waiting--;
    if(options.signal?.aborted)throw Object.assign(Error('AbortError'),{name:'AbortError'});
    assert.equal(held++,0,'native lock must serialize contenders');
    try{return await callback({mode:'exclusive'});}finally{held--;}
  });
  tail=run.catch(()=>{});return run;
}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}});
const stamp='g265-manual-pokemon-'+Date.now();
const A=await import('../assets/js/storage.js?'+stamp+'-A');
const B=await import('../assets/js/storage.js?'+stamp+'-B');
const SQL=await initSqlJs();
const make=()=>{const db=new SQL.Database();db.run('CREATE TABLE pokemon (pokemon_id TEXT PRIMARY KEY,rating TEXT)');db.run("INSERT INTO pokemon VALUES('seed','S')");return db;};
const seed=make(),seedBytes=seed.export();seed.close();
assert.equal(await A.loadDatabaseBytes(),null);
await A.saveDatabaseBytes(seedBytes);
const aLoaded=await A.loadDatabaseBytes(),bLoaded=await B.loadDatabaseBytes();
assert.deepEqual(new Uint8Array(aLoaded),new Uint8Array(bLoaded));
let releaseA,enteredA,notifyA;
enteredA=new Promise(resolve=>{notifyA=resolve;});
const writeA=A.withPrimarySqliteMutationLock(async lease=>{
  notifyA();
  await new Promise(resolve=>{releaseA=resolve;});
  const db=new SQL.Database(new Uint8Array(aLoaded));
  db.run("INSERT INTO pokemon VALUES('A','A+')");
  const bytes=db.export();db.close();
  await A.saveDatabaseBytes(bytes,{primaryMutationLease:lease});
  return 'A_ACK';
});
await enteredA;
let bSqlCalls=0;
const writeB=B.withPrimarySqliteMutationLock(async lease=>{
  bSqlCalls++;
  const db=new SQL.Database(new Uint8Array(bLoaded));
  db.run("INSERT INTO pokemon VALUES('B','B+')");
  const bytes=db.export();db.close();
  await B.saveDatabaseBytes(bytes,{primaryMutationLease:lease});
});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(bSqlCalls,0,'B must not mutate SQL while A owns the lock');
assert.ok(waiting>=1,'B must queue behind A');
releaseA();
assert.equal(await writeA,'A_ACK');
await assert.rejects(writeB,e=>e.code==='SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
assert.equal(bSqlCalls,0,'stale B must never reach BEGIN/SQL');
const read=async()=>{
  const bytes=await A.loadDatabaseBytes();
  const db=new SQL.Database(new Uint8Array(bytes));
  const values=db.exec('SELECT pokemon_id,rating FROM pokemon ORDER BY pokemon_id')[0].values;
  db.close();return values;
};
assert.deepEqual(await read(),[['A','A+'],['seed','S']]);
console.log('PASS G265_MANUAL_POKEMON_TWO_TAB_LOCK_QUEUE_STALE_PRE_SQL_NO_ROW_LOSS');

await assert.rejects(B.withPrimarySqliteMutationLock(async()=>{bSqlCalls++;}),
  e=>e.code==='SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(bSqlCalls,0);
await assert.rejects(A.withPrimarySqliteMutationLock(async lease=>{
  const db=new SQL.Database(new Uint8Array(await A.loadDatabaseBytes()));
  db.run("INSERT INTO pokemon VALUES('ACK','C')");
  const bytes=db.export();db.close();
  await A.saveDatabaseBytes(bytes,{primaryMutationLease:lease});
  throw Object.assign(Error('synthetic post-commit ACK-loss'),{code:'SYNTHETIC_ACK_LOSS'});
}),e=>e.code==='SYNTHETIC_ACK_LOSS');
await assert.rejects(A.withPrimarySqliteMutationLock(async()=>{}),
  e=>e.code==='SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(await read(),[['A','A+'],['ACK','C'],['seed','S']]);
console.log('PASS G265_MANUAL_POKEMON_POST_WRITE_ACK_LOSS_STICKY_NO_RETRY');
A.closeStorageConnection();B.closeStorageConnection();
console.log('HOLD G265_OTHER_LEGACY_WRITERS_ANDROID_OWNER_UAT');
