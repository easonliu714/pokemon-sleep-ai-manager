// G265: production clearWeeklyManualOverride must own the primary Web Lock
// before read/no-op decision, snapshot, SQL DELETE, and durable ACK.
// Source-bound disposable VM: no player SQLite, IDB, or opt-in adapter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/weekly-context-manual-override.js','utf8');
const named=source.split('export async function clearWeeklyManualOverride(')[1];
assert.ok(named,'named production clear entry must exist');
const code=source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const week='2026-11-02';
const key='weekly_context_manual_override:'+week;
const oldRecord={schema:'weekly-context-manual-override/1.0',week_start:week,
  based_on_import_revision:'REV-1',fields:{camp:'synthetic',pot_size:null}};
function fixture({stale=false,missing=false,sqlFailure=false,ackLoss=false}={}){
  let held=false,exclusive=false,uncertain=false,privileged=0;
  let row=missing?null:{value_json:JSON.stringify(oldRecord),updated_at:'2026-11-08'};
  let transaction=null,durable=row?{...row}:null;
  const calls={lock:0,read:0,snapshot:0,begin:0,sql:0,commit:0,rollback:0,persist:0};
  const requireHeld=()=>assert.equal(held,true,'pre-SQL primary lock admission required');
  const ctx={
    rows(sql,params){calls.read++;requireHeld();
      assert.match(sql,/SELECT value_json,updated_at FROM settings/);
      assert.equal(params[0],key);
      return row?[{...row}]:[];
    },
    run(sql,params){requireHeld();assert.ok(privileged>0,'coordinated SQL required');
      calls.sql++;assert.match(sql,/DELETE FROM settings/);
      assert.equal(params[0],key);
      if(sqlFailure)throw Error('SYNTHETIC_DELETE_ABORT');
      row=null;
    },
    snapshot:async()=>{requireHeld();calls.snapshot++;return {disposable:true};},
    begin(){requireHeld();calls.begin++;transaction=row?{...row}:null;},
    commit(){requireHeld();calls.commit++;transaction=null;},
    rollback(){requireHeld();calls.rollback++;row=transaction;},
    persist:async({primaryMutationLease}={})=>{
      requireHeld();assert.equal(primaryMutationLease,ctx.lease,'held lease must reach ACK');
      calls.persist++;durable=row?{...row}:null;
      if(ackLoss)throw Error('SYNTHETIC_POSTWRITE_ACK_LOSS');
    },
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      assert.equal(exclusive,false);exclusive=true;
      return ({uncertainOutcome=false}={})=>{exclusive=false;if(uncertainOutcome)uncertain=true;};
    },
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    async withPrimarySqliteMutationLock(fn){
      calls.lock++;
      if(uncertain)throw Error('SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      held=true;try{return await fn(ctx.lease);}finally{held=false;}
    },
    lease:Object.freeze({}),localIso:()=> '2026-11-08T18:00:00+08:00',
    Date,Math,Number,String,JSON,Object,Array,Error
  };
  vm.runInNewContext(code,ctx,{filename:'weekly-clear-production',timeout:3000});
  return {clear:ctx.clearWeeklyManualOverride,calls,get row(){return row;},
    get durable(){return durable;},get uncertain(){return uncertain;}};
}
{
  const f=fixture();
  assert.equal(await f.clear(week),true);
  assert.equal(f.calls.lock,1);
  assert.equal(f.calls.read,1);
  assert.equal(f.calls.snapshot,1);
  assert.equal(f.calls.begin,1);
  assert.equal(f.calls.sql,1);
  assert.equal(f.calls.commit,1);
  assert.equal(f.calls.persist,1);
  assert.equal(f.row,null);
  assert.equal(f.durable,null);
  assert.equal(f.uncertain,false);
}
{
  const f=fixture({missing:true});
  assert.equal(await f.clear(week),false,'missing row is an admitted no-op');
  assert.equal(f.calls.lock,1,'no-op decision cannot bypass cross-tab admission');
  assert.equal(f.calls.read,1);
  assert.equal(f.calls.snapshot,0);
  assert.equal(f.calls.sql,0);
  assert.equal(f.calls.persist,0);
  assert.equal(f.uncertain,false);
}
{
  const f=fixture({stale:true});
  await assert.rejects(f.clear(week),/STALE_REVISION/);
  assert.equal(f.calls.read,0,'stale tab cannot even decide no-op from old SQL');
  assert.equal(f.calls.snapshot,0);
  assert.equal(f.calls.sql,0);
  assert.equal(f.calls.persist,0);
  assert.equal(f.uncertain,true);
}
{
  const f=fixture({sqlFailure:true});
  await assert.rejects(f.clear(week),/SYNTHETIC_DELETE_ABORT/);
  assert.equal(f.calls.rollback,1);
  assert.equal(f.calls.persist,0);
  assert.ok(f.row&&f.durable,'SQL rollback retains original row');
}
{
  const f=fixture({ackLoss:true});
  await assert.rejects(f.clear(week),/SYNTHETIC_POSTWRITE_ACK_LOSS/);
  assert.equal(f.durable,null,'postwrite ACK loss cannot be called rollback');
  assert.equal(f.uncertain,true);
  await assert.rejects(f.clear(week),/UNVERIFIED_RELOAD_REQUIRED/);
  assert.equal(f.calls.persist,1,'uncertain writer cannot retry');
}
assert.match(named,/beginSqliteExclusiveWriteWindow\(\)/);
assert.match(named,/withPrimarySqliteMutationLock\(async lease/);
assert.match(named,/persist\(\{primaryMutationLease:lease\}\)/);
console.log('PASS G265_WEEKLY_CLEAR_NAMED_PRE_SQL_STALE_NOOP_ROLLBACK_ACK_LOSS');
