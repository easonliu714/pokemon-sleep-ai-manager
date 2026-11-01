// G265 eighteenth Legacy Writer: isolated opt-in professor transfer durable CAS.
// Execute unchanged transferPokemonToProfessor() with observedCandyQuantity=null only.
// SQL transaction, Web Locks and SHA-256 CAS are TEST ADAPTERS, not production admission.
// Never read or mutate player SQLite/IndexedDB, Candy, or public master authority.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/pokemon-professor-transfer.js',import.meta.url),'utf8');
const start='export async function transferPokemonToProfessor(';
const end='\nexport function professorTransferCandyGuidance()';
assert.equal(source.split(start).length,2,'professor transfer source must be unique');
assert.equal(source.split(end).length,2,'professor transfer source boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /,'');
for(const required of [/await snapshot\(/,/UPDATE pokemon SET status='sent_to_professor'/,
  /INSERT INTO pokemon_history/,/INSERT INTO import_batches/,/INSERT INTO import_changes/,
  /commit\(\);await persist\(\)/])assert.match(operation,required);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteCrossTabWriteAdmission/);
console.log('PASS G265_EIGHTEENTH_PROFESSOR_EXACT_LEGACY_SOURCE_BOUND_ISOLATED_OPTIN');

class QueueLocks {
  constructor(){this.tail=Promise.resolve();this.active=0;this.peak=0;}
  request(name,options,callback){
    assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
    assert.equal(options.mode,'exclusive');
    assert.ok(options.signal);
    const prior=this.tail;
    let release;
    this.tail=new Promise(resolve=>{release=resolve;});
    return (async()=>{
      try{
        await prior;
        if(options.signal.aborted)throw Error('SYNTHETIC_LOCK_ABORT');
        this.active++;this.peak=Math.max(this.peak,this.active);
        try{return await callback({name,mode:'exclusive'});}
        finally{this.active--;}
      }finally{release();}
    })();
  }
}

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,species TEXT,current_species TEXT,status TEXT,last_updated_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE pokemon_history(id INTEGER PRIMARY KEY AUTOINCREMENT,pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seed.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT,PRIMARY KEY(update_id,operation_index))');
seed.run('CREATE TABLE candy_inventory(candy_id TEXT PRIMARY KEY,quantity INTEGER)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seed.run('INSERT INTO pokemon VALUES(?,?,?,?,?,?,?)',['synthetic_'+id,'instance_'+id,'species_'+id,'species_'+id,'active','seed','seed']);
seed.run("INSERT INTO candy_inventory VALUES('sentinel',99)");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const fingerprint=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
let durableWrites=0,rollbacks=0,snapshots=0,candyEvents=0;
const entered=[];
const read=sql=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try{const result=db.exec(sql);return result.length?result[0].values[0][0]:0;}
  finally{db.close();}
};
const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
const timestamps={
  A:1793510000001,B:1793510000002,ROLLBACK:1793510000003,
  ACK_LOSS:1793510000004,AFTER_RELOAD:1793510000005
};
function makeTab(latestBytes,id,{holdPersist,failHistory,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(latestBytes));
  let transaction=false;
  const ctx={
    rows:(sql,params=[])=>rowObjects(db,sql,params),
    run(sql,params=[]){
      assert.equal(transaction,true,'SQL mutation must remain inside synthetic transaction');
      assert.doesNotMatch(sql,/INSERT INTO candy_inventory|UPDATE candy_inventory|candy_inventory_events/i);
      if(failHistory&&sql.includes('INSERT INTO pokemon_history'))
        throw Error('SYNTHETIC_HISTORY_INSERT_FAILURE');
      db.run(sql,params);
    },
    begin(){assert.equal(transaction,false);db.run('BEGIN IMMEDIATE');transaction=true;},
    commit(){assert.equal(transaction,true);db.run('COMMIT');transaction=false;},
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    async snapshot(reason){
      assert.equal(reason,'professor_transfer:synthetic_'+id);
      snapshots++;return {status:'SYNTHETIC_SNAPSHOT'};
    },
    async persist(){
      assert.equal(transaction,false,'COMMIT must precede durable export');
      const bytes=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=bytes;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    normalizeObservedCandyQuantity(value){assert.equal(value,null);return null;},
    canonicalCandyStorageForSpecies(){
      return {status:'REVIEW_REQUIRED',source_master:null,storage:{reason:'SYNTHETIC_NO_CANDY'},canonical_master:null};
    },
    speciesCandyName:()=>null,
    makeId:prefix=>prefix+'-synthetic-'+id,
    now:()=> '2026-11-01T13:55:00+08:00',
    trace(){},
    recordCandyInventoryEvent(){candyEvents++;throw Error('unexpected Candy event');},
    CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_READONLY',
    CANDY_MUTATION_TYPES:{DELTA_EVENT:'DELTA_EVENT'},
    PROFESSOR_TRANSFER_CANDY_RULE_STATUS:'NOT_YET_VERIFIED',
    PROFESSOR_TRANSFER_CANDY_AUTHORITY:'USER_DIRECT_OBSERVATION_ONLY',
    Date:{now:()=>timestamps[id]},
    Math:{random:()=>({A:0.1111,B:0.2222,ROLLBACK:0.3333,ACK_LOSS:0.4444,AFTER_RELOAD:0.5555})[id]},
    JSON,Number,String,Promise,Error,console
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__transfer=transferPokemonToProfessor;',context,{timeout:3000});
  return {transfer:context.__transfer,close:()=>db.close(),rollback:ctx.rollback};
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-professor-transfer-'+id,expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await fingerprint(latestBytes));
    entered.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{
      const result=await tab.transfer('synthetic_'+id,{observedCandyQuantity:null});
      assert.equal(result.transfer.candy_inventory_applied,false);
      assert.equal(result.transfer.quantity_authority,'NOT_OBSERVED');
      return {persistedBytes:new Uint8Array(durable)};
    }catch(error){tab.rollback();throw error;}
    finally{tab.close();}
  }
});

const original=await fingerprint(durable);
let releaseFirst,signalFirst;
const firstEntered=new Promise(resolve=>{signalFirst=resolve;});
const holdPersist=()=>new Promise(resolve=>{releaseFirst=resolve;signalFirst();});
const a=admission(),b=admission();
const first=execute(a,'A',original,{holdPersist});
await firstEntered;
const second=execute(b,'B',original);
assert.equal(locks.active,1);
assert.deepEqual(entered,['A']);
releaseFirst();
assert.equal((await first).status,'PERSISTED');
await assert.rejects(second,e=>e.code==='SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(entered,['A'],'stale writer must never execute original SQL');
assert.equal(durableWrites,1);
assert.equal(read("SELECT status FROM pokemon WHERE pokemon_id='synthetic_A'"),'sent_to_professor');
assert.equal(read("SELECT status FROM pokemon WHERE pokemon_id='synthetic_B'"),'active');
assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B'"),0);
assert.equal(read("SELECT COUNT(*) FROM import_changes WHERE key_json LIKE '%synthetic_B%'"),0);
await assert.rejects(execute(b,'B',original),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_EIGHTEENTH_PROFESSOR_TWO_TABS_ONE_ACK_STALE_ZERO_SQL_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT COUNT(*) FROM pokemon WHERE status='sent_to_professor'"),2);
assert.equal(read('SELECT COUNT(*) FROM pokemon_history'),2);
assert.equal(read('SELECT COUNT(*) FROM import_batches'),2);
assert.equal(read('SELECT COUNT(*) FROM import_changes'),2);
console.log('PASS G265_EIGHTEENTH_PROFESSOR_FRESH_RELOAD_BOTH_TRANSFERS_HISTORY_AUDIT');

const beforeRollback=await fingerprint(durable),beforeRollbackWrites=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failHistory:true}),/SYNTHETIC_HISTORY_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,beforeRollbackWrites);
assert.equal(await fingerprint(durable),beforeRollback);
assert.equal(read("SELECT status FROM pokemon WHERE pokemon_id='synthetic_ROLLBACK'"),'active');
assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_ROLLBACK'"),0);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_EIGHTEENTH_PROFESSOR_PRECOMMIT_ROLLBACK_DURABLE_UNCHANGED');

