// RATE.4 synthetic-only SQL.js + fake IndexedDB: snapshot, audit, CAS,
// rollback, ACK-loss and two independent Web Lock contenders. No player DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import initSqlJs from 'sql.js';
import {sha256SqliteBytes} from '../assets/js/sqlite-cross-tab-write-admission.js';
import {createSqliteVersionNeutralAtomicPairGate} from '../assets/js/sqlite-version-neutral-atomic-pair-gate.js';
import {createDisposableEvaluationEscrowStore} from '../assets/js/sqlite-evaluation-pretransaction-escrow-optin.js';
import {createPokemonRatingDurableOptIn} from '../assets/js/sqlite-pokemon-rating-durable-optin.js';
import {POKEMON_PROVISIONAL_RATING_RULE_VERSION as rule} from '../assets/js/pokemon-provisional-rating.js';

const code=fs.readFileSync('assets/js/sqlite-pokemon-rating-durable-optin.js','utf8');
assert.doesNotMatch(fs.readFileSync('assets/js/app.js','utf8'),/sqlite-pokemon-rating-durable-optin/);
assert.match(code,/G14_RATE4_DISPOSABLE_SQLITE_ONLY/);
assert.match(code,/G14_RATE4_RESTORE_BLOCKED_PRODUCTION_WRITERS_UNADMITTED/);
const SQL=await initSqlJs();
const hash=bytes=>sha256SqliteBytes(bytes,webcrypto);
const seedDb=new SQL.Database();
seedDb.run('CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT NOT NULL,rating TEXT,level INTEGER,status TEXT NOT NULL)');
seedDb.run("INSERT INTO pokemon VALUES('fixture-A','instance-A','D-',20,'active'),('fixture-B','instance-B','C',20,'active'),('fixture-C','instance-C','B',20,'active')");
seedDb.run('CREATE TABLE g14_rate4_fixture_authority(marker TEXT PRIMARY KEY)');
seedDb.run("INSERT INTO g14_rate4_fixture_authority VALUES('G14_RATE4_DISPOSABLE_SQLITE_ONLY')");
seedDb.run('CREATE TABLE g14_rate4_rating_audit(batch_id TEXT,pokemon_id TEXT,pokemon_instance_id TEXT,previous_rating TEXT,proposed_rating TEXT,rule_version TEXT,before_sha256 TEXT,consent_digest TEXT,applied_at TEXT,level INTEGER,PRIMARY KEY(batch_id,pokemon_id))');
seedDb.run("CREATE TRIGGER g14_fail_audit BEFORE INSERT ON g14_rate4_rating_audit WHEN NEW.batch_id='rate_failure_batch001' BEGIN SELECT RAISE(ABORT,'synthetic-audit-denial'); END");
seedDb.run('CREATE TABLE public_event_master(id TEXT PRIMARY KEY,value TEXT)');
seedDb.run("INSERT INTO public_event_master VALUES('master','UNCHANGED')");
const seed=new Uint8Array(seedDb.export());seedDb.close();
const openDb=()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('g14-rate4-disposable-primary',1);
  req.onupgradeneeded=()=>{req.result.createObjectStore('database');req.result.createObjectStore('metadata');};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
