// G265 #861: execute actual production g3 weeklyForm submit against genuine
// disposable SQL.js to verify pre-COMMIT rollback, post-COMMIT ACK provenance,
// and same-page sticky HOLD. Native cross-tab CAS is checked in a separate gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import initSqlJs from 'sql.js';

const src=readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const start='function weeklyForm() {',end='function recipeShortageText(row) {';
assert.equal(src.split(start).length,2);
const operation=start+src.split(start)[1].split(end)[0];
assert.match(operation,/withPrimarySqliteMutationLock\s*\(/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/);
const SQL=await initSqlJs();

async function scenario(mode){
  const db=new SQL.Database();
  db.run('CREATE TABLE weekly_context(context_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,camp TEXT,dish_category TEXT,favorite_berry_1 TEXT,favorite_berry_2 TEXT,favorite_berry_3 TEXT,event_name TEXT,event_effects TEXT,pot_size INTEGER,base_notes TEXT,updated_at TEXT NOT NULL)');
  const calls={snapshot:0,sql:0,persist:0,rollback:0,lease:0,success:0,render:0,alerts:0,close:[]};
  const form={onsubmit:null},panel={innerHTML:''};
  const document={
    getElementById:id=>id==='weeklyContextForm'?form:id==='weeklyContextPanel'?panel:null,
    dispatchEvent:()=>calls.success++
  };
  const values={
    week_start:'2026-11-16',camp:'SYNTHETIC_G265',dish_category:'沙拉',
    favorite_berry_1:'SYNTHETIC_BERRY',favorite_berry_2:'',favorite_berry_3:'',
    event_name:'',event_effects:'',pot_size:'24',base_notes:'SYNTHETIC_WEEKLY_SOURCE'
  };
  const FormData=class{constructor(target){this.values=target.values;}get(k){return this.values[k]??null;}};
  const rows=()=>[];
  const snapshot=async reason=>{
    assert.equal(reason,'manual:weekly-context');calls.snapshot++;
    if(mode==='snapshot-fail')throw Error('SYNTHETIC_WEEKLY_SNAPSHOT_FAILED');
  };
  const begin=()=>db.run('BEGIN IMMEDIATE');
  const commit=()=>db.run('COMMIT');
  const rollback=()=>{calls.rollback++;db.run('ROLLBACK')};
  const run=(sql,params)=>{
    calls.sql++;assert.match(sql,/INSERT OR REPLACE INTO weekly_context/);
    if(mode==='sql-fail')throw Error('SYNTHETIC_WEEKLY_SQL_FAILED');
    db.run(sql,params);
  };
  let bytes=null;
  const lease={synthetic:true};
  const persist=async options=>{
    calls.persist++;assert.deepEqual(options,{primaryMutationLease:lease});
    if(mode==='ack-loss')throw Error('SYNTHETIC_WEEKLY_ACK_LOSS');
    bytes=db.export();
  };
  let sticky=false;
  const beginSqliteExclusiveWriteWindow=()=>{
    if(sticky)throw Error('SQLITE_WRITE_WINDOW_UNCERTAIN_OUTCOME_HOLD');
    return outcome=>{calls.close.push(outcome);if(outcome.uncertainOutcome)sticky=true;};
  };
  const withPrimarySqliteMutationLock=async callback=>{
    calls.lease++;
    if(mode==='denied-lease')throw Error('SYNTHETIC_WEEKLY_NATIVE_LEASE_DENIED');
    return callback(lease);
  };
  const withSqliteCoordinatedMutation=fn=>fn();
  const alert=()=>{calls.alerts++;};
  const renderRecipeStrategyProjection=()=>{calls.render++;};
  const field=()=>'',area=()=>'',selectField=()=>'',berryField=()=>'';
  const now=()=> '2026-11-19T01:00:00.000Z';
  const CustomEvent=class{constructor(type){this.type=type;}};
  const weeklyForm=new Function('document','FormData','rows','snapshot','begin','commit','rollback',
    'run','persist','beginSqliteExclusiveWriteWindow','withPrimarySqliteMutationLock',
    'withSqliteCoordinatedMutation','field','area','selectField','berryField',
    'CAMP_OPTIONS','DISH_OPTIONS','EVENT_OPTIONS','now','alert','CustomEvent',
    'renderRecipeStrategyProjection',operation+';return weeklyForm;')(
      document,FormData,rows,snapshot,begin,commit,rollback,run,persist,
      beginSqliteExclusiveWriteWindow,withPrimarySqliteMutationLock,
      withSqliteCoordinatedMutation,field,area,selectField,berryField,
      [],[],[],now,alert,CustomEvent,renderRecipeStrategyProjection
    );
  weeklyForm();
  assert.equal(typeof form.onsubmit,'function');
  const submit=()=>form.onsubmit({preventDefault(){},target:{values}});
  let error='';
  try{await submit();}catch(e){error=e.message;}
  const count=db.exec('SELECT COUNT(*) FROM weekly_context')[0].values[0][0];
  let retryError='';
  if(mode!=='success'){
    const before={...calls};
    try{await submit();}catch(e){retryError=e.message;}
    assert.equal(retryError,'SQLITE_WRITE_WINDOW_UNCERTAIN_OUTCOME_HOLD',
      'G265 production failure must reject blind retry before native lease/snapshot/SQL');
    for(const key of ['snapshot','sql','persist','rollback','lease','success','render','alerts'])
      assert.equal(calls[key],before[key],mode+' retry mutated '+key);
  }
  let readback=null;
  if(bytes){
    const reload=new SQL.Database(bytes);
    readback=reload.exec('SELECT context_id,base_notes FROM weekly_context')?.[0]?.values||[];
    reload.close();
  }
  db.close();
  return {calls,error,retryError,count,readback};
}

const denied=await scenario('denied-lease');
assert.equal(denied.error,'SYNTHETIC_WEEKLY_NATIVE_LEASE_DENIED');
assert.equal(denied.calls.snapshot,0);assert.equal(denied.calls.sql,0);
assert.equal(denied.calls.persist,0);assert.equal(denied.count,0);
assert.deepEqual(denied.calls.close,[{uncertainOutcome:true}]);

const snapshotFail=await scenario('snapshot-fail');
assert.equal(snapshotFail.error,'SYNTHETIC_WEEKLY_SNAPSHOT_FAILED');
assert.equal(snapshotFail.calls.snapshot,1);
assert.equal(snapshotFail.calls.sql,0);assert.equal(snapshotFail.calls.persist,0);
assert.equal(snapshotFail.calls.rollback,0);assert.equal(snapshotFail.count,0);

const sqlFail=await scenario('sql-fail');
assert.equal(sqlFail.error,'SYNTHETIC_WEEKLY_SQL_FAILED');
assert.equal(sqlFail.calls.rollback,1);assert.equal(sqlFail.calls.persist,0);
assert.equal(sqlFail.count,0);assert.equal(sqlFail.calls.success,0);

const ackLoss=await scenario('ack-loss');
assert.equal(ackLoss.error,'SYNTHETIC_WEEKLY_ACK_LOSS');
assert.equal(ackLoss.calls.rollback,0,'Never ROLLBACK after in-memory COMMIT');
assert.equal(ackLoss.calls.persist,1);assert.equal(ackLoss.count,1);
assert.equal(ackLoss.readback,null,'ACK loss cannot fabricate durable readback');
assert.equal(ackLoss.calls.success,0);assert.equal(ackLoss.calls.render,0);
assert.equal(ackLoss.calls.alerts,0);
assert.deepEqual(ackLoss.calls.close,[{uncertainOutcome:true}]);

const fresh=await scenario('success');
assert.equal(fresh.error,'');assert.equal(fresh.calls.snapshot,1);
assert.equal(fresh.calls.sql,1);assert.equal(fresh.calls.persist,1);
assert.equal(fresh.calls.rollback,0);assert.equal(fresh.count,1);
assert.equal(fresh.calls.success,1);assert.equal(fresh.calls.render,1);
assert.equal(fresh.calls.alerts,1);
assert.ok(fresh.readback.some(r=>r[1]==='SYNTHETIC_WEEKLY_SOURCE'));
assert.deepEqual(fresh.calls.close,[{uncertainOutcome:false}]);
console.log('PASS G265_WEEKLY_CONTEXT_PRODUCTION_SQLJS_NATIVE_LEASE_DENIAL_PRECOMMIT_ROLLBACK_ACK_LOSS_STICKY_FRESH');
