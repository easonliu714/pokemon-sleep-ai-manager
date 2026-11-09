// G265 named production professor transfer: actual Chromium Web Locks, SQL.js and IDB.
// The exact production function is executed on disposable loopback pages with
// synthetic rows only. No player database, public master, Candy mutation or UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/pokemon-professor-transfer.js',import.meta.url),'utf8');
const start='export async function transferPokemonToProfessor(';
const end='\nexport function professorTransferCandyGuidance()';
assert.equal(source.split(start).length,2);
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /,'');
assert.match(operation,/withPrimarySqliteMutationLock\(async lease/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/);
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,species TEXT,current_species TEXT,status TEXT,last_updated_at TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE pokemon_history(id INTEGER PRIMARY KEY AUTOINCREMENT,pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedDb.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT,PRIMARY KEY(update_id,operation_index))');
seedDb.run('CREATE TABLE candy_inventory(candy_id TEXT PRIMARY KEY,quantity INTEGER)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS'])
  seedDb.run('INSERT INTO pokemon VALUES(?,?,?,?,?,?,?)',
    ['synthetic_'+id,'instance_'+id,'species_'+id,'species_'+id,'active','seed','seed']);
seedDb.run("INSERT INTO candy_inventory VALUES('sentinel',99)");
seedDb.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
const seed=Array.from(seedDb.export());seedDb.close();
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
const endpoint=name=>new URL(name,base).href;
await context.route('**/g265-professor-production-blank',route=>route.fulfill({
  status:200,contentType:'text/html',body:'<!doctype html><title>Disposable Professor G265</title>'}));
await context.route('**/g265-professor-production.js',route=>route.fulfill({
  status:200,contentType:'text/javascript',body:browserJs}));
await context.route('**/g265-professor-production.wasm',route=>route.fulfill({
  status:200,contentType:'application/wasm',body:browserWasm}));
async function newTab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(endpoint('g265-professor-production-blank'));
  await page.addScriptTag({url:endpoint('g265-professor-production.js')});
  return page;
}
async function install(page){
  await page.evaluate(async exact=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-professor-production.wasm'});
    const bytes=await storage.loadDatabaseBytes();
    if(!bytes)throw Error('SYNTHETIC_SEED_REQUIRED');
    const db=new SQL.Database(new Uint8Array(bytes));
    const v={storage,db,reads:0,writes:0,snapshots:0,persists:0,held:false,
      hold:false,failHistory:false,ackLoss:false,release:null,entered:null,pending:null};
    let enteredResolve;v.entered=new Promise(resolve=>{enteredResolve=resolve;});
    const check=()=>{if(!v.held)throw Error('NATIVE_SQL_BEFORE_PRIMARY_LEASE');};
    const rowObjects=(sql,params=[])=>{
      const result=db.exec(sql,params);
      if(!result.length)return [];
      return result[0].values.map(values=>Object.fromEntries(
        result[0].columns.map((name,i)=>[name,values[i]])));
    };
    const env={
      beginSqliteExclusiveWriteWindow:()=>guard.beginSqliteExclusiveWriteWindow(),
      withSqliteCoordinatedMutation:fn=>guard.withSqliteCoordinatedMutation(fn),
      async withPrimarySqliteMutationLock(fn){
        return storage.withPrimarySqliteMutationLock(async lease=>{
          v.held=true;try{return await fn(lease);}finally{v.held=false;}
        });
      },
      rows(sql,params=[]){check();v.reads++;return rowObjects(sql,params);},
      run(sql,params=[]){
        check();guard.assertSqliteDirectWriteAllowed();v.writes++;
        if(v.failHistory&&sql.includes('INSERT INTO pokemon_history'))
          throw Error('NATIVE_PROFESSOR_HISTORY_INSERT_FAILURE');
        db.run(sql,params);
      },
      begin(){check();guard.assertSqliteDirectWriteAllowed();db.run('BEGIN IMMEDIATE');},
      commit(){check();guard.assertSqliteDirectWriteAllowed();db.run('COMMIT');},
      rollback(){check();guard.assertSqliteDirectWriteAllowed();db.run('ROLLBACK');},
      async snapshot(reason){
        check();if(!reason.startsWith('professor_transfer:synthetic_'))throw Error('NATIVE_SNAPSHOT_REASON');
        v.snapshots++;
        if(v.hold){
          v.hold=false;enteredResolve();
          await new Promise(resolve=>{v.release=resolve;});
        }
      },
      async persist({primaryMutationLease}={}){
        check();v.persists++;
        await storage.saveDatabaseBytes(db.export(),{primaryMutationLease});
        if(v.ackLoss)throw Error('NATIVE_PROFESSOR_POST_COMMIT_ACK_LOST');
      },
      normalizeObservedCandyQuantity(value){
        if(value!==null)throw Error('NATIVE_UNEXPECTED_CANDY_INPUT');return null;},
      canonicalCandyStorageForSpecies(){
        check();return {status:'REVIEW_REQUIRED',source_master:null,
          storage:{reason:'SYNTHETIC_NO_CANDY'},canonical_master:null};},
      speciesCandyName:()=>null,
      makeId:()=> 'native-professor-'+crypto.randomUUID(),
      now:()=>new Date().toISOString(),
      trace(){},
      recordCandyInventoryEvent(){throw Error('NATIVE_CANDY_MUTATION_FORBIDDEN');},
      CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_ONLY',
      CANDY_MUTATION_TYPES:{DELTA_EVENT:'DELTA_EVENT'},
      PROFESSOR_TRANSFER_CANDY_RULE_STATUS:'NOT_YET_VERIFIED',
      PROFESSOR_TRANSFER_CANDY_AUTHORITY:'USER_DIRECT_OBSERVATION_ONLY',
    };
    v.transfer=new Function('env','with(env){'+exact+';return transferPokemonToProfessor;}')(env);
    v.runTransfer=id=>{
      v.pending=v.transfer('synthetic_'+id).then(result=>({ok:true,status:result.pokemon.status}),
        error=>({ok:false,error:error.code||error.message}));
    };
    window.__p=v;
  },operation);
}
const result=async page=>page.evaluate(()=>window.__p.pending);
const state=async page=>page.evaluate(()=>({
  reads:window.__p.reads,writes:window.__p.writes,snapshots:window.__p.snapshots,
  persists:window.__p.persists,guard:window.__p.storage.getPrimaryMutationStatus?.()||null}));
