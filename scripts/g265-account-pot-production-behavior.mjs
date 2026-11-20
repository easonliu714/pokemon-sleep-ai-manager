// G265 #861: execute the unmodified production account-pot writer with isolated dependencies.
// This Node behavior regression is supplemental; it is NOT native Chromium/IDB evidence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../assets/js/weekly-context-ui-bridge.js',import.meta.url),'utf8');
const start=source.indexOf('async function saveAccountPotCapacity(');
const end=source.indexOf('\nasync function saveFallback(',start);
assert.ok(start>=0&&end>start,'ACCOUNT_POT_PRODUCTION_FUNCTION_BOUNDARY_MISSING');
const actual=source.slice(start,end);
const current={week_start:'2026-11-16',authority_revision:'r1',authority_context_id:'import-1',pot_size:57,field_sources:{pot_size:'IMPORTED'}};
const edit={needsAccountWrite:true,changed:true,source:'MANUAL_WEEKLY_CONTEXT_UI',value:60};
async function scenario({authorityChanged=false,authorityField=null,invalidEditSource=false,ackLost=false,leaseDenied=false,sqlWriteFails=false,commitFails=false,snapshotFails=false,retryAfterAckLoss=false}={}){
  const events=[];
  let sticky=false;
  const admitted=authorityChanged?{...current,authority_revision:'r2'}:{...current};
  if(authorityField==='context')admitted.authority_context_id='import-2';
  if(authorityField==='week')admitted.week_start='2026-11-23';
  if(authorityField==='pot')admitted.pot_size=58;
  if(authorityField==='source')admitted.field_sources={pot_size:'MANUAL'};
  const candidate=invalidEditSource?{...edit,source:'IMPORTED'}:edit;
  const ctx={
    beginSqliteExclusiveWriteWindow:()=>{if(sticky)throw Error('SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED');events.push('window');return x=>{events.push('close:'+x.uncertainOutcome);if(x.uncertainOutcome)sticky=true;};},
    withPrimarySqliteMutationLock:async fn=>{events.push('lease');if(leaseDenied)throw Error('NATIVE_LEASE_DENIED');return fn('LEASE');},
    currentWeeklyContext:()=>admitted,
    hasImportedAuthority:x=>x?.field_sources?.pot_size==='IMPORTED',
    typedValue:(_k,v)=>v,
    snapshot:async()=>{events.push('snapshot');if(snapshotFails)throw Error('SNAPSHOT_FAILED');},
    withSqliteCoordinatedMutation:fn=>typeof fn==='function'?fn():fn,
    begin:()=>events.push('begin'),
    commit:()=>{events.push('commit');if(commitFails)throw Error('SQL_COMMIT_FAILED');},
    rollback:()=>events.push('rollback'),
    writeAccountPotCapacity:()=>{events.push('write');if(sqlWriteFails)throw Error('SQL_WRITE_FAILED');},
    persist:async x=>{assert.equal(x.primaryMutationLease,'LEASE');events.push('persist');if(ackLost)throw Error('ACK_LOST_AFTER_COMMIT');}
  };
  vm.runInNewContext(actual+'\nthis.productionSave=saveAccountPotCapacity;',ctx);
  let error=null;
  try{await ctx.productionSave(candidate,current);}catch(e){error=e;}
  let retryError=null;
  if(retryAfterAckLoss){
    // The same page must reject a second attempt before native lease, snapshot or SQL.
    try{await ctx.productionSave(candidate,current);}catch(e){retryError=e;}
  }
  return {events,error,retryError};
}
const stale=await scenario({authorityChanged:true});
assert.match(stale.error?.message??'',/ACCOUNT_POT_IMPORTED_AUTHORITY_RELOAD_REQUIRED/);
assert.deepEqual(stale.events,['window','lease','close:true'],'stale imported authority must cause zero SQL');
// Regression: every imported-authority identity dimension and edit-source provenance
// must be revalidated under the native lease BEFORE snapshot or SQL, not just revision.
for(const field of ['context','week','pot','source']){
  const mismatch=await scenario({authorityField:field});
  assert.match(mismatch.error?.message??'',/ACCOUNT_POT_IMPORTED_AUTHORITY_RELOAD_REQUIRED/,`authority ${field} must reject`);
  assert.deepEqual(mismatch.events,['window','lease','close:true'],`authority ${field} must be zero SQL`);
}
const wrongSource=await scenario({invalidEditSource:true});
assert.match(wrongSource.error?.message??'',/ACCOUNT_POT_EDIT_SOURCE_RELOAD_REQUIRED/);
assert.deepEqual(wrongSource.events,['window','lease','close:true'],'wrong edit provenance must be zero SQL');
const normal=await scenario();
assert.equal(normal.error,null);
assert.deepEqual(normal.events,['window','lease','snapshot','begin','write','commit','persist','close:false']);
const lost=await scenario({ackLost:true,retryAfterAckLoss:true});
assert.match(lost.error?.message??'',/ACK_LOST_AFTER_COMMIT/);
assert.deepEqual(lost.events,['window','lease','snapshot','begin','write','commit','persist','close:true']);
assert.equal(lost.events.filter(x=>x==='persist').length,1,'never blind retry uncertain ACK');
assert.match(lost.retryError?.message??'',/SQLITE_PERSIST_UNCERTAIN_RELOAD_REQUIRED/);
assert.deepEqual(lost.events,['window','lease','snapshot','begin','write','commit','persist','close:true'],
  'same-page retry after ACK loss must be denied before lease/snapshot/SQL');
// Negative-first: denial must precede snapshot/SQL, and a failed SQL write must
// roll back its open transaction without issuing a durable persist.
const denied=await scenario({leaseDenied:true});
assert.match(denied.error?.message??'',/NATIVE_LEASE_DENIED/);
assert.deepEqual(denied.events,['window','lease','close:true'],'lease denial must be zero SQL');
const rolledBack=await scenario({sqlWriteFails:true});
assert.match(rolledBack.error?.message??'',/SQL_WRITE_FAILED/);
assert.deepEqual(rolledBack.events,['window','lease','snapshot','begin','write','rollback','close:true'],'failed SQL must rollback without persist');
// A snapshot failure must not start SQL; a COMMIT failure must roll back
// and must never claim durable success or invoke the IDB persist boundary.
const snapshotDenied=await scenario({snapshotFails:true});
assert.match(snapshotDenied.error?.message??'',/SNAPSHOT_FAILED/);
assert.deepEqual(snapshotDenied.events,['window','lease','snapshot','close:true'],'snapshot rejection must be pre-SQL');
const commitDenied=await scenario({commitFails:true});
assert.match(commitDenied.error?.message??'',/SQL_COMMIT_FAILED/);
assert.deepEqual(commitDenied.events,['window','lease','snapshot','begin','write','commit','rollback','close:true'],
  'failed COMMIT must rollback without durable persist');
console.log('PASS_G265_ACCOUNT_POT_REAL_PRODUCTION_FUNCTION_BEHAVIOR_NODE');
console.log('HOLD_G265_NATIVE_CHROMIUM_IDB_DURABLE_ACK_NOT_VERIFIED');
