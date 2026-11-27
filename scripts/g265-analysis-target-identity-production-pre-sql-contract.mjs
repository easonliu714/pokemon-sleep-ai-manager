// Actual production writer extracted verbatim; instrumented dependencies, NOT native CI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/js/analysis-target-identity.js',import.meta.url),'utf8');
function slice(a,b){assert.equal(source.split(a).length,2);assert.equal(source.split(b).length,2);return source.slice(source.indexOf(a),source.indexOf(b));}
const helpers=slice('const uuid=','function ensureBindingTable(');
const writer=slice('async function ensurePokemonInstanceId(','export async function createExistingPokemonAnalysisContext(');
function fixture({stale=false,existing=false,historyFail=false,rollbackFail=false,ackFail=false}={}){
  const original={pokemon_id:'synthetic_A',status:'active',pokemon_instance_id:existing?'pkm-old':null,species:'Synthetic'};
  let row={...original},prior=null,history=[],sticky=false,window=false,leaseActive=false,depth=0;
  const count={snapshot:0,begin:0,update:0,history:0,commit:0,rollback:0,persist:0,trace:0,lock:0};
  const lease=Object.freeze({});
  const ctx=vm.createContext({
    crypto:{randomUUID:()=> 'fixture'},localIso:()=> '2026-11-27T08:00:00+08:00',
    rows:()=>[{...row}],
    beginSqliteExclusiveWriteWindow(){if(sticky)throw Error('STICKY');assert.equal(window,false);window=true;return ({uncertainOutcome=false}={})=>{window=false;sticky||=uncertainOutcome;};},
    async withPrimarySqliteMutationLock(fn){count.lock++;assert.equal(window,true);if(stale)throw Error('STALE');leaseActive=true;try{return await fn(lease);}finally{leaseActive=false;}},
    withSqliteCoordinatedMutation(fn){depth++;try{return fn();}finally{depth--;}},
    async snapshot(){count.snapshot++;},
    begin(){count.begin++;prior={row:{...row},history:[...history]};},
    run(sql,args=[]){
      if(sql.startsWith('UPDATE pokemon')){count.update++;row={...row,pokemon_instance_id:args[0],last_updated_at:args[1],source_update_id:args[2]};}
      else if(sql.startsWith('INSERT INTO pokemon_history')){count.history++;if(historyFail)throw Error('HISTORY_FAIL');history.push(args);}
      else if(sql==='ROLLBACK'){count.rollback++;if(rollbackFail)throw Error('ROLLBACK_FAIL');assert.ok(prior);row=prior.row;history=prior.history;prior=null;}
      else throw Error('unexpected SQL '+sql);
    },
    rollback(){count.rollback++;if(prior){row=prior.row;history=prior.history;prior=null;}},
    commit(){count.commit++;prior=null;},
    async persist(opts){count.persist++;if(opts?.primaryMutationLease!==lease||!leaseActive||!depth)throw Error('BARE_PERSIST');if(ackFail)throw Error('ACK_FAIL');},
    UpdateCenterLiveDebug:{record(event){if(event==='analysis_target_instance_id_assigned')count.trace++;}}
  });
  vm.runInContext(helpers+'\n'+writer+'\n;globalThis.assign=ensurePokemonInstanceId;',ctx);
  return {assign:()=>ctx.assign('synthetic_A'),count,read:()=>({row,history,sticky,window})};
}
const stale=fixture({stale:true});
await assert.rejects(stale.assign(),/STALE/);
assert.equal(stale.count.snapshot,0);assert.equal(stale.count.begin,0);assert.equal(stale.count.update,0);assert.equal(stale.count.history,0);assert.equal(stale.count.persist,0);
assert.equal(stale.read().row.pokemon_instance_id,null);assert.equal(stale.read().sticky,true);
await assert.rejects(stale.assign(),/STICKY/);
const old=fixture({existing:true});
assert.equal((await old.assign()).pokemon_instance_id,'pkm-old');assert.equal(old.count.snapshot,0);assert.equal(old.count.persist,0);assert.equal(old.count.history,0);
const fresh=fixture();
assert.equal((await fresh.assign()).pokemon_instance_id,'pkm-fixture');assert.equal(fresh.count.snapshot,1);assert.equal(fresh.count.begin,1);assert.equal(fresh.count.update,1);assert.equal(fresh.count.history,1);assert.equal(fresh.count.commit,1);assert.equal(fresh.count.persist,1);assert.equal(fresh.count.trace,1);
assert.equal(fresh.read().history[0][2],'platform_identity_assigned');assert.equal(fresh.read().sticky,false);assert.equal(fresh.read().window,false);
await fresh.assign();assert.equal(fresh.count.history,1);assert.equal(fresh.count.persist,1);
const rollback=fixture({historyFail:true});
await assert.rejects(rollback.assign(),/HISTORY_FAIL/);assert.equal(rollback.count.rollback,1);assert.equal(rollback.count.persist,0);assert.equal(rollback.read().row.pokemon_instance_id,null);assert.equal(rollback.read().sticky,true);
const uncertain=fixture({historyFail:true,rollbackFail:true});
await assert.rejects(uncertain.assign(),e=>e.code==='ANALYSIS_TARGET_IDENTITY_ROLLBACK_UNVERIFIED_RELOAD_REQUIRED'&&e.originalError.message==='HISTORY_FAIL'&&e.cause.message==='ROLLBACK_FAIL');
assert.equal(uncertain.count.persist,0);assert.equal(uncertain.read().sticky,true);
const ack=fixture({ackFail:true});
await assert.rejects(ack.assign(),/ACK_FAIL/);assert.equal(ack.count.commit,1);assert.equal(ack.count.rollback,0);assert.equal(ack.count.trace,0);assert.equal(ack.read().sticky,true);
// The already-populated loaded row is not an acknowledged success after ACK loss.
await assert.rejects(ack.assign(),/STICKY/);
assert.equal(ack.count.persist,1);assert.equal(ack.count.history,1);
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_PRODUCTION_PRE_SQL_INSTRUMENTED_CONTRACT');
