// G265 sixth exact legacy named-team draft: isolated native Chromium two-tab CAS/recovery.
// Disposable loopback origin, native Web Locks/IndexedDB and real SQL.js/WASM.
// No player database, game Apply, production wiring, service worker, or migration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/war-room-named-team-draft-store.js',import.meta.url),'utf8');
const marker='export async function saveNamedTeamDraftLocal(';
assert.equal(source.split(marker).length,2,'sixth exact legacy writer must remain unique');
const legacy=source.split(marker)[1];
assert.match(legacy,/await snapshot\('war-room:named-team-draft:'/);
assert.match(legacy,/await persist\(\)/);
assert.match(legacy,/INSERT INTO settings\(key,value_json,updated_at\)/);
assert.doesNotMatch(source,/sqlite-named-team-draft-optin/);
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const PREFIX='war-room:named-team-draft:v1:';
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
seedDb.run('CREATE TABLE strategy_goal_profile(goal_profile_id TEXT PRIMARY KEY,is_active INTEGER,updated_at TEXT)');
seedDb.run("INSERT INTO strategy_goal_profile VALUES('goal-fixture',1,'2026-10-29T00:00:00.000Z')");
seedDb.run("INSERT INTO settings VALUES('unrelated','{\"guard\":true}','2026-10-29T00:00:00.000Z')");
seedDb.run("CREATE TRIGGER deny_native_named_draft BEFORE INSERT ON settings WHEN NEW.key='war-room:named-team-draft:v1:draft_TTTTTTTTTTTTTTTT' BEGIN SELECT RAISE(ABORT,'native-named-draft-insert-rejection'); END");
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
  await page.goto(new URL('g265-named-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-named-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createNamedTeamDraftOptIn}=await import('/assets/js/sqlite-named-team-draft-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-named-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createNamedTeamDraftOptIn,opened:0,db:null,pair:null,writer:null};
    window.__g265.reset=()=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      v.writer=v.createNamedTeamDraftOptIn({pairGate:v.pair,
        openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}});
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const slots=Array.from({length:5},(_,i)=>({
  slot_index:i,is_leader:i===0,pokemon_id:'synthetic-species-'+i,
  pokemon_instance_id:'synthetic-instance-'+i,hard_constraint_status:'PASS'
}));
const team={team_status:'READY',team_id:'team-fixture',
  input_fingerprint:'team-input-fixture',optimizer_version:'fixture-v1',
  slots,missing_constraints:[],satisfied_constraints:[]};
const projection={projection_status:'READY',goal_profile_id:'goal-fixture',
  input_fingerprint:'projection-fixture',primary:team,alternatives:[],
  mandatory_member_count:0,mandatory_satisfied_count:0};
const input=(draftId,name,expectedGeneration,expectedFingerprint,
  capturedAt='2026-10-29T10:00:00.000Z')=>({
    draftId,name,projection,team,goalDraftState:'clean',capturedAt,
    expectedGeneration,expectedFingerprint
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
    records:sql.exec('SELECT key,value_json FROM settings ORDER BY key')?.[0]?.values||[]};
  }finally{sql.close();}
});
const drafts=state=>state.records.filter(row=>row[0].startsWith(PREFIX))
  .map(row=>[row[0].slice(PREFIX.length),JSON.parse(row[1]).payload.team_name,
    JSON.parse(row[1]).local_only,JSON.parse(row[1]).game_applied]);
