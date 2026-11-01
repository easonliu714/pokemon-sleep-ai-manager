// G265 sixteenth Recipe Display Name Evidence: native Chromium source-bound isolated CAS.
// Uses real Chromium Web Locks, IndexedDB and SQL.js/WASM on disposable loopback.
// Executes the unchanged Legacy Writer only under a test-only atomic wrapper.
// The production writer has NO native BEGIN/ROLLBACK; this fixture does not grant
// production admission, access player data, or establish Android Owner UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/recipe-display-name-evidence.js',import.meta.url),'utf8');
const start="export const RECIPE_DISPLAY_NAME_EVIDENCE_VERSION=";
const end='\nasync function onDataChanged(';
assert.equal(source.split(start).length,2,'source module header changed');
assert.equal(source.split(end).length,2,'source-bound writer end changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
assert.match(operation,/async function persistConfirmedRecipeDisplayNamesFromUcImg\(\)/);
assert.match(operation,/INSERT OR IGNORE INTO recipe_display_name_evidence/);
assert.match(operation,/INSERT OR IGNORE INTO canonical_resolution_log/);
assert.match(operation,/if\(confirmed\.length\)await persist\(\)/);
assert.doesNotMatch(operation,/createSqliteCrossTabWriteAdmission|navigator\.locks|runSqliteWriteSession/);
console.log('PASS G265_SIXTEENTH_NATIVE_EVIDENCE_EXACT_SOURCE_BOUND_NO_PRODUCTION_WIRING');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','native fixture must never visit a deployed origin');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)');
seedDb.run('INSERT INTO schema_migrations VALUES(1)');
seedDb.run('CREATE TABLE canonical_resolution_log(resolution_id TEXT PRIMARY KEY,entity_type TEXT,raw_text TEXT,normalized_text TEXT,resolution_status TEXT,term_id TEXT,canonical_name_zh_tw TEXT,confidence REAL,requires_review INTEGER,source_type TEXT,source_ref TEXT,evidence_revision TEXT,observed_at TEXT,committed_at TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
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
  await page.goto(new URL('g265-evidence-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-evidence-native.js',base).href});
  await page.evaluate(async exact=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-evidence-native.wasm'});
    const databaseName='g265_sixteenth_evidence_disposable_native_fixture';
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
          evidence:rows('SELECT recipe_id,observed_name FROM recipe_display_name_evidence ORDER BY recipe_id'),
          audit:rows('SELECT raw_text,resolution_status FROM canonical_resolution_log ORDER BY raw_text'),
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
            const session={
              schema:'pokemon-sleep-uc-img-a-session/1.0',
              session_id:'synthetic_session_'+id,
              scenario_state:{recipes:{
                last_apply_status:'APPLIED',last_update_id:'synthetic_update_'+id,
                raw_response:JSON.stringify({
                  schema:'pokemon-sleep-public-master-recognition/1.0',
                  scenario:'recipe_status_update',recognition_version:'synthetic',
                  observations:[{
                    status:'MATCHED',observation_id:'synthetic_observation_'+id,
                    canonical_key:{recipe_id:'synthetic_recipe_'+id},
                    observed_text:'synthetic_display_'+id,
                    canonical_name:'synthetic_canonical_'+id,
                    confidence:0.99,source_image_ref:'synthetic_image_'+id,
                    user_resolution:{action:'USER_CONFIRMED_MATCH',confirmed_at:'2026-11-01T00:00:00Z'}
                  }]
                })
              }}
            };
            const env={
              rows(sql,params=[]){
                const stmt=db.prepare(sql);
                try{
                  if(params.length)stmt.bind(params);
                  const out=[];while(stmt.step())out.push(stmt.getAsObject());
                  return out;
                }finally{stmt.free();}
              },
              run(sql,params=[]){
                if(!inTransaction)throw Error('NATIVE_NO_TRANSACTION');
                if(opts.failAudit&&sql.includes('INSERT OR IGNORE INTO canonical_resolution_log'))
                  throw Error('NATIVE_AUDIT_INSERT_FAILURE');
                db.run(sql,params);
              },
              isRescueReadonly:()=>false,
              localStorage:{getItem:key=>key==='pokemon-sleep-uc-img-a-session-v1'?JSON.stringify(session):null},
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
            const save=new Function(...keys,exact+'\n;return persistConfirmedRecipeDisplayNamesFromUcImg;')(...keys.map(k=>env[k]));
            try{
              const outcome=await save();
              if(outcome.recorded_count!==1)throw Error('NATIVE_BAD_EVIDENCE_RESULT');
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
const count=(state,key)=>state.evidence.filter(row=>row[0]===key).length;
try{
  await context.route('**/g265-evidence-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable recipe evidence</title>'
  }));
  await context.route('**/g265-evidence-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-evidence-native.wasm',route=>route.fulfill({
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
  assert.equal(count(afterA,'synthetic_recipe_A'),1);assert.equal(count(afterA,'synthetic_recipe_B'),0);
  assert.equal(afterA.audit.length,1);
  assert.deepEqual(afterA.master,before.master);
  console.log('PASS G265_SIXTEENTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'B',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  assert.equal(count(afterB,'synthetic_recipe_A'),1);assert.equal(count(afterB,'synthetic_recipe_B'),1);
  assert.equal(afterB.audit.length,2);
  assert.deepEqual(afterB.master,before.master);
  console.log('PASS G265_SIXTEENTH_NATIVE_FRESH_RELOAD_EVIDENCE_AND_AUDIT');

  const c=await tab();await c.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(c),afterB);
  const rollback=await run(c,'ROLLBACK',afterB.sha256,{failAudit:true});
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_AUDIT_INSERT_FAILURE/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();await d.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(d),afterB);
  console.log('PASS G265_SIXTEENTH_NATIVE_TEST_WRAPPER_ROLLBACK_DURABLE_UNCHANGED');

  const lost=await run(d,'ACK_LOSS',afterB.sha256,{loseAck:true});
  assert.deepEqual(lost,{ok:false,code:'NATIVE_ACK_LOST_AFTER_DURABLE_WRITE'});
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const e=await tab();await e.evaluate(()=>window.__g265.makeGate());
  const afterLost=await inspect(e);
  assert.equal(count(afterLost,'synthetic_recipe_ACK_LOSS'),1);
  assert.equal(afterLost.audit.length,3);
  const replay=await run(b,'STALE',afterB.sha256);
  assert.deepEqual(replay,{ok:false,code:'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED'});
  assert.equal(count(await inspect(e),'synthetic_recipe_STALE'),0);
  console.log('PASS G265_SIXTEENTH_NATIVE_ACK_LOSS_STICKY_HOLD_STALE_NO_REPLAY');

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
  assert.equal(count(final,'synthetic_recipe_AFTER_RELOAD'),1);
  assert.equal(final.evidence.length,4);assert.equal(final.audit.length,4);
  assert.deepEqual(final.master,before.master);
  assert.equal(final.sha256,digest(final.bytes));
  console.log('PASS G265_SIXTEENTH_NATIVE_NO_LOCK_FAIL_CLOSED_INDEPENDENT_DURABLE_SHA');
  console.log('HOLD G265_SIXTEENTH_EVIDENCE_NATIVE_TEST_ONLY_NOT_PRODUCTION_23_WRITERS_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed())await page.close().catch(()=>{});
  await context.close();await browser.close();
}
