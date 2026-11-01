// G265 twenty-first Analysis Revision Legacy Writer: isolated CAS / rollback / ACK-loss source Gate.
// Invoke the unchanged production saveAnalysisRevision() in disposable synthetic SQL.js VM sessions.
// Exclusive Web Locks, SHA-256 durable CAS and SQLite transaction wrapping are TEST-ONLY.
// Never connect this adapter to player SQLite, IndexedDB, screenshots or production UI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/analysis-revision-store.js',import.meta.url),'utf8');
for(const required of [/export async function saveAnalysisRevision\(/,/await snapshot\(/,
  /run\('INSERT INTO image_analysis_revision /,/await persist\(\)/])
  assert.match(source,required);
assert.doesNotMatch(source,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
const operation=source.replace(/^import [^\n]*\n/gm,'').replace(/^export /gm,'');
console.log('PASS G265_TWENTY_FIRST_ANALYSIS_REVISION_EXACT_LEGACY_SOURCE_BOUND_ISOLATED_OPTIN');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const fingerprint=bytes=>sha256SqliteBytes(bytes,webcrypto);
const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(
    result[0].columns.map((name,i)=>[name,values[i]])));
};
const count=(sql)=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try{return db.exec(sql)[0].values[0][0];}
  finally{db.close();}
};
const revision=(id)=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try{
    const rows=rowObjects(db,'SELECT * FROM image_analysis_revision WHERE image_sha256=?',['synthetic-image-sha-'+id]);
    return rows.length?{...rows[0],result:JSON.parse(rows[0].result_json)}:null;
  }finally{db.close();}
};
class QueueLocks {
  constructor(){this.tail=Promise.resolve();this.active=0;this.peak=0;}
  request(name,options,callback){
    assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
    assert.equal(options.mode,'exclusive');
    assert.ok(options.signal);
    const previous=this.tail;let release;
    this.tail=new Promise(resolve=>{release=resolve;});
    return (async()=>{
      try{
        await previous;
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
function makeTab(latestBytes,id,{holdPersist,failInsert,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(latestBytes));
  // Test-only transaction begins before the unchanged writer observes previous revisions.
  db.run('BEGIN IMMEDIATE');
  let transaction=true;
  const context=vm.createContext({
    rows:(sql,params=[])=>rowObjects(db,sql,params),
    run(sql,params=[]){
      assert.equal(transaction,true,'all source SQL must stay inside admitted transaction');
      if(failInsert&&sql.startsWith('INSERT INTO image_analysis_revision'))
        throw Error('SYNTHETIC_ANALYSIS_REVISION_INSERT_FAILURE');
      db.run(sql,params);
    },
    async snapshot(reason){
      assert.equal(reason,'before_analysis_revision_roster');
      snapshots++;return {status:'SYNTHETIC_SNAPSHOT'};
    },
    async persist(){
      assert.equal(transaction,true,'test wrapper owns transaction until source persist');
      db.run('COMMIT');transaction=false;
      const bytes=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=bytes;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    crypto:{randomUUID:()=> 'synthetic-revision-'+id},
    dispatchEvent(event){
      assert.equal(event.type,'pokemon-sleep:analysis-revision-saved');dispatches++;
    },
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    JSON,Number,String,Promise,Error,Math,Date,Object,console
  });
  vm.runInContext(operation+'\n;globalThis.__save=saveAnalysisRevision;',context,{timeout:3000});
  return {
    save:()=>context.__save({
      imageSha256:'synthetic-image-sha-'+id,analysisType:'roster',
      provider:'synthetic-'+id,result:{pokemon:'synthetic-'+id,level:id==='A'?12:35}
    }),
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    close:()=>db.close()
  };
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-analysis-revision-'+id,expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await fingerprint(latestBytes));
    entered.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{
      const record=await tab.save();
      assert.equal(record.revision_no,1);
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
assert.deepEqual(entered,['A'],'stale writer must execute zero source SQL statements');
assert.equal(durableWrites,1);
assert.equal(revision('A').result.level,12);
assert.equal(revision('B'),null);
await assert.rejects(execute(b,'B',original),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_TWENTY_FIRST_ANALYSIS_REVISION_TWO_TABS_ONE_ACK_STALE_ZERO_SQL_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await fingerprint(durable))).status,'PERSISTED');
assert.equal(revision('A').result.level,12);
assert.equal(revision('B').result.level,35);
assert.equal(count('SELECT COUNT(*) FROM image_analysis_revision'),2);
console.log('PASS G265_TWENTY_FIRST_ANALYSIS_REVISION_FRESH_RELOAD_BOTH_INDEPENDENT_REVISIONS');

const beforeRollback=await fingerprint(durable),beforeRollbackWrites=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failInsert:true}),/SYNTHETIC_ANALYSIS_REVISION_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,beforeRollbackWrites);
assert.equal(await fingerprint(durable),beforeRollback);
assert.equal(revision('ROLLBACK'),null);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_TWENTY_FIRST_ANALYSIS_REVISION_PRECOMMIT_ROLLBACK_DURABLE_SHA_UNCHANGED');

const lost=admission(),beforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeLost+1);
assert.equal(revision('ACK_LOSS').result.level,35);
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const recovered=admission();
assert.equal((await execute(recovered,'AFTER_RELOAD',await fingerprint(durable))).status,'PERSISTED');
assert.equal(count('SELECT COUNT(*) FROM image_analysis_revision'),4);
for(const id of ['A','B','ACK_LOSS','AFTER_RELOAD'])assert.ok(revision(id));
assert.equal(count("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(durableWrites,4);
assert.equal(snapshots,5,'failed precommit transaction also reached snapshot');
assert.equal(dispatches,3,'postcommit ACK loss must suppress UI dispatch');
console.log('PASS G265_TWENTY_FIRST_ANALYSIS_REVISION_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const noLocks=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const beforeNoLock=durableWrites;
await assert.rejects(execute(noLocks,'B',await fingerprint(durable)),e=>e.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeNoLock);
assert.deepEqual(entered,['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']);
console.log('PASS G265_TWENTY_FIRST_ANALYSIS_REVISION_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_ANALYSIS_REVISION_TEST_ONLY_OPTIN_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
