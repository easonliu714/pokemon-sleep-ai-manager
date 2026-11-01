// G265 eighteenth Professor Transfer: native Chromium two-tab isolated CAS gate.
// Executes the exact unchanged production transferPokemonToProfessor source with
// observedCandyQuantity=null in disposable synthetic SQL.js/IndexedDB only.
// BEGIN/ROLLBACK, Web Locks and SHA-256 CAS are TEST WRAPPERS, not production wiring.
// No real player SQLite/IDB, candy mutation, Public Master or Android Owner PASS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/pokemon-professor-transfer.js',import.meta.url),'utf8');
const start='export async function transferPokemonToProfessor(';
const end='\nexport function professorTransferCandyGuidance()';
assert.equal(source.split(start).length,2,'professor transfer source header changed');
assert.equal(source.split(end).length,2,'professor transfer source end changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /,'');
for(const pattern of [/async function transferPokemonToProfessor\(/,/await snapshot\(/,
  /UPDATE pokemon SET status='sent_to_professor'/,/INSERT INTO pokemon_history/,
  /INSERT INTO import_batches/,/INSERT INTO import_changes/,/commit\(\);await persist\(\)/])
  assert.match(operation,pattern);
assert.doesNotMatch(operation,/createSqliteCrossTabWriteAdmission|navigator\.locks|runSqliteWriteSession/);
console.log('PASS G265_EIGHTEENTH_PROFESSOR_NATIVE_EXACT_SOURCE_BOUND_NO_PRODUCTION_WIRING');

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','native fixture must never visit a deployed origin');
const SQL=await initSqlJs();
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,species TEXT,current_species TEXT,status TEXT,last_updated_at TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE pokemon_history(id INTEGER PRIMARY KEY AUTOINCREMENT,pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seedDb.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seedDb.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT,PRIMARY KEY(update_id,operation_index))');
seedDb.run('CREATE TABLE candy_inventory(candy_id TEXT PRIMARY KEY,quantity INTEGER)');
seedDb.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seedDb.run('INSERT INTO pokemon VALUES(?,?,?,?,?,?,?)',
    ['synthetic_'+id,'instance_'+id,'species_'+id,'species_'+id,'active','seed','seed']);
seedDb.run("INSERT INTO candy_inventory VALUES('sentinel',99)");
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
  await page.goto(new URL('g265-professor-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-professor-native.js',base).href});
  await page.evaluate(async exact=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-professor-native.wasm'});
    const databaseName='g265_eighteenth_professor_disposable_native_fixture';
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
          flags:rows('SELECT pokemon_id,status FROM pokemon ORDER BY pokemon_id'),
          history:rows('SELECT pokemon_id,event_type FROM pokemon_history ORDER BY pokemon_id'),
          batches:rows('SELECT update_id FROM import_batches ORDER BY update_id'),
          changes:rows('SELECT key_json FROM import_changes ORDER BY key_json'),
          candy:rows('SELECT candy_id,quantity FROM candy_inventory'),
          master:rows('SELECT id,value FROM synthetic_public_master')};
      }finally{db.close();}
    };
    v.run=async(id,expected,opts={})=>{
      try{
        const result=await v.gate.execute({
          reason:'native-synthetic-professor-transfer-'+id,expectedFingerprint:expected,
          writeUnderLock:async({latestBytes,observedFingerprint})=>{
            if(observedFingerprint!==await fingerprint(latestBytes))throw Error('NATIVE_INVALID_PREIMAGE');
            v.opened++;
            const db=new SQL.Database(latestBytes);
            let inTransaction=false;
            const rowObjects=(sql,params=[])=>{
              const result=db.exec(sql,params);
              if(!result.length)return [];
              return result[0].values.map(values=>Object.fromEntries(
                result[0].columns.map((name,i)=>[name,values[i]])));
            };
            const env={
              rows:rowObjects,
              run(sql,params=[]){
                if(!inTransaction)throw Error('NATIVE_NO_TRANSACTION');
                if(/INSERT INTO candy_inventory|UPDATE candy_inventory|candy_inventory_events/i.test(sql))
                  throw Error('NATIVE_UNEXPECTED_CANDY_MUTATION');
                if(opts.failHistory&&sql.includes('INSERT INTO pokemon_history'))
                  throw Error('NATIVE_PROFESSOR_HISTORY_INSERT_FAILURE');
                db.run(sql,params);
              },
              begin(){if(inTransaction)throw Error('NATIVE_DOUBLE_BEGIN');db.run('BEGIN IMMEDIATE');inTransaction=true;},
              commit(){if(!inTransaction)throw Error('NATIVE_COMMIT_WITHOUT_BEGIN');db.run('COMMIT');inTransaction=false;},
              rollback(){if(inTransaction){db.run('ROLLBACK');inTransaction=false;v.rollbacks++;}},
              async snapshot(reason){
                if(reason!=='professor_transfer:synthetic_'+id)throw Error('NATIVE_BAD_SNAPSHOT_REASON');
              },
              async persist(){
                if(inTransaction)throw Error('NATIVE_COMMIT_REQUIRED_BEFORE_PERSIST');
                const bytes=new Uint8Array(db.export());
                if(opts.holdPersist){
                  v.entered=true;
                  await new Promise(resolve=>{v.release=resolve;});
                }
                await write(bytes);v.writes++;
                if(opts.loseAck)throw Error('NATIVE_ACK_LOST_AFTER_DURABLE_WRITE');
              },
              normalizeObservedCandyQuantity(value){
                if(value!==null)throw Error('NATIVE_CANDY_QUANTITY_MUST_REMAIN_NULL');
                return null;
              },
              canonicalCandyStorageForSpecies(){
                return {status:'REVIEW_REQUIRED',source_master:null,
                  storage:{reason:'SYNTHETIC_NO_CANDY'},canonical_master:null};
              },
              speciesCandyName:()=>null,
              makeId:prefix=>prefix+'-synthetic-'+id,
              now:()=> '2026-11-01T14:55:00+08:00',
              trace(){},
              recordCandyInventoryEvent(){throw Error('NATIVE_UNEXPECTED_CANDY_EVENT');},
              CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_READONLY',
              CANDY_MUTATION_TYPES:{DELTA_EVENT:'DELTA_EVENT'},
              PROFESSOR_TRANSFER_CANDY_RULE_STATUS:'NOT_YET_VERIFIED',
              PROFESSOR_TRANSFER_CANDY_AUTHORITY:'USER_DIRECT_OBSERVATION_ONLY',
              Date:{now:()=>({A:1793520000001,B:1793520000002,ROLLBACK:1793520000003,
                ACK_LOSS:1793520000004,AFTER_RELOAD:1793520000005})[id]},
              Math:{random:()=>({A:0.1111,B:0.2222,ROLLBACK:0.3333,
                ACK_LOSS:0.4444,AFTER_RELOAD:0.5555})[id]},
              JSON,Number,String,Promise,Error,console
            };
            const keys=Object.keys(env);
            const transfer=new Function(...keys,exact+'\n;return transferPokemonToProfessor;')(
              ...keys.map(k=>env[k]));
            try{
              const value=await transfer('synthetic_'+id,{observedCandyQuantity:null});
              if(value.transfer.candy_inventory_applied!==false||
                 value.transfer.quantity_authority!=='NOT_OBSERVED')
                throw Error('NATIVE_CANDY_AUTHORITY_BROKEN');
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
const count=(state,key)=>state.history.filter(row=>row[0]===('synthetic_'+key)).length;
const status=(state,key)=>state.flags.find(row=>row[0]===('synthetic_'+key))?.[1];
const audit=(state,key)=>state.changes.filter(row=>row[0].includes('synthetic_'+key)).length;
try{
  await context.route('**/g265-professor-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable professor transfer</title>'
  }));
  await context.route('**/g265-professor-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-professor-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(bytes=>window.__g265.write(Uint8Array.from(bytes)),seed);
  for(const page of [a,b])await page.evaluate(()=>window.__g265.makeGate());
  const before=await inspect(a);
  assert.equal(before.sha256,digest(seed));
  assert.equal(before.history.length,0);
  assert.deepEqual(before.candy,[['sentinel',99]]);
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
  assert.equal(audit(afterA,'A'),1);assert.equal(audit(afterA,'B'),0);
  assert.equal(status(afterA,'A'),'sent_to_professor');
  assert.equal(status(afterA,'B'),'active');
  assert.deepEqual(afterA.candy,before.candy);assert.deepEqual(afterA.master,before.master);
  console.log('PASS G265_EIGHTEENTH_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'B',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  assert.equal(count(afterB,'A'),1);assert.equal(count(afterB,'B'),1);
  assert.equal(audit(afterB,'A'),1);assert.equal(audit(afterB,'B'),1);
  assert.equal(afterB.batches.length,2);assert.equal(afterB.changes.length,2);
  assert.equal(status(afterB,'A'),'sent_to_professor');
  assert.equal(status(afterB,'B'),'sent_to_professor');
  assert.deepEqual(afterB.candy,before.candy);assert.deepEqual(afterB.master,before.master);
  const c=await tab();await c.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(c),afterB);
  console.log('PASS G265_EIGHTEENTH_NATIVE_FRESH_RELOAD_HISTORY_IMPORT_AUDIT_NO_CANDY');

  const rollback=await run(c,'ROLLBACK',afterB.sha256,{failHistory:true});
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_PROFESSOR_HISTORY_INSERT_FAILURE/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();await d.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(d),afterB);
  assert.equal(status(await inspect(d),'ROLLBACK'),'active');
  console.log('PASS G265_EIGHTEENTH_NATIVE_TEST_WRAPPER_ROLLBACK_DURABLE_UNCHANGED');

  const lost=await run(d,'ACK_LOSS',afterB.sha256,{loseAck:true});
  assert.deepEqual(lost,{ok:false,code:'NATIVE_ACK_LOST_AFTER_DURABLE_WRITE'});
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const e=await tab();await e.evaluate(()=>window.__g265.makeGate());
  const afterLost=await inspect(e);
  assert.equal(count(afterLost,'ACK_LOSS'),1);assert.equal(audit(afterLost,'ACK_LOSS'),1);
  assert.equal(status(afterLost,'ACK_LOSS'),'sent_to_professor');
  assert.equal(afterLost.history.length,3);
  const replay=await run(b,'B',afterB.sha256);
  assert.deepEqual(replay,{ok:false,code:'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED'});
  assert.equal(count(await inspect(e),'B'),1);
  console.log('PASS G265_EIGHTEENTH_NATIVE_ACK_LOSS_STICKY_HOLD_NO_BLIND_REPLAY');

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
  assert.equal(count(final,'AFTER_RELOAD'),1);assert.equal(audit(final,'AFTER_RELOAD'),1);
  assert.equal(final.history.length,4);assert.equal(final.batches.length,4);
  assert.deepEqual(final.candy,before.candy);assert.deepEqual(final.master,before.master);
  assert.equal(final.sha256,digest(final.bytes));
  console.log('PASS G265_EIGHTEENTH_NATIVE_NO_LOCK_FAIL_CLOSED_INDEPENDENT_DURABLE_SHA');
  console.log('HOLD G265_EIGHTEENTH_PROFESSOR_NATIVE_TEST_ONLY_NO_CANDY_PRODUCTION_23_WRITERS_ANDROID');
}finally{
  for(const page of pages)if(!page.isClosed())await page.close().catch(()=>{});
  await context.close();await browser.close();
}
