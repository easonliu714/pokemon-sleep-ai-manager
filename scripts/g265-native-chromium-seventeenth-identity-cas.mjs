// G265 seventeenth Identity Review: native Chromium source-bound isolated CAS.
// Uses real Chromium Web Locks, IndexedDB and SQL.js/WASM on disposable loopback.
// Executes the unchanged Legacy Writer only under a test-only atomic wrapper.
// The production writer has NO native BEGIN/ROLLBACK; this fixture does not grant
// production admission, access player data, or establish Android Owner UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/identity-review.js',import.meta.url),'utf8');
const start='async function confirmIndependent(pokemonId) {';
const end='\nasync function markEvolution(';
assert.equal(source.split(start).length,2,'source module header changed');
assert.equal(source.split(end).length,2,'source-bound writer end changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(operation,/async function confirmIndependent\(pokemonId\)/);
assert.match(operation,/UPDATE pokemon SET identity_review_required=0/);
assert.match(operation,/INSERT OR REPLACE INTO pokemon_identity_evidence/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(operation,/createSqliteCrossTabWriteAdmission|navigator\.locks|runSqliteWriteSession/);
console.log('PASS G265_SEVENTEENTH_NATIVE_IDENTITY_EXACT_SOURCE_BOUND_NO_PRODUCTION_WIRING');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','native fixture must never visit a deployed origin');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,identity_review_required INTEGER,identity_confidence REAL,last_updated_at TEXT,status TEXT)');
seedDb.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seedDb.run('INSERT INTO pokemon VALUES(?,?,1,0.2,?,?)',['synthetic_'+id,'instance_'+id,'seed','active']);
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
  await page.goto(new URL('g265-identity-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-identity-native.js',base).href});
  await page.evaluate(async exact=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-identity-native.wasm'});
    const databaseName='g265_seventeenth_evidence_disposable_native_fixture';
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
        const rows=query=>{try{return db.exec(query)?.[0]?.values||[];}catch(error){
          if(/no such table/.test(error.message))return [];
          throw error;
        }};
        return {sha256:await fingerprint(bytes),bytes:Array.from(bytes),
          flags:rows('SELECT pokemon_id,identity_review_required FROM pokemon ORDER BY pokemon_id'),
          evidence:rows('SELECT pokemon_instance_id,evidence_type FROM pokemon_identity_evidence ORDER BY pokemon_instance_id'),
          master:rows('SELECT id,value FROM synthetic_public_master')};
      }finally{db.close();}
    };
    v.run=async(id,expected,opts={})=>{
      try{
        const result=await v.gate.execute({
          reason:'native-synthetic-recipe-evidence-'+id,expectedFingerprint:expected,
          writeUnderLock:async({latestBytes,observedFingerprint})=>{
            if(observedFingerprint!==await fingerprint(latestBytes))throw Error('NATIVE_INVALID_PREIMAGE');
            v.opened++;
            const db=new SQL.Database(latestBytes);
            db.run('BEGIN IMMEDIATE');
            let inTransaction=true;
            const env={
              async snapshot(reason){
                if(reason!=='identity-confirm:synthetic_'+id)throw Error('NATIVE_BAD_SNAPSHOT_REASON');
              },
              localIso:()=> '2026-11-01T11:55:00+08:00',
              Date:{now:()=>({A:1793500000001,B:1793500000002,ROLLBACK:1793500000003,ACK_LOSS:1793500000004,AFTER_RELOAD:1793500000005})[id]},
              run(sql,params=[]){
                if(!inTransaction)throw Error('NATIVE_NO_TRANSACTION');
                if(opts.failEvidence&&sql.includes('INSERT OR REPLACE INTO pokemon_identity_evidence'))
                  throw Error('NATIVE_IDENTITY_INSERT_FAILURE');
                db.run(sql,params);
              },
              renderIdentityReview(){},
              async persist(){
                if(!inTransaction)throw Error('NATIVE_PERSIST_WITHOUT_TRANSACTION');
                db.run('COMMIT');inTransaction=false;
                const bytes=new Uint8Array(db.export());
                if(opts.holdPersist){
                  v.entered=true;
                  await new Promise(resolve=>{v.release=resolve;});
                }
                await write(bytes);v.writes++;
                if(opts.loseAck)throw Error('NATIVE_ACK_LOST_AFTER_DURABLE_WRITE');
              },
              JSON,Number,String,Promise,Error,Map,Date,console
            };
            const keys=Object.keys(env);
            const save=new Function(...keys,exact+'\n;return confirmIndependent;')(...keys.map(k=>env[k]));
            try{
              await save('synthetic_'+id);
              return {persistedBytes:await read()};
            }catch(error){
              if(inTransaction){db.run('ROLLBACK');inTransaction=false;v.rollbacks++;}
              throw error;
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
const count=(state,key)=>state.evidence.filter(row=>row[0]===('instance_'+key)).length;
const flag=(state,key)=>state.flags.find(row=>row[0]===('synthetic_'+key))?.[1];
try{
  await context.route('**/g265-identity-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable identity confirmation</title>'
  }));
  await context.route('**/g265-identity-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-identity-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(bytes=>window.__g265.write(Uint8Array.from(bytes)),seed);
  for(const page of [a,b])await page.evaluate(()=>window.__g265.makeGate());
  const before=await inspect(a);
  assert.equal(before.sha256,digest(seed));
  assert.equal(before.evidence.length,0);
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
  assert.equal(count(afterA,'A'),1);assert.equal(count(afterA,'B'),0);
  assert.equal(flag(afterA,'A'),0);assert.equal(flag(afterA,'B'),1);
  assert.deepEqual(afterA.master,before.master);
  console.log('PASS G265_SEVENTEENTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'B',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  assert.equal(count(afterB,'A'),1);assert.equal(count(afterB,'B'),1);
  assert.equal(flag(afterB,'A'),0);assert.equal(flag(afterB,'B'),0);assert.equal(afterB.evidence.length,2);
  assert.deepEqual(afterB.master,before.master);
  console.log('PASS G265_SEVENTEENTH_NATIVE_FRESH_RELOAD_IDENTITY_AND_EVIDENCE');

  const c=await tab();await c.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(c),afterB);
  const rollback=await run(c,'ROLLBACK',afterB.sha256,{failEvidence:true});
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_IDENTITY_INSERT_FAILURE/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();await d.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(d),afterB);
  console.log('PASS G265_SEVENTEENTH_NATIVE_TEST_WRAPPER_ROLLBACK_DURABLE_UNCHANGED');

  const lost=await run(d,'ACK_LOSS',afterB.sha256,{loseAck:true});
  assert.deepEqual(lost,{ok:false,code:'NATIVE_ACK_LOST_AFTER_DURABLE_WRITE'});
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const e=await tab();await e.evaluate(()=>window.__g265.makeGate());
  const afterLost=await inspect(e);
  assert.equal(count(afterLost,'ACK_LOSS'),1);
  assert.equal(flag(afterLost,'ACK_LOSS'),0);assert.equal(afterLost.evidence.length,3);
  const replay=await run(b,'STALE',afterB.sha256);
  assert.deepEqual(replay,{ok:false,code:'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED'});
  assert.equal(count(await inspect(e),'B'),1);
  console.log('PASS G265_SEVENTEENTH_NATIVE_ACK_LOSS_STICKY_HOLD_STALE_NO_REPLAY');

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
  assert.equal(count(final,'AFTER_RELOAD'),1);
  assert.equal(flag(final,'AFTER_RELOAD'),0);assert.equal(final.evidence.length,4);
  assert.deepEqual(final.master,before.master);
  assert.equal(final.sha256,digest(final.bytes));
  console.log('PASS G265_SEVENTEENTH_NATIVE_NO_LOCK_FAIL_CLOSED_INDEPENDENT_DURABLE_SHA');
  console.log('HOLD G265_SEVENTEENTH_IDENTITY_NATIVE_TEST_ONLY_NOT_PRODUCTION_23_WRITERS_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed())await page.close().catch(()=>{});
  await context.close();await browser.close();
}
