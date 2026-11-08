// G265: exact production manual-editor::saveItem admission, disposable VM only.
// Negative-first: legacy direct SQL must fail this source-bound test until repaired.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const raw=fs.readFileSync('assets/js/manual-editor.js','utf8');
const named=raw.split('export async function saveItem(')[1]?.split('// G265: one named production writer')[0];
assert.ok(named,'exact named manual item writer must exist');
assert.match(named,/beginSqliteExclusiveWriteWindow\(\)/,'item must reserve same-page SQL window');
assert.match(named,/withPrimarySqliteMutationLock\(async lease/,'item must acquire primary revision before SQL');
assert.match(named,/persist\(\{primaryMutationLease:lease\}\)/,'item ACK must reuse exact held lease');
assert.match(named,/withSqliteCoordinatedMutation\(begin\)/);
assert.match(named,/withSqliteCoordinatedMutation\(commit\)/);
const code=raw.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function fixture({stale=false,failSql=false,ackLoss=false}={}){
  let held=false,exclusive=false,uncertain=false,privileged=0,transaction=null;
  let item={item_name:'SEED',quantity:3,safe_reserve:1,recommendation:'original'};
  let durable={...item};
  const calls={read:0,sql:0,snapshot:0,begin:0,commit:0,rollback:0,persist:0,lock:0,audit:0};
  const requireHeld=()=>assert.equal(held,true,'player SQL must not execute before primary lock');
  const ctx={
    localIso:()=> '2026-11-08T00:00:00+08:00',
    rows(sql){requireHeld();calls.read++;
      if(sql.includes('item_master'))return [{item_name:'SEED'}];
      if(sql.includes('item_inventory'))return [{...item}];
      return [];
    },
    run(sql,params=[]){requireHeld();assert.ok(privileged>0,'SQL must be coordinated');calls.sql++;
      if(sql.startsWith('INSERT INTO item_inventory')){
        if(failSql)throw Error('SYNTHETIC_ITEM_SQL_FAILURE');
        item={item_name:params[0],quantity:params[1],safe_reserve:params[2],recommendation:params[3]};
      }else if(sql.startsWith('INSERT INTO import_'))calls.audit++;
    },
    snapshot:async()=>{requireHeld();calls.snapshot++;return {disposable:true};},
    begin(){requireHeld();calls.begin++;transaction={...item};},
    commit(){requireHeld();calls.commit++;transaction=null;},
    rollback(){requireHeld();calls.rollback++;if(transaction){item=transaction;transaction=null;}},
    persist:async({primaryMutationLease}={})=>{requireHeld();assert.equal(primaryMutationLease,ctx.lease);
      calls.persist++;durable={...item};if(ackLoss)throw Error('SYNTHETIC_ITEM_ACK_LOSS');
    },
    beginSqliteExclusiveWriteWindow(){if(uncertain)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      assert.equal(exclusive,false);exclusive=true;
      return ({uncertainOutcome=false}={})=>{exclusive=false;if(uncertainOutcome)uncertain=true;};
    },
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    async withPrimarySqliteMutationLock(fn){calls.lock++;
      if(uncertain)throw Error('SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      held=true;try{return await fn(ctx.lease);}finally{held=false;}
    },
    lease:Object.freeze({}),window:{dispatchEvent(){}},CustomEvent:class{},
    Date,Math,Number,String,JSON,Error
  };
  ctx.globalThis=ctx;
  vm.runInNewContext(code,ctx,{filename:'manual-item-production-source',timeout:3000});
  return {save:ctx.saveItem,calls,get item(){return {...item};},get durable(){return {...durable};},get uncertain(){return uncertain;}};
}
{
  const f=fixture();const out=await f.save('SEED',7,2,'new');
  assert.equal(out.quantity,7);assert.equal(f.durable.quantity,7);
  assert.equal(f.calls.begin,1);assert.equal(f.calls.commit,1);
  assert.equal(f.calls.persist,1);assert.equal(f.calls.audit,2);assert.equal(f.uncertain,false);
}
{
  const f=fixture({stale:true});await assert.rejects(f.save('SEED',7,2,'new'),/STALE_REVISION/);
  assert.equal(f.calls.read,0);assert.equal(f.calls.sql,0);assert.equal(f.calls.snapshot,0);
  assert.equal(f.uncertain,true);
}
{
  const f=fixture({failSql:true});await assert.rejects(f.save('SEED',7,2,'new'),/SYNTHETIC_ITEM_SQL_FAILURE/);
  assert.equal(f.calls.rollback,1);assert.equal(f.calls.persist,0);
  assert.equal(f.item.quantity,3);assert.equal(f.durable.quantity,3);
}
{
  const f=fixture({ackLoss:true});await assert.rejects(f.save('SEED',7,2,'new'),/SYNTHETIC_ITEM_ACK_LOSS/);
  assert.equal(f.durable.quantity,7,'postwrite uncertain cannot be called rollback');
  assert.equal(f.uncertain,true);
  await assert.rejects(f.save('SEED',8,2,'retry'),/UNVERIFIED_RELOAD_REQUIRED/);
  assert.equal(f.calls.persist,1);
}
{
  const f=fixture();await assert.rejects(f.save('SEED',-1,2,'invalid'),/0 以上整數/);
  assert.equal(f.calls.lock,0);assert.equal(f.calls.sql,0);
}
console.log('PASS G265_MANUAL_ITEM_PRODUCTION_PRE_SQL_ADMISSION_STALE_ROLLBACK_ACK_LOSS');
