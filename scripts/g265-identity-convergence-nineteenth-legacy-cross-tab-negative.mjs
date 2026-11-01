// G265 nineteenth distinct Legacy Direct Writer: identity-convergence.js::convergeStrongIdentities().
// Two isolated SQL.js VM sessions execute the unchanged production function on synthetic identities.
// Two successful persist ACKs can erase a newer strong identity and its evidence after stale full-image save.
// PASS is an UNSAFE negative, not a production CAS admission, Android UAT, or private-data operation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/identity-convergence.js',import.meta.url),'utf8');
const start='function strongCandidates(){';
const end='\nfunction boot(){';
assert.equal(source.split(start).length,2,'strongCandidates source must be unique');
assert.equal(source.split(end).length,2,'identity convergence source boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
for(const required of [/identity_review_required=1/,/identity_confidence,0\)>=0\.95/,
  /evidence_type='registered_at'/,/evidence_type='identity_fingerprint'/,
  /await snapshot\(/,/UPDATE pokemon SET identity_review_required=0/,
  /INSERT OR REPLACE INTO pokemon_identity_evidence/,/await persist\(\)/])
  assert.match(operation,required);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_NINETEENTH_IDENTITY_CONVERGENCE_EXACT_LEGACY_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,status TEXT,identity_review_required INTEGER,registered_at TEXT,identity_fingerprint TEXT,identity_confidence REAL,last_updated_at TEXT)');
seed.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO pokemon VALUES('synthetic_A','instance_A','active',1,'2026-10-30T00:00:00+08:00','fingerprint_A',0.99,'seed')");
seed.run("INSERT INTO pokemon VALUES('synthetic_B','instance_B','active',1,NULL,NULL,0.20,'seed')");
seed.run("INSERT INTO pokemon_identity_evidence VALUES('A_registered','instance_A','registered_at','2026-10-30',0.99,'seed','synthetic')");
seed.run("INSERT INTO pokemon_identity_evidence VALUES('A_fingerprint','instance_A','identity_fingerprint','fingerprint_A',0.99,'seed','synthetic')");
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
function makeTab(label,hold,addIndependentEvidence=false){
  const local=new SQL.Database(new Uint8Array(durable));
  if(addIndependentEvidence){
    // A distinct, independently observed strong identity is present only in B's unpersisted tab.
    // B's ACK persists that observation and its automatic confirmation together.
    local.run("UPDATE pokemon SET registered_at='2026-10-31T00:00:00+08:00',identity_fingerprint='fingerprint_B',identity_confidence=0.99 WHERE pokemon_id='synthetic_B'");
    local.run("INSERT INTO pokemon_identity_evidence VALUES('B_registered','instance_B','registered_at','2026-10-31',0.99,'synthetic','synthetic')");
    local.run("INSERT INTO pokemon_identity_evidence VALUES('B_fingerprint','instance_B','identity_fingerprint','fingerprint_B',0.99,'synthetic','synthetic')");
  }
  const context=vm.createContext({
    rows:(sql,params=[])=>rowObjects(local,sql,params),
    run:(sql,params=[])=>local.run(sql,params),
    async snapshot(reason){
      assert.equal(reason,'identity-auto-converge:'+(label==='A'?1:2));
      snapshots++;return {status:'SYNTHETIC'};
    },
    async persist(){
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstWaiting();});
      durable=bytes;acknowledgments++;
    },
    localIso:()=>label==='A'?'2026-11-01T15:57:01+08:00':'2026-11-01T15:57:02+08:00',
    document:{dispatchEvent(event){assert.equal(event.type,'pokemon-sleep-data-refreshed');dispatches++;}},
    CustomEvent:class{constructor(type){this.type=type;}},
    JSON,Number,String,Promise,Error,console,
  });
  vm.runInContext(operation+'\n;globalThis.__converge=convergeStrongIdentities;',context,{timeout:3000});
  return {converge:context.__converge,close:()=>local.close()};
}
const first=makeTab('A',true);
const pending=first.converge();
await firstPersistEntered;
const second=makeTab('B',false,true);
assert.equal(await second.converge(),2,'second tab has two independently strong candidates');
assert.equal(acknowledgments,1);
let reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),0);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-converged-synthetic_B'"),1);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id IN ('B_registered','B_fingerprint')"),2);
reloaded.close();

releaseFirst();
assert.equal(await pending,1,'first tab sees only the original strong candidate');
assert.equal(acknowledgments,2,'both legacy full-image persists acknowledged');
assert.equal(snapshots,2);
assert.equal(dispatches,2);
reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_A'"),0);
assert.equal(scalar(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),1,'newer acknowledged convergence reverted');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-converged-synthetic_A'"),1);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id='auto-converged-synthetic_B'"),0,'newer acknowledged convergence evidence lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE evidence_id IN ('B_registered','B_fingerprint')"),0,'newer acknowledged strong-source evidence lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
reloaded.close();first.close();second.close();
console.log('PASS G265_NINETEENTH_IDENTITY_CONVERGENCE_TWO_ACK_STALE_STRONG_IDENTITY_AND_EVIDENCE_LOST_NEGATIVE');
console.log('HOLD G265_IDENTITY_CONVERGENCE_LEGACY_UNADMITTED_CROSS_TAB_ANDROID_OWNER_DOD');
