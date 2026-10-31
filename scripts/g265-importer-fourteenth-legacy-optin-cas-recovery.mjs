// G265 fourteenth Importer: opt-in atomic CAS / rollback / ACK-loss recovery.
// Disposable SQL.js VM tabs run the exact unchanged importer.js::applyPayload()
// only under the already existing opt-in exclusive admission adapter.
// No production runtime wiring, player IndexedDB, or import-policy admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/importer.js',import.meta.url),'utf8');
const marker='export async function applyPayload(payload) {';
const writeMarker='function write(entity, key, data, mode) {';
assert.equal(source.split(marker).length,2);
assert.equal(source.split(writeMarker).length,2);
const exact=source.slice(source.indexOf(writeMarker)).replace(/^export /gm,'');
assert.match(exact,/await snapshot\(/);
assert.match(exact,/begin\(\);[\s\S]*?commit\(\);[\s\S]*?await persist\(\)/);
assert.match(exact,/INSERT INTO import_batches/);
assert.doesNotMatch(exact,/createSqliteCrossTabWriteAdmission|navigator\.locks|runSqliteWriteSession/);
console.log('PASS G265_FOURTEENTH_IMPORTER_EXACT_SOURCE_BOUND_ISOLATED_OPTIN_ADMISSION');

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
      try {
        await prior;
        if(options.signal.aborted)throw Error('SYNTHETIC_ABORTED_WAIT');
        this.active++;
        this.peak=Math.max(this.peak,this.active);
        try{return await callback({name,mode:'exclusive'});}
        finally{this.active--;}
      } finally {release();}
    })();
  }
}
const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)');
seed.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT)');
seed.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO settings VALUES('seed','preserved')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const digest=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
let durableWrites=0,snapshots=0,rollbacks=0;
const invoked=[];
const payload=id=>({
  schema_version:'synthetic',update_id:'synthetic_'+id,
  generated_at:'2026-11-01T00:55:00+08:00',source:'synthetic',
  operations:[{entity:'settings',action:'insert',key:{key:'setting_'+id},data:{value:id}}]
});
function makeTab(bytes,{holdPersist,failBatch,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(bytes));
  let inTransaction=false,snapshotReady=false;
  const ctx={
    KEYS:{settings:['key']},
    quote:value=>'"'+String(value).replaceAll('"','""')+'"',
    CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_ONLY',
    localIso:()=> '2026-11-01T00:55:00+08:00',
    dryRun(p){
      assert.equal(p.operations.length,1);
      const o=p.operations[0];
      assert.equal(o.entity,'settings');
      return {conflict_count:0,changes:[{
        effective_action:'insert',key:{...o.key},data:{...o.data},
        before:null,after:{...o.key,...o.data},message:'',candy_storage:null
      }],audit_summary:{},visual_preflight:{status:'SYNTHETIC'}};
    },
    async snapshot(reason){
      assert.match(reason,/^before:synthetic_/);
      snapshots++;snapshotReady=true;
      return {status:'SYNTHETIC_ONLY'};
    },
    begin(){assert.ok(snapshotReady);db.run('BEGIN IMMEDIATE');inTransaction=true;},
    run(sql,params=[]){
      assert.ok(inTransaction);
      if(failBatch&&sql.startsWith('INSERT INTO import_batches'))throw Error('SYNTHETIC_BATCH_INSERT_FAILURE');
      db.run(sql,params);
    },
    commit(){db.run('COMMIT');inTransaction=false;},
    rollback(){
      rollbacks++;
      if(inTransaction){db.run('ROLLBACK');inTransaction=false;}
    },
    async persist(){
      assert.equal(inTransaction,false);
      const exported=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=exported;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    JSON,Object,Promise,Error,Map,Set,Number,String,console
  };
  const context=vm.createContext(ctx);
  vm.runInContext(exact+'\n;globalThis.__apply=applyPayload;',context,{timeout:3000});
  return {apply:context.__apply,close:()=>db.close()};
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint:digest,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-import-'+id,
  expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await digest(latestBytes));
    invoked.push(id);
    const tab=makeTab(latestBytes,options);
    try {
      const result=await tab.apply(payload(id));
      assert.equal(result.operation_count,1);
      return {persistedBytes:new Uint8Array(durable)};
    } finally {tab.close();}
  }
});
const count=sql=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try {
    const result=db.exec(sql);
    return result.length?result[0].values[0][0]:0;
  } finally {db.close();}
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
assert.deepEqual(invoked,['A'],'second stale importer cannot enter the locked writer');
releaseFirst();
assert.equal((await first).status,'PERSISTED');
await assert.rejects(second,e=>e.code==='SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(invoked,['A']);
assert.equal(durableWrites,1);
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='setting_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='setting_B'"),0);
assert.equal(count("SELECT COUNT(*) FROM import_batches WHERE update_id='synthetic_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM import_batches WHERE update_id='synthetic_B'"),0);
await assert.rejects(execute(b,'B',initial),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_FOURTEENTH_IMPORTER_TWO_TABS_ONE_ACK_STALE_ZERO_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await digest(durable))).status,'PERSISTED');
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='setting_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='setting_B'"),1);
assert.equal(count("SELECT COUNT(*) FROM import_batches"),2);

const beforeRollback=await digest(durable),writesBeforeRollback=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failBatch:true}),/SYNTHETIC_BATCH_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,writesBeforeRollback);
assert.equal(await digest(durable),beforeRollback);
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='setting_ROLLBACK'"),0);
assert.equal(count("SELECT COUNT(*) FROM import_batches WHERE update_id='synthetic_ROLLBACK'"),0);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_FOURTEENTH_IMPORTER_PRECOMMIT_ROLLBACK_DURABLE_UNCHANGED');

const lost=admission();
const writesBeforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await digest(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,writesBeforeLost+1,'durable write occurred exactly once despite missing ACK');
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='setting_ACK_LOSS'"),1);
assert.equal(count("SELECT COUNT(*) FROM import_batches WHERE update_id='synthetic_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await digest(durable)),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const reloaded=admission();
assert.equal((await execute(reloaded,'AFTER_RELOAD',await digest(durable))).status,'PERSISTED');
assert.equal(count("SELECT COUNT(*) FROM import_batches WHERE update_id='synthetic_ACK_LOSS'"),1);
assert.equal(count("SELECT COUNT(*) FROM import_batches WHERE update_id='synthetic_AFTER_RELOAD'"),1);
assert.equal(count("SELECT COUNT(*) FROM settings WHERE key='seed'"),1);
assert.equal(count("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(durableWrites,4);
assert.equal(locks.peak,1);
console.log('PASS G265_FOURTEENTH_IMPORTER_ACK_LOSS_STICKY_HOLD_FRESH_RELOAD_DURABLE_READBACK');
console.log('HOLD G265_IMPORTER_PRODUCTION_ADMISSION_LEGACY_23_WRITERS_ANDROID_OWNER_DOD');
