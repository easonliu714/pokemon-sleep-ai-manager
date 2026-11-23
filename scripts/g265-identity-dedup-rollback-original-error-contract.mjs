// G265 independent rollback provenance: current production repairPokemonDuplicates.
// Disposable SQL.js transaction; native Web Locks/IDB success is NOT claimed.
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

test('dedup rollback failure preserves initiating SQL error and forces sticky HOLD',async()=>{
  const db=new SQL.Database();
  db.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,status TEXT)');
  db.run("INSERT INTO pokemon VALUES('canonical','active'),('pkm_private_loser','active')");
  const signals={snapshots:0,persists:0,rollbacks:0,closes:[],reads:0};
  const context={
    repairInProgress:false,committed:false,
    beginSqliteExclusiveWriteWindow:()=>options=>signals.closes.push(options),
    withPrimarySqliteMutationLock:async callback=>callback({lease:'disposable'}),
    withSqliteCoordinatedMutation:callback=>callback(),
    active:()=>{signals.reads++;return [{pokemon_id:'canonical'},{pokemon_id:'pkm_private_loser'}];},
    planPokemonMerges:()=>[{winner:{pokemon_id:'canonical'},loser:{pokemon_id:'pkm_private_loser'},reason:'fixture'}],
    snapshot:async()=>{signals.snapshots++;},
    localIso:()=> '2026-11-23T00:00:00Z',
    begin:()=>db.run('BEGIN IMMEDIATE'),
    mergeOne:()=>db.run('INSERT INTO missing_player_table VALUES(1)'),
    commit:()=>db.run('COMMIT'),
    rollback:()=>{signals.rollbacks++;throw new Error('ROLLBACK_IO_FAILURE');},
    persist:async()=>{signals.persists++;},
    auditActivePokemon:()=>({ok:true}),
    console:{error:()=>{},warn:()=>{}},
    Error,Number,String,JSON,CustomEvent:class{},
  };
  const repair=vm.runInNewContext(writer+';repairPokemonDuplicates',context);
  try{
    await assert.rejects(repair(),error=>
      error?.code==='IDENTITY_DEDUP_ROLLBACK_UNVERIFIED_RELOAD_REQUIRED'
      &&error?.cause?.message==='ROLLBACK_IO_FAILURE'
      &&/missing_player_table/.test(error?.originalError?.message||''),
      'original SQL failure must remain independently inspectable after rollback failure');
    assert.equal(signals.snapshots,1);
    assert.equal(signals.rollbacks,1);
    assert.equal(signals.persists,0);
    assert.equal(signals.reads,1);
    assert.deepEqual(JSON.parse(JSON.stringify(signals.closes)),[{uncertainOutcome:true}]);
    assert.equal(context.repairInProgress,false);
    assert.equal(db.exec('SELECT COUNT(*) FROM pokemon')[0].values[0][0],2);
  }finally{db.close();}
});
