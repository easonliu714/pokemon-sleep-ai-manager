// G265 twentieth distinct Legacy Direct Writer: identity-evidence-builder.js::completeIdentityEvidence().
// Two isolated SQL.js VM sessions execute unchanged production source on synthetic complete ability records.
// Two acknowledged full-image saves can erase a newer independently observed complete ability identity.
// PASS is an UNSAFE negative reproduction, not production CAS admission or Android Owner UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/identity-evidence-builder.js',import.meta.url),'utf8');
const start='const text=value=>';
const end='\nfunction boot(){';
assert.equal(source.split(start).length,2,'ability evidence helper source must be unique');
assert.equal(source.split(end).length,2,'ability evidence writer source boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
for(const required of [/function planAbilityEvidence\(/,/export async function completeIdentityEvidence\(/,
  /await snapshot\(/,/UPDATE pokemon SET pokemon_instance_id=/,
  /INSERT OR REPLACE INTO pokemon_identity_evidence/,/commit\(\)/,/await persist\(\)/]){
  const pattern=String(required).replace('export async function','async function');
  assert.match(operation,new RegExp(pattern.slice(1,-1)));
}
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_TWENTIETH_ABILITY_EVIDENCE_EXACT_LEGACY_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,status TEXT,species TEXT,current_species TEXT,level INTEGER,specialty TEXT,type TEXT,sp INTEGER,main_skill TEXT,main_skill_level INTEGER,nature TEXT,nature_bonus TEXT,nature_penalty TEXT,helper_seconds INTEGER,carry_limit INTEGER,favorite_berry TEXT,identity_review_required INTEGER,identity_fingerprint TEXT,identity_confidence REAL,last_updated_at TEXT)');
seed.run('CREATE TABLE pokemon_ingredients(pokemon_id TEXT,unlock_level INTEGER,ingredient_name TEXT,quantity INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_subskills(pokemon_id TEXT,unlock_level INTEGER,subskill_name TEXT,is_unlocked INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
for(const label of ['A','B']){
  seed.run('INSERT INTO pokemon(pokemon_id,pokemon_instance_id,status,species,current_species,level,specialty,type,sp,main_skill,main_skill_level,nature,helper_seconds,carry_limit,identity_review_required,identity_confidence,last_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[
    'synthetic_'+label,'instance_'+label,'active','species_'+label,'species_'+label,
    label==='A'?30:35,'ingredients','grass',100,'skill_'+label,1,'nature_'+label,
    2400,10,1,0.2,'seed']);
  for(const level of [1,30,60])seed.run('INSERT INTO pokemon_ingredients VALUES(?,?,?,?)',['synthetic_'+label,level,'ingredient_'+label+'_'+level,2]);
  for(const level of (label==='A'?[10,25,50,70,80]:[10,25,50,70]))
    seed.run('INSERT INTO pokemon_subskills VALUES(?,?,?,?)',['synthetic_'+label,level,'subskill_'+label+'_'+level,1]);
}
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
let acknowledgments=0,snapshots=0,dispatches=0,releaseFirst,firstWaiting;
const firstPersistEntered=new Promise(resolve=>{firstWaiting=resolve;});
const scalar=(db,sql)=>db.exec(sql)[0].values[0][0];
const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
function makeTab(label,hold,completeB=false){
  const local=new SQL.Database(new Uint8Array(durable));
  if(completeB)local.run("INSERT INTO pokemon_subskills VALUES('synthetic_B',80,'subskill_B_80',1)");
  const context=vm.createContext({
    rows:(sql,params=[])=>rowObjects(local,sql,params),
    run:(sql,params=[])=>local.run(sql,params),
    begin:()=>local.run('BEGIN IMMEDIATE'),
    commit:()=>local.run('COMMIT'),
    rollback:()=>local.run('ROLLBACK'),
    async snapshot(reason){
      assert.equal(reason,'identity-evidence-builder:'+(label==='A'?1:2));
      snapshots++;return {status:'SYNTHETIC'};
    },
    async persist(){
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstWaiting();});
      durable=bytes;acknowledgments++;
    },
    localIso:()=>label==='A'?'2026-11-01T18:55:01+08:00':'2026-11-01T18:55:02+08:00',
    document:{dispatchEvent(event){assert.equal(event.type,'pokemon-sleep-data-refreshed');dispatches++;}},
    CustomEvent:class{constructor(type){this.type=type;}},
    JSON,Number,String,Promise,Error,Math,Set,Map,Object,console,
  });
  vm.runInContext(operation+'\n;globalThis.__complete=completeIdentityEvidence;',context,{timeout:3000});
  return {complete:context.__complete,close:()=>local.close()};
}
const first=makeTab('A',true);
const pending=first.complete();
await firstPersistEntered;
const second=makeTab('B',false,true);
assert.equal(await second.complete(),2,'new independent complete B joins A');
assert.equal(acknowledgments,1);
let reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),0);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='ability-fingerprint-synthetic_B'"),1);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='synthetic_B' AND unlock_level=80"),1);
reloaded.close();
releaseFirst();
assert.equal(await pending,1,'first tab only sees original complete A');
assert.equal(acknowledgments,2,'both legacy full-image persists acknowledged');
assert.equal(snapshots,2);
assert.equal(dispatches,2);
reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_A'"),0);
assert.equal(scalar(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),1,'newer acknowledged identity reverted');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='ability-fingerprint-synthetic_A'"),1);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='ability-fingerprint-synthetic_B'"),0,'newer acknowledged ability evidence lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='synthetic_B' AND unlock_level=80"),0,'newer independently observed subskill lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
reloaded.close();first.close();second.close();
console.log('PASS G265_TWENTIETH_ABILITY_EVIDENCE_TWO_ACK_STALE_COMPLETE_IDENTITY_AND_SUBSKILL_LOST_NEGATIVE');
console.log('HOLD G265_ABILITY_EVIDENCE_LEGACY_UNADMITTED_CROSS_TAB_ANDROID_OWNER_DOD');
