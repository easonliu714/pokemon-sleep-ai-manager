// G265 canonical Analysis Target Identity: isolated Atomic CAS / rollback / ACK-loss gate.
// Execute unchanged production ensurePokemonInstanceId() on disposable SQL.js only.
// Web Locks and SHA-256 durable admission are test-only; NOT production writer wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

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
  assert.match(writer,marker,'must execute unchanged production identity write path');
assert.doesNotMatch(writer,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
assert.match(source,/export async function createExistingPokemonAnalysisContext\(pokemonId\)\{\s*const row=await ensurePokemonInstanceId\(pokemonId\)/);
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_EXACT_LEGACY_WRITER_SOURCE_BOUND_ISOLATED_OPTIN');

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
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,status TEXT NOT NULL,pokemon_instance_id TEXT,last_updated_at TEXT,source_update_id TEXT,species TEXT)');
seed.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seed.run('INSERT INTO pokemon(pokemon_id,status,species) VALUES(?,?,?)',['synthetic_'+id,'active','Species_'+id]);
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const fingerprint=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
let durableWrites=0,snapshots=0,rollbacks=0,successTraces=0,sqlWrites=0;
const entered=[];
const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
const read=sql=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try{const result=db.exec(sql);return result.length?result[0].values[0][0]:null;}
  finally{db.close();}
};
function makeTab(latestBytes,id,{holdPersist,failHistory,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(latestBytes));
  const pokemonId='synthetic_'+id,expectedInstance='pkm-fixture-'+id;
  let transaction=false,localSuccess=0;
  const context=vm.createContext({
    crypto:{randomUUID:()=> 'fixture-'+id},
    rows:(sql,params=[])=>rowObjects(db,sql,params),
    run(sql,params=[]){
      assert.equal(transaction,true,'original SQL writes must be transactional');
      sqlWrites++;
      if(failHistory&&sql.includes('INSERT INTO pokemon_history'))
        throw Error('SYNTHETIC_IDENTITY_HISTORY_INSERT_FAILURE');
      db.run(sql,params);
    },
    begin(){assert.equal(transaction,false);db.run('BEGIN IMMEDIATE');transaction=true;},
    commit(){assert.equal(transaction,true);db.run('COMMIT');transaction=false;},
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    async snapshot(reason){
      assert.equal(reason,'analysis_target_identity:'+pokemonId);
      snapshots++;return {status:'SYNTHETIC_SNAPSHOT'};
    },
    async persist(){
      assert.equal(transaction,false,'COMMIT must precede durable persist');
      const bytes=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=bytes;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    localIso:()=> '2026-11-02T06:55:00+08:00',
    UpdateCenterLiveDebug:{record:(event,detail)=>{
      if(event==='analysis_target_instance_id_assigned'){
        assert.equal(detail.has_target_instance_id,true);
        successTraces++;localSuccess++;
      }
    }},
    JSON,Number,String,Object,Promise,Error,Date,Math,console
  });
  vm.runInContext(helpers+'\n'+writer+'\n;globalThis.__ensure=ensurePokemonInstanceId;',context,{timeout:3000});
  return {
    async assign(){
      const row=await context.__ensure(pokemonId);
      assert.equal(row.pokemon_instance_id,expectedInstance);
      assert.equal(localSuccess,1,'only a durable ACK may emit success trace');
    },
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    close:()=>db.close()
  };
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-analysis-target-identity-'+id,
  expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await fingerprint(latestBytes));
    entered.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{await tab.assign();return {persistedBytes:new Uint8Array(durable)};}
    catch(error){tab.rollback();throw error;}
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
await assert.rejects(second,error=>error.code==='SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(entered,['A'],'stale writer must execute zero original SQL writes');
assert.equal(durableWrites,1);
assert.equal(read("SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_A'"),'pkm-fixture-A');
assert.equal(read("SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_B'"),null);
assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_A'"),1);
await assert.rejects(execute(b,'B',original),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_TWO_TABS_ONE_ACK_STALE_ZERO_SQL_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await fingerprint(durable))).status,'PERSISTED');
for(const id of ['A','B']){
  assert.equal(read("SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_"+id+"'"),'pkm-fixture-'+id);
  assert.equal(read("SELECT source_update_id FROM pokemon WHERE pokemon_id='synthetic_"+id+"'"),'platform-identity:pkm-fixture-'+id);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_"+id+"' AND event_type='platform_identity_assigned'"),1);
}
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_FRESH_RELOAD_BOTH_INSTANCE_IDS_PROVENANCE_HISTORY');

const beforeRollback=await fingerprint(durable),beforeRollbackWrites=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failHistory:true}),/SYNTHETIC_IDENTITY_HISTORY_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,beforeRollbackWrites);
assert.equal(await fingerprint(durable),beforeRollback);
assert.equal(read("SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_ROLLBACK'"),null);
assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_ROLLBACK'"),0);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_PRECOMMIT_ROLLBACK_DURABLE_SHA_UNCHANGED');

const lost=admission(),beforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeLost+1);
assert.equal(read("SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_ACK_LOSS'"),'pkm-fixture-ACK_LOSS');
assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable)),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const recovered=admission();
assert.equal((await execute(recovered,'AFTER_RELOAD',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_AFTER_RELOAD'"),'pkm-fixture-AFTER_RELOAD');
assert.equal(read("SELECT COUNT(*) FROM pokemon_history"),4);
assert.equal(read("SELECT value FROM synthetic_public_master WHERE id='public'"),'IMMUTABLE');
assert.equal(durableWrites,4);
assert.equal(snapshots,5);
assert.equal(successTraces,3,'ACK-loss must not emit success trace');
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const noLocks=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const beforeNoLock=durableWrites,beforeNoLockSql=sqlWrites;
await assert.rejects(execute(noLocks,'B',await fingerprint(durable)),error=>error.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeNoLock);
assert.equal(sqlWrites,beforeNoLockSql);
assert.deepEqual(entered,['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']);
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_ANALYSIS_TARGET_IDENTITY_TEST_ONLY_OPTIN_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
