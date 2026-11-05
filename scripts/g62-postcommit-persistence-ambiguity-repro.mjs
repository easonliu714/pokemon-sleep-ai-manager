import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';
import {indexedDB} from 'fake-indexeddb';
import {buildRecipeAttemptFeedbackRecord,RECIPE_ATTEMPT_FEEDBACK_VERSION} from '../assets/js/recipe-attempt-feedback.js';

// G6.2 source-bound safety regression. All SQLite and IDB records are synthetic.
const source=fs.readFileSync(new URL('../assets/js/recipe-attempt-feedback-local.js',import.meta.url),'utf8');
const stripped=source.replace(/^import[\s\S]*?from '\.\/recipe-attempt-feedback\.js';\s*/,'');
assert.notEqual(stripped,source,'production import boundary must match');
const executable=stripped.replace(/\bexport\s+(?=(?:async\s+)?function\s)/g,'');
assert.match(executable,/async function recordRecipeAttemptFailure/);
const SQL=await initSqlJs();
const query=(db,sql,params=[])=>{
  const stmt=db.prepare(sql);
  try{stmt.bind(params);const out=[];while(stmt.step())out.push(stmt.getAsObject());return out;}
  finally{stmt.free();}
};
const count=db=>Number(query(db,'SELECT COUNT(*) AS n FROM recipe_attempt_feedback')[0].n);
const setup=db=>{
  db.run('CREATE TABLE recipe_master(recipe_id TEXT PRIMARY KEY,recipe_name TEXT,category TEXT)');
  db.run("INSERT INTO recipe_master VALUES('r1','Synthetic Recipe','synthetic')");
  db.run('CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY)');
  db.run("INSERT INTO ingredient_master VALUES('特選蘋果')");
  db.run('CREATE TABLE recipe_attempt_feedback(attempt_id TEXT PRIMARY KEY,recipe_id TEXT,attempted_at TEXT,outcome TEXT,actual_ingredients_json TEXT,source_type TEXT,source_name TEXT,source_ref TEXT,reference_maybe_wrong INTEGER,recommendation_paused_after_attempt INTEGER,notes TEXT,created_at TEXT)');
  db.run('CREATE TABLE recipe_feedback_state(recipe_id TEXT PRIMARY KEY,recommendation_paused INTEGER,reference_maybe_wrong INTEGER,last_attempt_id TEXT,updated_at TEXT)');
};
const openStore=name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,1);
  req.onupgradeneeded=()=>req.result.createObjectStore('snapshots');
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>resolve(req.result);
});
const writeSnapshot=(store,bytes)=>new Promise((resolve,reject)=>{
  const tx=store.transaction('snapshots','readwrite');
  tx.objectStore('snapshots').put(bytes,'player-synthetic');
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error);
});
const readSnapshot=store=>new Promise((resolve,reject)=>{
  const tx=store.transaction('snapshots','readonly');
  const req=tx.objectStore('snapshots').get('player-synthetic');
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error);
});
for(const mode of ['DENY_BEFORE_IDB_WRITE','ACK_LOST_AFTER_IDB_WRITE']){
  const db=new SQL.Database();setup(db);
  const store=await openStore('g62-safe-'+mode);
  await writeSnapshot(store,db.export()); // Durable baseline exists before the attempt.
  const session=new Map();
  const sessionStorage={
    getItem:key=>session.get(key)||null,
    setItem:(key,value)=>session.set(key,String(value)),
    removeItem:key=>session.delete(key),
  };
  let persistMode=mode,commits=0,idCounter=0;
  function bootContext(activeDb){
    const context=vm.createContext({
      rows:(sql,params)=>query(activeDb,sql,params),
      run:(sql,params)=>activeDb.run(sql,params),
      begin:()=>activeDb.run('BEGIN'),
      commit:()=>{activeDb.run('COMMIT');commits++;},
      rollback:()=>activeDb.run('ROLLBACK'),
      isDatabaseReady:()=>true,isRescueReadonly:()=>false,
      persist:async()=>{
        if(persistMode==='DENY_BEFORE_IDB_WRITE')throw new Error('synthetic_idb_write_denied');
        await writeSnapshot(store,activeDb.export());
        if(persistMode==='ACK_LOST_AFTER_IDB_WRITE')throw new Error('synthetic_idb_ack_lost');
      },
      sessionStorage,
      PUBLIC_RECIPE_PROVENANCE:[{recipe_id:'r1',lifecycle:'ACTIVE',formula_source_type:'PUBLIC_RECIPE_PROVENANCE'}],
      buildRecipeAttemptFeedbackRecord,RECIPE_ATTEMPT_FEEDBACK_VERSION,
      crypto:{randomUUID:()=> 'synthetic-id-'+(++idCounter)},
      CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
      dispatchEvent:()=>{},
    });
    vm.runInContext(executable+'\n;globalThis.__record=recordRecipeAttemptFailure;globalThis.__status=getRecipeAttemptPersistenceStatus;',context,{timeout:3000});
    return context;
  }
  const context=bootContext(db);
  const input={recipe_id:'r1',attempted_at:'2026-10-24T00:00:00Z',actual_ingredients:[{ingredient_name:'特選蘋果',quantity:2}],recommendation_paused:true};
  await assert.rejects(context.__record(input),e=>e.code==='PERSISTENCE_UNCERTAIN'&&e.attempt_id?.startsWith('recipe-attempt:'));
  assert.equal(commits,1,'SQL COMMIT must precede ambiguous IDB response');
  assert.equal(count(db),1,'one row committed in memory');
  assert.equal(context.__status().status,'UNVERIFIED','same session cannot infer durability from SQL memory');
  persistMode='OK';
  await assert.rejects(context.__record(input),e=>e.code==='PERSISTENCE_UNCERTAIN');
  assert.equal(commits,1,'blind retry must not reach another COMMIT');
  assert.equal(count(db),1,'blind retry must not create a second attempt');
  const durableBefore=await readSnapshot(store);
  const reloaded=new SQL.Database(durableBefore);
  assert.equal(count(reloaded),mode==='ACK_LOST_AFTER_IDB_WRITE'?1:0,'durability truth differs by failure mode');
  db.close(); // Discard ambiguous in-memory state, as a normal reload does.
  const afterReload=bootContext(reloaded);
  const status=afterReload.__status();
  assert.equal(status.status,mode==='ACK_LOST_AFTER_IDB_WRITE'?'PERSISTED':'NOT_PERSISTED');
  assert.equal(status.source,'RELOADED_SQLITE_READBACK');
  assert.equal(session.size,0,'reloaded readback clears only the metadata hold marker');
  if(status.status==='NOT_PERSISTED')await afterReload.__record(input);
  assert.equal(count(reloaded),1,'post-reload resolution must contain exactly one attempt');
  const finalBytes=await readSnapshot(store);
  const durable=new SQL.Database(finalBytes);
  assert.equal(count(durable),1,'exactly one attempt must survive independent IDB reload');
  assert.equal(Number(query(durable,'SELECT COUNT(*) AS n FROM recipe_master')[0].n),1,'public recipe master untouched');
  assert.equal(Number(query(durable,'SELECT COUNT(*) AS n FROM recipe_feedback_state')[0].n),1,'player-private feedback state preserved');
  // Independent G6.2 durable readback boundary: SQLite affinity can return
  // NULL/invalid persisted flags. Number(null)===0 is NOT a verified unpause.
  // All records here are isolated SQL.js fixtures, never player data.
  const readbackDb=new SQL.Database();setup(readbackDb);
  readbackDb.run("INSERT INTO recipe_feedback_state(recipe_id,recommendation_paused,reference_maybe_wrong,last_attempt_id,updated_at) VALUES('r1',NULL,0,NULL,'synthetic')");
  const markerKey='pokemon-sleep-g62-persistence-uncertain-v1';
  const toggleMarker={operation:'PAUSE_TOGGLE',recipe_id:'r1',target_paused:0};
  const setToggleMarker=()=>sessionStorage.setItem(markerKey,JSON.stringify(toggleMarker));
  setToggleMarker();
  const readbackContext=bootContext(readbackDb);
  assert.equal(readbackContext.__status().status,'UNVERIFIED','NULL cannot prove a persisted unpause');
  assert.ok(sessionStorage.getItem(markerKey),'ambiguous NULL must retain the recovery marker');
  readbackDb.run("UPDATE recipe_feedback_state SET recommendation_paused=2 WHERE recipe_id='r1'");
  assert.equal(readbackContext.__status().status,'UNVERIFIED','out-of-range flag cannot prove an unpause');
  assert.ok(sessionStorage.getItem(markerKey),'invalid flag must retain the recovery marker');
  readbackDb.run("UPDATE recipe_feedback_state SET recommendation_paused=0 WHERE recipe_id='r1'");
  assert.equal(readbackContext.__status().status,'PERSISTED','verified exact zero proves the requested unpause');
  assert.equal(sessionStorage.getItem(markerKey),null,'only verified readback clears the marker');
  readbackDb.run("UPDATE recipe_feedback_state SET recommendation_paused=1 WHERE recipe_id='r1'");
  setToggleMarker();
  assert.equal(readbackContext.__status().status,'NOT_PERSISTED','valid opposite state is verified mismatch, not uncertain');
  assert.equal(sessionStorage.getItem(markerKey),null,'verified mismatch permits deliberate recovery');
  readbackDb.close();
  console.log('PASS G62_TOGGLE_RELOADED_NULL_OR_INVALID_FLAG_RETAINS_HOLD_VALID_0_OR_1_RESOLVES');
  durable.close();reloaded.close();store.close();
  console.log('PASS G62_POSTCOMMIT_'+mode+' SAME_SESSION_RETRY_BLOCKED RELOADED='+status.status+' DURABLE_ATTEMPTS=1');
}
console.log('G62_SOURCE_BOUND_PERSISTENCE_UNCERTAIN_SAFETY_PASS; ANDROID_OWNER_UAT_PENDING; ISSUE_6_OPEN');


