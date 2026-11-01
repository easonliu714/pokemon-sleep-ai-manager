// G265 canonical Legacy Direct Writer: analysis-target-identity.js::ensurePokemonInstanceId().
// Executes the unchanged production identity-assignment writer in two disposable SQL.js VM sessions.
// A stale full-image persist can erase another tab's acknowledged instance ID and audit history.
// PASS is a reproduced UNSAFE negative, NOT production admission or Android Owner UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/analysis-target-identity.js',import.meta.url),'utf8');
function exactSlice(start,end){
  assert.equal(source.split(start).length,2,'production start boundary changed: '+start);
  assert.equal(source.split(end).length,2,'production end boundary changed: '+end);
  return source.slice(source.indexOf(start),source.indexOf(end));
}
const helpers=exactSlice('const uuid=', 'function ensureBindingTable(');
const writer=exactSlice('async function ensurePokemonInstanceId(', 'export async function createExistingPokemonAnalysisContext(');
for(const marker of [/await snapshot\(/,/begin\(\)/,/UPDATE pokemon SET pokemon_instance_id=/,
  /INSERT INTO pokemon_history/,/commit\(\);await persist\(\)/,/platform_identity_assigned/])
  assert.match(writer,marker,'must execute unchanged production identity write and ACK path');
assert.doesNotMatch(writer,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
assert.match(source,/export async function createExistingPokemonAnalysisContext\(pokemonId\)\{\s*const row=await ensurePokemonInstanceId\(pokemonId\)/);
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_CANONICAL_EXACT_LEGACY_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,status TEXT NOT NULL,pokemon_instance_id TEXT,last_updated_at TEXT,source_update_id TEXT,species TEXT)');
seed.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO pokemon(pokemon_id,status,species) VALUES('synthetic_A','active','Species_A'),('synthetic_B','active','Species_B')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
const scalar=(db,sql)=>db.exec(sql)[0].values[0][0];
let releaseFirst,enteredFirst;
const firstPersistEntered=new Promise(resolve=>{enteredFirst=resolve;});
let acknowledgments=0,snapshots=0,successTraces=0,rollbackCalls=0;
function makeTab(label,hold){
  const local=new SQL.Database(new Uint8Array(durable));
  const pokemonId='synthetic_'+label;
  const expectedInstance='pkm-fixture-'+label;
  const context=vm.createContext({
    crypto:{randomUUID:()=> 'fixture-'+label},
    rows:(sql,params=[])=>rowObjects(local,sql,params),
    run:(sql,params=[])=>local.run(sql,params),
    begin:()=>local.run('BEGIN IMMEDIATE'),
    commit:()=>local.run('COMMIT'),
    rollback:()=>{rollbackCalls++;try{local.run('ROLLBACK');}catch{}},
    snapshot:async reason=>{
      assert.equal(reason,'analysis_target_identity:'+pokemonId);
      snapshots++;return {status:'SYNTHETIC'};
    },
    persist:async()=>{
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;enteredFirst();});
      durable=bytes;acknowledgments++;
    },
    localIso:()=>label==='A'?'2026-11-02T05:55:01+08:00':'2026-11-02T05:55:02+08:00',
    UpdateCenterLiveDebug:{record:(event,detail)=>{
      if(event==='analysis_target_instance_id_assigned'){
        assert.equal(detail.has_target_instance_id,true);successTraces++;
      }
    }},
    JSON,Number,String,Object,Promise,Error,Date,Math,console
  });
  vm.runInContext(helpers+'\n'+writer+'\n;globalThis.__ensure=ensurePokemonInstanceId;',context,{timeout:3000});
  return {
    assign:()=>context.__ensure(pokemonId),
    close:()=>local.close(),
    expectedInstance
  };
}
const first=makeTab('A',true);
const pending=first.assign();
await firstPersistEntered;
assert.equal(acknowledgments,0,'A has not acknowledged its pending full-image persist');
const second=makeTab('B',false);
const b=await second.assign();
assert.equal(b.pokemon_instance_id,second.expectedInstance);
assert.equal(acknowledgments,1,'B must acknowledge its own durable image');
let reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_B'"),second.expectedInstance);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B' AND event_type='platform_identity_assigned'"),1);
assert.equal(scalar(reloaded,"SELECT source_update_id FROM pokemon WHERE pokemon_id='synthetic_B'"),'platform-identity:'+second.expectedInstance);
reloaded.close();

releaseFirst();
const a=await pending;
assert.equal(a.pokemon_instance_id,first.expectedInstance);
assert.equal(acknowledgments,2,'both unchanged Legacy Writers ACK full-image persistence');
assert.equal(snapshots,2);
assert.equal(successTraces,2);
assert.equal(rollbackCalls,0);
reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_A'"),first.expectedInstance);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_A' AND event_type='platform_identity_assigned'"),1);
assert.equal(scalar(reloaded,"SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='synthetic_B'"),null,'B acknowledged instance ID lost');
assert.equal(scalar(reloaded,"SELECT source_update_id FROM pokemon WHERE pokemon_id='synthetic_B'"),null,'B acknowledged provenance lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B'"),0,'B acknowledged audit history lost');
assert.equal(scalar(reloaded,"SELECT value FROM synthetic_public_master WHERE id='public'"),'IMMUTABLE');
reloaded.close();first.close();second.close();
console.log('PASS G265_ANALYSIS_TARGET_IDENTITY_TWO_ACK_STALE_INSTANCE_ID_PROVENANCE_HISTORY_LOST_NEGATIVE');
console.log('HOLD G265_ANALYSIS_TARGET_IDENTITY_LEGACY_UNADMITTED_NO_ANDROID_OWNER_DOD');
