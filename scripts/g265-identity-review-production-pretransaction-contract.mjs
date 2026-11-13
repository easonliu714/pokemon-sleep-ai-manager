// G265 #861: production identity-review confirmation must admit the native
// primary lease BEFORE any snapshot/SQL and retain it through durable ACK.
// Synthetic VM only: never loads a player's SQLite/IDB or modifies Public Master.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/identity-review.js',import.meta.url),'utf8');
const start='async function confirmIndependent(pokemonId) {';
const end='\nasync function markEvolution(';
assert.equal(source.split(start).length,2);
assert.equal(source.split(end).length,2);
const operation=source.slice(source.indexOf(start),source.indexOf(end));

function fixture({deny=false,failEvidence=false,ackLoss=false,missing=false}={}){
  const calls=[];
  let held=false,tx=false,committed=false,uncertain=false,acknowledged=false;
  let state={confirmed:false,evidence:false},pending=null;
  const lease=Object.freeze({synthetic:true});
  const requireHeld=()=>assert.equal(held,true,'SQL_OR_SNAPSHOT_BEFORE_NATIVE_PRIMARY_LEASE');
  const ctx={
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SYNTHETIC_UNVERIFIED_RELOAD_REQUIRED');
      calls.push('window');
      return ({uncertainOutcome=false}={})=>{calls.push('close');if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');
      if(deny)throw Error('SYNTHETIC_LOCK_DENIED');
      held=true;try{return await fn(lease);}finally{held=false;}
    },
    withSqliteCoordinatedMutation(fn){requireHeld();return fn();},
    rows(sql,params=[]){
      requireHeld();calls.push('read');
      if(missing)return [];
      return [{pokemon_id:params[0],pokemon_instance_id:'instance_A',status:'active',identity_review_required:1}];
    },
    async snapshot(reason){requireHeld();calls.push('snapshot');assert.equal(reason,'identity-confirm:synthetic_A');},
    begin(){requireHeld();assert.equal(tx,false);tx=true;pending={...state};calls.push('begin');},
    run(sql,params=[]){
      requireHeld();assert.equal(tx,true,'SQL_OUTSIDE_TRANSACTION');
      calls.push('run');
      if(sql.includes('UPDATE pokemon'))pending.confirmed=true;
      if(sql.includes('pokemon_identity_evidence')){
        if(failEvidence)throw Error('SYNTHETIC_EVIDENCE_INSERT_FAILURE');
        pending.evidence=true;
      }
    },
    commit(){requireHeld();assert.equal(tx,true);state=pending;pending=null;tx=false;committed=true;calls.push('commit');},
    rollback(){requireHeld();if(tx){tx=false;pending=null;}calls.push('rollback');},
    async persist({primaryMutationLease}={}){
      requireHeld();assert.equal(primaryMutationLease,lease);
      assert.equal(committed,true);
      calls.push('persist');
      if(ackLoss)throw Error('SYNTHETIC_ACK_LOSS');
      acknowledged=true;
    },
    localIso:()=> '2026-11-13T02:30:00+08:00',
    renderIdentityReview(){calls.push('render');},
    Date:{now:()=>1794510000000},JSON,Promise,Error,Number,String,console,
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__confirmIndependent=confirmIndependent;',context,{timeout:3000});
  return {confirm:context.__confirmIndependent,calls,view:()=>({state:{...state},tx,uncertain,acknowledged})};
}
const positive=fixture();
await positive.confirm('synthetic_A');
assert.deepEqual(positive.view().state,{confirmed:true,evidence:true});
assert.equal(positive.view().acknowledged,true);
assert.ok(positive.calls.indexOf('lock')<positive.calls.indexOf('read'));
assert.ok(positive.calls.indexOf('lock')<positive.calls.indexOf('snapshot'));
assert.ok(positive.calls.indexOf('persist')<positive.calls.indexOf('close'));
console.log('PASS G265_IDENTITY_CONFIRM_NATIVE_PRE_SQL_ATOMIC_DURABLE_ACK');

const denied=fixture({deny:true});
await assert.rejects(denied.confirm('synthetic_A'),/SYNTHETIC_LOCK_DENIED/);
assert.equal(denied.calls.includes('read'),false);
assert.equal(denied.calls.includes('snapshot'),false);
assert.equal(denied.calls.includes('run'),false);
assert.equal(denied.calls.includes('persist'),false);
console.log('PASS G265_IDENTITY_CONFIRM_LOCK_DENIAL_ZERO_SQL');

const rollback=fixture({failEvidence:true});
await assert.rejects(rollback.confirm('synthetic_A'),/SYNTHETIC_EVIDENCE_INSERT_FAILURE/);
assert.deepEqual(rollback.view().state,{confirmed:false,evidence:false});
assert.equal(rollback.view().tx,false);
assert.equal(rollback.calls.includes('persist'),false);
console.log('PASS G265_IDENTITY_CONFIRM_PRECOMMIT_ROLLBACK');

const lost=fixture({ackLoss:true});
await assert.rejects(lost.confirm('synthetic_A'),/SYNTHETIC_ACK_LOSS/);
assert.deepEqual(lost.view().state,{confirmed:true,evidence:true});
assert.equal(lost.view().uncertain,true);
await assert.rejects(lost.confirm('synthetic_A'),/SYNTHETIC_UNVERIFIED_RELOAD_REQUIRED/);
console.log('PASS G265_IDENTITY_CONFIRM_POSTCOMMIT_ACK_LOSS_STICKY_HOLD');

const missing=fixture({missing:true});
await assert.rejects(missing.confirm('synthetic_A'),/IDENTITY_CONFIRM_TARGET_NOT_ACTIVE/);
assert.equal(missing.calls.includes('run'),false);
console.log('PASS G265_IDENTITY_CONFIRM_MISSING_TARGET_ZERO_SQL');


// G265 #861 next independent named writer: markEvolution must not read SQL or
// snapshot before native admission. This test executes the current production
// function in a disposable VM, never an owner's player database.
const evolutionStart=source.indexOf('\nasync function markEvolution(');
const evolutionEnd=source.indexOf('\nasync function mergeIntoExisting(',evolutionStart);
assert.ok(evolutionStart>=0&&evolutionEnd>evolutionStart,'unique evolution writer boundary');
const evolutionOperation=source.slice(evolutionStart,evolutionEnd);
function evolutionFixture({deny=false,stale=false,failHistory=false,ackLoss=false,cancel=false}={}){
  const calls=[];let held=false,tx=false,committed=false,uncertain=false;
  let state={species:'sprout',history:0},pending=null;
  const lease=Object.freeze({synthetic:true});
  const requireHeld=()=>assert.equal(held,true,'EVOLUTION_SQL_OR_SNAPSHOT_BEFORE_NATIVE_PRIMARY_LEASE');
  const context=vm.createContext({
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SYNTHETIC_EVOLUTION_UNVERIFIED_RELOAD_REQUIRED');
      calls.push('window');
      return ({uncertainOutcome=false}={})=>{calls.push('close');if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');if(deny)throw Error('SYNTHETIC_EVOLUTION_LOCK_DENIED');
      held=true;try{return await fn(lease);}finally{held=false;}
    },
    withSqliteCoordinatedMutation(fn){requireHeld();return fn();},
    rows(sql,params=[]){
      requireHeld();calls.push('read');
      return [{pokemon_id:params[0],pokemon_instance_id:'instance_A',status:'active',
        identity_review_required:1,original_species:'seed',
        current_species:stale?'other':'sprout',species:stale?'other':'sprout'}];
    },
    prompt(label,initial){
      calls.push('prompt');
      if(cancel)return null;
      if(label.includes('進化前'))return 'seed';
      if(label.includes('目前'))return 'bloom';
      return '2026-11-13T03:00:00+08:00';
    },
    async snapshot(reason){requireHeld();calls.push('snapshot');assert.equal(reason,'identity-evolution:synthetic_A');},
    begin(){requireHeld();assert.equal(tx,false);tx=true;pending={...state};calls.push('begin');},
    run(sql){
      requireHeld();assert.equal(tx,true,'EVOLUTION_SQL_OUTSIDE_TRANSACTION');calls.push('run');
      if(sql.includes('UPDATE pokemon'))pending.species='bloom';
      if(sql.includes('pokemon_evolution_history')){
        if(failHistory)throw Error('SYNTHETIC_EVOLUTION_HISTORY_FAILED');
        pending.history++;
      }
    },
    commit(){requireHeld();assert.equal(tx,true);state=pending;pending=null;tx=false;committed=true;calls.push('commit');},
    rollback(){requireHeld();tx=false;pending=null;calls.push('rollback');},
    async persist({primaryMutationLease}={}){
      requireHeld();assert.equal(primaryMutationLease,lease);assert.equal(committed,true);
      calls.push('persist');if(ackLoss)throw Error('SYNTHETIC_EVOLUTION_ACK_LOSS');
    },
    localIso:()=> '2026-11-13T03:00:00+08:00',
    renderIdentityReview(){calls.push('render');},
    Date:{now:()=>1794510000000},JSON,Promise,Error,Number,String,console,
  });
  vm.runInContext(evolutionOperation+'\n;globalThis.__markEvolution=markEvolution;',context,{timeout:3000});
  const hint={pokemon_id:'synthetic_A',pokemon_instance_id:'instance_A',status:'active',
    identity_review_required:1,original_species:'seed',current_species:'sprout',species:'sprout'};
  return {evolve:()=>context.__markEvolution('synthetic_A',hint),calls,view:()=>({state:{...state},tx,uncertain})};
}
const evolutionPositive=evolutionFixture();
await evolutionPositive.evolve();
assert.deepEqual(evolutionPositive.view().state,{species:'bloom',history:1});
assert.ok(evolutionPositive.calls.indexOf('lock')<evolutionPositive.calls.indexOf('read'));
assert.ok(evolutionPositive.calls.indexOf('lock')<evolutionPositive.calls.indexOf('snapshot'));
assert.ok(evolutionPositive.calls.indexOf('commit')<evolutionPositive.calls.indexOf('persist'));
assert.ok(evolutionPositive.calls.indexOf('persist')<evolutionPositive.calls.indexOf('close'));
console.log('PASS G265_EVOLUTION_NATIVE_PRE_SQL_ATOMIC_DURABLE_ACK');
for(const options of [{deny:true},{cancel:true}]){
  const f=evolutionFixture(options);
  if(options.deny)await assert.rejects(f.evolve(),/SYNTHETIC_EVOLUTION_LOCK_DENIED/);
  else await f.evolve();
  assert.equal(f.calls.includes('read'),false);
  assert.equal(f.calls.includes('snapshot'),false);
  assert.equal(f.calls.includes('run'),false);
}
console.log('PASS G265_EVOLUTION_LOCK_DENIAL_AND_CANCEL_ZERO_SQL');
const evolutionStale=evolutionFixture({stale:true});
await assert.rejects(evolutionStale.evolve(),/EVOLUTION_STALE_/);
assert.equal(evolutionStale.calls.includes('run'),false);
console.log('PASS G265_EVOLUTION_STALE_IDENTITY_ZERO_MUTATION');
const evolutionRollback=evolutionFixture({failHistory:true});
await assert.rejects(evolutionRollback.evolve(),/SYNTHETIC_EVOLUTION_HISTORY_FAILED/);
assert.deepEqual(evolutionRollback.view().state,{species:'sprout',history:0});
assert.equal(evolutionRollback.view().tx,false);
assert.equal(evolutionRollback.calls.includes('persist'),false);
console.log('PASS G265_EVOLUTION_ATOMIC_HISTORY_ROLLBACK');
const evolutionAckLoss=evolutionFixture({ackLoss:true});
await assert.rejects(evolutionAckLoss.evolve(),/SYNTHETIC_EVOLUTION_ACK_LOSS/);
assert.deepEqual(evolutionAckLoss.view().state,{species:'bloom',history:1});
assert.equal(evolutionAckLoss.view().uncertain,true);
await assert.rejects(evolutionAckLoss.evolve(),/SYNTHETIC_EVOLUTION_UNVERIFIED_RELOAD_REQUIRED/);
console.log('PASS G265_EVOLUTION_POSTCOMMIT_ACK_LOSS_STICKY_HOLD');


// G265 #861: source-bound merge lease/transaction/rollback/ACK contract.
// All records are synthetic VM objects; no browser or player database access.
const mergeStart=source.indexOf('\nasync function mergeIntoExisting(');
const mergeEnd=source.indexOf('\nexport function renderIdentityReview(',mergeStart);
assert.ok(mergeStart>=0&&mergeEnd>mergeStart,'unique merge writer boundary');
const mergeOperation=source.slice(mergeStart,mergeEnd);
function mergeFixture({deny=false,stale=false,failEvidence=false,ackLoss=false,cancel=false}={}){
  const calls=[];let held=false,tx=false,committed=false,uncertain=false,pending=null;
  let state={archived:false,ingredients:false,subskills:false,evidence:false};
  const lease=Object.freeze({synthetic:true});
  const requireHeld=()=>assert.equal(held,true,'MERGE_SQL_BEFORE_NATIVE_PRIMARY_LEASE');
  const context=vm.createContext({
    prompt:()=>cancel?null:'synthetic_target',
    confirm:()=>true,
    rows(sql,params=[]){
      requireHeld();calls.push('read');
      const isSource=params[0]==='synthetic_source';
      return [{pokemon_id:params[0],pokemon_instance_id:isSource?'instance_source':'instance_target',
        status:stale&&isSource?'archived':'active',identity_review_required:isSource?1:0,species:'synthetic'}];
    },
    async snapshot(){requireHeld();calls.push('snapshot');},
    run(sql){
      requireHeld();assert.equal(tx,true,'MERGE_SQL_OUTSIDE_ATOMIC_TRANSACTION');
      calls.push('run');
      if(sql.includes('pokemon_ingredients'))pending.ingredients=true;
      if(sql.includes('pokemon_subskills'))pending.subskills=true;
      if(sql.includes('UPDATE pokemon_identity_evidence'))pending.evidence=true;
      if(sql.includes("status='archived'"))pending.archived=true;
      if(sql.includes('INSERT INTO pokemon_identity_evidence')&&failEvidence)throw Error('SYNTHETIC_MERGE_EVIDENCE_FAILED');
    },
    async persist({primaryMutationLease}={}){
      requireHeld();assert.equal(primaryMutationLease,lease);
      assert.equal(committed,true);calls.push('persist');
      if(ackLoss)throw Error('SYNTHETIC_MERGE_ACK_LOSS');
    },
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SYNTHETIC_MERGE_UNVERIFIED_RELOAD_REQUIRED');
      calls.push('window');return ({uncertainOutcome=false}={})=>{calls.push('close');if(uncertainOutcome)uncertain=true;};
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');if(deny)throw Error('SYNTHETIC_MERGE_LOCK_DENIED');
      held=true;try{return await fn(lease);}finally{held=false;}
    },
    withSqliteCoordinatedMutation:fn=>{requireHeld();return fn();},
    begin(){requireHeld();tx=true;pending={...state};calls.push('begin');},
    commit(){requireHeld();assert.equal(tx,true);state=pending;pending=null;tx=false;committed=true;calls.push('commit');},
    rollback(){requireHeld();pending=null;tx=false;calls.push('rollback');},
    localIso:()=> '2026-11-13T20:55:00+08:00',
    renderIdentityReview(){calls.push('render');},
    Date,JSON,console,Error,String,Number,
  });
  vm.runInContext(mergeOperation+'\n;globalThis.__mergeIntoExisting=mergeIntoExisting;',context,{timeout:3000});
  return {merge:()=>context.__mergeIntoExisting('synthetic_source'),calls,view:()=>({state:{...state},tx,uncertain})};
}
const mergeGood=mergeFixture();
await mergeGood.merge();
assert.deepEqual(mergeGood.view().state,{archived:true,ingredients:true,subskills:true,evidence:true});
assert.ok(mergeGood.calls.indexOf('lock')<mergeGood.calls.indexOf('read'));
assert.ok(mergeGood.calls.indexOf('lock')<mergeGood.calls.indexOf('snapshot'));
assert.ok(mergeGood.calls.indexOf('commit')<mergeGood.calls.indexOf('persist'));
assert.ok(mergeGood.calls.indexOf('persist')<mergeGood.calls.indexOf('close'));
console.log('PASS G265_IDENTITY_MERGE_NATIVE_PRE_SQL_ATOMIC_DURABLE_ACK');
for(const options of [{deny:true},{cancel:true},{stale:true}]){
  const f=mergeFixture(options);
  if(options.deny)await assert.rejects(f.merge(),/SYNTHETIC_MERGE_LOCK_DENIED/);
  else if(options.stale)await assert.rejects(f.merge(),/IDENTITY_MERGE_STALE_OR_UNVERIFIED/);
  else await f.merge();
  assert.equal(f.calls.includes('run'),false);
  assert.equal(f.calls.includes('persist'),false);
  if(options.deny||options.cancel)assert.equal(f.calls.includes('read'),false);
}
console.log('PASS G265_IDENTITY_MERGE_LOCK_DENIAL_CANCEL_STALE_ZERO_MUTATION');
const mergeRollback=mergeFixture({failEvidence:true});
await assert.rejects(mergeRollback.merge(),/SYNTHETIC_MERGE_EVIDENCE_FAILED/);
assert.deepEqual(mergeRollback.view().state,{archived:false,ingredients:false,subskills:false,evidence:false});
assert.equal(mergeRollback.view().tx,false);
assert.equal(mergeRollback.calls.includes('persist'),false);
console.log('PASS G265_IDENTITY_MERGE_PRECOMMIT_ROLLBACK_ZERO_DURABLE_DELTA');
const mergeAck=mergeFixture({ackLoss:true});
await assert.rejects(mergeAck.merge(),/SYNTHETIC_MERGE_ACK_LOSS/);
assert.equal(mergeAck.view().uncertain,true);
await assert.rejects(mergeAck.merge(),/SYNTHETIC_MERGE_UNVERIFIED_RELOAD_REQUIRED/);
console.log('PASS G265_IDENTITY_MERGE_POSTCOMMIT_ACK_LOSS_STICKY_HOLD');
