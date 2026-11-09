// G265 named production importer: native Chromium Web Lock, IndexedDB CAS,
// SQL.js and disposable synthetic rows. No real player SQLite or Android writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';
const source=fs.readFileSync('assets/js/importer.js','utf8');
const helper='function write(entity, key, data, mode) {';
const start='export async function applyPayload(payload) {';
assert.equal(source.split(helper).length,2);
assert.equal(source.split(start).length,2);
const operation=source.slice(source.indexOf(helper)).replace(/^export /gm,'');
assert.match(operation,/withPrimarySqliteMutationLock\(async lease/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/);
const factory='const {KEYS,quote,dryRun,run,begin,commit,rollback,persist,snapshot,localIso,'
  +'CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,beginSqliteExclusiveWriteWindow,'
  +'withSqliteCoordinatedMutation,withPrimarySqliteMutationLock}=deps;\n'
  +operation+'\nreturn applyPayload;';
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)');
seedDb.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedDb.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seedDb.run("INSERT INTO settings VALUES('seed','PRESERVED')");
seedDb.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
const seed=Array.from(seedDb.export());seedDb.close();
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'}),pages=[];
async function tab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(new URL('g265-importer-production-disposable',base).href);
  await page.addScriptTag({url:new URL('g265-importer-production-sql.js',base).href});
  await page.evaluate(async factory=>{
    const storage=await import('/assets/js/storage.js');
    const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-importer-production-sql.wasm'});
    const v={storage,guard,SQL,db:null,held:false,reads:0,writes:0,snapshots:0,persists:0,
      hold:false,ackLoss:false,failAudit:false,enteredResolve:null,release:null};
    v.open=async()=>{
      v.db=new SQL.Database(new Uint8Array(await storage.loadDatabaseBytes()));
      v.reads=0;v.writes=0;
    };
    const check=()=>{if(!v.held||!v.db)throw Error('NATIVE_IMPORTER_PRE_SQL_PRIMARY_LOCK_REQUIRED');};
    const rows=(sql,params=[])=>{
      check();v.reads++;
      const stmt=v.db.prepare(sql),out=[];
      try{stmt.bind(params);while(stmt.step())out.push(stmt.getAsObject());}
      finally{stmt.free();}
      return out;
    };
    const run=(sql,params=[])=>{
      check();guard.assertSqliteDirectWriteAllowed();v.writes++;
      if(v.failAudit&&sql.includes('INSERT INTO import_changes'))throw Error('NATIVE_IMPORT_AUDIT_ABORT');
      v.db.run(sql,params);
    };
    const dryRun=payload=>{
      check();
      if(payload.operations.length!==1||payload.operations[0].entity!=='settings')
        throw Error('NATIVE_SYNTHETIC_PAYLOAD_ONLY');
      const op=payload.operations[0];
      const existing=rows('SELECT value FROM settings WHERE key=?',[op.key.key])[0]||null;
      return {conflict_count:existing?1:0,changes:[{
        effective_action:'insert',key:{...op.key},data:{...op.data},before:null,
        after:{...op.key,...op.data},message:'',candy_storage:null
      }],audit_summary:{},visual_preflight:{status:'SYNTHETIC'}};
    };
    const snapshot=async reason=>{
      check();if(!reason.startsWith('before:synthetic_'))throw Error('NATIVE_BAD_SNAPSHOT');
      v.snapshots++;
      if(v.hold){v.enteredResolve();await new Promise(resolve=>v.release=resolve);}
    };
    const persist=async opts=>{
      check();v.persists++;
      await storage.saveDatabaseBytes(v.db.export(),opts);
      if(v.ackLoss)throw Error('NATIVE_IMPORT_ACK_LOST_AFTER_DURABLE_WRITE');
    };
    const deps={
      KEYS:{settings:['key']},quote:s=>'"'+String(s).replaceAll('"','""')+'"',
      dryRun,run,snapshot,persist,
      begin:()=>run('BEGIN IMMEDIATE'),commit:()=>run('COMMIT'),
      rollback:()=>{try{run('ROLLBACK');}catch{}},
      localIso:()=>new Date().toISOString(),
      CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_ONLY',
      beginSqliteExclusiveWriteWindow:guard.beginSqliteExclusiveWriteWindow,
      withSqliteCoordinatedMutation:guard.withSqliteCoordinatedMutation,
      withPrimarySqliteMutationLock:fn=>storage.withPrimarySqliteMutationLock(async lease=>{
        v.held=true;try{return await fn(lease);}finally{v.held=false;}
      })
    };
    v.apply=new Function('deps',factory)(deps);
    window.__g265Importer=v;
  },factory);
  assert.equal(await page.evaluate(()=>typeof navigator.locks?.request),'function');
  return page;
}
const payload=id=>({schema_version:'synthetic',update_id:'synthetic_'+id,
  generated_at:'2026-11-09T15:00:00+08:00',source:'synthetic',
  operations:[{entity:'settings',action:'insert',key:{key:'setting_'+id},data:{value:id}}]});
