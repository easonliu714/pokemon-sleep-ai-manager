// G265 #861: actual production nineteenth auto-identity writer admission/rollback contract.
// This is a source-bound isolated VM behavioral test, NOT actual Chromium or Android.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/identity-convergence.js','utf8');
const start='function strongCandidates(){',end='\nfunction boot(){';
assert.equal(source.split(start).length,2);
assert.equal(source.split(end).length,2);
for(const required of [/beginSqliteExclusiveWriteWindow\(\)/,
  /withPrimarySqliteMutationLock\(async lease=>/,
  /await snapshot\(/,/withSqliteCoordinatedMutation\(\(\)=>\{/,
  /begin\(\);begun=true/,/commit\(\);committed=true/,
  /persist\(\{primaryMutationLease:lease\}\)/,
  /close\?\.\(\{uncertainOutcome:failed\|\|\(committed&&!acknowledged\)\}\)/])
  assert.match(source,required,'production native admission/source binding removed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');

function fixture({deny=false,loseAck=false,failInsert=false,failSnapshot=false,empty=false}={}){
  const log=[],lease=Object.freeze({});
  let admitted=false,sticky=false,active=false,durable=0,dispatch=0;
  const fail=code=>Object.assign(new Error(code),{code});
  const ctx=vm.createContext({
    rows(sql){
      assert.equal(admitted,true,'first player identity predicate must run ONLY under native admission');
      log.push('READ');
      assert.match(sql,/identity_review_required=1/);
      return empty?[]:[{pokemon_id:'synthetic_A',pokemon_instance_id:'instance_A'}];
    },
    run(sql){
      assert.equal(admitted,true);assert.equal(active,true);
      log.push(sql.includes('UPDATE pokemon')?'UPDATE':'EVIDENCE');
      if(failInsert&&sql.includes('INSERT OR REPLACE'))throw fail('SYNTHETIC_EVIDENCE_INSERT_FAILED');
    },
    async snapshot(reason){
      assert.equal(admitted,true);
      assert.equal(reason,'identity-auto-converge:1');
      log.push('SNAPSHOT');
      if(failSnapshot)throw fail('SYNTHETIC_SNAPSHOT_FAILED');
    },
    begin(){log.push('BEGIN');active=true;},
    commit(){assert.equal(active,true);log.push('COMMIT');active=false;},
    rollback(){assert.equal(active,true);log.push('ROLLBACK');active=false;},
    async persist(options){
      log.push('PERSIST');
      assert.equal(options.primaryMutationLease,lease,'must bind the exact opaque admitted lease');
      durable++;
      if(loseAck)throw fail('SYNTHETIC_IDB_COMMITTED_APPLICATION_ACK_LOST');
    },
    beginSqliteExclusiveWriteWindow(){
      if(sticky)throw fail('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      log.push('WINDOW');
      return ({uncertainOutcome=false}={})=>{log.push('CLOSE');if(uncertainOutcome)sticky=true;};
    },
    async withPrimarySqliteMutationLock(callback){
      log.push('NATIVE_ADMIT');
      if(deny)throw fail('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      admitted=true;
      try{return await callback(lease);}finally{admitted=false;}
    },
    withSqliteCoordinatedMutation(callback){return callback();},
    localIso:()=> '2026-11-21T18:18:00+08:00',
    document:{dispatchEvent(e){assert.equal(e.type,'pokemon-sleep-data-refreshed');dispatch++;}},
    CustomEvent:class{constructor(type){this.type=type;}},
    Date,JSON,Number,Promise,Error,Object,String,console
  });
  vm.runInContext(operation+'\n;globalThis.__converge=convergeStrongIdentities;',ctx,{timeout:3000});
  return {save:ctx.__converge,log,read:()=>({sticky,durable,dispatch,active})};
}

// Stale pre-SQL native admission: no player read, snapshot, BEGIN, UPDATE, or IDB save.
const stale=fixture({deny:true});
await assert.rejects(stale.save(),e=>e.code==='SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
assert.deepEqual(stale.log,['WINDOW','NATIVE_ADMIT','CLOSE']);
assert.deepEqual(stale.read(),{sticky:true,durable:0,dispatch:0,active:false});
await assert.rejects(stale.save(),e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(stale.log.filter(x=>x==='NATIVE_ADMIT').length,1);
console.log('PASS G265_PRODUCTION_IDENTITY_CONVERGENCE_STALE_NATIVE_DENY_BEFORE_READ_AND_SQL');

const normal=fixture();
assert.equal(await normal.save(),1);
assert.deepEqual(normal.log,['WINDOW','NATIVE_ADMIT','READ','SNAPSHOT','BEGIN','UPDATE','EVIDENCE','COMMIT','PERSIST','CLOSE']);
assert.deepEqual(normal.read(),{sticky:false,durable:1,dispatch:1,active:false});
const none=fixture({empty:true});
assert.equal(await none.save(),0);
assert.deepEqual(none.log,['WINDOW','NATIVE_ADMIT','READ','CLOSE']);
assert.equal(none.read().durable,0);
console.log('PASS G265_PRODUCTION_IDENTITY_CONVERGENCE_ATOMIC_EXACT_LEASE_ACK_AND_EMPTY');

const rollback=fixture({failInsert:true});
await assert.rejects(rollback.save(),e=>e.code==='SYNTHETIC_EVIDENCE_INSERT_FAILED');
assert.deepEqual(rollback.log,['WINDOW','NATIVE_ADMIT','READ','SNAPSHOT','BEGIN','UPDATE','EVIDENCE','ROLLBACK','CLOSE']);
assert.deepEqual(rollback.read(),{sticky:true,durable:0,dispatch:0,active:false});
await assert.rejects(rollback.save(),e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_PRODUCTION_IDENTITY_CONVERGENCE_PRECOMMIT_ROLLBACK_AND_STICKY');

const ackLost=fixture({loseAck:true});
await assert.rejects(ackLost.save(),e=>e.code==='IDENTITY_CONVERGENCE_DURABILITY_UNVERIFIED_RELOAD_REQUIRED'
  &&e.cause?.code==='SYNTHETIC_IDB_COMMITTED_APPLICATION_ACK_LOST');
assert.deepEqual(ackLost.log,['WINDOW','NATIVE_ADMIT','READ','SNAPSHOT','BEGIN','UPDATE','EVIDENCE','COMMIT','PERSIST','CLOSE']);
assert.deepEqual(ackLost.read(),{sticky:true,durable:1,dispatch:0,active:false});
await assert.rejects(ackLost.save(),e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(ackLost.read().durable,1,'sticky page must never retry durable save');
console.log('PASS G265_PRODUCTION_IDENTITY_CONVERGENCE_UNKNOWN_ACK_STICKY_ZERO_RETRY');

const failedSnapshot=fixture({failSnapshot:true});
await assert.rejects(failedSnapshot.save(),e=>e.code==='SYNTHETIC_SNAPSHOT_FAILED');
assert.deepEqual(failedSnapshot.log,['WINDOW','NATIVE_ADMIT','READ','SNAPSHOT','CLOSE']);
assert.equal(failedSnapshot.read().sticky,true);
console.log('PASS G265_PRODUCTION_IDENTITY_CONVERGENCE_SNAPSHOT_FAILURE_ZERO_SQL');
console.log('HOLD G265_PRODUCTION_IDENTITY_CONVERGENCE_REAL_CHROMIUM_AND_ANDROID_OWNER_UAT_NOT_VERIFIED');
