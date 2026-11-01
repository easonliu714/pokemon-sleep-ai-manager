// G265 canonical Evolution Override: isolated Atomic CAS / rollback / ACK-loss Source/Test Gate.
// Execute the unchanged production persistAppliedOverride() against disposable SQL.js.
// The opt-in SHA-256/Web Locks adapter exists ONLY in this fixture, never player runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

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
console.log('PASS G265_EVOLUTION_OVERRIDE_EXACT_LEGACY_EVENT_WRITER_SOURCE_BOUND_ISOLATED_OPTIN');

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
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,evolution_level_required INTEGER,evolution_sleep_hours_required REAL,evolution_candy_required INTEGER,evolution_item_required TEXT,evolution_other_requirement TEXT)');
seed.run('CREATE TABLE pokemon_evolution_override(pokemon_id TEXT PRIMARY KEY,authority_mode TEXT NOT NULL,override_status TEXT,target_override TEXT,override_reason TEXT,required_level INTEGER,required_sleep_hours REAL,required_candy INTEGER,required_item TEXT,other_requirement TEXT,source_analysis_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
seed.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const id of ['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD'])
  seed.run('INSERT INTO pokemon(pokemon_id) VALUES(?)',['synthetic_'+id]);
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();

const fingerprint=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
const entered=[];
let durableWrites=0,snapshots=0,rollbacks=0,successTraces=0,failureTraces=0,sqlWrites=0;
const read=sql=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try{const result=db.exec(sql);return result.length?result[0].values[0][0]:null;}
  finally{db.close();}
};
const rows=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
const levelFor=id=>({A:18,B:29,ROLLBACK:41,ACK_LOSS:42,AFTER_RELOAD:43})[id];
function makeTab(latestBytes,id,{holdPersist,failHistory,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(latestBytes));
  const group='group_'+id,pokemon='synthetic_'+id;
  const groupOverrideState=new Map([[group,{
    evolution_authority_mode:'PLAYER_OVERRIDE',
    evolution_override_status:'CUSTOM_REQUIREMENTS',
    evolution_target_override:pokemon+'_next',
    evolution_override_reason:'synthetic fixture',
    custom_requirements:{evolution_level_required:levelFor(id),evolution_candy_required:80}
  }]]);
  const statusNode={className:'',textContent:''};
  let transaction=false,lastError=null,localSuccess=0;
  const context=vm.createContext({
    groupOverrideState,
    PLAYER_OVERRIDE:'PLAYER_OVERRIDE',PUBLIC_MASTER:'PUBLIC_MASTER',
    CUSTOM_REQUIREMENTS:'CUSTOM_REQUIREMENTS',CANNOT_EVOLVE:'CANNOT_EVOLVE',
    ensurePlayerOverrideTable:()=>true, // Already-created fixture table; exclude unrelated bootstrap persist.
    readOverrideRow:key=>rows(db,'SELECT * FROM pokemon_evolution_override WHERE pokemon_id=?',[key])[0]||null,
    async snapshot(reason){
      assert.equal(reason,'before_player_evolution_override_'+pokemon);
      snapshots++;return {status:'SYNTHETIC_SNAPSHOT'};
    },
    begin(){assert.equal(transaction,false);db.run('BEGIN IMMEDIATE');transaction=true;},
    commit(){assert.equal(transaction,true);db.run('COMMIT');transaction=false;},
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    run(sql,params=[]){
      assert.equal(transaction,true,'original SQL mutations must stay inside BEGIN/COMMIT');
      sqlWrites++;
      if(failHistory&&sql.includes('INSERT INTO pokemon_history'))
        throw Error('SYNTHETIC_EVOLUTION_HISTORY_INSERT_FAILURE');
      db.run(sql,params);
    },
    async persist(){
      assert.equal(transaction,false,'COMMIT must precede durable persistence');
      const bytes=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=bytes;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    nowIso:()=> '2026-11-02T03:55:00+08:00',
    document:{querySelector:selector=>selector==='#analysisConfirmationStatus'?statusNode:null},
    DebugTrace:{record:(_category,event,detail)=>{
      if(event==='player_evolution_override_persisted'){successTraces++;localSuccess++;}
      if(event==='player_evolution_override_persist_failed'){
        failureTraces++;lastError=Error(String(detail?.error||'SYNTHETIC_EVOLUTION_WRITE_FAILED'));
      }
    }},
    Date,JSON,Number,String,Object,Promise,Error,console
  });
  vm.runInContext(helpers+'\n'+writer+'\n;globalThis.__apply=persistAppliedOverride;',context,{timeout:3000});
  return {
    async apply(){
      await context.__apply({detail:{group_id:group,pokemon_id:pokemon,analysis_id:'synthetic_analysis_'+id}});
      if(lastError)throw lastError; // Original event writer catches; fail closed in the test adapter.
      assert.equal(localSuccess,1,'exactly one durable success ACK per admitted event');
    },
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    close:()=>db.close()
  };
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-evolution-override-'+id,expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await fingerprint(latestBytes));
    entered.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{await tab.apply();return {persistedBytes:new Uint8Array(durable)};}
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
assert.deepEqual(entered,['A'],'stale tab must execute zero original SQL writes');
assert.equal(durableWrites,1);
assert.equal(read("SELECT required_level FROM pokemon_evolution_override WHERE pokemon_id='synthetic_A'"),18);
assert.equal(read("SELECT COUNT(*) FROM pokemon_evolution_override WHERE pokemon_id='synthetic_B'"),0);
await assert.rejects(execute(b,'B',original),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_EVOLUTION_OVERRIDE_TWO_TABS_ONE_ACK_STALE_ZERO_SQL_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await fingerprint(durable))).status,'PERSISTED');
for(const id of ['A','B']){
  assert.equal(read("SELECT required_level FROM pokemon_evolution_override WHERE pokemon_id='synthetic_"+id+"'"),levelFor(id));
  assert.equal(read("SELECT evolution_level_required FROM pokemon WHERE pokemon_id='synthetic_"+id+"'"),levelFor(id));
  assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_"+id+"' AND event_type='player_evolution_override_applied'"),1);
}
console.log('PASS G265_EVOLUTION_OVERRIDE_FRESH_RELOAD_BOTH_OVERRIDES_INSTANCE_FIELDS_HISTORY');

