// G265 named production Recipe Workbench under real Chromium native Web Locks,
// IndexedDB primary revision CAS and disposable SQL.js. No player data or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync('assets/js/recipe-unified-player-workbench.js','utf8');
const start='async function saveRecipeState(row,{unlocked,level,energy}){';
const end='\nfunction bindTable(';
assert.equal(source.split(start).length,2);
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(operation,/withPrimarySqliteMutationLock\(async lease/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/);
const factory='const {dbReady,rows,run,persist,snapshot,begin,commit,rollback,localIso,beginSqliteExclusiveWriteWindow,withSqliteCoordinatedMutation,withPrimarySqliteMutationLock}=deps;\n'
  +operation+'\nreturn saveRecipeState;';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE recipes(recipe_id TEXT PRIMARY KEY,category TEXT,recipe_name TEXT,unlocked INTEGER,total_ingredients INTEGER,source TEXT,recipe_level INTEGER,current_energy INTEGER,updated_at TEXT,notes TEXT)');
seedDb.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedDb.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seedDb.run("INSERT INTO recipes VALUES('seed','synthetic','baseline',1,1,'fixture',1,10,'fixture','')");
seedDb.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
const seed=Array.from(seedDb.export());seedDb.close();
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'}),pages=[];
const row=id=>({recipe_id:'recipe_'+id,category:'synthetic',recipe_name:'fixture_'+id,total_ingredients:3});
const options={unlocked:true,level:2,energy:20};
async function tab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(new URL('g265-recipe-production-disposable',base).href);
  await page.addScriptTag({url:new URL('g265-recipe-production-sql.js',base).href});
  await page.evaluate(async factory=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-recipe-production-sql.wasm'});
    const v={storage,guard,SQL,db:null,reads:0,writes:0,snapshots:0,persists:0,
      hold:false,ackLoss:false,failAudit:false,enteredResolve:null,release:null};
    v.open=async()=>{
      v.db=new SQL.Database(new Uint8Array(await storage.loadDatabaseBytes()));
      v.reads=0;v.writes=0;
    };
    const requireDb=()=>{if(!v.db)throw Error('disposable_database_not_open');};
    const rows=(sql,params=[])=>{
      requireDb();v.reads++;
      const stmt=v.db.prepare(sql),out=[];
      try{stmt.bind(params);while(stmt.step())out.push(stmt.getAsObject());}
      finally{stmt.free();}
      return out;
    };
    const run=(sql,params=[])=>{
      requireDb();guard.assertSqliteDirectWriteAllowed();v.writes++;
      if(v.failAudit&&sql.includes('INSERT INTO import_changes'))throw Error('NATIVE_AUDIT_INSERT_ABORT');
      v.db.run(sql,params);
    };
    const snapshot=async reason=>{
      if(!reason.startsWith('manual:recipe:'))throw Error('NATIVE_BAD_SNAPSHOT');
      v.snapshots++;
      if(v.hold){v.enteredResolve();await new Promise(resolve=>v.release=resolve);}
    };
    const persist=async opts=>{
      v.persists++;
      await storage.saveDatabaseBytes(v.db.export(),opts);
      if(v.ackLoss)throw Error('NATIVE_POSTWRITE_ACK_LOST');
    };
    v.save=new Function('deps',factory)({
      dbReady:()=>{requireDb();v.reads++;return true;},
      rows,run,snapshot,persist,
      begin:()=>run('BEGIN IMMEDIATE'),commit:()=>run('COMMIT'),
      rollback:()=>{try{run('ROLLBACK');}catch{}},
      localIso:()=>new Date().toISOString(),
      beginSqliteExclusiveWriteWindow:guard.beginSqliteExclusiveWriteWindow,
      withSqliteCoordinatedMutation:guard.withSqliteCoordinatedMutation,
      withPrimarySqliteMutationLock:storage.withPrimarySqliteMutationLock,
    });
    window.__g265Recipe=v;
  },factory);
  assert.equal(await page.evaluate(()=>typeof navigator.locks?.request),'function');
  return page;
}
const invoke=(page,id)=>page.evaluate(async ({id,options})=>{
  try{return {ok:true,result:await window.__g265Recipe.save(
    {recipe_id:'recipe_'+id,category:'synthetic',recipe_name:'fixture_'+id,total_ingredients:3},options)};}
  catch(e){return {ok:false,code:e?.code||e?.message||String(e)};}
},{id,options});
async function durable(page){
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__g265Recipe.storage.loadDatabaseBytes())));
  const db=new SQL.Database(Uint8Array.from(bytes));
  try{
    const values=q=>db.exec(q)?.[0]?.values||[];
    return {bytes,recipes:values('SELECT recipe_id FROM recipes ORDER BY recipe_id'),
      batches:values('SELECT update_id FROM import_batches ORDER BY update_id'),
      changes:values('SELECT entity FROM import_changes ORDER BY update_id'),
      master:values('SELECT id,value FROM synthetic_public_master')};
  }finally{db.close();}
}
const count=(state,id)=>state.recipes.filter(x=>x[0]==='recipe_'+id).length;
try{
  await context.route('**/g265-recipe-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable</title>'
  }));
  await context.route('**/g265-recipe-production-sql.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-recipe-production-sql.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(seed=>window.__g265Recipe.storage.saveDatabaseBytes(Uint8Array.from(seed)),seed);
  await a.evaluate(()=>window.__g265Recipe.open());
  await b.evaluate(()=>window.__g265Recipe.open());
  await a.evaluate(row=>{
    const v=window.__g265Recipe;v.hold=true;v.entered=new Promise(resolve=>v.enteredResolve=resolve);
    v.operation=v.save(row,{unlocked:true,level:2,energy:20})
      .then(result=>({ok:true,result}),e=>({ok:false,code:e.code||e.message}));
  },row('A'));
  await a.evaluate(()=>window.__g265Recipe.entered);
  await b.evaluate(row=>{
    const v=window.__g265Recipe;
    v.operation=v.save(row,{unlocked:true,level:2,energy:20})
      .then(result=>({ok:true,result}),e=>({ok:false,code:e.code||e.message}));
  },row('B'));
  await b.waitForFunction(async()=>(await navigator.locks.query()).pending.some(
    x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'),null,{timeout:5000});
  assert.deepEqual(await b.evaluate(()=>({reads:window.__g265Recipe.reads,writes:window.__g265Recipe.writes})),
    {reads:0,writes:0},'queued contender must have zero player SQL');
  const first=await a.evaluate(async()=>{window.__g265Recipe.release();return window.__g265Recipe.operation;});
  const stale=await b.evaluate(()=>window.__g265Recipe.operation);
  assert.equal(first.ok,true,JSON.stringify(first));
  assert.equal(stale.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.deepEqual(await b.evaluate(()=>({reads:window.__g265Recipe.reads,writes:window.__g265Recipe.writes})),
    {reads:0,writes:0});
  const afterA=await durable(a);
  assert.equal(count(afterA,'A'),1);assert.equal(count(afterA,'B'),0);
  assert.equal(afterA.batches.length,1);assert.equal(afterA.changes.length,1);
  console.log('PASS G265_RECIPE_PRODUCTION_NATIVE_TWO_TAB_LOCK_BEFORE_SQL_STALE_ZERO_READ');

  const c=await tab();await c.evaluate(()=>window.__g265Recipe.open());
  const fresh=await invoke(c,'B');assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await durable(c);
  assert.equal(count(afterB,'A'),1);assert.equal(count(afterB,'B'),1);
  assert.equal(afterB.batches.length,2);assert.equal(afterB.changes.length,2);
  assert.deepEqual(afterB.master,afterA.master);
  console.log('PASS G265_RECIPE_PRODUCTION_NATIVE_RELOAD_PRESERVES_AUDIT');

  const d=await tab();await d.evaluate(()=>window.__g265Recipe.open());
  await c.evaluate(seed=>window.__g265Recipe.storage.saveDatabaseBytes(Uint8Array.from(seed)),seed);
  await c.evaluate(bytes=>window.__g265Recipe.storage.saveDatabaseBytes(Uint8Array.from(bytes)),afterB.bytes);
  const aba=await invoke(d,'ABA');
  assert.equal(aba.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__g265Recipe.reads),0);
  console.log('PASS G265_RECIPE_PRODUCTION_NATIVE_MONOTONIC_ABA_STALE_HOLD');

  const e=await tab();await e.evaluate(()=>window.__g265Recipe.open());
  const before=await durable(e);
  await e.evaluate(()=>{window.__g265Recipe.failAudit=true;});
  const failed=await invoke(e,'ROLLBACK');
  assert.match(String(failed.code),/NATIVE_AUDIT_INSERT_ABORT/);
  assert.deepEqual((await durable(e)).bytes,before.bytes,'failed audit must not persist');
  console.log('PASS G265_RECIPE_PRODUCTION_NATIVE_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

  const f=await tab();await f.evaluate(()=>window.__g265Recipe.open());
  await f.evaluate(()=>{window.__g265Recipe.ackLoss=true;});
  const lost=await invoke(f,'ACK_LOSS');
  assert.match(String(lost.code),/NATIVE_POSTWRITE_ACK_LOST/);
  const afterLost=await durable(f);
  assert.equal(count(afterLost,'ACK_LOSS'),1);
  const saves=await f.evaluate(()=>window.__g265Recipe.persists);
  assert.equal((await invoke(f,'ACK_LOSS')).ok,false);
  assert.equal(await f.evaluate(()=>window.__g265Recipe.persists),saves);
  console.log('PASS G265_RECIPE_PRODUCTION_NATIVE_ACK_LOSS_NO_BLIND_RETRY');
  console.log('HOLD G265_RECIPE_PRODUCTION_NOT_GLOBAL_23_WRITERS_OR_ANDROID_OWNER_PASS');
}finally{
  for(const p of pages)if(!p.isClosed())try{await p.evaluate(()=>window.__g265Recipe?.db?.close());}catch{}
  await context.close();await browser.close();
}