// Independent B/G6.2 negative reproduction: if sessionStorage marker read is
// denied or unavailable, absence of a readable marker is NOT proof of CLEAR.
// This source-bound VM has no player SQLite/IDB, no production writer, no app version change.
for(const mode of ['DENIED_GET','MISSING_STORAGE','MALFORMED_JSON','INVALID_MARKER','READABLE_EMPTY']){
  const storage=mode==='DENIED_GET'?{getItem(){throw Error('synthetic_session_storage_denied');}}
    :mode==='MALFORMED_JSON'?{getItem(){return '{invalid json';}}
    :mode==='INVALID_MARKER'?{getItem(){return JSON.stringify({recipe_id:'r1',operation:'PAUSE_TOGGLE',target_paused:'not-a-flag'});}}
    :mode==='READABLE_EMPTY'?{getItem(){return null;}}:undefined;
  const context=vm.createContext({
    ...(storage?{sessionStorage:storage}:{}),
    isDatabaseReady:()=>true,isRescueReadonly:()=>false,
  });
  vm.runInContext(executable+'\n;globalThis.__status=getRecipeAttemptPersistenceStatus;',context,{timeout:3000});
  const status=context.__status();
  if(mode==='READABLE_EMPTY')assert.equal(status.status,'CLEAR','readable empty marker remains normal');
  else {
    assert.equal(status.status,'UNVERIFIED',mode+' must not promote missing marker authority to CLEAR');
    assert.equal(status.reason,'PERSISTENCE_MARKER_STORAGE_UNAVAILABLE');
  }
}
console.log('PASS G62_PERSISTENCE_MARKER_READ_DENIAL_HOLDS_READSIDE_RECOMMENDATIONS');


