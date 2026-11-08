// G265 named production weekly override: source-bound disposable VM regression.
// Negative-first witness: old saveWeeklyManualOverride snapshots and mutates
// before cross-tab primary admission. No player database or production IDB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/weekly-context-manual-override.js','utf8');
const named=source.split('export async function saveWeeklyManualOverride(')[1]?.split('export async function clearWeeklyManualOverride(')[0];
assert.ok(named,'named production weekly override entry must exist');
const code=source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function fixture({stale=false,sqlFailure=false,ackLoss=false}={}){
  let held=false,exclusive=false,uncertain=false,privileged=0,transaction=null;
  let row=null,durable=null;
  const calls={lock:0,read:0,snapshot:0,begin:0,sql:0,commit:0,rollback:0,persist:0};
  const requireHeld=()=>assert.equal(held,true,'player SQL/snapshot before native primary lock');
  const ctx={
    rows(){requireHeld();calls.read++;return row?[{value_json:row.value_json,updated_at:row.updated_at}]:[];},
    run(sql,params){requireHeld();assert.ok(privileged>0,'SQL must be coordinated');calls.sql++;
      if(sqlFailure)throw Error('SYNTHETIC_WEEKLY_SQL_ABORT');
      assert.match(sql,/INSERT OR REPLACE INTO settings/);
      row={key:params[0],value_json:params[1],updated_at:params[2]};
    },
    snapshot:async()=>{requireHeld();calls.snapshot++;return {synthetic:true};},
    begin(){requireHeld();calls.begin++;transaction=row?{...row}:null;},
    commit(){requireHeld();calls.commit++;transaction=null;},
    rollback(){requireHeld();calls.rollback++;row=transaction;},
    persist:async({primaryMutationLease}={})=>{
      requireHeld();assert.equal(primaryMutationLease,ctx.lease,'durable ACK must use held lease');
      calls.persist++;durable=row?{...row}:null;
      if(ackLoss)throw Error('SYNTHETIC_WEEKLY_POSTWRITE_ACK_LOSS');
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
    lease:Object.freeze({}),localIso:()=> '2026-11-08T17:00:00+08:00',
    Date,Math,Number,String,JSON,Object,Array,Error
  };
  vm.runInNewContext(code,ctx,{filename:'weekly-override-production',timeout:3000});
  return {save:ctx.saveWeeklyManualOverride,calls,get row(){return row;},get durable(){return durable;},get uncertain(){return uncertain;}};
}
const input={weekStart:'2026-11-02',basedOnImportRevision:'REV-SYNTHETIC-1',
  fields:{camp:'synthetic',pot_size:42,untrusted_field:'must-drop'}};
{
  const f=fixture();
  const result=await f.save(input);
  assert.equal(result.fields.camp,'synthetic');
  assert.equal(result.fields.untrusted_field,undefined);
  assert.equal(f.calls.lock,1);
  assert.equal(f.calls.snapshot,1);
  assert.equal(f.calls.begin,1);
  assert.equal(f.calls.commit,1);
  assert.equal(f.calls.persist,1);
  assert.equal(JSON.parse(f.durable.value_json).fields.pot_size,42);
  assert.equal(f.uncertain,false);
}
{
  const f=fixture({stale:true});
  await assert.rejects(f.save(input),/STALE_REVISION/);
  assert.equal(f.calls.snapshot,0);
  assert.equal(f.calls.sql,0);
  assert.equal(f.calls.persist,0);
  assert.equal(f.uncertain,true);
}
{
  const f=fixture({sqlFailure:true});
  await assert.rejects(f.save(input),/SYNTHETIC_WEEKLY_SQL_ABORT/);
  assert.equal(f.calls.rollback,1);
  assert.equal(f.calls.persist,0);
  assert.equal(f.durable,null);
}
{
  const f=fixture({ackLoss:true});
  await assert.rejects(f.save(input),/SYNTHETIC_WEEKLY_POSTWRITE_ACK_LOSS/);
  assert.equal(JSON.parse(f.durable.value_json).fields.camp,'synthetic');
  assert.equal(f.uncertain,true);
  await assert.rejects(f.save(input),/UNVERIFIED_RELOAD_REQUIRED/);
  assert.equal(f.calls.persist,1,'ACK loss must not retry');
}
{
  const f=fixture();
  await assert.rejects(f.save({...input,basedOnImportRevision:''}),/revision/);
  assert.equal(f.calls.lock,0);
  assert.equal(f.calls.sql,0);
}
assert.match(named,/beginSqliteExclusiveWriteWindow\(\)/);
assert.match(named,/withPrimarySqliteMutationLock\(async lease/);
assert.match(named,/persist\(\{primaryMutationLease:lease\}\)/);
console.log('PASS G265_WEEKLY_OVERRIDE_NAMED_PRE_SQL_STALE_ROLLBACK_ACK_LOSS');
