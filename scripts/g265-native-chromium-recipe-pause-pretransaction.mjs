// G265 named production G6.2 pause toggle: real Chromium two-tab native
// Web Locks, primary IDB CAS, SQL.js, ABA, ACK-loss and SQL rollback.
// Disposable loopback origin only; never opens a player's database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const source=fs.readFileSync('assets/js/recipe-attempt-feedback-local.js','utf8');
const anchor='export async function setRecipeRecommendationPaused(';
assert.equal(source.split(anchor).length,2);
const code='let playerWriteInFlight=false;let pendingPersistenceHold=null;\n'+
  'async function setRecipeRecommendationPaused('+source.split(anchor)[1]+
  '\nreturn setRecipeRecommendationPaused;';
assert.match(code,/withPrimarySqliteMutationLock\(async lease/);
assert.match(code,/persist\(\{primaryMutationLease:lease\}\)/);
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE recipe_master(recipe_id TEXT PRIMARY KEY,recipe_name TEXT,category TEXT)');
seedDb.run("INSERT INTO recipe_master VALUES('r','Synthetic','curry')");
seedDb.run('CREATE TABLE recipe_feedback_state(recipe_id TEXT PRIMARY KEY,recommendation_paused INTEGER,reference_maybe_wrong INTEGER,last_attempt_id TEXT,updated_at TEXT)');
seedDb.run("INSERT INTO recipe_feedback_state VALUES('r',0,1,'retain-attempt','original')");
seedDb.run("INSERT INTO recipe_feedback_state VALUES('other',1,1,'retain-other','original')");
seedDb.run("CREATE TRIGGER deny_pause BEFORE UPDATE ON recipe_feedback_state WHEN NEW.updated_at='ABORT' BEGIN SELECT RAISE(ABORT,'synthetic-pause-rollback'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const js=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const wasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const tabs=[],url=new URL('g265-recipe-pause-disposable',base).href;
async function newTab(){
  const page=await context.newPage();tabs.push(page);
  await page.goto(url);
  await page.addScriptTag({url:new URL('g265-recipe-pause-sql.js',base).href});
  await page.evaluate(async code=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-recipe-pause-sql.wasm'});
    const v={storage,guard,SQL,db:null,reads:0,mutations:0,snapshots:0,persists:0,
      hold:false,ackLoss:false,now:'NORMAL',marker:null};
    v.open=async()=>{
      v.db=new SQL.Database(new Uint8Array(await storage.loadDatabaseBytes()));
      v.reads=0;v.mutations=0;
    };
    const rows=(sql,params=[])=>{
      v.reads++;
      const stmt=v.db.prepare(sql),out=[];
      try{stmt.bind(params);while(stmt.step())out.push(stmt.getAsObject());}
      finally{stmt.free();}
      return out;
    };
    const run=(sql,params=[])=>{v.mutations++;v.db.run(sql,params);};
    const snapshot=async()=>{
      v.snapshots++;v.snapshotBytes=Array.from(v.db.export());
      if(v.hold){v.enteredResolve();await new Promise(resolve=>{v.release=resolve;});}
    };
    const persist=async options=>{
      v.persists++;await storage.saveDatabaseBytes(v.db.export(),options);
      if(v.ackLoss)throw Object.assign(Error('synthetic postwrite ACK loss'),{code:'SYNTHETIC_ACK_LOSS'});
    };
    const marker=(operation)=>{};
    const factory=new Function('rows','run','persist','snapshot','begin','commit','rollback',
      'requireWritableDatabase','canonicalRecipe','nowIso','armPersistenceMarker',
      'clearPersistenceMarker','persistenceUncertainError','withPrimarySqliteMutationLock',
      'beginSqliteExclusiveWriteWindow','withSqliteCoordinatedMutation',
      'RECIPE_ATTEMPT_FEEDBACK_VERSION','CustomEvent',code);
    v.pause=factory(rows,run,persist,snapshot,
      ()=>v.db.run('BEGIN IMMEDIATE'),()=>v.db.run('COMMIT'),
      ()=>{try{v.db.run('ROLLBACK');}catch{}},
      ()=>{},id=>rows('SELECT recipe_id,recipe_name FROM recipe_master WHERE recipe_id=?',[id])[0]||null,
      ()=>v.now,
      m=>{v.marker=m;sessionStorage.setItem('g265-pause-marker',JSON.stringify(m));},
      ()=>{v.marker=null;sessionStorage.removeItem('g265-pause-marker');},
      (m,e)=>Object.assign(Error('PERSISTENCE_UNCERTAIN'),{code:'PERSISTENCE_UNCERTAIN',cause:e}),
      storage.withPrimarySqliteMutationLock,guard.beginSqliteExclusiveWriteWindow,
      guard.withSqliteCoordinatedMutation,'fixture',
      class{constructor(){}});
    window.__recipePause=v;
  },code);
  assert.equal(await page.evaluate(()=>typeof navigator.locks?.request),'function');
  return page;
}
const attempt=(page,paused)=>page.evaluate(async paused=>{
  try{return {ok:true,result:await window.__recipePause.pause('r',paused)};}
  catch(e){return {ok:false,code:e.code||e.message};}
},paused);
async function durable(page){
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__recipePause.storage.loadDatabaseBytes())));
  const db=new SQL.Database(Uint8Array.from(bytes));
  const rows=db.exec('SELECT recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at FROM recipe_feedback_state ORDER BY recipe_id')?.[0]?.values||[];
  db.close();return {bytes,rows};
}
const get=state=>state.rows.find(x=>x[0]==='r');
try{
  await context.route('**/g265-recipe-pause-disposable',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>G265 pause disposable</title>'}));
  await context.route('**/g265-recipe-pause-sql.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:js}));
  await context.route('**/g265-recipe-pause-sql.wasm',route=>route.fulfill({status:200,contentType:'application/wasm',body:wasm}));
  const a=await newTab(),b=await newTab();
  await a.evaluate(bytes=>window.__recipePause.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(()=>window.__recipePause.open());
  await b.evaluate(()=>window.__recipePause.open());
  await a.evaluate(()=>{
    const v=window.__recipePause;v.hold=true;v.entered=new Promise(resolve=>{v.enteredResolve=resolve;});
    v.operation=v.pause('r',true).then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));
  });
  await a.evaluate(()=>window.__recipePause.entered);
  await b.evaluate(()=>{
    const v=window.__recipePause;
    v.operation=v.pause('r',false).then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));
  });
  await b.waitForFunction(async()=>(await navigator.locks.query()).pending.some(
    x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'),null,{timeout:5000});
  assert.equal(await b.evaluate(()=>window.__recipePause.reads),0,'queued B cannot read player recipe before lock');
  assert.equal(await b.evaluate(()=>window.__recipePause.mutations),0);
  const winner=await a.evaluate(async()=>{window.__recipePause.release();return window.__recipePause.operation;});
  const stale=await b.evaluate(()=>window.__recipePause.operation);
  assert.equal(winner.ok,true,JSON.stringify(winner));
  assert.equal(stale.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await b.evaluate(()=>window.__recipePause.reads),0);
  assert.equal(await b.evaluate(()=>window.__recipePause.mutations),0);
  let state=await durable(a);
  assert.deepEqual(get(state).slice(1,4),[1,1,'retain-attempt']);
  assert.ok(state.rows.some(x=>x[0]==='other'&&x[3]==='retain-other'));
  assert.deepEqual(await a.evaluate(()=>window.__recipePause.snapshotBytes),seed);
  assert.equal((await attempt(b,true)).ok,false);
  console.log('PASS G265_NATIVE_RECIPE_PAUSE_HELD_A_QUEUED_B_STALE_BEFORE_SQL');

  const d=await newTab();await d.evaluate(()=>window.__recipePause.open());
  await a.evaluate(bytes=>window.__recipePause.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(bytes=>window.__recipePause.storage.saveDatabaseBytes(Uint8Array.from(bytes)),state.bytes);
  const aba=await attempt(d,false);
  assert.equal(aba.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__recipePause.mutations),0);
  console.log('PASS G265_NATIVE_RECIPE_PAUSE_MONOTONIC_ABA_HOLD');

  await a.evaluate(()=>{window.__recipePause.hold=false;window.__recipePause.ackLoss=true;});
  const lost=await attempt(a,false);
  assert.equal(lost.code,'PERSISTENCE_UNCERTAIN');
  state=await durable(a);
  assert.equal(get(state)[1],0,'postwrite ACK loss may have persisted');
  assert.equal(await a.evaluate(()=>window.__recipePause.marker?.operation),'PAUSE_TOGGLE');
  const saves=await a.evaluate(()=>window.__recipePause.persists);
  assert.equal((await attempt(a,true)).ok,false);
  assert.equal(await a.evaluate(()=>window.__recipePause.persists),saves);
  console.log('PASS G265_NATIVE_RECIPE_PAUSE_POSTWRITE_ACK_LOSS_STICKY_NO_RETRY');

  const c=await newTab();await c.evaluate(()=>window.__recipePause.open());
  const before=await durable(c);
  await c.evaluate(()=>{window.__recipePause.now='ABORT';});
  const aborted=await attempt(c,true);
  assert.match(String(aborted.code),/synthetic-pause-rollback/);
  assert.deepEqual((await durable(c)).bytes,before.bytes);
  assert.deepEqual(await c.evaluate(()=>window.__recipePause.snapshotBytes),before.bytes);
  assert.equal((await attempt(c,false)).ok,false,'rollback uncertainty stays sticky');
  console.log('PASS G265_NATIVE_RECIPE_PAUSE_TRIGGER_ROLLBACK_NO_DURABLE_DELTA');

  const e=await newTab();await e.evaluate(()=>window.__recipePause.open());
  const success=await attempt(e,true);
  assert.equal(success.ok,true,JSON.stringify(success));
  const final=await durable(e);
  assert.deepEqual(get(final).slice(1,4),[1,1,'retain-attempt']);
  console.log('PASS G265_NATIVE_RECIPE_PAUSE_FRESH_RELOAD_PRESERVES_PRIVATE_FIELDS');
  console.log('HOLD G265_OTHER_LEGACY_WRITERS_AND_RATING_PRODUCTION_APPLY');
}finally{
  for(const page of tabs)if(!page.isClosed())try{await page.evaluate(()=>window.__recipePause?.storage?.closeStorageConnection?.());}catch{}
  await context.close();await browser.close();
}
