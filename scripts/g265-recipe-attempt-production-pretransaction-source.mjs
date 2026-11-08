// G265 production named recordRecipeAttemptFailure pre-SQL admission regression.
// Executes the exact source function with disposable synthetic state; never a player DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/recipe-attempt-feedback-local.js','utf8');
const anchor='export async function recordRecipeAttemptFailure(';
assert.equal(source.split(anchor).length,2);
const body=source.split(anchor)[1].split('// G6.2: share the attempt-write')[0];
assert.match(body,/withPrimarySqliteMutationLock\(async lease/,'must admit before canonical player reads');
assert.match(body,/snapshot\('recipe-feedback:record-attempt'\)/);
assert.match(body,/persist\(\{primaryMutationLease:lease\}\)/);
const executable='async function recordRecipeAttemptFailure('+body+'\nreturn recordRecipeAttemptFailure;';
function fixture({stale=false,noLocks=false,sqlFailure=false,ackLoss=false}={}){
  let held=false,exclusive=false,uncertain=false,privileged=0;
  const calls=[],marker={value:null},durable={attempts:0,state:null};
  const requireLock=()=>assert.equal(held,true,'SQL_READ_OR_MUTATION_BEFORE_PRIMARY_LOCK');
  const ctx={
    requireWritableDatabase(){if(uncertain)throw Object.assign(Error('UNVERIFIED'),{code:'SQLITE_UNVERIFIED_RELOAD_REQUIRED'});},
    beginSqliteExclusiveWriteWindow(){assert.equal(exclusive,false);exclusive=true;return ({uncertainOutcome=false}={})=>{
      exclusive=false;if(uncertainOutcome)uncertain=true;};},
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');
      if(noLocks)throw Error('SQLITE_PRIMARY_WEB_LOCKS_UNAVAILABLE');
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      held=true;try{return await fn({fixtureLease:true});}finally{held=false;}
    },
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    canonicalRecipe(id){requireLock();calls.push('read');return id==='r'?{recipe_id:'r',recipe_name:'Synthetic'}:null;},
    provenanceFor(){return {formula_source_type:'PUBLIC_RECIPE_PROVENANCE'};},
    recipeAttemptDefaultSource(){return {source_type:'PUBLIC_RECIPE_PROVENANCE',source_name:'Synthetic'};},
    canonicalIngredientNames(){requireLock();calls.push('ingredients');return new Set(['apple']);},
    buildRecipeAttemptFeedbackRecord(x){return {...x,outcome:'DID_NOT_UNLOCK',actual_ingredients:x.actual_ingredients};},
    eventId:()=> 'fixture-attempt',nowIso:()=> '2026-11-08T15:00:00.000Z',
    clean:value=>String(value??'').normalize('NFKC').trim(),
    armPersistenceMarker(m){requireLock();calls.push('marker');marker.value=m;},
    clearPersistenceMarker(){calls.push('clear');marker.value=null;},
    async snapshot(reason){requireLock();assert.equal(reason,'recipe-feedback:record-attempt');calls.push('snapshot');},
    begin(){requireLock();assert.ok(privileged);calls.push('begin');},
    run(sql){requireLock();assert.ok(privileged);calls.push('run');
      if(sql.includes('recipe_feedback_state')&&sqlFailure)throw Error('synthetic_second_statement_rejected');},
    commit(){requireLock();assert.ok(privileged);calls.push('commit');},
    rollback(){requireLock();assert.ok(privileged);calls.push('rollback');},
    async persist(opts){requireLock();assert.ok(privileged);assert.equal(opts?.primaryMutationLease?.fixtureLease,true);
      calls.push('persist');durable.attempts++;if(ackLoss)throw Error('synthetic_postwrite_ack_lost');},
    persistenceUncertainError:(m,e)=>Object.assign(Error('PERSISTENCE_UNCERTAIN'),{code:'PERSISTENCE_UNCERTAIN',cause:e}),
    RECIPE_ATTEMPT_FEEDBACK_VERSION:'fixture',CustomEvent:class{},
    pendingPersistenceHold:null,recordInFlight:false,playerWriteInFlight:false,
    dispatchEvent(){},
  };
  const fn=vm.runInNewContext('(function(){'+executable+'})()',ctx);
  return {fn,calls,marker,durable};
}
const input={recipe_id:'r',actual_ingredients:[{ingredient_name:'apple',quantity:2}]};
const ok=fixture();
const result=await ok.fn(input);
assert.equal(result.attempt_id,'fixture-attempt');
assert.deepEqual(ok.calls,['lock','read','ingredients','marker','snapshot','begin','run','run','commit','persist','clear']);
assert.equal(ok.marker.value,null);assert.equal(ok.durable.attempts,1);
for(const opts of [{stale:true},{noLocks:true}]){
  const f=fixture(opts);await assert.rejects(f.fn(input),/SQLITE_PRIMARY_/);
  assert.deepEqual(f.calls,['lock'],'stale or no-lock must not read or mutate player SQL');
  assert.equal(f.durable.attempts,0);
}
const rollback=fixture({sqlFailure:true});
await assert.rejects(rollback.fn(input),/synthetic_second_statement_rejected/);
assert.equal(rollback.calls.includes('rollback'),true);
assert.equal(rollback.calls.includes('persist'),false);
assert.equal(rollback.marker.value.attempt_id,'fixture-attempt');
const lost=fixture({ackLoss:true});
await assert.rejects(lost.fn(input),e=>e.code==='PERSISTENCE_UNCERTAIN');
assert.equal(lost.durable.attempts,1);
await assert.rejects(lost.fn(input));
assert.equal(lost.durable.attempts,1,'ambiguous ACK forbids blind retry');
console.log('PASS G265_RECIPE_ATTEMPT_NAMED_PRODUCTION_PRE_SQL_LOCK_SNAPSHOT_ROLLBACK_ACK_LOSS');
