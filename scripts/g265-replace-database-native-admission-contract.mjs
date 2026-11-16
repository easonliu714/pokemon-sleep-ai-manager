// G265 #861 source-bound negative-first for the real production replaceDatabase.
// The SQL, native admission and durable ACK are isolated fixtures, NOT Android proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/database.js',import.meta.url),'utf8');
const start='export async function replaceDatabase(bytes){';
const end='\nexport function begin(){';
assert.equal(source.split(start).length,2,'G265 source marker changed');
assert.equal(source.split(end).length,2,'G265 source end marker changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /,'');

function fixture({deny=false,invalid=false,migrationFail=false,ackLoss=false}={}){
  const events=[];
  let leaseHeld=false,acknowledged=false,windowActive=false,uncertain=false;
  const lease=Object.freeze({synthetic:true});
  const original={kind:'original',closed:false,close(){events.push('original-close');this.closed=true;}};
  class Candidate {
    constructor(bytes){
      assert.equal(leaseHeld,true,'G265_REPLACEMENT_SQL_BEFORE_NATIVE_PRIMARY_LEASE');
      events.push('candidate-construct');
      if(invalid)throw Error('SYNTHETIC_INVALID_SQLITE');
      this.kind='candidate';this.closed=false;
    }
    exec(sql){
      assert.equal(leaseHeld,true);
      assert.match(sql,/PRAGMA integrity_check/);
      events.push('integrity');
      return [{columns:['integrity_check'],values:[['ok']]}];
    }
    run(sql){assert.equal(leaseHeld,true);assert.equal(windowActive,true);events.push('candidate-sql');}
    close(){events.push('candidate-close');this.closed=true;}
  }
  const ctx={
    db:original,rescueReadonly:false,SQL:{Database:Candidate},DDL:'CREATE TABLE fixture(id INTEGER)',
    emit(){events.push('emit');},
    assertSqliteDirectWriteAllowed(){events.push('legacy-guard');},
    beginSqliteExclusiveWriteWindow(){
      events.push('exclusive-window');windowActive=true;
      return ({uncertainOutcome=false}={})=>{
        events.push('exclusive-close');windowActive=false;
        if(uncertainOutcome)uncertain=true;
      };
    },
    async withPrimarySqliteMutationLock(cb){
      events.push('native-lease');
      if(deny)throw Error('SYNTHETIC_NATIVE_LEASE_DENIED');
      leaseHeld=true;
      try{return await cb(lease);}finally{leaseHeld=false;}
    },
    withSqliteCoordinatedMutation(cb){assert.equal(leaseHeld,true);return cb();},
    rows(){assert.equal(leaseHeld,true);events.push('legacy-rows');return [{integrity_check:'ok'}];},
    applyAllMigrations(database){
      assert.equal(leaseHeld,true);assert.equal(database.kind,'candidate');
      events.push('migration');
      if(migrationFail)throw Error('SYNTHETIC_MIGRATION_FAILURE');
      return {public_master:'isolated'};
    },
    applyCandyFamilyStorageLifecycle(database,migration){
      assert.equal(database.kind,'candidate');events.push('candy-migration');
      return {...migration,candy_family_storage:'isolated'};
    },
    async persist({primaryMutationLease}={}){
      assert.equal(leaseHeld,true,'G265_PERSIST_AFTER_NATIVE_LEASE_RELEASE');
      assert.equal(primaryMutationLease,lease,'G265_WRONG_PRIMARY_MUTATION_LEASE');
      assert.equal(ctx.db.kind,'candidate');
      events.push('durable-persist');
      if(ackLoss)throw Error('SYNTHETIC_DURABLE_ACK_LOSS');
      acknowledged=true;
    },
    dispatchReadyAsync(){assert.equal(acknowledged,true);events.push('ready');},
    Error,Object,Promise,
  };
  const run=vm.runInNewContext(operation+'\n;replaceDatabase',ctx,{timeout:3000});
  return {replace:()=>run(new Uint8Array([1,2,3])),ctx,original,events,
    status:()=>({acknowledged,windowActive,uncertain})};
}

// A stale second tab must be denied BEFORE the loaded image is closed or SQL starts.
{
  const x=fixture({deny:true});
  await assert.rejects(x.replace(),/SYNTHETIC_NATIVE_LEASE_DENIED/);
  assert.equal(x.original.closed,false,'G265_STALE_RESTORE_CLOSED_LIVE_DB_BEFORE_LEASE');
  assert.equal(x.ctx.db,x.original);
  assert.equal(x.events.includes('candidate-construct'),false);
  assert.equal(x.events.includes('durable-persist'),false);
}
// Invalid input and failed migration cannot destroy the existing loaded image.
for(const flags of [{invalid:true},{migrationFail:true}]){
  const x=fixture(flags);
  await assert.rejects(x.replace(),/SYNTHETIC_INVALID_SQLITE|SYNTHETIC_MIGRATION_FAILURE/);
  assert.equal(x.original.closed,false,'G265_INVALID_CANDIDATE_CLOSED_LIVE_DB');
  assert.equal(x.ctx.db,x.original);
  assert.equal(x.events.includes('durable-persist'),false);
}
// A lost IDB ACK must quarantine the page; no success event or blind rollback write.
{
  const x=fixture({ackLoss:true});
  await assert.rejects(x.replace(),/SYNTHETIC_DURABLE_ACK_LOSS/);
  assert.equal(x.original.closed,false);
  assert.equal(x.ctx.db,x.original);
  assert.equal(x.status().uncertain,true,'G265_POSTWRITE_ACK_LOSS_MUST_HOLD');
  assert.equal(x.events.includes('ready'),false);
}
// Success remains under the exact native lease through durable ACK, then closes old DB.
{
  const x=fixture();
  await x.replace();
  assert.equal(x.status().acknowledged,true);
  assert.equal(x.original.closed,true);
  assert.equal(x.ctx.db.kind,'candidate');
  assert.ok(x.events.indexOf('native-lease')<x.events.indexOf('candidate-construct'));
  assert.ok(x.events.indexOf('durable-persist')<x.events.indexOf('original-close'));
  assert.ok(x.events.indexOf('original-close')<x.events.indexOf('ready'));
  assert.equal(x.status().uncertain,false);
}
console.log('PASS G265_REPLACE_DATABASE_NATIVE_PRE_SQL_ADMISSION_INVALID_CANDIDATE_ACK_LOSS_AND_ACK');
