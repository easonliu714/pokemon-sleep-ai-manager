// G265 fifteenth distinct Legacy Writer: isolated recipe workbench opt-in CAS and recovery.
// Execute the unchanged saveRecipeState() only inside a disposable SQL.js VM
// under the existing cross-tab write admission. NOT production wiring or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/recipe-unified-player-workbench.js',import.meta.url),'utf8');
const start='async function saveRecipeState(row,{unlocked,level,energy}){';
const end='\nfunction bindTable(';
assert.equal(source.split(start).length,2);
assert.equal(source.split(end).length,2);
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(operation,/await snapshot\(/);
assert.match(operation,/begin\(\);[\s\S]*?commit\(\);await persist\(\)/);
assert.match(operation,/INSERT INTO import_batches/);
assert.match(operation,/INSERT INTO import_changes/);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteCrossTabWriteAdmission/);
console.log('PASS G265_FIFTEENTH_RECIPE_EXACT_LEGACY_SOURCE_BOUND_ISOLATED_OPTIN');

class QueueLocks {
  constructor(){this.tail=Promise.resolve();this.active=0;this.peak=0;this.calls=0;}
  request(name,options,callback){
    assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
    assert.equal(options.mode,'exclusive');
    assert.ok(options.signal);
    this.calls++;
    const prior=this.tail;
    let release;
    this.tail=new Promise(resolve=>{release=resolve;});
    return (async()=>{
      try{
        await prior;
        if(options.signal.aborted)throw Error('SYNTHETIC_ABORTED_WAIT');
        this.active++;this.peak=Math.max(this.peak,this.active);
        try{return await callback({name,mode:'exclusive'});}
        finally{this.active--;}
      }finally{release();}
    })();
  }
}
const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE recipes(recipe_id TEXT PRIMARY KEY,category TEXT,recipe_name TEXT,unlocked INTEGER,total_ingredients INTEGER,source TEXT,recipe_level INTEGER,current_energy INTEGER,updated_at TEXT,notes TEXT)');
seed.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seed.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO recipes VALUES('seed','synthetic','baseline',1,1,'fixture',1,10,'fixture','')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const digest=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
let durableWrites=0,snapshots=0,rollbacks=0;
const invoked=[];
const row=id=>({recipe_id:'recipe_'+id,category:'synthetic',recipe_name:'fixture_'+id,total_ingredients:3});
const settings=id=>({unlocked:true,level:2,energy:20});

