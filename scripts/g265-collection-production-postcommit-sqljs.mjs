// G265 #861: source-bound production collection form post-COMMIT ACK-loss and
// pre-COMMIT SQL rollback; disposable genuine SQL.js, no player DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
const src=fs.readFileSync(new URL('../assets/js/g3-planning.js',import.meta.url),'utf8');
const marker='export function setupG3Pages() {';
assert.equal(src.split(marker).length,2);
const production=src.slice(src.indexOf(marker)).replace(/^export /,'');
const SQL=await initSqlJs();
async function scenario(mode){
  const db=new SQL.Database();
  db.run('CREATE TABLE collection_targets(target_id TEXT PRIMARY KEY,species TEXT,target_type TEXT,priority TEXT,camp TEXT,desired_traits TEXT,capture_strategy TEXT,status TEXT,notes TEXT,updated_at TEXT)');
  const calls={snapshot:0,sql:0,persist:0,rollback:0,close:[],reset:0,render:0,lease:0};
  const form={onsubmit:null};
  const document={getElementById:id=>id==='collectionAddForm'?form:null};
  const FormData=class{get(k){return k==='species'?'SYNTHETIC_ACK_CASE':'';}};
  const snapshot=async()=>{calls.snapshot++};
  const run=(query,params)=>{calls.sql++;if(mode==='sql-fail')throw new Error('SYNTHETIC_SQL_FAILURE');db.run(query,params)};
  const persist=async options=>{calls.persist++;assert.deepEqual(options,{primaryMutationLease:lease});if(mode==='ack-loss')throw new Error('SYNTHETIC_DURABLE_ACK_LOSS')};
  const rows=()=>[],now=()=>new Date().toISOString();
  const ensureUi=()=>{},weeklyForm=()=>{},warroomForm=()=>{},installStrategyRefreshListeners=()=>{};
  const renderCollection=()=>{calls.render++},alert=()=>{};
  const begin=()=>db.run('BEGIN'),commit=()=>db.run('COMMIT');
  const rollback=()=>{calls.rollback++;db.run('ROLLBACK')};
  const withSqliteCoordinatedMutation=fn=>fn();
  const beginSqliteExclusiveWriteWindow=()=>outcome=>{calls.close.push(outcome)};
  const lease={syntheticLease:true};
  const withPrimarySqliteMutationLock=async callback=>{calls.lease++;return callback(lease)};
  new Function('document','FormData','snapshot','run','persist','rows','now','ensureUi','weeklyForm','warroomForm','renderCollection','installStrategyRefreshListeners','alert','begin','commit','rollback','withSqliteCoordinatedMutation','beginSqliteExclusiveWriteWindow','withPrimarySqliteMutationLock',production+';return setupG3Pages;')(
    document,FormData,snapshot,run,persist,rows,now,ensureUi,weeklyForm,warroomForm,renderCollection,installStrategyRefreshListeners,alert,begin,commit,rollback,withSqliteCoordinatedMutation,beginSqliteExclusiveWriteWindow,withPrimarySqliteMutationLock
  )();
  let error='';
  try{await form.onsubmit({preventDefault(){},target:{reset(){calls.reset++}}})}catch(e){error=e.message}
  const count=db.exec('SELECT COUNT(*) FROM collection_targets')[0].values[0][0];
  const txn=db.exec('PRAGMA main.transaction_state'); // optional pragma, no assertion
  db.close();
  return {calls,error,count};
}
const lost=await scenario('ack-loss');
assert.equal(lost.error,'SYNTHETIC_DURABLE_ACK_LOSS','postcommit error provenance must not be masked by rollback');
assert.equal(lost.calls.rollback,0,'never rollback after successful SQL COMMIT');
assert.equal(lost.count,1,'committed SQL image remains uncertain after ACK loss');
assert.deepEqual(lost.calls.close,[{uncertainOutcome:true}],'durable uncertainty must sticky HOLD');
assert.equal(lost.calls.reset,0,'no success UI after uncertain durable ACK');
assert.equal(lost.calls.render,0);
const failed=await scenario('sql-fail');
assert.equal(failed.error,'SYNTHETIC_SQL_FAILURE');
assert.equal(failed.calls.rollback,1,'rollback active transaction on SQL error');
assert.equal(failed.calls.persist,0,'never persist failed SQL');
assert.equal(failed.count,0,'rollback must restore disposable SQLite');
assert.deepEqual(failed.calls.close,[{uncertainOutcome:true}]);
const fresh=await scenario('success');
assert.equal(fresh.error,'');
assert.equal(fresh.count,1);
assert.equal(fresh.calls.persist,1);
assert.deepEqual(fresh.calls.close,[{uncertainOutcome:false}]);
assert.equal(fresh.calls.reset,1);
assert.equal(fresh.calls.render,1);
console.log('PASS G265_COLLECTION_PRODUCTION_SQLJS_POSTCOMMIT_ACK_PROVENANCE_ROLLBACK_FRESH',JSON.stringify({ackLoss:lost,sqlFailure:failed,fresh}));
