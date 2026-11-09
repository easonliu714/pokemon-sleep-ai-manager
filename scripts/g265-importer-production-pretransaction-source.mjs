// G265 named production importer pre-SQL admission. Disposable VM only.
// This source-bound negative must fail before production admission is installed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/importer.js','utf8');
const start='export async function applyPayload(payload) {';
const helper='function write(entity, key, data, mode) {';
assert.equal(source.split(start).length,2,'unique production applyPayload');
assert.equal(source.split(helper).length,2,'unique production SQL write helper');
assert.match(source,/import \{withPrimarySqliteMutationLock\} from '\.\/storage\.js'/,
  'G265 production importer must acquire native primary Web Lock');
assert.match(source,/beginSqliteExclusiveWriteWindow/,'same-page SQL reservation');
const operation=source.slice(source.indexOf(helper)).replace(/^export /gm,'');
assert.match(operation,/withPrimarySqliteMutationLock\(async lease/,'lock before dryRun and SQL');
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/,'same lease through durable ACK');
assert.match(operation,/withSqliteCoordinatedMutation/,'privileged SQL only inside exclusive window');
function fixture({stale=false,noLocks=false,failAudit=false,ackLoss=false}={}){
  const calls=[];let locked=false,privileged=0,uncertain=false,transaction=false,ack=0;
  const check=()=>assert.equal(locked,true,'G265_PRE_SQL_NATIVE_LOCK_REQUIRED');
  const ctx={
    KEYS:{settings:['key']},quote:s=>'"'+String(s).replaceAll('"','""')+'"',
    CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_ONLY',
    localIso:()=> '2026-11-09T15:00:00+08:00',
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      calls.push('window');
      return ({uncertainOutcome=false}={})=>{calls.push('close');if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');
      if(noLocks)throw Error('SQLITE_PRIMARY_WEB_LOCKS_REQUIRED');
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      locked=true;try{return await fn({testLease:true});}finally{locked=false;}
    },
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    dryRun(payload){
      check();calls.push('preview');
      assert.equal(payload.operations.length,1);
      return {conflict_count:0,changes:[{
        effective_action:'insert',key:{key:'synthetic'},data:{value:'synthetic'},
        before:null,after:{key:'synthetic',value:'synthetic'},message:'',candy_storage:null
      }],audit_summary:{},visual_preflight:{status:'SYNTHETIC'}};
    },
    async snapshot(reason){check();assert.equal(reason,'before:synthetic_update');calls.push('snapshot');},
    begin(){check();assert.ok(privileged);transaction=true;calls.push('begin');},
    run(sql){
      check();assert.ok(privileged);assert.equal(transaction,true);
      const type=sql.includes('import_changes')?'change':sql.includes('import_batches')?'batch':'write';
      calls.push(type);if(failAudit&&type==='change')throw Error('SYNTHETIC_AUDIT_FAILURE');
    },
    commit(){check();assert.ok(privileged);assert.ok(transaction);transaction=false;calls.push('commit');},
    rollback(){check();assert.ok(privileged);transaction=false;calls.push('rollback');},
    async persist(opts){
      check();assert.ok(privileged);assert.equal(transaction,false);
      assert.equal(opts?.primaryMutationLease?.testLease,true);
      calls.push('persist');ack++;if(ackLoss)throw Error('SYNTHETIC_ACK_LOST_AFTER_COMMIT');
    },
    JSON,Object,Promise,Error,Number,String,Map,Set,console
  };
  const apply=vm.runInNewContext('(function(){'+operation+';return applyPayload;})()',ctx);
  return {apply,calls,get ack(){return ack;}};
}
const payload={schema_version:'synthetic',update_id:'synthetic_update',
  generated_at:'2026-11-09T15:00:00+08:00',source:'synthetic',
  operations:[{entity:'settings',action:'insert',key:{key:'synthetic'},data:{value:'synthetic'}}]};
const ok=fixture();assert.equal((await ok.apply(payload)).operation_count,1);
assert.deepEqual(ok.calls,['window','lock','preview','snapshot','begin','write','change','batch','commit','persist','close']);
for(const mode of [{stale:true},{noLocks:true}]){
  const f=fixture(mode);await assert.rejects(f.apply(payload),/SQLITE_PRIMARY_/);
  assert.deepEqual(f.calls,['window','lock','close'],'stale/no locks: zero preview, snapshot, SQL, persist');
}
const fail=fixture({failAudit:true});await assert.rejects(fail.apply(payload),/SYNTHETIC_AUDIT_FAILURE/);
assert.ok(fail.calls.includes('rollback'));assert.ok(!fail.calls.includes('commit')&&!fail.calls.includes('persist'));
const lost=fixture({ackLoss:true});await assert.rejects(lost.apply(payload),/SYNTHETIC_ACK_LOST_AFTER_COMMIT/);
assert.equal(lost.ack,1);assert.ok(!lost.calls.includes('rollback'));
await assert.rejects(lost.apply(payload),/SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED/);
assert.equal(lost.ack,1,'no blind retry after uncertain durable ACK');
console.log('PASS G265_IMPORTER_PRODUCTION_PRE_SQL_NATIVE_LOCK_SNAPSHOT_AUDIT_DURABLE_ACK');
console.log('PASS G265_IMPORTER_STALE_ZERO_SQL_ROLLBACK_ACK_LOSS_STICKY_HOLD');