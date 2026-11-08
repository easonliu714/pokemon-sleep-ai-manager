// G265: exact production saveAnalysisRevision under native Chromium Web Locks,
// real primary IDB CAS and disposable SQL.js. Not player DB or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync('assets/js/analysis-revision-store.js','utf8');
const anchor='export async function saveAnalysisRevision(';
assert.equal(source.split(anchor).length,2);
const body=source.split(anchor)[1].split('\nexport {TABLE_SQL}')[0];
const ensureBody=source.split('function ensure(){')[1]?.split('\nfunction uuid()')[0];
const schema=source.split('const TABLE_SQL=`')[1]?.split('`;')[0];
assert.ok(body&&ensureBody&&schema,'production source function and schema required');
assert.match(body,/withPrimarySqliteMutationLock\(async lease/);
assert.match(body,/persist\(\{primaryMutationLease:lease\}\)/);
const code='async function saveAnalysisRevision('+body+'\nreturn saveAnalysisRevision;';
const factoryCode='const {run,rows,persist,snapshot,begin,commit,rollback,uuid,beginSqliteExclusiveWriteWindow,withSqliteCoordinatedMutation,withPrimarySqliteMutationLock}=deps;'
  +'let ready=false;const TABLE_SQL='+JSON.stringify(schema)+';function ensure(){'+ensureBody
  +'\n'+code;
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs(),seedDb=new SQL.Database();
seedDb.run(schema);
seedDb.run('CREATE INDEX IF NOT EXISTS idx_image_analysis_revision_lookup ON image_analysis_revision(image_sha256,analysis_type,revision_no DESC)');
seedDb.run("INSERT INTO image_analysis_revision(analysis_id,image_sha256,analysis_type,revision_no,result_json,created_at) VALUES('unrelated','"+'f'.repeat(64)+"','other',1,'{}','2026-11-09T00:00:00.000Z')");
seedDb.run("CREATE TRIGGER deny_analysis_revision BEFORE INSERT ON image_analysis_revision WHEN NEW.analysis_id='native-trigger' BEGIN SELECT RAISE(ABORT,'synthetic-analysis-insert-rejection'); END");
const seed=Array.from(seedDb.export());seedDb.close();
const js=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const wasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'}),pages=[];
const pageUrl=new URL('g265-analysis-production-disposable',base).href;
const input={imageSha256:'a'.repeat(64),analysisType:'synthetic-ocr',result:{source:'synthetic'}};
async function tab(){
  const page=await context.newPage();pages.push(page);await page.goto(pageUrl);
  await page.addScriptTag({url:new URL('g265-analysis-production-sql.js',base).href});
  await page.evaluate(async factoryCode=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-analysis-production-sql.wasm'});
    const v={storage,guard,SQL,db:null,reads:0,writes:0,snapshots:0,persists:0,hold:false,
      ackLoss:false,triggerAbort:false,uncertain:false,snapshotBytes:null};
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
      requireDb();guard.assertSqliteDirectWriteAllowed();v.writes++;v.db.run(sql,params);
    };
    const snapshot=async()=>{
      v.snapshots++;v.snapshotBytes=Array.from(v.db.export());
      if(v.hold){v.enteredResolve();await new Promise(resolve=>v.release=resolve);}
    };
    const persist=async options=>{
      v.persists++;await storage.saveDatabaseBytes(v.db.export(),options);
      if(v.ackLoss)throw Error('synthetic-postwrite-ack-lost');
    };
    v.save=new Function('deps',factoryCode)({
      run,rows,snapshot,persist,
      begin:()=>run('BEGIN IMMEDIATE'),commit:()=>run('COMMIT'),
      rollback:()=>{try{run('ROLLBACK');}catch{}},
      uuid:()=>v.triggerAbort?'native-trigger':crypto.randomUUID(),
      beginSqliteExclusiveWriteWindow:guard.beginSqliteExclusiveWriteWindow,
      withSqliteCoordinatedMutation:guard.withSqliteCoordinatedMutation,
      withPrimarySqliteMutationLock:storage.withPrimarySqliteMutationLock,
    });
    window.__g265Analysis=v;
  },factoryCode);
  assert.equal(await page.evaluate(()=>typeof navigator.locks?.request),'function');
  return page;
}
const invoke=page=>page.evaluate(async input=>{
  try{return {ok:true,result:await window.__g265Analysis.save(input)};}
  catch(e){return {ok:false,code:e?.code||e?.message||String(e)};}
},input);
async function durable(page){
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__g265Analysis.storage.loadDatabaseBytes())));
  const db=new SQL.Database(Uint8Array.from(bytes));
  try{return {bytes,records:db.exec('SELECT analysis_id,image_sha256,revision_no,supersedes_analysis_id FROM image_analysis_revision ORDER BY revision_no,analysis_id')?.[0]?.values||[]};}
  finally{db.close();}
}
try{
  await context.route('**/g265-analysis-production-disposable',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable</title>'}));
  await context.route('**/g265-analysis-production-sql.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:js}));
  await context.route('**/g265-analysis-production-sql.wasm',route=>route.fulfill({status:200,contentType:'application/wasm',body:wasm}));
  const a=await tab(),b=await tab();
  await a.evaluate(seed=>window.__g265Analysis.storage.saveDatabaseBytes(Uint8Array.from(seed)),seed);
  await a.evaluate(()=>window.__g265Analysis.open());
  await b.evaluate(()=>window.__g265Analysis.open());
  await a.evaluate(input=>{
    const v=window.__g265Analysis;v.hold=true;v.entered=new Promise(resolve=>v.enteredResolve=resolve);
    v.operation=v.save(input).then(result=>({ok:true,result}),e=>({ok:false,code:e.code||e.message}));
  },input);
  await a.evaluate(()=>window.__g265Analysis.entered);
  await b.evaluate(input=>{
    const v=window.__g265Analysis;
    v.operation=v.save(input).then(result=>({ok:true,result}),e=>({ok:false,code:e.code||e.message}));
  },input);
  await b.waitForFunction(async()=>(await navigator.locks.query()).pending.some(x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'),null,{timeout:5000});
  assert.deepEqual(await b.evaluate(()=>({reads:window.__g265Analysis.reads,writes:window.__g265Analysis.writes})),{reads:0,writes:0},'queued tab must not access SQL');
  const winner=await a.evaluate(async()=>{window.__g265Analysis.release();return window.__g265Analysis.operation;});
  const stale=await b.evaluate(()=>window.__g265Analysis.operation);
  assert.equal(winner.ok,true,JSON.stringify(winner));
  assert.equal(stale.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.deepEqual(await b.evaluate(()=>({reads:window.__g265Analysis.reads,writes:window.__g265Analysis.writes})),{reads:0,writes:0});
  let state=await durable(a);
  assert.equal(state.records.filter(x=>x[1]===input.imageSha256).length,1);
  assert.deepEqual(await a.evaluate(()=>window.__g265Analysis.snapshotBytes),seed);
  console.log('PASS G265_ANALYSIS_PRODUCTION_NATIVE_TWO_TAB_LOCK_BEFORE_SQL_STALE_ZERO_READ');

  const c=await tab();await c.evaluate(()=>window.__g265Analysis.open());
  const second=await invoke(c);assert.equal(second.ok,true,JSON.stringify(second));
  assert.equal(second.result.revision_no,2);
  assert.equal(second.result.supersedes_analysis_id,winner.result.analysis_id);
  state=await durable(c);
  assert.equal(state.records.filter(x=>x[1]===input.imageSha256).length,2);
  assert.equal(state.records.find(x=>x[0]==='unrelated')[2],1);
  console.log('PASS G265_ANALYSIS_PRODUCTION_NATIVE_RELOAD_UNIQUE_REVISION_CHAIN');

  const d=await tab();await d.evaluate(()=>window.__g265Analysis.open());
  await c.evaluate(seed=>window.__g265Analysis.storage.saveDatabaseBytes(Uint8Array.from(seed)),seed);
  await c.evaluate(bytes=>window.__g265Analysis.storage.saveDatabaseBytes(Uint8Array.from(bytes)),state.bytes);
  const aba=await invoke(d);
  assert.equal(aba.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__g265Analysis.reads),0);
  console.log('PASS G265_ANALYSIS_PRODUCTION_NATIVE_MONOTONIC_ABA_STALE_HOLD');

  const e=await tab();await e.evaluate(()=>window.__g265Analysis.open());
  const before=await durable(e);
  await e.evaluate(()=>{window.__g265Analysis.triggerAbort=true;});
  const abort=await invoke(e);assert.match(String(abort.code),/synthetic-analysis-insert-rejection/);
  assert.deepEqual((await durable(e)).bytes,before.bytes,'failed INSERT must not persist');
  console.log('PASS G265_ANALYSIS_PRODUCTION_NATIVE_SQL_ROLLBACK_NO_DURABLE_DELTA');

  const f=await tab();await f.evaluate(()=>window.__g265Analysis.open());
  await f.evaluate(()=>{window.__g265Analysis.ackLoss=true;});
  const lost=await invoke(f);assert.match(String(lost.code),/synthetic-postwrite-ack-lost/);
  const persisted=await durable(f);
  assert.equal(persisted.records.filter(x=>x[1]===input.imageSha256).length,3,'ACK loss may follow durable write');
  const saves=await f.evaluate(()=>window.__g265Analysis.persists);
  assert.equal((await invoke(f)).ok,false);
  assert.equal(await f.evaluate(()=>window.__g265Analysis.persists),saves);
  console.log('PASS G265_ANALYSIS_PRODUCTION_NATIVE_POSTWRITE_ACK_LOSS_NO_BLIND_RETRY');
  console.log('HOLD G265_ANALYSIS_PRODUCTION_NOT_GLOBAL_23_WRITERS_OR_ANDROID_OWNER_PASS');
}finally{
  for(const p of pages)if(!p.isClosed())try{await p.evaluate(()=>window.__g265Analysis?.db?.close());}catch{}
  await context.close();await browser.close();
}
