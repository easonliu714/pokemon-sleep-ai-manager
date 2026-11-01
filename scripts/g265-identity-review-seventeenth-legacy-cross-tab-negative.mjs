// G265 seventeenth distinct Legacy Direct Writer: identity-review.js::confirmIndependent(pokemonId).
// Execute the unchanged production function in two disposable SQL.js VM sessions using synthetic identities.
// Two acknowledged full-image persists lose the later independent confirmation and its evidence.
// PASS reproduces an UNSAFE negative; it does not authorize production, real player data, or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/identity-review.js',import.meta.url),'utf8');
const start='async function confirmIndependent(pokemonId) {';
const end='\nasync function markEvolution(';
assert.equal(source.split(start).length,2,'exact independent-confirmation writer must be unique');
assert.equal(source.split(end).length,2,'identity-review writer boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(operation,/await snapshot\(/);
assert.match(operation,/UPDATE pokemon SET identity_review_required=0/);
assert.match(operation,/INSERT OR REPLACE INTO pokemon_identity_evidence/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_SEVENTEENTH_IDENTITY_REVIEW_EXACT_LEGACY_CONFIRM_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,identity_review_required INTEGER,identity_confidence REAL,last_updated_at TEXT,status TEXT)');
seed.run('CREATE TABLE pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT,evidence_type TEXT,evidence_value TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO pokemon VALUES('synthetic_A','instance_A',1,0.2,'seed','active')");
seed.run("INSERT INTO pokemon VALUES('synthetic_B','instance_B',1,0.2,'seed','active')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
let acknowledgments=0,snapshots=0,releaseFirst,firstWaiting;
const firstPersistEntered=new Promise(resolve=>{firstWaiting=resolve;});
const count=(db,sql)=>db.exec(sql)[0].values[0][0];

function makeTab(label,hold){
  const local=new SQL.Database(new Uint8Array(durable));
  const ctx={
    async snapshot(reason){
      assert.equal(reason,'identity-confirm:synthetic_'+label);
      snapshots++;return {status:'SYNTHETIC'};
    },
    run(sql,params=[]){local.run(sql,params);},
    async persist(){
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstWaiting();});
      durable=bytes;acknowledgments++;
    },
    localIso:()=>label==='A'?'2026-11-01T09:56:01+08:00':'2026-11-01T09:56:02+08:00',
    Date:{now:()=>label==='A'?1793500000001:1793500000002},
    renderIdentityReview(){},
    JSON,Number,String,Promise,Error,console,
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__confirmIndependent=confirmIndependent;',context,{timeout:3000});
  return {confirm:context.__confirmIndependent,close:()=>local.close()};
}

const first=makeTab('A',true);
const pending=first.confirm('synthetic_A');
await firstPersistEntered;
const second=makeTab('B',false);
await second.confirm('synthetic_B');
assert.equal(acknowledgments,1);
let reloaded=new SQL.Database(durable);
assert.equal(count(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),0);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_B'"),1);
reloaded.close();

releaseFirst();
await pending;
assert.equal(acknowledgments,2,'both legacy writers returned after acknowledged persist');
assert.equal(snapshots,2);
reloaded=new SQL.Database(durable);
assert.equal(count(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_A'"),0);
assert.equal(count(reloaded,"SELECT identity_review_required FROM pokemon WHERE pokemon_id='synthetic_B'"),1,'newer acknowledged identity confirmation reverted');
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_A'"),1);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM pokemon_identity_evidence WHERE pokemon_instance_id='instance_B'"),0,'newer acknowledged identity evidence lost');
assert.equal(count(reloaded,"SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
reloaded.close();first.close();second.close();
console.log('PASS G265_SEVENTEENTH_IDENTITY_REVIEW_TWO_ACK_STALE_CONFIRM_AND_EVIDENCE_LOST_NEGATIVE');
console.log('HOLD G265_IDENTITY_REVIEW_LEGACY_UNADMITTED_CROSS_TAB_ANDROID_OWNER_DOD');
