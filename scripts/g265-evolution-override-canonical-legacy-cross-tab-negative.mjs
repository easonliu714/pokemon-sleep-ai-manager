// G265 distinct canonical Legacy Writer: analysis-confirmation-evolution-authority.js::persistAppliedOverride().
// Executes the unchanged production event writer against disposable SQL.js databases in two isolated VM tabs.
// A delayed stale full-image persist can erase B's acknowledged per-Pokemon evolution override and history.
// PASS intentionally reproduces UNSAFE behavior. It is NOT production admission or Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/analysis-confirmation-evolution-authority.js',import.meta.url),'utf8');
function exactSlice(start,end){
  assert.equal(source.split(start).length,2,'production start boundary changed: '+start);
  assert.equal(source.split(end).length,2,'production end boundary changed: '+end);
  return source.slice(source.indexOf(start),source.indexOf(end)).replace(/^export /gm,'');
}
const helpers=exactSlice('const text=', 'const clone=')
  +exactSlice('function requirementFieldsFrom(', 'function draftHasExplicitOverrideMode(')
  +exactSlice('export function normalizePlayerEvolutionOverride(', 'export function getPersistedPlayerEvolutionOverride(');
const writer=exactSlice('async function persistAppliedOverride(', '\nfunction installPlayerEvolutionOverrideUi(');
for(const marker of [/await snapshot\(/,/begin\(\)/,/INSERT INTO pokemon_evolution_override/,
  /UPDATE pokemon SET evolution_level_required=/,/INSERT INTO pokemon_history/,
  /commit\(\);await persist\(\)/,/player_evolution_override_persisted/])
  assert.match(writer,marker,'must exercise the exact production write/ACK path');
assert.doesNotMatch(writer,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
assert.match(source,/addEventListener\('pokemon-sleep:analysis-confirmed-applied',event=>\{void persistAppliedOverride\(event\);/);
console.log('PASS G265_EVOLUTION_OVERRIDE_CANONICAL_EXACT_LEGACY_EVENT_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,evolution_level_required INTEGER,evolution_sleep_hours_required REAL,evolution_candy_required INTEGER,evolution_item_required TEXT,evolution_other_requirement TEXT)');
seed.run('CREATE TABLE pokemon_evolution_override(pokemon_id TEXT PRIMARY KEY,authority_mode TEXT NOT NULL,override_status TEXT,target_override TEXT,override_reason TEXT,required_level INTEGER,required_sleep_hours REAL,required_candy INTEGER,required_item TEXT,other_requirement TEXT,source_analysis_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
seed.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO pokemon(pokemon_id) VALUES('synthetic_A'),('synthetic_B')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
const scalar=(db,sql)=>db.exec(sql)[0].values[0][0];
const rows=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
let enteredFirst,releaseFirst;
const firstEntered=new Promise(resolve=>{enteredFirst=resolve;});
let acknowledged=0,snapshots=0,successTraces=0,errors=0;
function tab(label,hold){
  const local=new SQL.Database(new Uint8Array(durable));
  const group='group_'+label,pokemon='synthetic_'+label;
  const groupOverrideState=new Map([[group,{
    evolution_authority_mode:'PLAYER_OVERRIDE',
    evolution_override_status:'CUSTOM_REQUIREMENTS',
    evolution_target_override:label==='A'?'synthetic_A_next':'synthetic_B_next',
    evolution_override_reason:'synthetic fixture',
    custom_requirements:{evolution_level_required:label==='A'?18:29,evolution_candy_required:label==='A'?40:80}
  }]]);
  const statusNode={className:'',textContent:''};
  const context=vm.createContext({
    groupOverrideState,
    PLAYER_OVERRIDE:'PLAYER_OVERRIDE',PUBLIC_MASTER:'PUBLIC_MASTER',
    CUSTOM_REQUIREMENTS:'CUSTOM_REQUIREMENTS',CANNOT_EVOLVE:'CANNOT_EVOLVE',
    ensurePlayerOverrideTable:()=>true, // Table pre-created in synthetic fixture; unrelated bootstrap write excluded.
    readOverrideRow:id=>rows(local,'SELECT * FROM pokemon_evolution_override WHERE pokemon_id=?',[id])[0]||null,
    snapshot:async reason=>{assert.equal(reason,'before_player_evolution_override_'+pokemon);snapshots++;return {status:'SYNTHETIC'};},
    begin:()=>local.run('BEGIN IMMEDIATE'),
    commit:()=>local.run('COMMIT'),
    rollback:()=>{try{local.run('ROLLBACK');}catch{}},
    run:(sql,params=[])=>local.run(sql,params),
    persist:async()=>{
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;enteredFirst();});
      durable=bytes;acknowledged++;
    },
    nowIso:()=>label==='A'?'2026-11-02T03:01:01.000+08:00':'2026-11-02T03:01:02.000+08:00',
    document:{querySelector:selector=>selector==='#analysisConfirmationStatus'?statusNode:null},
    DebugTrace:{record:(_category,event)=>{if(event==='player_evolution_override_persisted')successTraces++;else if(event==='player_evolution_override_persist_failed')errors++;}},
    Date,JSON,Number,String,Object,Promise,Error,console
  });
  vm.runInContext(helpers+'\n'+writer+'\n;globalThis.__persistAppliedOverride=persistAppliedOverride;',context,{timeout:3000});
  return {
    apply:()=>context.__persistAppliedOverride({detail:{group_id:group,pokemon_id:pokemon,analysis_id:'synthetic_analysis_'+label}}),
    close:()=>local.close()
  };
}
const first=tab('A',true);
const pending=first.apply();
await firstEntered;
const second=tab('B',false);
await second.apply();
assert.equal(acknowledged,1,'B must receive its own durable ACK');
let reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT required_level FROM pokemon_evolution_override WHERE pokemon_id='synthetic_B'"),29);
assert.equal(scalar(reloaded,"SELECT evolution_level_required FROM pokemon WHERE pokemon_id='synthetic_B'"),29);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B' AND event_type='player_evolution_override_applied'"),1);
reloaded.close();

releaseFirst();
await pending;
assert.equal(acknowledged,2,'both unchanged Legacy Writers ACK the same durable image');
assert.equal(snapshots,2);
assert.equal(successTraces,2);
assert.equal(errors,0);
reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT required_level FROM pokemon_evolution_override WHERE pokemon_id='synthetic_A'"),18);
assert.equal(scalar(reloaded,"SELECT evolution_level_required FROM pokemon WHERE pokemon_id='synthetic_A'"),18);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_A'"),1);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_evolution_override WHERE pokemon_id='synthetic_B'"),0,'B acknowledged override lost');
assert.equal(scalar(reloaded,"SELECT evolution_level_required FROM pokemon WHERE pokemon_id='synthetic_B'"),null,'B acknowledged instance field lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B'"),0,'B acknowledged audit history lost');
assert.equal(scalar(reloaded,"SELECT value FROM synthetic_public_master WHERE id='public'"),'IMMUTABLE');
reloaded.close();first.close();second.close();
console.log('PASS G265_EVOLUTION_OVERRIDE_TWO_ACK_STALE_INSTANCE_OVERRIDE_AND_HISTORY_LOST_NEGATIVE');
console.log('HOLD G265_EVOLUTION_OVERRIDE_CANONICAL_LEGACY_UNADMITTED_NO_ANDROID_OWNER_DOD');
