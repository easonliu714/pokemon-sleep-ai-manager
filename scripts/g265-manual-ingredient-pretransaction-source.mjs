// G265 production source-bound named ingredient pre-SQL admission.
// Disposable VM: no player SQLite/IDB, no public Master or rating mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const raw=fs.readFileSync('assets/js/manual-editor.js','utf8');
const named=raw.split('export async function saveIngredient(')[1]?.split('export async function saveItem(')[0];
assert.ok(named,'named ingredient entry must exist');
assert.match(named,/beginSqliteExclusiveWriteWindow\(\)/);
assert.match(named,/withPrimarySqliteMutationLock\(async lease/);
assert.match(named,/persist\(\{primaryMutationLease:lease\}\)/);
assert.match(named,/withSqliteCoordinatedMutation\(begin\)/);
assert.match(named,/withSqliteCoordinatedMutation\(commit\)/);
const code=raw.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function fixture({stale=false,failRun=false,ackLoss=false,initialUnlock=1}={}){
  let held=false,exclusive=false,uncertain=false,privileged=0,transaction=null;
  let inventory={ingredient_name:'Apple',quantity:3,unlocked:initialUnlock},durable={...inventory};
  const calls={rows:0,sql:0,snapshot:0,begin:0,commit:0,rollback:0,persist:0,audit:0,lock:0};
  const requireHeld=()=>assert.equal(held,true,'no player SQL read/write before lock admission');
  const ctx={
    localIso:()=> '2026-11-08T00:00:00+08:00',
    rows(sql){requireHeld();calls.rows++;if(sql.includes('ingredient_master'))return [{ingredient_name:'Apple'}];if(sql.includes('ingredient_inventory'))return [{...inventory}];return [];},
    run(sql,params=[]){requireHeld();assert.ok(privileged>0,'SQL mutation must be coordinated');calls.sql++;
      if(sql.startsWith('INSERT INTO ingredient_inventory')){if(failRun)throw Error('SYNTHETIC_SQL_FAILURE');inventory={ingredient_name:params[0],quantity:params[1],unlocked:params[2]};}
      if(sql.startsWith('INSERT INTO import_'))calls.audit++;
    },
    snapshot:async()=>{requireHeld();calls.snapshot++;return {disposable:true};},
    begin(){requireHeld();calls.begin++;transaction={...inventory};},
    commit(){requireHeld();calls.commit++;transaction=null;},
    rollback(){requireHeld();calls.rollback++;if(transaction){inventory=transaction;transaction=null;}},
    persist:async({primaryMutationLease}={})=>{requireHeld();assert.equal(primaryMutationLease,ctx.lease);calls.persist++;durable={...inventory};if(ackLoss)throw Error('SYNTHETIC_ACK_LOSS');},
    beginSqliteExclusiveWriteWindow(){assert.equal(exclusive,false);if(uncertain)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');exclusive=true;return ({uncertainOutcome=false}={})=>{exclusive=false;if(uncertainOutcome)uncertain=true;};},
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    async withPrimarySqliteMutationLock(fn){calls.lock++;if(uncertain)throw Error('SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');held=true;try{return await fn(ctx.lease);}finally{held=false;}},
    lease:Object.freeze({}),window:{dispatchEvent(){}},CustomEvent:class{},Date,Math,Number,String,JSON,Error,
  };
  ctx.globalThis=ctx;
  vm.runInNewContext(code,ctx,{filename:'manual-editor-production-source',timeout:3000});
  return {save:ctx.saveIngredient,calls,get state(){return {...inventory};},get durable(){return {...durable};},get uncertain(){return uncertain;}};
}
{
  const f=fixture();const out=await f.save('Apple',0);
  assert.equal(out.quantity,0);assert.equal(out.unlocked,1,'zero quantity must preserve unlock UNKNOWN/known');
  assert.equal(f.durable.unlocked,1);assert.equal(f.calls.begin,1);assert.equal(f.calls.commit,1);
  assert.equal(f.calls.persist,1);assert.equal(f.calls.audit,2);assert.equal(f.uncertain,false);
}
{
  const f=fixture({initialUnlock:null});const out=await f.save('Apple',0);
  assert.equal(out.unlocked,null,'UNKNOWN must not become zero');
}
{
  const f=fixture({stale:true});await assert.rejects(f.save('Apple',5),/SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED/);
  assert.equal(f.calls.rows,0);assert.equal(f.calls.sql,0);assert.equal(f.calls.snapshot,0);
  assert.equal(f.uncertain,true,'stale admission must fail closed');
}
{
  const f=fixture({failRun:true});await assert.rejects(f.save('Apple',5),/SYNTHETIC_SQL_FAILURE/);
  assert.equal(f.calls.rollback,1);assert.equal(f.calls.persist,0);
  assert.equal(f.state.quantity,3);assert.equal(f.durable.quantity,3);
}
{
  const f=fixture({ackLoss:true});await assert.rejects(f.save('Apple',5),/SYNTHETIC_ACK_LOSS/);
  assert.equal(f.durable.quantity,5,'postwrite ACK loss must not claim rollback');
  assert.equal(f.uncertain,true);
  await assert.rejects(f.save('Apple',6),/UNVERIFIED_RELOAD_REQUIRED/);
  assert.equal(f.calls.persist,1,'never retry an uncertain write');
}
{
  const f=fixture();await assert.rejects(f.save('Apple',5,0),/不可標記為尚未解鎖/);
  assert.equal(f.calls.lock,0);assert.equal(f.calls.sql,0);
}
console.log('PASS G265_NAMED_INGREDIENT_PRODUCTION_PRE_SQL_ADMISSION_STALE_ROLLBACK_ACK_UNKNOWN');
