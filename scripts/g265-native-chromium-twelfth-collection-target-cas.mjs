// G265 twelfth collection target: disposable native Chromium two-tab CAS/recovery.
// Real SQL.js/WASM, native Web Locks and IndexedDB on loopback; never a player DB.
// The production legacy collectionAddForm remains unchanged and unsafe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const legacy=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const marker='export function setupG3Pages() {';
assert.equal(legacy.split(marker).length,2);
const operation=legacy.slice(legacy.indexOf(marker));
assert.match(operation,/document\.getElementById\('collectionAddForm'\)\.onsubmit/);
assert.match(operation,/await snapshot\('manual:collection-target'\)/);
assert.match(operation,/INSERT OR REPLACE INTO collection_targets/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-collection-target-optin/);
console.log('PASS G265_TWELFTH_NATIVE_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE collection_targets(target_id TEXT PRIMARY KEY,species TEXT NOT NULL,target_type TEXT,priority TEXT,camp TEXT,desired_traits TEXT,capture_strategy TEXT,status TEXT,notes TEXT,updated_at TEXT NOT NULL)');
seedDb.run("INSERT INTO collection_targets VALUES('target_seed','SYNTHETIC_SEED','observe','B','','','','active','','2026-10-29T00:00:00.000Z')");
seedDb.run('CREATE TABLE public_event_master(event_id TEXT PRIMARY KEY,payload TEXT)');
seedDb.run("INSERT INTO public_event_master VALUES('fixture-event','SYNTHETIC_PUBLIC_MASTER_UNCHANGED')");
seedDb.run("CREATE TRIGGER deny_native_collection_target BEFORE INSERT ON collection_targets WHEN NEW.species='SYNTHETIC_BLOCKED' BEGIN SELECT RAISE(ABORT,'native-collection-target-insert-rejection'); END");
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
  await page.goto(new URL('g265-target-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-target-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createCollectionTargetOptIn}=await import('/assets/js/sqlite-collection-target-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-target-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const req=indexedDB.open('pokemon_sleep_ai_manager');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createCollectionTargetOptIn,opened:0,db:null,pair:null,writer:null};
    window.__g265.reset=()=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      v.writer=v.createCollectionTargetOptIn({pairGate:v.pair,
        openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}});
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const input=(targetId,species,generation,sha256,
  updatedAt='2026-10-30T01:00:00.000Z',expectedPreviousUpdatedAt=null)=>({
    targetId,species,targetType:'observe',priority:'A',camp:'SYNTHETIC_CAMP',
    desiredTraits:'SYNTHETIC_TRAITS',captureStrategy:'SYNTHETIC_STRATEGY',
    updatedAt,expectedPreviousUpdatedAt,expectedGeneration:generation,
    expectedFingerprint:sha256
  });
