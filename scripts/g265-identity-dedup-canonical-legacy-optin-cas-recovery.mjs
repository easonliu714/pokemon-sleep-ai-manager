// G265 canonical distinct Identity Dedup: isolated test-only Atomic CAS/rollback/ACK-loss.
// The production identity-dedup.js::repairPokemonDuplicates() source is executed unchanged.
// Disposable SQL.js, Web Locks queue, SHA-256 durable CAS; no player SQLite/IDB access.
// The production writer is NOT globally admitted; Android multi-tab Owner DoD remains HOLD.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/identity-dedup.js',import.meta.url),'utf8');
const start='const text=';
const end='\nfunction boot(){';
assert.equal(source.split(start).length,2,'dedup source start changed');
assert.equal(source.split(end).length,2,'dedup source end changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
for(const required of [/function planPokemonMerges\(/,/async function repairPokemonDuplicates\(/,
  /await snapshot\(/,/begin\(\)/,/commit\(\)/,/mergeChildren\(/,
  /INSERT OR REPLACE INTO pokemon_identity_evidence/,/await persist\(\)/])
  assert.match(operation,required);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteCrossTabWriteAdmission/);
console.log('PASS G265_IDENTITY_DEDUP_CANONICAL_EXACT_LEGACY_SOURCE_BOUND_ISOLATED_OPTIN');

class QueueLocks {
  constructor(){this.tail=Promise.resolve();this.active=0;this.peak=0;}
  request(name,options,callback){
    assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
    assert.equal(options.mode,'exclusive');
    assert.ok(options.signal);
    const prior=this.tail;let release;
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
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,original_label TEXT,species TEXT,level INTEGER,specialty TEXT,type TEXT,nickname TEXT,rating TEXT,core_role TEXT,status TEXT,identity_review_required INTEGER,identity_confidence REAL,registered_at TEXT,identity_fingerprint TEXT,last_updated_at TEXT)');
seed.run('CREATE TABLE pokemon_ingredients(pokemon_id TEXT,unlock_level INTEGER,ingredient_name TEXT,quantity INTEGER,UNIQUE(pokemon_id,unlock_level,ingredient_name))');
seed.run('CREATE TABLE pokemon_subskills(pokemon_id TEXT,unlock_level INTEGER,subskill_name TEXT,is_unlocked INTEGER,UNIQUE(pokemon_id,unlock_level,subskill_name))');
seed.run('CREATE TABLE pokemon_history(history_id TEXT PRIMARY KEY,pokemon_id TEXT)');
seed.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE pokemon_evolution_history(evolution_id TEXT PRIMARY KEY,pokemon_instance_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
function pokemon(id,instance,label,level,review,confidence,registered,fingerprint){
  seed.run('INSERT INTO pokemon VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[
    id,instance,label,label,level,'berries','electric','','','','active',review,
    confidence,registered,fingerprint,'seed'
  ]);
}
pokemon('canonical_A','instance_A','Pikachu',25,0,0.99,'2026-10-30T00:00:00+08:00','fingerprint_A');
pokemon('pkm_private_A','private_A','Pikachu',25,1,0.2,null,null);
pokemon('canonical_B','instance_B','Eevee',20,0,0.99,'2026-10-30T00:00:00+08:00','fingerprint_B');
pokemon('pkm_private_B','private_B','Eevee',21,1,0.2,null,null);
seed.run("INSERT INTO pokemon_ingredients VALUES('pkm_private_A',10,'Apple',2)");
seed.run("INSERT INTO pokemon_ingredients VALUES('pkm_private_B',10,'Milk',3)");
seed.run("INSERT INTO pokemon_subskills VALUES('pkm_private_A',10,'Helping Speed',1)");
seed.run("INSERT INTO pokemon_subskills VALUES('pkm_private_B',10,'Skill Trigger',1)");
seed.run("INSERT INTO pokemon_history VALUES('history_A','pkm_private_A')");
seed.run("INSERT INTO pokemon_history VALUES('history_B','pkm_private_B')");
// Additional independent pairs are disabled until their own admitted transaction.
for(const label of ['ROLLBACK','ACK_LOSS','AFTER_RELOAD']){
  pokemon('canonical_'+label,'instance_'+label,label,20,0,0.99,'2026-10-30T00:00:00+08:00','fingerprint_'+label);
  pokemon('pkm_private_'+label,'private_'+label,label,21,1,0.2,null,null);
  seed.run('INSERT INTO pokemon_ingredients VALUES(?,?,?,?)',['pkm_private_'+label,10,'ingredient_'+label,2]);
  seed.run('INSERT INTO pokemon_subskills VALUES(?,?,?,?)',['pkm_private_'+label,10,'subskill_'+label,1]);
  seed.run('INSERT INTO pokemon_history VALUES(?,?)',['history_'+label,'pkm_private_'+label]);
}
let durable=new Uint8Array(seed.export());seed.close();

const fingerprint=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
let durableWrites=0,rollbacks=0,snapshots=0,dispatches=0;
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
function makeTab(latestBytes,id,{holdPersist,failEvidence,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(latestBytes));
  // Test-only observation, applied to a disposable session before the original writer begins.
  if(id!=='A')db.run('UPDATE pokemon SET level=20 WHERE pokemon_id=?',['pkm_private_'+id]);
  let transaction=false,lastError=null;
  const context=vm.createContext({
    rows:(sql,params=[])=>rowObjects(db,sql,params),
    run(sql,params=[]){
      assert.equal(transaction,true,'all original SQL mutations must occur inside BEGIN/COMMIT');
      if(failEvidence&&sql.includes('INSERT OR REPLACE INTO pokemon_identity_evidence'))
        throw Error('SYNTHETIC_DEDUP_EVIDENCE_INSERT_FAILURE');
      db.run(sql,params);
    },
    begin(){
      assert.equal(transaction,false);
      db.run('BEGIN IMMEDIATE');transaction=true;
    },
    commit(){
      assert.equal(transaction,true);
      db.run('COMMIT');transaction=false;
    },
    rollback(){
      if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}
    },
    async snapshot(reason){
      assert.equal(reason,'identity-merge-v4:1');
      snapshots++;return {status:'SYNTHETIC_SNAPSHOT'};
    },
    async persist(){
      assert.equal(transaction,false,'original writer must commit before durable persist');
      const bytes=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=bytes;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    localIso:()=> '2026-11-02T00:55:00+08:00',
    planSkeletonMerges:()=>[],
    auditActivePokemon:()=>({ok:true}),
    document:{dispatchEvent(event){
      assert.equal(event.type,'pokemon-sleep-data-refreshed');dispatches++;
    }},
    CustomEvent:class{constructor(type){this.type=type;}},
    // Production catches failures and returns zero; capture the underlying error to
    // ensure test-only admission cannot mistake a swallowed failure for an ACK.
    console:{warn:()=>{},error:(_message,error)=>{lastError=error||Error('UNKNOWN_DEDUP_ERROR');}},
    JSON,Number,String,Promise,Error,Math,Date,Object,Set,Map,Array
  });
  vm.runInContext(operation+'\n;globalThis.__repair=repairPokemonDuplicates;',context,{timeout:3000});
  return {
    async repair(){
      const result=await context.__repair();
      if(lastError)throw lastError;
      assert.equal(result,1,'one independent canonical/private merge expected');
      return result;
    },
    rollback(){
      if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}
    },
    close:()=>db.close()
  };
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-identity-dedup-'+id,expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await fingerprint(latestBytes));
    entered.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{
      await tab.repair();
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
assert.deepEqual(entered,['A'],'stale tab must not enter the original SQL writer');
assert.equal(durableWrites,1);
assert.equal(read("SELECT status='archived' FROM pokemon WHERE pokemon_id='pkm_private_A'"),1);
assert.equal(read("SELECT status='active' FROM pokemon WHERE pokemon_id='pkm_private_B'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-dedup-v4-pkm_private_B'"),0);
await assert.rejects(execute(b,'B',original),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_IDENTITY_DEDUP_TWO_TABS_ONE_ACK_STALE_ZERO_SQL_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await fingerprint(durable))).status,'PERSISTED');
for(const id of ['A','B']){
  assert.equal(read("SELECT status='archived' FROM pokemon WHERE pokemon_id='pkm_private_"+id+"'"),1);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-dedup-v4-pkm_private_"+id+"'"),1);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_ingredients WHERE pokemon_id='canonical_"+id+"'"),1);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='canonical_"+id+"'"),1);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE history_id='history_"+id+"' AND pokemon_id='canonical_"+id+"'"),1);
}
console.log('PASS G265_IDENTITY_DEDUP_FRESH_RELOAD_BOTH_ARCHIVES_EVIDENCE_CHILD_HISTORY');

const beforeRollback=await fingerprint(durable),beforeRollbackWrites=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failEvidence:true}),/SYNTHETIC_DEDUP_EVIDENCE_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,beforeRollbackWrites);
assert.equal(await fingerprint(durable),beforeRollback);
assert.equal(read("SELECT status='active' FROM pokemon WHERE pokemon_id='pkm_private_ROLLBACK'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-dedup-v4-pkm_private_ROLLBACK'"),0);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_IDENTITY_DEDUP_PRECOMMIT_ROLLBACK_DURABLE_SHA_UNCHANGED');

const lost=admission(),beforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeLost+1);
assert.equal(read("SELECT status='archived' FROM pokemon WHERE pokemon_id='pkm_private_ACK_LOSS'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-dedup-v4-pkm_private_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const recovered=admission();
assert.equal((await execute(recovered,'AFTER_RELOAD',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT status='archived' FROM pokemon WHERE pokemon_id='pkm_private_AFTER_RELOAD'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence"),4);
assert.equal(read("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(durableWrites,4);
assert.equal(snapshots,5);
assert.equal(dispatches,3,'lost ACK suppresses post-persist UI dispatch');
console.log('PASS G265_IDENTITY_DEDUP_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const noLocks=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const beforeNoLock=durableWrites;
await assert.rejects(execute(noLocks,'B',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeNoLock);
assert.deepEqual(entered,['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']);
console.log('PASS G265_IDENTITY_DEDUP_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_IDENTITY_DEDUP_TEST_ONLY_OPTIN_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
