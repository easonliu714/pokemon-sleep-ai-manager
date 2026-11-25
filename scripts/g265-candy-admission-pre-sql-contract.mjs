// G265 #861: deterministic source-bound admission ordering contract.
// Actual production functions are evaluated with instrumented dependencies.
// This is NOT native Chromium, real SQL.js, or durable Android evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/js/candy-public-master-admission-ui.js','utf8');
function setup(source,{stale=false,ackLost=false,localFailure=false,replayMismatch=false,rollbackFailure=false}={}){
  const start=source.indexOf('async function persistSqliteMutation(');
  const end=source.indexOf('\nfunction wire()',start);
  assert.ok(start>=0&&end>start,'actual Candy production functions missing');
  const events=[],alerts=[],closes=[],lease=Object.freeze({id:'synthetic-lease'});
  const prepared={candy_id:'synthetic-id',candy_name:'測試糖果',observation_id:'obs'};
  const obs={observation_id:'obs',observed_text:'測試糖果'};
  let sqlite=null,local=null,active=false,transaction=false;
  const deps={
    clean:v=>String(v??'').trim(),normalize:v=>String(v??'').trim(),
    begin:()=>{events.push('BEGIN');transaction=true;},
    commit:()=>{events.push('COMMIT');transaction=false;},
    rollback:()=>{events.push('LEGACY_ROLLBACK');transaction=false;},
    run:sql=>{events.push(sql);if(rollbackFailure)throw Error('driver rollback failed');transaction=false;},
    persist:async options=>{events.push('PERSIST');if(stale||ackLost)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');assert.equal(options?.primaryMutationLease,lease,'durable save must receive exact lease');assert.equal(active,true);},
    isDatabaseReady:()=>true,isRescueReadonly:()=>false,
    sqliteAdmissionRow:()=>sqlite,
    assertSqliteIdentityCompatible:()=>{},
    upsertSqliteAdmission:row=>{events.push('UPSERT');if(rollbackFailure)throw Error('initiating SQL fault');sqlite={...row};},
    restoreSqliteAdmission:prior=>{events.push('COMPENSATE');sqlite=prior;},
    readPublicCandyLocalAdmissionState:()=>({rows:local?[local]:[]}),
    commitPublicCandyLocalAdmission:row=>{events.push('LOCAL_COMMIT');if(localFailure)throw Error('local write failed');local=row;return {status:'CREATED',row};},
    removePublicCandyLocalAdmission:()=>{events.push('LOCAL_REMOVE');local=null;},
    parseWorking:()=>({area:{value:'RAW_WORKING',dispatchEvent:()=>events.push('UI_INPUT')},value:{observations:[obs]}}),
    admissionMessage:()=>'',confirm:()=>true,preparePublicCandyLocalAdmission:()=>prepared,
    replayCandyRecognitionAgainstCurrentMaster:()=>{events.push('REPLAY');return {payload:{observations:[{...obs,status:replayMismatch?'UNMATCHED':'MATCHED',canonical_name:obs.observed_text}]}};},
    beginSqliteExclusiveWriteWindow:()=>{events.push('WINDOW');return options=>{events.push('CLOSE');closes.push(options);};},
    withSqliteCoordinatedMutation:fn=>{assert.equal(active,true,'SQL must execute inside native lease');return fn();},
    withPrimarySqliteMutationLock:async fn=>{events.push('ADMIT');if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');active=true;try{return await fn(lease);}finally{active=false;events.push('RELEASE');}},
    PUBLIC_CANDY_LOCAL_ADMISSION_ACTION:'USER_CONFIRMED_PUBLIC_CANDY_ADMISSION',
    PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION:'synthetic-authority',
    document:{getElementById:()=>null},window:{dispatchEvent:()=>events.push('UI_EVENT')},
    Event:class{},CustomEvent:class{},alert:msg=>alerts.push(String(msg)),
  };
  const directAdmit=Function(...Object.keys(deps),source.slice(start,end)+'\nreturn directAdmit;')(...Object.values(deps));
  return {invoke:()=>directAdmit({dataset:{id:'obs'}}),events,alerts,closes,state:()=>({sqlite,local,transaction})};
}
async function verify(source){
  const stale=setup(source,{stale:true});await stale.invoke();
  assert.equal(stale.events.includes('BEGIN'),false,'G265_CANDY_STALE_PRE_SQL: stale page must not BEGIN');
  assert.equal(stale.events.includes('UPSERT'),false);
  assert.equal(stale.events.includes('PERSIST'),false);
  assert.equal(stale.events.includes('LOCAL_COMMIT'),false);
  assert.equal(stale.state().sqlite,null);
  assert.equal(stale.state().local,null);
  assert.match(stale.alerts[0],/SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED/);
  assert.deepEqual(stale.closes,[{uncertainOutcome:true}]);
  const fresh=setup(source);await fresh.invoke();
  assert.ok(fresh.events.indexOf('ADMIT')<fresh.events.indexOf('BEGIN'));
  assert.ok(fresh.events.indexOf('PERSIST')<fresh.events.indexOf('LOCAL_COMMIT'));
  assert.ok(fresh.events.indexOf('REPLAY')<fresh.events.indexOf('RELEASE'));
  assert.ok(fresh.events.indexOf('RELEASE')<fresh.events.indexOf('UI_INPUT'));
  assert.equal(fresh.state().sqlite.candy_id,'synthetic-id');
  assert.equal(fresh.state().local.candy_id,'synthetic-id');
  assert.deepEqual(fresh.closes,[{uncertainOutcome:false}]);
  const lost=setup(source,{ackLost:true});await lost.invoke();
  assert.equal(lost.events.filter(e=>e==='PERSIST').length,1);
  assert.equal(lost.events.includes('COMPENSATE'),false,'uncertain ACK cannot be compensated blindly');
  assert.equal(lost.events.includes('LOCAL_COMMIT'),false);
  assert.deepEqual(lost.closes,[{uncertainOutcome:true}]);
  const failedLocal=setup(source,{localFailure:true});await failedLocal.invoke();
  assert.equal(failedLocal.events.filter(e=>e==='PERSIST').length,2);
  assert.ok(failedLocal.events.indexOf('COMPENSATE')<failedLocal.events.indexOf('RELEASE'));
  assert.equal(failedLocal.state().sqlite,null);
  assert.equal(failedLocal.state().local,null);
  const mismatch=setup(source,{replayMismatch:true});await mismatch.invoke();
  assert.ok(mismatch.events.indexOf('COMPENSATE')<mismatch.events.indexOf('RELEASE'));
  assert.equal(mismatch.state().sqlite,null);
  assert.equal(mismatch.state().local,null);
  const badRollback=setup(source,{rollbackFailure:true});await badRollback.invoke();
  assert.ok(badRollback.events.includes('ROLLBACK'));
  assert.equal(badRollback.events.includes('LEGACY_ROLLBACK'),false);
  assert.equal(badRollback.events.includes('PERSIST'),false);
  assert.match(badRollback.alerts[0],/CANDY_ADMISSION_ROLLBACK_UNVERIFIED_RELOAD_REQUIRED/);
  assert.deepEqual(badRollback.closes,[{uncertainOutcome:true}]);
  console.log('PASS G265_CANDY_SOURCE_PRE_SQL_LEASE_ACK_COMPENSATION_CONTRACT');
}
await verify(source);