const run=(page,payload)=>page.evaluate(async data=>{
  try{return {ok:true,result:await window.__g265.writer.execute(data)};}
  catch(error){return {ok:false,code:error.code||error.message};}
},payload);
const inspect=page=>page.evaluate(async()=>{
  const v=window.__g265;
  const current=await v.pair.readVerified();
  const sql=new v.SQL.Database(current.bytes);
  try{return {generation:current.generation,sha256:current.sha256,
    bytes:Array.from(current.bytes),
    rows:sql.exec('SELECT target_id,species,status,updated_at FROM collection_targets ORDER BY target_id')?.[0]?.values||[],
    master:sql.exec('SELECT event_id,payload FROM public_event_master')?.[0]?.values||[]};
  }finally{sql.close();}
});
const has=(state,id)=>state.rows.find(row=>row[0]===id);
try{
  await context.route('**/g265-target-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable weekly context</title>'
  }));
  await context.route('**/g265-target-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-target-native.wasm',route=>route.fulfill({
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

  // Invalid identity or blank species must fail before any SQL.js open.
  const invalid=await run(a,input('target_invalid','',0,seedHash));
  assert.deepEqual(invalid,{ok:false,code:'G265_COLLECTION_TARGET_INPUT_INVALID'});
  const invalidId=await run(a,input('other_invalid','SYNTHETIC_BAD',0,seedHash));
  assert.deepEqual(invalidId,{ok:false,code:'G265_COLLECTION_TARGET_INPUT_INVALID'});
  assert.equal(await a.evaluate(()=>window.__g265.opened),0);
  assert.equal((await inspect(a)).generation,0);
  console.log('PASS G265_TWELFTH_NATIVE_INVALID_SPECIES_ID_PRE_SQL');

  // Malformed UTC provenance and control characters must be rejected before
  // SQL.js opens, with no durable bytes/generation or public-master changes.
  const baseline=await inspect(a);
  const badUpdatedAt=await run(a,input('target_bad_time','SYNTHETIC_TIME',0,seedHash,
    '2026-10-30T01:00:00Z'));
  assert.deepEqual(badUpdatedAt,{ok:false,code:'G265_COLLECTION_TARGET_PROVENANCE_INVALID'});
  const badPreviousAt=await run(a,input('target_bad_previous','SYNTHETIC_PREVIOUS',0,seedHash,
    '2026-10-30T01:00:00.000Z','2026-10-30T99:00:00.000Z'));
  assert.deepEqual(badPreviousAt,{ok:false,code:'G265_COLLECTION_TARGET_PROVENANCE_INVALID'});
  const controlChar=await run(a,input('target_bad_control','SYNTHETIC'+String.fromCharCode(0)+'CONTROL',0,seedHash));
  assert.deepEqual(controlChar,{ok:false,code:'G265_COLLECTION_TARGET_INPUT_INVALID'});
  assert.equal(await a.evaluate(()=>window.__g265.opened),0);
  assert.deepEqual(await inspect(b),baseline);
  console.log('PASS G265_TWELFTH_NATIVE_PROVENANCE_CONTROL_PRE_SQL_ZERO_DURABLE_DELTA');

  const race=await Promise.all([
    run(a,input('target_a','SYNTHETIC_A',0,seedHash)),
    run(b,input('target_b','SYNTHETIC_B',0,seedHash))
  ]);
  assert.equal(race.filter(x=>x.ok).length,1,JSON.stringify(race));
  assert.equal(race.filter(x=>!x.ok)[0].code,'G265_PAIR_STALE_RELOAD_REQUIRED');
  const active=race[0].ok?a:b,loser=race[0].ok?b:a;
  const winnerId=race[0].ok?'target_a':'target_b';
  const loserId=race[0].ok?'target_b':'target_a';
  assert.equal(await loser.evaluate(()=>window.__g265.opened),0);
  assert.equal(await loser.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const first=await inspect(active);
  assert.equal(first.generation,1);assert.equal(first.sha256,digest(first.bytes));
  assert.equal(first.rows.length,2);assert.ok(has(first,winnerId));
  assert.equal(has(first,loserId),undefined);
  assert.deepEqual(first.master,[['fixture-event','SYNTHETIC_PUBLIC_MASTER_UNCHANGED']]);
  console.log('PASS G265_TWELFTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await loser.evaluate(()=>window.__g265.reset());
  const second=await run(loser,input(loserId,'SYNTHETIC_SECOND',1,first.sha256,
    '2026-10-30T01:01:00.000Z'));
  assert.equal(second.ok,true,JSON.stringify(second));
  const after=await inspect(loser);
  assert.equal(after.generation,2);assert.equal(after.sha256,digest(after.bytes));
  assert.equal(after.rows.length,3);
  assert.deepEqual(has(after,'target_seed'),has(first,'target_seed'));
  assert.deepEqual(has(after,winnerId),has(first,winnerId));
  assert.ok(has(after,loserId));
  assert.deepEqual(after.master,first.master);
  console.log('PASS G265_TWELFTH_NATIVE_FRESH_DURABLE_ALL_ACK_TARGETS_MASTER_PRESERVED');

  await active.evaluate(()=>window.__g265.reset());
  const wrong=await run(active,input(winnerId,'SYNTHETIC_REPLACE',2,after.sha256,
    '2026-10-30T01:02:00.000Z',null));
  assert.deepEqual(wrong,{ok:false,code:'G265_COLLECTION_TARGET_PREVIOUS_REVISION_CHANGED'});
  assert.equal(await active.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(loser),after);
  console.log('PASS G265_TWELFTH_NATIVE_PREVIOUS_ROW_REVISION_CONFLICT_ZERO_DURABLE_DELTA');

  await active.evaluate(()=>window.__g265.reset());
  const update=await run(active,input(winnerId,'SYNTHETIC_REPLACE',2,after.sha256,
    '2026-10-30T01:02:00.000Z','2026-10-30T01:00:00.000Z'));
  assert.equal(update.ok,true,JSON.stringify(update));
  const updated=await inspect(active);
  assert.equal(updated.generation,3);assert.equal(updated.sha256,digest(updated.bytes));
  assert.equal(has(updated,winnerId)[1],'SYNTHETIC_REPLACE');
  assert.deepEqual(has(updated,loserId),has(after,loserId));
  assert.deepEqual(updated.master,after.master);
  console.log('PASS G265_TWELFTH_NATIVE_EXACT_ROW_PRECONDITION_ACK_READBACK');

  await active.evaluate(()=>window.__g265.db.close());await active.close();
  const c=await newTab();
  await c.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(c),updated);
  const openedBefore=await c.evaluate(()=>window.__g265.opened);
  const replay=await run(c,input('target_replay','SYNTHETIC_REPLAY',2,after.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(await c.evaluate(()=>window.__g265.opened),openedBefore);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_TWELFTH_NATIVE_TAB_CLOSE_ACK_LOSS_STALE_REPLAY_ZERO_SQLJS');

  await c.evaluate(()=>window.__g265.reset());
  const abort=await run(c,input('target_blocked','SYNTHETIC_BLOCKED',3,updated.sha256));
  assert.equal(abort.ok,false,JSON.stringify(abort));
  assert.match(abort.code,/native-collection-target-insert-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();
  await d.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(d),updated);
  console.log('PASS G265_TWELFTH_NATIVE_SQL_ROLLBACK_INDEPENDENT_DURABLE_READBACK_UNCHANGED');

  // Synthetic torn metadata: never repair a digest mismatch automatically.
  // A fresh tab must fail closed before opening SQL.js; only an explicit
  // fixture-only metadata repair can permit a newly constructed reader.
  const beforeTorn=await inspect(d);
  const openedBeforeTorn=await d.evaluate(()=>window.__g265.opened);
  await d.evaluate(async generation=>{
    const db=window.__g265.db;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put({generation,sha256:'0'.repeat(64)},'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  },beforeTorn.generation);
  await d.evaluate(()=>window.__g265.reset());
  const torn=await run(d,input('target_torn','SYNTHETIC_TORN',beforeTorn.generation,beforeTorn.sha256));
  assert.deepEqual(torn,{ok:false,code:'G265_PAIR_DIGEST_MISMATCH'});
  assert.equal(await d.evaluate(()=>window.__g265.opened),openedBeforeTorn);
  assert.equal(await d.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await d.evaluate(async()=>
    Array.from(new Uint8Array(await window.__g265.storage.loadDatabaseBytes()))),beforeTorn.bytes);
  const e=await newTab();
  await e.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const secondTorn=await run(e,input('target_torn_other','SYNTHETIC_OTHER',beforeTorn.generation,beforeTorn.sha256));
  assert.deepEqual(secondTorn,{ok:false,code:'G265_PAIR_DIGEST_MISMATCH'});
  assert.equal(await e.evaluate(()=>window.__g265.opened),0);
  // Explicit repair is restricted to this disposable fixture, never the player DB.
  await d.evaluate(async revision=>{
    await new Promise((resolve,reject)=>{
      const tx=window.__g265.db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put(revision,'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  },{generation:beforeTorn.generation,sha256:beforeTorn.sha256});
  const f=await newTab();
  await f.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(f),beforeTorn);
  assert.equal(await d.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await e.evaluate(()=>window.__g265.writer.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_TWELFTH_NATIVE_TORN_METADATA_FAIL_CLOSED_EXPLICIT_FIXTURE_REPAIR_ONLY');
  // Disposable crash-boundary negative: revision metadata can disappear while
  // durable SQLite bytes remain. No tab may silently bootstrap or persist.
  // Recovery below is explicit fixture repair, not a player-data operation.
  const beforeMissing=await inspect(f);
  await f.evaluate(async()=>{
    await new Promise((resolve,reject)=>{
      const tx=window.__g265.db.transaction('metadata','readwrite');
      tx.objectStore('metadata').delete('revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  });
  const g=await newTab();
  await g.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const missing=await run(g,input('target_missing_revision','SYNTHETIC_MISSING',
    beforeMissing.generation,beforeMissing.sha256));
  assert.deepEqual(missing,{ok:false,code:'G265_PAIR_MISSING_OR_INVALID'});
  assert.equal(await g.evaluate(()=>window.__g265.opened),0);
  assert.equal(await g.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await g.evaluate(async()=>
    Array.from(new Uint8Array(await window.__g265.storage.loadDatabaseBytes()))),
    beforeMissing.bytes);
  const h=await newTab();
  await h.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const missingAgain=await run(h,input('target_missing_revision_other','SYNTHETIC_OTHER',
    beforeMissing.generation,beforeMissing.sha256));
  assert.deepEqual(missingAgain,{ok:false,code:'G265_PAIR_MISSING_OR_INVALID'});
  assert.equal(await h.evaluate(()=>window.__g265.opened),0);
  await f.evaluate(async revision=>{
    await new Promise((resolve,reject)=>{
      const tx=window.__g265.db.transaction('metadata','readwrite');
      tx.objectStore('metadata').put(revision,'revision:primary');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  },{generation:beforeMissing.generation,sha256:beforeMissing.sha256});
  const i=await newTab();
  await i.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(i),beforeMissing);
  assert.equal(await g.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await h.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_TWELFTH_NATIVE_MISSING_REVISION_FAIL_CLOSED_FIXTURE_REPAIR_ONLY');

  // Disposable crash-boundary negative: durable bytes change without matching
  // revision metadata. Never infer success, rewrite metadata or auto-restore.
  // The explicit byte restoration below is confined to this synthetic fixture.
  const beforeBytesTorn=await inspect(i);
  const alteredBytes=beforeBytesTorn.bytes.slice();
  alteredBytes[alteredBytes.length-1]^=1;
  assert.notEqual(digest(alteredBytes),beforeBytesTorn.sha256);
  await i.evaluate(async bytes=>
    window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),alteredBytes);
  const j=await newTab();
  await j.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const bytesTorn=await run(j,input('target_bytes_torn','SYNTHETIC_BYTES_TORN',
    beforeBytesTorn.generation,beforeBytesTorn.sha256));
  assert.deepEqual(bytesTorn,{ok:false,code:'G265_PAIR_DIGEST_MISMATCH'});
  assert.equal(await j.evaluate(()=>window.__g265.opened),0);
  assert.equal(await j.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const k=await newTab();
  await k.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const secondBytesTorn=await run(k,input('target_bytes_torn_other','SYNTHETIC_OTHER',
    beforeBytesTorn.generation,beforeBytesTorn.sha256));
  assert.deepEqual(secondBytesTorn,{ok:false,code:'G265_PAIR_DIGEST_MISMATCH'});
  assert.equal(await k.evaluate(()=>window.__g265.opened),0);
  assert.deepEqual(await k.evaluate(async()=>
    Array.from(new Uint8Array(await window.__g265.storage.loadDatabaseBytes()))),
    alteredBytes);
  // Fixture-only explicit repair: no automatic metadata or durable repair.
  await i.evaluate(async bytes=>
    window.__g265.storage.saveDatabaseBytes(Uint8Array.from(bytes)),beforeBytesTorn.bytes);
  const l=await newTab();
  await l.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  assert.deepEqual(await inspect(l),beforeBytesTorn);
  assert.equal(await j.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await k.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_TWELFTH_NATIVE_DURABLE_BYTES_TORN_FAIL_CLOSED_FIXTURE_REPAIR_ONLY');

  console.log('HOLD G265_TWELFTH_NATIVE_OPTIN_NOT_PRODUCTION_ALL_WRITERS_CRASH_RESTORE_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed()){
    try{await page.evaluate(()=>window.__g265?.db?.close());}catch{}
  }
  await context.close();await browser.close();
}
