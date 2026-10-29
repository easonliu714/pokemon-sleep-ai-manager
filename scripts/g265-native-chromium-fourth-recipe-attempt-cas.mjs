// G265 fourth legacy recipe attempt: native Chromium two-tab opt-in only.
// Disposable loopback origin, native Web Locks/IndexedDB and real SQL.js/WASM.
// No player database, app mount, service worker, migration or production wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
import {PUBLIC_RECIPE_PROVENANCE} from '../assets/js/public-recipe-provenance.js';
import {applyRecipeAttemptFeedbackSchema} from '../assets/js/recipe-attempt-feedback.js';

const source=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
const legacy=source.split('export async function recordRecipeAttemptFailure(')[1]
  ?.split('// G6.2: share the attempt-write')[0];
assert.ok(legacy&&/INSERT INTO recipe_attempt_feedback/.test(legacy)
  &&/INSERT INTO recipe_feedback_state/.test(legacy)&&/await persist\(\)/.test(legacy));
assert.doesNotMatch(source,/sqlite-recipe-attempt-failure-optin/);
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const provenance=PUBLIC_RECIPE_PROVENANCE.find(x=>x.lifecycle==='ACTIVE'&&x.formula_source_ref);
assert.ok(provenance);
const recipeId=provenance.recipe_id;
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE recipe_master(recipe_id TEXT PRIMARY KEY,recipe_name TEXT,category TEXT)');
seedDb.run('INSERT INTO recipe_master VALUES(?,?,?)',[recipeId,provenance.recipe_name_zh_tw,provenance.category]);
seedDb.run('CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY)');
seedDb.run('INSERT INTO ingredient_master VALUES(?)',['native-fixture-ingredient']);
applyRecipeAttemptFeedbackSchema(seedDb);
seedDb.run("INSERT INTO recipe_feedback_state VALUES('unrelated',1,1,'keep','2026-10-01T00:00:00.000Z')");
seedDb.run(`CREATE TRIGGER deny_native_second_statement BEFORE UPDATE ON recipe_feedback_state
  WHEN NEW.updated_at='2026-10-29T11:00:00.000Z'
  BEGIN SELECT RAISE(ABORT,'native-second-statement-rejection'); END`);
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
  await page.goto(new URL('g265-attempt-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-attempt-native.js',base).href});
  await page.evaluate(async()=>{
    const storage=await import('/assets/js/storage.js');
    const {createSqliteVersionNeutralAtomicPairGate}=await import('/assets/js/sqlite-version-neutral-atomic-pair-gate.js');
    const {createRecipeAttemptFailureOptIn}=await import('/assets/js/sqlite-recipe-attempt-failure-optin.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-attempt-native.wasm'});
    const open=()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('pokemon_sleep_ai_manager');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    window.__g265={storage,SQL,open,createSqliteVersionNeutralAtomicPairGate,
      createRecipeAttemptFailureOptIn,opened:0,db:null,pair:null,writer:null};
    window.__g265.reset=()=>{
      const v=window.__g265;
      v.pair=v.createSqliteVersionNeutralAtomicPairGate({db:v.db});
      v.writer=v.createRecipeAttemptFailureOptIn({pairGate:v.pair,
        openSqlite:bytes=>{v.opened++;return new v.SQL.Database(bytes);}});
    };
  });
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,digest:true});
  return page;
}
const input=(attemptId,expectedGeneration,expectedFingerprint,createdAt='2026-10-29T10:00:00.000Z')=>({
  attemptId,recipeId,attemptedAt:'2026-10-29T10:00:00.000Z',createdAt,
  actualIngredients:[{ingredient_name:'native-fixture-ingredient',quantity:2}],
  referenceMaybeWrong:true,recommendationPaused:true,notes:'disposable browser fixture',
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
    attempts:sql.exec('SELECT attempt_id FROM recipe_attempt_feedback ORDER BY attempt_id')?.[0]?.values||[],
    states:sql.exec('SELECT recipe_id,last_attempt_id FROM recipe_feedback_state ORDER BY recipe_id')?.[0]?.values||[]};
  }finally{sql.close();}
});
try{
  await context.route('**/g265-attempt-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable attempt</title>'
  }));
  await context.route('**/g265-attempt-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-attempt-native.wasm',route=>route.fulfill({
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
  const race=await Promise.all([
    run(a,input('native-a',0,seedHash)),
    run(b,input('native-b',0,seedHash))
  ]);
  assert.equal(race.filter(x=>x.ok).length,1,JSON.stringify(race));
  assert.equal(race.filter(x=>!x.ok)[0].code,'G265_PAIR_STALE_RELOAD_REQUIRED');
  const winner=race[0].ok?'native-a':'native-b';
  const loser=race[0].ok?b:a;
  assert.equal(await loser.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await loser.evaluate(()=>window.__g265.opened),0,
    'stale contender must not open SQL.js');
  const active=race[0].ok?a:b;
  const first=await inspect(active);
  assert.equal(first.generation,1);
  assert.equal(digest(first.bytes),first.sha256);
  assert.deepEqual(first.attempts,[[winner]]);
  assert.deepEqual(first.states.find(x=>x[0]==='unrelated'),['unrelated','keep']);
  console.log('PASS G265_FOURTH_NATIVE_TWO_TAB_ONE_ACK_STALE_ZERO_SQLJS_TWO_TABLE_READBACK');

  // The losing tab must explicitly reload a new session; never reuse sticky HOLD.
  await loser.evaluate(()=>window.__g265.reset());
  const second=await run(loser,input('native-second',1,first.sha256,'2026-10-29T10:01:00.000Z'));
  assert.equal(second.ok,true,JSON.stringify(second));
  assert.equal(second.result.generation,2);
  const after=await inspect(loser);
  assert.deepEqual(after.attempts,[[winner],['native-second']].sort((x,y)=>x[0].localeCompare(y[0])));
  assert.equal(after.states.find(x=>x[0]===recipeId)[1],'native-second');
  assert.equal(after.states.find(x=>x[0]==='unrelated')[1],'keep');
  assert.equal(digest(after.bytes),after.sha256);
  console.log('PASS G265_FOURTH_NATIVE_FRESH_RELOAD_CAS_PRESERVES_BOTH_ACKS');

  // Simulate lost ACK by closing the committing tab. Reload durable pair in
  // a third real tab; old generation must not be accepted as a blind retry.
  await loser.evaluate(()=>window.__g265.db.close());
  await loser.close();
  const c=await newTab();
  await c.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const reloaded=await inspect(c);
  assert.equal(reloaded.generation,2);
  assert.equal(reloaded.sha256,after.sha256);
  assert.deepEqual(reloaded.bytes,after.bytes);
  const openedBefore=await c.evaluate(()=>window.__g265.opened);
  const replay=await run(c,input('native-second',1,first.sha256));
  assert.deepEqual(replay,{ok:false,code:'G265_PAIR_STALE_RELOAD_REQUIRED'});
  assert.equal(await c.evaluate(()=>window.__g265.opened),openedBefore);
  console.log('PASS G265_FOURTH_NATIVE_ACK_LOSS_TAB_CLOSE_RELOAD_STALE_RETRY_FAIL_CLOSED');

  // A failed second SQL statement must ROLLBACK the first, with zero durable
  // generation/hash/row delta and no success ACK after a fresh tab reload.
  await c.evaluate(()=>window.__g265.reset());
  const abort=await run(c,input('native-abort',2,after.sha256,'2026-10-29T11:00:00.000Z'));
  assert.equal(abort.ok,false,JSON.stringify(abort));
  assert.match(abort.code,/native-second-statement-rejection/);
  assert.equal(await c.evaluate(()=>window.__g265.writer.status().status),
    'UNVERIFIED_RELOAD_REQUIRED');
  const d=await newTab();
  await d.evaluate(async()=>{window.__g265.db=await window.__g265.open();window.__g265.reset();});
  const recovered=await inspect(d);
  assert.equal(recovered.generation,2);
  assert.equal(recovered.sha256,after.sha256);
  assert.deepEqual(recovered.bytes,after.bytes);
  assert.deepEqual(recovered.attempts,after.attempts);
  console.log('PASS G265_FOURTH_NATIVE_SECOND_SQL_ABORT_ROLLBACK_RELOAD_ZERO_DURABLE_DELTA');
  console.log('HOLD G265_FOURTH_NATIVE_OPTIN_NOT_PRODUCTION_23_LEGACY_OWNER_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed()){
    try{await page.evaluate(()=>window.__g265?.db?.close());}catch{}
  }
  await context.close();await browser.close();
}
