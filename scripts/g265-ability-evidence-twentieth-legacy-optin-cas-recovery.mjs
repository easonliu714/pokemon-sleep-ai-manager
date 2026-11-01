// G265 twentieth Ability Evidence Legacy Writer: isolated opt-in CAS, rollback, ACK-loss recovery.
// Executes unchanged identity-evidence-builder.js::completeIdentityEvidence() on disposable SQL.js VM sessions.
// Web Locks, SHA-256 durable CAS and transaction admission are TEST-ONLY adapters, not production wiring.
// Synthetic ability, ingredients, subskills and public sentinel only; never access player SQLite/IDB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/identity-evidence-builder.js',import.meta.url),'utf8');
const start='const text=value=>';
const end='\nfunction boot(){';
assert.equal(source.split(start).length,2,'ability evidence helper source must be unique');
assert.equal(source.split(end).length,2,'ability evidence writer source boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
for(const required of [/function planAbilityEvidence\(/,/export async function completeIdentityEvidence\(/,
  /await snapshot\(/,/UPDATE pokemon SET pokemon_instance_id=/,
  /INSERT OR REPLACE INTO pokemon_identity_evidence/,/commit\(\)/,/await persist\(\)/]){
  const pattern=String(required).replace('export async function','async function');
  assert.match(operation,new RegExp(pattern.slice(1,-1)));
}
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_TWENTIETH_ABILITY_EVIDENCE_EXACT_LEGACY_SOURCE_BOUND_ISOLATED_OPTIN');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,status TEXT,species TEXT,current_species TEXT,level INTEGER,specialty TEXT,type TEXT,sp INTEGER,main_skill TEXT,main_skill_level INTEGER,nature TEXT,nature_bonus TEXT,nature_penalty TEXT,helper_seconds INTEGER,carry_limit INTEGER,favorite_berry TEXT,identity_review_required INTEGER,identity_fingerprint TEXT,identity_confidence REAL,last_updated_at TEXT)');
seed.run('CREATE TABLE pokemon_ingredients(pokemon_id TEXT,unlock_level INTEGER,ingredient_name TEXT,quantity INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_subskills(pokemon_id TEXT,unlock_level INTEGER,subskill_name TEXT,is_unlocked INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const label of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']){
  seed.run('INSERT INTO pokemon(pokemon_id,pokemon_instance_id,status,species,current_species,level,specialty,type,sp,main_skill,main_skill_level,nature,helper_seconds,carry_limit,identity_review_required,identity_confidence,last_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[
    'synthetic_'+label,'instance_'+label,'active','species_'+label,'species_'+label,
    label==='A'?30:35,'ingredients','grass',100,'skill_'+label,1,'nature_'+label,
    2400,10,1,0.2,'seed']);
  for(const level of [1,30,60])seed.run('INSERT INTO pokemon_ingredients VALUES(?,?,?,?)',['synthetic_'+label,level,'ingredient_'+label+'_'+level,2]);
  for(const level of ([10,25,50,70]))
    seed.run('INSERT INTO pokemon_subskills VALUES(?,?,?,?)',['synthetic_'+label,level,'subskill_'+label+'_'+level,1]);
}
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");

let durable=new Uint8Array(seed.export());seed.close();
const fingerprint=bytes=>sha256SqliteBytes(bytes,webcrypto);
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
  // The test admission starts a disposable transaction before observing the missing level-80 subskill.
  // Production's begin() is source-bound but cannot start a second SQLite transaction here.
  db.run('BEGIN IMMEDIATE');
  let transaction=true;
  db.run('INSERT INTO pokemon_subskills VALUES(?,?,?,?)',
    ['synthetic_'+id,80,'subskill_'+id+'_80',1]);
  const ctx={
    rows:(sql,params=[])=>rowObjects(db,sql,params),
    run(sql,params=[]){
      assert.equal(transaction,true,'synthetic SQL mutation must stay in transaction');
      if(failEvidence&&sql.includes('INSERT OR REPLACE INTO pokemon_identity_evidence'))
        throw Error('SYNTHETIC_ABILITY_EVIDENCE_INSERT_FAILURE');
      db.run(sql,params);
    },
    begin(){assert.equal(transaction,true,'test admission owns BEGIN IMMEDIATE');},
    commit(){assert.equal(transaction,true);db.run('COMMIT');transaction=false;},
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    async snapshot(reason){
      assert.equal(reason,'identity-evidence-builder:1');
      snapshots++;return {status:'SYNTHETIC_SNAPSHOT'};
    },
    async persist(){
      assert.equal(transaction,false,'COMMIT must precede durable export');
      const bytes=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=bytes;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    localIso:()=> '2026-11-01T19:55:00+08:00',
    document:{dispatchEvent(event){
      assert.equal(event.type,'pokemon-sleep-data-refreshed');dispatches++;
    }},
    CustomEvent:class{constructor(type){this.type=type;}},
    JSON,Number,String,Promise,Error,Math,Set,Map,Object,console
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__complete=completeIdentityEvidence;',context,{timeout:3000});
  return {complete:context.__complete,rollback:ctx.rollback,close:()=>db.close()};
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-ability-evidence-'+id,expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await fingerprint(latestBytes));
    entered.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{
      assert.equal(await tab.complete(),1,'one newly completed synthetic identity');
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
assert.deepEqual(entered,['A'],'stale writer must execute zero SQL statements');
assert.equal(durableWrites,1);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_A'"),0);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='synthetic_B' AND unlock_level=80"),0);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='ability-fingerprint-synthetic_B'"),0);
await assert.rejects(execute(b,'B',original),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_TWENTIETH_ABILITY_EVIDENCE_TWO_TABS_ONE_ACK_STALE_ZERO_SQL_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT COUNT(*) FROM pokemon WHERE identity_review_required=0"),2);
assert.equal(read('SELECT COUNT(*) FROM pokemon_identity_evidence'),2);
assert.equal(read("SELECT COUNT(*) FROM pokemon_subskills WHERE unlock_level=80"),2);
console.log('PASS G265_TWENTIETH_ABILITY_EVIDENCE_FRESH_RELOAD_BOTH_CONFIRMATIONS_SUBSKILLS_EVIDENCE');

const beforeRollback=await fingerprint(durable),beforeRollbackWrites=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failEvidence:true}),/SYNTHETIC_ABILITY_EVIDENCE_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,beforeRollbackWrites);
assert.equal(await fingerprint(durable),beforeRollback);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_ROLLBACK'"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='synthetic_ROLLBACK' AND unlock_level=80"),0);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_ROLLBACK'"),0);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_TWENTIETH_ABILITY_EVIDENCE_PRECOMMIT_ROLLBACK_DURABLE_SHA_UNCHANGED');

const lost=admission(),beforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeLost+1);
assert.equal(read("SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_ACK_LOSS'"),0);
assert.equal(read("SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='synthetic_ACK_LOSS' AND unlock_level=80"),1);
assert.equal(read("SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const recovered=admission();
assert.equal((await execute(recovered,'AFTER_RELOAD',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT COUNT(*) FROM pokemon WHERE identity_review_required=0"),4);
assert.equal(read('SELECT COUNT(*) FROM pokemon_identity_evidence'),4);
assert.equal(read("SELECT COUNT(*) FROM pokemon_subskills WHERE unlock_level=80"),4);
assert.equal(read("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(durableWrites,4);
assert.equal(snapshots,5,'failed precommit transaction took its snapshot');
assert.equal(dispatches,3,'ACK-loss after durable write suppresses post-persist UI dispatch');
console.log('PASS G265_TWENTIETH_ABILITY_EVIDENCE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const noLocks=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const beforeNoLock=durableWrites;
await assert.rejects(execute(noLocks,'B',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeNoLock);
assert.deepEqual(entered,['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']);
console.log('PASS G265_TWENTIETH_ABILITY_EVIDENCE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_TWENTIETH_ABILITY_EVIDENCE_TEST_ONLY_OPTIN_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
