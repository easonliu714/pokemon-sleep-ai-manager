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
  durable.close();reloaded.close();store.close();
  console.log('PASS G62_POSTCOMMIT_'+mode+' SAME_SESSION_RETRY_BLOCKED RELOADED='+status.status+' DURABLE_ATTEMPTS=1');
}
console.log('G62_SOURCE_BOUND_PERSISTENCE_UNCERTAIN_SAFETY_PASS; ANDROID_OWNER_UAT_PENDING; ISSUE_6_OPEN');
