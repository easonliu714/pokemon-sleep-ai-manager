// G265 eighth manual-item opt-in native Chromium: two-tab CAS, private audit,
// lost ACK, stale replay and SQL rollback. Disposable loopback/SQL.js only.
// Production manual-editor.js::saveItem(), player DB and public master untouched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const legacy=fs.readFileSync(new URL('../assets/js/manual-editor.js',import.meta.url),'utf8');
const exact=legacy.split('export async function saveItem(')[1]
  ?.split('export async function savePokemonDetail(')[0];
const audit=legacy.split('async function audit(')[1]
  ?.split('function emitPokemonEvaluationInputChanged(')[0];
assert.ok(exact&&audit,'eighth legacy writer and audit must remain source-bound');
assert.match(exact,/await snapshot\(/);
assert.match(exact,/await persist\(\)/);
assert.match(exact,/await audit\('item_inventory'/);
assert.match(audit,/INSERT INTO import_batches/);
assert.match(audit,/INSERT INTO import_changes/);
assert.doesNotMatch(legacy,/sqlite-manual-item-optin/);

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE item_master(item_name TEXT PRIMARY KEY)');
seedDb.run('CREATE TABLE item_inventory(item_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL,safe_reserve INTEGER NOT NULL,recommendation TEXT,updated_at TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedDb.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT,PRIMARY KEY(update_id,operation_index))');
for(const name of ['SYNTHETIC_SEED','SYNTHETIC_A','SYNTHETIC_B','SYNTHETIC_C','SYNTHETIC_BLOCKED'])
  seedDb.run('INSERT INTO item_master(item_name) VALUES(?)',[name]);
seedDb.run("INSERT INTO item_inventory VALUES('SYNTHETIC_SEED',3,1,'seed','2026-10-29T00:00:00.000Z','SYNTHETIC_SEED')");
seedDb.run("CREATE TRIGGER deny_native_item BEFORE INSERT ON item_inventory WHEN NEW.item_name='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'native-item-insert-rejection'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const digest=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const seedHash=digest(seed);
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
async function newTab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(new URL('g265-manual-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-manual-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createManualItemOptIn}=await import('/assets/js/sqlite-manual-item-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-manual-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createManualItemOptIn,opened:0,db:null,pair:null,writer:null};
    window.__g265.reset=()=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      v.writer=v.createManualItemOptIn({pairGate:v.pair,
        openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}});
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const input=(name,quantity,auditId,generation,sha256,updatedAt='2026-10-29T10:00:00.000Z')=>({
  name,quantity,reserve:2,recommendation:'native-synthetic',
  updatedAt,auditId,expectedGeneration:generation,expectedFingerprint:sha256
});
const run=(page,payload)=>page.evaluate(async data=>{
  try{return {ok:true,result:await window.__g265.writer.execute(data)};}
  catch(error){return {ok:false,code:error.code||error.message};}
},payload);
const inspect=page=>page.evaluate(async()=>{
  const v=window.__g265;
  const current=await v.pair.readVerified();
  const sql=new v.SQL.Database(current.bytes);
  try{
    const rows=query=>sql.exec(query)?.[0]?.values||[];
    return {generation:current.generation,sha256:current.sha256,
      bytes:Array.from(current.bytes),
      items:rows('SELECT item_name,quantity,safe_reserve,recommendation FROM item_inventory ORDER BY item_name'),
      batches:rows('SELECT update_id,source,operation_count FROM import_batches ORDER BY update_id'),
      changes:rows('SELECT update_id,entity,action,before_json,after_json FROM import_changes ORDER BY update_id'),
      masters:rows('SELECT item_name FROM item_master ORDER BY item_name')};
  }finally{sql.close();}
});
const hasItem=(state,name)=>state.items.find(row=>row[0]===name);
try{
  await context.route('**/g265-manual-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable manual item</title>'
  }));
  await context.route('**/g265-manual-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-manual-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await newTab(),b=await newTab();
  await a.evaluate(bytes=>window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(async sha256=>{
    const db=await window.__g265.open();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation:0,sha256},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },seedHash);
  for(const page of [a,b])await page.evaluate(async()=>{
    window.__g265.db=await window.__g265.open();window.__g265.reset();
  });

  // Real independent Chromium tabs contend for the same durable revision.
  // The losing tab must not open SQL.js or emit a private audit record.
  const race=await Promise.all([
    run(a,input('SYNTHETIC_A',11,'MANUAL-G265-NATIVE-A',0,seedHash)),
    run(b,input('SYNTHETIC_B',22,'MANUAL-G265-NATIVE-B',0,seedHash))
  ]);
  assert.equal(race.filter(x=>x.ok).length,1,JSON.stringify(race));
  assert.equal(race.filter(x=>!x.ok)[0].code,'G265_PAIR_STALE_RELOAD_REQUIRED');
  const active=race[0].ok?a:b,loser=race[0].ok?b:a;
  const winnerName=race[0].ok?'SYNTHETIC_A':'SYNTHETIC_B';
  const losingName=race[0].ok?'SYNTHETIC_B':'SYNTHETIC_A';
  assert.equal(await loser.evaluate(()=>window.__g265.opened),0);
  assert.equal(await loser.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const first=await inspect(active);
  assert.equal(first.generation,1);
  assert.equal(first.sha256,digest(first.bytes));
  assert.equal(first.batches.length,1);
  assert.equal(first.changes.length,1);
  assert.ok(hasItem(first,winnerName));
  assert.equal(hasItem(first,losingName),undefined);
  console.log('PASS G265_EIGHTH_NATIVE_TWO_TAB_ONE_ACK_STALE_ZERO_SQLJS_AND_AUDIT');

  // A newly initialized opt-in adapter uses latest durable bytes and appends
  // the second item and both audit records without losing the first ACK.
  await loser.evaluate(()=>window.__g265.reset());
  const second=await run(loser,input(losingName,33,'MANUAL-G265-NATIVE-C',1,first.sha256,'2026-10-29T10:01:00.000Z'));
  assert.equal(second.ok,true,JSON.stringify(second));
  const after=await inspect(loser);
  assert.equal(after.generation,2);
  assert.equal(after.sha256,digest(after.bytes));
  assert.equal(after.items.length,3);
  assert.equal(after.batches.length,2);
  assert.equal(after.changes.length,2);
  assert.deepEqual(hasItem(after,'SYNTHETIC_SEED'),hasItem(first,'SYNTHETIC_SEED'));
  assert.deepEqual(after.masters,first.masters,'Public Master must remain unchanged');
  assert.deepEqual(after.batches.map(row=>row[0]).sort(),
    [first.batches[0][0],'MANUAL-G265-NATIVE-C'].sort());
  console.log('PASS G265_EIGHTH_NATIVE_FRESH_DURABLE_ITEM_AUDIT_PAIR_AND_MASTER_PRESERVED');

  // Simulate a lost ACK by closing the successful tab and opening a fresh tab.
  // An old revision replay is rejected before SQL.js and leaves audit intact.
  await loser.evaluate(()=>window.__g265.db.close());
  await loser.close();
  const c=await newTab();
  await c.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(c),after);
  const openedBefore=await c.evaluate(()=>window.__g265.opened);
  const replay=await run(c,input('SYNTHETIC_C',44,'MANUAL-G265-NATIVE-REPLAY',1,first.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(await c.evaluate(()=>window.__g265.opened),openedBefore);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_EIGHTH_NATIVE_TAB_CLOSE_LOST_ACK_STALE_REPLAY_NO_AUDIT_DELTA');

  // Both replayed audit IDs and SQL trigger aborts fail closed, with a fresh
  // independent tab proving byte-identical durable pair and private audit.
  await c.evaluate(()=>window.__g265.reset());
  const duplicate=await run(c,input('SYNTHETIC_C',44,first.batches[0][0],2,after.sha256));
  assert.deepEqual(duplicate,{ok:false,code:'G265_MANUAL_ITEM_AUDIT_ID_REPLAY'});
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  await c.evaluate(()=>window.__g265.reset());
  const abort=await run(c,input('SYNTHETIC_BLOCKED',99,'MANUAL-G265-NATIVE-ABORT',2,after.sha256));
  assert.equal(abort.ok,false,JSON.stringify(abort));
  assert.match(abort.code,/native-item-insert-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();
  await d.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(d),after);
  console.log('PASS G265_EIGHTH_NATIVE_AUDIT_REPLAY_SQL_ROLLBACK_ZERO_DURABLE_DELTA');
  console.log('HOLD G265_EIGHTH_NATIVE_OPTIN_NOT_PRODUCTION_23_LEGACY_CRASH_RECOVERY_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed()){
    try{await page.evaluate(()=>window.__g265?.db?.close());}catch{}
  }
  await context.close();await browser.close();
}
