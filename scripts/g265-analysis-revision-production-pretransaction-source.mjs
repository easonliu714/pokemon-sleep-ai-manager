// G265 named production analysis-revision writer: source-bound pre-SQL admission.
// Synthetic fixture only. Prior fifth-writer opt-in tests are not production proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/analysis-revision-store.js','utf8');
const anchor='export async function saveAnalysisRevision(';
assert.equal(source.split(anchor).length,2,'exact named production function');
const body=source.split(anchor)[1].split('\nexport {TABLE_SQL}')[0];
assert.match(source,/withPrimarySqliteMutationLock/,'named writer must import native primary lock');
assert.match(body,/beginSqliteExclusiveWriteWindow\(\)/,'reserve same-page exclusive SQL window');
assert.match(body,/withPrimarySqliteMutationLock\(async lease/,'lock before ensure and previous-row read');
assert.match(body,/persist\(\{primaryMutationLease:lease\}\)/,'same lease through durable ACK');
assert.match(body,/withSqliteCoordinatedMutation\(begin\)/,'transaction begins under privileged window');
const executable='async function saveAnalysisRevision('+body+'\nreturn saveAnalysisRevision;';
function fixture({stale=false,noLocks=false,sqlFailure=false,ackLoss=false}={}){
  const calls=[];let held=false,exclusive=false,privileged=0,uncertain=false;
  const durable={writes:0},state={rows:0};
  const lock=()=>assert.equal(held,true,'PRE_SQL_LOCK_VIOLATION');
  const ctx={
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      assert.equal(exclusive,false);exclusive=true;calls.push('window');
      return ({uncertainOutcome=false}={})=>{calls.push('close');exclusive=false;if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');
      if(noLocks)throw Error('SQLITE_PRIMARY_WEB_LOCKS_UNAVAILABLE');
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      held=true;try{return await fn({fixtureLease:true});}finally{held=false;}
    },
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    ensure(){lock();assert.ok(privileged);calls.push('ensure');},
    rows(){lock();calls.push('read');return state.rows?[{analysis_id:'previous',revision_no:1}]:[];},
    uuid(){return 'synthetic-analysis';},
    async snapshot(){lock();calls.push('snapshot');},
    begin(){lock();assert.ok(privileged);calls.push('begin');},
    run(){lock();assert.ok(privileged);calls.push('insert');if(sqlFailure)throw Error('synthetic-insert-aborted');},
    commit(){lock();assert.ok(privileged);calls.push('commit');state.rows=1;},
    rollback(){lock();assert.ok(privileged);calls.push('rollback');},
    async persist(options){
      lock();assert.ok(privileged);assert.equal(options?.primaryMutationLease?.fixtureLease,true);
      calls.push('persist');durable.writes++;if(ackLoss)throw Error('synthetic-postwrite-ack-lost');
    },
    globalThis:{dispatchEvent(){calls.push('event');}},CustomEvent:class{},
  };
  const fn=vm.runInNewContext('(function(){'+executable+'})()',ctx);
  return {fn,calls,durable};
}
const input={imageSha256:'a'.repeat(64),analysisType:'synthetic',result:{safe:true}};
const ok=fixture();const saved=await ok.fn(input);
assert.equal(saved.revision_no,1);assert.equal(ok.durable.writes,1);
assert.deepEqual(ok.calls,['window','lock','ensure','read','snapshot','begin','insert','commit','persist','event','close']);
for(const options of [{stale:true},{noLocks:true}]){
  const f=fixture(options);await assert.rejects(f.fn(input),/SQLITE_PRIMARY_/);
  assert.deepEqual(f.calls,['window','lock','close'],'stale/unsupported lock must reject before SQL');
  assert.equal(f.durable.writes,0);
}
const aborted=fixture({sqlFailure:true});
await assert.rejects(aborted.fn(input),/synthetic-insert-aborted/);
assert.equal(aborted.calls.includes('rollback'),true);
assert.equal(aborted.calls.includes('commit'),false);
assert.equal(aborted.calls.includes('persist'),false);
const lost=fixture({ackLoss:true});
await assert.rejects(lost.fn(input),/synthetic-postwrite-ack-lost/);
assert.equal(lost.durable.writes,1);
await assert.rejects(lost.fn(input),/SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED/);
assert.equal(lost.durable.writes,1,'ACK loss must not be blindly retried');
console.log('PASS G265_ANALYSIS_REVISION_PRODUCTION_LOCK_BEFORE_ENSURE_READ_SNAPSHOT_SQL_ACK');
console.log('PASS G265_ANALYSIS_REVISION_STALE_ROLLBACK_ACK_LOSS_NO_BLIND_RETRY');
