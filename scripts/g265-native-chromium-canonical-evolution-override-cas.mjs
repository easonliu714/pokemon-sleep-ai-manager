// G265 canonical Evolution Override: native Chromium two-tab CAS / rollback / ACK-loss Source Gate.
// Executes the unchanged production persistAppliedOverride() in disposable SQL.js with real
// Chromium Web Locks + IndexedDB and a TEST-ONLY SHA-256 CAS admission adapter.
// No player data, production runtime wiring, release version or Android Owner PASS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/analysis-confirmation-evolution-authority.js',import.meta.url),'utf8');
function exactSlice(start,end){
  assert.equal(source.split(start).length,2,'production start boundary changed: '+start);
  assert.equal(source.split(end).length,2,'production end boundary changed: '+end);
  return source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
}
const helpers=exactSlice('const text=', 'const clone=')
  +exactSlice('function requirementFieldsFrom(', 'function draftHasExplicitOverrideMode(')
  +exactSlice('export function normalizePlayerEvolutionOverride(', 'export function getPersistedPlayerEvolutionOverride(');
const writer=exactSlice('async function persistAppliedOverride(', '\nfunction installPlayerEvolutionOverrideUi(');
for(const marker of [/await snapshot\(/,/begin\(\)/,/INSERT INTO pokemon_evolution_override/,
  /UPDATE pokemon SET evolution_level_required=/,/INSERT INTO pokemon_history/,
  /commit\(\);await persist\(\)/,/player_evolution_override_persisted/])
  assert.match(writer,marker,'must exercise unchanged production write/ACK path');
assert.doesNotMatch(writer,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
assert.match(source,/addEventListener\('pokemon-sleep:analysis-confirmed-applied',event=>\{void persistAppliedOverride\(event\);/);
console.log('PASS G265_EVOLUTION_OVERRIDE_NATIVE_EXACT_SOURCE_BOUND_NO_PRODUCTION_WIRING');


const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','fixture must never visit a deployed origin');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,evolution_level_required INTEGER,evolution_sleep_hours_required REAL,evolution_candy_required INTEGER,evolution_item_required TEXT,evolution_other_requirement TEXT)');
seedDb.run('CREATE TABLE pokemon_evolution_override(pokemon_id TEXT PRIMARY KEY,authority_mode TEXT NOT NULL,override_status TEXT,target_override TEXT,override_reason TEXT,required_level INTEGER,required_sleep_hours REAL,required_candy INTEGER,required_item TEXT,other_requirement TEXT,source_analysis_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
seedDb.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seedDb.run('INSERT INTO pokemon(pokemon_id) VALUES(?)',['synthetic_'+id]);
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
  await page.goto(new URL('g265-evolution-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-evolution-native.js',base).href});
  await page.evaluate(async exact=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-evolution-native.wasm'});
    const databaseName='g265_evolution_override_disposable_native_fixture';
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
      rollbacks:0,snapshots:0,successTraces:0,failureTraces:0,entered:false,release:null,gate:null};
    v.makeGate=(denyLocks=false)=>{v.gate=createSqliteCrossTabWriteAdmission({
      locks:denyLocks?null:navigator.locks,readDurable:read,fingerprint,timeoutMs:10000
    });};
    v.inspect=async()=>{
      const bytes=await read();const db=new SQL.Database(bytes);
      try{
        const rows=query=>db.exec(query)?.[0]?.values||[];
        return {sha256:await fingerprint(bytes),
          overrides:rows('SELECT pokemon_id,required_level FROM pokemon_evolution_override ORDER BY pokemon_id'),
          pokemon:rows('SELECT pokemon_id,evolution_level_required FROM pokemon ORDER BY pokemon_id'),
          history:rows('SELECT pokemon_id,event_type FROM pokemon_history ORDER BY pokemon_id'),
          master:rows('SELECT id,value FROM synthetic_public_master')};
      }finally{db.close();}
    };
    v.run=async(id,expected,opts={})=>{
      try{
        const result=await v.gate.execute({
          reason:'native-synthetic-evolution-override-'+id,expectedFingerprint:expected,
          writeUnderLock:async({latestBytes,observedFingerprint})=>{
            if(observedFingerprint!==await fingerprint(latestBytes))throw Error('NATIVE_INVALID_PREIMAGE');
            v.opened++;
            const db=new SQL.Database(latestBytes);
            const pokemon='synthetic_'+id,group='group_'+id;
            const level=({A:18,B:29,ROLLBACK:41,ACK_LOSS:42,AFTER_RELOAD:43})[id];
            const groupOverrideState=new Map([[group,{
              evolution_authority_mode:'PLAYER_OVERRIDE',
              evolution_override_status:'CUSTOM_REQUIREMENTS',
              evolution_target_override:pokemon+'_next',
              evolution_override_reason:'synthetic native fixture',
              custom_requirements:{evolution_level_required:level,evolution_candy_required:80}
            }]]);
            const statusNode={className:'',textContent:''};
            let transaction=false,lastError=null,localSuccess=0;
            const rows=(sql,params=[])=>{
              const result=db.exec(sql,params);
              if(!result.length)return [];
              return result[0].values.map(values=>Object.fromEntries(
                result[0].columns.map((name,i)=>[name,values[i]])));
            };
            window.DebugTrace={record:(_category,event,detail)=>{
              if(event==='player_evolution_override_persisted'){v.successTraces++;localSuccess++;}
              if(event==='player_evolution_override_persist_failed'){
                v.failureTraces++;lastError=Error(String(detail?.error||'NATIVE_EVOLUTION_WRITE_FAILED'));
              }
            }};
            const env={
              groupOverrideState,
              PLAYER_OVERRIDE:'PLAYER_OVERRIDE',PUBLIC_MASTER:'PUBLIC_MASTER',
              CUSTOM_REQUIREMENTS:'CUSTOM_REQUIREMENTS',CANNOT_EVOLVE:'CANNOT_EVOLVE',
              ensurePlayerOverrideTable:()=>true,
              readOverrideRow:key=>rows('SELECT * FROM pokemon_evolution_override WHERE pokemon_id=?',[key])[0]||null,
              async snapshot(reason){
                if(reason!=='before_player_evolution_override_'+pokemon)throw Error('NATIVE_BAD_SNAPSHOT_REASON');
                v.snapshots++;return {status:'NATIVE_SYNTHETIC_SNAPSHOT'};
              },
              begin(){if(transaction)throw Error('NATIVE_DOUBLE_BEGIN');db.run('BEGIN IMMEDIATE');transaction=true;},
              commit(){if(!transaction)throw Error('NATIVE_DOUBLE_COMMIT');db.run('COMMIT');transaction=false;},
              rollback(){if(transaction){db.run('ROLLBACK');transaction=false;v.rollbacks++;}},
              run(sql,params=[]){
                if(!transaction)throw Error('NATIVE_SQL_OUTSIDE_TRANSACTION');
                v.sqlWrites++;
                if(opts.failHistory&&sql.includes('INSERT INTO pokemon_history'))
                  throw Error('NATIVE_EVOLUTION_HISTORY_INSERT_FAILURE');
                db.run(sql,params);
              },
              async persist(){
                if(transaction)throw Error('NATIVE_TRANSACTION_NOT_COMMITTED');
                const bytes=new Uint8Array(db.export());
                if(opts.holdPersist){v.entered=true;await new Promise(resolve=>{v.release=resolve;});}
                await write(bytes);v.writes++;
                if(opts.loseAck)throw Error('NATIVE_ACK_LOST_AFTER_DURABLE_WRITE');
              },
              nowIso:()=> '2026-11-02T04:55:00+08:00',
              document:{querySelector:selector=>selector==='#analysisConfirmationStatus'?statusNode:null},
              Date,JSON,Number,String,Object,Promise,Error,console
            };
            try{
              const keys=Object.keys(env);
              const apply=new Function(...keys,exact+'\n;return persistAppliedOverride;')(...keys.map(k=>env[k]));
              await apply({detail:{group_id:group,pokemon_id:pokemon,analysis_id:'native_analysis_'+id}});
              if(lastError)throw lastError; // Original event writer swallows errors; test admission must not ACK.
              if(localSuccess!==1)throw Error('NATIVE_EVOLUTION_ACK_COUNT_'+localSuccess);
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
const level=(state,id)=>state.overrides.find(row=>row[0]==='synthetic_'+id)?.[1];
const instance=(state,id)=>state.pokemon.find(row=>row[0]==='synthetic_'+id)?.[1];
const history=(state,id)=>state.history.filter(row=>row[0]==='synthetic_'+id).length;
try{
  await context.route('**/g265-evolution-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable evolution override</title>'
  }));
  await context.route('**/g265-evolution-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-evolution-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(bytes=>window.__g265.write(Uint8Array.from(bytes)),seed);
  for(const page of [a,b])await page.evaluate(()=>window.__g265.makeGate());
  const before=await inspect(a);
  assert.equal(before.sha256,digest(seed));
  assert.equal(before.overrides.length,0);
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
  assert.equal(level(afterA,'A'),18);assert.equal(level(afterA,'B'),undefined);
  assert.equal(instance(afterA,'A'),18);assert.equal(instance(afterA,'B'),null);
  assert.equal(history(afterA,'A'),1);assert.equal(history(afterA,'B'),0);
  assert.deepEqual(afterA.master,before.master);
  console.log('PASS G265_EVOLUTION_OVERRIDE_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'B',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  for(const [id,n] of [['A',18],['B',29]]){
    assert.equal(level(afterB,id),n);assert.equal(instance(afterB,id),n);assert.equal(history(afterB,id),1);
  }
  const c=await tab();await c.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(c),afterB);
  console.log('PASS G265_EVOLUTION_OVERRIDE_NATIVE_FRESH_RELOAD_BOTH_OVERRIDES_FIELDS_HISTORY');

  const rollback=await run(c,'ROLLBACK',afterB.sha256,{failHistory:true});
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_EVOLUTION_HISTORY_INSERT_FAILURE/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();await d.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(d),afterB);
  assert.equal(level(await inspect(d),'ROLLBACK'),undefined);
  assert.equal(instance(await inspect(d),'ROLLBACK'),null);
  console.log('PASS G265_EVOLUTION_OVERRIDE_NATIVE_ROLLBACK_DURABLE_SHA_UNCHANGED');

  const lost=await run(d,'ACK_LOSS',afterB.sha256,{loseAck:true});
  assert.equal(lost.ok,false,JSON.stringify(lost));
  assert.match(lost.code,/NATIVE_ACK_LOST_AFTER_DURABLE_WRITE/);
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const afterLost=await inspect(a);
  assert.equal(level(afterLost,'ACK_LOSS'),42);
  assert.equal(instance(afterLost,'ACK_LOSS'),42);
  assert.equal(history(afterLost,'ACK_LOSS'),1);
  const blind=await run(d,'ACK_LOSS',afterLost.sha256);
  assert.equal(blind.ok,false);assert.equal(blind.code,'SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
  const e=await tab();await e.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(e),afterLost);
  const recovered=await run(e,'AFTER_RELOAD',afterLost.sha256);
  assert.equal(recovered.ok,true,JSON.stringify(recovered));
  const afterRecovered=await inspect(e);
  assert.equal(afterRecovered.overrides.length,4);
  assert.equal(afterRecovered.history.length,4);
  assert.equal(level(afterRecovered,'AFTER_RELOAD'),43);
  assert.equal(instance(afterRecovered,'AFTER_RELOAD'),43);
  assert.equal(history(afterRecovered,'AFTER_RELOAD'),1);
  assert.deepEqual(afterRecovered.master,before.master);
  console.log('PASS G265_EVOLUTION_OVERRIDE_NATIVE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

  const noLocks=await tab();await noLocks.evaluate(()=>window.__g265.makeGate(true));
  const denied=await run(noLocks,'B',afterRecovered.sha256);
  assert.equal(denied.ok,false);assert.equal(denied.code,'SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
  assert.equal(await noLocks.evaluate(()=>window.__g265.opened),0);
  assert.equal(await noLocks.evaluate(()=>window.__g265.sqlWrites),0);
  assert.equal(await noLocks.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(noLocks),afterRecovered);
  console.log('PASS G265_EVOLUTION_OVERRIDE_NATIVE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
  console.log('HOLD G265_EVOLUTION_OVERRIDE_NATIVE_TEST_WRAPPER_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
}finally{
  await Promise.all(pages.map(page=>page.close().catch(()=>{})));
  await browser.close();
}
