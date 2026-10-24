import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

// Source-bound G265 fixture: actual SQLite settings rows + exported/reloaded bytes;
// no player DB, IndexedDB, network, public-master or game-side writes.
const SQL=await initSqlJs();
const contract=fs.readFileSync('assets/js/war-room-named-team-draft-contract.js','utf8');
const source=fs.readFileSync('assets/js/war-room-named-team-draft-store.js','utf8');
assert.match(source,/INSERT INTO settings\(key,value_json,updated_at\)/);
// Reject executable storage/network access; comments about IndexedDB are not API calls.
assert.doesNotMatch(source.replace(/^\/\/.*$/gm,''),/\bfetch\s*\(|\bindexedDB\s*[.\[]|DELETE FROM|UPDATE\s+pokemon|INSERT INTO\s+pokemon/i);
const storage=new Map();
const sessionStorage={
  getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),
};
const dbInit=()=>{
  const db=new SQL.Database();
  db.run("CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL);");
  db.run("CREATE TABLE strategy_goal_profile(goal_profile_id TEXT PRIMARY KEY,is_active INTEGER,updated_at TEXT);");
  db.run("INSERT INTO strategy_goal_profile VALUES('goal_fixture',1,'2026-10-25T00:00:00Z');");
  db.run("CREATE TABLE public_master_guard(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO public_master_guard VALUES(1,'immutable');");
  return db;
};
let db=dbInit(),persisted=db.export(),persistMode='ok',snapshotMode='ok',snapshotCount=0,persistCount=0;
let releaseSnapshot=null;
const rows=(sql,params=[])=>{const stmt=db.prepare(sql);stmt.bind(params);const out=[];while(stmt.step())out.push(stmt.getAsObject());stmt.free();return out;};
const run=(sql,params=[])=>db.run(sql,params);
const snapshot=async()=>{
  snapshotCount++;
  if(snapshotMode==='fail')throw Error('snapshot_failed');
  if(snapshotMode==='wait')await new Promise(resolve=>{releaseSnapshot=resolve;});
};
const persist=async()=>{
  persistCount++;
  if(persistMode==='fail-before')throw Error('idb_failed_before_write');
  persisted=db.export();
  if(persistMode==='fail-after')throw Error('idb_result_uncertain');
};
const ctx=()=>({console,Date,sessionStorage,rows,run,
  begin:()=>db.run('BEGIN IMMEDIATE'),commit:()=>db.run('COMMIT'),rollback:()=>{try{db.run('ROLLBACK');}catch{}},
  snapshot,persist,isDatabaseReady:()=>true,isRescueReadonly:()=>false});
function load(){
  const c=ctx();c.globalThis=c;
  vm.runInNewContext(contract.replace(/^export /gm,''),c,{timeout:3000});
  vm.runInNewContext(source.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''),c,{timeout:3000});
  return c;
}
const slots=Array.from({length:5},(_,i)=>({slot_index:i,is_leader:i===0,pokemon_id:'private-'+i,pokemon_instance_id:'instance-'+i,hard_constraint_status:'PASS'}));
const team={team_status:'READY',team_id:'team:1',input_fingerprint:'team:abc',optimizer_version:'fixture',slots,missing_constraints:[],satisfied_constraints:[]};
const projection={projection_status:'READY',goal_profile_id:'goal_fixture',input_fingerprint:'projection:abc',primary:team,alternatives:[],mandatory_member_count:0,mandatory_satisfied_count:0};
const args={draftId:'draft_aaaaaaaaaaaaaaaa',name:'本週能量最大化',projection,team,goalDraftState:'clean',capturedAt:'2026-10-25T00:00:00.000Z'};
let c=load();
assert.equal((await c.saveNamedTeamDraftLocal(args)).status,'PERSISTED');
assert.equal(c.readNamedTeamDraft(args.draftId).payload.team_name,args.name);
assert.equal(snapshotCount,1);assert.equal(persistCount,1);
assert.equal((await c.saveNamedTeamDraftLocal(args)).status,'ALREADY_PERSISTED');
assert.equal(snapshotCount,1);assert.equal(persistCount,1);
await assert.rejects(c.saveNamedTeamDraftLocal({...args,name:'不同名稱'}),{code:'DRAFT_ID_COLLISION'});
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:'bad'}),{code:'INVALID_DRAFT_ID'});
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:'draft_bbbbbbbbbbbbbbbb',goalDraftState:'dirty'}),{code:'ELIGIBILITY_GOAL_PROFILE_UNSAVED_OR_INVALID'});
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:'draft_bbbbbbbbbbbbbbbb',projection:{...projection,goal_profile_id:'stale'}}),{code:'ACTIVE_GOAL_PROFILE_CHANGED'});
assert.equal(rows('SELECT value FROM public_master_guard WHERE id=1')[0].value,'immutable');
db=new SQL.Database(persisted);c=load();
assert.equal(c.readNamedTeamDraft(args.draftId).payload.members.length,5);
snapshotMode='fail';
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:'draft_bbbbbbbbbbbbbbbb'}),/snapshot_failed/);
assert.equal(c.readNamedTeamDraft('draft_bbbbbbbbbbbbbbbb'),null);
snapshotMode='wait';
const pending=c.saveNamedTeamDraftLocal({...args,draftId:'draft_cccccccccccccccc'});
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:'draft_dddddddddddddddd'}),{code:'NAMED_DRAFT_SAVE_IN_FLIGHT'});
releaseSnapshot();await pending;snapshotMode='ok';
persistMode='fail-before';
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:'draft_eeeeeeeeeeeeeeee'}),{code:'PERSISTENCE_UNCERTAIN'});
assert.equal(c.getNamedTeamDraftPersistenceStatus().status,'UNVERIFIED');
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:'draft_ffffffffffffffff'}),{code:'PERSISTENCE_UNCERTAIN'});
db=new SQL.Database(persisted);c=load();
assert.equal(c.getNamedTeamDraftPersistenceStatus().status,'NOT_PERSISTED');
assert.equal(c.readNamedTeamDraft('draft_eeeeeeeeeeeeeeee'),null);
persistMode='fail-after';
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:'draft_gggggggggggggggg'}),{code:'PERSISTENCE_UNCERTAIN'});
db=new SQL.Database(persisted);c=load();
assert.equal(c.getNamedTeamDraftPersistenceStatus().status,'PERSISTED');
assert.equal(c.readNamedTeamDraft('draft_gggggggggggggggg').payload.game_applied,false);
assert.equal(rows('SELECT value FROM public_master_guard WHERE id=1')[0].value,'immutable');
console.log('PASS G265_NAMED_DRAFT_SQLITE_SETTINGS_SOURCE_BOUND_RELOAD_IDEMPOTENCY_UNCERTAIN');
console.log('HOLD G265_RUNTIME_UI_BINDING_ANDROID_UAT_AND_CROSS_MODULE_WRITE_COORDINATION_NOT_VERIFIED');
