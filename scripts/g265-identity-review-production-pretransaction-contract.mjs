// G265 #861: production identity-review confirmation must admit the native
// primary lease BEFORE any snapshot/SQL and retain it through durable ACK.
// Synthetic VM only: never loads a player's SQLite/IDB or modifies Public Master.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/identity-review.js',import.meta.url),'utf8');
const start='async function confirmIndependent(pokemonId) {';
const end='\nasync function markEvolution(';
assert.equal(source.split(start).length,2);
assert.equal(source.split(end).length,2);
const operation=source.slice(source.indexOf(start),source.indexOf(end));

function fixture({deny=false,failEvidence=false,ackLoss=false,missing=false}={}){
  const calls=[];
  let held=false,tx=false,committed=false,uncertain=false,acknowledged=false;
  let state={confirmed:false,evidence:false},pending=null;
  const lease=Object.freeze({synthetic:true});
  const requireHeld=()=>assert.equal(held,true,'SQL_OR_SNAPSHOT_BEFORE_NATIVE_PRIMARY_LEASE');
  const ctx={
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SYNTHETIC_UNVERIFIED_RELOAD_REQUIRED');
      calls.push('window');
      return ({uncertainOutcome=false}={})=>{calls.push('close');if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');
      if(deny)throw Error('SYNTHETIC_LOCK_DENIED');
      held=true;try{return await fn(lease);}finally{held=false;}
    },
    withSqliteCoordinatedMutation(fn){requireHeld();return fn();},
    rows(sql,params=[]){
      requireHeld();calls.push('read');
      if(missing)return [];
      return [{pokemon_id:params[0],pokemon_instance_id:'instance_A',status:'active',identity_review_required:1}];
    },
    async snapshot(reason){requireHeld();calls.push('snapshot');assert.equal(reason,'identity-confirm:synthetic_A');},
    begin(){requireHeld();assert.equal(tx,false);tx=true;pending={...state};calls.push('begin');},
    run(sql,params=[]){
      requireHeld();assert.equal(tx,true,'SQL_OUTSIDE_TRANSACTION');
      calls.push('run');
      if(sql.includes('UPDATE pokemon'))pending.confirmed=true;
      if(sql.includes('pokemon_identity_evidence')){
        if(failEvidence)throw Error('SYNTHETIC_EVIDENCE_INSERT_FAILURE');
        pending.evidence=true;
      }
    },
    commit(){requireHeld();assert.equal(tx,true);state=pending;pending=null;tx=false;committed=true;calls.push('commit');},
    rollback(){requireHeld();if(tx){tx=false;pending=null;}calls.push('rollback');},
    async persist({primaryMutationLease}={}){
      requireHeld();assert.equal(primaryMutationLease,lease);
      assert.equal(committed,true);
      calls.push('persist');
      if(ackLoss)throw Error('SYNTHETIC_ACK_LOSS');
      acknowledged=true;
    },
    localIso:()=> '2026-11-13T02:30:00+08:00',
    renderIdentityReview(){calls.push('render');},
    Date:{now:()=>1794510000000},JSON,Promise,Error,Number,String,console,
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__confirmIndependent=confirmIndependent;',context,{timeout:3000});
  return {confirm:context.__confirmIndependent,calls,view:()=>({state:{...state},tx,uncertain,acknowledged})};
}
const positive=fixture();
await positive.confirm('synthetic_A');
assert.deepEqual(positive.view().state,{confirmed:true,evidence:true});
assert.equal(positive.view().acknowledged,true);
assert.ok(positive.calls.indexOf('lock')<positive.calls.indexOf('read'));
assert.ok(positive.calls.indexOf('lock')<positive.calls.indexOf('snapshot'));
assert.ok(positive.calls.indexOf('persist')<positive.calls.indexOf('close'));
console.log('PASS G265_IDENTITY_CONFIRM_NATIVE_PRE_SQL_ATOMIC_DURABLE_ACK');

const denied=fixture({deny:true});
await assert.rejects(denied.confirm('synthetic_A'),/SYNTHETIC_LOCK_DENIED/);
assert.equal(denied.calls.includes('read'),false);
assert.equal(denied.calls.includes('snapshot'),false);
assert.equal(denied.calls.includes('run'),false);
assert.equal(denied.calls.includes('persist'),false);
console.log('PASS G265_IDENTITY_CONFIRM_LOCK_DENIAL_ZERO_SQL');

const rollback=fixture({failEvidence:true});
await assert.rejects(rollback.confirm('synthetic_A'),/SYNTHETIC_EVIDENCE_INSERT_FAILURE/);
assert.deepEqual(rollback.view().state,{confirmed:false,evidence:false});
assert.equal(rollback.view().tx,false);
assert.equal(rollback.calls.includes('persist'),false);
console.log('PASS G265_IDENTITY_CONFIRM_PRECOMMIT_ROLLBACK');

const lost=fixture({ackLoss:true});
await assert.rejects(lost.confirm('synthetic_A'),/SYNTHETIC_ACK_LOSS/);
assert.deepEqual(lost.view().state,{confirmed:true,evidence:true});
assert.equal(lost.view().uncertain,true);
await assert.rejects(lost.confirm('synthetic_A'),/SYNTHETIC_UNVERIFIED_RELOAD_REQUIRED/);
console.log('PASS G265_IDENTITY_CONFIRM_POSTCOMMIT_ACK_LOSS_STICKY_HOLD');

const missing=fixture({missing:true});
await assert.rejects(missing.confirm('synthetic_A'),/IDENTITY_CONFIRM_TARGET_NOT_ACTIVE/);
assert.equal(missing.calls.includes('run'),false);
console.log('PASS G265_IDENTITY_CONFIRM_MISSING_TARGET_ZERO_SQL');
