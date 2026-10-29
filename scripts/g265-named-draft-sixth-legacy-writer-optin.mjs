// G265 sixth named-team-draft isolated SQL.js + fake IndexedDB CAS regression.
// Source-bound to the unchanged legacy writer; no player database or production wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createNamedTeamDraftOptIn} from '../assets/js/sqlite-named-team-draft-optin.js';

const source=fs.readFileSync(new URL('../assets/js/war-room-named-team-draft-store.js',import.meta.url),'utf8');
const exact=source.split('export async function saveNamedTeamDraftLocal(')[1];
assert.ok(exact,'sixth exact legacy writer must remain identifiable');
assert.match(exact,/await snapshot\('war-room:named-team-draft:'/);
assert.match(exact,/await persist\(\)/);
assert.match(exact,/INSERT INTO settings\(key,value_json,updated_at\)/);
assert.doesNotMatch(source,/sqlite-named-team-draft-optin/);
console.log('PASS G265_SIXTH_NAMED_DRAFT_EXACT_LEGACY_SOURCE_UNCHANGED_OPTIN_NOT_WIRED');

const SQL=await initSqlJs();
const initial=new SQL.Database();
initial.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
initial.run('CREATE TABLE strategy_goal_profile(goal_profile_id TEXT PRIMARY KEY,is_active INTEGER,updated_at TEXT)');
initial.run("INSERT INTO strategy_goal_profile VALUES('goal-fixture',1,'2026-10-29T00:00:00.000Z')");
initial.run("INSERT INTO settings VALUES('unrelated','{\"guard\":true}','2026-10-29T00:00:00.000Z')");
initial.run("CREATE TRIGGER deny_named_draft_fixture BEFORE INSERT ON settings WHEN NEW.key='war-room:named-team-draft:v1:draft_TTTTTTTTTTTTTTTT' BEGIN SELECT RAISE(ABORT,'synthetic-draft-insert-rejection'); END");
const seed=new Uint8Array(initial.export());initial.close();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedHash=await hash(seed);
const db=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('g265-sixth-named-draft-disposable-cas',1);
  request.onupgradeneeded=()=>{
    request.result.createObjectStore('database');
    request.result.createObjectStore('metadata');
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});
await new Promise((resolve,reject)=>{
  const tx=db.transaction(['database','metadata'],'readwrite');
  tx.objectStore('database').put(seed.slice().buffer,'primary');
  tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
let queue=Promise.resolve(),opened=0;
const locks={request(_name,_options,callback){
  const next=queue.then(()=>callback({mode:'exclusive'}));
  queue=next.catch(()=>{});return next;
}};
const make=(locksOverride=locks)=>{
  const pairGate=createSqliteVersionNeutralAtomicPairGate({db,locks:locksOverride,fingerprint:hash});
  return createNamedTeamDraftOptIn({pairGate,openSqlite:bytes=>{
    opened++;return new SQL.Database(bytes);
  }});
};
const durable=()=>new Promise((resolve,reject)=>{
  const tx=db.transaction(['database','metadata'],'readonly');
  const raw=tx.objectStore('database').get('primary');
  const rev=tx.objectStore('metadata').get('revision:primary');
  tx.oncomplete=()=>resolve({bytes:new Uint8Array(raw.result),revision:rev.result});
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
const read=async()=>{
  const pair=await durable();
  assert.equal(await hash(pair.bytes),pair.revision.sha256);
  const sql=new SQL.Database(pair.bytes);
  const settings=sql.exec('SELECT key,value_json FROM settings ORDER BY key')?.[0]?.values||[];
  sql.close();return {...pair,settings};
};
const slots=Array.from({length:5},(_,i)=>({
  slot_index:i,is_leader:i===0,pokemon_id:'synthetic-species-'+i,
  pokemon_instance_id:'synthetic-instance-'+i,hard_constraint_status:'PASS'
}));
const team={team_status:'READY',team_id:'team-fixture',
  input_fingerprint:'team-input-fixture',optimizer_version:'fixture-v1',
  slots,missing_constraints:[],satisfied_constraints:[]};
const projection={projection_status:'READY',goal_profile_id:'goal-fixture',
  input_fingerprint:'projection-fixture',primary:team,alternatives:[],
  mandatory_member_count:0,mandatory_satisfied_count:0};
const input={draftId:'draft_AAAAAAAAAAAAAAAA',name:'Synthetic Alpha',
  projection,team,goalDraftState:'clean',capturedAt:'2026-10-29T00:00:00.000Z',
  expectedGeneration:0,expectedFingerprint:seedHash};
const invalid=make();
for(const bad of [
  {...input,draftId:'bad'},
  {...input,capturedAt:null},
  {...input,capturedAt:'2026-02-30T00:00:00.000Z'},
  {...input,goalDraftState:'dirty'},
  {...input,name:''}
]){
  await assert.rejects(invalid.execute(bad),e=>String(e.code||'').startsWith('G265_NAMED_DRAFT_'));
}
assert.equal(opened,0);
assert.equal((await read()).revision.generation,0);
console.log('PASS G265_SIXTH_NAMED_DRAFT_INVALID_ELIGIBILITY_PRE_SQL_ZERO_DURABLE_DELTA');

const first=await make().execute(input);
assert.equal(first.status,'PERSISTED');
assert.equal(first.generation,1);
assert.equal(first.gameApplied,false);
const afterFirst=await read();
assert.equal(afterFirst.revision.generation,1);
assert.equal(afterFirst.revision.sha256,first.sha256);
assert.equal(afterFirst.settings.length,2);
const saved=JSON.parse(afterFirst.settings.find(row=>row[0].endsWith(input.draftId))[1]);
assert.equal(saved.payload.team_name,'Synthetic Alpha');
assert.equal(saved.payload.members.length,5);
assert.equal(saved.local_only,true);
assert.equal(saved.game_applied,false);
assert.ok(afterFirst.settings.some(row=>row[0]==='unrelated'));
console.log('PASS G265_SIXTH_NAMED_DRAFT_FRESH_DURABLE_SQLJS_CAS_LOGICAL_ROW_ACK');

const a=make(),b=make(),beforeRaceOpen=opened;
const second={...input,draftId:'draft_BBBBBBBBBBBBBBBB',name:'Synthetic Beta',
  capturedAt:'2026-10-29T00:01:00.000Z',
  expectedGeneration:1,expectedFingerprint:first.sha256};
const [winner,stale]=await Promise.allSettled([
  a.execute(second),b.execute({...second,draftId:'draft_CCCCCCCCCCCCCCCC',name:'Synthetic Gamma'})
]);
assert.equal(winner.status,'fulfilled');
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
assert.equal(b.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeRaceOpen+2,'stale writer must not open SQL.js');
const afterRace=await read();
assert.equal(afterRace.revision.generation,2);
assert.equal(afterRace.settings.length,3);
assert.ok(afterRace.settings.some(row=>row[0].endsWith(input.draftId)));
assert.ok(afterRace.settings.some(row=>row[0].endsWith(second.draftId)));
console.log('PASS G265_SIXTH_NAMED_DRAFT_TWO_WRITERS_ONE_ACK_STALE_ZERO_SQLJS_NO_LOST_DRAFT');

const third=await make().execute({...second,draftId:'draft_CCCCCCCCCCCCCCCC',
  name:'Synthetic Gamma',capturedAt:'2026-10-29T00:02:00.000Z',
  expectedGeneration:2,expectedFingerprint:winner.value.sha256});
const afterThird=await read();
assert.equal(afterThird.revision.generation,3);
assert.equal(afterThird.settings.length,4);
assert.ok(afterThird.settings.some(row=>row[0].endsWith('draft_CCCCCCCCCCCCCCCC')));
console.log('PASS G265_SIXTH_NAMED_DRAFT_EXPLICIT_FRESH_RELOAD_PRESERVES_ALL_ACKED_ROWS');

const stable=await read();
const current={...input,expectedGeneration:3,expectedFingerprint:third.sha256};
const duplicate=make();
await assert.rejects(duplicate.execute(current),e=>e.code==='G265_NAMED_DRAFT_DUPLICATE_OR_COLLISION_REPLAY');
assert.equal(duplicate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const changedGoal=make();
await assert.rejects(changedGoal.execute({...current,draftId:'draft_DDDDDDDDDDDDDDDD',
  projection:{...projection,goal_profile_id:'not-active'}}),
  e=>e.code==='G265_NAMED_DRAFT_ACTIVE_GOAL_CHANGED');
const rollback=make();
await assert.rejects(rollback.execute({...current,draftId:'draft_TTTTTTTTTTTTTTTT'}),
  e=>String(e.message||'').includes('synthetic-draft-insert-rejection'));
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal((await read()).revision.sha256,stable.revision.sha256);
assert.equal((await read()).settings.length,stable.settings.length);
console.log('PASS G265_SIXTH_NAMED_DRAFT_DUPLICATE_GOAL_CHANGE_SQL_ROLLBACK_ZERO_DURABLE_DELTA');

const noLocks=make(null),beforeNoLocks=opened;
await assert.rejects(noLocks.execute({...current,draftId:'draft_EEEEEEEEEEEEEEEE'}),
  e=>e.code==='G265_PAIR_WEB_LOCKS_UNAVAILABLE');
assert.equal(noLocks.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(opened,beforeNoLocks);
assert.equal((await read()).revision.sha256,stable.revision.sha256);
console.log('PASS G265_SIXTH_NAMED_DRAFT_NO_WEB_LOCKS_FAIL_CLOSED');
db.close();
console.log('HOLD G265_SIXTH_LEGACY_PRODUCTION_UNADMITTED_NAMED_DRAFT_APPLY_ANDROID_UAT');
