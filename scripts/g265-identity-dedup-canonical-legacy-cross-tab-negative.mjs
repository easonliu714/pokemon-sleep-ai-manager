// G265 distinct canonical Legacy Direct Writer: identity-dedup.js::repairPokemonDuplicates().
// Unmodified production merge planner and writer execute in two disposable SQL.js VM sessions.
// A stale full-image ACK can undo a newer acknowledged dedup merge and child migration.
// PASS means the expected UNSAFE negative was reproduced; no production admission or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/identity-dedup.js',import.meta.url),'utf8');
assert.equal(source.split('const text=').length,2,'dedup source start changed');
assert.equal(source.split('\nfunction boot(){').length,2,'dedup source end changed');
const operation=source.slice(source.indexOf('const text='),source.indexOf('\nfunction boot(){')).replace(/^export /gm,'');
for(const required of [/function planPokemonMerges\(/,/async function repairPokemonDuplicates\(/,
  /await snapshot\(/,/begin\(\)/,/commit\(\)/,/mergeChildren\(/,
  /INSERT OR REPLACE INTO pokemon_identity_evidence/,/await persist\(\)/])
  assert.match(operation,required);
assert.doesNotMatch(operation,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
console.log('PASS G265_IDENTITY_DEDUP_CANONICAL_EXACT_LEGACY_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,original_label TEXT,species TEXT,level INTEGER,specialty TEXT,type TEXT,nickname TEXT,rating TEXT,core_role TEXT,status TEXT,identity_review_required INTEGER,identity_confidence REAL,registered_at TEXT,identity_fingerprint TEXT,last_updated_at TEXT)');
seed.run('CREATE TABLE pokemon_ingredients(pokemon_id TEXT,unlock_level INTEGER,ingredient_name TEXT,quantity INTEGER,UNIQUE(pokemon_id,unlock_level,ingredient_name))');
seed.run('CREATE TABLE pokemon_subskills(pokemon_id TEXT,unlock_level INTEGER,subskill_name TEXT,is_unlocked INTEGER,UNIQUE(pokemon_id,unlock_level,subskill_name))');
seed.run('CREATE TABLE pokemon_history(history_id TEXT PRIMARY KEY,pokemon_id TEXT)');
seed.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE pokemon_evolution_history(evolution_id TEXT PRIMARY KEY,pokemon_instance_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
function pokemon(id,instance,label,level,review,confidence,registered,fingerprint){
  seed.run('INSERT INTO pokemon VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[
    id,instance,label,label,level,'berries','electric','','','','active',review,
    confidence,registered,fingerprint,'seed'
  ]);
}
pokemon('canonical_A','instance_A','Pikachu',25,0,0.99,'2026-10-30T00:00:00+08:00','fingerprint_A');
pokemon('pkm_private_A','private_A','Pikachu',25,1,0.2,null,null);
pokemon('canonical_B','instance_B','Eevee',20,0,0.99,'2026-10-30T00:00:00+08:00','fingerprint_B');
pokemon('pkm_private_B','private_B','Eevee',21,1,0.2,null,null);
seed.run("INSERT INTO pokemon_ingredients VALUES('pkm_private_A',10,'Apple',2)");
seed.run("INSERT INTO pokemon_ingredients VALUES('pkm_private_B',10,'Milk',3)");
seed.run("INSERT INTO pokemon_subskills VALUES('pkm_private_A',10,'Helping Speed',1)");
seed.run("INSERT INTO pokemon_subskills VALUES('pkm_private_B',10,'Skill Trigger',1)");
seed.run("INSERT INTO pokemon_history VALUES('history_A','pkm_private_A')");
seed.run("INSERT INTO pokemon_history VALUES('history_B','pkm_private_B')");
let durable=new Uint8Array(seed.export());seed.close();

const scalar=(db,sql)=>db.exec(sql)[0].values[0][0];
const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
let acknowledgments=0,snapshots=0,dispatches=0,releaseFirst,firstWaiting;
const firstPersistEntered=new Promise(resolve=>{firstWaiting=resolve;});
function makeTab(label,hold,completeB=false){
  const local=new SQL.Database(new Uint8Array(durable));
  if(completeB)local.run("UPDATE pokemon SET level=20 WHERE pokemon_id='pkm_private_B'");
  const context=vm.createContext({
    rows:(sql,params=[])=>rowObjects(local,sql,params),
    run:(sql,params=[])=>local.run(sql,params),
    begin:()=>local.run('BEGIN TRANSACTION'),
    commit:()=>local.run('COMMIT'),
    rollback:()=>local.run('ROLLBACK'),
    async snapshot(reason){
      assert.equal(reason,'identity-merge-v4:'+(label==='A'?1:2));
      snapshots++;return {status:'SYNTHETIC'};
    },
    async persist(){
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstWaiting();});
      durable=bytes;acknowledgments++;
    },
    localIso:()=>label==='A'?'2026-11-01T23:55:01+08:00':'2026-11-01T23:55:02+08:00',
    planSkeletonMerges:()=>[],
    auditActivePokemon:()=>({ok:true}),
    document:{dispatchEvent(event){assert.equal(event.type,'pokemon-sleep-data-refreshed');dispatches++;}},
    CustomEvent:class{constructor(type){this.type=type;}},
    JSON,Number,String,Promise,Error,Math,Date,Object,Set,Map,Array,console
  });
  vm.runInContext(operation+'\n;globalThis.__repair=repairPokemonDuplicates;',context,{timeout:3000});
  return {repair:context.__repair,close:()=>local.close()};
}
const first=makeTab('A',true);
const pending=first.repair();
await firstPersistEntered;
assert.equal(acknowledgments,0);
const second=makeTab('B',false,true);
assert.equal(await second.repair(),2,'B acknowledges two independent canonical/private merges');
assert.equal(acknowledgments,1);
let reload=new SQL.Database(durable);
assert.equal(scalar(reload,"SELECT status='archived' FROM pokemon WHERE pokemon_id='pkm_private_B'"),1);
assert.equal(scalar(reload,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-dedup-v4-pkm_private_B'"),1);
assert.equal(scalar(reload,"SELECT COUNT(*) FROM pokemon_ingredients WHERE pokemon_id='canonical_B' AND ingredient_name='Milk'"),1);
assert.equal(scalar(reload,"SELECT COUNT(*) FROM pokemon_history WHERE history_id='history_B' AND pokemon_id='canonical_B'"),1);
reload.close();

releaseFirst();
assert.equal(await pending,1,'A only planned its original A pair');
assert.equal(acknowledgments,2,'both legacy full-image persists ACKed');
assert.equal(snapshots,2);
assert.equal(dispatches,2);
reload=new SQL.Database(durable);
assert.equal(scalar(reload,"SELECT status='archived' FROM pokemon WHERE pokemon_id='pkm_private_A'"),1);
assert.equal(scalar(reload,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-dedup-v4-pkm_private_A'"),1);
assert.equal(scalar(reload,"SELECT status='active' FROM pokemon WHERE pokemon_id='pkm_private_B'"),1,'newer acknowledged B archive reverted');
assert.equal(scalar(reload,"SELECT level FROM pokemon WHERE pokemon_id='pkm_private_B'"),21,'newer B observation lost');
assert.equal(scalar(reload,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-dedup-v4-pkm_private_B'"),0,'newer B merge evidence lost');
assert.equal(scalar(reload,"SELECT COUNT(*) FROM pokemon_ingredients WHERE pokemon_id='canonical_B' AND ingredient_name='Milk'"),0,'newer B child migration lost');
assert.equal(scalar(reload,"SELECT COUNT(*) FROM pokemon_history WHERE history_id='history_B' AND pokemon_id='pkm_private_B'"),1,'newer B history migration reverted');
assert.equal(scalar(reload,"SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
reload.close();first.close();second.close();
console.log('PASS G265_IDENTITY_DEDUP_TWO_ACK_STALE_ARCHIVE_EVIDENCE_CHILD_HISTORY_LOST_NEGATIVE');
console.log('HOLD G265_IDENTITY_DEDUP_LEGACY_UNADMITTED_CROSS_TAB_ANDROID_OWNER_DOD');
