// G265 nineteenth Identity Convergence: native Chromium two-tab disposable CAS gate.
// Runs the unchanged production convergeStrongIdentities() with synthetic evidence.
// Web Locks / IndexedDB / SQL.js transaction and SHA-256 CAS are TEST-ONLY wrappers.
// Never accesses player data or grants global production admission / Android Owner PASS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/identity-convergence.js',import.meta.url),'utf8');
const start='function strongCandidates(){';
const end='\nfunction boot(){';
assert.equal(source.split(start).length,2,'convergence source start changed');
assert.equal(source.split(end).length,2,'convergence source end changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
for(const pattern of [/identity_review_required=1/,/identity_confidence,0\)>=0\.95/,
  /evidence_type='registered_at'/,/evidence_type='identity_fingerprint'/,
  /await snapshot\(/,/UPDATE pokemon SET identity_review_required=0/,
  /INSERT OR REPLACE INTO pokemon_identity_evidence/,/await persist\(\)/])
  assert.match(operation,pattern);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteCrossTabWriteAdmission/);
console.log('PASS G265_NINETEENTH_NATIVE_CONVERGENCE_EXACT_SOURCE_BOUND_NO_PRODUCTION_WIRING');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','fixture must never visit a deployed origin');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,status TEXT,identity_review_required INTEGER,registered_at TEXT,identity_fingerprint TEXT,identity_confidence REAL,last_updated_at TEXT)');
seedDb.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seedDb.run('INSERT INTO pokemon VALUES(?,?,?,?,?,?,?,?)',
    ['synthetic_'+id,'instance_'+id,'active',1,null,null,0.2,'seed']);
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
  await page.goto(new URL('g265-convergence-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-convergence-native.js',base).href});
  await page.evaluate(async exact=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-convergence-native.wasm'});
    const databaseName='g265_nineteenth_convergence_disposable_native_fixture';
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
    const fingerprint=bytes=>sha256SqliteBytes(bytes,crypto);
    const v=window.__g265={SQL,read,write,opened:0,writes:0,rollbacks:0,entered:false,release:null,gate:null};
    v.makeGate=(denyLocks=false)=>{v.gate=createSqliteCrossTabWriteAdmission({
      locks:denyLocks?null:navigator.locks,readDurable:read,fingerprint,timeoutMs:10000
    });};
    v.inspect=async()=>{
      const bytes=await read();const db=new SQL.Database(bytes);
      try{
        const rows=query=>db.exec(query)?.[0]?.values||[];
        return {sha256:await fingerprint(bytes),
          flags:rows('SELECT pokemon_id,identity_review_required FROM pokemon ORDER BY pokemon_id'),
          evidence:rows('SELECT pokemon_instance_id,evidence_type FROM pokemon_identity_evidence ORDER BY pokemon_instance_id,evidence_type'),
          master:rows('SELECT id,value FROM synthetic_public_master')};
      }finally{db.close();}
    };
    v.run=async(id,expected,opts={})=>{
      try{
        const result=await v.gate.execute({
          reason:'native-synthetic-identity-convergence-'+id,expectedFingerprint:expected,
          writeUnderLock:async({latestBytes,observedFingerprint})=>{
            if(observedFingerprint!==await fingerprint(latestBytes))throw Error('NATIVE_INVALID_PREIMAGE');
            v.opened++;
            const db=new SQL.Database(latestBytes);
            db.run('BEGIN IMMEDIATE');
            let inTransaction=true;
            const rows=(sql,params=[])=>{
              const result=db.exec(sql,params);
              if(!result.length)return [];
              return result[0].values.map(values=>Object.fromEntries(
                result[0].columns.map((name,i)=>[name,values[i]])));
            };
            const env={
              rows,
              run(sql,params=[]){
                if(!inTransaction)throw Error('NATIVE_NO_TRANSACTION');
                if(opts.failEvidence&&sql.includes('INSERT OR REPLACE INTO pokemon_identity_evidence'))
                  throw Error('NATIVE_AUTO_EVIDENCE_INSERT_FAILURE');
                db.run(sql,params);
              },
              async snapshot(reason){
                if(reason!=='identity-auto-converge:1')throw Error('NATIVE_BAD_SNAPSHOT_REASON');
              },
              localIso:()=> '2026-11-01T17:55:00+08:00',
              async persist(){
                if(!inTransaction)throw Error('NATIVE_TRANSACTION_REQUIRED');
                db.run('COMMIT');inTransaction=false;
                const bytes=new Uint8Array(db.export());
                if(opts.holdPersist){
                  v.entered=true;
                  await new Promise(resolve=>{v.release=resolve;});
                }
                await write(bytes);v.writes++;
                if(opts.loseAck)throw Error('NATIVE_ACK_LOST_AFTER_DURABLE_WRITE');
              },
              document:{dispatchEvent(event){
                if(event.type!=='pokemon-sleep-data-refreshed')throw Error('NATIVE_WRONG_EVENT');
              }},
              CustomEvent:class{constructor(type){this.type=type;}},
              JSON,Number,String,Promise,Error,console
            };
            try{
              // Strong evidence is synthetic and admitted inside this disposable transaction.
              db.run('UPDATE pokemon SET registered_at=?,identity_fingerprint=?,identity_confidence=0.99 WHERE pokemon_id=?',
                ['2026-11-01T17:55:00+08:00','fingerprint_'+id,'synthetic_'+id]);
              db.run('INSERT INTO pokemon_identity_evidence VALUES(?,?,?,?,?,?,?)',
                [id+'_registered','instance_'+id,'registered_at','2026-11-01',0.99,'synthetic','synthetic']);
              db.run('INSERT INTO pokemon_identity_evidence VALUES(?,?,?,?,?,?,?)',
                [id+'_fingerprint','instance_'+id,'identity_fingerprint','fingerprint_'+id,0.99,'synthetic','synthetic']);
              const keys=Object.keys(env);
              const converge=new Function(...keys,exact+'\n;return convergeStrongIdentities;')(
                ...keys.map(k=>env[k]));
              const confirmed=await converge();
              if(confirmed!==1)throw Error('NATIVE_CONVERGENCE_COUNT_'+confirmed);
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
const status=(state,id)=>state.flags.find(row=>row[0]==='synthetic_'+id)?.[1];
const evidence=(state,id)=>state.evidence.filter(row=>row[0]==='instance_'+id).length;
try{
  await context.route('**/g265-convergence-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable convergence</title>'
  }));
  await context.route('**/g265-convergence-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-convergence-native.wasm',route=>route.fulfill({
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
  assert.equal(status(afterA,'A'),0);assert.equal(status(afterA,'B'),1);
  assert.equal(evidence(afterA,'A'),3);assert.equal(evidence(afterA,'B'),0);
  assert.deepEqual(afterA.master,before.master);
  console.log('PASS G265_NINETEENTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'B',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  assert.equal(status(afterB,'A'),0);assert.equal(status(afterB,'B'),0);
  assert.equal(evidence(afterB,'A'),3);assert.equal(evidence(afterB,'B'),3);
  assert.equal(afterB.evidence.length,6);
  const c=await tab();await c.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(c),afterB);
  console.log('PASS G265_NINETEENTH_NATIVE_FRESH_RELOAD_BOTH_CONFIRMATIONS_SIX_EVIDENCE');

  const rollback=await run(c,'ROLLBACK',afterB.sha256,{failEvidence:true});
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_AUTO_EVIDENCE_INSERT_FAILURE/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();await d.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(d),afterB);
  assert.equal(status(await inspect(d),'ROLLBACK'),1);
  console.log('PASS G265_NINETEENTH_NATIVE_TEST_WRAPPER_ROLLBACK_DURABLE_SHA_UNCHANGED');

  const lost=await run(d,'ACK_LOSS',afterB.sha256,{loseAck:true});
  assert.equal(lost.ok,false,JSON.stringify(lost));
  assert.match(lost.code,/NATIVE_ACK_LOST_AFTER_DURABLE_WRITE/);
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const afterLost=await inspect(a);
  assert.equal(status(afterLost,'ACK_LOSS'),0);
  assert.equal(evidence(afterLost,'ACK_LOSS'),3);
  const blind=await run(d,'ACK_LOSS',afterLost.sha256);
  assert.equal(blind.ok,false);assert.equal(blind.code,'SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
  const e=await tab();await e.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(e),afterLost);
  const recovered=await run(e,'AFTER_RELOAD',afterLost.sha256);
  assert.equal(recovered.ok,true,JSON.stringify(recovered));
  const afterRecovered=await inspect(e);
  assert.equal(afterRecovered.evidence.length,12);
  assert.equal(evidence(afterRecovered,'ACK_LOSS'),3);
  assert.equal(evidence(afterRecovered,'AFTER_RELOAD'),3);
  assert.deepEqual(afterRecovered.master,before.master);
  console.log('PASS G265_NINETEENTH_NATIVE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

  const noLocks=await tab();await noLocks.evaluate(()=>window.__g265.makeGate(true));
  const denied=await run(noLocks,'B',afterRecovered.sha256);
  assert.equal(denied.ok,false);assert.equal(denied.code,'SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
  assert.equal(await noLocks.evaluate(()=>window.__g265.opened),0);
  assert.equal(await noLocks.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(noLocks),afterRecovered);
  console.log('PASS G265_NINETEENTH_NATIVE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
  console.log('HOLD G265_NINETEENTH_NATIVE_TEST_WRAPPER_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
}finally{
  await Promise.all(pages.map(page=>page.close().catch(()=>{})));
  await browser.close();
}
