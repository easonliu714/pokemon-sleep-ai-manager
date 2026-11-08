// G265 exact production recordRecipeAttemptFailure: real Chromium two-tab
// Web Locks, primary IndexedDB CAS, SQL.js, rollback and ACK-loss. Disposable only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const source=fs.readFileSync('assets/js/recipe-attempt-feedback-local.js','utf8');
const anchor='export async function recordRecipeAttemptFailure(';
assert.equal(source.split(anchor).length,2);
const body=source.split(anchor)[1].split('// G6.2: share the attempt-write')[0];
const code='async function recordRecipeAttemptFailure('+body+'\nreturn recordRecipeAttemptFailure;';
assert.match(code,/withPrimarySqliteMutationLock\(async lease/);
assert.match(code,/persist\(\{primaryMutationLease:lease\}\)/);
const SQL=await initSqlJs(),seedDb=new SQL.Database();
seedDb.run('CREATE TABLE recipe_master(recipe_id TEXT PRIMARY KEY,recipe_name TEXT,category TEXT)');
seedDb.run("INSERT INTO recipe_master VALUES('r','Synthetic','curry')");
seedDb.run('CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY)');
seedDb.run("INSERT INTO ingredient_master VALUES('apple')");
seedDb.run('CREATE TABLE recipe_attempt_feedback(attempt_id TEXT PRIMARY KEY,recipe_id TEXT,attempted_at TEXT,outcome TEXT,actual_ingredients_json TEXT,source_type TEXT,source_name TEXT,source_ref TEXT,reference_maybe_wrong INTEGER,recommendation_paused_after_attempt INTEGER,notes TEXT,created_at TEXT)');
seedDb.run('CREATE TABLE recipe_feedback_state(recipe_id TEXT PRIMARY KEY,recommendation_paused INTEGER,reference_maybe_wrong INTEGER,last_attempt_id TEXT,updated_at TEXT)');
seedDb.run("INSERT INTO recipe_feedback_state VALUES('other',1,1,'preserve','original')");
seedDb.run("CREATE TRIGGER deny_state BEFORE INSERT ON recipe_feedback_state WHEN NEW.updated_at='ABORT' BEGIN SELECT RAISE(ABORT,'synthetic-attempt-rollback'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const js=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const wasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const tabs=[],url=new URL('g265-recipe-attempt-disposable',base).href;
async function newTab(){
  const page=await context.newPage();tabs.push(page);
  await page.goto(url);
  await page.evaluate(()=>{window.name='synthetic-tab-'+crypto.randomUUID();});
  await page.addScriptTag({url:new URL('g265-recipe-attempt-sql.js',base).href});
  await page.evaluate(async code=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-recipe-attempt-sql.wasm'});
    const v={storage,guard,SQL,db:null,reads:0,mutations:0,snapshots:0,persists:0,
      hold:false,ackLoss:false,now:'NORMAL',marker:null,seq:0,uncertain:false};
    v.open=async()=>{v.db=new SQL.Database(new Uint8Array(await storage.loadDatabaseBytes()));v.reads=0;v.mutations=0;};
    const rows=(sql,params=[])=>{
      v.reads++;const stmt=v.db.prepare(sql),out=[];
      try{stmt.bind(params);while(stmt.step())out.push(stmt.getAsObject());}finally{stmt.free();}
      return out;
    };
    const run=(sql,params=[])=>{v.mutations++;v.db.run(sql,params);};
    const snapshot=async()=>{
      v.snapshots++;v.snapshotBytes=Array.from(v.db.export());
      if(v.hold){v.enteredResolve();await new Promise(resolve=>{v.release=resolve;});}
    };
    const persist=async opts=>{
      v.persists++;await storage.saveDatabaseBytes(v.db.export(),opts);
      if(v.ackLoss)throw Object.assign(Error('synthetic postwrite ACK loss'),{code:'SYNTHETIC_ACK_LOSS'});
    };
    const factory=new Function('deps',`
      let recordInFlight=false,playerWriteInFlight=false,pendingPersistenceHold=null;
      const {canonicalRecipe,provenanceFor,recipeAttemptDefaultSource,buildRecipeAttemptFeedbackRecord,
        eventId,nowIso,canonicalIngredientNames,requireWritableDatabase,armPersistenceMarker,
        clearPersistenceMarker,persistenceUncertainError,beginSqliteExclusiveWriteWindow,
        withPrimarySqliteMutationLock,withSqliteCoordinatedMutation,rows,run,begin,commit,
        rollback,snapshot,persist,RECIPE_ATTEMPT_FEEDBACK_VERSION}=deps;
      ${code}
    `);
    v.record=factory({
      rows,run,begin:()=>v.db.run('BEGIN IMMEDIATE'),commit:()=>v.db.run('COMMIT'),
      rollback:()=>{try{v.db.run('ROLLBACK');}catch{}},
      snapshot,persist,
      canonicalRecipe:id=>rows('SELECT recipe_id,recipe_name FROM recipe_master WHERE recipe_id=?',[id])[0]||null,
      provenanceFor:()=>({formula_source_type:'PUBLIC_RECIPE_PROVENANCE'}),
      recipeAttemptDefaultSource:()=>({source_type:'PUBLIC_RECIPE_PROVENANCE',source_name:'Synthetic'}),
      buildRecipeAttemptFeedbackRecord:x=>({...x,outcome:'DID_NOT_UNLOCK'}),
      eventId:()=> 'fixture-attempt-'+(++v.seq)+'-'+window.name,
      nowIso:()=>v.now,
      canonicalIngredientNames:()=>new Set(rows('SELECT ingredient_name FROM ingredient_master').map(x=>x.ingredient_name)),
      requireWritableDatabase:()=>{if(v.uncertain)throw Error('SQLITE_UNVERIFIED_RELOAD_REQUIRED');},
      armPersistenceMarker:m=>{v.marker=m;sessionStorage.setItem('g265-attempt-marker',JSON.stringify(m));},
      clearPersistenceMarker:()=>{v.marker=null;sessionStorage.removeItem('g265-attempt-marker');},
      persistenceUncertainError:(m,e)=>Object.assign(Error('PERSISTENCE_UNCERTAIN'),{code:'PERSISTENCE_UNCERTAIN',cause:e}),
      beginSqliteExclusiveWriteWindow:guard.beginSqliteExclusiveWriteWindow,
      withPrimarySqliteMutationLock:storage.withPrimarySqliteMutationLock,
      withSqliteCoordinatedMutation:guard.withSqliteCoordinatedMutation,
      RECIPE_ATTEMPT_FEEDBACK_VERSION:'fixture',
    });
    window.__recipeAttempt=v;
  },code);
  assert.equal(await page.evaluate(()=>typeof navigator.locks?.request),'function');
  return page;
}
const input={recipe_id:'r',attempted_at:'2026-11-08T12:00:00.000Z',actual_ingredients:[{ingredient_name:'apple',quantity:2}],recommendation_paused:true};
const attempt=page=>page.evaluate(async input=>{
  try{return {ok:true,result:await window.__recipeAttempt.record(input)};}
  catch(e){return {ok:false,code:e.code||e.message};}
},input);
async function durable(page){
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__recipeAttempt.storage.loadDatabaseBytes())));
  const db=new SQL.Database(Uint8Array.from(bytes));
  const attempts=db.exec('SELECT attempt_id,recipe_id FROM recipe_attempt_feedback ORDER BY attempt_id')?.[0]?.values||[];
  const state=db.exec('SELECT recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id FROM recipe_feedback_state ORDER BY recipe_id')?.[0]?.values||[];
  db.close();return {bytes,attempts,state};
}
try{
  await context.route('**/g265-recipe-attempt-disposable',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>G265 attempt disposable</title>'}));
  await context.route('**/g265-recipe-attempt-sql.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:js}));
  await context.route('**/g265-recipe-attempt-sql.wasm',r=>r.fulfill({status:200,contentType:'application/wasm',body:wasm}));
  const a=await newTab(),b=await newTab();
  await a.evaluate(bytes=>window.__recipeAttempt.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(()=>window.__recipeAttempt.open());await b.evaluate(()=>window.__recipeAttempt.open());
  await a.evaluate(()=>{const v=window.__recipeAttempt;v.hold=true;v.entered=new Promise(resolve=>v.enteredResolve=resolve);
    v.operation=v.record({recipe_id:'r',attempted_at:'2026-11-08T12:00:00.000Z',actual_ingredients:[{ingredient_name:'apple',quantity:2}]}).then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));});
  await a.evaluate(()=>window.__recipeAttempt.entered);
  await b.evaluate(()=>{const v=window.__recipeAttempt;
    v.operation=v.record({recipe_id:'r',attempted_at:'2026-11-08T12:01:00.000Z',actual_ingredients:[{ingredient_name:'apple',quantity:2}]}).then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));});
  await b.waitForFunction(async()=>(await navigator.locks.query()).pending.some(x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'),null,{timeout:5000});
  assert.equal(await b.evaluate(()=>window.__recipeAttempt.reads),0);
  assert.equal(await b.evaluate(()=>window.__recipeAttempt.mutations),0);
  const winner=await a.evaluate(async()=>{window.__recipeAttempt.release();return window.__recipeAttempt.operation;});
  const stale=await b.evaluate(()=>window.__recipeAttempt.operation);
  assert.equal(winner.ok,true,JSON.stringify(winner));
  assert.equal(stale.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await b.evaluate(()=>window.__recipeAttempt.mutations),0);
  let state=await durable(a);assert.equal(state.attempts.length,1);
  assert.deepEqual(state.state.find(x=>x[0]==='other').slice(1),[1,1,'preserve']);
  assert.deepEqual(await a.evaluate(()=>window.__recipeAttempt.snapshotBytes),seed);
  console.log('PASS G265_NATIVE_ATTEMPT_TWO_TAB_LOCK_BEFORE_READ_STALE_ZERO_SQL');
  const d=await newTab();await d.evaluate(()=>window.__recipeAttempt.open());
  await a.evaluate(bytes=>window.__recipeAttempt.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(bytes=>window.__recipeAttempt.storage.saveDatabaseBytes(Uint8Array.from(bytes)),state.bytes);
  const aba=await attempt(d);
  assert.equal(aba.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__recipeAttempt.mutations),0);
  console.log('PASS G265_NATIVE_ATTEMPT_MONOTONIC_ABA_HOLD');
  await a.evaluate(()=>{window.__recipeAttempt.hold=false;window.__recipeAttempt.ackLoss=true;});
  const lost=await attempt(a);assert.equal(lost.code,'PERSISTENCE_UNCERTAIN');
  state=await durable(a);assert.equal(state.attempts.length,2,'ACK loss may be post-write');
  const saves=await a.evaluate(()=>window.__recipeAttempt.persists);
  assert.equal((await attempt(a)).ok,false);
  assert.equal(await a.evaluate(()=>window.__recipeAttempt.persists),saves);
  console.log('PASS G265_NATIVE_ATTEMPT_POSTWRITE_ACK_LOSS_NO_BLIND_RETRY');
  const c=await newTab();await c.evaluate(()=>window.__recipeAttempt.open());
  const before=await durable(c);
  await c.evaluate(()=>{window.__recipeAttempt.now='ABORT';});
  const abort=await attempt(c);assert.match(String(abort.code),/synthetic-attempt-rollback/);
  assert.deepEqual((await durable(c)).bytes,before.bytes);
  assert.equal((await attempt(c)).ok,false);
  console.log('PASS G265_NATIVE_ATTEMPT_SECOND_SQL_ROLLBACK_NO_DURABLE_DELTA');
}finally{
  for(const page of tabs)if(!page.isClosed())try{await page.evaluate(()=>window.__recipeAttempt?.storage?.closeStorageConnection?.());}catch{}
  await context.close();await browser.close();
}