// Independent G6.2 negative-first gate: sessionStorage can permit reads while
// denying/dropping writes. A post-COMMIT-only marker cannot survive reload,
// so neither attempt recording nor pause toggle may touch SQLite until a
// same-tab recovery intent has been written AND read back successfully.
// Synthetic SQL.js-free VM mocks; no real player database or writer admission.
for(const mode of ['DENIED_SET','SILENT_DROP_SET']){
  let sqlMutations=0,persistCalls=0;
  const storage={
    getItem:()=>null,
    setItem:mode==='DENIED_SET'
      ?()=>{throw new Error('synthetic_sessionStorage_set_denied');}
      :()=>{},
    removeItem:()=>{},
  };
  const context=vm.createContext({
    sessionStorage:storage,
    rows:(sql)=>{
      if(sql.includes('FROM recipe_master'))return [{recipe_id:'r1',recipe_name:'Synthetic Recipe',category:'synthetic'}];
      if(sql.includes('FROM ingredient_master'))return [{ingredient_name:'特選蘋果'}];
      return [];
    },
    run:()=>{sqlMutations++;},
    begin:()=>{sqlMutations++;},
    commit:()=>{sqlMutations++;},
    rollback:()=>{},
    persist:async()=>{persistCalls++;},
    isDatabaseReady:()=>true,isRescueReadonly:()=>false,
    PUBLIC_RECIPE_PROVENANCE:[{recipe_id:'r1',lifecycle:'ACTIVE',formula_source_type:'PUBLIC_RECIPE_PROVENANCE'}],
    buildRecipeAttemptFeedbackRecord,RECIPE_ATTEMPT_FEEDBACK_VERSION,
    crypto:{randomUUID:()=> 'synthetic-denied-marker'},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    dispatchEvent:()=>{},
  });
  vm.runInContext(executable+
    '\n;globalThis.__record=recordRecipeAttemptFailure;globalThis.__toggle=setRecipeRecommendationPaused;',
    context,{timeout:3000});
  const attempt={recipe_id:'r1',attempted_at:'2026-10-24T00:00:00Z',
    actual_ingredients:[{ingredient_name:'特選蘋果',quantity:2}],recommendation_paused:true};
  await assert.rejects(context.__record(attempt),
    error=>error.code==='PERSISTENCE_MARKER_STORAGE_UNAVAILABLE',
    mode+' attempt must reject BEFORE SQL COMMIT when recovery marker is unwritable');
  await assert.rejects(context.__toggle('r1',true),
    error=>error.code==='PERSISTENCE_MARKER_STORAGE_UNAVAILABLE',
    mode+' pause toggle must reject BEFORE SQLite mutation');
  assert.equal(sqlMutations,0,mode+' cannot mutate player SQLite before verified recovery intent');
  assert.equal(persistCalls,0,mode+' cannot call IndexedDB persist without verified intent');
}
console.log('PASS G62_PRECOMMIT_MARKER_WRITE_READBACK_REQUIRED_BEFORE_SQL_MUTATION');