const invoke=(page,id)=>page.evaluate(async p=>{
  try{return {ok:true,result:await window.__g265Importer.apply(p)};}
  catch(e){return {ok:false,code:e?.code||e?.message||String(e)};}
},payload(id));
async function durable(page){
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__g265Importer.storage.loadDatabaseBytes())));
  const db=new SQL.Database(Uint8Array.from(bytes));
  try{
    const values=q=>db.exec(q)?.[0]?.values||[];
    return {bytes,settings:values('SELECT key,value FROM settings ORDER BY key'),
      batches:values('SELECT update_id FROM import_batches ORDER BY update_id'),
      changes:values('SELECT entity FROM import_changes ORDER BY update_id'),
      master:values('SELECT id,value FROM synthetic_public_master')};
  }finally{db.close();}
}
const count=(state,id)=>state.settings.filter(x=>x[0]==='setting_'+id).length;
try{
  await context.route('**/g265-importer-production-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable importer</title>'
  }));
  await context.route('**/g265-importer-production-sql.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-importer-production-sql.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(seed=>window.__g265Importer.storage.saveDatabaseBytes(Uint8Array.from(seed)),seed);
  await a.evaluate(()=>window.__g265Importer.open());
  await b.evaluate(()=>window.__g265Importer.open());
  await a.evaluate(p=>{
    const v=window.__g265Importer;v.hold=true;
    v.entered=new Promise(resolve=>v.enteredResolve=resolve);
    v.operation=v.apply(p).then(result=>({ok:true,result}),
      e=>({ok:false,code:e.code||e.message}));
  },payload('A'));
  await a.evaluate(()=>window.__g265Importer.entered);
  await b.evaluate(p=>{
    const v=window.__g265Importer;
    v.operation=v.apply(p).then(result=>({ok:true,result}),
      e=>({ok:false,code:e.code||e.message}));
  },payload('B'));
  await b.waitForFunction(async()=>(await navigator.locks.query()).pending.some(
    x=>x.name==='pokemon-sleep-ai-manager:sqlite-primary-exclusive-write'),null,{timeout:5000});
  assert.deepEqual(await b.evaluate(()=>({reads:window.__g265Importer.reads,writes:window.__g265Importer.writes})),
    {reads:0,writes:0},'queued tab must not read player SQL');
  const first=await a.evaluate(async()=>{window.__g265Importer.release();return window.__g265Importer.operation;});
  const stale=await b.evaluate(()=>window.__g265Importer.operation);
  assert.equal(first.ok,true,JSON.stringify(first));
  assert.equal(stale.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.deepEqual(await b.evaluate(()=>({reads:window.__g265Importer.reads,writes:window.__g265Importer.writes})),
    {reads:0,writes:0});
  const afterA=await durable(a);
  assert.equal(count(afterA,'A'),1);assert.equal(count(afterA,'B'),0);
  assert.equal(afterA.batches.length,1);assert.equal(afterA.changes.length,1);
  console.log('PASS G265_IMPORTER_NATIVE_TWO_TAB_QUEUED_ZERO_SQL_STALE_HOLD');
  const c=await tab();await c.evaluate(()=>window.__g265Importer.open());
  const fresh=await invoke(c,'B');assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await durable(c);
  assert.equal(count(afterB,'A'),1);assert.equal(count(afterB,'B'),1);
  assert.equal(afterB.batches.length,2);assert.equal(afterB.changes.length,2);
  assert.deepEqual(afterB.master,afterA.master);
  console.log('PASS G265_IMPORTER_NATIVE_RELOAD_PRESERVES_BATCH_AUDIT_MASTER');
  const d=await tab();await d.evaluate(()=>window.__g265Importer.open());
  await c.evaluate(seed=>window.__g265Importer.storage.saveDatabaseBytes(Uint8Array.from(seed)),seed);
  await c.evaluate(bytes=>window.__g265Importer.storage.saveDatabaseBytes(Uint8Array.from(bytes)),afterB.bytes);
  const aba=await invoke(d,'ABA');
  assert.equal(aba.code,'SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__g265Importer.reads),0);
  console.log('PASS G265_IMPORTER_NATIVE_MONOTONIC_ABA_STALE_HOLD');
  const e=await tab();await e.evaluate(()=>window.__g265Importer.open());
  const before=await durable(e);
  await e.evaluate(()=>{window.__g265Importer.failAudit=true;});
  const failed=await invoke(e,'ROLLBACK');
  assert.match(String(failed.code),/NATIVE_IMPORT_AUDIT_ABORT/);
  assert.deepEqual((await durable(e)).bytes,before.bytes);
  console.log('PASS G265_IMPORTER_NATIVE_SQL_AUDIT_ROLLBACK_ZERO_DURABLE_DELTA');
  const f=await tab();await f.evaluate(()=>window.__g265Importer.open());
  await f.evaluate(()=>{window.__g265Importer.ackLoss=true;});
  const lost=await invoke(f,'ACK_LOSS');
  assert.match(String(lost.code),/NATIVE_IMPORT_ACK_LOST/);
  const afterLost=await durable(f);
  assert.equal(count(afterLost,'ACK_LOSS'),1);
  const saves=await f.evaluate(()=>window.__g265Importer.persists);
  assert.equal((await invoke(f,'ACK_LOSS')).ok,false);
  assert.equal(await f.evaluate(()=>window.__g265Importer.persists),saves);
  console.log('PASS G265_IMPORTER_NATIVE_ACK_LOSS_STICKY_NO_BLIND_RETRY');
  console.log('HOLD G265_IMPORTER_NOT_GLOBAL_LEGACY_OR_ANDROID_OWNER_PASS');
}finally{
  for(const p of pages)if(!p.isClosed())try{await p.evaluate(()=>window.__g265Importer?.db?.close());}catch{}
  await context.close();await browser.close();
}