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
async function scenario({authorityChanged=false,ackLost=false}={}){
  const events=[];
  const admitted=authorityChanged?{...current,authority_revision:'r2'}:{...current};
  const ctx={
    beginSqliteExclusiveWriteWindow:()=>{events.push('window');return x=>events.push('close:'+x.uncertainOutcome);},
    withPrimarySqliteMutationLock:async fn=>{events.push('lease');return fn('LEASE');},
    currentWeeklyContext:()=>admitted,
    hasImportedAuthority:x=>x?.field_sources?.pot_size==='IMPORTED',
    typedValue:(_k,v)=>v,
    snapshot:async()=>{events.push('snapshot');},
    withSqliteCoordinatedMutation:fn=>typeof fn==='function'?fn():fn,
    begin:()=>events.push('begin'),
    commit:()=>events.push('commit'),
    rollback:()=>events.push('rollback'),
    writeAccountPotCapacity:()=>events.push('write'),
    persist:async x=>{assert.equal(x.primaryMutationLease,'LEASE');events.push('persist');if(ackLost)throw Error('ACK_LOST_AFTER_COMMIT');}
  };
  vm.runInNewContext(actual+'\nthis.productionSave=saveAccountPotCapacity;',ctx);
  let error=null;
  try{await ctx.productionSave(edit,current);}catch(e){error=e;}
  return {events,error};
}
const stale=await scenario({authorityChanged:true});
assert.match(stale.error?.message??'',/ACCOUNT_POT_IMPORTED_AUTHORITY_RELOAD_REQUIRED/);
assert.deepEqual(stale.events,['window','lease','close:true'],'stale imported authority must cause zero SQL');
const normal=await scenario();
assert.equal(normal.error,null);
assert.deepEqual(normal.events,['window','lease','snapshot','begin','write','commit','persist','close:false']);
const lost=await scenario({ackLost:true});
assert.match(lost.error?.message??'',/ACK_LOST_AFTER_COMMIT/);
assert.deepEqual(lost.events,['window','lease','snapshot','begin','write','commit','persist','close:true']);
assert.equal(lost.events.filter(x=>x==='persist').length,1,'never blind retry uncertain ACK');
console.log('PASS_G265_ACCOUNT_POT_REAL_PRODUCTION_FUNCTION_BEHAVIOR_NODE');
console.log('HOLD_G265_NATIVE_CHROMIUM_IDB_DURABLE_ACK_NOT_VERIFIED');
