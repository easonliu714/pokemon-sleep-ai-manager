// G265 seventeenth Legacy Writer: source-bound isolated opt-in identity confirmation CAS.
// Executes the unchanged identity-review.js::confirmIndependent() against disposable
// SQL.js VM sessions with synthetic Pokemon; never touches a player database.
// The BEGIN/ROLLBACK and SHA-256 CAS are TEST WRAPPERS, not production writer behavior.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/identity-review.js',import.meta.url),'utf8');
const start='async function confirmIndependent(pokemonId) {';
const end='\nasync function markEvolution(';
assert.equal(source.split(start).length,2,'identity confirmation must have one source owner');
assert.equal(source.split(end).length,2,'identity source boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(operation,/await snapshot\(/);
assert.match(operation,/UPDATE pokemon SET identity_review_required=0/);
assert.match(operation,/INSERT OR REPLACE INTO pokemon_identity_evidence/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteCrossTabWriteAdmission/);
console.log('PASS G265_SEVENTEENTH_IDENTITY_EXACT_LEGACY_CONFIRM_SOURCE_BOUND_ISOLATED_OPTIN');

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
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,identity_review_required INTEGER,identity_confidence REAL,last_updated_at TEXT,status TEXT)');
seed.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seed.run('INSERT INTO pokemon VALUES(?,?,1,0.2,?,?)',['synthetic_'+id,'instance_'+id,'seed','active']);
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const fingerprint=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
let durableWrites=0,rollbacks=0,snapshots=0;
const entered=[];
const read=(sql)=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try{const result=db.exec(sql);return result.length?result[0].values[0][0]:0;}
  finally{db.close();}
};
function makeTab(latestBytes,id,{holdPersist,failEvidence,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(latestBytes));
  // Synthetic atomic wrapper only: production confirmIndependent has no BEGIN/ROLLBACK.
  db.run('BEGIN IMMEDIATE');
  let transaction=true;
  const ctx={
    async snapshot(reason){
      assert.equal(reason,'identity-confirm:synthetic_'+id);
      snapshots++;
      return {status:'SYNTHETIC_SNAPSHOT'};
    },
    localIso:()=> '2026-11-01T10:55:00+08:00',
    Date:{now:()=>({A:1793500000001,B:1793500000002,ROLLBACK:1793500000003,ACK_LOSS:1793500000004,AFTER_RELOAD:1793500000005})[id]},
    JSON,Promise,Error,console,
    run(sql,params=[]){
      assert.equal(transaction,true,'SQL mutation must be inside synthetic transaction');
      if(failEvidence&&sql.includes('INSERT OR REPLACE INTO pokemon_identity_evidence'))
        throw Error('SYNTHETIC_EVIDENCE_INSERT_FAILURE');
      db.run(sql,params);
    },
    async persist(){
      assert.equal(transaction,true);
      db.run('COMMIT');transaction=false;
      const bytes=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=bytes;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    renderIdentityReview(){}
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__confirmIndependent=confirmIndependent;',context,{timeout:3000});
  return {
    confirm:context.__confirmIndependent,
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    close:()=>db.close()
  };
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-identity-confirm-'+id,expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await fingerprint(latestBytes));
    entered.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{
      await tab.confirm('synthetic_'+id);
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
assert.deepEqual(entered,['A'],'stale tab must never execute original SQL writer');
assert.equal(durableWrites,1);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_A'"),0);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_B'"),0);
await assert.rejects(execute(b,'B',original),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_SEVENTEENTH_IDENTITY_TWO_TABS_ONE_ACK_STALE_ZERO_SQL_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_A'"),0);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),0);
assert.equal(read('SELECT COUNT(*) FROM pokemon_identity_evidence'),2);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_A'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_B'"),1);
console.log('PASS G265_SEVENTEENTH_IDENTITY_FRESH_RELOAD_BOTH_CONFIRMATIONS_AND_EVIDENCE');

const beforeRollback=await fingerprint(durable),beforeRollbackWrites=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failEvidence:true}),/SYNTHETIC_EVIDENCE_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,beforeRollbackWrites);
assert.equal(await fingerprint(durable),beforeRollback);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_ROLLBACK'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_ROLLBACK'"),0);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_SEVENTEENTH_IDENTITY_TEST_WRAPPER_PRECOMMIT_ROLLBACK_DURABLE_UNCHANGED');

const lost=admission(),beforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeLost+1);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_ACK_LOSS'"),0);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const recovered=admission();
assert.equal((await execute(recovered,'AFTER_RELOAD',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read('SELECT COUNT(*) FROM pokemon_identity_evidence'),4);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_ACK_LOSS'"),1);
assert.equal(read("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(durableWrites,4);
console.log('PASS G265_SEVENTEENTH_IDENTITY_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const noLocks=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const beforeNoLock=durableWrites;
await assert.rejects(execute(noLocks,'B',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeNoLock);
assert.deepEqual(entered,['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']);
console.log('PASS G265_SEVENTEENTH_IDENTITY_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_SEVENTEENTH_IDENTITY_TEST_ONLY_OPTIN_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
