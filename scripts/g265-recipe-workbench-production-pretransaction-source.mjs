// G265: exact named production Recipe Unified Workbench admission, negative-first.
// Synthetic-only VM: no production player DB, no Android or opt-in adapter wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/recipe-unified-player-workbench.js','utf8');
const start='async function saveRecipeState(row,{unlocked,level,energy}){';
const end='\nfunction bindTable(';
assert.equal(source.split(start).length,2,'named recipe writer identity');
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(source,/import \{withPrimarySqliteMutationLock\} from '\.\/storage\.js'/,'production primary Web Lock import required');
assert.match(operation,/beginSqliteExclusiveWriteWindow\(\)/,'same-page exclusive window before SQL');
assert.match(operation,/withPrimarySqliteMutationLock\(async lease/,'cross-tab admission before dbReady and previous-row read');
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/,'exact lease through durable ACK');
assert.match(operation,/withSqliteCoordinatedMutation\(begin\)/,'BEGIN must be privileged');
assert.match(operation,/INSERT INTO import_batches/);
assert.match(operation,/INSERT INTO import_changes/);

function fixture({stale=false,noLocks=false,failAudit=false,ackLoss=false}={}){
  const calls=[];let held=false,privileged=0,uncertain=false,committed=false;
  let persisted=0;
  const requireLock=()=>assert.equal(held,true,'PRE_SQL_PRIMARY_LOCK_REQUIRED');
  const ctx={
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      calls.push('window');
      return ({uncertainOutcome=false}={})=>{calls.push('close');if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');
      if(noLocks)throw Error('SQLITE_PRIMARY_WEB_LOCKS_UNAVAILABLE');
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      held=true;try{return await fn({testLease:true});}finally{held=false;}
    },
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    dbReady(){requireLock();calls.push('ready');return true;},
    rows(sql){
      requireLock();calls.push('read');
      return sql.includes('SELECT * FROM recipes')&&committed?[{recipe_id:'synthetic'}]:[];
    },
    async snapshot(reason){requireLock();assert.equal(reason,'manual:recipe:synthetic');calls.push('snapshot');},
    begin(){requireLock();assert.ok(privileged);calls.push('begin');},
    run(sql){
      requireLock();assert.ok(privileged);calls.push(sql.includes('import_batches')?'batch':sql.includes('import_changes')?'change':'recipe');
      if(failAudit&&sql.includes('import_changes'))throw Error('SYNTHETIC_AUDIT_INSERT_ABORT');
    },
    commit(){requireLock();assert.ok(privileged);calls.push('commit');committed=true;},
    rollback(){requireLock();assert.ok(privileged);calls.push('rollback');},
    async persist(options){
      requireLock();assert.ok(privileged);
      assert.equal(options?.primaryMutationLease?.testLease,true);
      calls.push('persist');persisted++;
      if(ackLoss)throw Error('SYNTHETIC_POSTWRITE_ACK_LOST');
    },
    localIso:()=> '2026-11-09T09:55:00+08:00',
    Date:{now:()=>1794190000000},Math:{random:()=>0.125},
    JSON,Number,String,Promise,Error,console
  };
  const save=vm.runInNewContext('(function(){'+operation+'\nreturn saveRecipeState;})()',ctx);
  return {save,calls,get persisted(){return persisted;}};
}
const row={recipe_id:'synthetic',category:'fixture',recipe_name:'fixture',total_ingredients:1};
const options={unlocked:true,level:2,energy:20};
const ok=fixture();await ok.save(row,options);
assert.equal(ok.persisted,1);
assert.deepEqual(ok.calls,['window','lock','ready','read','snapshot','begin','recipe','read','batch','change','commit','persist','close']);
for(const mode of [{stale:true},{noLocks:true}]){
  const f=fixture(mode);await assert.rejects(f.save(row,options),/SQLITE_PRIMARY_/);
  assert.deepEqual(f.calls,['window','lock','close'],'stale/no-lock must have zero SQL reads and writes');
  assert.equal(f.persisted,0);
}
const failed=fixture({failAudit:true});
await assert.rejects(failed.save(row,options),/SYNTHETIC_AUDIT_INSERT_ABORT/);
assert.ok(failed.calls.includes('rollback'));
assert.ok(!failed.calls.includes('commit')&&!failed.calls.includes('persist'));
const lost=fixture({ackLoss:true});
await assert.rejects(lost.save(row,options),/SYNTHETIC_POSTWRITE_ACK_LOST/);
assert.equal(lost.persisted,1);
assert.ok(!lost.calls.includes('rollback'),'never roll back post-COMMIT uncertain ACK');
await assert.rejects(lost.save(row,options),/SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED/);
assert.equal(lost.persisted,1,'no blind retry');
console.log('PASS G265_RECIPE_WORKBENCH_PRODUCTION_LOCK_BEFORE_READY_READ_SNAPSHOT_SQL_ACK');
console.log('PASS G265_RECIPE_WORKBENCH_STALE_ROLLBACK_ACK_LOSS_NO_BLIND_RETRY');