const db=await openDb(),seedHash=await hash(seed);
await new Promise((resolve,reject)=>{
  const tx=db.transaction(['database','metadata'],'readwrite');
  tx.objectStore('database').put(seed.slice().buffer,'primary');
  tx.objectStore('metadata').put({generation:0,sha256:seedHash},'revision:primary');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
let queue=Promise.resolve(),lockCount=0;
const locks={request(_name,options,callback){
  assert.equal(options.mode,'exclusive');
  const next=queue.then(()=>{lockCount++;return callback({name:_name});});
  queue=next.catch(()=>{});return next;
}};
const pair=()=>createSqliteVersionNeutralAtomicPairGate({db,locks,fingerprint:hash});
const snapshot=name=>createDisposableEvaluationEscrowStore({
  indexedDB,name:'g265-evaluation-escrow-disposable-g14rate4-'+name
});
const make=(name,gate=pair(),store=snapshot(name))=>createPokemonRatingDurableOptIn({
  pairGate:gate,openSqlite:bytes=>new SQL.Database(bytes),
  snapshotStore:store,fingerprint:hash
});
const row=(id,instance,previous,proposed)=>({
  pokemon_id:id,pokemon_instance_id:instance,previous_rating:previous,
  proposed_rating:proposed,status:'PROVISIONAL_HEURISTIC',changed:true,
  rule_version:rule,level:20,species:'synthetic species',nickname:id,
  current_evidence:[{source:'synthetic',name:'verified',scope:'CURRENT'}],
  future_evidence:[],score_breakdown:[],reason_codes:[],missing_inputs:[]
});
const preview={status:'PREVIEW_ONLY',plan:{rule_version:rule},
  rows:[row('fixture-A','instance-A','D-','S+'),
    row('fixture-B','instance-B','C','A+'),
    row('fixture-C','instance-C','B','A')],
  player_data_write:false,overwrite_allowed:false};
const input=(ids,rev,batchId,overrides={})=>({
  preview,freshView:preview,selectedPokemonIds:ids,
  confirmation:{explicit_user_action:true,intent:'APPLY_SELECTED_RATINGS',
    rule_version:rule,acknowledged_diff_count:ids.length,selectedPokemonIds:[...ids]},
  expectedGeneration:rev.generation,expectedFingerprint:rev.sha256,
  batchId,appliedAt:'2026-11-06T15:00:00.000Z',...overrides
});
const read=async()=>{
  const v=await pair().readVerified(),sql=new SQL.Database(v.bytes);
  try{
    const ratings=sql.exec('SELECT pokemon_id,rating FROM pokemon ORDER BY pokemon_id')[0].values;
    const audits=sql.exec('SELECT batch_id,pokemon_id,previous_rating,proposed_rating FROM g14_rate4_rating_audit ORDER BY pokemon_id')?.[0]?.values||[];
    const master=sql.exec("SELECT value FROM public_event_master WHERE id='master'")[0].values[0][0];
    return {...v,ratings,audits,master};
  }finally{sql.close();}
};
const start=await read(),beforeRatings=JSON.stringify(start.ratings);
const invalid=make('invalid');
await assert.rejects(invalid.execute(input(['fixture-A'],start,'rate_invalid_batch001',{
  confirmation:{explicit_user_action:false}
})),{code:'G14_RATE4_PREAPPLY_REJECTED'});
assert.equal(invalid.status().status,'READY');
await assert.rejects(invalid.execute(input(['fixture-A','fixture-A'],start,'rate_invalid_batch001')),
  {code:'G14_RATE4_PREAPPLY_REJECTED'});
assert.equal(JSON.stringify((await read()).ratings),beforeRatings);
const corruptStore={write:async()=>{},read:async()=>({generation:0,sha256:'0'.repeat(64),bytes:new ArrayBuffer(1)})};
const corrupt=make('corrupt',pair(),corruptStore);
await assert.rejects(corrupt.execute(input(['fixture-A'],start,'rate_corrupt_batch01')),
  {code:'G14_RATE4_SNAPSHOT_READBACK_MISMATCH'});
assert.equal(corrupt.status().status,'UNVERIFIED_RELOAD_REQUIRED');
assert.equal(JSON.stringify((await read()).ratings),beforeRatings);
const successStore=snapshot('success'),success=make('success',pair(),successStore);
const done=await success.execute(input(['fixture-A'],start,'rate_success_batch01'));
assert.equal(done.status,'ISOLATED_PERSISTED');assert.equal(done.recordCount,1);
assert.equal(done.productionApply,false);assert.equal(done.player_data_write,false);
assert.equal(done.snapshotPreserved,true);
const captured=await successStore.read();
assert.equal(await hash(new Uint8Array(captured.bytes)),start.sha256);
assert.equal(captured.generation,0);
const afterA=await read();
assert.deepEqual(afterA.ratings,[['fixture-A','S+'],['fixture-B','C'],['fixture-C','B']]);
assert.deepEqual(afterA.audits,[['rate_success_batch01','fixture-A','D-','S+']]);
assert.equal(afterA.master,'UNCHANGED');
assert.equal((await success.inspectRecovery()).classification,'DURABLE_CHANGED_HOLD');
await assert.rejects(success.restore(),{code:'G14_RATE4_RESTORE_BLOCKED_PRODUCTION_WRITERS_UNADMITTED'});
await assert.rejects(success.execute(input(['fixture-B'],afterA,'rate_replay_batch001')),
  {code:'G14_RATE4_UNVERIFIED_RELOAD_REQUIRED'});
// Negative: an altered consented level must fail against the durable row
// inside the lock; the original SQL.js image must remain unchanged.
const levelView={...preview,rows:preview.rows.map(x=>x.pokemon_id==='fixture-B'?{...x,level:21}:x)};
const level=make('level');
await assert.rejects(level.execute(input(['fixture-B'],afterA,'rate_level_batch001',{
  preview:levelView,freshView:levelView
})),{code:'G14_RATE4_DURABLE_RECORD_STALE'});
assert.equal((await read()).sha256,afterA.sha256);
// Negative: a late audit insert failure rolls back the preceding rating update.
const rollback=make('rollback');
await assert.rejects(rollback.execute(input(['fixture-B'],afterA,'rate_failure_batch001')));
const afterRollback=await read();
assert.equal(afterRollback.sha256,afterA.sha256);
assert.equal(afterRollback.generation,afterA.generation);
assert.equal(afterRollback.ratings[1][1],'C');
assert.equal(rollback.status().status,'UNVERIFIED_RELOAD_REQUIRED');
// Two independent tabs, distinct immutable snapshots, same durable baseline:
// exactly one may enter and persist the B update.
const left=make('raceleft'),right=make('raceright');
const [a,b]=await Promise.allSettled([
  left.execute(input(['fixture-B'],afterRollback,'rate_race_left0001')),
  right.execute(input(['fixture-B'],afterRollback,'rate_race_right001'))
]);
assert.equal([a,b].filter(x=>x.status==='fulfilled').length,1);
assert.equal([a,b].filter(x=>x.status==='rejected').length,1);
assert.equal([a,b].find(x=>x.status==='rejected').reason.code,'G265_PAIR_STALE_RELOAD_REQUIRED');
const afterRace=await read();
assert.equal(afterRace.ratings[1][1],'A+');
assert.equal(afterRace.audits.length,2);
assert.equal(afterRace.master,'UNCHANGED');
assert.ok(lockCount>=4);
// ACK-loss: durable write may have committed, but this session must HOLD and
// must never retry or restore the old snapshot over the acknowledged data.
const real=pair();
const lostPair={readVerified:()=>real.readVerified(),
  write:async request=>{await real.write(request);throw Object.assign(new Error('ACK_LOST'),{code:'SYNTHETIC_ACK_LOST'});},
  status:()=>real.status()};
const lostStore=snapshot('acklost'),lost=make('acklost',lostPair,lostStore);
await assert.rejects(lost.execute(input(['fixture-C'],afterRace,'rate_acklost_batch01')),
  {code:'SYNTHETIC_ACK_LOST'});
assert.equal(lost.status().status,'UNVERIFIED_RELOAD_REQUIRED');
const afterLoss=await read();
assert.equal(afterLoss.ratings[2][1],'A');
assert.equal(afterLoss.audits.length,3);
assert.equal(afterLoss.master,'UNCHANGED');
assert.equal((await lostStore.read()).sha256,afterRace.sha256);
await assert.rejects(lost.execute(input(['fixture-C'],afterLoss,'rate_retry_batch001')),
  {code:'G14_RATE4_UNVERIFIED_RELOAD_REQUIRED'});
db.close();
console.log(JSON.stringify({gate:'G14_RATE4_DISPOSABLE_DURABLE_WRITER_SOURCE_TEST',
  status:'PASS',synthetic_sqljs:true,independent_idb_snapshot:true,
  original_rating_audit:true,atomic_rollback:true,cas_two_tab_one_winner:true,
  ack_loss_sticky_hold:true,production_apply:'HOLD',android_owner_uat:'PENDING'}));
