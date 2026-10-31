// G265 sixteenth Legacy Writer: source-bound isolated opt-in CAS, rollback, ACK-loss recovery.
// The original recipe-display-name-evidence.js writer is unchanged and runs only inside
// disposable SQL.js VM sessions under the existing test-only cross-tab admission.
// No production wiring, player database, private IDB, or Android Owner-UAT authorization.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/recipe-display-name-evidence.js',import.meta.url),'utf8');
const start='export async function persistConfirmedRecipeDisplayNamesFromUcImg(){';
const end='\nasync function onDataChanged(';
assert.equal(source.split(start).length,2,'original evidence writer must be unique');
assert.equal(source.split(end).length,2,'original writer boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(operation,/INSERT OR IGNORE INTO recipe_display_name_evidence/);
assert.match(operation,/INSERT OR IGNORE INTO canonical_resolution_log/);
assert.match(operation,/if\(confirmed\.length\)await persist\(\)/);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteCrossTabWriteAdmission/);
console.log('PASS G265_SIXTEENTH_EVIDENCE_EXACT_LEGACY_SOURCE_BOUND_ISOLATED_OPTIN');

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
seed.run('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)');
seed.run('INSERT INTO schema_migrations VALUES(1)');
seed.run('CREATE TABLE canonical_resolution_log(resolution_id TEXT PRIMARY KEY,entity_type TEXT,raw_text TEXT,normalized_text TEXT,resolution_status TEXT,term_id TEXT,canonical_name_zh_tw TEXT,confidence REAL,requires_review INTEGER,source_type TEXT,source_ref TEXT,evidence_revision TEXT,observed_at TEXT,committed_at TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const digest=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
let durableWrites=0,rollbacks=0;
const invoked=[];
const session=id=>({
  schema:'pokemon-sleep-uc-img-a-session/1.0',
  session_id:'synthetic_session_'+id,
  scenario_state:{recipes:{
    last_apply_status:'APPLIED',
    last_update_id:'synthetic_update_'+id,
    raw_response:JSON.stringify({
      schema:'pokemon-sleep-public-master-recognition/1.0',
      scenario:'recipe_status_update',
      recognition_version:'synthetic',
      observations:[{
        status:'MATCHED',observation_id:'synthetic_observation_'+id,
        canonical_key:{recipe_id:'synthetic_recipe_'+id},
        observed_text:'synthetic_display_'+id,
        canonical_name:'synthetic_canonical_'+id,
        confidence:0.99,source_image_ref:'synthetic_image_'+id,
        user_resolution:{action:'USER_CONFIRMED_MATCH',confirmed_at:'2026-11-01T00:00:00Z'}
      }]
    })
  }}
});
function makeTab(bytes,id,{holdPersist,failAudit,loseAck}={}){
  const db=new SQL.Database(new Uint8Array(bytes));
  // Test-only atomic wrapper: the unchanged legacy writer has no native BEGIN/ROLLBACK.
  // Never infer production transaction safety from this isolated adapter.
  db.run('BEGIN IMMEDIATE');
  let transaction=true;
  const ctx={
    rows(sql,params=[]){
      const stmt=db.prepare(sql);
      try{if(params.length)stmt.bind(params);const out=[];while(stmt.step())out.push(stmt.getAsObject());return out;}
      finally{stmt.free();}
    },
    run(sql,params=[]){
      assert.equal(transaction,true);
      if(failAudit&&sql.includes('INSERT OR IGNORE INTO canonical_resolution_log'))
        throw Error('SYNTHETIC_AUDIT_INSERT_FAILURE');
      db.run(sql,params);
    },
    isRescueReadonly:()=>false,
    localStorage:{getItem:key=>key==='pokemon-sleep-uc-img-a-session-v1'?JSON.stringify(session(id)):null},
    async persist(){
      assert.equal(transaction,true);
      db.run('COMMIT');transaction=false;
      const exported=new Uint8Array(db.export());
      if(holdPersist)await holdPersist();
      durable=exported;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    console
  };
  const context=vm.createContext(ctx);
  vm.runInContext(source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')+
    '\n;globalThis.__saveEvidence=persistConfirmedRecipeDisplayNamesFromUcImg;',context,{timeout:3000});
  return {
    save:context.__saveEvidence,
    rollback(){if(transaction){db.run('ROLLBACK');transaction=false;rollbacks++;}},
    close:()=>db.close()
  };
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint:digest,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-recipe-evidence-'+id,expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await digest(latestBytes));
    invoked.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{
      const result=await tab.save();
      assert.equal(result.recorded_count,1);
      return {persistedBytes:new Uint8Array(durable)};
    }catch(error){tab.rollback();throw error;}
    finally{tab.close();}
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
assert.deepEqual(invoked,['A'],'stale writer must not enter original SQL.js function');
assert.equal(durableWrites,1);
assert.equal(count("SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_B'"),0);
assert.equal(count("SELECT COUNT(*) FROM canonical_resolution_log WHERE raw_text='synthetic_display_B'"),0);
await assert.rejects(execute(b,'B',initial),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_SIXTEENTH_EVIDENCE_TWO_TABS_ONE_ACK_STALE_ZERO_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await digest(durable))).status,'PERSISTED');
assert.equal(count('SELECT COUNT(*) FROM recipe_display_name_evidence'),2);
assert.equal(count('SELECT COUNT(*) FROM canonical_resolution_log'),2);
assert.equal(count("SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_B'"),1);
console.log('PASS G265_SIXTEENTH_EVIDENCE_FRESH_RELOAD_BOTH_NAMES_AND_AUDIT');

const beforeRollback=await digest(durable),writesBeforeRollback=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failAudit:true}),/SYNTHETIC_AUDIT_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,writesBeforeRollback);
assert.equal(await digest(durable),beforeRollback);
assert.equal(count("SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_ROLLBACK'"),0);
assert.equal(count('SELECT COUNT(*) FROM canonical_resolution_log'),2);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_SIXTEENTH_EVIDENCE_TEST_WRAPPER_PRECOMMIT_ROLLBACK_DURABLE_UNCHANGED');

const lost=admission(),writesBeforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await digest(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,writesBeforeLost+1);
assert.equal(count("SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_ACK_LOSS'"),1);
assert.equal(count("SELECT COUNT(*) FROM canonical_resolution_log WHERE raw_text='synthetic_display_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await digest(durable)),e=>e.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const reload=admission();
assert.equal((await execute(reload,'AFTER_RELOAD',await digest(durable))).status,'PERSISTED');
assert.equal(count('SELECT COUNT(*) FROM recipe_display_name_evidence'),4);
assert.equal(count('SELECT COUNT(*) FROM canonical_resolution_log'),4);
assert.equal(count("SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_ACK_LOSS'"),1);
assert.equal(count("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(durableWrites,4);
console.log('PASS G265_SIXTEENTH_EVIDENCE_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const unavailable=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint:digest,timeoutMs:3000
});
const noLockWrites=durableWrites;
await assert.rejects(execute(unavailable,'NO_LOCK',await digest(durable)),e=>e.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(unavailable.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,noLockWrites);
assert.ok(!invoked.includes('NO_LOCK'));
console.log('PASS G265_SIXTEENTH_EVIDENCE_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_SIXTEENTH_EVIDENCE_TEST_ONLY_OPTIN_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
