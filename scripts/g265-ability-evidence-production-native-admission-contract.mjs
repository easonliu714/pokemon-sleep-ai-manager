// G265 #861 twentieth AUTO ability evidence production source contract.
// This VM exercises CURRENT production logic, but is NOT browser-native evidence.
// Real Web Locks/IDB two-tab behavior requires its own Chromium Gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/identity-evidence-builder.js','utf8');
const start='const text=value=>',end='\nfunction boot(){';
assert.equal(source.split(start).length,2);
assert.equal(source.split(end).length,2);
const current=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
for(const pattern of [
  /beginSqliteExclusiveWriteWindow\(\)/,
  /withPrimarySqliteMutationLock\(async lease=>/,
  /await snapshot\(/,
  /withSqliteCoordinatedMutation\(\(\)=>\{/,
  /begin\(\);begun=true/,
  /commit\(\);committed=true/,
  /persist\(\{primaryMutationLease:lease\}\)/,
  /close\?\.\(\{uncertainOutcome:failed\|\|\(committed&&!acknowledged\)\}\)/
])assert.match(current,pattern);

function tab({deny=false,loseAck=false,failInsert=false,empty=false,incomplete=false,failSnapshot=false}={}){
  const log=[],lease=Object.freeze({});
  let active=false,admitted=false,sticky=false,committed=0,notification=0;
  const fail=code=>Object.assign(new Error(code),{code});
  const pokemon={pokemon_id:'synthetic_A',pokemon_instance_id:'instance_A',status:'active',
    species:'synthetic_species',current_species:'synthetic_species',level:30,
    specialty:'ingredients',type:'grass',sp:100,main_skill:'synthetic_skill',
    main_skill_level:1,nature:'synthetic_nature',helper_seconds:2400,
    carry_limit:10,identity_review_required:1,identity_confidence:0.2};
  const ingredients=[1,30,60].map(n=>({unlock_level:n,ingredient_name:'ingredient_'+n,quantity:2}));
  const subskills=(incomplete?[10,25,50,70]:[10,25,50,70,80])
    .map(n=>({unlock_level:n,subskill_name:'subskill_'+n,is_unlocked:1}));
  const ctx=vm.createContext({
    rows(sql,params=[]){
      assert.equal(admitted,true,'NO_PLAYER_READ_BEFORE_NATIVE_ADMISSION');
      if(sql.includes("FROM pokemon WHERE status='active'")){
        log.push('READ_ACTIVE');return empty?[]:[pokemon];
      }
      if(sql.includes('FROM pokemon_ingredients')){assert.equal(params[0],'synthetic_A');log.push('READ_INGREDIENTS');return ingredients;}
      if(sql.includes('FROM pokemon_subskills')){assert.equal(params[0],'synthetic_A');log.push('READ_SUBSKILLS');return subskills;}
      throw Error('UNEXPECTED_QUERY:'+sql);
    },
    run(sql){assert.equal(admitted,true);assert.equal(active,true);
      if(sql.includes('UPDATE pokemon SET'))log.push('UPDATE');
      else if(sql.includes('INSERT OR REPLACE INTO pokemon_identity_evidence')){
        log.push('EVIDENCE');if(failInsert)throw fail('SYNTHETIC_EVIDENCE_INSERT_FAILURE');
      }else throw Error('UNEXPECTED_MUTATION:'+sql);
    },
    async snapshot(reason){assert.equal(admitted,true);assert.equal(reason,'identity-evidence-builder:1');
      log.push('SNAPSHOT');if(failSnapshot)throw fail('SYNTHETIC_SNAPSHOT_FAILURE');
    },
    begin(){assert.equal(admitted,true);assert.equal(active,false);active=true;log.push('BEGIN');},
    commit(){assert.equal(active,true);active=false;log.push('COMMIT');},
    rollback(){assert.equal(active,true);active=false;log.push('ROLLBACK');},
    async persist({primaryMutationLease}={}){
      assert.equal(primaryMutationLease,lease,'PERSIST_MUST_USE_ADMITTED_OPAQUE_LEASE');
      log.push('PERSIST');committed++;
      if(loseAck)throw fail('SYNTHETIC_POSTCOMMIT_IDB_ACK_LOST');
    },
    beginSqliteExclusiveWriteWindow(){
      if(sticky)throw fail('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      log.push('WINDOW');return ({uncertainOutcome=false}={})=>{
        log.push('CLOSE');if(uncertainOutcome)sticky=true;
      };
    },
    async withPrimarySqliteMutationLock(callback){
      log.push('NATIVE');if(deny)throw fail('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      admitted=true;try{return await callback(lease);}finally{admitted=false;}
    },
    withSqliteCoordinatedMutation(callback){return callback();},
    localIso:()=>'2026-11-21T21:10:00+08:00',
    document:{dispatchEvent(event){assert.equal(event.type,'pokemon-sleep-data-refreshed');notification++;}},
    CustomEvent:class{constructor(type){this.type=type;}},
    JSON,Number,String,Promise,Error,Object,Math,Set,Map,console
  });
  vm.runInContext(current+'\n;globalThis.__run=completeIdentityEvidence;',ctx,{timeout:3000});
  return {run:ctx.__run,log,state:()=>({sticky,committed,notification,active})};
}
const stale=tab({deny:true});
await assert.rejects(stale.run(),e=>e.code==='SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
assert.deepEqual(stale.log,['WINDOW','NATIVE','CLOSE'],'stale must touch zero player reads/snapshot/SQL');
assert.deepEqual(stale.state(),{sticky:true,committed:0,notification:0,active:false});
await assert.rejects(stale.run(),e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_TWENTIETH_CURRENT_PRODUCTION_STALE_NATIVE_DENIED_BEFORE_PLAYER_READ_AND_SQL');

const normal=tab();
assert.equal(await normal.run(),1);
assert.deepEqual(normal.log,['WINDOW','NATIVE','READ_ACTIVE','READ_INGREDIENTS','READ_SUBSKILLS',
  'SNAPSHOT','BEGIN','UPDATE','EVIDENCE','COMMIT','PERSIST','CLOSE']);
assert.deepEqual(normal.state(),{sticky:false,committed:1,notification:1,active:false});
for(const option of [{empty:true},{incomplete:true}]){
  const noOp=tab(option);assert.equal(await noOp.run(),0);
  assert.equal(noOp.log.includes('SNAPSHOT'),false);
  assert.equal(noOp.log.includes('BEGIN'),false);
  assert.equal(noOp.state().committed,0);
}
console.log('PASS G265_TWENTIETH_CURRENT_PRODUCTION_ATOMIC_EXACT_LEASE_ACK_AND_ZERO_WORK_NOOP');

const failed=tab({failInsert:true});
await assert.rejects(failed.run(),e=>e.code==='SYNTHETIC_EVIDENCE_INSERT_FAILURE');
assert.deepEqual(failed.log.slice(-5),['BEGIN','UPDATE','EVIDENCE','ROLLBACK','CLOSE']);
assert.deepEqual(failed.state(),{sticky:true,committed:0,notification:0,active:false});
await assert.rejects(failed.run(),e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_TWENTIETH_CURRENT_PRODUCTION_PRECOMMIT_ROLLBACK_STICKY');

const lost=tab({loseAck:true});
await assert.rejects(lost.run(),e=>e.code==='ABILITY_EVIDENCE_DURABILITY_UNVERIFIED_RELOAD_REQUIRED'
  &&e.cause?.code==='SYNTHETIC_POSTCOMMIT_IDB_ACK_LOST');
assert.deepEqual(lost.log.slice(-3),['COMMIT','PERSIST','CLOSE']);
assert.deepEqual(lost.state(),{sticky:true,committed:1,notification:0,active:false});
await assert.rejects(lost.run(),e=>e.code==='SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(lost.state().committed,1,'no blind durable retry');
console.log('PASS G265_TWENTIETH_CURRENT_PRODUCTION_POSTCOMMIT_UNKNOWN_ACK_NO_BLIND_RETRY');

const snapshotFailure=tab({failSnapshot:true});
await assert.rejects(snapshotFailure.run(),e=>e.code==='SYNTHETIC_SNAPSHOT_FAILURE');
assert.equal(snapshotFailure.log.includes('BEGIN'),false);
assert.equal(snapshotFailure.state().sticky,true);
console.log('PASS G265_TWENTIETH_CURRENT_PRODUCTION_SNAPSHOT_FAILURE_ZERO_SQL');
console.log('HOLD G265_TWENTIETH_CURRENT_PRODUCTION_REAL_CHROMIUM_AND_ANDROID_OWNER_UAT_NOT_VERIFIED');
