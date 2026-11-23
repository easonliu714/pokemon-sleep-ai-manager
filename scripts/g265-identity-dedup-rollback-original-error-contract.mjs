// G265 #861: negative-first genuine SQL.js driver rollback observability.
// Current Production repairPokemonDuplicates() must NOT use database.rollback(),
// whose catch-all suppresses a real SQLite ROLLBACK failure. This SQL.js suite
// is disposable; separate Chromium native lease/IDB CAS tests remain required.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=readFileSync('assets/js/identity-dedup.js','utf8');
const start=source.indexOf('export async function repairPokemonDuplicates()');
const end=source.indexOf('\nfunction boot()',start);
assert.ok(start>=0&&end>start,'current production dedup writer must exist');
const writer=source.slice(start,end).replace('export async function','async function');
const SQL=await initSqlJs();

function setup({transactionAlreadyRolledBack=false}={}){
  const db=new SQL.Database();
  db.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,status TEXT)');
  db.run("INSERT INTO pokemon VALUES('canonical','active'),('pkm_private_loser','active')");
  const signals={snapshots:0,persists:0,rollbacks:0,legacyRollbacks:0,reads:0,closes:[]};
  const context={
    repairInProgress:false,
    beginSqliteExclusiveWriteWindow:()=>options=>signals.closes.push(options),
    withPrimarySqliteMutationLock:async callback=>callback(Object.freeze({lease:'disposable'})),
    withSqliteCoordinatedMutation:callback=>callback(),
    active:()=>{signals.reads++;return [{pokemon_id:'canonical'},{pokemon_id:'pkm_private_loser'}];},
    planPokemonMerges:()=>[{winner:{pokemon_id:'canonical'},loser:{pokemon_id:'pkm_private_loser'},reason:'fixture'}],
    snapshot:async()=>{signals.snapshots++;},
    localIso:()=> '2026-11-23T00:00:00Z',
    begin:()=>db.run('BEGIN IMMEDIATE'),
    // Use real SQLite driver for all player mutations, including ROLLBACK.
    run:sql=>{if(sql==='ROLLBACK')signals.rollbacks++;return db.run(sql);},
    mergeOne:()=>{
      db.run("UPDATE pokemon SET status='archived' WHERE pokemon_id='pkm_private_loser'");
      // Simulate a lower layer that has already rolled back a failed SQL
      // transaction. Subsequent rollback must raise a real driver error.
      if(transactionAlreadyRolledBack)db.run('ROLLBACK');
      db.run('INSERT INTO missing_player_table VALUES(1)');
    },
    commit:()=>db.run('COMMIT'),
    // Preserve the historical bug as a negative witness. Production must NOT
    // call this catch-all helper for a critical rollback decision.
    rollback:()=>{
      signals.legacyRollbacks++;
      try{db.run('ROLLBACK');}catch{}
    },
    persist:async()=>{signals.persists++;},
    auditActivePokemon:()=>({ok:true}),
    console:{error:()=>{},warn:()=>{}},
    Error,Number,String,JSON,CustomEvent:class{},
  };
  const repair=vm.runInNewContext(writer+';repairPokemonDuplicates',context);
  return {repair,context,db,signals};
}
function verifyNoPlayerLoss(f){
  const rows=f.db.exec('SELECT pokemon_id,status FROM pokemon ORDER BY pokemon_id')[0].values;
  assert.deepEqual(rows,[['canonical','active'],['pkm_private_loser','active']]);
  assert.equal(f.signals.persists,0,'failed SQL must never acknowledge durable save');
  assert.equal(f.signals.snapshots,1);
  assert.equal(f.signals.reads,1);
  assert.equal(f.signals.legacyRollbacks,0,'never invoke silent database.rollback()');
  assert.deepEqual(JSON.parse(JSON.stringify(f.signals.closes)),[{uncertainOutcome:true}]);
  assert.equal(f.context.repairInProgress,false);
}

test('real SQL.js ROLLBACK success preserves initiating error and all player rows',async()=>{
  const f=setup();
  try{
    await assert.rejects(f.repair(),/missing_player_table/);
    assert.equal(f.signals.rollbacks,1,'actual SQL driver must execute ROLLBACK');
    verifyNoPlayerLoss(f);
  }finally{f.db.close();}
});

test('real SQL.js ROLLBACK failure is explicit sticky HOLD with original SQL failure',async()=>{
  const f=setup({transactionAlreadyRolledBack:true});
  try{
    await assert.rejects(f.repair(),error=>
      error?.code==='IDENTITY_DEDUP_ROLLBACK_UNVERIFIED_RELOAD_REQUIRED'
      &&/no transaction is active|cannot rollback/i.test(error?.cause?.message||'')
      &&/missing_player_table/.test(error?.originalError?.message||''),
      'actual driver rollback failure must be visible with the original SQL fault');
    assert.equal(f.signals.rollbacks,1,'actual SQLite ROLLBACK must be attempted once');
    verifyNoPlayerLoss(f);
  }finally{f.db.close();}
});
