// G265 B-lane isolated durable SQLite reload -> future-Apply review admission regression.
// Synthetic fixture only: no production PWA import, game Apply, player DB or IDB writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {classifyNamedDraftFutureApplyReview as review} from '../assets/js/war-room-named-team-draft-apply-review.js';

const storeSource=readFileSync('assets/js/war-room-named-team-draft-store.js','utf8');
const eligibilitySource=readFileSync('assets/js/war-room-named-team-draft-contract.js','utf8');
const reviewSource=readFileSync('assets/js/war-room-named-team-draft-apply-review.js','utf8');
assert.match(storeSource,/export async function saveNamedTeamDraftLocal\(/);
assert.match(storeSource,/export function readNamedTeamDraft\(/);
assert.doesNotMatch(storeSource,/war-room-named-team-draft-apply-review/);
assert.doesNotMatch(reviewSource,/\b(?:fetch\s*\(|indexedDB\s*[.\[]|localStorage\s*[.\[]|run\s*\(|commit\s*\()/);
const SQL=await initSqlJs();
const createDb=()=>{
  const d=new SQL.Database();
  d.run("CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)");
  d.run("CREATE TABLE strategy_goal_profile(goal_profile_id TEXT PRIMARY KEY,is_active INTEGER,updated_at TEXT)");
  d.run("INSERT INTO strategy_goal_profile VALUES('synthetic-goal',1,'2026-11-02T00:00:00Z')");
  d.run("CREATE TABLE public_master_guard(id INTEGER PRIMARY KEY,value TEXT)");
  d.run("INSERT INTO public_master_guard VALUES(1,'untouched')");
  return d;
};
let db=createDb(),persisted=db.export(),persistMode='ok',persistCount=0,snapshotCount=0;
const memory=new Map();
const sessionStorage={
  getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),
  removeItem:k=>memory.delete(k)
};
const rows=(sql,params=[])=>{
  const stmt=db.prepare(sql);stmt.bind(params);const output=[];
  try{while(stmt.step())output.push(stmt.getAsObject());}
  finally{stmt.free();}
  return output;
};
const activeGoal=()=>rows('SELECT goal_profile_id FROM strategy_goal_profile WHERE is_active=1 ORDER BY updated_at DESC LIMIT 1')[0]?.goal_profile_id??null;
const context=()=>{
  const c={console,Date,sessionStorage,rows,run:(sql,params=[])=>db.run(sql,params),
    begin:()=>db.run('BEGIN IMMEDIATE'),commit:()=>db.run('COMMIT'),
    rollback:()=>{try{db.run('ROLLBACK');}catch{}},
    snapshot:async()=>{snapshotCount++;},
    persist:async()=>{
      persistCount++;
      if(persistMode==='fail-before')throw Error('synthetic_pre_persist_failure');
      persisted=db.export();
      if(persistMode==='fail-after')throw Error('synthetic_ack_lost');
    },
    isDatabaseReady:()=>true,isRescueReadonly:()=>false};
  c.globalThis=c;
  vm.runInNewContext(eligibilitySource.replace(/^export /gm,''),c,{timeout:3000});
  vm.runInNewContext(storeSource.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''),c,{timeout:3000});
  return c;
};
const slots=Array.from({length:5},(_,i)=>({
  slot_index:i,is_leader:i===0,pokemon_id:'synthetic-'+i,
  pokemon_instance_id:'synthetic-instance-'+i,hard_constraint_status:'PASS'
}));
const team={team_status:'READY',team_id:'synthetic-team',input_fingerprint:'team-fp',
  optimizer_version:'synthetic',slots,missing_constraints:[],satisfied_constraints:[]};
const projection={projection_status:'READY',goal_profile_id:'synthetic-goal',
  input_fingerprint:'projection-fp',primary:team,alternatives:[],
  mandatory_member_count:0,mandatory_satisfied_count:0};
const name='合成測試隊伍',draftId='draft_durableReview0001';
const args={draftId,name,projection,team,goalDraftState:'clean',
  capturedAt:'2026-11-02T00:00:00.000Z'};
const key=id=>'war-room:named-team-draft:v1:'+id;
let c=context();
assert.equal((await c.saveNamedTeamDraftLocal(args)).status,'PERSISTED');
assert.equal(snapshotCount,1);assert.equal(persistCount,1);
db=new SQL.Database(persisted);c=context();
const record=c.readNamedTeamDraft(draftId);
assert.equal(record.payload.members.length,5);
const reviewArgs=(r=record,extra={})=>({record:r,projection,team,
  activeGoalProfileId:activeGoal(),reviewedTeamName:name,reviewedDraftId:draftId,...extra});
const check=(r=record,extra={})=>review(reviewArgs(r,extra));
assert.equal(check().reason,'EXPLICIT_FUTURE_APPLY_REVIEW_REQUIRED');
const before=Buffer.from(db.export());
const accepted=check(record,{explicitReviewAcknowledged:true});
assert.equal(accepted.status,'READY_FOR_EXTERNAL_GAME_SIDE_REVIEW_ONLY');
assert.equal(accepted.game_applied,false);assert.equal(accepted.player_data_write,false);
assert.deepEqual(Buffer.from(db.export()),before,'review must not mutate SQLite bytes');
assert.equal(persistCount,1,'review must not invoke persistence');
assert.equal(check(record,{goalDraftState:'dirty',explicitReviewAcknowledged:true}).reason,'UNSAVED_CURRENT_GOAL');
assert.equal(check(record,{activeGoalProfileId:'different',explicitReviewAcknowledged:true}).reason,'ACTIVE_GOAL_PROFILE_CHANGED');
assert.equal(check(record,{reviewedDraftId:'draft_different00000000',explicitReviewAcknowledged:true}).reason,'EXPLICIT_REVIEW_IDENTITY_MISMATCH');
const staleTeam={...team,slots:slots.map((s,i)=>i===4?{...s,pokemon_instance_id:'stale'}:s)};
assert.equal(check(record,{projection:{...projection,primary:staleTeam},team:staleTeam,
  explicitReviewAcknowledged:true}).reason,'CAPTURE_NO_LONGER_MATCHES_CURRENT_PROJECTION');
db.run("UPDATE strategy_goal_profile SET is_active=0 WHERE goal_profile_id='synthetic-goal'");
db.run("INSERT INTO strategy_goal_profile VALUES('new-goal',1,'2026-11-02T01:00:00Z')");
assert.equal(check(record,{explicitReviewAcknowledged:true}).reason,'ACTIVE_GOAL_PROFILE_CHANGED');
db=new SQL.Database(persisted);c=context();
const tampered=structuredClone(c.readNamedTeamDraft(draftId));
tampered.payload.members[0].pokemon_instance_id='synthetic-tampered';
db.run('UPDATE settings SET value_json=? WHERE key=?',[JSON.stringify(tampered),key(draftId)]);
assert.equal(check(c.readNamedTeamDraft(draftId),{explicitReviewAcknowledged:true}).status,'HOLD');
assert.equal(rows('SELECT value FROM public_master_guard WHERE id=1')[0].value,'untouched');
db=new SQL.Database(persisted);c=context();
persistMode='fail-before';
const failedId='draft_durableReview0002';
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:failedId}),{code:'PERSISTENCE_UNCERTAIN'});
assert.equal(c.getNamedTeamDraftPersistenceStatus().status,'UNVERIFIED');
db=new SQL.Database(persisted);c=context();
assert.equal(c.getNamedTeamDraftPersistenceStatus().status,'NOT_PERSISTED');
assert.equal(c.readNamedTeamDraft(failedId),null);
assert.equal(check(null,{explicitReviewAcknowledged:true}).status,'HOLD');
persistMode='fail-after';
const lostAckId='draft_durableReview0003';
await assert.rejects(c.saveNamedTeamDraftLocal({...args,draftId:lostAckId}),{code:'PERSISTENCE_UNCERTAIN'});
assert.equal(c.getNamedTeamDraftPersistenceStatus().status,'UNVERIFIED');
db=new SQL.Database(persisted);c=context();
assert.equal(c.getNamedTeamDraftPersistenceStatus().status,'PERSISTED');
const recovered=c.readNamedTeamDraft(lostAckId);
assert.equal(review(reviewArgs(recovered,{reviewedDraftId:lostAckId})).reason,'EXPLICIT_FUTURE_APPLY_REVIEW_REQUIRED');
assert.equal(review(reviewArgs(recovered,{reviewedDraftId:lostAckId,explicitReviewAcknowledged:true})).status,
  'READY_FOR_EXTERNAL_GAME_SIDE_REVIEW_ONLY');
assert.equal(rows('SELECT value FROM public_master_guard WHERE id=1')[0].value,'untouched');
console.log('PASS G265_NAMED_DRAFT_DURABLE_RELOAD_REVIEW_POSITIVE_STALE_GOAL_TAMPER_PREPOST_ACK_LOSS');
console.log('HOLD G265_PRODUCTION_DURABLE_ADMISSION_23_LEGACY_WRITERS_CRASH_RESTORE_ANDROID');
