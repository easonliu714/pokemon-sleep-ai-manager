// G265 Canonical Analysis Confirmation: isolated opt-in atomic durable CAS and recovery.
// Source-bound unchanged production applyConfirmed(); all SQLite rows are synthetic.
// The admission and Web Locks adapter are test-only; NEVER wire into player data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {webcrypto} from 'node:crypto';
import {createSqliteCrossTabWriteAdmission,sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';

const source=fs.readFileSync(new URL('../assets/js/analysis-confirmation-workbench.js',import.meta.url),'utf8');
function exactSlice(start,end){
  assert.equal(source.split(start).length,2,'production start boundary changed: '+start);
  assert.equal(source.split(end).length,2,'production end boundary changed: '+end);
  return source.slice(source.indexOf(start),source.indexOf(end));
}
const writer=exactSlice('async function applyConfirmed(', '\nfunction activateGroup(');
for(const marker of [/await snapshot\(/,/begin\(\)/,/UPDATE pokemon SET/,/pokemon_subskills/,/pokemon_ingredients/,/writeObservation\(/,/INSERT INTO pokemon_history/,/commit\(\);await persist\(\)/])
  assert.match(writer,marker,'must execute unchanged production confirmation writer');
assert.doesNotMatch(writer,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
const helpers=[
  exactSlice('const text=', 'const meaningful='),
  exactSlice('const meaningful=', 'const objectText='),
  exactSlice('function canonical(', 'function canonicalBadge('),
  exactSlice('function dispatchConfirmationTerminal(', 'function navigationState('),
  exactSlice('function patchValue(', 'function observationId('),
  exactSlice('function observationId(', 'function writeObservation('),
  exactSlice('function writeObservation(', 'async function applyConfirmed(')
].join('\n');
console.log('PASS G265_ANALYSIS_CONFIRMATION_EXACT_LEGACY_WRITER_SOURCE_BOUND_ISOLATED_OPTIN');

const SQL=await initSqlJs();
const seed=new SQL.Database();
const columnMatch=writer.match(/const columns=(\[[^\]]+\]);/);
assert.ok(columnMatch,'production field inventory changed');
const productionColumns=vm.runInNewContext('('+columnMatch[1]+')');
const extra=['pokemon_id','pokemon_instance_id','status','current_species','original_species','original_label','identity_confidence','last_updated_at','source_update_id','field_evidence_json','source_image_refs_json','identity_review_required'];
const all=[...new Set([...extra,...productionColumns])];
seed.run('CREATE TABLE pokemon('+all.map(name=>'"'+name+'" TEXT').join(',')+',PRIMARY KEY(pokemon_id))');
seed.run('CREATE TABLE pokemon_subskills(pokemon_id TEXT,unlock_level INTEGER,subskill_name TEXT,is_unlocked INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_ingredients(pokemon_id TEXT,unlock_level INTEGER,ingredient_name TEXT,quantity INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_analysis_observation(observation_id TEXT PRIMARY KEY,pokemon_id TEXT,identity_group_key TEXT,source_image_ref TEXT,analysis_id TEXT,revision_no INTEGER,observed_json TEXT,canonical_json TEXT,conflict_json TEXT,created_at TEXT,applied_at TEXT)');
seed.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE canonical_term(term_id TEXT,entity_type TEXT,canonical_name_zh_tw TEXT,is_active INTEGER)');
seed.run('CREATE TABLE canonical_term_alias(term_id TEXT,alias_text TEXT,locale TEXT,is_auto_replace_safe INTEGER)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO canonical_term VALUES('ingredient-fixture','ingredient','SyntheticIngredient',1),('subskill-fixture','subskill','SyntheticSubskill',1)");
seed.run("INSERT INTO pokemon(pokemon_id,status,species,nickname,source_image_refs_json,field_evidence_json) VALUES('synthetic_A','active','Synthetic_A','baseline_A','[]','{}'),('synthetic_B','active','Synthetic_B','baseline_B','[]','{}')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
for(const id of ['ROLLBACK','ACK_LOSS','AFTER_RELOAD']) seed.run('INSERT INTO pokemon(pokemon_id,status,species,nickname,source_image_refs_json,field_evidence_json) VALUES(?,?,?,?,?,?)',['synthetic_'+id,'active','Synthetic_'+id,'baseline_'+id,'[]','{}']);
let durable=new Uint8Array(seed.export());seed.close();

const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
const scalar=(db,sql)=>db.exec(sql)[0].values[0][0];

class QueueLocks {
  constructor(){this.tail=Promise.resolve();this.active=0;this.peak=0;}
  request(name,options,callback){
    assert.equal(name,'pokemon-sleep-ai-manager:sqlite-primary-exclusive-write');
    assert.equal(options.mode,'exclusive');
    assert.ok(options.signal);
    const prior=this.tail;let release;
    this.tail=new Promise(resolve=>{release=resolve;});
    return (async()=>{
      try{
        await prior;
        if(options.signal.aborted)throw Error('SYNTHETIC_LOCK_ABORT');
        this.active++;this.peak=Math.max(this.peak,this.active);
        try{return await callback({name,mode:'exclusive'});}
        finally{this.active--;}
      }finally{release();}
    })();
  }
}
const fingerprint=bytes=>sha256SqliteBytes(bytes,webcrypto);
const locks=new QueueLocks();
let durableWrites=0,snapshots=0,rollbacks=0,sqlWrites=0,successEvents=0;
const entered=[];
const read=(sql)=>{
  const db=new SQL.Database(new Uint8Array(durable));
  try{return scalar(db,sql);}
  finally{db.close();}
};
function makeTab(latestBytes,label,{holdPersist,failHistory,loseAck}={}){
  const local=new SQL.Database(new Uint8Array(latestBytes));
  const pokemonId='synthetic_'+label;
  const revision={analysis_id:'synthetic-analysis-'+label,revision_no:1,source_image_ref:'synthetic-image-'+label};
  const draft={
    species:'Synthetic_'+label,nickname:'confirmed_'+label,level:30,sp:1234,confidence:0.95,
    source_refs:['synthetic-source-'+label],field_evidence:{level:'synthetic-review-'+label},
    ingredients:[{unlock_level:1,ingredient_name:'SyntheticIngredient',quantity:2}],
    subskills:[{unlock_level:10,subskill_name:'SyntheticSubskill',is_unlocked:true}],conflicts:[]
  };
  let transaction=false;
  const status={className:'notice',textContent:''},emitted=[];
  const root={
    querySelector:selector=>{
      if(selector==='#analysisConfirmationStatus')return status;
      if(selector==='input[name="analysisTarget"]:checked')return {value:'existing'};
      if(selector==='#analysisExistingPokemon')return {value:pokemonId};
      return {disabled:false};
    },
    querySelectorAll:()=>[]
  };
  const context=vm.createContext({
    __draft:draft,__root:root,
    rows:(sql,params=[])=>rowObjects(local,sql,params),
    run:(sql,params=[])=>{
      assert.equal(transaction,true,'original SQL mutation must be inside transaction');
      sqlWrites++;
      if(failHistory&&sql.includes('INSERT INTO pokemon_history'))
        throw Error('SYNTHETIC_ANALYSIS_HISTORY_INSERT_FAILURE');
      local.run(sql,params);
    },
    begin:()=>{assert.equal(transaction,false);local.run('BEGIN IMMEDIATE');transaction=true;},
    commit:()=>{assert.equal(transaction,true);local.run('COMMIT');transaction=false;},
    rollback:()=>{if(transaction){local.run('ROLLBACK');transaction=false;rollbacks++;}},
    snapshot:async reason=>{
      assert.equal(reason,'before_analysis_confirmation_'+revision.analysis_id);
      snapshots++;return {status:'SYNTHETIC_ONLY'};
    },
    persist:async()=>{
      assert.equal(transaction,false,'COMMIT must precede durable persist');
      const bytes=new Uint8Array(local.export());
      if(holdPersist)await holdPersist();
      durable=bytes;durableWrites++;
      if(loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    ensureRoot:()=>root,readDraft:()=>draft,
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    dispatchEvent:event=>{emitted.push(event);successEvents++;return true;},
    console
  });
  vm.runInContext('let currentRevision='+JSON.stringify(revision)+';\nlet currentGroupId='+JSON.stringify('synthetic-group-'+label)+';\nconst makeId=()=>'+JSON.stringify('synthetic-generated-'+label)+';\n'+helpers+'\n'+writer+'\nglobalThis.__apply=applyConfirmed;',context,{timeout:5000});
  return {
    async apply(){
      await context.__apply();
      // Production catches exceptions and renders a UI error; propagate to CAS admission.
      if(status.className!=='notice success')
        throw Error('SYNTHETIC_WRITER_NO_DURABLE_ACK: '+status.textContent);
      assert.match(status.textContent,/已疊加更新/);
      assert.equal(emitted.filter(e=>e.type==='pokemon-sleep:analysis-confirmed-applied').length,1);
      assert.equal(emitted.filter(e=>e.type==='pokemon-sleep:analysis-confirmation-terminal').length,1);
    },
    rollback(){if(transaction){local.run('ROLLBACK');transaction=false;rollbacks++;}},
    close:()=>local.close()
  };
}
const admission=()=>createSqliteCrossTabWriteAdmission({
  locks,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const execute=(gate,id,expected,options={})=>gate.execute({
  reason:'synthetic-analysis-confirmation-'+id,
  expectedFingerprint:expected,
  writeUnderLock:async({latestBytes,observedFingerprint})=>{
    assert.equal(observedFingerprint,await fingerprint(latestBytes));
    entered.push(id);
    const tab=makeTab(latestBytes,id,options);
    try{await tab.apply();return {persistedBytes:new Uint8Array(durable)};}
    catch(error){tab.rollback();throw error;}
    finally{tab.close();}
  }
});
const original=await fingerprint(durable);
let releaseFirst,signalFirst;
const firstEntered=new Promise(resolve=>{signalFirst=resolve;});
const holdPersist=()=>new Promise(resolve=>{releaseFirst=resolve;signalFirst();});
const a=admission(),b=admission();
const first=execute(a,'A',original,{holdPersist});
await firstEntered;
const second=execute(b,'B',original);
assert.equal(locks.active,1);
assert.deepEqual(entered,['A']);
releaseFirst();
assert.equal((await first).status,'PERSISTED');
await assert.rejects(second,error=>error.code==='SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.deepEqual(entered,['A'],'stale writer must perform zero original SQL writes');
assert.equal(durableWrites,1);
assert.equal(read("SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_A'"),'confirmed_A');
assert.equal(read("SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_B'"),'baseline_B');
await assert.rejects(execute(b,'B',original),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(locks.peak,1);
console.log('PASS G265_ANALYSIS_CONFIRMATION_TWO_TABS_ONE_ACK_STALE_ZERO_SQL_WRITES');

const fresh=admission();
assert.equal((await execute(fresh,'B',await fingerprint(durable))).status,'PERSISTED');
for(const id of ['A','B']){
  assert.equal(read("SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_"+id+"'"),'confirmed_'+id);
  assert.equal(read("SELECT source_update_id FROM pokemon WHERE pokemon_id='synthetic_"+id+"'"),'analysis:synthetic-analysis-'+id);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_ingredients WHERE pokemon_id='synthetic_"+id+"'"),1);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='synthetic_"+id+"'"),1);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_analysis_observation WHERE pokemon_id='synthetic_"+id+"'"),1);
  assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_"+id+"' AND event_type='analysis_sparse_patch_update'"),1);
}
console.log('PASS G265_ANALYSIS_CONFIRMATION_FRESH_RELOAD_BOTH_EVIDENCE_CHILD_HISTORY');

const beforeRollback=await fingerprint(durable),beforeRollbackWrites=durableWrites;
const failed=admission();
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback,{failHistory:true}),/SYNTHETIC_ANALYSIS_HISTORY_INSERT_FAILURE/);
assert.equal(failed.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.ok(rollbacks>=1);
assert.equal(durableWrites,beforeRollbackWrites);
assert.equal(await fingerprint(durable),beforeRollback);
assert.equal(read("SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_ROLLBACK'"),'baseline_ROLLBACK');
assert.equal(read("SELECT COUNT(*) FROM pokemon_analysis_observation WHERE pokemon_id='synthetic_ROLLBACK'"),0);
await assert.rejects(execute(failed,'ROLLBACK',beforeRollback),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
console.log('PASS G265_ANALYSIS_CONFIRMATION_PRECOMMIT_ROLLBACK_DURABLE_SHA_UNCHANGED');

const lost=admission(),beforeLost=durableWrites;
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable),{loseAck:true}),/SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE/);
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeLost+1);
assert.equal(read("SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_ACK_LOSS'"),'confirmed_ACK_LOSS');
assert.equal(read("SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_ACK_LOSS'"),1);
await assert.rejects(execute(lost,'ACK_LOSS',await fingerprint(durable)),error=>error.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
const recovered=admission();
assert.equal((await execute(recovered,'AFTER_RELOAD',await fingerprint(durable))).status,'PERSISTED');
assert.equal(read("SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_AFTER_RELOAD'"),'confirmed_AFTER_RELOAD');
assert.equal(read("SELECT COUNT(*) FROM pokemon_history"),4);
assert.equal(read("SELECT value FROM synthetic_public_master WHERE id='public'"),'IMMUTABLE');
assert.equal(durableWrites,4);
assert.equal(snapshots,5);
assert.equal(successEvents,6,'ACK-loss must not emit UI success or terminal events');
console.log('PASS G265_ANALYSIS_CONFIRMATION_ACK_LOSS_STICKY_HOLD_FRESH_DURABLE_READBACK');

const noLocks=createSqliteCrossTabWriteAdmission({
  locks:null,readDurable:async()=>new Uint8Array(durable),fingerprint,timeoutMs:3000
});
const beforeNoLock=durableWrites,beforeNoLockSql=sqlWrites;
await assert.rejects(execute(noLocks,'B',await fingerprint(durable)),error=>error.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(durableWrites,beforeNoLock);
assert.equal(sqlWrites,beforeNoLockSql);
assert.deepEqual(entered,['A','B','ROLLBACK','ACK_LOSS','AFTER_RELOAD']);
console.log('PASS G265_ANALYSIS_CONFIRMATION_NO_WEB_LOCK_FAIL_CLOSED_ZERO_WRITES');
console.log('HOLD G265_ANALYSIS_CONFIRMATION_TEST_ONLY_OPTIN_NOT_PRODUCTION_23_WRITERS_ANDROID_OWNER_DOD');
