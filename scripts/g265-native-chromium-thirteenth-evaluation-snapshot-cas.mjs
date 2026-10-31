// G265 thirteenth evaluation snapshot: disposable native Chromium two-tab proof.
// Source-bound isolated opt-in only. Never open or write a player's IndexedDB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const legacy=fs.readFileSync(new URL('../assets/js/pokemon-evaluation-store.js',import.meta.url),'utf8');
const marker='export async function refreshFactEvaluationSnapshots(';
assert.equal(legacy.split(marker).length,2);
const operation=marker+legacy.split(marker)[1];
assert.match(operation,/await snapshot\('war-room:evaluation-snapshots'\)/);
assert.match(operation,/INSERT INTO pokemon_evaluation_snapshot\(/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(legacy,/sqlite-evaluation-snapshot-optin/);
console.log('PASS G265_THIRTEENTH_NATIVE_EXACT_LEGACY_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,status TEXT NOT NULL)');
seedDb.run("INSERT INTO pokemon VALUES('SYNTHETIC_SEED','active'),('SYNTHETIC_A','active'),('SYNTHETIC_B','active'),('SYNTHETIC_C','active'),('SYNTHETIC_D','active'),('SYNTHETIC_BLOCKED','active')");
seedDb.run("CREATE TABLE pokemon_evaluation_snapshot(evaluation_id TEXT PRIMARY KEY,pokemon_id TEXT NOT NULL,input_fingerprint TEXT NOT NULL,context_id TEXT,goal_profile_id TEXT,master_versions_json TEXT NOT NULL DEFAULT '{}',rule_version TEXT NOT NULL,intrinsic_score REAL,current_readiness_score REAL,weekly_fit_score REAL,roster_marginal_value_score REAL,training_roi_score REAL,score_breakdown_json TEXT NOT NULL DEFAULT '{}',reasons_json TEXT NOT NULL DEFAULT '[]',missing_inputs_json TEXT NOT NULL DEFAULT '[]',hard_constraint_status TEXT NOT NULL DEFAULT 'REVIEW',failed_constraints_json TEXT NOT NULL DEFAULT '[]',evaluation_status TEXT NOT NULL,evaluated_at TEXT NOT NULL,stale_at TEXT,UNIQUE(pokemon_id,input_fingerprint))");
seedDb.run("INSERT INTO pokemon_evaluation_snapshot(evaluation_id,pokemon_id,input_fingerprint,rule_version,evaluation_status,evaluated_at) VALUES('eval_seed','SYNTHETIC_SEED','synthetic:seed','SYNTHETIC_RULE','READY','2026-10-30T00:00:00.000Z')");
seedDb.run('CREATE TABLE public_event_master(event_id TEXT PRIMARY KEY,payload TEXT)');
seedDb.run("INSERT INTO public_event_master VALUES('fixture-event','SYNTHETIC_MASTER_UNCHANGED')");
seedDb.run("CREATE TRIGGER deny_fixture_evaluation BEFORE INSERT ON pokemon_evaluation_snapshot WHEN NEW.evaluation_id='eval_blocked' BEGIN SELECT RAISE(ABORT,'synthetic-evaluation-rejection'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const hash=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const seedHash=hash(seed);
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
const payload=(pokemonId,evaluationId,generation,sha256)=>({
  pokemonId,evaluationId,inputFingerprint:'synthetic:'+evaluationId,
  evaluatedAt:'2026-10-31T01:00:00.000Z',
  expectedCurrentEvaluationId:null,expectedGeneration:generation,
  expectedFingerprint:sha256,
  scores:{intrinsic:1,readiness:2,weekly:3,marginal:4,roi:5}
});
async function newTab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(new URL('g265-evaluation-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-evaluation-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createEvaluationSnapshotOptIn}=await import('/assets/js/sqlite-evaluation-snapshot-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-evaluation-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createEvaluationSnapshotOptIn,db:null,pair:null,writer:null,opened:0};
    window.__g265.reset=({denyLocks=false,loseAck=false}={})=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({
        db:v.db,locks:denyLocks?null:navigator.locks});
      const pair=loseAck?{
        write:request=>v.pair.write(request),
        readVerified:()=>{throw Object.assign(new Error('SYNTHETIC_ACK_READBACK_LOST'),
          {code:'SYNTHETIC_ACK_READBACK_LOST'});},
        status:()=>v.pair.status()
      }:v.pair;
      v.writer=v.createEvaluationSnapshotOptIn({
        pairGate:pair,openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}
      });
    };
    window.__g265.inspect=async()=>{
      const v=window.__g265;
      const fresh=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      const verified=await fresh.readVerified();
      const sql=new v.SQL.Database(verified.bytes);
      try{return {generation:verified.generation,sha256:verified.sha256,
        bytes:Array.from(verified.bytes),
        rows:sql.exec('SELECT evaluation_id,pokemon_id,stale_at FROM pokemon_evaluation_snapshot ORDER BY evaluation_id')?.[0]?.values||[],
        pokemon:sql.exec('SELECT * FROM pokemon ORDER BY pokemon_id')?.[0]?.values||[],
        master:sql.exec('SELECT * FROM public_event_master')?.[0]?.values||[]};
      }finally{sql.close();}
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const init=page=>page.evaluate(async()=>{
  window.__g265.db=await window.__g265.open();
  window.__g265.reset();
});
const inspect=page=>page.evaluate(()=>window.__g265.inspect());
const execute=(page,data)=>page.evaluate(async input=>{
  try{return {ok:true,result:await window.__g265.writer.execute(input)};}
  catch(error){return {ok:false,code:error.code||error.message};}
},data);
const find=(state,id)=>state.rows.find(row=>row[0]===id);
try{
  await context.route('**/g265-evaluation-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 isolated evaluation</title>'
  }));
  await context.route('**/g265-evaluation-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-evaluation-native.wasm',route=>route.fulfill({
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
  await init(a);await init(b);
  const before=await inspect(a);
  assert.equal(before.sha256,seedHash);
  assert.equal(before.rows.length,1);
  const results=await Promise.all([
    execute(a,payload('SYNTHETIC_A','eval_A',0,seedHash)),
    execute(b,payload('SYNTHETIC_B','eval_B',0,seedHash))
  ]);
  assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
  assert.equal(results.find(result=>!result.ok).code,'G265_PAIR_STALE_RELOAD_REQUIRED');
  const winner=results[0].ok?a:b,loser=results[0].ok?b:a;
  const winnerId=results[0].ok?'eval_A':'eval_B';
  const loserId=results[0].ok?'eval_B':'eval_A';
  assert.equal(await loser.evaluate(()=>window.__g265.opened),0);
  assert.equal(await loser.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const first=await inspect(winner);
  assert.equal(first.generation,1);assert.equal(first.sha256,hash(first.bytes));
  assert.equal(first.rows.length,2);assert.ok(find(first,winnerId));
  assert.equal(find(first,loserId),undefined);
  assert.deepEqual(first.master,before.master);
  assert.deepEqual(first.pokemon,before.pokemon);
  console.log('PASS G265_THIRTEENTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await loser.evaluate(()=>window.__g265.reset());
  const retry=await execute(loser,payload(results[0].ok?'SYNTHETIC_B':'SYNTHETIC_A',
    loserId,first.generation,first.sha256));
  assert.equal(retry.ok,true,JSON.stringify(retry));
  const second=await inspect(loser);
  assert.equal(second.generation,2);assert.equal(second.sha256,hash(second.bytes));
  assert.equal(second.rows.length,3);
  assert.ok(find(second,winnerId));assert.ok(find(second,loserId));
  assert.deepEqual(find(second,'eval_seed'),find(before,'eval_seed'));
  assert.deepEqual(second.master,before.master);
  console.log('PASS G265_THIRTEENTH_NATIVE_FRESH_RELOAD_PRESERVES_BOTH_ACKS');

  await winner.evaluate(()=>window.__g265.db.close());await winner.close();
  const c=await newTab();await init(c);
  assert.deepEqual(await inspect(c),second);
  const rollback=await execute(c,payload('SYNTHETIC_BLOCKED','eval_blocked',
    second.generation,second.sha256));
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/synthetic-evaluation-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();await init(d);
  assert.deepEqual(await inspect(d),second);
  console.log('PASS G265_THIRTEENTH_NATIVE_SQLJS_ROLLBACK_TAB_CLOSE_INDEPENDENT_READBACK');

  const e=await newTab();await init(e);
  await e.evaluate(()=>window.__g265.reset({loseAck:true}));
  const lost=await execute(e,payload('SYNTHETIC_C','eval_ack_lost',
    second.generation,second.sha256));
  assert.deepEqual(lost,{ok:false,code:'SYNTHETIC_ACK_READBACK_LOST'});
  assert.equal(await e.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const f=await newTab();await init(f);
  const afterLost=await inspect(f);
  assert.equal(afterLost.generation,3);
  assert.equal(afterLost.sha256,hash(afterLost.bytes));
  assert.ok(find(afterLost,'eval_ack_lost'));
  assert.deepEqual(afterLost.master,before.master);
  const replay=await execute(d,payload('SYNTHETIC_D','eval_stale_replay',
    second.generation,second.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(find(await inspect(f),'eval_stale_replay'),undefined);
  console.log('PASS G265_THIRTEENTH_NATIVE_ACK_LOSS_NO_REPLAY_STALE_REJECTED');

  const g=await newTab();await init(g);
  await g.evaluate(()=>window.__g265.reset({denyLocks:true}));
  const openedBefore=await g.evaluate(()=>window.__g265.opened);
  const denied=await execute(g,payload('SYNTHETIC_D','eval_no_lock',
    afterLost.generation,afterLost.sha256));
  assert.deepEqual(denied,{ok:false,code:'G265_PAIR_WEB_LOCKS_UNAVAILABLE'});
  assert.equal(await g.evaluate(()=>window.__g265.opened),openedBefore);
  assert.equal(await g.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(f),afterLost);
  console.log('PASS G265_THIRTEENTH_NATIVE_NO_WEB_LOCKS_FAIL_CLOSED_ZERO_DURABLE_DELTA');

  const healthy=await execute(f,payload('SYNTHETIC_D','eval_D',
    afterLost.generation,afterLost.sha256));
  assert.equal(healthy.ok,true,JSON.stringify(healthy));
  const h=await newTab();await init(h);
  const final=await inspect(h);
  assert.equal(final.generation,4);assert.equal(final.sha256,hash(final.bytes));
  assert.equal(final.rows.length,5);
  assert.ok(find(final,'eval_D'));
  assert.deepEqual(final.master,before.master);
  assert.deepEqual(final.pokemon,before.pokemon);
  console.log('PASS G265_THIRTEENTH_NATIVE_FRESH_TAB_RECOVERY_FINAL_DURABLE_READBACK');
  console.log('HOLD G265_THIRTEENTH_NATIVE_ISOLATED_NOT_PRODUCTION_ALL_WRITERS_CRASH_RESTORE_ANDROID');
}finally{
  for(const page of pages){if(!page.isClosed())await page.close().catch(()=>{});}
  await context.close();await browser.close();
}
