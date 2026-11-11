// G265 B-lane: synthetic two-tab durable CAS for the unchanged Named Draft local writer.
// Source/Test only. This is NOT a production Web Locks wrapper or a game-side Apply.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {createSqliteCrossTabWriteAdmission} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {classifyNamedDraftFutureApplyReview} from '../assets/js/war-room-named-team-draft-apply-review.js';

const storeSource=readFileSync('assets/js/war-room-named-team-draft-store.js','utf8');
const contractSource=readFileSync('assets/js/war-room-named-team-draft-contract.js','utf8');
const admissionSource=readFileSync('assets/js/sqlite-cross-tab-write-admission.js','utf8');
for(const pattern of [/export async function saveNamedTeamDraftLocal\(/,
  /await snapshot\(/,/begin\(\)/,/INSERT INTO settings\(/,/commit\(\)/,/persist\(\{primaryMutationLease:lease\}\)/,
  /POST_PERSIST_READBACK_MISMATCH/,/PERSISTENCE_UNCERTAIN/])
  assert.match(storeSource,pattern,'unchanged production Named Draft writer required');
assert.match(admissionSource,/observed!==expectedFingerprint/);
assert.match(admissionSource,/SQLITE_CROSS_TAB_POST_WRITE_DURABLE_MISMATCH/);
assert.doesNotMatch(storeSource,/sqlite-cross-tab-write-admission/,'test-only adapter must not be wired into runtime');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
seed.run('CREATE TABLE strategy_goal_profile(goal_profile_id TEXT PRIMARY KEY,is_active INTEGER,updated_at TEXT)');
seed.run("INSERT INTO strategy_goal_profile VALUES('synthetic-goal',1,'2026-11-02T00:00:00Z')");
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO synthetic_public_master VALUES('master','IMMUTABLE')");
let durable=new Uint8Array(seed.export());
seed.close();
const digest=async bytes=>createHash('sha256').update(bytes).digest('hex');
const readDurable=async()=>new Uint8Array(durable);
const snapshot=()=>new Uint8Array(durable);
const key=id=>'war-room:named-team-draft:v1:'+id;
const count=()=>{const d=new SQL.Database(durable);try{
  return d.exec("SELECT COUNT(*) FROM settings WHERE key LIKE 'war-room:named-team-draft:v1:%'")[0].values[0][0];
}finally{d.close();}};
const publicMaster=()=>{const d=new SQL.Database(durable);try{
  return d.exec("SELECT value FROM synthetic_public_master WHERE id='master'")[0].values[0][0];
}finally{d.close();}};

// Shared lock queue models two independent tabs requesting one exclusive Web Lock.
// No per-tab mutex is accepted as proof of cross-tab exclusion.
let tail=Promise.resolve(),lockEntries=0;
const locks={request(_name,options,callback){
  assert.equal(options.mode,'exclusive');
  const operation=tail.then(async()=>{lockEntries++;return callback({name:_name});});
  tail=operation.catch(()=>{});
  return operation;
}};
const makeGate=(lockApi=locks)=>createSqliteCrossTabWriteAdmission({
  locks:lockApi,readDurable,fingerprint:digest,timeoutMs:5000
});
const slots=Array.from({length:5},(_,i)=>({
  slot_index:i,is_leader:i===0,pokemon_id:'synthetic-'+i,
  pokemon_instance_id:'synthetic-instance-'+i,hard_constraint_status:'PASS'
}));
const team={team_status:'READY',team_id:'synthetic-team',input_fingerprint:'team-fp',
  optimizer_version:'synthetic',slots,missing_constraints:[],satisfied_constraints:[]};
const projection={projection_status:'READY',goal_profile_id:'synthetic-goal',
  input_fingerprint:'projection-fp',primary:team,alternatives:[],
  mandatory_member_count:0,mandatory_satisfied_count:0};
const name='隔離合成隊伍';
const args=id=>({draftId:id,name,projection,team,goalDraftState:'clean',
  capturedAt:'2026-11-02T00:00:00.000Z'});
const ids=['draft_nativecas00000001','draft_nativecas00000002',
  'draft_nativecas00000003','draft_nativecas00000004','draft_nativecas00000005'];

function loadWriter(bytes,options={}){
  const db=new SQL.Database(bytes),memory=new Map();
  let sqlWrites=0,persistCalls=0,rollbacks=0;
  const sessionStorage={
    getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),
    removeItem:k=>memory.delete(k)
  };
  const rows=(sql,params=[])=>{
    const stmt=db.prepare(sql);stmt.bind(params);const result=[];
    try{while(stmt.step())result.push(stmt.getAsObject());}
    finally{stmt.free();}
    return result;
  };
  const context={console,Date,sessionStorage,rows,
    run(sql,params=[]){
      if(options.failInsert&&sql.includes('INSERT INTO settings('))
        throw Error('SYNTHETIC_PRE_COMMIT_INSERT_FAILURE');
      sqlWrites++;db.run(sql,params);
    },
    begin:()=>db.run('BEGIN IMMEDIATE'),
    commit:()=>db.run('COMMIT'),
    rollback:()=>{rollbacks++;try{db.run('ROLLBACK');}catch{}},
    snapshot:async()=>({synthetic:true}),
    persist:async()=>{
      persistCalls++;
      if(options.failBeforeDurable)throw Error('SYNTHETIC_DURABLE_WRITE_REJECTED');
      durable=new Uint8Array(db.export());
      if(options.loseAck)throw Error('SYNTHETIC_ACK_LOST_AFTER_DURABLE_WRITE');
    },
    isDatabaseReady:()=>true,isRescueReadonly:()=>false,
    withPrimarySqliteMutationLock:async fn=>fn(Object.freeze({})),
    beginSqliteExclusiveWriteWindow:()=>()=>{},
    withSqliteCoordinatedMutation:fn=>fn(),};
  context.globalThis=context;
  vm.runInNewContext(contractSource.replace(/^export /gm,''),context,{timeout:3000});
  vm.runInNewContext(storeSource.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''),context,{timeout:3000});
  return {context,db,rows,metrics:()=>({sqlWrites,persistCalls,rollbacks})};
}
let writerEntries=0;
async function admitted(gate,id,expected,options={}){
  return gate.execute({reason:'synthetic-named-draft-'+id,expectedFingerprint:expected,
    writeUnderLock:async({latestBytes,observedFingerprint})=>{
      assert.equal(await digest(latestBytes),observedFingerprint);
      writerEntries++;
      const writer=loadWriter(latestBytes,options);
      try{
        const result=await writer.context.saveNamedTeamDraftLocal(args(id));
        assert.equal(result.status,'PERSISTED');
        assert.equal(writer.context.readNamedTeamDraft(id).payload.members.length,5);
        return {persistedBytes:snapshot()};
      }finally{writer.db.close();}
    }});
}
const baseline=await digest(durable);
const firstGate=makeGate(),staleGate=makeGate();
const [first,stale]=await Promise.allSettled([
  admitted(firstGate,ids[0],baseline),
  admitted(staleGate,ids[1],baseline)
]);
assert.equal(first.status,'fulfilled');
assert.equal(first.value.status,'PERSISTED');
assert.equal(stale.status,'rejected');
assert.equal(stale.reason.code,'SQLITE_CROSS_TAB_STALE_DURABLE_RELOAD_REQUIRED');
assert.equal(staleGate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(writerEntries,1,'stale tab must not enter production writer');
assert.equal(count(),1);
assert.equal(publicMaster(),'IMMUTABLE');
const afterFirst=await digest(durable);
assert.notEqual(afterFirst,baseline);

// A genuinely fresh durable read can admit another independent synthetic tab.
const fresh=await admitted(makeGate(),ids[1],afterFirst);
assert.equal(fresh.status,'PERSISTED');
assert.equal(count(),2);
const afterSecond=await digest(durable);

// Pre-COMMIT SQL failure rolls back and leaves durable bytes unchanged.
const preCommitGate=makeGate();
await assert.rejects(admitted(preCommitGate,ids[2],afterSecond,{failInsert:true}),
  /SYNTHETIC_PRE_COMMIT_INSERT_FAILURE/);
assert.equal(preCommitGate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await digest(durable),afterSecond);
assert.equal(count(),2);

// A COMMIT without durable persistence is never a success acknowledgment.
const preDurableGate=makeGate();
await assert.rejects(admitted(preDurableGate,ids[3],afterSecond,{failBeforeDurable:true}),
  error=>error?.code==='PERSISTENCE_UNCERTAIN');
assert.equal(preDurableGate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(await digest(durable),afterSecond);
assert.equal(count(),2);

// Lost acknowledgment AFTER durable persistence is sticky HOLD, not retry/success.
const lostAckGate=makeGate();
await assert.rejects(admitted(lostAckGate,ids[4],afterSecond,{loseAck:true}),
  error=>error?.code==='PERSISTENCE_UNCERTAIN');
assert.equal(lostAckGate.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(count(),3);
assert.notEqual(await digest(durable),afterSecond);
await assert.rejects(admitted(lostAckGate,ids[4],await digest(durable)),
  error=>error?.code==='SQLITE_CROSS_TAB_UNVERIFIED_RELOAD_REQUIRED');
assert.equal(count(),3);

// Reloaded durable bytes are the only authority; review is still NOT game Apply.
const reloaded=loadWriter(await readDurable());
try{
  const record=reloaded.context.readNamedTeamDraft(ids[4]);
  assert.equal(record.game_applied,false);
  const reviewInput={record,projection,team,activeGoalProfileId:'synthetic-goal',
    reviewedTeamName:name,reviewedDraftId:ids[4]};
  assert.equal(classifyNamedDraftFutureApplyReview(reviewInput).reason,
    'EXPLICIT_FUTURE_APPLY_REVIEW_REQUIRED');
  const reviewed=classifyNamedDraftFutureApplyReview({
    ...reviewInput,explicitReviewAcknowledged:true
  });
  assert.equal(reviewed.status,'READY_FOR_EXTERNAL_GAME_SIDE_REVIEW_ONLY');
  assert.equal(reviewed.game_applied,false);
  assert.equal(reviewed.player_data_write,false);
  assert.equal(reloaded.metrics().sqlWrites,0,'review must be read-only');
}finally{reloaded.db.close();}
const beforeNoLocks=await digest(durable);
await assert.rejects(admitted(makeGate(null),ids[2],beforeNoLocks),
  error=>error?.code==='SQLITE_CROSS_TAB_WEB_LOCKS_UNAVAILABLE');
assert.equal(await digest(durable),beforeNoLocks);
assert.equal(publicMaster(),'IMMUTABLE');
assert.equal(lockEntries,6,'two concurrent and four sequential locked sessions');
console.log('PASS G265_NAMED_DRAFT_TWO_TAB_DURABLE_SQLJS_CAS_STALE_ZERO_WRITE_ROLLBACK_ACK_LOSS_RELOAD');
console.log('HOLD G265_PRODUCTION_WEB_LOCKS_23_LEGACY_WRITERS_GAME_APPLY_ANDROID_PRIVATE_SQLITE');
