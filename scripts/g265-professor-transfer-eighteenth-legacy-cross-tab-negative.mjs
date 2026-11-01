// G265 eighteenth Legacy Writer: exact production professor transfer, isolated no-Candy path.
// Two acknowledged stale full-image persists lose a confirmed transfer and its private audit.
// PASS is an UNSAFE negative, not production admission or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/pokemon-professor-transfer.js',import.meta.url),'utf8');
const start='export async function transferPokemonToProfessor(';
const end='\nexport function professorTransferCandyGuidance()';
assert.equal(source.split(start).length,2,'professor transfer source must be unique');
assert.equal(source.split(end).length,2,'professor transfer boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /,'');
for(const required of [/await snapshot\(/,/UPDATE pokemon SET status='sent_to_professor'/,
  /INSERT INTO pokemon_history/,/INSERT INTO import_batches/,/INSERT INTO import_changes/,
  /commit\(\);await persist\(\)/])assert.match(operation,required);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_EIGHTEENTH_PROFESSOR_TRANSFER_EXACT_LEGACY_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,species TEXT,current_species TEXT,status TEXT,last_updated_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE pokemon_history(id INTEGER PRIMARY KEY AUTOINCREMENT,pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seed.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT,PRIMARY KEY(update_id,operation_index))');
seed.run('CREATE TABLE candy_inventory(candy_id TEXT PRIMARY KEY,quantity INTEGER)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO pokemon VALUES('synthetic_A','instance_A','species_A','species_A','active','seed','seed')");
seed.run("INSERT INTO pokemon VALUES('synthetic_B','instance_B','species_B','species_B','active','seed','seed')");
seed.run("INSERT INTO candy_inventory VALUES('sentinel',99)");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
let acknowledgments=0,snapshots=0,candyEvents=0,releaseFirst,firstWaiting;
const firstPersistEntered=new Promise(resolve=>{firstWaiting=resolve;});
const count=(db,sql)=>db.exec(sql)[0].values[0][0];
const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};

function makeTab(label,hold){
  const local=new SQL.Database(new Uint8Array(durable));
  const ctx={
    rows:(sql,params=[])=>rowObjects(local,sql,params),
    run(sql,params=[]){
      assert.doesNotMatch(sql,/INSERT INTO candy_inventory|UPDATE candy_inventory|candy_inventory_events/i);
      local.run(sql,params);
    },
    begin(){local.run('BEGIN IMMEDIATE');},
    commit(){local.run('COMMIT');},
    rollback(){local.run('ROLLBACK');},
    async snapshot(reason){
      assert.equal(reason,'professor_transfer:synthetic_'+label);
      snapshots++;return {status:'SYNTHETIC'};
    },
    async persist(){
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstWaiting();});
      durable=bytes;acknowledgments++;
    },
    normalizeObservedCandyQuantity(value){assert.equal(value,null);return null;},
    canonicalCandyStorageForSpecies(){
      return {status:'REVIEW_REQUIRED',source_master:null,storage:{reason:'SYNTHETIC_NO_CANDY'},canonical_master:null};
    },
    speciesCandyName:()=>null,
    makeId:prefix=>prefix+'-synthetic-'+label,
    now:()=>label==='A'?'2026-11-01T12:52:01+08:00':'2026-11-01T12:52:02+08:00',
    trace(){},
    recordCandyInventoryEvent(){candyEvents++;throw Error('unexpected Candy event');},
    CANDY_FAMILY_STORAGE_AUTHORITY_VERSION:'SYNTHETIC_READONLY',
    CANDY_MUTATION_TYPES:{DELTA_EVENT:'DELTA_EVENT'},
    PROFESSOR_TRANSFER_CANDY_RULE_STATUS:'NOT_YET_VERIFIED',
    PROFESSOR_TRANSFER_CANDY_AUTHORITY:'USER_DIRECT_OBSERVATION_ONLY',
    Date:{now:()=>label==='A'?1793510000001:1793510000002},
    Math:{random:()=>label==='A'?0.1111:0.2222},
    JSON,Number,String,Promise,Error,console,
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__transfer=transferPokemonToProfessor;',context,{timeout:3000});
  return {transfer:context.__transfer,close:()=>local.close()};
}

const first=makeTab('A',true);
const pending=first.transfer('synthetic_A',{observedCandyQuantity:null});
await firstPersistEntered;
const second=makeTab('B',false);
const secondResult=await second.transfer('synthetic_B',{observedCandyQuantity:null});
assert.equal(secondResult.transfer.candy_inventory_applied,false);
assert.equal(secondResult.transfer.quantity_authority,'NOT_OBSERVED');
assert.equal(acknowledgments,1);
let reloaded=new SQL.Database(durable);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon WHERE pokemon_id='synthetic_B' AND status='sent_to_professor'"),1);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B'"),1);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM import_changes WHERE key_json LIKE '%synthetic_B%'"),1);
reloaded.close();

releaseFirst();
const firstResult=await pending;
assert.equal(firstResult.transfer.candy_inventory_applied,false);
assert.equal(acknowledgments,2,'both legacy writers acknowledged persist');
assert.equal(snapshots,2);
reloaded=new SQL.Database(durable);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon WHERE pokemon_id='synthetic_A' AND status='sent_to_professor'"),1);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon WHERE pokemon_id='synthetic_B' AND status='active'"),1,'second acknowledged transfer reverted');
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_A'"),1);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B'"),0,'second acknowledged history lost');
assert.equal(count(reloaded,"SELECT COUNT(*) FROM import_batches"),1,'second acknowledged batch lost');
assert.equal(count(reloaded,"SELECT COUNT(*) FROM import_changes WHERE key_json LIKE '%synthetic_B%'"),0,'second acknowledged change lost');
assert.equal(count(reloaded,"SELECT quantity FROM candy_inventory WHERE candy_id='sentinel'"),99);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
assert.equal(candyEvents,0);
reloaded.close();first.close();second.close();
console.log('PASS G265_EIGHTEENTH_PROFESSOR_TRANSFER_TWO_ACK_STALE_TRANSFER_HISTORY_AUDIT_LOST_NEGATIVE');
console.log('HOLD G265_PROFESSOR_TRANSFER_LEGACY_UNADMITTED_NO_CANDY_INFERENCE_CROSS_TAB_ANDROID_OWNER_DOD');