const lost=admission(),beforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeLost+1);
assert.equal(read("SELECT status FROM pokemon WHERE pokemon_id='synthetic_ACK_LOSS'"),'sent_to_professor');
assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const recovered=admission();
assert.equal((await execute(recovered,'AFTER_RELOAD',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT COUNT(*) FROM pokemon WHERE status='sent_to_professor'"),4);
assert.equal(read('SELECT COUNT(*) FROM pokemon_history'),4);
assert.equal(read('SELECT COUNT(*) FROM import_batches'),4);
assert.equal(read('SELECT COUNT(*) FROM import_changes'),4);
assert.equal(read("SELECT quantity FROM candy_inventory WHERE candy_id='sentinel'"),99);
assert.equal(read("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(candyEvents,0);
assert.equal(durableWrites,4);
console.log('PASS G265_EIGHTEENTH_PROFESSOR_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const noLocks=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const beforeNoLock=durableWrites;
await assert.rejects(execute(noLocks,'B',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeNoLock);
assert.deepEqual(entered,['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']);
console.log('PASS G265_EIGHTEENTH_PROFESSOR_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_EIGHTEENTH_PROFESSOR_TEST_ONLY_OPTIN_NOT_PRODUCTION_CANDY_23_WRITERS_ANDROID_OWNER_DOD');
