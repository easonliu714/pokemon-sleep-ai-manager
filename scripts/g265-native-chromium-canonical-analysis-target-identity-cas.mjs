// G265 canonical Analysis Target Identity native Chromium two-tab CAS/rollback/ACK-loss Gate.
// Runs unchanged production ensurePokemonInstanceId() against disposable SQL.js and
// actual Chromium Web Locks + IndexedDB; admission wrapper is TEST-ONLY, not production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/analysis-target-identity.js',import.meta.url),'utf8');
function exactSlice(start,end){
  assert.equal(source.split(start).length,2,'production start boundary changed: '+start);
  assert.equal(source.split(end).length,2,'production end boundary changed: '+end);
  return source.slice(source.indexOf(start),source.indexOf(end));
}
const helpers=exactSlice('const uuid=', 'function ensureBindingTable(');
const writer=exactSlice('async function ensurePokemonInstanceId(', 'export async function createExistingPokemonAnalysisContext(');
for(const marker of [/await snapshot\(/,/begin\(\)/,/UPDATE pokemon SET pokemon_instance_id=/,
  /INSERT INTO pokemon_history/,/commit\(\);await persist\(\)/,/platform_identity_assigned/])
  assert.match(writer,marker,'must execute unchanged production writer');
assert.doesNotMatch(writer,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
assert.match(source,/export async function createExistingPokemonAnalysisContext\(pokemonId\)\{\s*const row=await ensurePokemonInstanceId\(pokemonId\)/);
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_NATIVE_EXACT_SOURCE_BOUND_NO_PRODUCTION_WIRING');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','never visit deployed origin');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,status TEXT NOT NULL,pokemon_instance_id TEXT,last_updated_at TEXT,source_update_id TEXT,species TEXT)');
seedDb.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seedDb.run('INSERT INTO pokemon(pokemon_id,status,species) VALUES(?,?,?)',['synthetic_'+id,'active','Species_'+id]);
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
  await page.goto(new URL('g265-target-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-target-native.js',base).href});
  await page.evaluate(async exact=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-target-native.wasm'});
    const databaseName='g265_target_identity_disposable_native_fixture';
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
    const v=window.__g265={SQL,read,write,opened:0,writes:0,sqlWrites:0,
      rollbacks:0,snapshots:0,successTraces:0,entered:false,release:null,gate:null};
    v.makeGate=(denyLocks=false)=>{v.gate=createSqliteCrossTabWriteAdmission({
      locks:denyLocks?null:navigator.locks,readDurable:read,fingerprint,timeoutMs:10000
    });};
    v.inspect=async()=>{
      const bytes=await read();const db=new SQL.Database(bytes);
      try{
        const rows=query=>db.exec(query)?.[0]?.values||[];
        return {sha256:await fingerprint(bytes),
          pokemon:rows('SELECT pokemon_id,pokemon_instance_id,source_update_id FROM pokemon ORDER BY pokemon_id'),
          history:rows('SELECT pokemon_id,event_type,source_update_id FROM pokemon_history ORDER BY pokemon_id'),
          master:rows('SELECT id,value FROM synthetic_public_master')};
      }finally{db.close();}
    };
    v.run=async(id,expected,opts={})=>{
      try{
        const result=await v.gate.execute({
          reason:'native-synthetic-target-identity-'+id,expectedFingerprint:expected,
          writeUnderLock:async({latestBytes,observedFingerprint})=>{
            if(observedFingerprint!==await fingerprint(latestBytes))throw Error('NATIVE_INVALID_PREIMAGE');
            v.opened++;
            const db=new SQL.Database(latestBytes);
            const pokemon='synthetic_'+id;
            let transaction=false,localSuccess=0;
            const rows=(sql,params=[])=>{
              const result=db.exec(sql,params);
              if(!result.length)return [];
              return result[0].values.map(values=>Object.fromEntries(
                result[0].columns.map((name,i)=>[name,values[i]])));
            };
            window.UpdateCenterLiveDebug={record:(event,detail)=>{
              if(event==='analysis_target_instance_id_assigned'){
                if(detail.has_target_instance_id!==true)throw Error('NATIVE_MISSING_ID_TRACE');
                v.successTraces++;localSuccess++;
              }
            }};
            const env={
              rows,
              run(sql,params=[]){
                if(!transaction)throw Error('NATIVE_SQL_OUTSIDE_TRANSACTION');
                v.sqlWrites++;
                if(opts.failHistory&&sql.includes('INSERT INTO pokemon_history'))
                  throw Error('NATIVE_TARGET_HISTORY_INSERT_FAILURE');
                db.run(sql,params);
              },
              begin(){if(transaction)throw Error('NATIVE_DOUBLE_BEGIN');db.run('BEGIN IMMEDIATE');transaction=true;},
              commit(){if(!transaction)throw Error('NATIVE_DOUBLE_COMMIT');db.run('COMMIT');transaction=false;},
              rollback(){if(transaction){db.run('ROLLBACK');transaction=false;v.rollbacks++;}},
              async snapshot(reason){
                if(reason!=='analysis_target_identity:'+pokemon)throw Error('NATIVE_BAD_SNAPSHOT_REASON');
                v.snapshots++;return {status:'NATIVE_SYNTHETIC_SNAPSHOT'};
              },
              async persist(){
                if(transaction)throw Error('NATIVE_TRANSACTION_NOT_COMMITTED');
                const bytes=new Uint8Array(db.export());
                if(opts.holdPersist){v.entered=true;await new Promise(resolve=>{v.release=resolve;});}
                await write(bytes);v.writes++;
                if(opts.loseAck)throw Error('NATIVE_TARGET_ACK_LOST_AFTER_DURABLE_WRITE');
              },
              localIso:()=> '2026-11-02T07:55:00+08:00',
              JSON,Number,String,Object,Promise,Error,Date,Math,console
            };
            try{
              const keys=Object.keys(env);
              const apply=new Function(...keys,exact+'\n;return ensurePokemonInstanceId;')(...keys.map(k=>env[k]));
              const after=await apply(pokemon);
              if(!String(after.pokemon_instance_id||'').startsWith('pkm-'))
                throw Error('NATIVE_INSTANCE_ID_MISSING');
              if(localSuccess!==1)throw Error('NATIVE_TARGET_ACK_COUNT_'+localSuccess);
              return {persistedBytes:await read()};
            }catch(error){
              if(transaction){db.run('ROLLBACK');transaction=false;v.rollbacks++;}
              throw error;
            }finally{db.close();}
          }
        });
        return {ok:true,result};
      }catch(error){return {ok:false,code:error.code||error.message};}
    };
  },helpers+'\n'+writer);
  assert.deepEqual(await page.evaluate(()=>({
    secure:isSecureContext,locks:typeof navigator.locks?.request==='function',
    idb:typeof indexedDB.open==='function',digest:typeof crypto.subtle?.digest==='function'
  })),{secure:true,locks:true,idb:true,digest:true});
  return page;
}
const run=(page,id,sha,opts={})=>page.evaluate(args=>window.__g265.run(...args),[id,sha,opts]);
const inspect=page=>page.evaluate(()=>window.__g265.inspect());
const instance=(state,id)=>state.pokemon.find(row=>row[0]==='synthetic_'+id)?.[1];
const provenance=(state,id)=>state.pokemon.find(row=>row[0]==='synthetic_'+id)?.[2];
const history=(state,id)=>state.history.filter(row=>row[0]==='synthetic_'+id);
try{
  await context.route('**/g265-target-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable target identity</title>'
  }));
  await context.route('**/g265-target-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-target-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(bytes=>window.__g265.write(Uint8Array.from(bytes)),seed);
  for(const page of [a,b])await page.evaluate(()=>window.__g265.makeGate());
  const before=await inspect(a);
  assert.equal(before.sha256,digest(seed));
  assert.equal(before.history.length,0);
  const first=run(a,'A',before.sha256,{holdPersist:true});
  await a.waitForFunction(()=>window.__g265.entered);
  const second=run(b,'B',before.sha256);
  assert.equal(await b.evaluate(()=>window.__g265.opened),0);
  await a.evaluate(()=>window.__g265.release());
  const results=await Promise.all([first,second]);
  assert.equal(results[0].ok,true,JSON.stringify(results));
  assert.deepEqual(results[1],{ok:false,code:'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED'});
  assert.equal(await b.evaluate(()=>window.__g265.opened),0);
  assert.equal(await b.evaluate(()=>window.__g265.sqlWrites),0);
  assert.equal(await b.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const afterA=await inspect(a);
  assert.ok(String(instance(afterA,'A')).startsWith('pkm-'));
  assert.equal(provenance(afterA,'A'),'platform-identity:'+instance(afterA,'A'));
  assert.equal(instance(afterA,'B'),null);
  assert.equal(history(afterA,'A').length,1);assert.equal(history(afterA,'B').length,0);
  assert.deepEqual(afterA.master,before.master);
  console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'B',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  for(const id of ['A','B']){
    assert.ok(String(instance(afterB,id)).startsWith('pkm-'));
    assert.equal(provenance(afterB,id),'platform-identity:'+instance(afterB,id));
    assert.equal(history(afterB,id).length,1);
    assert.equal(history(afterB,id)[0][1],'platform_identity_assigned');
    assert.equal(history(afterB,id)[0][2],provenance(afterB,id));
  }
  assert.notEqual(instance(afterB,'A'),instance(afterB,'B'));
  const c=await tab();await c.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(c),afterB);
  console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_NATIVE_FRESH_RELOAD_BOTH_IDS_PROVENANCE_HISTORY');

  const rollback=await run(c,'ROLLBACK',afterB.sha256,{failHistory:true});
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_TARGET_HISTORY_INSERT_FAILURE/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();await d.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(d),afterB);
  assert.equal(instance(await inspect(d),'ROLLBACK'),null);
  console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_NATIVE_ROLLBACK_DURABLE_SHA_UNCHANGED');

  const lost=await run(d,'ACK_LOSS',afterB.sha256,{loseAck:true});
  assert.equal(lost.ok,false,JSON.stringify(lost));
  assert.match(lost.code,/NATIVE_TARGET_ACK_LOST_AFTER_DURABLE_WRITE/);
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const afterLost=await inspect(a);
  assert.ok(String(instance(afterLost,'ACK_LOSS')).startsWith('pkm-'));
  assert.equal(history(afterLost,'ACK_LOSS').length,1);
  const blind=await run(d,'ACK_LOSS',afterLost.sha256);
  assert.equal(blind.ok,false);assert.equal(blind.code,'SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
  const e=await tab();await e.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(e),afterLost);
  const recovered=await run(e,'AFTER_RELOAD',afterLost.sha256);
  assert.equal(recovered.ok,true,JSON.stringify(recovered));
  const afterRecovered=await inspect(e);
  assert.equal(afterRecovered.history.length,4);
  for(const id of ['A','B','ACK_LOSS','AFTER_RELOAD']){
    assert.ok(String(instance(afterRecovered,id)).startsWith('pkm-'));
    assert.equal(provenance(afterRecovered,id),'platform-identity:'+instance(afterRecovered,id));
    assert.equal(history(afterRecovered,id).length,1);
  }
  assert.deepEqual(afterRecovered.master,before.master);
  console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_NATIVE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

  const noLocks=await tab();await noLocks.evaluate(()=>window.__g265.makeGate(true));
  const denied=await run(noLocks,'B',afterRecovered.sha256);
  assert.equal(denied.ok,false);assert.equal(denied.code,'SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
  assert.equal(await noLocks.evaluate(()=>window.__g265.opened),0);
  assert.equal(await noLocks.evaluate(()=>window.__g265.sqlWrites),0);
  assert.equal(await noLocks.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(noLocks),afterRecovered);
  console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_NATIVE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
  console.log('HOLD G265_ANALYSIS_TARGET_IDENTITY_NATIVE_TEST_WRAPPER_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
}finally{
  await Promise.all(pages.map(page=>page.close().catch(()=>{})));
  await browser.close();
}
