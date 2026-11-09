// G265 named weekly fallback: source-bound production pre-SQL native admission.
// Synthetic VM only. Never read or write player SQLite, Android, or Public Master.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/weekly-context-ui-bridge.js','utf8');
const start='async function saveFallback(form,current,potEdit){';
const end='\nfunction emitEntityChanged(';
assert.equal(source.split(start).length,2,'one named fallback writer');
assert.equal(source.split(end).length,2,'stable fallback boundary');
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(source,/import \{withPrimarySqliteMutationLock\} from '\.\/storage\.js'/,
  'production fallback must import native primary lock');
assert.match(operation,/beginSqliteExclusiveWriteWindow\(\)/);
assert.match(operation,/withPrimarySqliteMutationLock\(async lease/);
assert.ok(operation.indexOf('withPrimarySqliteMutationLock(async lease')<
  operation.indexOf('currentWeeklyContext()'),'fresh current context must be read under lease');
assert.ok(operation.indexOf('withPrimarySqliteMutationLock(async lease')<
  operation.indexOf('await snapshot('),'snapshot must follow native admission');
assert.match(operation,/withSqliteCoordinatedMutation\(begin\)/);
assert.match(operation,/withSqliteCoordinatedMutation\(rollback\)/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/);
assert.match(operation,/close\(\{uncertainOutcome:!acknowledged\}\)/);

function fixture({stale=false,noLock=false,failPot=false,ackLoss=false,imported=false}={}){
  const calls=[];let held=false,privileged=0,uncertain=false,committed=false;
  const seed={weekly:null,pot:{total_capacity:30,used_count:7},public:'UNCHANGED'};
  let state=structuredClone(seed),before=null,durable=structuredClone(seed);
  const form={values:{camp:'SYNTHETIC_CAMP',dish_category:'甜點飲料',
    event_name:'SYNTHETIC_EVENT',event_effects:'',base_notes:'fixture'}};
  const current={week_start:'2026-11-09',authority_revision:''};
  const edit={needsAccountWrite:true,value:69,source:'MANUAL_WEEKLY_CONTEXT_UI'};
  const requireHeld=()=>assert.equal(held,true,'SQL before primary lease');
  const env={
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      calls.push('window');
      return ({uncertainOutcome=false}={})=>{calls.push('close');if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      if(noLock)throw Error('SQLITE_PRIMARY_WEB_LOCKS_REQUIRED');
      held=true;try{return await fn({id:'synthetic-lease'});}finally{held=false;}
    },
    withSqliteCoordinatedMutation(fn){privileged++;try{return fn();}finally{privileged--;}},
    currentWeeklyContext(){requireHeld();calls.push('read');return {
      week_start:'2026-11-09',authority_revision:imported?'import-rev-2':''};},
    hasImportedAuthority(c){return Boolean(c.authority_revision);},
    validateManualForm(){requireHeld();calls.push('validate');},
    localWeekStart:()=> '2026-11-09',
    q:(f,key)=>({value:f.values[key]??''}),
    formBerryObservation:()=>['SYNTHETIC_BERRY_A','SYNTHETIC_BERRY_B','SYNTHETIC_BERRY_C'],
    resolveCampFavoriteBerries:(_camp,berries)=>({berries}),
    typedValue:(_field,v)=>v||null,
    localIso:()=> '2026-11-09T19:00:00+08:00',
    async snapshot(reason){requireHeld();assert.equal(reason,'manual:weekly-context-fallback');calls.push('snapshot');},
    begin(){requireHeld();assert.ok(privileged);before=structuredClone(state);calls.push('begin');},
    run(sql,params){
      requireHeld();assert.ok(privileged);calls.push('sql');
      assert.match(sql,/INSERT OR REPLACE INTO weekly_context/);
      assert.equal(params.length,12);
      state.weekly={context_id:params[0],week_start:params[1],camp:params[2],pot_size:params[9]};
    },
    writeAccountPotCapacity(value,source){
      requireHeld();assert.ok(privileged);calls.push('pot');
      if(failPot)throw Error('SYNTHETIC_POT_SQL_FAILURE');
      state.pot={...state.pot,total_capacity:value,source};return value;
    },
    commit(){requireHeld();assert.ok(privileged);committed=true;before=null;calls.push('commit');},
    rollback(){requireHeld();assert.ok(privileged);state=before;before=null;calls.push('rollback');},
    async persist({primaryMutationLease}={}){
      requireHeld();assert.ok(privileged);assert.equal(primaryMutationLease.id,'synthetic-lease');
      assert.equal(committed,true);calls.push('persist');durable=structuredClone(state);
      if(ackLoss)throw Error('SYNTHETIC_ACK_LOST');
    },
    JSON,String,Error,Object,Array,Number,Boolean
  };
  vm.runInNewContext(operation+'\n;globalThis.__save=saveFallback;',env,{timeout:3000});
  return {calls,save:()=>env.__save(form,current,edit),get state(){return state;},
    get durable(){return durable;},get uncertain(){return uncertain;}};
}
const ok=fixture(),result=await ok.save();
assert.equal(result.authority,'MANUAL_FALLBACK');
assert.deepEqual(ok.calls.slice(0,3),['window','lock','read']);
assert.ok(ok.calls.indexOf('validate')<ok.calls.indexOf('snapshot'));
assert.ok(ok.calls.indexOf('snapshot')<ok.calls.indexOf('begin'));
assert.ok(ok.calls.indexOf('begin')<ok.calls.indexOf('sql'));
assert.ok(ok.calls.indexOf('pot')<ok.calls.indexOf('commit'));
assert.ok(ok.calls.indexOf('commit')<ok.calls.indexOf('persist'));
assert.equal(ok.durable.weekly.week_start,'2026-11-09');
assert.equal(ok.durable.weekly.pot_size,null);
assert.equal(ok.durable.pot.total_capacity,69);
assert.equal(ok.durable.pot.used_count,7);
assert.equal(ok.durable.public,'UNCHANGED');
assert.equal(ok.uncertain,false);
for(const option of [{stale:true},{noLock:true}]){
  const f=fixture(option);await assert.rejects(f.save(),/SQLITE_PRIMARY_/);
  assert.deepEqual(f.calls,['window','lock','close']);
  assert.equal(f.durable.weekly,null);assert.equal(f.uncertain,true);
}
const imp=fixture({imported:true});
await assert.rejects(imp.save(),/WEEKLY_FALLBACK_IMPORTED_AUTHORITY_RELOAD_REQUIRED/);
assert.deepEqual(imp.calls,['window','lock','read','close']);
assert.equal(imp.durable.weekly,null);
const failed=fixture({failPot:true});
await assert.rejects(failed.save(),/SYNTHETIC_POT_SQL_FAILURE/);
assert.ok(failed.calls.includes('rollback'));
assert.ok(!failed.calls.includes('persist'));
assert.equal(failed.durable.weekly,null);
assert.equal(failed.state.pot.total_capacity,30);
const lost=fixture({ackLoss:true});
await assert.rejects(lost.save(),/SYNTHETIC_ACK_LOST/);
assert.equal(lost.durable.weekly.week_start,'2026-11-09');
assert.equal(lost.uncertain,true);
assert.ok(!lost.calls.includes('rollback'));
await assert.rejects(lost.save(),/UNVERIFIED_RELOAD_REQUIRED/);
assert.equal(lost.calls.filter(x=>x==='persist').length,1);
console.log('PASS G265_WEEKLY_FALLBACK_PRODUCTION_PRE_SQL_LOCK_IMPORT_AUTHORITY_ROLLBACK_ACK_LOSS');
