// G265 canonical Analysis Confirmation: native Chromium two-tab CAS, rollback, ACK-loss.
// Runs the unchanged production applyConfirmed()/writeObservation() with disposable SQL.js,
// real Web Locks and IndexedDB. Admission adapter is TEST-ONLY; no player data or runtime wiring.
// G265 Canonical Analysis Confirmation: isolated opt-in atomic durable CAS and recovery.
// Source-bound unchanged production applyConfirmed(); all SQLite rows are synthetic.
// The admission and Web Locks adapter are test-only; NEVER wire into player data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const source=fs.readFileSync(new URL('../assets/js/analysis-confirmation-workbench.js',import.meta.url),'utf8');
function exactSlice(start,end){
  assert.equal(source.split(start).length,2,'production start boundary changed: '+start);
  assert.equal(source.split(end).length,2,'production end boundary changed: '+end);
  return source.slice(source.indexOf(start),source.indexOf(end));
}
const writer=exactSlice('async function applyConfirmed(', '\nfunction activateGroup(');
for(const marker of [/await snapshot\(/,/begin\(\)/,/UPDATE pokemon SET/,/pokemon_subskills/,/pokemon_ingredients/,/writeObservation\(/,/INSERT INTO pokemon_history/,/commit\(\);await persist\(\)/])
  assert.match(writer,marker,'must execute unchanged production confirmation writer');
assert.doesNotMatch(writer,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
const helpers=[
  exactSlice('const text=', 'const meaningful='),
  exactSlice('const meaningful=', 'const objectText='),
  exactSlice('function canonical(', 'function canonicalBadge('),
  exactSlice('function dispatchConfirmationTerminal(', 'function navigationState('),
  exactSlice('function patchValue(', 'function observationId('),
  exactSlice('function observationId(', 'function writeObservation('),
  exactSlice('function writeObservation(', 'async function applyConfirmed(')
].join('\n');
console.log('PASS G265_ANALYSIS_CONFIRMATION_NATIVE_EXACT_SOURCE_BOUND_NO_PRODUCTION_WIRING');


const SQL=await initSqlJs();
const seed=new SQL.Database();
const columnMatch=writer.match(/const columns=(\[[^\]]+\]);/);
assert.ok(columnMatch,'production field inventory changed');
const productionColumns=vm.runInNewContext('('+columnMatch[1]+')');
const extra=['pokemon_id','pokemon_instance_id','status','current_species','original_species','original_label','identity_confidence','last_updated_at','source_update_id','field_evidence_json','source_image_refs_json','identity_review_required'];
const all=[...new Set([...extra,...productionColumns])];
seed.run('CREATE TABLE pokemon('+all.map(name=>'"'+name+'" TEXT').join(',')+',PRIMARY KEY(pokemon_id))');
seed.run('CREATE TABLE pokemon_subskills(pokemon_id TEXT,unlock_level INTEGER,subskill_name TEXT,is_unlocked INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_ingredients(pokemon_id TEXT,unlock_level INTEGER,ingredient_name TEXT,quantity INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_analysis_observation(observation_id TEXT PRIMARY KEY,pokemon_id TEXT,identity_group_key TEXT,source_image_ref TEXT,analysis_id TEXT,revision_no INTEGER,observed_json TEXT,canonical_json TEXT,conflict_json TEXT,created_at TEXT,applied_at TEXT)');
seed.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE canonical_term(term_id TEXT,entity_type TEXT,canonical_name_zh_tw TEXT,is_active INTEGER)');
seed.run('CREATE TABLE canonical_term_alias(term_id TEXT,alias_text TEXT,locale TEXT,is_auto_replace_safe INTEGER)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO canonical_term VALUES('ingredient-fixture','ingredient','SyntheticIngredient',1),('subskill-fixture','subskill','SyntheticSubskill',1)");
seed.run("INSERT INTO pokemon(pokemon_id,status,species,nickname,source_image_refs_json,field_evidence_json) VALUES('synthetic_A','active','Synthetic_A','baseline_A','[]','{}'),('synthetic_B','active','Synthetic_B','baseline_B','[]','{}')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
for(const id of ['ROLLBACK','ACK_LOSS','AFTER_RELOAD']) seed.run('INSERT INTO pokemon(pokemon_id,status,species,nickname,source_image_refs_json,field_evidence_json) VALUES(?,?,?,?,?,?)',['synthetic_'+id,'active','Synthetic_'+id,'baseline_'+id,'[]','{}']);
const seedBytes=Array.from(seed.export());seed.close();

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','never visit deployed origin');
const digest=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const browserJs=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browserWasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
async function tab(){
  const page=await context.newPage();pages.push(page);
  await page.goto(new URL('g265-confirmation-native-blank',base).href);
  await page.addScriptTag({url:new URL('g265-confirmation-native.js',base).href});
  await page.evaluate(async exact=>{
    const {createSqliteCrossTabWriteAdmission,sha256SqliteBytes}=
      await import('/assets/js/sqlite-cross-tab-write-admission.js');
    const SQL=await window.initSqlJs({locateFile:()=>'/g265-confirmation-native.wasm'});
    const databaseName='g265_analysis_confirmation_disposable_native_fixture';
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
      rollbacks:0,snapshots:0,successEvents:0,entered:false,release:null,gate:null};
    v.makeGate=(denyLocks=false)=>{v.gate=createSqliteCrossTabWriteAdmission({
      locks:denyLocks?null:navigator.locks,readDurable:read,fingerprint,timeoutMs:10000
    });};
    v.inspect=async()=>{
      const bytes=await read();const db=new SQL.Database(bytes);
      try{
        const q=sql=>db.exec(sql)?.[0]?.values||[];
        return {sha256:await fingerprint(bytes),
          pokemon:q('SELECT pokemon_id,nickname,source_update_id,source_image_refs_json,field_evidence_json FROM pokemon ORDER BY pokemon_id'),
          ingredients:q('SELECT pokemon_id,unlock_level,ingredient_name,quantity FROM pokemon_ingredients ORDER BY pokemon_id'),
          subskills:q('SELECT pokemon_id,unlock_level,subskill_name,is_unlocked FROM pokemon_subskills ORDER BY pokemon_id'),
          observations:q('SELECT pokemon_id,analysis_id,source_image_ref FROM pokemon_analysis_observation ORDER BY pokemon_id'),
          history:q('SELECT pokemon_id,event_type,source_update_id FROM pokemon_history ORDER BY pokemon_id'),
          master:q('SELECT id,value FROM synthetic_public_master')};
      }finally{db.close();}
    };
    v.run=async(id,expected,opts={})=>{
      try{
        const result=await v.gate.execute({
          reason:'native-synthetic-analysis-confirmation-'+id,expectedFingerprint:expected,
          writeUnderLock:async({latestBytes,observedFingerprint})=>{
            if(observedFingerprint!==await fingerprint(latestBytes))throw Error('NATIVE_INVALID_PREIMAGE');
            v.opened++;
            const db=new SQL.Database(latestBytes),pokemon='synthetic_'+id;
            const revision={analysis_id:'synthetic-analysis-'+id,revision_no:1,source_image_ref:'synthetic-image-'+id};
            const draft={species:'Synthetic_'+id,nickname:'confirmed_'+id,level:30,sp:1234,
              confidence:0.95,source_refs:['synthetic-source-'+id],
              field_evidence:{level:'synthetic-review-'+id},
              ingredients:[{unlock_level:1,ingredient_name:'SyntheticIngredient',quantity:2}],
              subskills:[{unlock_level:10,subskill_name:'SyntheticSubskill',is_unlocked:true}],conflicts:[]};
            let transaction=false,localEvents=0;
            const status={className:'notice',textContent:''};
            const root={querySelector:selector=>{
              if(selector==='#analysisConfirmationStatus')return status;
              if(selector==='input[name="analysisTarget"]:checked')return {value:'existing'};
              if(selector==='#analysisExistingPokemon')return {value:pokemon};
              return {disabled:false};
            },querySelectorAll:()=>[]};
            const rows=(sql,params=[])=>{
              const r=db.exec(sql,params);
              return r.length?r[0].values.map(values=>Object.fromEntries(r[0].columns.map((name,i)=>[name,values[i]]))):[];
            };
            const env={
              rows,
              run(sql,params=[]){
                if(!transaction)throw Error('NATIVE_SQL_OUTSIDE_TRANSACTION');
                v.sqlWrites++;
                if(opts.failHistory&&sql.includes('INSERT INTO pokemon_history'))
                  throw Error('NATIVE_CONFIRMATION_HISTORY_INSERT_FAILURE');
                db.run(sql,params);
              },
              begin(){if(transaction)throw Error('NATIVE_DOUBLE_BEGIN');db.run('BEGIN IMMEDIATE');transaction=true;},
              commit(){if(!transaction)throw Error('NATIVE_DOUBLE_COMMIT');db.run('COMMIT');transaction=false;},
              rollback(){if(transaction){db.run('ROLLBACK');transaction=false;v.rollbacks++;}},
              async snapshot(reason){
                if(reason!=='before_analysis_confirmation_'+revision.analysis_id)throw Error('NATIVE_BAD_SNAPSHOT');
                v.snapshots++;return {status:'NATIVE_SYNTHETIC_ONLY'};
              },
              async persist(){
                if(transaction)throw Error('NATIVE_TRANSACTION_NOT_COMMITTED');
                const bytes=new Uint8Array(db.export());
                if(opts.holdPersist){v.entered=true;await new Promise(resolve=>{v.release=resolve;});}
                await write(bytes);v.writes++;
                if(opts.loseAck)throw Error('NATIVE_CONFIRMATION_ACK_LOST_AFTER_DURABLE_WRITE');
              },
              ensureRoot:()=>root,readDraft:()=>draft,sealConfirmation:()=>{},
              CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
              globalThis:{dispatchEvent:event=>{
                if(!['pokemon-sleep:analysis-confirmed-applied','pokemon-sleep:analysis-confirmation-terminal'].includes(event.type))
                  throw Error('NATIVE_UNEXPECTED_EVENT_'+event.type);
                localEvents++;v.successEvents++;return true;
              }},
              JSON,Number,String,Object,Promise,Error,Date,Math,console
            };
            try{
              const keys=Object.keys(env);
              const setup='let currentRevision='+JSON.stringify(revision)+';\nlet currentGroupId='+JSON.stringify('synthetic-group-'+id)+';\nconst makeId=()=>'+JSON.stringify('synthetic-generated-'+id)+';\n';
              const apply=new Function(...keys,setup+exact+'\n;return applyConfirmed;')(...keys.map(k=>env[k]));
              await apply();
              // Production converts exceptions into a UI error; never treat that as a durable ACK.
              if(status.className!=='notice success')
                throw Error('NATIVE_WRITER_NO_DURABLE_ACK: '+status.textContent);
              if(!status.textContent.includes('已疊加更新'))throw Error('NATIVE_CONFIRMATION_STATUS_MISSING');
              if(localEvents!==2)throw Error('NATIVE_CONFIRMATION_ACK_EVENT_COUNT_'+localEvents);
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
const pokemon=(state,id)=>state.pokemon.find(row=>row[0]==='synthetic_'+id);
const count=(rows,id)=>rows.filter(row=>row[0]==='synthetic_'+id).length;
const verify=(state,id)=>{
  const row=pokemon(state,id);
  assert.equal(row?.[1],'confirmed_'+id);
  assert.equal(row?.[2],'analysis:synthetic-analysis-'+id);
  assert.ok(JSON.parse(row?.[3]||'[]').includes('synthetic-source-'+id));
  assert.equal(JSON.parse(row?.[4]||'{}').level,'synthetic-review-'+id);
  assert.equal(count(state.ingredients,id),1);
  assert.equal(count(state.subskills,id),1);
  assert.equal(count(state.observations,id),1);
  assert.equal(count(state.history,id),1);
  assert.equal(state.history.find(row=>row[0]==='synthetic_'+id)?.[1],'analysis_sparse_patch_update');
};
try{
  await context.route('**/g265-confirmation-native-blank',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>G265 disposable analysis confirmation</title>'
  }));
  await context.route('**/g265-confirmation-native.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:browserJs
  }));
  await context.route('**/g265-confirmation-native.wasm',route=>route.fulfill({
    status:200,contentType:'application/wasm',body:browserWasm
  }));
  const a=await tab(),b=await tab();
  await a.evaluate(bytes=>window.__g265.write(Uint8Array.from(bytes)),seedBytes);
  for(const page of [a,b])await page.evaluate(()=>window.__g265.makeGate());
  const before=await inspect(a);
  assert.equal(before.sha256,digest(seedBytes));
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
  verify(afterA,'A');
  assert.equal(pokemon(afterA,'B')?.[1],'baseline_B');
  assert.equal(count(afterA.history,'B'),0);
  assert.deepEqual(afterA.master,before.master);
  console.log('PASS G265_ANALYSIS_CONFIRMATION_NATIVE_TWO_TABS_ONE_ACK_STALE_ZERO_SQLJS');

  await b.evaluate(()=>window.__g265.makeGate());
  const fresh=await run(b,'B',afterA.sha256);
  assert.equal(fresh.ok,true,JSON.stringify(fresh));
  const afterB=await inspect(b);
  for(const id of ['A','B'])verify(afterB,id);
  const c=await tab();await c.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(c),afterB);
  console.log('PASS G265_ANALYSIS_CONFIRMATION_NATIVE_FRESH_RELOAD_BOTH_CHILD_EVIDENCE_HISTORY');

  const rollback=await run(c,'ROLLBACK',afterB.sha256,{failHistory:true});
  assert.equal(rollback.ok,false,JSON.stringify(rollback));
  assert.match(rollback.code,/NATIVE_CONFIRMATION_HISTORY_INSERT_FAILURE/);
  assert.equal(await c.evaluate(()=>window.__g265.rollbacks),1);
  assert.equal(await c.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  const d=await tab();await d.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(d),afterB);
  assert.equal(pokemon(await inspect(d),'ROLLBACK')?.[1],'baseline_ROLLBACK');
  console.log('PASS G265_ANALYSIS_CONFIRMATION_NATIVE_ROLLBACK_DURABLE_SHA_UNCHANGED');

  const lost=await run(d,'ACK_LOSS',afterB.sha256,{loseAck:true});
  assert.equal(lost.ok,false,JSON.stringify(lost));
  assert.match(lost.code,/NATIVE_CONFIRMATION_ACK_LOST_AFTER_DURABLE_WRITE/);
  assert.equal(await d.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.equal(await d.evaluate(()=>window.__g265.successEvents),0);
  const afterLost=await inspect(a);
  verify(afterLost,'ACK_LOSS');
  const blind=await run(d,'ACK_LOSS',afterLost.sha256);
  assert.equal(blind.ok,false);
  assert.equal(blind.code,'SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
  const e=await tab();await e.evaluate(()=>window.__g265.makeGate());
  assert.deepEqual(await inspect(e),afterLost);
  const recovered=await run(e,'AFTER_RELOAD',afterLost.sha256);
  assert.equal(recovered.ok,true,JSON.stringify(recovered));
  const afterRecovered=await inspect(e);
  assert.equal(afterRecovered.history.length,4);
  for(const id of ['A','B','ACK_LOSS','AFTER_RELOAD'])verify(afterRecovered,id);
  assert.deepEqual(afterRecovered.master,before.master);
  console.log('PASS G265_ANALYSIS_CONFIRMATION_NATIVE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

  const noLocks=await tab();await noLocks.evaluate(()=>window.__g265.makeGate(true));
  const denied=await run(noLocks,'B',afterRecovered.sha256);
  assert.equal(denied.ok,false);assert.equal(denied.code,'SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
  assert.equal(await noLocks.evaluate(()=>window.__g265.opened),0);
  assert.equal(await noLocks.evaluate(()=>window.__g265.sqlWrites),0);
  assert.equal(await noLocks.evaluate(()=>window.__g265.gate.status().status),'UNVERIFIED_RELOAD_REQUIRED');
  assert.deepEqual(await inspect(noLocks),afterRecovered);
  console.log('PASS G265_ANALYSIS_CONFIRMATION_NATIVE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
  console.log('HOLD G265_ANALYSIS_CONFIRMATION_NATIVE_TEST_WRAPPER_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
}finally{
  await Promise.all(pages.map(page=>page.close().catch(()=>{})));
  await browser.close();
}
