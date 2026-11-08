// G265 named production G6.2 pause toggle: cross-tab admission must precede
// canonical player read, write-ahead marker, SQL mutation and durable ACK.
// Source-bound disposable VM, no real player SQLite or IndexedDB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/recipe-attempt-feedback-local.js','utf8');
const marker='export async function setRecipeRecommendationPaused(';
assert.equal(source.split(marker).length,2,'exact named production writer required');
const code='let playerWriteInFlight=false;let pendingPersistenceHold=null;\n'+
  'async function setRecipeRecommendationPaused('+source.split(marker)[1];
function fixture({stale=false,sqlFailure=false,ackLoss=false}={}){
  let held=false,exclusive=false,uncertain=false,privileged=0;
  let row={recipe_id:'r',recommendation_paused:0,reference_maybe_wrong:1,
    last_attempt_id:'keep-attempt',updated_at:'before'};
  let durable={...row},transaction=null,markerArmed=false;
  const calls={lock:0,read:0,marker:0,snapshot:0,begin:0,run:0,commit:0,
    rollback:0,persist:0};
  const requireHeld=()=>assert.equal(held,true,'G265_PRE_SQL_PRIMARY_LOCK_REQUIRED');
  const ctx={
    requireWritableDatabase(){if(uncertain)throw Error('SQLITE_UNVERIFIED_RELOAD_REQUIRED');},
    canonicalRecipe(id){calls.read++;requireHeld();
      return id==='r'?{recipe_id:'r',recipe_name:'Synthetic'}:null;},
    nowIso:()=> '2026-11-08T11:55:00.000Z',
    armPersistenceMarker(m){requireHeld();calls.marker++;markerArmed=true;
      assert.equal(m.operation,'PAUSE_TOGGLE');},
    clearPersistenceMarker(){markerArmed=false;},
    persistenceUncertainError:(m,e)=>Object.assign(Error('PERSISTENCE_UNCERTAIN'),{code:'PERSISTENCE_UNCERTAIN',cause:e}),
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SQLITE_UNVERIFIED_RELOAD_REQUIRED');
      assert.equal(exclusive,false);exclusive=true;
      return ({uncertainOutcome=false}={})=>{exclusive=false;if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){calls.lock++;
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      held=true;try{return await fn(ctx.lease);}finally{held=false;}},
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    snapshot:async()=>{requireHeld();calls.snapshot++;return {synthetic:true};},
    begin(){requireHeld();assert.ok(privileged);calls.begin++;transaction={...row};},
    run(sql,params){requireHeld();assert.ok(privileged,'coordinated mutation required');
      calls.run++;assert.match(sql,/INSERT INTO recipe_feedback_state/);
      assert.equal(markerArmed,true,'recovery intent must precede SQL');
      if(sqlFailure)throw Error('SYNTHETIC_SQL_ABORT');
      row={...row,recommendation_paused:params[1],updated_at:params[2]};},
    commit(){requireHeld();assert.ok(privileged);calls.commit++;transaction=null;},
    rollback(){requireHeld();assert.ok(privileged);calls.rollback++;if(transaction)row=transaction;},
    async persist({primaryMutationLease}={}){requireHeld();assert.equal(primaryMutationLease,ctx.lease);
      calls.persist++;durable={...row};if(ackLoss)throw Error('SYNTHETIC_POSTWRITE_ACK_LOSS');},
    lease:Object.freeze({}),RECIPE_ATTEMPT_FEEDBACK_VERSION:'fixture',
    globalThis:{dispatchEvent(){}},CustomEvent:class{constructor(){}},
    Object,Error,Boolean,String,Number,JSON,Date,Promise
  };
  vm.runInNewContext(code,ctx,{filename:'recipe-pause-production',timeout:3000});
  return {call:ctx.setRecipeRecommendationPaused,calls,
    get row(){return row;},get durable(){return durable;},
    get uncertain(){return uncertain;},get markerArmed(){return markerArmed;}};
}
{
  const f=fixture();
  const result=await f.call('r',true);
  assert.equal(result.recommendation_paused,true);
  assert.equal(f.calls.lock,1);
  assert.equal(f.calls.read,1);
  assert.equal(f.calls.marker,1);
  assert.equal(f.calls.snapshot,1);
  assert.equal(f.calls.begin,1);
  assert.equal(f.calls.run,1);
  assert.equal(f.calls.commit,1);
  assert.equal(f.calls.persist,1);
  assert.equal(f.durable.recommendation_paused,1);
  assert.equal(f.durable.reference_maybe_wrong,1);
  assert.equal(f.durable.last_attempt_id,'keep-attempt');
  assert.equal(f.markerArmed,false);
  assert.equal(f.uncertain,false);
}
{
  const f=fixture({stale:true});
  await assert.rejects(f.call('r',true),/STALE_REVISION/);
  assert.equal(f.calls.read,0,'stale tab cannot read recipe before admission');
  assert.equal(f.calls.marker,0);
  assert.equal(f.calls.run,0);
  assert.equal(f.calls.persist,0);
  assert.equal(f.uncertain,true);
}
{
  const f=fixture({sqlFailure:true});
  await assert.rejects(f.call('r',true),/SYNTHETIC_SQL_ABORT/);
  assert.equal(f.calls.rollback,1);
  assert.equal(f.calls.persist,0);
  assert.equal(f.row.recommendation_paused,0);
  assert.equal(f.durable.recommendation_paused,0);
}
{
  const f=fixture({ackLoss:true});
  await assert.rejects(f.call('r',true),/PERSISTENCE_UNCERTAIN/);
  assert.equal(f.durable.recommendation_paused,1,'postwrite ACK loss can be durable');
  assert.equal(f.markerArmed,true,'retain marker for reload readback');
  assert.equal(f.uncertain,true);
  await assert.rejects(f.call('r',false),/UNVERIFIED_RELOAD_REQUIRED/);
  assert.equal(f.calls.persist,1,'no blind retry after ACK ambiguity');
}
assert.match(source.split(marker)[1],/withPrimarySqliteMutationLock\(async lease/);
assert.match(source.split(marker)[1],/persist\(\{primaryMutationLease:lease\}\)/);
console.log('PASS G265_RECIPE_PAUSE_PRODUCTION_PRE_SQL_STALE_ROLLBACK_ACK_LOSS');