const durable=async page=>page.evaluate(async()=>Array.from(
  new Uint8Array(await window.__p.storage.loadDatabaseBytes())));
const count=(bytes,sql)=>{
  const db=new SQL.Database(Uint8Array.from(bytes));
  try{return db.exec(sql)[0]?.values?.[0]?.[0]??0;}finally{db.close();}
};
try{
  const a=await newTab();
  await a.evaluate(async()=>{window.__seedStorage=await import('/assets/js/storage.js');
    await window.__seedStorage.loadDatabaseBytes();});
  await a.evaluate(async bytes=>{
    await window.__seedStorage.saveDatabaseBytes(Uint8Array.from(bytes));
    await window.__seedStorage.loadDatabaseBytes();
  },seed);
  const b=await newTab();
  await install(a);await install(b);
  await a.evaluate(()=>{window.__p.hold=true;window.__p.runTransfer('A');});
  await a.evaluate(()=>window.__p.entered);
  await b.evaluate(()=>window.__p.runTransfer('B'));
  await b.waitForFunction(async()=>{
    const locks=await navigator.locks.query();
    return locks.pending.some(lock=>lock.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
  },null,{timeout:10000});
  assert.deepEqual(await state(b).then(s=>[s.reads,s.writes,s.snapshots,s.persists]),[0,0,0,0]);
  await a.evaluate(()=>window.__p.release());
  assert.deepEqual(await result(a),{ok:true,status:'sent_to_professor'});
  assert.equal((await result(b)).error,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.deepEqual(await state(b).then(s=>[s.reads,s.writes,s.snapshots,s.persists]),[0,0,0,0]);
  let bytes=await durable(a);
  assert.equal(count(bytes,"SELECT COUNT(*) FROM pokemon WHERE status='sent_to_professor'"),1);
  assert.equal(count(bytes,"SELECT COUNT(*) FROM pokemon_history"),1);
  console.log('PASS G265_PROFESSOR_NATIVE_QUEUED_STALE_ZERO_SQL_AND_FIRST_DURABLE_ACK');
  const c=await newTab();await install(c);
  await c.evaluate(()=>window.__p.runTransfer('B'));
  assert.deepEqual(await result(c),{ok:true,status:'sent_to_professor'});
  bytes=await durable(c);
  assert.equal(count(bytes,"SELECT COUNT(*) FROM pokemon WHERE status='sent_to_professor'"),2);
  assert.equal(count(bytes,"SELECT COUNT(*) FROM pokemon_history"),2);
  assert.equal(count(bytes,"SELECT COUNT(*) FROM import_batches"),2);
  assert.equal(count(bytes,"SELECT COUNT(*) FROM import_changes"),2);
  assert.equal(count(bytes,"SELECT quantity FROM candy_inventory WHERE candy_id='sentinel'"),99);
  assert.equal(count(bytes,"SELECT value FROM synthetic_public_master WHERE id='public'"),'IMMUTABLE');
  console.log('PASS G265_PROFESSOR_NATIVE_FRESH_RELOAD_HISTORY_AUDIT_CANDY_MASTER_UNCHANGED');
  const d=await newTab();await install(d);
  await d.evaluate(()=>{window.__p.failHistory=true;window.__p.runTransfer('ROLLBACK');});
  assert.equal((await result(d)).error,'NATIVE_PROFESSOR_HISTORY_INSERT_FAILURE');
  assert.equal(count(await durable(c),"SELECT COUNT(*) FROM pokemon WHERE status='sent_to_professor'"),2);
  assert.equal((await state(d)).persists,0);
  await d.evaluate(()=>window.__p.runTransfer('ROLLBACK'));
  assert.equal((await result(d)).error,'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  console.log('PASS G265_PROFESSOR_NATIVE_PRECOMMIT_ROLLBACK_NO_DURABLE_DELTA');
  const e=await newTab();await install(e);
  await e.evaluate(()=>{window.__p.ackLoss=true;window.__p.runTransfer('ACK_LOSS');});
  assert.equal((await result(e)).error,'NATIVE_PROFESSOR_POST_COMMIT_ACK_LOST');
  assert.equal((await state(e)).persists,1);
  await e.evaluate(()=>window.__p.runTransfer('ACK_LOSS'));
  assert.equal((await result(e)).error,'SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
  const f=await newTab();await install(f);
  const final=await durable(f);
  assert.equal(count(final,"SELECT COUNT(*) FROM pokemon WHERE status='sent_to_professor'"),3);
  assert.equal(count(final,"SELECT COUNT(*) FROM pokemon_history"),3);
  assert.equal(count(final,"SELECT quantity FROM candy_inventory WHERE candy_id='sentinel'"),99);
  console.log('PASS G265_PROFESSOR_NATIVE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');
}finally{
  for(const page of pages)if(!page.isClosed())try{await page.evaluate(
    ()=>window.__p?.storage?.closeStorageConnection?.());}catch{}
  await context.close();await browser.close();
}