const beforeRollback=await fingerprint(durable),beforeRollbackWrites=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failHistory:true}),/SYNTHETIC_EVOLUTION_HISTORY_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,beforeRollbackWrites);
assert.equal(await fingerprint(durable),beforeRollback);
assert.equal(read("SELECT COUNT(*) FROM pokemon_evolution_override WHERE pokemon_id='synthetic_ROLLBACK'"),0);
assert.equal(read("SELECT evolution_level_required FROM pokemon WHERE pokemon_id='synthetic_ROLLBACK'"),null);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_EVOLUTION_OVERRIDE_PRECOMMIT_ROLLBACK_DURABLE_SHA_UNCHANGED');

const lost=admission(),beforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeLost+1);
assert.equal(read("SELECT required_level FROM pokemon_evolution_override WHERE pokemon_id='synthetic_ACK_LOSS'"),42);
assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable)),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const recovered=admission();
assert.equal((await execute(recovered,'AFTER_RELOAD',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT required_level FROM pokemon_evolution_override WHERE pokemon_id='synthetic_AFTER_RELOAD'"),43);
assert.equal(read("SELECT COUNT(*) FROM pokemon_evolution_override"),4);
assert.equal(read("SELECT COUNT(*) FROM pokemon_history"),4);
assert.equal(read("SELECT value FROM synthetic_public_master WHERE id='public'"),'IMMUTABLE');
assert.equal(durableWrites,4);
assert.equal(snapshots,5);
assert.equal(successTraces,3,'postcommit lost ACK must not emit success trace');
assert.equal(failureTraces,2,'injected rollback and lost ACK are observed failures');
console.log('PASS G265_EVOLUTION_OVERRIDE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const noLocks=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const beforeNoLock=durableWrites,beforeNoLockSql=sqlWrites;
await assert.rejects(execute(noLocks,'B',await fingerprint(durable)),error=>error.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeNoLock);
assert.equal(sqlWrites,beforeNoLockSql);
assert.deepEqual(entered,['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']);
console.log('PASS G265_EVOLUTION_OVERRIDE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_EVOLUTION_OVERRIDE_TEST_ONLY_OPTIN_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
