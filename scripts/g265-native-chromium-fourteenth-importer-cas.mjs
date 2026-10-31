// G265 fourteenth Importer: native Chromium two-tab source-bound isolated CAS.
// Uses real browser Web Locks, IndexedDB and SQL.js/WASM on a disposable loopback
// origin. The unchanged legacy importer is invoked ONLY through a test-only
// opt-in admission wrapper; this never opens the player database or app shell.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/importer.js',import.meta.url),'utf8');
const marker='export async function applyPayload(payload) {';
const writeMarker='function write(entity, key, data, mode) {';
assert.equal(source.split(marker).length,2);
assert.equal(source.split(writeMarker).length,2);
const operation=source.slice(source.indexOf(writeMarker)).replace(/^export /gm,'');
assert.match(operation,/await snapshot\\(/);
assert.match(operation,/begin\\(\\);[\\s\\S]*?commit\\(\\);[\\s\\S]*?await persist\\(\\)/);
assert.match(operation,/INSERT INTO import_batches/);
assert.doesNotMatch(operation,/createSqliteCrossTabWriteAdmission|navigator\\.locks|runSqliteWriteSession/);
console.log('PASS G265_FOURTEENTH_NATIVE_EXACT_IMPORTER_SOURCE_BOUND_NOT_PRODUCTION_WIRED');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','native fixture must never visit a deployed origin');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)');
seedDb.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT)');
seedDb.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seedDb.run("INSERT INTO settings VALUES('seed','preserved')");
seedDb.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
const seed=Array.from(seedDb.export());seedDb.close();
const digest=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
async function tab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(new URL('g265-importer-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-importer-native.js',base).href});
  await page.evaluate(async exact=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-importer-native.wasm'});
    const databaseName='g265_fourteenth_importer_disposable_native_fixture';
    const open=()=>new Promise((resolve,reject)=>{
      const req=indexedDB.open(databaseName,1);
      req.onupgradeneeded=()=>req.result.createObjectStore('durable');
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    const read=async()=>{
      const db=await open();
      try{return await new Promise((resolve,reject)=>{
        const tx=db.transaction('durable','readonly');
        const req=tx.objectStore('durable').get('primary');
        req.onsuccess=()=>resolve(req.result?new Uint8Array(req.result):null);
        req.onerror=()=>reject(req.error);
      });}finally{db.close();}
    };
    const write=async bytes=>{
      const db=await open();
      try{await new Promise((resolve,reject)=>{
        const tx=db.transaction('durable','readwrite');
        tx.objectStore('durable').put(new Uint8Array(bytes),'primary');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });}finally{db.close();}
    };
    const v=window.__g265={SQL,read,write,opened:0,writes:0,rollbacks:0,entered:false,release:null,gate:null};
    const fingerprint=bytes=>sha256SqliteBytes(bytes,crypto);
    v.makeGate=(denyLocks=false)=>{v.gate=createSqliteCrossTabWriteAdmission({
      locks:denyLocks?null:navigator.locks,readDurable:read,fingerprint,timeoutMs:10000
    });};
    v.inspect=async()=>{
      const bytes=await read();const db=new SQL.Database(bytes);
      try{
        const rows=query=>db.exec(query)?.[0]?.values||[];
        return {sha256:await fingerprint(bytes),bytes:Array.from(bytes),
          settings:rows('SELECT key,value FROM settings ORDER BY key'),
          batches:rows('SELECT update_id FROM import_batches ORDER BY update_id'),
          master:rows('SELECT id,value FROM synthetic_public_master')};
      }finally{db.close();}
    };
    v.run=async(id,expected,opts={})=>{
      try{
        const result=await v.gate.execute({
          reason:'native-synthetic-import-'+id,expectedFingerprint:expected,
          writeUnderLock:async({latestBytes,observedFingerprint})=>{
            if(observedFingerprint!==await fingerprint(latestBytes))throw Error('NATIVE_INVALID_PREIMAGE');
            v.opened++;
            const db=new SQL.Database(latestBytes);
            let inTransaction=false,snapshotReady=false;
            const env={
              KEYS:{settings:['key']},
              quote:value=>'"'+String(value).replaceAll('"','""')+'"',
              CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_ONLY',
              localIso:()=> '2026-11-01T02:55:00+08:00',
              dryRun:p=>({conflict_count:0,changes:p.operations.map(o=>({
                effective_action:'insert',key:{...o.key},data:{...o.data},
                before:null,after:{...o.key,...o.data},message:'',candy_storage:null
              })),audit_summary:{},visual_preflight:{status:'SYNTHETIC'}}),
              async snapshot(reason){
                if(!reason.startsWith('before:synthetic_'))throw Error('NATIVE_BAD_SNAPSHOT');
                snapshotReady=true;return {status:'SYNTHETIC_ONLY'};
              },
              begin(){if(!snapshotReady)throw Error('NATIVE_NO_SNAPSHOT');db.run('BEGIN IMMEDIATE');inTransaction=true;},
              run(sql,params=[]){
                if(!inTransaction)throw Error('NATIVE_NO_TRANSACTION');
                if(opts.failBatch&&sql.startsWith('INSERT INTO import_batches'))throw Error('NATIVE_BATCH_INSERT_FAILURE');
                db.run(sql,params);
              },
              commit(){db.run('COMMIT');inTransaction=false;},
              rollback(){v.rollbacks++;if(inTransaction){db.run('ROLLBACK');inTransaction=false;}},
              async persist(){
                if(inTransaction)throw Error('NATIVE_PERSIST_BEFORE_COMMIT');
                const bytes=new Uint8Array(db.export());
                if(opts.holdPersist){
                  v.entered=true;
                  await new Promise(resolve=>{v.release=resolve;});
                }
                await write(bytes);v.writes++;
                if(opts.loseAck)throw Error('NATIVE_ACK_LOST_AFTER_DURABLE_WRITE');
              }
            };
            const keys=Object.keys(env);
            const apply=new Function(...keys,exact+'\\n;return applyPayload;')(...keys.map(k=>env[k]));
            const payload={schema_version:'synthetic',update_id:'synthetic_'+id,
              generated_at:'2026-11-01T02:55:00+08:00',source:'synthetic',
              operations:[{entity:'settings',action:'insert',key:{key:'setting_'+id},data:{value:id}}]};
            try{
              const outcome=await apply(payload);
              if(outcome.operation_count!==1)throw Error('NATIVE_BAD_OPERATION_COUNT');
              return {persistedBytes:await read()};
            }finally{db.close();}
          }
        });
        return {ok:true,result};
      }catch(error){return {ok:false,code:error.code||error.message};}
    };
  },operation);
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    idb:typeof indexedDB.open==='function',digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,idb:true,digest:true});
  return page;
}
const run=(page,id,sha,opts={})=>page.evaluate(args=>window.__g265.run(...args),[id,sha,opts]);
const inspect=page=>page.evaluate(()=>window.__g265.inspect());
const count=(state,key)=>state.settings.filter(row=>row[0]===key).length;
try{
  await context.route('**/g265-importer-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable importer</title>'
  }));
  await context.route('**/g265-importer-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-importer-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(bytes=>window.__g265.write(Uint8Array.from(bytes)),seed);
  for(const page of [a,b])await page.evaluate(()=>window.__g265.makeGate());
  const before=await inspect(a);
  assert.equal(before.sha256,digest(seed));
  const first=run(a,'A',before.sha256,{holdPersist:true});
  await a.waitForFunction(()=>window.__g265.entered);
  const second=run(b,'B',before.sha256);
  assert.equal(await b.evaluate(()=>window.__g265.opened),0);
  await a.evaluate(()=>window.__g265.release());
  const results=await Promise.all([first,second]);
  assert.equal(results[0].ok,true,JSON.stringify(results));
  assert.deepEqual(results[1],{ok:false,code:'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED'});
  assert.equal(await b.evaluate(()=>window.__g265.opened),0);
  assert.equal(await b.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const afterA=await inspect(a);
  assert.equal(count(afterA,'setting_A'),1);assert.equal(count(afterA,'setting_B'),0);
  assert.deepEqual(afterA.batches,[['synthetic_A']]);
  assert.deepEqual(afterA.master,before.master);
  console.log('PASS G265_FOURTEENTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'B',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  assert.equal(count(afterB,'setting_A'),1);assert.equal(count(afterB,'setting_B'),1);
  assert.deepEqual(afterB.batches,[['synthetic_A'],['synthetic_B']]);
  assert.deepEqual(afterB.master,before.master);
  console.log('PASS G265_FOURTEENTH_NATIVE_FRESH_RELOAD_PRESERVES_IMPORT_BATCHES');

  const c=await tab();await c.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(c),afterB);
  const rollback=await run(c,'ROLLBACK',afterB.sha256,{failBatch:true});
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_BATCH_INSERT_FAILURE/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();await d.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(d),afterB);
  console.log('PASS G265_FOURTEENTH_NATIVE_SQLJS_ROLLBACK_DURABLE_UNCHANGED');

  const lost=await run(d,'ACK_LOSS',afterB.sha256,{loseAck:true});
  assert.deepEqual(lost,{ok:false,code:'NATIVE_ACK_LOST_AFTER_DURABLE_WRITE'});
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const e=await tab();await e.evaluate(()=>window.__g265.makeGate());
  const afterLost=await inspect(e);
  assert.equal(count(afterLost,'setting_ACK_LOSS'),1);
  assert.equal(afterLost.batches.length,3);
  const replay=await run(b,'STALE',afterB.sha256);
  assert.deepEqual(replay,{ok:false,code:'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED'});
  assert.equal(count(await inspect(e),'setting_STALE'),0);
  console.log('PASS G265_FOURTEENTH_NATIVE_ACK_LOSS_TAB_CLOSE_STALE_NO_REPLAY');

  const f=await tab();await f.evaluate(()=>window.__g265.makeGate(true));
  const denied=await run(f,'NO_LOCK',afterLost.sha256);
  assert.deepEqual(denied,{ok:false,code:'SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE'});
  assert.equal(await f.evaluate(()=>window.__g265.opened),0);
  assert.equal(await f.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(e),afterLost);
  const finalWrite=await run(e,'AFTER_RELOAD',afterLost.sha256);
  assert.equal(finalWrite.ok,true,JSON.stringify(finalWrite));
  const g=await tab();await g.evaluate(()=>window.__g265.makeGate());
  const final=await inspect(g);
  assert.equal(count(final,'setting_AFTER_RELOAD'),1);
  assert.equal(final.batches.length,4);
  assert.deepEqual(final.master,before.master);
  assert.equal(final.sha256,digest(final.bytes));
  console.log('PASS G265_FOURTEENTH_NATIVE_NO_LOCK_FAIL_CLOSED_INDEPENDENT_DURABLE_READBACK');
  console.log('HOLD G265_FOURTEENTH_IMPORTER_NATIVE_OPTIN_NOT_PRODUCTION_ALL_WRITERS_CRASH_RESTORE_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed())await page.close().catch(()=>{});
  await context.close();await browser.close();
}
