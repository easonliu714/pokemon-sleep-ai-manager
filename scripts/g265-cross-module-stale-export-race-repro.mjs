import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// G265 HISTORICAL negative fixture deliberately simulates old uncoordinated
// export-before-save, not the fixed production database.persist().
const store=fs.readFileSync('assets/js/war-room-named-team-draft-store.js','utf8');
const contract=fs.readFileSync('assets/js/war-room-named-team-draft-contract.js','utf8');
const database=fs.readFileSync('assets/js/database.js','utf8');
assert.match(store,/await persist\(\)/);
assert.match(database,/createSqlitePersistCoordinator/);
assert.match(database,/sqlitePersistCoordinator\.persist\(\)/);
assert.doesNotMatch(database,/const exported=db\.export\(\);await timeout\(saveDatabaseBytes\(exported\)/);
const values=new Map();
let persisted='[]',persistCalls=0,releaseFirstPersist=null;
const rows=(sql,params=[])=>{
  if(sql.startsWith('SELECT goal_profile_id FROM strategy_goal_profile'))
    return [{goal_profile_id:'goal_fixture'}];
  if(sql.startsWith('SELECT value_json FROM settings WHERE key=')){
    const value=values.get(params[0]);
    return value===undefined?[]:[{value_json:value}];
  }
  throw Error('UNEXPECTED_READ_SQL');
};
const run=(sql,params=[])=>{
  if(['BEGIN IMMEDIATE','COMMIT','ROLLBACK'].includes(sql))return;
  if(sql.startsWith('INSERT INTO settings(')){
    if(values.has(params[0]))throw Error('duplicate_key');
    values.set(params[0],params[1]);return;
  }
  throw Error('UNEXPECTED_WRITE_SQL');
};
const persist=async()=>{
  // Historical uncoordinated persist captured bytes before awaited IDB save.
  // Here the same byte-capture and completion ordering is controlled.
  const captured=JSON.stringify([...values.entries()]);
  const index=++persistCalls;
  if(index===1)await new Promise(resolve=>{releaseFirstPersist=resolve;});
  persisted=captured;
};
const session=new Map();
const c={console,Date,rows,run,persist,snapshot:async()=>{},
  begin:()=>run('BEGIN IMMEDIATE'),commit:()=>run('COMMIT'),rollback:()=>run('ROLLBACK'),
  isDatabaseReady:()=>true,isRescueReadonly:()=>false,
  sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)}};
c.globalThis=c;
vm.runInNewContext(contract.replace(/^export /gm,''),c,{timeout:3000});
vm.runInNewContext(store.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''),c,{timeout:3000});
const slots=Array.from({length:5},(_,i)=>({slot_index:i,is_leader:i===0,pokemon_id:'individual-'+i,pokemon_instance_id:'instance-'+i,hard_constraint_status:'PASS'}));
const team={team_status:'READY',team_id:'team:fixture',input_fingerprint:'team:fixture',optimizer_version:'fixture',slots,missing_constraints:[],satisfied_constraints:[]};
const projection={projection_status:'READY',goal_profile_id:'goal_fixture',input_fingerprint:'projection:fixture',primary:team,alternatives:[],mandatory_member_count:0,mandatory_satisfied_count:0};
const draftId='draft_aaaaaaaaaaaaaaaa';
const pending=c.saveNamedTeamDraftLocal({draftId,name:'本週能量最大化',projection,team,goalDraftState:'clean',capturedAt:'2026-10-25T00:00:00.000Z'});
for(let i=0;i<30&&persistCalls<1;i++)await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(persistCalls,1,'G265 must reach first in-flight IDB persist');
assert.equal(typeof releaseFirstPersist,'function');
const otherKey='independent-writer:synthetic';
run('INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?)',[otherKey,'{"synthetic":true}','2026-10-25T00:00:01Z']);
await persist(); // Another module's later export finishes first.
assert.equal(new Map(JSON.parse(persisted)).has(otherKey),true);
releaseFirstPersist(); // Older G265 export finishes last and overwrites it.
assert.equal((await pending).status,'PERSISTED');
assert.equal(values.has(otherKey),true,'in-memory state contains the other writer');
const reloaded=new Map(JSON.parse(persisted));
assert.equal(reloaded.has(otherKey),false,'stale persisted bytes lost the other writer');
assert.equal(reloaded.has('war-room:named-team-draft:v1:'+draftId),true);
console.log('PASS G265_HISTORICAL_UNCOORDINATED_STALE_EXPORT_NEGATIVE_REPRODUCED');
console.log('PASS G265_PRODUCTION_SOURCE_NOW_USES_SHARED_COORDINATOR');
console.log('HOLD G265_ANDROID_OWNER_UAT_AND_RUNTIME_UI_BINDING');
