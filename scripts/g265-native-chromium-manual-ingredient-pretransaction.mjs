// G265 named production manual ingredient: real Chromium Web Lock/IDB/SQL.js,
// exact source-bound saveIngredient on a disposable loopback origin only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const source=fs.readFileSync('assets/js/manual-editor.js','utf8');
function between(start,end){
  assert.equal(source.split(start).length,2,'unique source marker '+start);
  return start+source.split(start)[1].split(end)[0];
}
const code=[
  'const now=()=>localIso();',
  between('async function audit(','function emitPokemonEvaluationInputChanged('),
  between('function normalizeIngredientUnlockInput(','// Quantity and player progression'),
  between('export async function saveIngredient(','export async function saveItem(').replace(/^export /,''),
  'return saveIngredient;'
].join('\n');
assert.match(code,/withPrimarySqliteMutationLock\(async lease/);
assert.match(code,/persist\(\{primaryMutationLease:lease\}\)/);
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY)');
seedDb.run('CREATE TABLE ingredient_inventory(ingredient_name TEXT PRIMARY KEY,quantity INTEGER,unlocked INTEGER,updated_at TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedDb.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT,PRIMARY KEY(update_id,operation_index))');
for(const name of ['SEED','ING_A','ING_B','ING_C','BLOCKED'])seedDb.run('INSERT INTO ingredient_master VALUES(?)',[name]);
seedDb.run("INSERT INTO ingredient_inventory VALUES('SEED',2,1,'2026-11-08','SEED')");
seedDb.run("CREATE TRIGGER block_fixture BEFORE INSERT ON ingredient_inventory WHEN NEW.ingredient_name='BLOCKED' BEGIN SELECT RAISE(ABORT,'synthetic-ingredient-rollback'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const js=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const wasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const tabs=[];
const url=new URL('g265-manual-ingredient-disposable',base).href;
async function newTab(){
  const page=await context.newPage();tabs.push(page);
  await page.goto(url);await page.addScriptTag({url:new URL('g265-manual-ingredient-sql.js',base).href});
  await page.evaluate(async code=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-manual-ingredient-sql.wasm'});
    const v={storage,guard,SQL,db:null,reads:0,mutations:0,snapshots:0,persists:0,hold:false,ackLoss:false};
    v.open=async()=>{
      v.db=new SQL.Database(new Uint8Array(await storage.loadDatabaseBytes()));
      v.reads=0;v.mutations=0;
    };
    const rows=(sql,params=[])=>{
      v.reads++;
      const stmt=v.db.prepare(sql);const result=[];
      try{stmt.bind(params);while(stmt.step())result.push(stmt.getAsObject());}
      finally{stmt.free();}
      return result;
    };
    const run=(sql,params=[])=>{v.mutations++;v.db.run(sql,params);};
    const snapshot=async()=>{
      v.snapshots++;
      if(v.hold){
        v.enteredResolve();
        await new Promise(resolve=>{v.release=resolve;});
      }
    };
    const persist=async options=>{
      v.persists++;
      await storage.saveDatabaseBytes(v.db.export(),options);
      if(v.ackLoss)throw Object.assign(Error('synthetic postwrite ACK loss'),{code:'SYNTHETIC_ACK_LOSS'});
    };
    v.save=new Function('rows','run','persist','snapshot','begin','commit','rollback',
      'localIso','withPrimarySqliteMutationLock','beginSqliteExclusiveWriteWindow',
      'withSqliteCoordinatedMutation',code)(
      rows,run,persist,snapshot,
      ()=>v.db.run('BEGIN'),()=>v.db.run('COMMIT'),()=>{try{v.db.run('ROLLBACK');}catch{}},
      ()=>new Date().toISOString(),storage.withPrimarySqliteMutationLock,
      guard.beginSqliteExclusiveWriteWindow,guard.withSqliteCoordinatedMutation);
    window.__ingredient=v;
  },code);
  assert.equal(await page.evaluate(()=>typeof navigator.locks?.request),'function');
  return page;
}
async function attempt(page,name,quantity,unlock){
  return page.evaluate(async({name,quantity,unlock})=>{
    try{return {ok:true,result:await window.__ingredient.save(name,quantity,unlock)};}
    catch(e){return {ok:false,code:e.code||e.message};}
  },{name,quantity,unlock});
}
async function durable(page){
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(
    await window.__ingredient.storage.loadDatabaseBytes())));
  const db=new SQL.Database(Uint8Array.from(bytes));
  const rows=q=>db.exec(q)?.[0]?.values||[];
  const out={bytes,inventory:rows('SELECT ingredient_name,quantity,unlocked FROM ingredient_inventory ORDER BY ingredient_name'),
    batches:rows('SELECT update_id FROM import_batches'),changes:rows('SELECT update_id FROM import_changes')};
  db.close();return out;
}
try{
  await context.route('**/g265-manual-ingredient-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 ingredient disposable</title>'
  }));
  await context.route('**/g265-manual-ingredient-sql.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:js
  }));
  await context.route('**/g265-manual-ingredient-sql.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:wasm
  }));
  const a=await newTab(),b=await newTab();
  await a.evaluate(bytes=>window.__ingredient.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(()=>window.__ingredient.open());
  await b.evaluate(()=>window.__ingredient.open());
  await a.evaluate(()=>{
    const v=window.__ingredient;v.hold=true;
    v.entered=new Promise(resolve=>{v.enteredResolve=resolve;});
    v.operation=v.save('ING_A',9).then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));
  });
  await a.evaluate(()=>window.__ingredient.entered);
  await b.evaluate(()=>{
    const v=window.__ingredient;
    v.operation=v.save('ING_B',0).then(x=>({ok:true,result:x}),e=>({ok:false,code:e.code||e.message}));
  });
  await b.waitForFunction(async()=> (await navigator.locks.query()).pending.some(
    x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'),null,{timeout:5000});
  assert.equal(await b.evaluate(()=>window.__ingredient.reads),0,'B must not read before lock');
  const winner=await a.evaluate(async()=>{window.__ingredient.release();return window.__ingredient.operation;});
  const stale=await b.evaluate(()=>window.__ingredient.operation);
  assert.equal(winner.ok,true,JSON.stringify(winner));
  assert.equal(stale.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await b.evaluate(()=>window.__ingredient.reads),0);
  assert.equal(await b.evaluate(()=>window.__ingredient.mutations),0);
  let state=await durable(a);
  assert.ok(state.inventory.some(x=>x[0]==='ING_A'&&x[1]===9&&x[2]===1));
  assert.ok(!state.inventory.some(x=>x[0]==='ING_B'));
  assert.equal(state.batches.length,1);assert.equal(state.changes.length,1);
  console.log('PASS G265_NATIVE_INGREDIENT_NAMED_A_HELD_B_QUEUED_STALE_PRE_SQL_AUDIT_PRESERVED');
  const staleRetry=await attempt(b,'ING_B',0);
  assert.equal(staleRetry.ok,false);
  assert.equal(await b.evaluate(()=>window.__ingredient.persists),0);

  // A stale tab must reject even if bytes cycle back to the same SHA (ABA).
  const d=await newTab();await d.evaluate(()=>window.__ingredient.open());
  await a.evaluate(bytes=>window.__ingredient.storage.saveDatabaseBytes(Uint8Array.from(bytes)),seed);
  await a.evaluate(bytes=>window.__ingredient.storage.saveDatabaseBytes(Uint8Array.from(bytes)),state.bytes);
  const aba=await attempt(d,'ING_B',0);
  assert.equal(aba.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__ingredient.reads),0);
  console.log('PASS G265_NATIVE_INGREDIENT_MONOTONIC_ABA_STALE_BEFORE_SQL');

  // Postwrite lost ACK cannot be described as rollback; retry remains blocked.
  await a.evaluate(()=>{window.__ingredient.hold=false;window.__ingredient.ackLoss=true;});
  const lost=await attempt(a,'ING_C',0);
  assert.equal(lost.code,'SYNTHETIC_ACK_LOSS');
  state=await durable(a);
  assert.ok(state.inventory.some(x=>x[0]==='ING_C'&&x[1]===0&&x[2]===null));
  assert.equal(state.batches.length,2);assert.equal(state.changes.length,2);
  const count=await a.evaluate(()=>window.__ingredient.persists);
  assert.equal((await attempt(a,'ING_C',3)).ok,false);
  assert.equal(await a.evaluate(()=>window.__ingredient.persists),count);
  console.log('PASS G265_NATIVE_INGREDIENT_POSTWRITE_ACK_LOSS_STICKY_NO_RETRY_UNKNOWN');

  // Fresh tab, actual SQLite trigger abort: rollback and no durable change.
  const c=await newTab();await c.evaluate(()=>window.__ingredient.open());
  const before=await durable(c);
  const blocked=await attempt(c,'BLOCKED',4);
  assert.match(String(blocked.code),/synthetic-ingredient-rollback/);
  assert.deepEqual((await durable(c)).bytes,before.bytes);
  assert.equal((await attempt(c,'ING_B',1)).ok,false);
  console.log('PASS G265_NATIVE_INGREDIENT_SQL_TRIGGER_ROLLBACK_NO_DURABLE_DELTA');
  console.log('HOLD G265_REMAINING_LEGACY_WRITERS_AND_ANDROID_OWNER_UAT');
}finally{
  for(const page of tabs)if(!page.isClosed())try{
    await page.evaluate(()=>window.__ingredient?.storage?.closeStorageConnection?.());
  }catch{}
  await context.close();await browser.close();
}