function makeTab(bytes,id,{holdPersist,failBatch,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(bytes));
  let transaction=false,snapshotReady=false;
  const ctx={
    dbReady:()=>true,
    rows(sql,params=[]){
      const statement=db.prepare(sql);
      try{
        if(params.length)statement.bind(params);
        const out=[];while(statement.step())out.push(statement.getAsObject());
        return out;
      }finally{statement.free();}
    },
    async snapshot(reason){
      assert.equal(reason,'manual:recipe:recipe_'+id);
      snapshots++;snapshotReady=true;
      return {status:'SYNTHETIC_ONLY'};
    },
    begin(){assert.equal(snapshotReady,true);assert.equal(transaction,false);db.run('BEGIN IMMEDIATE');transaction=true;},
    run(sql,params=[]){
      assert.equal(transaction,true);
      if(failBatch&&sql.startsWith('INSERT INTO import_batches'))throw Error('SYNTHETIC_BATCH_INSERT_FAILURE');
      db.run(sql,params);
    },
    commit(){assert.equal(transaction,true);db.run('COMMIT');transaction=false;},
    rollback(){rollbacks++;if(transaction){db.run('ROLLBACK');transaction=false;}},
    async persist(){
      assert.equal(transaction,false);
      const exported=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=exported;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    localIso:()=> '2026-11-01T04:55:00+08:00',
    Date:{now:()=>1793480000000+Array.from(id).reduce((acc,ch)=>(acc*31+ch.charCodeAt(0))%100000000,0)},
    Math:{random:()=>id==='A'?0.125:id==='B'?0.625:0.375},
    JSON,Number,String,Promise,Error,console
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__save=saveRecipeState;',context,{timeout:3000});
  return {save:context.__save,close:()=>db.close()};
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint:digest,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-recipe-'+id,expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await digest(latestBytes));
    invoked.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{
      const result=await tab.save(row(id),settings(id));
      assert.equal(result.recipe_id,'recipe_'+id);
      return {persistedBytes:new Uint8Array(durable)};
    }finally{tab.close();}
  }
});
const count=sql=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try{const result=db.exec(sql);return result.length?result[0].values[0][0]:0;}
  finally{db.close();}
};
const initial=await digest(durable);
let releaseFirst,firstEntered;
const entered=new Promise(resolve=>{firstEntered=resolve;});
const holdPersist=()=>new Promise(resolve=>{releaseFirst=resolve;firstEntered();});
const a=admission(),b=admission();
const first=execute(a,'A',initial,{holdPersist});
await entered;
const second=execute(b,'B',initial);
assert.equal(locks.active,1);
assert.deepEqual(invoked,['A']);
releaseFirst();
assert.equal((await first).status,'PERSISTED');
await assert.rejects(second,e=>e.code==='SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(invoked,['A']);
assert.equal(durableWrites,1);
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_B'"),0);
assert.equal(count('SELECT COUNT(*) FROM import_batches'),1);
assert.equal(count('SELECT COUNT(*) FROM import_changes'),1);
await assert.rejects(execute(b,'B',initial),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_FIFTEENTH_RECIPE_TWO_TABS_ONE_ACK_STALE_ZERO_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await digest(durable))).status,'PERSISTED');
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_B'"),1);
assert.equal(count('SELECT COUNT(*) FROM import_batches'),2);
assert.equal(count('SELECT COUNT(*) FROM import_changes'),2);
console.log('PASS G265_FIFTEENTH_RECIPE_FRESH_RELOAD_BOTH_RECIPES_AND_AUDIT');

const beforeRollback=await digest(durable),writesBeforeRollback=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failBatch:true}),/SYNTHETIC_BATCH_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,writesBeforeRollback);
assert.equal(await digest(durable),beforeRollback);
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_ROLLBACK'"),0);
assert.equal(count('SELECT COUNT(*) FROM import_batches'),2);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_FIFTEENTH_RECIPE_PRECOMMIT_ROLLBACK_DURABLE_UNCHANGED');

const lost=admission(),writesBeforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await digest(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,writesBeforeLost+1);
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_ACK_LOSS'"),1);
assert.equal(count('SELECT COUNT(*) FROM import_batches'),3);
await assert.rejects(execute(lost,'ACK_LOSS',await digest(durable)),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const reload=admission();
assert.equal((await execute(reload,'AFTER_RELOAD',await digest(durable))).status,'PERSISTED');
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_ACK_LOSS'"),1);
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_AFTER_RELOAD'"),1);
assert.equal(count('SELECT COUNT(*) FROM import_batches'),4);
assert.equal(count('SELECT COUNT(*) FROM import_changes'),4);
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='seed'"),1);
assert.equal(count("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(durableWrites,4);
assert.equal(locks.peak,1);
console.log('PASS G265_FIFTEENTH_RECIPE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const unavailable=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint:digest,timeoutMs:3000
});
const noLockWrites=durableWrites;
await assert.rejects(execute(unavailable,'NO_LOCK',await digest(durable)),e=>e.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(unavailable.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,noLockWrites);
assert.ok(!invoked.includes('NO_LOCK'));
console.log('PASS G265_FIFTEENTH_RECIPE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_RECIPE_WORKBENCH_PRODUCTION_ADMISSION_LEGACY_23_WRITERS_ANDROID_OWNER_DOD');
