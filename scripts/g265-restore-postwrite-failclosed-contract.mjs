// G265: exact production restore handler, synthetic-only post-write recovery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('assets/js/backup-truth-restore.js','utf8');
const begin = source.indexOf('async function commitRestore() {');
const end = source.indexOf('\nasync function install() {',begin);
assert.ok(begin >= 0 && end > begin,'exact restore handler must be present');
const handler = source.slice(begin,end);
assert.match(source,/getSqlitePersistStatus/);
assert.match(handler,/restoreRecoveryHold = true/);
assert.doesNotMatch(handler,/\bawait\s+replaceDatabase\(before\)/,'post-write failure must never trigger unadmitted second replacement');

const expected = {integrity_ok:true,foreign_key_errors:[],database_sha256:'expected',
  table_counts:{pokemon:2}};
function fixture({failReplace=false,uncertain=false,mismatch=false,failSnapshot=false}={}){
  const state={replacements:0,snapshots:0,events:0,reports:0,bytes:'original'};
  const context=vm.createContext({
    staged:{bytes:new Uint8Array([2]),report:expected},
    restoreRecoveryHold:false,
    snapshot:async()=>{state.snapshots++;if(failSnapshot)throw Error('synthetic_snapshot_failed');},
    replaceDatabase:async()=>{state.replacements++;state.bytes='candidate';
      if(failReplace)throw Error('synthetic_post_commit_ack_loss');},
    exportBytes:()=>new Uint8Array([state.bytes==='candidate'?2:1]),
    inspectBytes:async()=>({...expected,database_sha256:mismatch?'wrong':'expected'}),
    getSqlitePersistStatus:()=>({status:uncertain?'UNVERIFIED_RELOAD_REQUIRED':'READY'}),
    renderReport:()=>{state.reports++;},
    window:{dispatchEvent:()=>{state.events++;}},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
    Error,Object,Uint8Array
  });
  vm.runInContext(handler,context,{timeout:3000});
  return {context,state};
}
{
  const {context,state}=fixture();
  await context.commitRestore();
  assert.equal(state.snapshots,1);
  assert.equal(state.replacements,1);
  assert.equal(state.events,1);
  assert.equal(state.reports,1);
  assert.equal(context.restoreRecoveryHold,false);
  console.log('PASS G265_RESTORE_VERIFIED_SINGLE_WRITE');
}
for(const scenario of [
  {name:'ACK_LOSS',opts:{failReplace:true,uncertain:true},status:'UNVERIFIED_RELOAD_REQUIRED'},
  {name:'POSTWRITE_SHA_MISMATCH',opts:{mismatch:true},status:'READY'}
]){
  const {context,state}=fixture(scenario.opts);
  await assert.rejects(context.commitRestore(),error=>
    error.code==='RESTORE_POSTWRITE_REVIEW_REQUIRED'
    &&error.persist_status===scenario.status
    &&/禁止自動回寫舊資料/.test(error.message));
  assert.equal(state.replacements,1,scenario.name+': no second durable write');
  assert.equal(state.events,0,scenario.name+': no false success event');
  assert.equal(context.restoreRecoveryHold,true,scenario.name+': sticky hold');
  await assert.rejects(context.commitRestore(),error=>error.code==='RESTORE_RECOVERY_HOLD_RELOAD_REQUIRED');
  assert.equal(state.replacements,1,scenario.name+': no retry');
  console.log('PASS G265_RESTORE_'+scenario.name+'_NO_AUTO_REWRITE_STICKY_HOLD');
}
{
  const {context,state}=fixture({failSnapshot:true});
  await assert.rejects(context.commitRestore(),/synthetic_snapshot_failed/);
  assert.equal(state.replacements,0,'failed pretransaction snapshot cannot replace');
  assert.equal(state.events,0);
  console.log('PASS G265_RESTORE_PRETRANSACTION_SNAPSHOT_FAILURE_NO_WRITE');
}
{
  const {context,state}=fixture();
  context.staged=null;
  await assert.rejects(context.commitRestore(),/Preflight/);
  assert.equal(state.replacements,0);
  console.log('PASS G265_RESTORE_MISSING_PREFLIGHT_NO_WRITE');
}
console.log('G265_RESTORE_POSTWRITE_FAIL_CLOSED_SYNTHETIC_PASS; HOLD_PRODUCTION_ALL_WRITER_ADMISSION');