try{
  await context.route('**/g265-named-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable named draft</title>'
  }));
  await context.route('**/g265-named-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-named-native.wasm',route=>route.fulfill({
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

  // Two actual Chromium documents race the same durable generation.
  // Only one ACK; the stale contender must fail before opening SQL.js.
  const idA='draft_AAAAAAAAAAAAAAAA',idB='draft_BBBBBBBBBBBBBBBB';
  const race=await Promise.all([
    run(a,input(idA,'Synthetic Alpha',0,seedHash)),
    run(b,input(idB,'Synthetic Beta',0,seedHash))
  ]);
  assert.equal(race.filter(x=>x.ok).length,1,JSON.stringify(race));
  assert.equal(race.filter(x=>!x.ok)[0].code,'G265_PAIR_STALE_RELOAD_REQUIRED');
  const winner=race[0].ok?[idA,'Synthetic Alpha']: [idB,'Synthetic Beta'];
  const active=race[0].ok?a:b,loser=race[0].ok?b:a;
  assert.equal(await loser.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await loser.evaluate(()=>window.__g265.opened),0,
    'stale contender must not open SQL.js');
  const first=await inspect(active);
  assert.equal(first.generation,1);
  assert.equal(first.sha256,digest(first.bytes));
  assert.deepEqual(drafts(first),[[winner[0],winner[1],true,false]]);
  assert.equal(first.records.find(row=>row[0]==='unrelated')[1],'{\"guard\":true}');
  console.log('PASS G265_SIXTH_NATIVE_TWO_TAB_ONE_ACK_STALE_ZERO_SQLJS_LOCAL_ONLY');

  // Explicit fresh session with the latest generation preserves both ACKed drafts.
  await loser.evaluate(()=>window.__g265.reset());
  const idC='draft_CCCCCCCCCCCCCCCC';
  const second=await run(loser,input(idC,'Synthetic Gamma',1,first.sha256,'2026-10-29T10:01:00.000Z'));
  assert.equal(second.ok,true,JSON.stringify(second));
  assert.equal(second.result.generation,2);
  assert.equal(second.result.gameApplied,false);
  assert.equal(second.result.localOnly,true);
  const after=await inspect(loser);
  assert.equal(after.generation,2);
  assert.equal(digest(after.bytes),after.sha256);
  assert.deepEqual(drafts(after),[
    [winner[0],winner[1],true,false],[idC,'Synthetic Gamma',true,false]
  ].sort((x,y)=>x[0].localeCompare(y[0])));
  assert.equal(after.records.find(row=>row[0]==='unrelated')[1],'{\"guard\":true}');
  console.log('PASS G265_SIXTH_NATIVE_FRESH_RELOAD_PRESERVES_BOTH_ACKED_LOCAL_DRAFTS');

  // Close the ACKing tab; independent new tab must read durable generation 2.
  // Blind replay from generation 1 must fail closed with zero SQL.js.
  await loser.evaluate(()=>window.__g265.db.close());
  await loser.close();
  const c=await newTab();
  await c.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const reloaded=await inspect(c);
  assert.deepEqual(reloaded,after);
  const openedBefore=await c.evaluate(()=>window.__g265.opened);
  const replay=await run(c,input(idC,'Synthetic Gamma',1,first.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(await c.evaluate(()=>window.__g265.opened),openedBefore);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_SIXTH_NATIVE_TAB_CLOSE_ACK_LOSS_STALE_REPLAY_ZERO_SQLJS');

  // Trigger-induced INSERT failure must synchronously rollback all SQL and
  // leave durable bytes, generation, SHA and unrelated data unchanged.
  await c.evaluate(()=>window.__g265.reset());
  const abort=await run(c,input('draft_TTTTTTTTTTTTTTTT','Synthetic Trigger',2,after.sha256,
    '2026-10-29T11:00:00.000Z'));
  assert.equal(abort.ok,false,JSON.stringify(abort));
  assert.match(abort.code,/native-named-draft-insert-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();
  await d.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const recovered=await inspect(d);
  assert.deepEqual(recovered,after);
  console.log('PASS G265_SIXTH_NATIVE_SQL_ROLLBACK_RELOAD_ZERO_DURABLE_DELTA');
  console.log('HOLD G265_SIXTH_NATIVE_OPTIN_NOT_PRODUCTION_23_LEGACY_NAMED_DRAFT_APPLY_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed()){
    try{await page.evaluate(()=>window.__g265?.db?.close());}catch{}
  }
  await context.close();await browser.close();
}
