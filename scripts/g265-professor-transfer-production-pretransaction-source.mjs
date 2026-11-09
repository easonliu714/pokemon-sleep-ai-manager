// G265 named production professor-transfer pre-SQL admission, source-bound negative first.
// Disposable VM-only player rows. No real player SQLite/IDB, Candy writes or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pokemon-professor-transfer.js',import.meta.url),'utf8');
const start='export async function transferPokemonToProfessor(';
const end='\nexport function professorTransferCandyGuidance()';
assert.equal(source.split(start).length,2,'unique production professor writer');
assert.equal(source.split(end).length,2,'stable source boundary');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /,'');
assert.match(source,/import \{withPrimarySqliteMutationLock\} from '\.\/storage\.js'/,
  'production professor writer must import native primary Web Lock');
assert.match(operation,/beginSqliteExclusiveWriteWindow\(\)/,'same-page exclusive window before reads');
assert.match(operation,/withPrimarySqliteMutationLock\(async lease/,'primary lock must cover SQL');
assert.ok(operation.indexOf('withPrimarySqliteMutationLock(async lease')<
  operation.indexOf("const before=rows("),'native lease before initial Pokémon read');
assert.match(operation,/withSqliteCoordinatedMutation\(begin\)/);
assert.match(operation,/withSqliteCoordinatedMutation\(rollback\)/);
assert.match(operation,/persist\(\{primaryMutationLease:lease\}\)/,'same lease through durable ACK');
assert.match(operation,/close\(\{uncertainOutcome:!acknowledged\}\)/,'sticky uncertain result');

function fixture({stale=false,noLock=false,failHistory=false,ackLoss=false}={}){
  const calls=[];let held=false,privileged=0,uncertain=false,committed=false;
  let row={pokemon_id:'synthetic_A',pokemon_instance_id:'instance_A',
    species:'synthetic_species',current_species:'synthetic_species',status:'active'};
  let backup=null,history=0,batches=0,changes=0;
  const requireHeld=()=>assert.equal(held,true,'PRE_SQL_PRIMARY_LEASE_REQUIRED');
  const env={
    beginSqliteExclusiveWriteWindow(){
      if(uncertain)throw Error('SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED');
      calls.push('window');return ({uncertainOutcome=false}={})=>{
        calls.push('close');if(uncertainOutcome)uncertain=true;
      };
    },
    async withPrimarySqliteMutationLock(fn){
      calls.push('lock');
      if(noLock)throw Error('SQLITE_PRIMARY_WEB_LOCKS_REQUIRED');
      if(stale)throw Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      held=true;try{return await fn({id:'synthetic-lease'});}finally{held=false;}
    },
    withSqliteCoordinatedMutation(fn){
      privileged++;try{return fn();}finally{privileged--;}
    },
    rows(sql){
      requireHeld();calls.push('read');
      if(sql.includes('FROM pokemon WHERE'))return [{...row}];
      if(sql.includes('FROM candy_master'))return [];
      return [];
    },
    run(sql){
      requireHeld();assert.ok(privileged,'SQL_MUTATION_REQUIRES_PRIVILEGED_WINDOW');
      if(sql.includes('UPDATE pokemon')){row={...row,status:'sent_to_professor'};calls.push('update');}
      else if(sql.includes('INSERT INTO pokemon_history')){
        if(failHistory)throw Error('SYNTHETIC_HISTORY_INSERT_FAILED');
        history++;calls.push('history');
      }else if(sql.includes('INSERT INTO import_batches')){batches++;calls.push('batch');}
      else if(sql.includes('INSERT INTO import_changes')){changes++;calls.push('change');}
      else throw Error('UNEXPECTED_SQL:'+sql);
    },
    async snapshot(reason){
      requireHeld();assert.equal(reason,'professor_transfer:synthetic_A');calls.push('snapshot');
    },
    begin(){requireHeld();assert.ok(privileged);backup={...row};calls.push('begin');},
    commit(){requireHeld();assert.ok(privileged);committed=true;backup=null;calls.push('commit');},
    rollback(){
      requireHeld();assert.ok(privileged);assert.ok(backup);row=backup;backup=null;
      history=0;batches=0;changes=0;calls.push('rollback');
    },
    async persist({primaryMutationLease}={}){
      requireHeld();assert.ok(privileged);
      assert.equal(primaryMutationLease?.id,'synthetic-lease');
      assert.equal(committed,true);calls.push('persist');
      if(ackLoss)throw Error('SYNTHETIC_POST_COMMIT_ACK_LOST');
    },
    normalizeObservedCandyQuantity(v){assert.equal(v,null);return null;},
    canonicalCandyStorageForSpecies(){requireHeld();return {
      status:'REVIEW_REQUIRED',source_master:null,
      storage:{reason:'SYNTHETIC_NO_CANDY'},canonical_master:null};},
    speciesCandyName:()=>null,
    makeId:()=> 'synthetic-transfer',
    now:()=> '2026-11-09T18:55:00+08:00',
    trace(){calls.push('trace');},
    recordCandyInventoryEvent(){throw Error('CANDY_EVENT_FORBIDDEN');},
    CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_ONLY',
    CANDY_MUTATION_TYPES:{DELTA_EVENT:'DELTA_EVENT'},
    PROFESSOR_TRANSFER_CANDY_RULE_STATUS:'NOT_YET_VERIFIED',
    PROFESSOR_TRANSFER_CANDY_AUTHORITY:'USER_DIRECT_OBSERVATION_ONLY',
  };
  const context=vm.createContext(env);
  vm.runInContext(operation+'\n;globalThis.__transfer=transferPokemonToProfessor;',context,{timeout:3000});
  return {calls,transfer:()=>context.__transfer('synthetic_A'),state:()=>({
    row,history,batches,changes,uncertain,committed})};
}

const ok=fixture();
const success=await ok.transfer();
assert.equal(success.pokemon.status,'sent_to_professor');
assert.deepEqual(ok.calls.slice(0,4),['window','lock','read','read']);
assert.ok(ok.calls.indexOf('snapshot')<ok.calls.indexOf('begin'));
assert.ok(ok.calls.indexOf('begin')<ok.calls.indexOf('update'));
assert.ok(ok.calls.indexOf('commit')<ok.calls.indexOf('persist'));
assert.ok(ok.calls.indexOf('persist')<ok.calls.indexOf('trace'));
assert.equal(ok.state().history,1);assert.equal(ok.state().batches,1);
assert.equal(ok.state().changes,1);assert.equal(ok.state().uncertain,false);
for(const option of [{stale:true},{noLock:true}]){
  const f=fixture(option);
  await assert.rejects(f.transfer(),/SQLITE_PRIMARY_/);
  assert.deepEqual(f.calls,['window','lock','close']);
  assert.equal(f.state().row.status,'active');
  assert.equal(f.state().uncertain,true);
}
const failed=fixture({failHistory:true});
await assert.rejects(failed.transfer(),/SYNTHETIC_HISTORY_INSERT_FAILED/);
assert.equal(failed.state().row.status,'active');
assert.equal(failed.state().history,0);
assert.equal(failed.state().uncertain,true);
assert.ok(failed.calls.includes('rollback'));
assert.ok(!failed.calls.includes('persist'));
const lost=fixture({ackLoss:true});
await assert.rejects(lost.transfer(),/SYNTHETIC_POST_COMMIT_ACK_LOST/);
assert.equal(lost.state().row.status,'sent_to_professor');
assert.equal(lost.state().uncertain,true);
assert.ok(!lost.calls.includes('rollback'));
assert.ok(!lost.calls.includes('trace'));
await assert.rejects(lost.transfer(),/SQLITE_DIRECT_WRITE_UNVERIFIED_RELOAD_REQUIRED/);
console.log('PASS G265_PROFESSOR_PRODUCTION_PRE_SQL_LEASE_SNAPSHOT_AUDIT_ROLLBACK_ACK_LOSS');
